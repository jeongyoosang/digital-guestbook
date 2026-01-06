import { useNavigate } from "react-router-dom";
import { ReservationForm } from "@/components/ReservationForm";

type ReservePageProps = {
  onReportClick?: () => void; // /login
  onServiceFlowClick?: () => void; // /service-flow (있으면)
};

export default function ReservePage({ onReportClick, onServiceFlowClick }: ReservePageProps) {
  const navigate = useNavigate();

  const goHome = () => navigate("/");
  const goReport = () => {
    if (onReportClick) return onReportClick();
    navigate("/login");
  };
  const goServiceFlow = () => {
    if (onServiceFlowClick) return onServiceFlowClick();
    // 서비스흐름 라우트 없으면 랜딩으로 보내고 섹션 이동은 나중에
    navigate("/#service-flow");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* ✅ 랜딩 Hero와 동일한 ‘Luma’ 배경 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(120,119,198,0.18),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.18),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(253,224,71,0.10),transparent_60%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
        {/* ✅ 상단 네비: 좌측 Brand(랜딩 이동) + 우측 링크(서비스흐름/내리포트) */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={goHome}
            className="inline-flex items-baseline gap-2 text-sm sm:text-base text-muted-foreground hover:text-foreground transition"
          >
            <span className="font-semibold tracking-tight text-foreground">Digital Guestbook</span>
            <span className="text-xs sm:text-sm text-muted-foreground">디지털 방명록</span>
          </button>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={goServiceFlow}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5">
                🔗
              </span>
              <span className="font-medium hidden sm:inline">서비스 흐름</span>
              <span className="font-medium sm:hidden">흐름</span>
            </button>

            <button
              type="button"
              onClick={goReport}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5">
                📄
              </span>
              <span className="font-medium hidden sm:inline">내 리포트</span>
              <span className="font-medium sm:hidden">리포트</span>
            </button>
          </div>
        </div>

        {/* ✅ 예약 페이지는 위쪽 ‘중복 헤더’ 제거하고, 카드 안에서만 보여주기 */}
        <section className="mt-10 sm:mt-12">
          <div className="rounded-3xl border border-border/60 bg-white/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-5 sm:p-7">
            <ReservationForm />
          </div>
        </section>

        {/* 아래 구분선 */}
        <div className="mt-12 h-px bg-border/60" />
      </div>
    </main>
  );
}
