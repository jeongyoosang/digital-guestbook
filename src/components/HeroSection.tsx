import { motion, useReducedMotion } from "framer-motion";

type HeroSectionProps = {
  onPrimaryCTAClick?: () => void; // 예약/문의
  onReportClick?: () => void; // 로그인(내 리포트)
  onServiceFlowClick?: () => void; // 서비스 흐름
};

export default function HeroSection({
  onPrimaryCTAClick,
  onReportClick,
  onServiceFlowClick,
}: HeroSectionProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden">
      {/* Luma 같은 은은한 배경 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(120,119,198,0.18),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.18),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(253,224,71,0.10),transparent_60%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />

      <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-10 lg:pt-20">
        {/* Top-right actions */}
        <div className="flex items-start justify-end">
          <div className="hidden lg:flex items-center gap-6">
            <button
              type="button"
              onClick={onServiceFlowClick}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5">
                🔗
              </span>
              <span className="font-medium">서비스 흐름</span>
            </button>

            <button
              type="button"
              onClick={onReportClick}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5">
                🔐
              </span>
              <span className="font-medium">로그인</span>
            </button>
          </div>
        </div>

        <div className="mt-8 grid items-center gap-10 lg:mt-10 lg:grid-cols-2">
          {/* LEFT */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="max-w-xl"
          >
            <div className="flex items-baseline gap-3">
              <span className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                Digital Guestbook
              </span>
              <span className="text-sm text-muted-foreground">디지털 방명록</span>
            </div>

            {/* ✅ 헤드라인: 모바일 2~3줄로 정리 + “간편히” 줄바꿈 안정화 */}
            <h1 className="mt-6 text-[2.15rem] leading-[1.08] tracking-tight text-foreground sm:text-5xl">
              <span className="block">
                결혼식 축의금,{" "}
                <span className="whitespace-nowrap">QR로 간편히</span>
              </span>
              <span className="block">
                보내고
                <span className="text-muted-foreground">,</span>
              </span>
            </h1>

            {/* ✅ 신랑/신부 가치(리포트) = 헤드라인에서 분리해서 ‘더 무겁게’ */}
            <p className="mt-3 text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              식 종료 후 장부·방명록이{" "}
              <span className="underline underline-offset-4 decoration-foreground/20">
                즉시 리포트로
              </span>
            </p>

            {/* ✅ 설명: bold 과다 → 키워드만 확실하게 */}
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              <span className="block">
                하객은{" "}
                <span className="text-foreground font-bold">QR</span>로
                축하메시지와 축의금을 남기고,
              </span>

              <span className="block mt-1">
                예식이 끝나는 순간{" "}
                <span className="text-foreground font-bold">축의금 내역</span>과{" "}
                <span className="text-foreground font-bold">방명록</span>이
              </span>

              <span className="block mt-1">
                한 번에 정리된{" "}
                <span className="text-foreground font-bold">리포트</span>를
                바로 확인합니다.
              </span>
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onPrimaryCTAClick}
                className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-base font-semibold text-background shadow-sm transition hover:opacity-90"
              >
                예약문의 하기
              </button>
            </div>

            {/* Mobile quick links (lg 이상에서는 기존 상단 버튼 사용) */}
            <div className="mt-4 lg:hidden">
              <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={onServiceFlowClick}
                  className="underline-offset-4 hover:underline"
                >
                  서비스 흐름
                </button>

                <span aria-hidden="true" className="h-4 w-px bg-foreground/15" />

                {/* ✅ 모바일도 “로그인”으로 통일 */}
                <button
                  type="button"
                  onClick={onReportClick}
                  className="underline-offset-4 hover:underline"
                >
                  로그인
                </button>
              </div>
            </div>
          </motion.div>

          {/* RIGHT */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, ease: "easeOut" }}
            className="relative"
          >
            <div className="relative mx-auto w-full max-w-[620px]">
              {/* 이미지 완전 고정 */}
              <div className="relative overflow-hidden rounded-[999px] border border-border/60 bg-background/50 shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
                <div className="aspect-[1/1] w-full">
                  <img
                    src="/landing-poster.jpg"
                    alt="Wedding report preview"
                    className="h-full w-full object-cover dg-hero-grade"
                    loading="eager"
                  />
                </div>

                {/* ✅ 애플식 링 하이라이트: 원 안쪽 영향 0% */}
                <div className="pointer-events-none absolute inset-0">
                  <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="dgBase" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
                        <stop offset="0.5" stopColor="rgba(255,255,255,0.18)" />
                        <stop offset="1" stopColor="rgba(255,255,255,0.45)" />
                      </linearGradient>

                      <linearGradient id="dgGlint" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="rgba(255,255,255,0)" />
                        <stop offset="0.35" stopColor="rgba(255,255,255,0.95)" />
                        <stop offset="0.7" stopColor="rgba(255,255,255,0)" />
                      </linearGradient>

                      <filter id="dgGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="0.7" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    <circle
                      cx="50"
                      cy="50"
                      r="49"
                      fill="none"
                      stroke="url(#dgBase)"
                      strokeWidth="0.9"
                      opacity="0.55"
                    />

                    <circle
                      className={reduceMotion ? "" : "dg-ring-glint"}
                      cx="50"
                      cy="50"
                      r="49"
                      fill="none"
                      stroke="url(#dgGlint)"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeDasharray="42 300"
                      filter="url(#dgGlow)"
                      opacity="0.95"
                    />
                  </svg>

                  <div className="absolute inset-0 dg-apple-vignette" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <div className="h-px bg-border/60" />
      </div>

      <style>{`
        .dg-ring-glint {
          animation: dgGlintMove 4.6s linear infinite;
          transform-origin: 50% 50%;
        }
        @keyframes dgGlintMove {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -310; }
        }
        .dg-apple-vignette {
          background: radial-gradient(circle at 50% 45%, rgba(0,0,0,0.00) 58%, rgba(0,0,0,0.12) 100%);
          opacity: 0.28;
          mix-blend-mode: multiply;
        }
      `}</style>
    </section>
  );
}
