import { useNavigate } from "react-router-dom";
import HeroSection from "@/components/HeroSection";
import { KakaoSection } from "@/components/KakaoSection";
import { Footer } from "@/components/Footer";
import heroMockup from "@/assets/hero-mockup.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#FBF7F4]">
      <HeroSection
        onPrimaryCTAClick={() => navigate("/reserve")}
        onSecondaryCTAClick={() => navigate("/login")}
        rightSlot={
          <img
            src={heroMockup}
            alt="디지털 방명록 앱 화면"
            className="relative w-full max-w-xl mx-auto drop-shadow-2xl"
          />
        }
      />

      <section className="mx-auto max-w-7xl px-6 lg:px-10 py-10">
        <KakaoSection />
      </section>

      <Footer />
    </main>
  );
};

export default Index;
