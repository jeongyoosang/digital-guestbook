// src/pages/Index.tsx
import { useNavigate } from "react-router-dom";
import { HeroSection } from "@/components/HeroSection";
import { KakaoSection } from "@/components/KakaoSection";
import { Footer } from "@/components/Footer";
import HeroRelationDiagram from "@/components/HeroRelationDiagram";

const Index = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen">
      {/* Hero: 결정만 하는 1화면 */}
      <HeroSection
        onPrimaryCTAClick={() => navigate("/reserve")}
        onSecondaryCTAClick={() => navigate("/login")}
        rightSlot={<HeroRelationDiagram />}
      />

      {/* 문의 보조 */}
      <section className="mx-auto max-w-screen-xl px-4 sm:px-6 py-10">
        <KakaoSection />
      </section>

      <Footer />
    </main>
  );
};

export default Index;
