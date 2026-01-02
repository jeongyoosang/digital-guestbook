// src/pages/LoginPage.tsx
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const next = useMemo(() => sp.get("next") || "/app", [sp]);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sendMagicLink = async () => {
    setMsg(null);
    if (!email.trim()) {
      setMsg("이메일을 입력해줘.");
      return;
    }
    setSending(true);
    try {
      // 로컬/배포 도메인 모두 대응하려면 redirectTo를 명시하는 게 안전함
      const redirectTo = `${window.location.origin}/app`;

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;
      setMsg("로그인 링크를 이메일로 보냈어. 메일함(스팸함 포함) 확인해줘.");
    } catch (e: any) {
      setMsg(e?.message || "로그인 링크 발송 실패");
    } finally {
      setSending(false);
    }
  };

  // 로그인 완료 후 리다이렉트: /app 들어가면 AuthGuard가 세션 체크해서 통과시킴
  const goAfterLogin = () => navigate(next, { replace: true });

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-bold">로그인</h1>
          <p className="text-sm text-muted-foreground mt-1">
            신랑·신부 전용 관리 화면(/app) 접근을 위해 로그인해.
          </p>
        </div>

        <label className="text-sm font-medium">이메일</label>
        <input
          className="mt-2 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          className="mt-4 w-full rounded-xl bg-black text-white py-2 font-medium disabled:opacity-50"
          onClick={sendMagicLink}
          disabled={sending}
        >
          {sending ? "보내는 중..." : "이메일로 로그인 링크 받기"}
        </button>

        <button
          className="mt-3 w-full rounded-xl border py-2 text-sm"
          onClick={goAfterLogin}
        >
          이미 로그인 되어있으면 /app로 이동
        </button>

        {msg && <p className="mt-4 text-sm text-muted-foreground">{msg}</p>}

        <div className="mt-6 text-xs text-muted-foreground">
          <Link to="/" className="underline">
            랜딩으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
