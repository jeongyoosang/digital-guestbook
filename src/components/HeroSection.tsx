import { motion } from "framer-motion";
import { FileText, QrCode, Sparkles } from "lucide-react";

type Props = {
  onPrimaryClick?: () => void;
};

function FlowDiagram() {
  // “Bridge 느낌” = 얇은 라인 + 빛이 흐르는(대시 이동) 애니메이션
  // 레이아웃은 ‘3개 → 1개(리포트)’로 단순하게.
  return (
    <div className="mt-6 rounded-2xl border border-border/50 bg-background/60 p-4 backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        {/* Left nodes */}
        <div className="relative flex-1">
          <div className="grid gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/70 px-4 py-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-foreground/5">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">축하 메시지</p>
                <p className="text-xs text-muted-foreground">QR로 한 번에 수집</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/70 px-4 py-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-foreground/5">
                <QrCode className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">현장 참석 방명록</p>
                <p className="text-xs text-muted-foreground">누가 왔는지 깔끔하게</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/70 px-4 py-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-foreground/5">
                <FileText className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">축의금</p>
                <p className="text-xs text-muted-foreground">장부 형태로 정리</p>
              </div>
            </div>
          </div>

          {/* Animated “beam” lines to the report node (desktop only) */}
          <div className="pointer-events-none absolute inset-0 hidden md:block">
            <svg
              className="h-full w-full"
              viewBox="0 0 600 220"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="dgLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="35%" stopColor="rgba(255,255,255,0.75)" />
                  <stop offset="55%" stopColor="rgba(255,255,255,0.15)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>

                <linearGradient id="dgStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(99,102,241,0.35)" />
                  <stop offset="50%" stopColor="rgba(236,72,153,0.35)" />
                  <stop offset="100%" stopColor="rgba(59,130,246,0.28)" />
                </linearGradient>
              </defs>

              {/* Base lines */}
              <path
                d="M220 48 C 300 48, 330 60, 400 110"
                fill="none"
                stroke="url(#dgStroke)"
                strokeWidth="2"
                opacity="0.9"
              />
              <path
                d="M220 110 C 300 110, 330 110, 400 110"
                fill="none"
                stroke="url(#dgStroke)"
                strokeWidth="2"
                opacity="0.9"
              />
              <path
                d="M220 172 C 300 172, 330 160, 400 110"
                fill="none"
                stroke="url(#dgStroke)"
                strokeWidth="2"
                opacity="0.9"
              />

              {/* Moving highlight (beam) */}
              <path
                d="M220 48 C 300 48, 330 60, 400 110"
                fill="none"
                stroke="url(#dgLine)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="120 420"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-540"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
              </path>
              <path
                d="M220 110 C 300 110, 330 110, 400 110"
                fill="none"
                stroke="url(#dgLine)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="120 420"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-540"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              </path>
              <path
                d="M220 172 C 300 172, 330 160, 400 110"
                fill="none"
                stroke="url(#dgLine)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="120 420"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-540"
                  dur="2.0s"
                  repeatCount="indefinite"
                />
              </path>
            </svg>
          </div>
        </div>

        {/* Report node */}
        <div className="relative shrink-0 md:w-[220px]">
          <div className="rounded-2xl border border-border/60 bg-foreground/5 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-background">
                <FileText className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">웨딩 리포트</p>
                <p className="text-xs text-muted-foreground">
                  메시지 · 방명록 · 축의금
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              예식이 끝나는 순간<br />
              자동으로 한 번에 정리돼요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeroSection({ onPrimaryClick }: Props) {
  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 dg-animated-gradient" />
      <div className="absolute inset-0 dg-grain" />
      <div className="absolute inset-0 dg-vignette opacity-[0.14]" />
      <div className="absolute bottom-0 left-0 right-0 h-24 dg-fade-bottom" />

      <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-10 md:pt-20 md:pb-14">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
          {/* LEFT */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Brand (pill 제거, 로고처럼) */}
            <div className="mb-6">
              <div className="flex items-baseline gap-3">
                <span className="text-[20px] md:text-[22px] font-extrabold tracking-tight">
                  Digital Guestbook
                </span>
                <span className="text-sm text-muted-foreground">
                  디지털 방명록
                </span>
              </div>
            </div>

            {/* Headline (올드한 문장 제거) */}
            <h1 className="text-[42px] leading-[1.05] tracking-tight md:text-[54px]">
              예식 끝나는 순간,
              <br />
              <span className="wedding-gradient font-extrabold">
                리포트가 완성됩니다.
              </span>
            </h1>

            {/* Description */}
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground md:text-[16px]">
              하객은 QR로 축하 메시지를 남기고,
              <br />
              예식이 끝나면 <span className="font-semibold text-foreground">
                방명록·축의금까지 한 번에
              </span>{" "}
              <span className="font-semibold text-foreground">즉시</span>{" "}
              정리된 리포트를 받아보세요.
            </p>

            {/* Diagram (설명 아래) */}
            <FlowDiagram />

            {/* CTA (1개만) */}
            <div className="mt-7 flex items-center gap-3">
              <button
                onClick={onPrimaryClick}
                className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-sm font-semibold text-background shadow-sm transition hover:opacity-90"
              >
                예약문의 하기
              </button>

              {/* “자세히 알아보기”는 Hero 아래 섹션으로 스크롤하는 ‘텍스트 링크’ 추천 */}
              <a
                href="#details"
                className="text-sm font-semibold text-foreground/80 underline underline-offset-4 hover:text-foreground"
              >
                자세히 알아보기
              </a>
            </div>
          </motion.div>

          {/* RIGHT */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="relative mx-auto w-full max-w-[640px]"
          >
            {/* 메인 비주얼: 원형 유지 (지금 이미지 카드/배지 제거 완료) */}
            <div className="relative aspect-square w-full overflow-hidden rounded-full border border-border/50 bg-background/30 shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
              <img
                src="/landing-poster.jpg"
                alt="Wedding report preview"
                className="h-full w-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/20" />
            </div>

            {/* 우상단 ‘내 리포트’는 필요하면 유지하되, 지금은 “우선 제거”가 맞아 보여서 주석 처리 */}
            {/* <div className="absolute right-2 top-2 rounded-full bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              내 리포트
            </div> */}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
