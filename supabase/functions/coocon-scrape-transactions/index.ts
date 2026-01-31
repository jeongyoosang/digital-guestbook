// supabase/functions/coocon-scrape-transactions/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ================= Types ================= */

type Direction = "IN" | "OUT";

type Body = {
  eventId: string;
  scrapeAccountId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  cooconOutput?: unknown;
};

type NormalizedTx = {
  event_id: string;
  scrape_account_id: string;

  tx_date: string;        // YYYY-MM-DD
  tx_time: string | null; // HH:mm:ss | null

  amount: number;         // always +
  direction: Direction;

  balance: number | null;
  memo: string | null;
  counterparty: string | null;

  raw_json: unknown | null;
};

/* ================= CORS ================= */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/* ================= Utils ================= */

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function normalizeDateYmd(input: unknown): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;

  if (isYmd(s)) return s;

  if (/^\d{8}$/.test(s)) {
    const out = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    return isYmd(out) ? out : null;
  }

  const m = s.match(/^(\d{4})[./-](\d{2})[./-](\d{2})$/);
  if (m) {
    const out = `${m[1]}-${m[2]}-${m[3]}`;
    return isYmd(out) ? out : null;
  }

  return null;
}

function normalizeTimeHms(input: unknown): string | null {
  if (input == null) return null;
  const t = String(input).trim();
  if (!t) return null;
  if (/^\d{6}$/.test(t)) return `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  return null;
}

function normalizeAmount(v: unknown): number {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Math.abs(n);
}

function normalizeDirection(v: unknown): Direction {
  const s = String(v ?? "").toUpperCase();
  if (s.includes("출금") || s.includes("OUT") || s.includes("-")) return "OUT";
  return "IN";
}

/* ================= Normalize Coocon ================= */

function normalizeFromCooconOutput(
  eventId: string,
  scrapeAccountId: string,
  cooconOutput: any
): NormalizedTx[] {
  if (!cooconOutput) return [];

  const root =
    cooconOutput?.Result ??
    cooconOutput?.Output?.Result ??
    cooconOutput?.Output ??
    cooconOutput;

  const candidateLists: any[][] = [];
  const keys = ["ResultList", "List", "TX_LIST", "txList", "Data", "rows", "items"];

  if (Array.isArray(root)) candidateLists.push(root);

  for (const k of keys) {
    if (Array.isArray(root?.[k])) candidateLists.push(root[k]);
  }

  // ✅ root 아래 한 단계 더 흔한 패턴도 탐색
  // (ex: root.Result.ResultList 형태)
  if (root?.Result && typeof root.Result === "object") {
    if (Array.isArray(root.Result)) candidateLists.push(root.Result);
    for (const k of keys) {
      if (Array.isArray(root.Result?.[k])) candidateLists.push(root.Result[k]);
    }
  }

  const list = candidateLists.find((l) => Array.isArray(l) && l.length > 0);
  if (!list) return [];

  const out: NormalizedTx[] = [];

  for (const r of list) {
    const tx_date = normalizeDateYmd(
      r.tx_date ?? r.TRN_DT ?? r.거래일자 ?? r.거래일
    );
    if (!tx_date) continue;

    const tx_time = normalizeTimeHms(
      r.tx_time ?? r.TRN_TM ?? r.거래시간 ?? null
    );

    const amountRaw = r.amount ?? r.TRN_AMT ?? r.거래금액;
    const amount = normalizeAmount(amountRaw);
    if (!amount) continue;

    const direction = normalizeDirection(
      r.direction ?? r.입출금구분 ?? amountRaw
    );

    out.push({
      event_id: eventId,
      scrape_account_id: scrapeAccountId,
      tx_date,
      tx_time,
      amount,
      direction,
      balance: r.balance ?? r.잔액 ?? null,
      memo: r.memo ?? r.적요 ?? null,
      counterparty: r.counterparty ?? r.상대방 ?? null,
      raw_json: r,
    });
  }

  return out;
}

/* ================= Main ================= */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as Partial<Body>;

    if (!body.eventId || !body.scrapeAccountId || !body.startDate || !body.endDate) {
      return json({ error: "Missing required fields" }, 400);
    }

    if (!isYmd(body.startDate) || !isYmd(body.endDate)) {
      return json({ error: "Invalid date format" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    /* 1️⃣ Normalize */
    const normalized = normalizeFromCooconOutput(
      body.eventId,
      body.scrapeAccountId,
      body.cooconOutput
    );

    /* 2️⃣ Upsert (중복 방어: unique index 필요) */
    let insertedTx = 0;

    if (normalized.length > 0) {
      // ✅ 가장 흔한 유니크키 조합 (필요 시 인덱스 정의에 맞춰 수정)
      const onConflict =
        "event_id,scrape_account_id,tx_date,tx_time,amount,direction";

      const { error, count } = await admin
        .from("event_scrape_transactions")
        .upsert(normalized, {
          onConflict,
          ignoreDuplicates: true,
          count: "exact",
        });

      if (error) {
        console.error("[UPSERT ERROR]", error);
        // 디버깅을 위해 onConflict를 같이 노출
        throw new Error(
          `transaction upsert failed (onConflict=${onConflict}): ${error.message}`
        );
      }

      insertedTx = count ?? normalized.length;
    }

    return json({
      ok: true,
      fetched: normalized.length,
      insertedTx,
      startDate: body.startDate,
      endDate: body.endDate,
    });
  } catch (e: any) {
    console.error("[ERROR]", e);
    return json({ error: "Unhandled", detail: String(e?.message ?? e) }, 500);
  }
});
