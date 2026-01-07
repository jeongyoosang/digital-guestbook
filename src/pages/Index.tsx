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
