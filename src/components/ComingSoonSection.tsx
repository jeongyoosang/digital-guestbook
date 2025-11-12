import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown } from "lucide-react";

export const ComingSoonSection: React.FC = () => {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-4xl">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-6">
          💡 Coming Soon
        </h2>

        <p className="text-center text-lg text-muted-foreground mb-16 max-w-3xl mx-auto leading-relaxed">
          예식 후, 신랑신부님은 전달받은 디지털 방명록을 앱에서 열람할 수 있습니다.<br />
          하객의 축하 메시지에 💗, 😘, 👍, 🙌 이모지를 누르면<br />
          그 감정이 다시 하객에게 전달됩니다.
        </p>

        <div className="text-center mb-12">
          <div className="inline-block bg-accent/20 px-6 py-3 rounded-full mb-6">
            <p className="text-xl font-bold text-accent-foreground">
              "신부 000님이 💗를 눌렀어요 "
            </p>
          </div>
        </div>

        <p className="text-center text-lg mb-12 leading-relaxed">
          결혼식의 축하는 <br />감사의 마음으로 이어지고,<br />
          새로운 연결이 시작됩니다.
        </p>

        <div className="space-y-8">
          {/* ① PDF 감정 표시 */}
          <Card className="border-2 border-dashed bg-white/80">
            <CardContent className="pt-8 pb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="text-4xl">📄</span>
                <span className="text-3xl">💗 😘 👍 🙌</span>
              </div>
              <p className="text-center text-muted-foreground">
                ① 방명록에 이모지 표시
              </p>
            </CardContent>
          </Card>

          {/* 화살표 */}
          <div className="flex justify-center">
            <ArrowDown className="w-10 h-10 text-primary animate-bounce" />
          </div>

          {/* ② 알림 전송 */}
          <Card className="bg-gradient-to-r from-accent/20 to-primary/20 border-2">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="text-5xl mb-4">💬</div>
              <p className="text-xl font-bold mb-2">알림 전송</p>
              <p className="text-muted-foreground">
                ② “신부 000님이 💗를 눌렀어요 ”<br />
                하객에게 알림으로 전달됩니다.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
