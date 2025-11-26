import { Card, CardContent } from "@/components/ui/card";
import { QrCode, Mail, Wallet, Ticket } from "lucide-react";
import featureImage from "@/assets/feature-display.png";

const features = [
  {
    icon: QrCode,
    title: "QR 한번으로 간편하게 축하 메시지 작성",
    description:
      "하객들은 QR만 스캔하면 자신의 휴대폰으로 간편하게 축하 메시지를 남길 수 있어요.",
    comingSoon: false,
  },
  {
    icon: Mail,
    title: "결혼식 직후 신랑신부에게 자동 전달",
    description:
      "모든 메시지와 축의금 장부가 정리되어 동영상과 Excel로 신랑신부님께 전달됩니다.",
    comingSoon: false,
  },
  {
    icon: Wallet,
    title: "축의금 송금",
    description: "번거로운 현금 인출 없이, QR하나로 축의금까지.",
    comingSoon: true,
  },
  {
    icon: Ticket,
    title: "모바일 식권",
    description:
      "식권도 모바일로, 분실없이 빠르고 정산까지 정확하게.",
    comingSoon: true,
  },
];

export const FeaturesSection = () => {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
          서비스 기능
        </h2>

        {/* 모바일 2열 / 데스크탑 4열 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-16">
          {features.map((feature, index) => (
            <Card
              key={index}
              className={`bg-card transition-all ${
                feature.comingSoon
                  ? "opacity-80 border border-dashed border-border"
                  : "hover:shadow-xl"
              }`}
            >
              <CardContent className="pt-6 pb-6 md:pt-8 md:pb-8 text-center flex flex-col items-center">
                <feature.icon
                  className={`w-8 h-8 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 ${
                    feature.comingSoon
                      ? "text-muted-foreground"
                      : "text-primary"
                  }`}
                />

                {feature.comingSoon && (
                  <span className="mb-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    준비 중
                  </span>
                )}

                <h3 className="text-xs md:text-lg font-bold mb-1 md:mb-2 leading-snug">
                  {feature.title}
                </h3>

                {/* 설명: 모바일에서는 숨김, 데스크탑에서만 표시 */}
                <p className="hidden md:block text-sm text-muted-foreground leading-relaxed mt-1">
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
            src={featureImage}
            alt="디지털 방명록이 실제 예식장에서 사용되는 모습"
            className="w-full h-auto object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white text-center">
            <p className="text-sm md:text-base font-medium">
              하객과 함께 하는 축하메세지 이벤트
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
