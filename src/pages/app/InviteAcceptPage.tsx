// src/pages/app/InviteAcceptPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const toKoreanInviteError = (err: any) => {
  const m = String(err?.message || "");

  if (m.includes("not authenticated")) return "로그인이 필요합니다. 로그인 후 다시 시도해주세요.";
  if (m.includes("invalid invite")) return "초대 링크가 유효하지 않습니다. 다시 확인해주세요.";
  if (m.includes("invite expired")) return "초대장이 만료되었습니다. 새로운 초대 링크를 받아주세요.";
  if (m.includes("invite already used up"))
    return "이미 사용된 초대장입니다. 이미 참여했다면 ‘내 이벤트’에서 확인해주세요.";
  if (m.includes("provide exactly one")) return "초대 링크로 참여할 수 없습니다. 다시 시도해주세요.";
  if (m.includes("no permission")) return "초대 권한이 없습니다.";
  if (m.includes("ambiguous"))
    return "서버 응답 처리 중 오류가 발생했습니다. 새로고침 후 다시 시도해주세요.";

  return "초대 참여에 실패했습니다. 잠시 후 다시 시도해주세요.";
};

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const normalizedToken = useMemo(() => (token || "").trim(), [token]);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>("");

  const gotoLogin = () => {
    const next = encodeURIComponent(location.pathname + location.search);
    navigate(`/login?next=${next}`);
  };

  const accept = async () => {
    setLoading(true);
    setMsg("");

    try {
      if (!normalizedToken) {
        setMsg("초대 링크가 유효하지 않습니다.");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        gotoLogin();
        return;
      }

      const { data, error } = await supabase.rpc("redeem_event_invite", {
        p_token: normalizedToken,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;

      // ✅ 함수 RETURNS TABLE(event_id uuid, role text) 기준
      // (예전 out_event_id 등 혼용 방지)
      const eventId = row?.event_id;

      if (!eventId) throw new Error("이벤트 정보를 찾을 수 없습니다.");

    navigate(`/app`, { replace: true });
    } catch (e: any) {
      console.error(e);
      setMsg(toKoreanInviteError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedToken]);

  return (
    <section className="min-h-screen bg-ivory px-4 py-10">
      <div className="mx-auto max-w-md">
        <Card className="bg-white/90 border border-leafLight/60">
          <CardContent className="p-6 space-y-4">
            <div>
              <div className="text-lg font-semibold text-ink/90">초대 참여</div>
              <div className="mt-1 text-sm text-ink/60">링크로 자동 참여를 진행합니다.</div>
            </div>

            {loading ? (
              <div className="text-sm text-ink/70">처리 중...</div>
            ) : msg ? (
              <div className="text-sm text-red-600">{msg}</div>
            ) : (
              <div className="text-sm text-ink/70">완료</div>
            )}

            <div className="flex gap-2">
              <Button onClick={accept} disabled={loading} className="w-full">
                {loading ? "처리 중..." : "다시 시도"}
              </Button>
              <Link to="/join" className="w-full">
                <Button variant="outline" className="w-full">
                  코드로 참여
                </Button>
              </Link>
            </div>

            <Link to="/" className="block">
              <Button variant="ghost" className="w-full">
                랜딩으로
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
