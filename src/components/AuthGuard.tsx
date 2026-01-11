// src/components/AuthGuard.tsx
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type Props = {
  children: React.ReactNode;
};

export default function AuthGuard({ children }: Props) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    // 1️⃣ 최초 세션 체크 (단 1회)
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setAuthed(!!data.session);
      setLoading(false);
    };

    init();

    // 2️⃣ 이후 인증 상태 변화 감지 (loading은 건드리지 않음)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAuthed(!!session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ⛔ 세션 확인 전에는 아무 판단도 하지 않음
  if (loading || authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  // ❌ 인증 안 된 경우만 리다이렉트
  if (!authed) {
    const next = location.pathname + location.search;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  // ✅ 인증 완료 → 내부 IA 정상 렌더
  return <>{children}</>;
}
