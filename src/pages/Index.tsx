import { useNavigate } from "react-router-dom";
import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";

const Index = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen">
      <HeroSection
        onPrimaryCTAClick={() => navigate("/reserve")}
        onSecondaryCTAClick={() => navigate("/login")}
        rightSlot={
          <img
            src="/landing-poster.jpg"
            alt="디지털 방명록 리포트 미리보기"
            className="block w-full h-auto object-cover"
            loading="eager"
          />
        }
      />
      <Footer />
    </main>
  );
};

export default Index;
