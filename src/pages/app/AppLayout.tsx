// src/pages/app/AppLayout.tsx
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function AppLayout() {
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* ✅ App 전체 공통 배경 (Header까지 자연스럽게 이어지게) */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(120,119,198,0.12),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.12),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(253,224,71,0.08),transparent_60%)]" />

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/40 bg-transparent backdrop-blur">
        <div className="relative mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          {/* 🔹 랜딩(히어로)로 이동 */}
          <button
            type="button"
            className="font-bold tracking-tight text-sm md:text-base"
            onClick={() => navigate("/", { replace: true })}
          >
            DIGITAL GUESTBOOK
          </button>

          <button
            type="button"
            className="text-sm rounded-xl border border-white/50 bg-white/40 px-3 py-1.5 backdrop-blur hover:bg-white/60 transition"
            onClick={logout}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="relative mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
