// src/pages/app/InviteAcceptPage.tsx
import { useEffect } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const run = async () => {
      // 1️⃣ 토큰 유효성만 체크 (소모 ❌)
      if (!token) {
        navigate("/join", { replace: true });
        return;
      }

      // (선택) 토큰 존재 여부만 확인하고 싶으면 조회만
      const { error } = await supabase
        .from("event_invites")
        .select("id")
        .eq("token", token)
        .maybeSingle();

      if (error) {
        navigate("/join", { replace: true });
        return;
      }

      // 2️⃣ 로그인 안 되어 있으면 로그인 → join
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const next = encodeURIComponent(location.pathname + location.search);
        navigate(`/login?next=${next}`);
        return;
      }

      // 3️⃣ 항상 코드 입력 단계로 이동 (확정은 join에서)
      navigate("/join", { replace: true });
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <section className="min-h-screen bg-ivory px-4 py-10">
      <div className="mx-auto max-w-md">
        <Card className="bg-white/90 border border-leafLight/60">
          <CardContent className="p-6 space-y-4">
            <div className="text-lg font-semibold text-ink/90">초대 참여</div>
            <div className="text-sm text-ink/60">
              링크를 확인했습니다. 코드 입력 단계로 이동합니다.
            </div>

            <Link to="/join">
              <Button className="w-full">코드로 참여</Button>
            </Link>

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
