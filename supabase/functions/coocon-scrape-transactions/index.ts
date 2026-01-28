import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Direction = "IN" | "OUT";

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

type Body = {
  eventId: string;
  scrapeAccountId: string;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'

  /**
   * ✅ E2E용 추가 입력
   * - fetched: 이미 정규화된 거래내역 (권장)
   * - cooconOutput: 쿠콘 API Output 전체(원본) 넣으면 아래에서 파싱해서 정규화함
   */
  fetched?: NormalizedTx[];
  cooconOutput?: unknown;
};

// ✅ CORS
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

function isHms(s: string) {
  return /^\d{2}:\d{2}:\d{2}$/.test(s);
}

// SHA256 hex
async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
  const t = tx_time && isHms(tx_time) ? tx_time : "00:00:00";
  return `${tx_date}T${t}Z`;
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * ✅ 쿠콘 원본 Output(JSON) → NormalizedTx[]
 * - 가이드에 있는 키들(거래일자/거래시각/입금액/출금액/거래후잔액/기재사항 1/상대계좌번호/상대계좌예금주명)을 최대한 흡수
 * - "거래내역조회", "수시거래내역조회", "수시과거거래내역조회" 등 배열 키 변형도 대응
 */
function normalizeFromCooconOutput(cooconOutput: any): NormalizedTx[] {
  try {
    const out = cooconOutput?.Output ?? cooconOutput; // 혹시 Output만 오거나 전체가 오거나
    const result = out?.Result ?? out?.result ?? out?.RESULT ?? {};
    const arr =
      result?.거래내역조회 ??
      result?.수시거래내역조회 ??
      result?.수시과거거래내역조회 ??
      result?.거래내역 ??
      [];

    if (!Array.isArray(arr)) return [];

    const norm: NormalizedTx[] = [];

    for (const row of arr) {
      const ymdRaw = String(row?.거래일자 ?? row?.TXDATE ?? row?.tx_date ?? "");
      if (!/^\d{8}$/.test(ymdRaw)) continue;
      const tx_date = `${ymdRaw.slice(0, 4)}-${ymdRaw.slice(4, 6)}-${ymdRaw.slice(6, 8)}`;

      const hmsRaw = String(row?.거래시각 ?? row?.TXTIME ?? row?.tx_time ?? "");
      let tx_time: string | null = null;
      if (/^\d{6}$/.test(hmsRaw)) {
        tx_time = `${hmsRaw.slice(0, 2)}:${hmsRaw.slice(2, 4)}:${hmsRaw.slice(4, 6)}`;
      }

      const inAmt = Number(String(row?.입금액 ?? "0").replace(/,/g, ""));
      const outAmt = Number(String(row?.출금액 ?? "0").replace(/,/g, ""));
      const balance = row?.거래후잔액 != null ? Number(String(row.거래후잔액).replace(/,/g, "")) : null;

      const direction: Direction = inAmt > 0 ? "IN" : outAmt > 0 ? "OUT" : "IN";
      const amount = Math.abs(direction === "IN" ? inAmt : outAmt);
      if (!amount || !Number.isFinite(amount)) continue;

      const memo =
        String(row?.["기재사항 1"] ?? row?.기재사항1 ?? row?.memo ?? row?.적요 ?? "").trim() || null;

      const counterparty =
        String(row?.상대계좌예금주명 ?? row?.상대예금주명 ?? row?.counterparty ?? "").trim() || null;

      const counterparty_account =
        String(row?.상대계좌번호 ?? row?.counterparty_account ?? "").trim() || null;

      norm.push({
        tx_date,
        tx_time,
        amount,
        direction,
        balance: Number.isFinite(balance as any) ? (balance as number) : null,
        memo,
        counterparty,
        counterparty_account,
        raw_json: row ?? null,
      });
    }

    return norm;
  } catch {
    return [];
  }
}

/**
 * ✅ 예식 종료 컷오프 이후 스크래핑 잠금
 * - event_settings.ceremony_date (YYYY-MM-DD) + ceremony_end_time (HH:MM)
 * - Asia/Seoul(+09:00)로 해석해서 now가 이후면 잠금
 */
function computeCutoffKst(ceremony_date: string | null, ceremony_end_time: string | null): Date | null {
  if (!ceremony_date || !ceremony_end_time) return null;
  // ceremony_end_time: "HH:MM" or "HH:MM:SS"
  const t = /^\d{2}:\d{2}:\d{2}$/.test(ceremony_end_time)
    ? ceremony_end_time
    : /^\d{2}:\d{2}$/.test(ceremony_end_time)
      ? `${ceremony_end_time}:00`
      : null;
  if (!t) return null;

  // KST로 만든 뒤 Date로 파싱
  const iso = `${ceremony_date}T${t}+09:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// ✅ Preflight
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) 로그인 유저 확인
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

    // 2) 이 유저가 event 멤버인지 확인
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

    // ✅ 2.5) 예식 종료 컷오프 이후 스크래핑 차단 (정책 반영)
    // - events/report_status 대신 event_settings 기준 사용
    const { data: settings, error: setErr } = await userClient
      .from("event_settings")
      .select("ceremony_date, ceremony_end_time")
      .eq("event_id", body.eventId)
      .maybeSingle();

    if (setErr) return json({ error: "Event settings read failed", detail: setErr.message }, 500);

    const cutoff = computeCutoffKst(settings?.ceremony_date ?? null, settings?.ceremony_end_time ?? null);
    if (cutoff && Date.now() >= cutoff.getTime()) {
      return json(
        {
          error: "Scrape locked after cutoff",
          message: "예식 종료 이후에는 은행 내역(스크래핑)을 갱신할 수 없습니다.",
          cutoff_at: cutoff.toISOString(),
        },
        409
      );
    }

    // 3) scrapeAccount 권한 + event_id 확인
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

    // 4) ✅ fetched를 “클라가 보내준 값”으로 반영 (E2E 핵심)
    let fetched: NormalizedTx[] = [];
    if (Array.isArray(body.fetched)) {
      fetched = body.fetched as NormalizedTx[];
    } else if (body.cooconOutput) {
      fetched = normalizeFromCooconOutput(body.cooconOutput);
    } else {
      fetched = [];
    }

    // 5) 서비스 롤 클라이언트
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 5-1) event_scrape_transactions upsert rows
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
        is_reflected: false,
        tx_hash,
        raw_json: t.raw_json ?? null,
        scraped_at: new Date().toISOString(),
      });
    }

    // 5-2) 멱등 upsert
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
    let reflectedLedgerNew = 0;
    let reflectedLedgerTotal = 0;

    // 6-1) 이번 기간 tx 다시 조회
    const { data: txList, error: txReadErr } = await admin
      .from("event_scrape_transactions")
      .select("id, tx_hash, tx_date, tx_time, amount, direction, memo, counterparty, counterparty_account, is_reflected")
      .eq("event_id", body.eventId)
      .eq("scrape_account_id", body.scrapeAccountId)
      .gte("tx_date", body.startDate)
      .lte("tx_date", body.endDate);

    if (txReadErr) return json({ error: "Tx read failed", detail: txReadErr.message }, 500);

    const allTx = (txList ?? []) as any[];
    const inTx = allTx.filter((t) => (t.direction ?? "IN") === "IN" && Number(t.amount ?? 0) > 0);

    // 6-2) 기존 ledger scrape memo hash set
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
      const key = mm.split(/\s+/)[0];
      existingHashSet.add(key);
    }

    const bankLabel =
      `${myAccount.bank_name ?? myAccount.bank_code ?? ""} ${myAccount.account_masked ?? ""}`.trim() || null;

    // 6-3) insert ledger rows
    const ledgerRows: any[] = [];
    const reflectedHashKeys: string[] = [];

    for (const t of inTx) {
      const hash = String((t as any).tx_hash ?? "");
      if (!hash) continue;

      const hashKey = `SCRAPE:${hash}`;

      if (existingHashSet.has(hashKey)) {
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
        side: ownerSide,

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

    // 6-5) is_reflected=true 업데이트
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

    // 7) last_scraped_at 갱신
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
      insertedTx,
      reflectedLedgerNew,
      reflectedLedgerTotal,
      note:
        "이제 fetched(또는 cooconOutput)가 들어오면 event_scrape_transactions upsert + ledger 자동 반영까지 E2E로 동작합니다. dedupe는 memo prefix(SCRAPE:<tx_hash>) 방식 유지.",
    });
  } catch (e: any) {
    return json({ error: "Unhandled", detail: String(e?.message ?? e) }, 500);
  }
});
