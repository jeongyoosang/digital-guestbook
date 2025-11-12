import { Card, CardContent } from "@/components/ui/card";
import { QrCode, Mail, Coins } from "lucide-react";
import receptionScreens from "@/assets/reception-screens.jpg";

const features = [
  {
    icon: QrCode,
    title: "QR 한번으로 간편하게 축하 메시지 작성",
    description: "하객들은 QR만 스캔하면 자신의 휴대폰으로 간편하게 축하 메시지를 남길 수 있어요."
  },
  {
    icon: Mail,
    title: "결혼식 직후 신랑신부에게 자동 전달",
    description: "모든 메시지가 정리되어 동영상과 Excel로 신랑신부님께 전달됩니다."
  },
  {
    icon: Coins,
    title: "모바일 식권",
    description: "종이식권 대신 모바일 식권으로 빠르고 투명하게 정산까지 한 번에 해결합니다.- Coming Soon"
  }
];

export const FeaturesSection = () => {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
          서비스 기능
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="bg-card hover:shadow-xl transition-all">
              <CardContent className="pt-8 text-center">
                <feature.icon className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mb-8">
          <p className="text-lg md:text-xl leading-relaxed max-w-3xl mx-auto text-foreground/90">
            실시간 축하 메시지는 연회장이나 이색 결혼식에서도<br />
            하객 모두가 함께 즐길 수 있는 콘텐츠로 활용될 수 있어요.
          </p>
        </div>

        <div className="relative rounded-3xl overflow-hidden shadow-2xl max-w-4xl mx-auto">
          <img 
            src={receptionScreens} 
            alt="하객들이 대형 스크린으로 축하 메시지를 즐기는 연회장 풍경"
            className="w-full h-auto"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white text-center">
            <p className="text-sm md:text-base font-medium">
              연회장 대형 스크린에 실시간으로 표시되는 축하 메시지
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};