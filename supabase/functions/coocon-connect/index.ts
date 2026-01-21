import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

    const auth = req.headers.get("authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!jwt) return json({ ok: false, error: "Missing Bearer token" }, 401);

    // ✅ secrets 로 넣어야 하는 값
    const PROJECT_URL = Deno.env.get("PROJECT_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
    const COOCON_BASE_URL = Deno.env.get("COOCON_BASE_URL") || ""; // 없어도 됨(Stub)

    if (!PROJECT_URL) return json({ ok: false, error: "Missing PROJECT_URL secret" }, 500);
    if (!SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SERVICE_ROLE_KEY secret" }, 500);

    const admin = createClient(PROJECT_URL, SERVICE_ROLE_KEY);

    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user) return json({ ok: false, error: "Invalid token" }, 401);
    const userId = userRes.user.id;

    const body = await req.json().catch(() => null) as any;
    if (!body?.action) return json({ ok: false, error: "Missing action" }, 400);
    if (!body?.eventId || !body?.module) return json({ ok: false, error: "Missing eventId/module" }, 400);

    // 멤버 체크 (event_members에 user_id가 있어야 통과)
    const { data: member } = await admin
      .from("event_members")
      .select("id")
      .eq("event_id", body.eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!member) return json({ ok: false, error: "Not a member" }, 403);

    const isStub = !COOCON_BASE_URL;

    if (body.action === "start") {
      // ✅ event_scrape_accounts 컬럼에 맞춰 insert (현재 테이블 기준)
      const { error: insErr } = await admin.from("event_scrape_accounts").insert({
        event_id: body.eventId,
        owner_user_id: userId,
        provider: "coocon",
        bank_code: body.module,     // 지금은 module 값을 bank_code에 저장
        status: "pending",
        // bank_name/account_masked/last_scraped_at 등은 나중에 채움
      });

      if (insErr) {
        // 중복이면(이미 row 존재) insert가 실패할 수 있으니 메시지 반환
        return json({ ok: false, error: "DB insert failed", detail: insErr.message }, 500);
      }

      if (isStub) {
        return json({
          ok: true,
          stub: true,
          coocon: { Output: { Result: { req: { SignParam: "DUMMY_SIGN_PARAM_FOR_UI" } } } },
        });
      }

      return json({ ok: false, error: "COOCON_BASE_URL missing" }, 500);
    }

    if (body.action === "finish") {
      // ✅ 완료 처리: status만 업데이트
      const { error: updErr } = await admin
        .from("event_scrape_accounts")
        .update({ status: "connected_stub", verified_at: new Date().toISOString() })
        .eq("event_id", body.eventId)
        .eq("owner_user_id", userId)
        .eq("bank_code", body.module);

      if (updErr) return json({ ok: false, error: "DB update failed", detail: updErr.message }, 500);

      return json({ ok: true, stub: true, connected: true });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: "Unhandled", detail: String(e) }, 500);
  }
});
