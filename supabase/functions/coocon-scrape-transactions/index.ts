// supabase/functions/coocon-scrape-transactions/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Direction = "IN" | "OUT";

type Body = {
  eventId: string;
  scrapeAccountId: string;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  cooconOutput?: unknown; // ✅ 프론트에서 받은 조회 결과(Output 원본)
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
  const t = tx_time && /^\d{2}:\d{2}:\d{2}$/.test(tx_time) ? tx_time : "00:00:00";
  return `${tx_date}T${t}Z`;
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * ✅ cooconOutput(조회 결과 원본) → NormalizedTx[]
 *
 * 쿠콘 Output 구조가 고객사/상품/샘플에 따라 다를 수 있어서,
 * 1) 배열 후보들을 최대한 찾아보고
 * 2) 각 row에서 날짜/시간/금액/입출금/메모/상대방/잔액을 추출 시도
 *
 * 실제 Output 샘플(콘솔에서 찍은 json)을 주면 여기 파서 정확도를 더 올릴 수 있음.
 */
function normalizeFromCooconOutput(cooconOutput: any): NormalizedTx[] {
  if (!cooconOutput) return [];

  // 0) 흔한 래핑 제거: {Output:{Result:{...}}} 또는 {Result:{...}} 또는 그냥 {...}
  const root =
    cooconOutput?.Output?.Result ??
    cooconOutput?.Output ??
    cooconOutput?.Result ??
    cooconOutput;

  // 1) 배열 후보 찾기 (가장 흔한 케이스들을 폭넓게)
  const candidates: any[] = [];

  // 직접 배열이면 그대로
  if (Array.isArray(root)) candidates.push(root);

  // 흔한 키들
  const keysToTry = [
    "List",
    "list",
    "TX_LIST",
    "TxList",
    "txList",
    "TXLIST",
    "OUT",
    "out",
    "ResultList",
    "resultList",
    "Data",
    "data",
    "rows",
    "Rows",
    "items",
    "Items",
  ];

  for (const k of keysToTry) {
    const v = (root as any)?.[k];
    if (Array.isArray(v)) candidates.push(v);
  }

  // 한 단계 더 들어가서 배열 찾기
  for (const k of Object.keys(root ?? {})) {
    const v = (root as any)[k];
    if (v && typeof v === "object") {
      for (const kk of keysToTry) {
        const vv = (v as any)?.[kk];
        if (Array.isArray(vv)) candidates.push(vv);
      }
    }
  }

  const list = candidates.find((x) => Array.isArray(x) && x.length > 0) ?? [];
  if (!Array.isArray(list) || list.length === 0) return [];

  const out: NormalizedTx[] = [];

  for (const row of list) {
    if (!row || typeof row !== "object") continue;

    // 날짜 키 후보
    const dateRaw =
      row.tx_date ??
      row.TxDate ??
      row.TRN_DT ??
      row.TRNDATE ??
      row.date ??
      row.DT ??
      row.거래일자 ??
      row.거래일 ??
      row["거래일"] ??
      row["거래일자"];

    const timeRaw =
      row.tx_time ??
      row.TxTime ??
      row.TRN_TM ??
      row.time ??
      row.TM ??
      row.거래시간 ??
      row["거래시간"];

    // 금액(입금/출금/거래금액 등)
    const amtRaw =
      row.amount ??
      row.AMT ??
      row.TRN_AMT ??
      row.거래금액 ??
      row["거래금액"] ??
      row.입금 ??
      row.출금 ??
      row["입금"] ??
      row["출금"];

    // 입출금 방향 후보 (없으면 amount 부호로 추정)
    const dirRaw =
      row.direction ??
      row.DIR ??
      row.INOUT ??
      row.inout ??
      row.입출금구분 ??
      row["입출금구분"] ??
      row.구분 ??
      row["구분"];

    const balRaw =
      row.balance ??
      row.BAL ??
      row.BALANCE ??
      row.잔액 ??
      row["잔액"];

    const memoRaw =
      row.memo ??
      row.MEMO ??
      row.REMARK ??
      row.적요 ??
      row["적요"] ??
      row.내용 ??
      row["내용"];

    const counterpartyRaw =
      row.counterparty ??
      row.OPPONENT ??
      row.TRADER ??
      row.거래처 ??
      row["거래처"] ??
      row.상대방 ??
      row["상대방"] ??
      row.보낸사람 ??
      row["보낸사람"];

    const counterAccRaw =
      row.counterparty_account ??
      row.OPP_ACC ??
      row.OPPONENT_ACC ??
      row.상대계좌 ??
      row["상대계좌"];

    // ---- normalize ----
    const tx_date = String(dateRaw ?? "").trim();
    if (!isYmd(tx_date)) continue;

    let tx_time: string | null = null;
    if (timeRaw != null) {
      const t = String(timeRaw).trim();
      // HHMMSS → HH:MM:SS 보정
      if (/^\d{6}$/.test(t)) tx_time = `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;
      else if (/^\d{2}:\d{2}:\d{2}$/.test(t)) tx_time = t;
      else tx_time = null;
    }

    const amountNum = Number(String(amtRaw ?? "").replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(amountNum) || amountNum === 0) continue;

    let direction: Direction = "IN";
    const dirStr = String(dirRaw ?? "").toUpperCase();

    if (dirStr.includes("OUT") || dirStr.includes("출금") || dirStr.includes("지출")) direction = "OUT";
    else if (dirStr.includes("IN") || dirStr.includes("입금") || dirStr.includes("수입")) direction = "IN";
    else {
      // fallback: 입금/출금이 분리돼 들어온 케이스
      const hasIn = row.입금 != null || row["입금"] != null;
      const hasOut = row.출금 != null || row["출금"] != null;
      if (hasOut && !hasIn) direction = "OUT";
      else if (hasIn && !hasOut) direction = "IN";
      else direction = amountNum < 0 ? "OUT" : "IN";
    }

    const amount = Math.abs(amountNum);

    const balanceNum = balRaw == null ? null : Number(String(balRaw).replace(/[^\d.-]/g, ""));
    const balance = Number.isFinite(balanceNum as any) ? (balanceNum as number) : null;

    const memo = memoRaw == null ? null : String(memoRaw).trim() || null;
    const counterparty = counterpartyRaw == null ? null : String(counterpartyRaw).trim() || null;
    const counterparty_account = counterAccRaw == null ? null : String(counterAccRaw).trim() || null;

    out.push({
      tx_date,
      tx_time,
      amount,
      direction,
      balance,
      memo,
      counterparty,
      counterparty_account,
      raw_json: row,
    });
  }

  return out;
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

    // 2) 이 유저가 event 멤버인지 확인 (user_id 우선, email fallback)
    let ownerMemberId: string | null = null;

    if (userId) {
      const { data: memberRow, error: memErr } = await userClient
        .from("event_members")
        .select("id")
        .eq("event_id", body.eventId)
        .eq("user_id", userId)
        .maybeSingle();

      if (memErr) return json({ error: "Member check failed", detail: memErr.message }, 500);
      if (memberRow?.id) ownerMemberId = memberRow.id as string;
    }

    if (!ownerMemberId && userData.user.email) {
      const { data: memberRow, error: memErr } = await userClient
        .from("event_members")
        .select("id")
        .eq("event_id", body.eventId)
        .eq("email", userData.user.email)
        .maybeSingle();

      if (memErr) return json({ error: "Member check failed", detail: memErr.message }, 500);
      if (memberRow?.id) ownerMemberId = memberRow.id as string;
    }

    if (!ownerMemberId) return json({ error: "Forbidden", message: "not event member" }, 403);

    // ✅ 2.5) 리포트 확정이면 스크래핑 차단
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
        },
        409
      );
    }

    // 3) scrapeAccount 권한 + event_id 확인 (+ bank_name/account_masked 가져오기)
    const { data: myAccount, error: accErr } = await userClient
      .from("event_scrape_accounts")
      .select("id, event_id, owner_user_id, bank_code, bank_name, account_masked")
      .eq("id", body.scrapeAccountId)
      .maybeSingle();

    if (accErr) return json({ error: "Account read failed", detail: accErr.message }, 500);
    if (!myAccount) return json({ error: "Forbidden", message: "not your scrape account" }, 403);
    if (myAccount.event_id !== body.eventId) {
      return json({ error: "Forbidden", message: "scrape account not for this event" }, 403);
    }
    if (myAccount.owner_user_id !== userId) {
      return json({ error: "Forbidden", message: "scrape account not owned by user" }, 403);
    }

    // ✅ 4) 프론트에서 받은 cooconOutput으로 fetched 생성
    const fetched: NormalizedTx[] = normalizeFromCooconOutput((body as any).cooconOutput);

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
        is_reflected: false,
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
    let reflectedLedgerNew = 0;
    let reflectedLedgerTotal = 0;

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

    const bankLabel = `${myAccount.bank_name ?? myAccount.bank_code ?? ""} ${myAccount.account_masked ?? ""}`.trim() || null;

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

    if (ledgerRows.length > 0) {
      const { data: insertedLed, error: ledInsErr } = await admin
        .from("event_ledger_entries")
        .insert(ledgerRows)
        .select("id");

      if (ledInsErr) return json({ error: "Ledger insert failed", detail: ledInsErr.message }, 500);
      reflectedLedgerNew = insertedLed?.length ?? 0;
    }

    const reflectedTxHashes = reflectedHashKeys.map((k) => k.replace(/^SCRAPE:/, "")).filter(Boolean);

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
    });
  } catch (e: any) {
    return json({ error: "Unhandled", detail: String(e?.message ?? e) }, 500);
  }
});
