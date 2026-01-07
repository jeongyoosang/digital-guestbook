import { useNavigate } from "react-router-dom";
import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";

export default function Index() {
  const navigate = useNavigate();

  const handleReserve = () => {
    navigate("/reserve");
  };

  const handleReport = () => {
    navigate("/login");
  };

  const handleServiceFlow = () => {
    // 지금은 버튼만 존재, 동작 없음
    // (나중에 모달/페이지 붙일 예정)
    console.log("service flow clicked");
  };
  const handleServiceFlow = () => {
  navigate("/service-flow");
  };

  return (
    <main>
      <HeroSection
        onPrimaryCTAClick={handleReserve}
        onReportClick={handleReport}
        onServiceFlowClick={handleServiceFlow}
      />

      <Footer />
    </main>
  );
}
