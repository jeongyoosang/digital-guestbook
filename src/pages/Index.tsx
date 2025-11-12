import { HeroSection } from "@/components/HeroSection";
import { GallerySection } from "@/components/GallerySection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { ReservationForm } from "@/components/ReservationForm";
import { KakaoSection } from "@/components/KakaoSection";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { DeliverySection } from "@/components/DeliverySection";
import { ComingSoonSection } from "@/components/ComingSoonSection";
import { Footer } from "@/components/Footer";

const Index = () => {
  const scrollToReservation = () => {
    const el = document.getElementById("reservation");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="min-h-screen scroll-smooth">
      {/* Hero: 풀블리드 유지 */}
      <HeroSection onCTAClick={scrollToReservation} />

      {/* 예식 현장의 순간들: 모바일 좌우 여백 0 */}
      <section className="mx-auto max-w-screen-xl px-0 sm:px-6 lg:px-8 py-12 sm:py-16">
        <GallerySection />
      </section>

      {/* 기능 섹션: 모바일 여백 소폭 축소 (px-2) */}
      <section className="mx-auto max-w-screen-xl px-2 sm:px-6 lg:px-8 py-12 sm:py-16">
        <FeaturesSection />
      </section>

      {/* 예약 폼: 모바일 여백 소폭 축소 (px-2) */}
      <section
        id="reservation"
        className="mx-auto max-w-screen-xl px-2 sm:px-6 lg:px-8 py-12 sm:py-16 scroll-mt-20 sm:scroll-mt-24"
      >
        <ReservationForm />
      </section>

      {/* 카카오 섹션: 모바일 여백 소폭 축소 (px-2) */}
      <section className="mx-auto max-w-screen-xl px-2 sm:px-6 lg:px-8 py-12 sm:py-16">
        <KakaoSection />
      </section>

      {/* 실제 사용 후기: 모바일 좌우 여백 0 (가로 스크롤 답답함 해소) */}
      <section className="mx-auto max-w-screen-xl px-0 sm:px-6 lg:px-8 py-12 sm:py-16">
        <TestimonialsSection />
      </section>

      {/* 전달 섹션: 모바일 여백 소폭 축소 (px-2) */}
      <section className="mx-auto max-w-screen-xl px-2 sm:px-6 lg:px-8 py-12 sm:py-16">
        <DeliverySection />
      </section>

      {/* Coming Soon: 필요 시 유지 / 제거 자유 */}
      <section className="mx-auto max-w-screen-xl px-2 sm:px-6 lg:px-8 py-12 sm:py-16">
        <ComingSoonSection />
      </section>

      <Footer />
    </main>
  );
};

export default Index;
