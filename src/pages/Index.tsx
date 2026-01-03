// src/pages/Index.tsx
import { useNavigate } from "react-router-dom";
import HeroSection from "@/components/HeroSection";
import LandingVideo from "@/components/LandingVideo";
import Footer from "@/components/Footer";

const Index = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen">
      <HeroSection
        onPrimaryCTAClick={() => navigate("/reserve")}
        onSecondaryCTAClick={() => navigate("/login")}
        rightSlot={<LandingVideo />}
      />
      <Footer />
    </main>
  );
};

export default Index;
