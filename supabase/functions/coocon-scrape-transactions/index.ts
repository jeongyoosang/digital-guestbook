// supabase/functions/coocon-scrape-transactions/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isasDecrypt } from "./seed-cbc.ts";

/* ================= Types ================= */

type Direction = "IN" | "OUT";

type Body = {
  eventId: string;
  scrapeAccountId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  cooconOutput?: unknown;
  decryptParams?: {
    uid?: string;
    action?: string;
  };
  accountNumber?: string;
  accountMasked?: string;
  bankCode?: string;
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

  tx_hash: string; // ✅ Added field for unique constraints
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

// ✅ Deterministic Hash Generation for Deduplication
async function generateTxHash(
  date: string,
  time: string | null,
  amount: number,
  balance: number | null,
  memo: string | null
): Promise<string> {
  // Combine fields into a unique string key
  // e.g. "2024-01-01|12:00:00|10000|50000|WeddingGift"
  const raw = [
    date,
    time ?? "00:00:00",
    amount,
    balance ?? "0",
    (memo ?? "").trim(),
  ].join("|");

  const msgUint8 = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

/* ================= Normalize Coocon ================= */

async function normalizeFromCooconOutput(
  eventId: string,
  scrapeAccountId: string,
  cooconOutput: any,
  decryptParams?: { uid?: string; action?: string },
  log: (msg: string, data?: any) => void = console.log
): Promise<NormalizedTx[]> {
  if (!cooconOutput) return [];

  log("[normalizeFromCooconOutput] Starting normalization...");
  log("[normalizeFromCooconOutput] cooconOutput type:", typeof cooconOutput);

  // Handle encrypted Result (when Result is a string, it needs decryption)
  let processedOutput = cooconOutput;

  // Check if we have encrypted data that needs decryption
  if (cooconOutput?.Output?.Result && typeof cooconOutput.Output.Result === "string") {
    log("[normalizeFromCooconOutput] Found encrypted Result string, attempting decryption...");

    if (decryptParams?.uid && decryptParams?.action) {
      try {
        const decryptedStr = isasDecrypt(
          cooconOutput.Output.Result,
          decryptParams.uid,
          decryptParams.action
        );
        log("[normalizeFromCooconOutput] Decryption successful, parsing JSON...");
        log("[normalizeFromCooconOutput] Decrypted (first 500 chars):", decryptedStr.substring(0, 500));

        const decryptedResult = JSON.parse(decryptedStr);
        processedOutput = {
          ...cooconOutput,
          Output: {
            ...cooconOutput.Output,
            Result: decryptedResult,
          },
        };
      } catch (e: any) {
        log("[normalizeFromCooconOutput] Decryption failed:", e.message || String(e));
        // Continue with original output in case decryption fails
      }
    } else {
      log("[normalizeFromCooconOutput] Encrypted data found but no decryptParams provided");
    }
  }

  const root =
    processedOutput?.Result ??
    processedOutput?.Output?.Result ??
    processedOutput?.Output ??
    processedOutput;

  log("[normalizeFromCooconOutput] root type:", typeof root);
  log("[normalizeFromCooconOutput] root keys:", typeof root === "object" ? Object.keys(root || {}).join(", ") : "N/A");

  const candidateLists: any[][] = [];
  // 수시거래내역조회, 거래내역조회 키도 추가
  const keys = ["ResultList", "List", "TX_LIST", "txList", "Data", "rows", "items", "수시거래내역조회", "거래내역조회"];

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

  log("[normalizeFromCooconOutput] candidateLists count:", candidateLists.length);
  const list = candidateLists.find((l) => Array.isArray(l) && l.length > 0);
  log("[normalizeFromCooconOutput] selected list length:", list?.length ?? 0);
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

    const balance = r.balance ?? r.잔액 ?? null;
    const memo = r.memo ?? r.적요 ?? null;

    // ✅ Generate Hash
    const tx_hash = await generateTxHash(
      tx_date,
      tx_time,
      amount,
      balance,
      memo
    );

    out.push({
      event_id: eventId,
      scrape_account_id: scrapeAccountId,
      tx_date,
      tx_time,
      amount,
      direction,
      balance,
      memo,
      counterparty: r.counterparty ?? r.상대방 ?? null,
      tx_hash,
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

    /* ================= Logging setup ================= */
    const debugLogs: string[] = [];
    const log = (msg: string, data?: any) => {
      const line = data ? `${msg} ${JSON.stringify(data)}` : msg;
      console.log(line);
      debugLogs.push(line);
    };

    log("[coocon-scrape-transactions] Processing request:", {
      eventId: body.eventId,
      scrapeAccountId: body.scrapeAccountId,
      hasDecryptParams: !!(body.decryptParams?.uid && body.decryptParams?.action),
      hasCooconOutput: !!body.cooconOutput,
    });

    const normalized = await normalizeFromCooconOutput(
      body.eventId,
      body.scrapeAccountId,
      body.cooconOutput,
      body.decryptParams,
      log // Pass logger
    );

    /* 2️⃣ Upsert (중복 방어: unique index (scrape_account_id, tx_hash)) */
    let insertedTx = 0;

    if (normalized.length > 0) {
      const onConflict = "scrape_account_id, tx_hash";
      const { error, count } = await admin
        .from("event_scrape_transactions")
        .upsert(normalized, {
          onConflict,
          ignoreDuplicates: true,
          count: "exact",
        });

      if (error) {
        log("[UPSERT ERROR]", error);
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
      debugLogs, // Return logs
    });
  } catch (e: any) {
    console.error("[ERROR]", e);
    return json({ error: "Unhandled", detail: String(e?.message ?? e) }, 500);
  }
});
