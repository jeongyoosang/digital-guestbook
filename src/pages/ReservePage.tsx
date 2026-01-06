import { ReservationForm } from "@/components/ReservationForm";
import { useNavigate } from "react-router-dom";

export default function ReservePage() {
  const navigate = useNavigate();

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* 랜딩과 톤 맞춘 은은한 배경 */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(120,119,198,0.16),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.16),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(253,224,71,0.10),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-background" />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
        {/* 상단 네비 (랜딩과 동일 톤) */}
        <div className="flex items-start justify-between">
          {/* 왼쪽: 브랜드 (영문만, 클릭 시 랜딩으로) */}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-baseline gap-2 text-sm sm:text-base text-muted-foreground hover:text-foreground transition"
            aria-label="Go to landing"
          >
            <span className="font-semibold tracking-tight text-foreground">
              Digital Guestbook
            </span>
          </button>

          {/* 오른쪽: 서비스/리포트 */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => navigate("/service-flow")}
              className="inline-flex items-center gap-2 rounded-full bg-foreground/5 px-3 py-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground/5">
                🔗
              </span>
              <span className="font-medium">서비스</span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2 rounded-full bg-foreground/5 px-3 py-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground/5">
                📄
              </span>
              <span className="font-medium">내 리포트</span>
            </button>
          </div>
        </div>

        {/* 헤더 */}
        <header className="mt-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            결혼식 예약 신청
          </h1>

          <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
            날짜와 기본 정보만 먼저 받아요.
            <br />
            <span className="text-foreground/80 font-medium">
              예식 설정은 예식 2주 전에 진행됩니다.
            </span>
          </p>

          <div className="mx-auto mt-6 max-w-2xl rounded-2xl bg-white/60 backdrop-blur-xl px-5 py-4 text-sm text-muted-foreground shadow-sm border border-border/60">
            제출 후 <span className="font-semibold text-foreground/90">카카오톡</span>으로
            입금 및 확정 안내를 드립니다.
            <br />
            입금 확인 후 예약이 확정됩니다.
          </div>
        </header>

        {/* 폼 */}
        <section className="mt-10">
          <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-border/60 shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-5 sm:p-7">
            <ReservationForm />
          </div>
        </section>
      </div>
    </main>
  );
}
