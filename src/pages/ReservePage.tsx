import { ReservationForm } from "@/components/ReservationForm";
import { useNavigate } from "react-router-dom";

type ReservePageProps = {
  onReportClick?: () => void; // 내 리포트
  onServiceFlowClick?: () => void; // 서비스 흐름
};

export default function ReservePage({
  onReportClick,
  onServiceFlowClick,
}: ReservePageProps) {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* 랜딩이랑 톤 맞추는 은은한 배경 */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_15%,rgba(120,119,198,0.14),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.14),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(253,224,71,0.08),transparent_60%)]" />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* ✅ 상단바: 좌 Digital Guestbook(랜딩 이동) / 우 서비스흐름·내리포트 */}
        <div className="flex items-start justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="group inline-flex items-baseline gap-3"
          >
            <span className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
              Digital Guestbook
            </span>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition">
              디지털 방명록
            </span>
          </button>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onServiceFlowClick ?? (() => navigate("/service-flow"))}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5">
                🔗
              </span>
              <span className="hidden sm:inline font-medium">서비스 흐름</span>
            </button>

            <button
              type="button"
              onClick={onReportClick ?? (() => navigate("/login"))}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5">
                📄
              </span>
              <span className="hidden sm:inline font-medium">내 리포트</span>
            </button>
          </div>
        </div>

        {/* ✅ 헤더(한 번만) */}
        <header className="mt-10 sm:mt-12">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            결혼식 예약 신청
          </h1>

          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
            날짜와 기본 정보만 먼저 받아요.
            <br />
            <span className="text-foreground/90 font-medium">
              예식 설정은 예식 2주 전에 진행됩니다.
            </span>
          </p>

          {/* ✅ 안내박스: 테두리 제거 + 랜딩 톤 */}
          <div className="mt-6 rounded-2xl bg-foreground/[0.04] px-5 py-4 text-sm text-muted-foreground">
            제출 후 <span className="font-semibold text-foreground">카카오톡</span>으로
            입금 및 확정 안내를 드립니다.
            <br />
            입금 확인 후 예약이 확정됩니다.
          </div>
        </header>

        {/* ✅ 폼: 바깥 카드(테두리) 제거, 모바일 패딩 최적화 */}
        <section className="mt-8 sm:mt-10">
          <div className="rounded-3xl bg-white/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.06)] p-4 sm:p-8">
            <ReservationForm />
          </div>
        </section>

        {/* 구분선 */}
        <div className="mt-10 h-px bg-border/60" />
      </div>
    </main>
  );
}
