import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface HeroSectionProps {
  onPrimaryCTAClick: () => void;   // 예약
  onSecondaryCTAClick: () => void; // 리포트(로그인)
  rightSlot?: React.ReactNode;     // 비주얼(이미지/영상/도식)
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
        <div className="absolute -top-24 left-1/2 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-[#F7E3E6] blur-3xl opacity-60" />
        <div className="absolute -bottom-24 right-[-60px] h-[420px] w-[420px] rounded-full bg-[rgba(215,179,120,0.25)] blur-3xl opacity-60" />
      </div>

      {/* container */}
      <div className="relative mx-auto max-w-7xl px-6 lg:px-10 pt-20 pb-14">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* LEFT (always first) */}
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

            {/* CTA */}
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
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
                className="text-sm font-medium text-[#6B7280] hover:text-[#171717] underline underline-offset-4"
              >
                결혼식 리포트 보기
              </button>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-[#9CA3AF]">
              리포트와 축의금 정리는 PC에서 더 편하게 확인하실 수 있어요.
            </p>
          </motion.div>

          {/* VISUAL */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
            className="order-2"
          >
            {/* 
              ✅ 핵심: 모바일은 "텍스트 아래 비주얼"로 보여준다 (숨김 X)
              PC는 우측 컬럼에서 자연스럽게 보임
            */}
            <div className="relative mx-auto w-full max-w-[520px]">
              {/* 카드 외곽 */}
              <div className="relative rounded-[28px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-2xl overflow-hidden">
                {/* 상단 바 느낌(아주 은근하게) */}
                <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                  <div className="text-sm font-medium text-[#6B7280]">
                    한 번의 결혼식, 한 번의 기록
                  </div>
                  <div className="text-xs text-[#9CA3AF]">자동 정리</div>
                </div>

                <div className="px-5 pb-5">
                  {/* 내부 비주얼 슬롯 */}
                  {rightSlot ? (
                    <div className="rounded-2xl bg-white/60 border border-white/70 shadow-sm overflow-hidden">
                      {rightSlot}
                    </div>
                  ) : (
                    <div className="h-[340px] sm:h-[380px] rounded-2xl bg-white/65 border border-white/70" />
                  )}
                </div>
              </div>

              {/* 카드 밑 그림자/글로우 */}
              <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[36px] bg-gradient-to-br from-[#F7E3E6] via-transparent to-[rgba(215,179,120,0.18)] blur-3xl opacity-70" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
