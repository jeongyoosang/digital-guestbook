import { useNavigate } from "react-router-dom";
import HeroSection from "@/components/HeroSection";
import GallerySection from "@/components/GallerySection";
import FeaturesSection from "@/components/FeaturesSection";
import DeliverySection from "@/components/DeliverySection";
import KakaoSection from "@/components/KakaoSection";
import Footer from "@/components/Footer";

export default function Index() {
  const navigate = useNavigate();

  const handleReserve = () => {
    navigate("/reserve");
  };

  const handleReport = () => {
    // 너희 로그인 플로우에 맞게 /login 또는 /app 으로 바꿔도 됨
    navigate("/login");
  };

  const handleServiceFlow = () => {
    // 일단은 페이지/모달 미정이니까, 아래처럼 섹션 앵커로만 연결해두자
    const el = document.getElementById("service-flow");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main>
      <HeroSection
        onPrimaryCTAClick={handleReserve}
        onReportClick={handleReport}
        onServiceFlowClick={handleServiceFlow}
      />

      <GallerySection />
      <FeaturesSection />

      {/* 나중에 서비스흐름 섹션을 넣게 되면 여기 id만 걸어두면 됨 */}
      <div id="service-flow">
        <DeliverySection />
      </div>

      <KakaoSection />
      <Footer />
    </main>
  );
}
