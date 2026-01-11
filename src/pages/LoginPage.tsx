// src/pages/LoginPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

// ✅ redirect 우선, 없으면 기존 next, 없으면 /app
function getSafePathParam(search: string, key: string) {
  const params = new URLSearchParams(search);
  const v = params.get(key);
  return v && v.startsWith("/") ? v : null;
}

function getAfterLoginPath(search: string) {
  const redirect = getSafePathParam(search, "redirect");
  if (redirect) return redirect;

  const next = getSafePathParam(search, "next");
  if (next) return next;

  return "/app";
}

const EMAIL_KEY = "dg_emails";
const MAX_SAVED_EMAILS = 6;

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

function loadSavedEmails(): string[] {
  try {
    const raw = localStorage.getItem(EMAIL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => typeof x === "string").map(normalizeEmail).filter(Boolean);
  } catch {
    return [];
  }
}

function saveEmailsToStorage(emails: string[]) {
  localStorage.setItem(EMAIL_KEY, JSON.stringify(emails));
}

function addEmailToSavedList(email: string) {
  const e = normalizeEmail(email);
  if (!e) return loadSavedEmails();

  const current = loadSavedEmails();
  const next = [e, ...current.filter((x) => x !== e)].slice(0, MAX_SAVED_EMAILS);
  saveEmailsToStorage(next);
  return next;
}

function removeEmailFromSavedList(email: string) {
  const e = normalizeEmail(email);
  const current = loadSavedEmails();
  const next = current.filter((x) => x !== e);
  saveEmailsToStorage(next);
  return next;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const afterLogin = useMemo(() => getAfterLoginPath(location.search), [location.search]);

  const [step, setStep] = useState<"email" | "otp">("email");

  // ✅ 저장 이메일 리스트
  const [savedEmails, setSavedEmails] = useState<string[]>(() => loadSavedEmails());

  // 입력값 초기값: 저장된 것 중 첫 번째(최근) 있으면 채워줌
  const [email, setEmail] = useState(() => loadSavedEmails()[0] ?? "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // 이미 로그인 세션이 있으면 바로 afterLogin으로 이동
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate(afterLogin, { replace: true });
    });
  }, [navigate, afterLogin]);

  useEffect(() => {
    if (step === "email") emailInputRef.current?.focus();
    if (step === "otp") otpInputRef.current?.focus();
  }, [step]);

  const selectSavedEmail = (e: string) => {
    setEmail(e);
    setStep("email");
    setOtp("");
    setTimeout(() => emailInputRef.current?.focus(), 0);
  };

  const deleteSavedEmail = (e: string) => {
    const nextList = removeEmailFromSavedList(e);
    setSavedEmails(nextList);

    if (normalizeEmail(email) === normalizeEmail(e)) {
      setEmail(nextList[0] ?? "");
    }

    toast({ title: "저장된 이메일을 삭제했습니다" });
  };

  const requestOtp = async () => {
    const trimmed = normalizeEmail(email);
    if (!trimmed.includes("@")) {
      toast({ title: "이메일을 확인해 주세요", description: "올바른 이메일 주소를 입력해 주세요." });
      return;
    }

    setLoading(true);
    try {
      // ✅ 이메일 링크(매직링크)로 돌아오더라도, redirect/next를 그대로 유지
      const redirectTo = `${window.location.origin}/login${location.search || ""}`;

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      // ✅ 성공 시 최근 이메일로 저장(리스트 맨 앞)
      const nextList = addEmailToSavedList(trimmed);
      setSavedEmails(nextList);

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
      const { data, error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedOtp,
        type: "email",
      });

      if (error) throw error;

      if (data.session) {
        toast({ title: "로그인 완료" });
        navigate(afterLogin, { replace: true });
        return;
      }

      toast({ title: "로그인 정보를 확인 중입니다", description: "새로고침 후 다시 시도해 주세요." });
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

  const useDifferentEmail = () => {
    setEmail("");
    setOtp("");
    setStep("email");
    setTimeout(() => emailInputRef.current?.focus(), 0);
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
              {savedEmails.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-muted-foreground mb-2">최근 로그인 이메일</div>
                  <div className="space-y-2">
                    {savedEmails.map((e) => (
                      <div
                        key={e}
                        className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => selectSavedEmail(e)}
                          className="text-sm font-medium text-foreground truncate text-left"
                          title={e}
                        >
                          {e}
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteSavedEmail(e)}
                          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 text-[12px] text-muted-foreground">
                    ※ 이메일을 선택해도 <b>OTP 인증은 매번</b> 다시 진행됩니다.
                  </div>
                </div>
              )}

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
                <button className="underline underline-offset-4" onClick={() => navigate("/", { replace: true })}>
                  처음으로 돌아가기
                </button>

                <button className="underline underline-offset-4" onClick={useDifferentEmail} disabled={loading}>
                  다른 이메일로 입력
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
