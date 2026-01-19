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
    <div className="relative min-h-screen overflow-x-hidden bg-[#FFF7FB]">
      {/* ✅ 전체 배경(헤더 포함) */}
      <div
        aria-hidden
        className="
          pointer-events-none absolute inset-0
          bg-[radial-gradient(circle_at_20%_15%,rgba(244,114,182,0.22),transparent_55%),
              radial-gradient(circle_at_80%_20%,rgba(167,139,250,0.18),transparent_55%),
              radial-gradient(circle_at_50%_85%,rgba(253,224,71,0.10),transparent_60%)]
        "
      />
      {/* 아주 얇은 톤 보정(전체가 너무 하얘지는 것 방지) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-white/20" />

      <header className="sticky top-0 z-20 border-b border-rose-100/60 bg-[#FFF7FB]/85 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          {/* 로고 / 랜딩으로 */}
          <button
            type="button"
            className="font-bold tracking-tight text-sm md:text-base text-ink/90 hover:opacity-80"
            onClick={() => {
              // ✅ 로그아웃 없이 랜딩으로 이동 (세션 유지 → 다시 /app 오면 자동 로그인)
              window.location.assign("/");
            }}
          >
            DIGITAL GUESTBOOK
          </button>

          {/* 로그아웃 */}
          <button
            type="button"
            className="
              text-sm rounded-xl border border-rose-200/70
              bg-white/55 px-3 py-1.5
              hover:bg-white/70
              text-ink/80
            "
            onClick={async () => {
              try {
                await supabase.auth.signOut(); // ✅ 전역 로그아웃
              } finally {
                // ✅ 로그인 화면으로 이동
                window.location.assign("/login");
              }
            }}
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
