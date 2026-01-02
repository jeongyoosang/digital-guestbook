import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface HeroSectionProps {
  onPrimaryCTAClick: () => void;   // 예약
  onSecondaryCTAClick: () => void; // 리포트(로그인)
  rightSlot?: React.ReactNode;     // 우측 비주얼(이미지/영상)
}

const HeroSection = ({
  onPrimaryCTAClick,
  onSecondaryCTAClick,
  rightSlot,
}: HeroSectionProps) => {
  return (
    <section className="min-h-screen flex items-center pt-20 pb-16 overflow-hidden bg-[#FBF7F4]">
      <div className="mx-auto max-w-7xl w-full px-6 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: "easeOut" }}
            className="order-2 lg:order-1"
          >
            <div className="mb-6">
              <span className="inline-flex items-center text-sm font-medium text-[#C84B5B] bg-[#F7E3E6] px-4 py-2 rounded-full">
                Digital Guestbook · 디지털 방명록
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6 text-[#171717]">
              <span>결혼식의 축하를</span>
              <br />
              <span className="text-[#C84B5B]">하나의 리포트로</span>
            </h1>

            <p className="text-lg md:text-xl text-[#6B7280] leading-relaxed mb-10 max-w-xl">
              하객은 QR로 축하 메시지를 남기고,
              <br className="hidden sm:block" />
              예식이 끝나면 메시지와 축의금을 정리한 리포트를 받아보세요.
            </p>

            {/* CTA Row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  size="lg"
                  onClick={onPrimaryCTAClick}
                  className="rounded-full px-8 py-6 text-base font-semibold bg-[#C84B5B] hover:bg-[#B74352] text-white shadow-lg"
                >
                  예약문의 하기
                </Button>
              </motion.div>

              {/* ✅ 보조 CTA (로그인 숨김) */}
              <button
                onClick={onSecondaryCTAClick}
                className="text-sm font-medium text-[#6B7280] hover:text-[#171717] underline underline-offset-4"
              >
                결혼식 리포트 보기
              </button>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-[#9CA3AF]">
              리포트와 축의금 정리는 PC에서 더 편하게 확인하실 수 있어요.
            </p>
          </motion.div>

          {/* Right Visual */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.75, delay: 0.15, ease: "easeOut" }}
            className="order-1 lg:order-2 relative"
          >
            <div className="relative">
              {/* Decorative gradient */}
              <div className="absolute -inset-6 bg-gradient-to-br from-[#F7E3E6] via-transparent to-[rgba(215,179,120,0.25)] rounded-full blur-3xl opacity-70" />

              {/* Slot */}
              {rightSlot ? (
                <div className="relative">{rightSlot}</div>
              ) : (
                <div className="relative w-full max-w-xl mx-auto h-[420px] rounded-3xl bg-white/60 border border-white/60 shadow-2xl" />
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
