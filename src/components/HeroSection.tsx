import { Button } from "@/components/ui/button";

interface HeroSectionProps {
  onCTAClick: () => void;
}

export const HeroSection = ({ onCTAClick }: HeroSectionProps) => {
  return (
    <section className="relative min-h-[72vh] md:min-h-[78vh] flex items-center justify-center overflow-hidden bg-ivory text-ink">
      {/* 부드러운 아이보리 그라데이션 배경 */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: "linear-gradient(to bottom right, #F7F4EF 0%, #ECE7DF 100%)",
        }}
      />

      {/* 얇은 금색 프레임 */}
      <div className="absolute inset-4 border border-gold/50 rounded-3xl -z-10 pointer-events-none" />

      {/* 콘텐츠 카드 */}
      <div className="relative z-10 w-full px-4">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white/70 backdrop-blur-xl border border-leafLight/40 shadow-soft px-6 py-10 sm:px-10 sm:py-12 text-center">
          <h1 className="font-display text-[34px] sm:text-[44px] md:text-[52px] leading-tight tracking-tight text-ink/90">
            Digital Guestbook
          </h1>

          <p className="mt-2 text-lg md:text-xl font-semibold text-ink/80">
            디지털 방명록
          </p>

          <p className="mt-4 text-base sm:text-lg md:text-xl text-ink/70">
            💗 QR 하나로 축하 메시지와 추억을 기록하세요.
          </p>

          <p className="mt-3 sm:mt-4 text-sm sm:text-base md:text-lg leading-relaxed text-ink/60">
            하객은 QR을 찍고 축하 메시지를 남깁니다.
            <br className="hidden sm:block" />
            모든 메시지가 당신의 결혼식에 따뜻한 기억으로 남습니다.
          </p>

          <div className="mt-8 flex justify-center">
            <Button
              size="lg"
              onClick={onCTAClick}
              className="bg-leaf hover:bg-leaf/90 text-white text-base sm:text-lg px-8 py-4 rounded-full shadow-soft transition-all hover:scale-[1.02] active:scale-[0.99]"
            >
              예약 문의하기 💌
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
