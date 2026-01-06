import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface HeroSectionProps {
  onPrimaryCTAClick: () => void; // 예약
  onSecondaryCTAClick: () => void; // 내 리포트(로그인)
  rightSlot?: ReactNode; // 필요하면 외부 비주얼 주입 가능
}

function PosterVisual() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* ✅ subtle overlay for premium feel */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-tr from-white/10 via-transparent to-white/15" />
      <div className="pointer-events-none absolute inset-0 z-[1] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]" />

      {/* ✅ zoom/pan image */}
      <motion.img
        src="/landing-poster.jpg"
        alt="Wedding report preview"
        className="absolute inset-0 h-full w-full object-cover"
        initial={{ scale: 1.03, x: 0, y: 0 }}
        animate={{
          scale: [1.03, 1.08, 1.03],
          x: [0, -10, 0],
          y: [0, 8, 0],
        }}
        transition={{
          duration: 14,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      />

      {/* ✅ very subtle noise 느낌 (너무 세지 않게) */}
      <div className="pointer-events-none absolute inset-0 z-[2] opacity-[0.06] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.35'/></svg>\")",
        }}
      />
    </div>
  );
}

const HeroSection = ({
  onPrimaryCTAClick,
  onSecondaryCTAClick,
  rightSlot,
}: HeroSectionProps) => {
  return (
    <section className="relative overflow-hidden bg-[#FBF7F4]">
      {/* background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#F7E3E6] blur-3xl opacity-70" />
        <div className="absolute -bottom-28 right-[-80px] h-[460px] w-[460px] rounded-full bg-[rgba(215,179,120,0.25)] blur-3xl opacity-60" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10 pt-8 lg:pt-10 pb-10 lg:pb-12">
        {/* Top right (desktop) */}
        <div className="hidden lg:flex items-start justify-end">
          <div className="text-right">
            <button
              onClick={onSecondaryCTAClick}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B7280] hover:text-[#171717]"
            >
              <span aria-hidden>📄</span>
              <span>내 리포트</span>
            </button>
            <p className="mt-2 text-xs text-[#9CA3AF]">
              리포트/축의금 정리는 PC에서 더 편하게 확인할 수 있어요.
            </p>
          </div>
        </div>

        <div className="mt-6 lg:mt-8 grid lg:grid-cols-[1.05fr_1.25fr] gap-8 lg:gap-12 items-center">
          {/* LEFT */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="mb-5 text-center lg:text-left">
              <span className="inline-flex items-center justify-center lg:justify-start text-sm font-semibold text-[#C84B5B] bg-[#F7E3E6] px-4 py-2 rounded-full">
                Digital Guestbook · 디지털 방명록
              </span>
            </div>

            <h1 className="text-center lg:text-left text-[38px] sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight text-[#171717]">
              현금·종이 없이,
              <br />
              <span className="text-[#C84B5B]">결혼식 정리 끝.</span>
            </h1>

            {/* sub copy: guest value + host value */}
            <p className="mt-5 text-center lg:text-left text-[16px] sm:text-xl text-[#6B7280] leading-relaxed max-w-xl mx-auto lg:mx-0">
              하객은 QR로 <span className="font-semibold text-[#171717]">축하 메시지</span>를 남기고,
              <br className="hidden sm:block" />
              예식이 끝나면 <span className="font-semibold text-[#171717]">방명록·축의금</span>을 리포트로 바로 정리하세요.
            </p>

            {/* small hook */}
            <p className="mt-3 text-center lg:text-left text-sm text-[#8B95A1]">
              ATM 대기 없이, QR로 마음 전하기.
            </p>

            {/* CTA */}
            <div className="mt-7 flex items-center justify-center lg:justify-start gap-4 flex-wrap">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  size="lg"
                  onClick={onPrimaryCTAClick}
                  className="rounded-full px-8 py-6 text-base font-semibold bg-[#C84B5B] hover:bg-[#B74352] text-white shadow-lg shadow-[rgba(200,75,91,0.25)]"
                >
                  예약문의 하기
                </Button>
              </motion.div>

              {/* mobile secondary */}
              <button
                onClick={onSecondaryCTAClick}
                className="lg:hidden inline-flex items-center gap-2 text-sm font-semibold text-[#6B7280] hover:text-[#171717]"
              >
                <span aria-hidden>📄</span>
                <span className="underline underline-offset-4">내 리포트</span>
              </button>

              {/* ✅ mobile helper text (moved near the button) */}
              <p className="lg:hidden w-full text-center text-xs text-[#9CA3AF]">
                리포트/축의금 정리는 PC에서 더 편하게 확인할 수 있어요.
              </p>
            </div>
          </motion.div>

          {/* RIGHT VISUAL */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: "easeOut" }}
          >
            {/* bigger, rounder, with border/glow (Luma-ish) */}
            <div className="relative mx-auto w-full max-w-[860px] aspect-[16/10] overflow-hidden rounded-[42px] border border-white/50 bg-white/40 shadow-[0_28px_90px_rgba(23,23,23,0.12)]">
              {/* subtle glow edge */}
              <div className="pointer-events-none absolute -inset-10 opacity-40 blur-3xl bg-[radial-gradient(circle_at_30%_20%,rgba(200,75,91,0.25),transparent_55%),radial-gradient(circle_at_70%_60%,rgba(67,139,255,0.18),transparent_60%)]" />
              <div className="relative h-full w-full">
                {rightSlot ?? <PosterVisual />}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
