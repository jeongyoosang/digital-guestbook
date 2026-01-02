// src/pages/app/AppLayout.tsx
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";

export default function AppLayout() {
  const navigate = useNavigate();

  // ✅ /app 로만 들어오면 임시로 demo 이벤트로 보내기
  useEffect(() => {
    if (window.location.pathname === "/app") {
      navigate("/app/event/demo", { replace: true });
    }
  }, [navigate]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="font-bold">디지털 방명록</div>
          <button className="text-sm rounded-xl border px-3 py-1.5" onClick={logout}>
            로그아웃
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
