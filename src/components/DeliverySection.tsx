import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown } from "lucide-react";
import standbymeImage from "@/assets/standbyme-mockup.jpg";

export const DeliverySection = () => {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-4xl">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-6">
          신랑신부에게 전달되는 순간
        </h2>
        <p className="text-center text-muted-foreground mb-16 max-w-3xl mx-auto leading-relaxed">
          결혼식 당일, 하객들의 축하 메시지가 스탠바이미 화면에 풍선처럼 떠오릅니다.<br />
          그리고 예식 후, 그 모든 메시지는 PDF 형태로 정리되어 신랑신부님께 전달됩니다.<br />
          행사장의 감동적인 경험이, 정산과 보관이 편리한 데이터 형태로 이어집니다.
        </p>

        <div className="space-y-12">
          <Card className="overflow-hidden">
            <img 
              src={standbymeImage} 
              alt="스탠바이미 화면에 메시지가 떠오르는 모습" 
              className="w-full h-[400px] object-cover"
            />
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                ① 풍선이 떠오르는 행사장 화면 (Coming Soon — 영상 업데이트 예정)
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <ArrowDown className="w-12 h-12 text-primary animate-bounce" />
          </div>

          <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-2">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="text-6xl mb-6">📄</div>
              <h3 className="text-2xl font-bold mb-4">PDF 요약본 전달</h3>
              <p className="text-muted-foreground max-w-xl mx-auto">
                ② PDF 형태로 정리된 메시지 (Coming Soon — 실제 예시 업데이트 예정)
              </p>
            </CardContent>
          </Card>

          <p className="text-center text-lg text-muted-foreground italic">
            "스탠바이미 화면 그대로의 감성, 관리 가능한 형태로 전달됩니다."
          </p>
        </div>
      </div>
    </section>
  );
};