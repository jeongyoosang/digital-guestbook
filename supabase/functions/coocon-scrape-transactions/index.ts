// supabase/functions/coocon-scrape-transactions/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Direction = "IN" | "OUT";

type Body = {
  eventId: string;
  scrapeAccountId: string;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
};

type NormalizedTx = {
  tx_date: string; // 'YYYY-MM-DD'
  tx_time?: string | null; // 'HH:MM:SS' (optional)
  amount: number; // always positive numeric
  direction: Direction; // 'IN' | 'OUT'
  balance?: number | null;
  memo?: string | null;
  counterparty?: string | null;
  counterparty_account?: string | null;
  raw_json?: unknown | null;
};

// ✅ CORS (브라우저에서 functions/v1 호출 시 필수)
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...extraHeaders },
  });
}

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// SHA256 hex
async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 계좌별 dedupe를 위한 tx_hash
 * - scrape_account_id를 반드시 포함
 * - tx_date/tx_time/amount/direction/balance/memo/counterparty/counterparty_account 포함
 */
async function makeTxHash(input: {
  scrape_account_id: string;
  tx_date: string;
  tx_time?: string | null;
  direction: Direction;
  amount: number;
  balance?: number | null;
  memo?: string | null;
  counterparty?: string | null;
  counterparty_account?: string | null;
}) {
  const key = [
    input.scrape_account_id,
    input.tx_date,
    input.tx_time ?? "",
    input.direction,
    String(input.amount ?? ""),
    input.balance == null ? "" : String(input.balance),
    (input.memo ?? "").trim(),
    (input.counterparty ?? "").trim(),
    (input.counterparty_account ?? "").trim(),
  ].join("|");
  return sha256Hex(key);
}

function toIsoFromYmdHms(tx_date: string, tx_time?: string | null) {
  // tx_time이 없으면 00:00:00
  const t = tx_time && /^\d{2}:\d{2}:\d{2}$/.test(tx_time) ? tx_time : "00:00:00";
  // Supabase timestamptz에 넣기 쉬운 ISO 형태
  // (시간대 정확도는 나중에 조정 가능. 일단 오류 없이 들어가는 게 목표)
  return `${tx_date}T${t}Z`;
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ✅ Preflight는 무조건 200으로 통과시켜야 함
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) 로그인 유저 확인 (Bearer 토큰)
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = (await req.json()) as Partial<Body>;
    if (!body.eventId || !body.scrapeAccountId || !body.startDate || !body.endDate) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (!isYmd(body.startDate) || !isYmd(body.endDate)) {
      return json({ error: "Invalid date format (YYYY-MM-DD)" }, 400);
    }

    // 2) 이 유저가 event 멤버인지 확인 (+ side 있으면 가져오기)
    const { data: memberRow, error: memErr } = await userClient
      .from("event_members")
      .select("id, side")
      .eq("event_id", body.eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memErr) return json({ error: "Member check failed", detail: memErr.message }, 500);
    if (!memberRow?.id) return json({ error: "Forbidden (not event member)" }, 403);

    const ownerMemberId = memberRow.id as string;
    const ownerSide = (memberRow as any)?.side ?? null;

    // ✅ 2.5) 리포트 확정이면 스크래핑 차단 (기존 로직 유지)
    const { data: ev, error: evErr } = await userClient
      .from("events")
      .select("report_status, report_finalized_at")
      .eq("id", body.eventId)
      .maybeSingle();

    if (evErr) return json({ error: "Event read failed", detail: evErr.message }, 500);

    if (ev?.report_status === "finalized") {
      return json(
        {
          error: "Report finalized",
          message: "확정된 현장 참석자 리포트는 갱신할 수 없습니다.",
          report_finalized_at: ev.report_finalized_at ?? null,
        },
        409
      );
    }

    // 3) scrapeAccount 권한 + event_id 확인 (+ bank_name/account_masked 가져오기)
    const { data: myAccount, error: accErr } = await userClient
      .from("event_scrape_accounts")
      .select("id, event_id, bank_code, bank_name, account_masked")
      .eq("id", body.scrapeAccountId)
      .maybeSingle();

    if (accErr) return json({ error: "Account read failed", detail: accErr.message }, 500);
    if (!myAccount) return json({ error: "Forbidden (not your scrape account)" }, 403);
    if (myAccount.event_id !== body.eventId) {
      return json({ error: "Forbidden (scrape account not for this event)" }, 403);
    }

    // 4) (TODO) 쿠콘 거래내역 조회로 교체
    //    오늘은 "자동 반영 로직"까지 완성하는 목적이므로 fetched는 일단 stub 유지.
    //    fetched를 채우는 순간 아래 로직이 그대로 동작하며 ledger까지 자동 반영됨.
    const fetched: NormalizedTx[] = [];

    // 5) 서비스 롤 클라이언트 (RLS 무시)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 5-1) event_scrape_transactions upsert rows 만들기 (is_reflected는 일단 false)
    const txRows: Array<{
      event_id: string;
      scrape_account_id: string;
      tx_date: string;
      tx_time: string | null;
      amount: number;
      direction: Direction;
      balance: number | null;
      memo: string | null;
      counterparty: string | null;
      counterparty_account: string | null;
      currency: string;
      is_reflected: boolean;
      tx_hash: string;
      raw_json: unknown | null;
      scraped_at: string;
    }> = [];

    for (const t of fetched) {
      const direction: Direction = t.direction === "OUT" ? "OUT" : "IN";
      const amount = Math.abs(Number(t.amount ?? 0));
      if (!t.tx_date || !isYmd(t.tx_date) || !amount) continue;

      const tx_hash = await makeTxHash({
        scrape_account_id: body.scrapeAccountId,
        tx_date: t.tx_date,
        tx_time: t.tx_time ?? null,
        direction,
        amount,
        balance: t.balance ?? null,
        memo: t.memo ?? null,
        counterparty: t.counterparty ?? null,
        counterparty_account: t.counterparty_account ?? null,
      });

      txRows.push({
        event_id: body.eventId,
        scrape_account_id: body.scrapeAccountId,
        tx_date: t.tx_date,
        tx_time: t.tx_time ?? null,
        amount,
        direction,
        balance: t.balance ?? null,
        memo: t.memo ?? null,
        counterparty: t.counterparty ?? null,
        counterparty_account: t.counterparty_account ?? null,
        currency: "KRW",
        is_reflected: false, // ✅ ledger 반영 후 true 처리
        tx_hash,
        raw_json: t.raw_json ?? null,
        scraped_at: new Date().toISOString(),
      });
    }

    // 5-2) event_scrape_transactions 멱등 upsert
    let insertedTx = 0;

    if (txRows.length > 0) {
      const { data: upserted, error: upErr } = await admin
        .from("event_scrape_transactions")
        .upsert(txRows, {
          onConflict: "scrape_account_id,tx_hash",
          ignoreDuplicates: true,
        })
        .select("id");

      if (upErr) return json({ error: "Insert failed", detail: upErr.message }, 500);
      insertedTx = upserted?.length ?? 0;
    }

    // 6) ledger 자동 반영
    // - 원칙: IN만 축의금 후보로 본다(OUT은 무시)
    // - dedupe: memo prefix "SCRAPE:<tx_hash>"로 처리 (스키마 변경 없이)
    // - 이미 ledger에 있으면 스킵하지만, is_reflected는 true로 맞춘다.
    let reflectedLedgerNew = 0;
    let reflectedLedgerTotal = 0;

    // 6-1) 이번 기간에 해당하는 tx를 DB에서 다시 조회 (upsert 결과/기존 포함해서 반영)
    //      ※ fetched가 채워지면 여기부터 진짜 반영됨
    const { data: txList, error: txReadErr } = await admin
      .from("event_scrape_transactions")
      .select("id, tx_hash, tx_date, tx_time, amount, direction, memo, counterparty, is_reflected")
      .eq("event_id", body.eventId)
      .eq("scrape_account_id", body.scrapeAccountId)
      .gte("tx_date", body.startDate)
      .lte("tx_date", body.endDate);

    if (txReadErr) return json({ error: "Tx read failed", detail: txReadErr.message }, 500);

    const allTx = (txList ?? []) as any[];
    const inTx = allTx.filter((t) => (t.direction ?? "IN") === "IN" && Number(t.amount ?? 0) > 0);

    // 6-2) 이미 반영된 ledger(스크래핑) memo들을 한 번에 가져와서 hash set 만들기
    //      (event+owner_member 단위로만 조회하므로 부담 적음)
    const { data: existingLedger, error: ledReadErr } = await admin
      .from("event_ledger_entries")
      .select("memo")
      .eq("event_id", body.eventId)
      .eq("owner_member_id", ownerMemberId)
      .eq("created_source", "scrape");

    if (ledReadErr) return json({ error: "Ledger read failed", detail: ledReadErr.message }, 500);

    const existingHashSet = new Set<string>();
    for (const r of existingLedger ?? []) {
      const m = (r as any)?.memo as string | null;
      if (!m) continue;
      const mm = m.trim();
      if (!mm.startsWith("SCRAPE:")) continue;
      const key = mm.split(/\s+/)[0]; // "SCRAPE:<hash>"
      existingHashSet.add(key);
    }

    const bankLabel = `${myAccount.bank_name ?? myAccount.bank_code ?? ""} ${
      myAccount.account_masked ?? ""
    }`.trim() || null;

    // 6-3) insert할 ledger rows 만들기
    const ledgerRows: any[] = [];
    const reflectedHashKeys: string[] = []; // "SCRAPE:<hash>"

    for (const t of inTx) {
      const hash = String((t as any).tx_hash ?? "");
      if (!hash) continue;

      const hashKey = `SCRAPE:${hash}`;
      if (existingHashSet.has(hashKey)) {
        // 이미 ledger에 있음 → total 반영으로 카운트만 하고, tx is_reflected true로 맞춤
        reflectedLedgerTotal += 1;
        reflectedHashKeys.push(hashKey);
        continue;
      }

      const occurredAt = toIsoFromYmdHms(String((t as any).tx_date), (t as any).tx_time ?? null);
      const memoTail = ((t as any).memo ?? "").toString().trim();
      const counterparty = ((t as any).counterparty ?? "").toString().trim();

      ledgerRows.push({
        event_id: body.eventId,
        owner_member_id: ownerMemberId,
        side: ownerSide, // 없으면 null 들어감 (컬럼 nullable이어야 함)

        guest_name: counterparty || null,
        relationship: null,
        guest_phone: null,
        attended: null,
        attended_at: null,
        attendance_note: null,

        gift_amount: Number((t as any).amount),
        gift_method: "scrape",
        gift_occurred_at: occurredAt,

        account_id: null,
        account_label: bankLabel,

        message_id: null,
        main_message: null,
        message_created_at: null,

        ticket_count: 0,
        return_given: false,
        thanks_done: false,
        thanks_method: null,
        thanks_sent_at: null,

        memo: memoTail ? `${hashKey} ${memoTail}` : `${hashKey}`,
        created_source: "scrape",
      });

      reflectedLedgerTotal += 1;
      reflectedHashKeys.push(hashKey);
    }

    // 6-4) ledger insert
    if (ledgerRows.length > 0) {
      const { data: insertedLed, error: ledInsErr } = await admin
        .from("event_ledger_entries")
        .insert(ledgerRows)
        .select("id");

      if (ledInsErr) return json({ error: "Ledger insert failed", detail: ledInsErr.message }, 500);
      reflectedLedgerNew = insertedLed?.length ?? 0;
    }

    // 6-5) 반영된 tx들 is_reflected=true 업데이트
    const reflectedTxHashes = reflectedHashKeys
      .map((k) => k.replace(/^SCRAPE:/, ""))
      .filter(Boolean);

    if (reflectedTxHashes.length > 0) {
      for (const part of chunk(reflectedTxHashes, 100)) {
        const { error: upRefErr } = await admin
          .from("event_scrape_transactions")
          .update({ is_reflected: true })
          .eq("event_id", body.eventId)
          .eq("scrape_account_id", body.scrapeAccountId)
          .in("tx_hash", part);

        if (upRefErr) {
          return json({ error: "Tx reflect update failed", detail: upRefErr.message }, 500);
        }
      }
    }

    // 7) 계좌 last_scraped_at 갱신
    const { error: lastErr } = await admin
      .from("event_scrape_accounts")
      .update({ last_scraped_at: new Date().toISOString() })
      .eq("id", body.scrapeAccountId);

    if (lastErr) {
      return json({ error: "Account last_scraped_at update failed", detail: lastErr.message }, 500);
    }

    return json({
      ok: true,
      fetched: fetched.length,
      insertedTx, // event_scrape_transactions에 "새로" 들어온 건수
      reflectedLedgerNew, // ledger에 "새로" 생성된 건수
      reflectedLedgerTotal, // ledger 반영 대상(이미 존재 포함)
      note:
        "현재 fetched는 stub([])입니다. 4)에서 쿠콘 거래내역을 채우면 insertedTx/reflectedLedger가 실제로 증가합니다. ledger dedupe는 memo prefix(SCRAPE:<tx_hash>)로 처리합니다.",
    });
  } catch (e: any) {
    return json({ error: "Unhandled", detail: String(e?.message ?? e) }, 500);
  }
});
