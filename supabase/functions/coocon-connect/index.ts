// supabase/functions/coocon-connect/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Body =
  | {
      action: "start";
      eventId: string;
      bankCode?: string | null;
    }
  | {
      action: "finish";
      eventId: string;
      scrapeAccountId: string;
      bankCode: string;
      accountMasked: string;
      bankName?: string | null;
      mode?: "stub" | "real";
    };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  const body = (await req.json()) as Partial<Body>;
  if (!body.action || !("eventId" in body)) {
    return json({ error: "Invalid body" }, 400);
  }

  const eventId = body.eventId;

  // event member check
  const { data: member } = await userClient
    .from("event_members")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) return json({ error: "Forbidden" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  /* ---------------- start ---------------- */
  if (body.action === "start") {
    const { data, error } = await admin
      .from("event_scrape_accounts")
      .insert({
        event_id: eventId,
        owner_user_id: userId,
        provider: "coocon",
        bank_code: body.bankCode ?? null,
        status: "started",
      })
      .select("id, status")
      .maybeSingle();

    if (error || !data) {
      return json({ error: "start failed", detail: error?.message }, 500);
    }

    return json({
      ok: true,
      scrapeAccountId: data.id,
      status: data.status,
    });
  }

  /* ---------------- finish ---------------- */
  if (body.action === "finish") {
    const {
      scrapeAccountId,
      bankCode,
      accountMasked,
      bankName,
      mode = "stub",
    } = body as any;

    if (!scrapeAccountId || !bankCode || !accountMasked) {
      return json({ error: "Missing fields" }, 400);
    }

    const { data: account } = await userClient
      .from("event_scrape_accounts")
      .select("id, event_id, owner_user_id")
      .eq("id", scrapeAccountId)
      .maybeSingle();

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
      .select("id, status, bank_code, bank_name, account_masked")
      .maybeSingle();

    if (error || !data) {
      return json({ error: "finish failed", detail: error?.message }, 500);
    }

    return json({
      ok: true,
      connected: true,
      scrapeAccount: data,
    });
  }

  return json({ error: "Unknown action" }, 400);
});
