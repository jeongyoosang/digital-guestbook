import { useNavigate } from "react-router-dom";
import { ReservationForm } from "@/components/ReservationForm";

type ReservePageProps = {
  onServiceFlowClick?: () => void;
  onReportClick?: () => void;
};

export default function ReservePage({ onServiceFlowClick, onReportClick }: ReservePageProps) {
  const navigate = useNavigate();

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Landing과 동일한 은은한 배경 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(120,119,198,0.18),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.18),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(253,224,71,0.10),transparent_60%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
        {/* 상단 바 (중복 헤더 제거: 이 상단만 유지) */}
        <div className="flex items-center justify-between">
          {/* 왼쪽: 로고(영문만) -> 랜딩 이동 */}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-baseline gap-3 hover:opacity-90 transition"
            aria-label="Go to landing"
          >
            <span className="text-[15px] sm:text-base font-semibold tracking-tight text-foreground">
              Digital Guestbook
            </span>
          </button>

          {/* 오른쪽: 서비스/리포트 */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                if (onServiceFlowClick) return onServiceFlowClick();
                navigate("/service-flow");
              }}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5">
                🔗
              </span>
              <span className="font-medium">서비스</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onReportClick) return onReportClick();
                navigate("/login");
              }}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5">
                📄
              </span>
              <span className="font-medium">리포트</span>
            </button>
          </div>
        </div>

        {/* 헤더 */}
        <header className="mt-10 sm:mt-12 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            디지털방명록 예약 문의
          </h1>

          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
            날짜와 기본 정보만 먼저 받아요.
            <br />
            <span className="text-foreground/80 font-medium">
              세부설정은 예식 2주 전에 진행됩니다.
            </span>
          </p>

          {/* ✅ 하얀 테두리 제거: border 없이 소프트 박스로 */}
          <div className="mt-6 rounded-2xl bg-foreground/5 px-5 py-4 text-sm text-muted-foreground">
            제출 후 예약확정 및 예약금 안내 메시지는 <span className="font-semibold text-foreground">공식 카카오톡 채널</span>로 발송됩니다.
          </div>
        </header>

        {/* 폼 (카드) */}
        <section className="mt-10">
          <div className="rounded-3xl bg-white/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.10)] border border-border/60 p-5 sm:p-7">
            <ReservationForm />
          </div>
        </section>

        {/* 아래 구분선 */}
        <div className="mt-12 h-px bg-border/60" />
      </div>
    </main>
  );
}
