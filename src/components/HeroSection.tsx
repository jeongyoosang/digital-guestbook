import { motion } from "framer-motion";

type HeroSectionProps = {
  onPrimaryCTAClick?: () => void;      // 예약/문의
  onReportClick?: () => void;          // 내 리포트
  onServiceFlowClick?: () => void;     // 서비스 흐름
};

export default function HeroSection({
  onPrimaryCTAClick,
  onReportClick,
  onServiceFlowClick,
}: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Luma 같은 은은한 배경 (그대로 유지) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(120,119,198,0.18),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.18),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(253,224,71,0.10),transparent_60%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />

      <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-10 lg:pt-20">
        {/* Top-right actions: 내 리포트 + 서비스 흐름 */}
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
                📄
              </span>
              <span className="font-medium">내 리포트</span>
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
            {/* Brand (원형 pill 제거, Luma처럼 텍스트로) */}
            <div className="flex items-baseline gap-3">
              <span className="text-lg font-semibold tracking-tight text-foreground">
                Digital Guestbook
              </span>
              <span className="text-sm text-muted-foreground">디지털 방명록</span>
            </div>

            {/* Headline (포맷 유지) */}
            <h1 className="mt-6 text-4xl leading-[1.08] tracking-tight text-foreground sm:text-5xl">
              <span className="block">현금·종이 없는 결혼식,</span>
              <span className="block wedding-gradient">식 끝나자마자 정리 끝.</span>
            </h1>

            {/* Description (요청 문구로 교체) */}
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              하객은 <span className="text-foreground font-semibold">ATM 대기 없이</span> QR로{" "}
              <span className="text-foreground font-semibold">축의</span>와{" "}
              <span className="text-foreground font-semibold">축하메시지</span>를 남기고,
              예식이 끝나는 순간{" "}
              <span className="text-foreground font-semibold">방명록·축의금</span>이{" "}
              <span className="text-foreground font-semibold">하나의 리포트로 즉시</span>{" "}
              정리돼요.
            </p>

            {/* CTA: 메인 1개만 (가운데 '내 리포트 보기' 제거) */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onPrimaryCTAClick}
                className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-base font-semibold text-background shadow-sm transition hover:opacity-90"
              >
                예약문의 하기
              </button>
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
              {/* 원형 메인이미지 유지 */}
              <div className="relative overflow-hidden rounded-[999px] border border-border/60 bg-background/50 shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
                <div className="aspect-[1/1] w-full">
                  <img
                    src="/landing-poster.jpg"
                    alt="Wedding report preview"
                    className="h-full w-full object-cover"
                    loading="eager"
                  />
                </div>

                {/* ✅ 예전에 반영됐다가 빠진 “동적 움직임” (빛/글로우 레이어) */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-0 opacity-[0.35]">
                    <div className="dg-bokeh">
                      <span style={{ left: "12%", top: "18%", width: 220, height: 220 }} />
                      <span style={{ left: "62%", top: "14%", width: 180, height: 180 }} />
                      <span style={{ left: "22%", top: "62%", width: 240, height: 240 }} />
                      <span style={{ left: "68%", top: "58%", width: 200, height: 200 }} />
                    </div>
                  </div>

                  {/* 빛이 스윽 지나가는 하이라이트 */}
                  <div
                    className="absolute -inset-24 opacity-[0.18]"
                    style={{
                      background:
                        "linear-gradient(120deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 45%, rgba(255,255,255,0) 70%)",
                      transform: "rotate(12deg)",
                      animation: "dg-sheen 6.5s ease-in-out infinite",
                    }}
                  />

                  {/* grain/vignette는 기존 util 있으면 그대로 활용 */}
                  <div className="absolute inset-0 dg-grain" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 아래 섹션과 구분선 (그대로) */}
      <div className="mx-auto max-w-7xl px-6">
        <div className="h-px bg-border/60" />
      </div>

      {/* sheen keyframes (컴포넌트 내부로 최소 추가) */}
      <style>{`
        @keyframes dg-sheen {
          0%   { transform: translateX(-22%) rotate(12deg); opacity: 0; }
          20%  { opacity: 0.16; }
          50%  { transform: translateX(12%) rotate(12deg); opacity: 0.22; }
          80%  { opacity: 0.10; }
          100% { transform: translateX(28%) rotate(12deg); opacity: 0; }
        }
      `}</style>
    </section>
  );
}
