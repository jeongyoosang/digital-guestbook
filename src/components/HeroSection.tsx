import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-wedding.jpg";

interface HeroSectionProps {
  onCTAClick: () => void;
}

export const HeroSection = ({ onCTAClick }: HeroSectionProps) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="우아한 성당 웨딩 장면" 
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 to-background"></div>
      </div>
      
      <div className="relative z-10 container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight">
          <span className="wedding-gradient">디지털 방명록</span>
        </h1>
        
        <p className="text-2xl md:text-3xl mb-8 text-foreground/90">
          💍 QR 하나로 축하 메시지와 추억을 기록하세요.
        </p>
        
        <p className="text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed text-muted-foreground">
          하객은 QR을 찍고 축하 메시지를 남깁니다.<br />
          그 순간, 모든 메시지가 당신의 결혼식에 따뜻한 기억으로 남습니다.
        </p>
        
        <Button 
          size="lg" 
          onClick={onCTAClick}
          className="bg-secondary hover:bg-secondary/90 text-secondary-foreground text-lg px-8 py-6 rounded-full shadow-lg transition-all hover:scale-105"
        >
          예약 문의하기 💌
        </Button>
      </div>
    </section>
  );
};