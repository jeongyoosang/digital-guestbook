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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
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
            className="text-sm rounded-xl border px-3 py-1.5"
            onClick={logout}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
