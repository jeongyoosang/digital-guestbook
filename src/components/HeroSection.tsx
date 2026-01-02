import { Button } from "@/components/ui/button";

interface HeroSectionProps {
  onPrimaryCTAClick: () => void;   // 예약
  onSecondaryCTAClick: () => void; // 리포트(로그인)
  rightSlot?: React.ReactNode;     // ✅ 우측 도식 슬롯(PC에서만 보여줄 예정)
}

export const HeroSection = ({
  onPrimaryCTAClick,
  onSecondaryCTAClick,
  rightSlot,
}: HeroSectionProps) => {
  return (
    <section className="relative min-h-[88vh] flex items-center bg-[#F6F4EF] text-zinc-900 overflow-hidden">
      {/* background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: "linear-gradient(180deg, #F7F5F0 0%, #EEEAE2 100%)",
        }}
      />

      <div className="mx-auto max-w-7xl w-full px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* LEFT */}
          <div>
            <h1 className="text-[38px] sm:text-[44px] lg:text-[56px] font-semibold tracking-tight leading-tight">
              결혼식의 축하를
              <br />
              <span className="text-zinc-700">하나의 리포트로</span>
            </h1>

            <p className="mt-5 text-[16px] sm:text-lg text-zinc-600 leading-relaxed">
              하객은 QR로 축하 메시지를 남기고,
              <br className="hidden sm:block" />
              예식이 끝나면 메시지와 축의금을 정리한 리포트를 받아보세요.
            </p>

            {/* CTA */}
            <div className="mt-9 flex flex-col sm:flex-row gap-4 items-start">
              <Button
                size="lg"
                onClick={onPrimaryCTAClick}
                className="w-full sm:w-auto px-8 py-6 rounded-full text-base font-medium bg-zinc-900 hover:bg-zinc-800"
              >
                예약 문의하기
              </Button>

              <button
                onClick={onSecondaryCTAClick}
                className="text-sm text-zinc-500 hover:text-zinc-800 underline underline-offset-4"
              >
                결혼식 리포트 보기
              </button>
            </div>

            <p className="mt-3 text-xs sm:text-sm text-zinc-500">
              예약은 모바일에서도 빠르게 가능해요. 리포트/축의금 조회는 PC에서 더 편해요.
            </p>

            {/* ✅ 모바일에서 도식은 숨김(산만함 방지). 원하면 아래 버튼만 노출 */}
            <div className="mt-6 lg:hidden">
              <button
                onClick={() => {
                  // 모바일에서 도식이 꼭 필요하면 모달/아코디언으로 열게끔 추후 연결
                  // 지금은 동작 없이 스타일만 제공해도 OK
                }}
                className="text-sm text-zinc-500 hover:text-zinc-800 underline underline-offset-4"
              >
                어떻게 정리되나요?
              </button>
            </div>
          </div>

          {/* RIGHT (PC only) */}
          <div className="hidden lg:block">
            {rightSlot ? (
              rightSlot
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur shadow-xl p-6">
                <div className="text-sm text-zinc-500">관계 흐름 도식 자리</div>
                <div className="mt-3 h-[340px] rounded-xl bg-zinc-50 border border-zinc-200" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
