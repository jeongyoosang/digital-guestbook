import { Card, CardContent } from "@/components/ui/card";
import { QrCode, Send, Banknote } from "lucide-react";
import mobileMockup from "@/assets/mobile-mockup.jpg";

const features = [
  {
    icon: QrCode,
    title: "QR로 하객의 축하 메시지 자동 수집",
    description: "간편한 QR 스캔으로 모든 축하 메시지를 실시간 수집합니다."
  },
  {
    icon: Send,
    title: "결혼식 후 신랑신부에게 자동 전달",
    description: "예식이 끝나면 정리된 방명록이 자동으로 전달됩니다."
  },
  {
    icon: Banknote,
    title: "식권 및 정산 기능 (Coming soon)",
    description: "식권 관리와 정산까지 한 번에 처리할 수 있습니다."
  }
];

export const FeaturesSection = () => {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
          서비스 기능
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="border-2 hover:border-primary transition-colors">
              <CardContent className="pt-6 text-center">
                <feature.icon className="w-16 h-16 mx-auto mb-4 text-secondary" />
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="max-w-md mx-auto">
          <img 
            src={mobileMockup} 
            alt="디지털 방명록 모바일 화면" 
            className="w-full rounded-3xl shadow-2xl"
          />
          <p className="text-center mt-6 text-muted-foreground">
            하객이 남긴 축하 메시지를 실시간으로 확인할 수 있습니다.
          </p>
        </div>
      </div>
    </section>
  );
};