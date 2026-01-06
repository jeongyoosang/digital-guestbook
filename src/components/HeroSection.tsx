import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface HeroSectionProps {
  onPrimaryCTAClick: () => void; // 예약
  onSecondaryCTAClick: () => void; // 내 리포트(로그인)
  rightSlot?: ReactNode; // 비주얼(포스터/영상)
}

const HeroSection = ({
  onPrimaryCTAClick,
  onSecondaryCTAClick,
  rightSlot,
}: HeroSectionProps) => {
  return (
    <section className="relative overflow-hidden bg-[#FBF7F4]">
      {/* background glow (soft) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#F7E3E6] blur-3xl opacity-70" />
        <div className="absolute -bottom-28 right-[-120px] h-[560px] w-[560px] rounded-full bg-[rgba(215,179,120,0.22)] blur-3xl opacity-60" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10 pt-10 lg:pt-12 pb-10 lg:pb-14">
        {/* Top right (desktop): 내 리포트 */}
        <div className="hidden lg:flex items-center justify-end">
          <button
            onClick={onSecondaryCTAClick}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B7280] hover:text-[#171717] transition"
          >
            <span aria-hidden>📄</span>
            <span>내 리포트</span>
          </button>
        </div>

        <div className="mt-6 lg:mt-10 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* LEFT */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            {/* Brand (Luma 느낌: 작은 로고 + 이름) */}
            <div className="mb-6 flex items-center justify-center lg:justify-start gap-3">
              <div className="h-10 w-10 rounded-full bg-[#171717] text-white flex items-center justify-center font-extrabold tracking-tight">
                DG
              </div>
              <div className="leading-tight">
                <div className="text-[15px] font-extrabold text-[#171717]">
                  Digital Guestbook
                </div>
                <div className="text-[13px] font-medium text-[#6B7280]">
                  디지털 방명록
                </div>
              </div>
            </div>

            {/* Headline */}
            <h1 className="text-center lg:text-left text-[44px] sm:text-6xl lg:text-[72px] font-black leading-[0.96] tracking-tight text-[#171717]">
              현금·종이 없이,
              <br />
              <span className="text-[#C84B5B]">예식 끝나면 즉시 정리.</span>
            </h1>

            {/* Description */}
            <p className="mt-5 text-center lg:text-left text-[17px] sm:text-xl text-[#6B7280] leading-relaxed max-w-xl mx-auto lg:mx-0">
              하객은 QR로 축하 메시지를 남기고,
              <br className="hidden sm:block" />
              예식이 끝나는 순간 <span className="font-extrabold text-[#171717]">방명록·축의금·메시지</span>가
              <span className="font-extrabold text-[#171717]"> 리포트로 즉시 정리</span>돼요.
            </p>

            {/* mini flow (간단 다이어그램 느낌) */}
            <div className="mt-5 flex items-center justify-center lg:justify-start gap-2 text-[13px] sm:text-sm text-[#6B7280]">
              <span className="rounded-full border border-black/10 bg-white/60 px-3 py-1">
                축하 메시지
              </span>
              <span className="opacity-60">→</span>
              <span className="rounded-full border border-black/10 bg-white/60 px-3 py-1">
                방명록
              </span>
              <span className="opacity-60">→</span>
              <span className="rounded-full border border-black/10 bg-white/60 px-3 py-1">
                축의금
              </span>
              <span className="opacity-60">→</span>
              <span className="rounded-full border border-black/10 bg-[#171717] text-white px-3 py-1">
                Wedding Report
              </span>
            </div>

            {/* CTA */}
            <div className="mt-8 flex items-center justify-center lg:justify-start gap-4">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  size="lg"
                  onClick={onPrimaryCTAClick}
                  className="rounded-full px-8 py-6 text-base font-bold bg-[#C84B5B] hover:bg-[#B74352] text-white shadow-lg shadow-[rgba(200,75,91,0.25)]"
                >
                  예약문의 하기
                </Button>
              </motion.div>

              {/* mobile only: 내 리포트 */}
              <button
                onClick={onSecondaryCTAClick}
                className="lg:hidden inline-flex items-center gap-2 text-sm font-semibold text-[#6B7280] hover:text-[#171717] transition"
              >
                <span aria-hidden>📄</span>
                <span className="underline underline-offset-4">내 리포트</span>
              </button>
            </div>

            <p className="mt-4 text-center lg:text-left text-xs sm:text-sm text-[#9CA3AF]">
              리포트/축의금 정리는 PC에서 더 편하게 확인하실 수 있어요.
            </p>
          </motion.div>

          {/* RIGHT VISUAL (Luma: huge circle) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.05, ease: "easeOut" }}
            className="flex justify-center lg:justify-end"
          >
            <div className="relative w-full max-w-[760px]">
              {/* circle container */}
              <div className="relative mx-auto aspect-square w-[min(560px,90vw)] lg:w-[560px] overflow-hidden rounded-full shadow-[0_30px_90px_rgba(23,23,23,0.12)] ring-1 ring-black/5">
                {rightSlot}
                {/* soft highlight */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.55),rgba(255,255,255,0)_55%)]" />
              </div>

              {/* subtle floating sparkles */}
              <div className="pointer-events-none absolute -inset-6 opacity-50">
                <div className="absolute left-6 top-10 h-2 w-2 rounded-full bg-white/70 blur-[1px]" />
                <div className="absolute right-10 top-24 h-3 w-3 rounded-full bg-white/60 blur-[1px]" />
                <div className="absolute left-14 bottom-16 h-3 w-3 rounded-full bg-white/60 blur-[1px]" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
