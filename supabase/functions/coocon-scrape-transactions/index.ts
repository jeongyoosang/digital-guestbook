import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Direction = "IN" | "OUT";

type Body = {
  eventId: string;
  scrapeAccountId: string;
  startDate: string;
  endDate: string;
  cooconOutput?: unknown;
};

type NormalizedTx = {
  tx_date: string;
  tx_time?: string | null;
  amount: number;
  direction: Direction;
  balance?: number | null;
  memo?: string | null;
  counterparty?: string | null;
  counterparty_account?: string | null;
  raw_json?: unknown | null;
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

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
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
  return sha256Hex(
    [
      input.scrape_account_id,
      input.tx_date,
      input.tx_time ?? "",
      input.direction,
      input.amount,
      input.balance ?? "",
      input.memo ?? "",
      input.counterparty ?? "",
      input.counterparty_account ?? "",
    ].join("|")
  );
}

function toUtcIsoFromKst(tx_date: string, tx_time?: string | null) {
  const t = tx_time && /^\d{2}:\d{2}:\d{2}$/.test(tx_time) ? tx_time : "00:00:00";
  return new Date(`${tx_date}T${t}+09:00`).toISOString();
}

/* ================= Normalize Coocon ================= */

function normalizeFromCooconOutput(cooconOutput: any): NormalizedTx[] {
  if (!cooconOutput) return [];

  const root =
    cooconOutput?.Output?.Result ??
    cooconOutput?.Output ??
    cooconOutput?.Result ??
    cooconOutput;

  const lists: any[] = [];
  const keys = ["List", "TX_LIST", "txList", "Data", "rows", "items"];

  if (Array.isArray(root)) lists.push(root);

  for (const k of keys) {
    if (Array.isArray(root?.[k])) lists.push(root[k]);
  }

  const list = lists.find((l) => Array.isArray(l) && l.length > 0);
  if (!list) return [];

  const out: NormalizedTx[] = [];

  for (const r of list) {
    const tx_date = normalizeDateYmd(
      r.tx_date ?? r.TRN_DT ?? r.거래일자 ?? r.거래일
    );
    if (!tx_date) continue;

    const tx_time = normalizeTimeHms(r.tx_time ?? r.TRN_TM ?? r.거래시간);
    const amountRaw = r.amount ?? r.TRN_AMT ?? r.거래금액;
    const amount = Math.abs(Number(String(amountRaw).replace(/[^\d.-]/g, "")));
    if (!amount) continue;

    let direction: Direction = "IN";
    const dir = String(r.direction ?? r.입출금구분 ?? "").toUpperCase();
    if (dir.includes("출금") || dir.includes("OUT")) direction = "OUT";

    out.push({
      tx_date,
      tx_time,
      amount,
      direction,
      memo: r.memo ?? r.적요 ?? null,
      counterparty: r.counterparty ?? r.상대방 ?? null,
      balance: r.balance ?? r.잔액 ?? null,
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

    console.log("[DEBUG] body.start/end", body.startDate, body.endDate);

    /* 🔥 TEST RANGE OVERRIDE (EDGE ONLY) */
    const USE_TEST_RANGE = true;
    const TEST_START = "2026-01-28";
    const TEST_END = "2026-01-30";

    if (USE_TEST_RANGE) {
      body.startDate = TEST_START;
      body.endDate = TEST_END;
      console.log("[TEST OVERRIDE]", TEST_START, TEST_END);
    }

    if (!body.eventId || !body.scrapeAccountId || !body.startDate || !body.endDate) {
      return json({ error: "Missing required fields" }, 400);
    }

    if (!isYmd(body.startDate) || !isYmd(body.endDate)) {
      return json({ error: "Invalid date format" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });

    const { data: user } = await userClient.auth.getUser();
    if (!user?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const fetched = normalizeFromCooconOutput(body.cooconOutput);
    console.log("[FETCHED COUNT]", fetched.length);

    return json({
      ok: true,
      fetched: fetched.length,
      startDate: body.startDate,
      endDate: body.endDate,
    });
  } catch (e: any) {
    console.error("[ERROR]", e);
    return json({ error: "Unhandled", detail: String(e?.message ?? e) }, 500);
  }
});
