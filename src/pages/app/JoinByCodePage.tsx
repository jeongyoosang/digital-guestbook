// src/pages/app/JoinByCodePage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function JoinByCodePage() {
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const join = async () => {
    setMsg(null);
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate(`/login?next=${encodeURIComponent("/join")}`);
        return;
      }

      const cleaned = code.trim();
      if (cleaned.length < 4) {
        setMsg("초대 코드를 입력해주세요.");
        return;
      }

      const { data, error } = await supabase.rpc("redeem_event_invite", {
        p_code: cleaned,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      const eventId = row?.event_id;

      if (!eventId) throw new Error("이벤트를 찾을 수 없습니다.");

      navigate(`/app/event/${eventId}/report`);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "참여에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-screen bg-ivory px-4 py-10">
      <div className="container mx-auto max-w-xl">
        <Card className="bg-white/90 border-leafLight/60">
          <CardContent className="p-6 space-y-4">
            <div className="text-lg font-semibold text-ink/90">초대 코드로 참여</div>
            <div className="text-sm text-ink/60">6자리 코드를 입력하세요.</div>

            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="예: 483921"
              className="w-full h-11 rounded-xl border border-leafLight/60 bg-white px-3 text-sm"
              inputMode="numeric"
            />

            {msg && <div className="text-sm text-red-600">{msg}</div>}

            <Button onClick={join} disabled={loading} className="w-full">
              {loading ? "처리 중…" : "참여하기"}
            </Button>

            <Button variant="outline" onClick={() => navigate("/app")} className="w-full">
              내 이벤트로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
