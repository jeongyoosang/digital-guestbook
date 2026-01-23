import { motion, useReducedMotion } from "framer-motion";

type HeroSectionProps = {
  onPrimaryCTAClick?: () => void; // 예약/문의
  onReportClick?: () => void; // 로그인
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
      {/* Luma 같은 은은한 배경 (조금 더 밝게) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(120,119,198,0.20),transparent_58%),radial-gradient(circle_at_82%_18%,rgba(244,114,182,0.20),transparent_60%),radial-gradient(circle_at_55%_82%,rgba(253,224,71,0.14),transparent_62%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-background" />

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
              <span className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground/90">
                Digital Guestbook
              </span>
              <span className="text-sm text-muted-foreground">디지털 방명록</span>
            </div>

            {/* ✅ 확정 헤드라인: 밝은 톤 + 자간/행간 + 모바일 끊김 제어 */}
            <h1 className="mt-6 text-[2.05rem] leading-[1.08] tracking-[-0.02em] text-foreground/90 sm:text-5xl sm:tracking-[-0.03em]">
              <span className="block">
                <span className="whitespace-nowrap">축의금, QR로 한 번에</span>
              </span>

              {/* 컬러 문장: 검정 대신 "선명하지만 부드러운" 컬러 + 굵기 */}
              <span className="mt-1 block font-semibold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400">
                <span className="whitespace-nowrap">식이 끝나면</span>{" "}
                <span className="whitespace-nowrap">장부·방명록이</span>{" "}
                <span className="whitespace-nowrap">자동으로 정리됩니다</span>
              </span>
            </h1>

            {/* ✅ 설명 문단: 기능 설명 유지 + 가독성(칙칙함↓) + 모바일 줄깨짐 최소화 */}
            <p className="mt-5 text-[1.02rem] leading-relaxed text-muted-foreground sm:text-lg">
              <span className="block">
                하객은{" "}
                <span className="text-foreground/90 font-semibold">QR</span>로{" "}
                <span className="text-foreground/90 font-semibold">
                  축하메시지와 축의금
                </span>
                을 보내고,
              </span>

              <span className="block mt-1">
                <span className="text-foreground/90 font-semibold">
                  결혼식이 끝나는 순간
                </span>
              </span>

              <span className="block mt-1">
                장부와 방명록이 한 번에 정리된{" "}
                <span className="text-foreground/90 font-semibold whitespace-nowrap">
                  웨딩리포트
                </span>
                를 바로 확인합니다.
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

            {/* Mobile quick links */}
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
              <div className="relative overflow-hidden rounded-[999px] border border-border/60 bg-background/50 shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
                <div className="aspect-[1/1] w-full">
                  <img
                    src="/landing-poster.jpg"
                    alt="Wedding report preview"
                    className="h-full w-full object-cover dg-hero-grade"
                    loading="eager"
                  />
                </div>

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

                      <filter
                        id="dgGlow"
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                      >
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
          background: radial-gradient(circle at 50% 45%, rgba(0,0,0,0.00) 58%, rgba(0,0,0,0.10) 100%);
          opacity: 0.24;
          mix-blend-mode: multiply;
        }
      `}</style>
    </section>
  );
}
