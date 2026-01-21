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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
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

Deno.serve(async (req) => {
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

    // 2) 이 유저가 event 멤버인지 확인
    const { data: memberRow, error: memErr } = await userClient
      .from("event_members")
      .select("id")
      .eq("event_id", body.eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memErr) return json({ error: "Member check failed" }, 500);
    if (!memberRow) return json({ error: "Forbidden (not event member)" }, 403);

    // ✅ 2.5) 리포트 확정 상태면 스크래핑 차단 (C단계)
    const { data: ev, error: evErr } = await userClient
      .from("events")
      .select("report_status, report_finalized_at")
      .eq("id", body.eventId)
      .maybeSingle();

    if (evErr) return json({ error: "Event read failed" }, 500);

    if (ev?.report_status === "finalized") {
      return json(
        {
          error: "Report finalized",
          message:
            "확정된 현장 참석자 리포트는 갱신할 수 없습니다.",
          report_finalized_at: ev.report_finalized_at ?? null,
        },
        409
      );
    }

    // 3) 이 scrapeAccount가 내 접근 권한 범위인지 확인
    // ✅ event_id까지 같이 확인해서 안전성 강화
    const { data: myAccount, error: accErr } = await userClient
      .from("event_scrape_accounts")
      .select("id, event_id, bank_code, account_masked")
      .eq("id", body.scrapeAccountId)
      .maybeSingle();

    if (accErr) return json({ error: "Account read failed" }, 500);
    if (!myAccount) return json({ error: "Forbidden (not your scrape account)" }, 403);
    if (myAccount.event_id !== body.eventId) {
      return json({ error: "Forbidden (scrape account not for this event)" }, 403);
    }

    // 4) (TODO) 쿠콘 거래내역 조회 fetch로 교체
    // - 지금은 엔진 없으니 stub
    // - 여기에서 쿠콘 응답을 NormalizedTx[] 로 매핑하면 됨
    const fetched: NormalizedTx[] = [
      // 예시:
      // {
      //   tx_date: "2026-01-19",
      //   tx_time: "13:10:00",
      //   amount: 100000,
      //   direction: "IN",
      //   balance: 500000,
      //   memo: "축의금",
      //   counterparty: "김OO",
      //   counterparty_account: null,
      //   raw_json: { ...original },
      // },
    ];

    // 5) 서비스 롤로 적재 (RLS 무시)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const rows: any[] = [];
    for (const t of fetched) {
      // 방어: direction/amount
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

      rows.push({
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
        is_reflected: true,
        tx_hash,
        raw_json: t.raw_json ?? null,
        scraped_at: new Date().toISOString(),
      });
    }

    // ✅ 멱등 적재: (scrape_account_id, tx_hash) 기준 중복은 무시
    // - ux_est_dedupe 유니크 인덱스와 정합
    let inserted = 0;

    if (rows.length > 0) {
      const { data: upserted, error: upErr } = await admin
        .from("event_scrape_transactions")
        .upsert(rows, {
          onConflict: "scrape_account_id,tx_hash",
          ignoreDuplicates: true,
        })
        .select("id");

      if (upErr) return json({ error: "Insert failed", detail: upErr.message }, 500);
      inserted = upserted?.length ?? 0;
    }

    // 6) 계좌 last_scraped_at 갱신
    await admin
      .from("event_scrape_accounts")
      .update({ last_scraped_at: new Date().toISOString() })
      .eq("id", body.scrapeAccountId);

    return json({
      ok: true,
      inserted,
      fetched: fetched.length,
      note: "fetched는 아직 stub입니다. 엔진 받으면 4)에서 쿠콘 fetch로 교체하세요.",
    });
  } catch (e: any) {
    return json({ error: "Unhandled", detail: String(e?.message ?? e) }, 500);
  }
});
