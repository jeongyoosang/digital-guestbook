import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface HeroSectionProps {
  onPrimaryCTAClick: () => void; // 예약
  onSecondaryCTAClick: () => void; // 내 리포트(로그인)
  rightSlot?: ReactNode; // (지금은 무시하고 poster 고정)
}

function PosterVisual() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* soft overlay */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-tr from-white/10 via-transparent to-white/18" />
      <div className="pointer-events-none absolute inset-0 z-[1] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]" />

      {/* zoom/pan */}
      <motion.img
        src="/landing-poster.jpg"
        alt="Wedding report preview"
        className="absolute inset-0 h-full w-full object-cover"
        initial={{ scale: 1.02, x: 0, y: 0 }}
        animate={{
          scale: [1.02, 1.08, 1.02],
          x: [0, -12, 0],
          y: [0, 10, 0],
        }}
        transition={{
          duration: 16,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      />

      {/* subtle grain */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-[0.06] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.35'/></svg>\")",
        }}
      />
    </div>
  );
}

const HeroSection = ({ onPrimaryCTAClick, onSecondaryCTAClick }: HeroSectionProps) => {
  return (
    <section className="relative overflow-hidden bg-[#FBF7F4]">
      {/* background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#F7E3E6] blur-3xl opacity-70" />
        <div className="absolute -bottom-28 right-[-110px] h-[460px] w-[460px] rounded-full bg-[rgba(215,179,120,0.22)] blur-3xl opacity-60" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10 pt-7 lg:pt-10 pb-10 lg:pb-14">
        {/* top right (desktop only) */}
        <div className="hidden lg:flex items-start justify-end">
          <div className="text-right">
            <button
              onClick={onSecondaryCTAClick}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B7280] hover:text-[#171717] transition"
            >
              <span aria-hidden>📄</span>
              <span>내 리포트</span>
            </button>
            <p className="mt-2 text-xs text-[#9CA3AF]">
              리포트/축의금 정리는 PC에서 더 편하게 확인할 수 있어요.
            </p>
          </div>
        </div>

        <div className="mt-7 lg:mt-10 grid items-center gap-10 lg:gap-14 lg:grid-cols-[1fr_1.2fr] min-h-[70vh] lg:min-h-[78vh]">
          {/* LEFT */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            {/* service label (Luma처럼) */}
            <div className="mb-6 text-center lg:text-left">
              <span className="inline-flex items-center justify-center lg:justify-start text-sm font-semibold text-[#6B7280]">
                Digital Guestbook
                <span className="mx-2 opacity-50">·</span>
                디지털 방명록
              </span>
            </div>

            {/* title (Luma 비율: 2줄/큰 글씨) */}
            <h1 className="text-center lg:text-left text-[44px] sm:text-6xl lg:text-[74px] font-extrabold leading-[0.98] tracking-tight text-[#171717]">
              현금·종이 없이,
              <br />
              <span className="text-[#C84B5B]">결혼식 정리 끝.</span>
            </h1>

            {/* description */}
            <p className="mt-6 text-center lg:text-left text-[16px] sm:text-xl text-[#6B7280] leading-relaxed max-w-xl mx-auto lg:mx-0">
              하객은 QR로 <span className="font-semibold text-[#171717]">축하 메시지</span>를 남기고,
              <br className="hidden sm:block" />
              예식이 끝나면 <span className="font-semibold text-[#171717]">방명록·축의금</span>을 리포트로 바로 정리하세요.
            </p>

            <p className="mt-3 text-center lg:text-left text-sm text-[#8B95A1]">
              ATM 대기 없이, QR로 마음 전하기.
            </p>

            {/* CTA */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  size="lg"
                  onClick={onPrimaryCTAClick}
                  className="rounded-full px-9 py-6 text-base font-semibold bg-[#C84B5B] hover:bg-[#B74352] text-white shadow-lg shadow-[rgba(200,75,91,0.22)]"
                >
                  예약문의 하기
                </Button>
              </motion.div>

              {/* mobile only secondary */}
              <button
                onClick={onSecondaryCTAClick}
                className="lg:hidden inline-flex items-center gap-2 text-sm font-semibold text-[#6B7280] hover:text-[#171717] transition"
              >
                <span aria-hidden>📄</span>
                <span className="underline underline-offset-4">내 리포트</span>
              </button>
            </div>

            {/* mobile helper under CTA */}
            <p className="mt-3 lg:hidden text-center text-xs text-[#9CA3AF]">
              리포트/축의금 정리는 PC에서 더 편하게 확인할 수 있어요.
            </p>
          </motion.div>

          {/* RIGHT (Luma 느낌: 원형 큰 비주얼) */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease: "easeOut" }}
          >
            <div className="relative mx-auto w-full max-w-[820px]">
              {/* glow behind */}
              <div className="pointer-events-none absolute -inset-14 opacity-50 blur-3xl bg-[radial-gradient(circle_at_30%_25%,rgba(200,75,91,0.23),transparent_55%),radial-gradient(circle_at_70%_65%,rgba(67,139,255,0.18),transparent_60%)]" />

              <div className="relative aspect-square overflow-hidden rounded-full border border-white/60 bg-white/40 shadow-[0_28px_90px_rgba(23,23,23,0.12)]">
                <PosterVisual />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
