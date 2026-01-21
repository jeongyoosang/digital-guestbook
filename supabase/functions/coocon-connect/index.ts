// supabase/functions/coocon-connect/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Body =
  | {
      action: "start";
      eventId: string;
      bankCode?: string | null; // optional
    }
  | {
      action: "finish";
      eventId: string;
      scrapeAccountId: string;
      bankCode: string; // required for finish
      accountMasked: string; // required for finish (마스킹 계좌번호)
      // mode: 'stub' | 'real' (나중에 엔진 붙이면 real로)
      mode?: "stub" | "real";
    };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    // 로그인 유저용 클라이언트 (RLS 적용)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = (await req.json()) as Partial<Body>;
    if (!body?.action) return json({ error: "Missing action" }, 400);

    // 공통: eventId 필수
    const eventId = (body as any).eventId;
    if (!eventId) return json({ error: "Missing eventId" }, 400);

    // ✅ 이 유저가 event 멤버인지 확인
    const { data: memberRow, error: memErr } = await userClient
      .from("event_members")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memErr) return json({ error: "Member check failed" }, 500);
    if (!memberRow) return json({ error: "Forbidden (not event member)" }, 403);

    // 서비스 롤 (RLS 무시) - insert/update는 admin으로(안전)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // =========================
    // action: start
    // =========================
    if (body.action === "start") {
      const bankCode = (body as any).bankCode ?? null;

      // row 생성
      const { data: created, error: insErr } = await admin
        .from("event_scrape_accounts")
        .insert({
          event_id: eventId,
          owner_user_id: userId,
          status: "started",
          bank_code: bankCode,
        })
        .select("id, status")
        .maybeSingle();

      if (insErr || !created) {
        return json({ error: "Create scrape account failed", detail: insErr?.message }, 500);
      }

      return json({
        ok: true,
        scrapeAccountId: created.id,
        status: created.status,
      });
    }

    // =========================
    // action: finish
    // =========================
    if (body.action === "finish") {
      const b = body as any;
      const scrapeAccountId = b.scrapeAccountId as string | undefined;
      const bankCode = b.bankCode as string | undefined;
      const accountMasked = b.accountMasked as string | undefined;
      const mode = (b.mode as "stub" | "real" | undefined) ?? "stub";

      if (!scrapeAccountId || !bankCode || !accountMasked) {
        return json(
          { error: "Missing required fields (scrapeAccountId, bankCode, accountMasked)" },
          400
        );
      }

      // ✅ 이 scrapeAccount가 "내 것"인지 확인 (서버에서도 확실히)
      const { data: myAccount, error: accErr } = await userClient
        .from("event_scrape_accounts")
        .select("id, event_id, owner_user_id")
        .eq("id", scrapeAccountId)
        .maybeSingle();

      if (accErr) return json({ error: "Account read failed" }, 500);
      if (!myAccount) return json({ error: "Forbidden (not your scrape account)" }, 403);
      if (myAccount.event_id !== eventId) return json({ error: "Mismatch eventId" }, 400);

      const nextStatus = mode === "real" ? "connected" : "connected_stub";

      const { data: updated, error: updErr } = await admin
        .from("event_scrape_accounts")
        .update({
          status: nextStatus,
          bank_code: bankCode,
          account_masked: accountMasked,
        })
        .eq("id", scrapeAccountId)
        .select("id, status, bank_code, account_masked")
        .maybeSingle();

      if (updErr || !updated) {
        return json({ error: "Finish update failed", detail: updErr?.message }, 500);
      }

      return json({
        ok: true,
        connected: true,
        mode,
        scrapeAccount: updated,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: "Unhandled", detail: String((e as any)?.message ?? e) }, 500);
  }
});
