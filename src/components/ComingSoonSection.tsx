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
          예식이 끝난 뒤, 신랑신부님은{" "}
          <span className="font-semibold text-foreground">
            디지털방명록 공식 카카오톡 채널로 전달된 링크 <br />
          </span>
          를 통해 다시 한 번 축하 메시지를 읽게 됩니다.
          <br />
          하객의 메시지에 💗, 😘, 👍, 🙌 이모지를 눌러 감사를 표하면,
          <br />
          그 마음이 다시 하객에게 전해집니다.
        </p>

        <div className="text-center mb-12">
          <div className="inline-block bg-accent/20 px-6 py-3 rounded-full mb-6">
            <p className="text-xl font-bold text-accent-foreground">
              "신부 000님이 💗를 눌렀어요"
            </p>
          </div>
        </div>

        <p className="text-center text-lg mb-12 leading-relaxed">
          결혼식의 축하는 <br />감사의 마음으로 이어지고,<br /> 새로운 연결이 시작됩니다.
        </p>

        <div className="space-y-8">
          {/* ① 웹 방명록에서 감정 표시 */}
          <Card className="border-2 border-dashed bg-white/80">
            <CardContent className="pt-8 pb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="text-4xl">📄</span>
                <span className="text-3xl">💗 😘 👍 🙌</span>
              </div>
              <p className="text-center text-muted-foreground">
                ① 웹 방명록에서 이모지로 감정 표시
              </p>
            </CardContent>
          </Card>

          {/* 화살표 */}
          <div className="flex justify-center">
            <ArrowDown className="w-10 h-10 text-primary animate-bounce" />
          </div>

          {/* ② 카카오톡 알림 전송 */}
          <Card className="bg-gradient-to-r from-accent/20 to-primary/20 border-2">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="text-5xl mb-4">💬</div>
              <p className="text-xl font-bold mb-2">카카오톡 알림 전송</p>
              <p className="text-muted-foreground">
                ② “신부 000님이 💗를 눌렀어요”<br />
                하객에게 카카오톡 알림으로 전달됩니다.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
