// src/pages/admin/AdminLoginPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const ADMIN_EMAIL = "goraeuniverse@gmail.com";

// ✅ redirect 우선, 없으면 /admin
function getSafePathParam(search: string, key: string) {
  const params = new URLSearchParams(search);
  const v = params.get(key);
  return v && v.startsWith("/") ? v : null;
}
function getAfterLoginPath(search: string) {
  return getSafePathParam(search, "redirect") || "/admin";
}

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const afterLogin = useMemo(() => getAfterLoginPath(location.search), [location.search]);

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  // ✅ 이미 세션이 있으면 운영자 여부 확인 후 이동
  useEffect(() => {
    const boot = async () => {
      try {
        const { data } = await supabaseAdmin.auth.getUser();
        const currentEmail = data.user?.email?.toLowerCase() ?? null;

        if (!currentEmail) return;

        if (currentEmail === ADMIN_EMAIL.toLowerCase()) {
          navigate(afterLogin, { replace: true });
          return;
        }

        // 운영자가 아닌 계정이 admin client에 물려있으면 즉시 로그아웃
        await supabaseAdmin.auth.signOut();
        toast({
          title: "운영자 계정이 아닙니다",
          description: "운영자 이메일로 다시 로그인해 주세요.",
        });
      } catch {
        // ignore
      }
    };
    void boot();
  }, [navigate, afterLogin, toast]);

  useEffect(() => {
    if (step === "email") emailInputRef.current?.focus();
    if (step === "otp") otpInputRef.current?.focus();
  }, [step]);

  const requestOtp = async () => {
    const trimmed = normalizeEmail(email);

    if (!trimmed.includes("@")) {
      toast({ title: "이메일을 확인해 주세요", description: "올바른 이메일 주소를 입력해 주세요." });
      return;
    }

    // ✅ 운영자 이메일만 OTP 요청 허용 (운영상 실수 방지)
    if (trimmed !== ADMIN_EMAIL.toLowerCase()) {
      toast({
        title: "운영자 이메일만 가능합니다",
        description: `운영자 계정(${ADMIN_EMAIL})으로 로그인해 주세요.`,
      });
      return;
    }

    setLoading(true);
    try {
      // ✅ 이메일 링크로 돌아오더라도 redirect 유지
      const redirectTo = `${window.location.origin}/admin/login${location.search || ""}`;

      const { error } = await supabaseAdmin.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setStep("otp");
      setOtp("");

      toast({
        title: "인증 코드를 이메일로 보냈습니다",
        description: "메일에 있는 코드를 복사해 입력해 주세요.",
      });
    } catch (e: any) {
      toast({ title: "인증 메일 발송 실패", description: e?.message ?? "잠시 후 다시 시도해 주세요." });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const trimmedEmail = normalizeEmail(email);
    const trimmedOtp = otp.trim();

    if (!trimmedOtp) {
      toast({ title: "인증 코드를 입력해 주세요" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabaseAdmin.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedOtp,
        type: "email",
      });

      if (error) throw error;

      const loggedInEmail = data.user?.email?.toLowerCase() ?? null;

      if (!loggedInEmail) {
        toast({ title: "로그인 정보를 확인 중입니다", description: "새로고침 후 다시 시도해 주세요." });
        return;
      }

      // ✅ 운영자 이메일 체크
      if (loggedInEmail !== ADMIN_EMAIL.toLowerCase()) {
        await supabaseAdmin.auth.signOut();
        toast({
          title: "운영자 계정이 아닙니다",
          description: "운영자 이메일로 다시 로그인해 주세요.",
        });
        setStep("email");
        setOtp("");
        return;
      }

      toast({ title: "운영자 로그인 완료" });
      navigate(afterLogin, { replace: true });
    } catch {
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
    setTimeout(() => emailInputRef.current?.focus(), 0);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <div className="text-xl font-bold">운영자 로그인</div>
            <div className="text-sm text-muted-foreground mt-2">
              운영자 전용 콘솔 접근을 위한 로그인입니다.
            </div>
          </div>

          {step === "email" && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">운영자 이메일</label>
                <input
                  ref={emailInputRef}
                  className="w-full h-11 rounded-md border px-3"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={ADMIN_EMAIL}
                  autoComplete="email"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") requestOtp();
                  }}
                  disabled={loading}
                />
                <div className="text-[12px] text-muted-foreground">
                  운영자 계정: <span className="font-mono">{ADMIN_EMAIL}</span>
                </div>
              </div>

              <Button className="w-full mt-4" onClick={requestOtp} disabled={loading}>
                {loading ? "보내는 중…" : "운영자 이메일로 인증 받기"}
              </Button>

              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <button className="underline underline-offset-4" onClick={() => navigate("/", { replace: true })}>
                  랜딩으로
                </button>

                <button className="underline underline-offset-4" onClick={() => navigate("/admin", { replace: true })}>
                  /admin으로
                </button>
              </div>
            </>
          )}

          {step === "otp" && (
            <>
              <div className="mb-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{normalizeEmail(email)}</span> 로 인증 코드를 보냈습니다.
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
                <button className="underline underline-offset-4" onClick={resetEmail} disabled={loading}>
                  이메일 다시 입력
                </button>
                <button className="underline underline-offset-4" onClick={requestOtp} disabled={loading}>
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
