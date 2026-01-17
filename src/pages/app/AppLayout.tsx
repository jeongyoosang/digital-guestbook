import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function AppLayout() {
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="relative min-h-screen bg-background">
      {/* 🌸 Background Gradient Overlay (장식용, 실제 배경은 흰색 유지) */}
      <div
        aria-hidden
        className="
          pointer-events-none
          absolute inset-0
          bg-[radial-gradient(circle_at_20%_15%,rgba(244,114,182,0.18),transparent_55%),
              radial-gradient(circle_at_80%_20%,rgba(167,139,250,0.18),transparent_55%),
              radial-gradient(circle_at_50%_85%,rgba(253,224,71,0.12),transparent_60%)]
        "
      />

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          {/* 랜딩으로 이동 */}
          <button
            type="button"
            className="font-bold tracking-tight text-sm md:text-base"
            onClick={() => navigate("/", { replace: true })}
          >
            DIGITAL GUESTBOOK
          </button>

          <button
            type="button"
            className="text-sm rounded-xl border border-slate-200 px-3 py-1.5 hover:bg-slate-50"
            onClick={logout}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
