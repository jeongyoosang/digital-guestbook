import { motion } from "framer-motion";

type HeroSectionProps = {
  onPrimaryCTAClick?: () => void;
  onSecondaryCTAClick?: () => void; // "내 리포트"
};

export default function HeroSection({
  onPrimaryCTAClick,
  onSecondaryCTAClick,
}: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Luma 같은 은은한 배경 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(120,119,198,0.18),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.18),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(253,224,71,0.10),transparent_60%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />

      <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-10 lg:pt-20">
        {/* Top-right "내 리포트" */}
        <div className="flex items-start justify-end">
          <button
            type="button"
            onClick={onSecondaryCTAClick}
            className="hidden lg:inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5">
              📄
            </span>
            <span className="font-medium">내 리포트</span>
          </button>
        </div>

        <div className="mt-8 grid items-center gap-10 lg:mt-10 lg:grid-cols-2">
          {/* LEFT */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="max-w-xl"
          >
            {/* Brand pill (Luma처럼 로고 느낌) */}
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-4 py-2 shadow-sm">
              <span className="text-sm font-semibold tracking-tight">
                Digital Guestbook
              </span>
              <span className="text-sm text-muted-foreground">· 디지털 방명록</span>
            </div>

            {/* Headline: 과감히 MZ/테크 톤 */}
            <h1 className="mt-6 text-4xl leading-[1.08] tracking-tight text-foreground sm:text-5xl">
              <span className="block">현금·종이 없이,</span>
              <span className="block wedding-gradient">식 끝나자마자 정리 끝.</span>
            </h1>

            {/* Description: “즉시 리포트” 강조 */}
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              하객은 QR로 <span className="text-foreground font-semibold">축하 메시지</span>를 남기고,
              예식이 끝나는 순간 <span className="text-foreground font-semibold">방명록·축의금</span>이
              <span className="text-foreground font-semibold"> 하나의 리포트로 즉시</span> 정리돼요.
              <br className="hidden sm:block" />
              <span className="text-foreground/80 font-medium">
                ATM 대기 없이, QR로 마음 전하기.
              </span>
            </p>

            {/* CTA */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onPrimaryCTAClick}
                className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-base font-semibold text-background shadow-sm transition hover:opacity-90"
              >
                예약문의 하기
              </button>

              <button
                type="button"
                onClick={onSecondaryCTAClick}
                className="inline-flex h-12 items-center justify-center rounded-full border border-border/80 bg-background/70 px-6 text-base font-semibold text-foreground shadow-sm transition hover:bg-background"
              >
                내 리포트 보기
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
              {/* 메인 이미지 카드 */}
              <div className="relative overflow-hidden rounded-[999px] border border-border/60 bg-background/50 shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
                <div className="aspect-[1/1] w-full">
                  <img
                    src="/landing-poster.jpg"
                    alt="Wedding report preview"
                    className="h-full w-full object-cover"
                    loading="eager"
                  />
                </div>
              </div>

              {/* 작은 정보 배지 */}
              <div className="pointer-events-none absolute -left-2 top-6 hidden rounded-2xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm sm:block">
                <p className="text-sm font-semibold">식 끝나면 바로 리포트</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  메시지 + 방명록 + 축의금 정리
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 아래 섹션과 구분선 (Luma처럼) */}
      <div className="mx-auto max-w-7xl px-6">
        <div className="h-px bg-border/60" />
      </div>
    </section>
  );
}
