// src/pages/Index.tsx
import { useNavigate } from "react-router-dom";
import HeroSection from "@/components/HeroSection";
import { KakaoSection } from "@/components/KakaoSection";
import { Footer } from "@/components/Footer";

const Index = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#FBF7F4]">
      <HeroSection
        onPrimaryCTAClick={() => navigate("/reserve")}
        onSecondaryCTAClick={() => navigate("/login")}
      />

      <section className="mx-auto max-w-7xl px-6 lg:px-10 py-10">
        <KakaoSection />
      </section>

      <Footer />
    </main>
  );
};

export default Index;
