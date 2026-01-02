import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

const LS_KEY = "last_login_email";
const PROD_ORIGIN = "https://digital-guestbook-app.vercel.app";

export default function LoginPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const next = useMemo(() => sp.get("next") || "/app", [sp]);

  const [email, setEmail] = useState(() => localStorage.getItem(LS_KEY) || "");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // ✅ 이미 로그인되어 있으면 next로 이동
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate(next, { replace: true });
    });
  }, [navigate, next]);

  const onChangeEmail = (value: string) => {
    setEmail(value);
    localStorage.setItem(LS_KEY, value);
  };

  const clearSavedEmail = () => {
    localStorage.removeItem(LS_KEY);
    setEmail("");
    setMessage("저장된 이메일 정보를 삭제했습니다.");
    toast({
      title: "저장된 이메일을 삭제했습니다.",
      description: "다음 로그인 시 이메일을 다시 입력해 주세요.",
    });
  };

  const sendLoginLink = async () => {
    if (sending) return;

    setMessage(null);
    const trimmed = email.trim();

    if (!trimmed) {
      setMessage("이메일 주소를 입력해 주세요.");
      toast({
        title: "이메일이 필요합니다.",
        description: "이메일 주소를 입력해 주세요.",
      });
      return;
    }

    setSending(true);
    try {
      const redirectTo = `${PROD_ORIGIN}/app`;

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;

      localStorage.setItem(LS_KEY, trimmed);

      const okMsg =
        "로그인 인증 메일을 발송했습니다. 메일함(스팸함 포함)을 확인하신 뒤, 안내된 버튼을 눌러 로그인해 주세요.";
      setMessage(okMsg);

      toast({
        title: "로그인 인증 메일을 발송했습니다.",
        description: "메일함(스팸함 포함)을 확인해 주세요.",
      });
    } catch (e: any) {
      const errMsg =
        e?.message || "인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.";
      setMessage(errMsg);

      toast({
        title: "메일 발송에 실패했습니다.",
        description: "잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-bold">신랑·신부 관리 로그인</h1>
          <p className="text-sm text-muted-foreground mt-1">
            예식 설정 및 리포트 확인을 위한 <b>관리 페이지</b> 접근 인증입니다.
          </p>
        </div>

        <label className="text-sm font-medium">이메일</label>
        <input
          className="mt-2 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => onChangeEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              sendLoginLink();
            }
          }}
          inputMode="email"
          autoComplete="email"
        />

        <button
          className="mt-4 w-full rounded-xl bg-black text-white py-2 font-medium disabled:opacity-50"
          onClick={sendLoginLink}
          disabled={sending}
        >
          {sending ? "발송 중..." : "이메일로 로그인 인증 받기"}
        </button>

        {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}

        <div className="mt-6 text-xs text-muted-foreground flex items-center justify-between">
          <Link to="/" className="underline">
            랜딩으로 돌아가기
          </Link>

          <button className="underline" onClick={clearSavedEmail}>
            저장 이메일 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
