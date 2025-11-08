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
    const element = document.getElementById("reservation");
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="min-h-screen">
      <HeroSection onCTAClick={scrollToReservation} />
      <GallerySection />
      <FeaturesSection />
      <ReservationForm />
      <KakaoSection />
      <TestimonialsSection />
      <DeliverySection />
      <ComingSoonSection />
      <Footer />
    </main>
  );
};

export default Index;