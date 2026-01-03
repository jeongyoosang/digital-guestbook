import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface HeroSectionProps {
  onPrimaryCTAClick: () => void; // 예약
  onSecondaryCTAClick: () => void; // 리포트(로그인)
  rightSlot?: ReactNode; // 비주얼(이미지/영상/도식)
}

const HeroSection = ({
  onPrimaryCTAClick,
  onSecondaryCTAClick,
  rightSlot,
}: HeroSectionProps) => {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#FBF7F4]">
      {/* soft background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#F7E3E6] blur-3xl opacity-70" />
        <div className="absolute -bottom-28 right-[-80px] h-[460px] w-[460px] rounded-full bg-[rgba(215,179,120,0.25)] blur-3xl opacity-60" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10 pt-10 lg:pt-12 pb-12 lg:pb-16">
        {/* Top bar (웹에서만) */}
        <div className="hidden lg:flex items-center justify-end">
          <button
            onClick={onSecondaryCTAClick}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#6B7280] hover:text-[#171717]"
          >
            <span aria-hidden>📄</span>
            <span>리포트 보기</span>
          </button>
        </div>

        <div className="mt-6 lg:mt-10 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* LEFT */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="order-1"
          >
            <div className="mb-6">
              <span className="inline-flex items-center text-sm font-medium text-[#C84B5B] bg-[#F7E3E6] px-4 py-2 rounded-full">
                Digital Guestbook · 디지털 방명록
              </span>
            </div>

            <h1 className="text-[40px] sm:text-5xl lg:text-6xl font-extrabold leading-[1.06] tracking-tight text-[#171717]">
              결혼식의 축하를
              <br />
              <span className="text-[#C84B5B]">하나의 리포트로</span>
            </h1>

            <p className="mt-5 text-[17px] sm:text-xl text-[#6B7280] leading-relaxed max-w-xl">
              하객은 QR로 축하 메시지를 남기고,
              <br className="hidden sm:block" />
              예식이 끝나면 메시지와 축의금을 정리한 리포트를 받아보세요.
            </p>

            {/* CTA: 모바일 한 줄 / 웹은 리포트 버튼 상단 */}
            <div className="mt-8 flex items-center justify-between gap-4 max-w-xl">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  size="lg"
                  onClick={onPrimaryCTAClick}
                  className="rounded-full px-8 py-6 text-base font-semibold bg-[#C84B5B] hover:bg-[#B74352] text-white shadow-lg shadow-[rgba(200,75,91,0.25)]"
                >
                  예약문의 하기
                </Button>
              </motion.div>

              <button
                onClick={onSecondaryCTAClick}
                className="lg:hidden inline-flex items-center gap-2 text-sm font-medium text-[#6B7280] hover:text-[#171717]"
              >
                <span aria-hidden>📄</span>
                <span className="underline underline-offset-4">리포트 보기</span>
              </button>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-[#9CA3AF]">
              리포트와 축의금 정리는 PC에서 더 편하게 확인하실 수 있어요.
            </p>
          </motion.div>

          {/* RIGHT VISUAL */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
            className="order-2"
          >
            <div className="relative mx-auto w-full max-w-[640px] lg:max-w-[760px]">
              <div className="relative overflow-hidden rounded-[28px] shadow-[0_24px_80px_rgba(23,23,23,0.10)] aspect-[4/3]">
                {rightSlot ? (
                  <div className="w-full h-full">{rightSlot}</div>
                ) : (
                  <img
                    src="/landing-poster.jpg"
                    alt="디지털 방명록 리포트 미리보기"
                    className="block w-full h-full object-cover"
                    loading="eager"
                  />
                )}
              </div>

              <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[42px] bg-gradient-to-br from-[#F7E3E6] via-transparent to-[rgba(215,179,120,0.18)] blur-3xl opacity-70" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
