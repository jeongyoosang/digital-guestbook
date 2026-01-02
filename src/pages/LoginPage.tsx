import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

function getNextParam(search: string) {
  const params = new URLSearchParams(search);
  const next = params.get("next");
  // 기본은 /app
  return next && next.startsWith("/") ? next : "/app";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const next = useMemo(() => getNextParam(location.search), [location.search]);

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState(() => localStorage.getItem("dg_email") ?? "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // 이미 로그인 세션이 있으면 바로 next로 이동
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate(next, { replace: true });
    });
  }, [navigate, next]);

  useEffect(() => {
    if (step === "email") emailInputRef.current?.focus();
    if (step === "otp") otpInputRef.current?.focus();
  }, [step]);

  const requestOtp = async () => {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      toast({ title: "이메일을 확인해 주세요", description: "올바른 이메일 주소를 입력해 주세요." });
      return;
    }

    setLoading(true);
    try {
      // ✅ OTP 발송 (메일에 코드가 가도록 템플릿에서 {{ .Token }} 사용)
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          // redirectTo는 링크 로그인(새창)용이라 OTP UX에서는 사실상 중요도가 낮음
          // 그래도 혹시를 대비해 우리 도메인으로 둠
          emailRedirectTo: `${window.location.origin}/app`,
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      localStorage.setItem("dg_email", trimmed);
      setStep("otp");
      setOtp("");

      toast({
        title: "인증 코드를 이메일로 보냈습니다",
        description: "메일에 있는 6자리(또는 표시된) 코드를 복사해 입력해 주세요.",
      });
    } catch (e: any) {
      toast({ title: "인증 메일 발송 실패", description: e?.message ?? "잠시 후 다시 시도해 주세요." });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const trimmedEmail = email.trim();
    const trimmedOtp = otp.trim();

    if (!trimmedOtp) {
      toast({ title: "인증 코드를 입력해 주세요" });
      return;
    }

    setLoading(true);
    try {
      // ✅ 이메일 OTP 검증 (type: 'email')
      const { data, error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedOtp,
        type: "email",
      });

      if (error) throw error;

      // 세션이 생기면 next로 이동
      if (data.session) {
        toast({ title: "로그인 완료" });
        navigate(next, { replace: true });
        return;
      }

      // 이론상 거의 안 옴(세션이 없을 때)
      toast({ title: "로그인 정보를 확인 중입니다", description: "새로고침 후 다시 시도해 주세요." });
    } catch (e: any) {
      toast({
        title: "인증 실패",
        description: "코드가 만료되었거나 올바르지 않습니다. 최신 메일의 코드를 확인해 주세요.",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetEmail = () => {
    setStep("email");
    setOtp("");
    emailInputRef.current?.focus();
  };

  const clearSavedEmail = () => {
    localStorage.removeItem("dg_email");
    setEmail("");
    toast({ title: "저장된 이메일을 삭제했습니다" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <div className="text-xl font-bold">신랑·신부 관리 로그인</div>
            <div className="text-sm text-muted-foreground mt-2">
              예식 설정 및 리포트 확인을 위한 관리 페이지 접근 인증입니다.
            </div>
          </div>

          {step === "email" && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">이메일</label>
                <input
                  ref={emailInputRef}
                  className="w-full h-11 rounded-md border px-3"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  autoComplete="email"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") requestOtp();
                  }}
                  disabled={loading}
                />
              </div>

              <Button className="w-full mt-4" onClick={requestOtp} disabled={loading}>
                {loading ? "보내는 중…" : "이메일로 로그인 인증 받기"}
              </Button>

              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <button className="underline" onClick={() => navigate("/", { replace: true })}>
                  랜딩으로 돌아가기
                </button>
                <button className="underline" onClick={clearSavedEmail}>
                  저장 이메일 삭제
                </button>
              </div>
            </>
          )}

          {step === "otp" && (
            <>
              <div className="mb-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{email.trim()}</span> 로 인증 코드를 보냈습니다.
                <br />
                메일에 있는 코드를 복사해 아래에 입력해 주세요.
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">인증 코드(OTP)</label>
                <input
                  ref={otpInputRef}
                  className="w-full h-11 rounded-md border px-3 tracking-widest"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="예: 123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") verifyOtp();
                  }}
                  disabled={loading}
                />
              </div>

              <Button className="w-full mt-4" onClick={verifyOtp} disabled={loading}>
                {loading ? "확인 중…" : "코드로 로그인"}
              </Button>

              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <button className="underline" onClick={resetEmail} disabled={loading}>
                  이메일 다시 입력
                </button>
                <button className="underline" onClick={requestOtp} disabled={loading}>
                  코드 다시 받기
                </button>
              </div>

              <div className="mt-3 text-[12px] text-muted-foreground">
                ※ 인증 메일을 여러 번 받으신 경우, <b>가장 최근 메일</b>의 코드를 입력해 주세요.
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
