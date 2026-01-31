// supabase/functions/coocon-connect/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

/* ================= Types ================= */

type StartBody = {
  action: "start";
  eventId: string;
  bankCode?: string | null;
};

type FinishBody = {
  action: "finish";
  eventId: string;
  scrapeAccountId: string;
  bankCode: string;
  accountMasked: string;
  bankName?: string | null;
  mode?: "stub" | "real";
};

type Body = StartBody | FinishBody;

/* ================= Main ================= */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  // user client (RLS)
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  const body = (await req.json()) as Partial<Body>;
  if (!body?.action || !("eventId" in body) || !body.eventId) {
    return json({ error: "Invalid body" }, 400);
  }
  const eventId = body.eventId;

  // event member check (초대/오너만 가능)
  const { data: member, error: memberErr } = await userClient
    .from("event_members")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberErr) return json({ error: "member check failed", detail: memberErr.message }, 500);
  if (!member) return json({ error: "Forbidden" }, 403);

  // admin client (service role)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  /* ---------------- start ---------------- */
  if (body.action === "start") {
    const bankCode = (body as StartBody).bankCode ?? null;

    // ✅ 중복 row 계속 생기는 것 방지: 기존 최신 row 있으면 재사용
    // (bank_code까지 동일하면 그걸 쓰고, bank_code가 없으면 event/owner/provider 기준 최신)
    let existingId: string | null = null;

    if (bankCode) {
      const { data: ex } = await admin
        .from("event_scrape_accounts")
        .select("id")
        .eq("event_id", eventId)
        .eq("owner_user_id", userId)
        .eq("provider", "coocon")
        .eq("bank_code", bankCode)
        .order("verified_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      existingId = ex?.id ?? null;
    } else {
      const { data: ex } = await admin
        .from("event_scrape_accounts")
        .select("id")
        .eq("event_id", eventId)
        .eq("owner_user_id", userId)
        .eq("provider", "coocon")
        .order("verified_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      existingId = ex?.id ?? null;
    }

    if (existingId) {
      // status만 started로 갱신 (연결된 계정도 “재연결 시작” 가능하게)
      const { data: upd, error: updErr } = await admin
        .from("event_scrape_accounts")
        .update({ status: "started", bank_code: bankCode })
        .eq("id", existingId)
        .select("id, status, bank_code")
        .maybeSingle();

      if (updErr || !upd) return json({ error: "start reuse failed", detail: updErr?.message }, 500);

      return json({
        ok: true,
        reused: true,
        scrapeAccountId: upd.id,
        status: upd.status,
        bankCode: upd.bank_code,
      });
    }

    // 새로 생성
    const { data, error } = await admin
      .from("event_scrape_accounts")
      .insert({
        event_id: eventId,
        owner_user_id: userId,
        provider: "coocon",
        bank_code: bankCode,
        status: "started",
      })
      .select("id, status, bank_code")
      .maybeSingle();

    if (error || !data) return json({ error: "start failed", detail: error?.message }, 500);

    return json({
      ok: true,
      reused: false,
      scrapeAccountId: data.id,
      status: data.status,
      bankCode: data.bank_code,
    });
  }

  /* ---------------- finish ---------------- */
  if (body.action === "finish") {
    const { scrapeAccountId, bankCode, accountMasked, bankName, mode = "stub" } =
      body as FinishBody;

    if (!scrapeAccountId || !bankCode || !accountMasked) {
      return json({ error: "Missing fields" }, 400);
    }

    // 소유권/이벤트 일치 확인 (userClient로 확인)
    const { data: account, error: accountErr } = await userClient
      .from("event_scrape_accounts")
      .select("id, event_id, owner_user_id")
      .eq("id", scrapeAccountId)
      .maybeSingle();

    if (accountErr) return json({ error: "account read failed", detail: accountErr.message }, 500);
    if (!account || account.owner_user_id !== userId || account.event_id !== eventId) {
      return json({ error: "Forbidden" }, 403);
    }

    const nextStatus = mode === "real" ? "connected" : "connected_stub";

    const { data, error } = await admin
      .from("event_scrape_accounts")
      .update({
        status: nextStatus,
        bank_code: bankCode,
        bank_name: bankName ?? null,
        account_masked: accountMasked,
        verified_at: new Date().toISOString(),
      })
      .eq("id", scrapeAccountId)
      .select("id, status, bank_code, bank_name, account_masked, verified_at")
      .maybeSingle();

    if (error || !data) return json({ error: "finish failed", detail: error?.message }, 500);

    return json({
      ok: true,
      connected: true,
      scrapeAccount: data,
    });
  }

  return json({ error: "Unknown action" }, 400);
});
