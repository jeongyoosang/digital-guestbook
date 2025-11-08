import { Card, CardContent } from "@/components/ui/card";
import { Heart, ThumbsUp, ArrowDown } from "lucide-react";

export const ComingSoonSection = () => {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-4xl">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-6">
          💡 Coming Soon
        </h2>
        
        <p className="text-center text-lg text-muted-foreground mb-16 max-w-3xl mx-auto leading-relaxed">
          예식 후, 신랑신부님은 전달받은 디지털 방명록을 앱에서 열람할 수 있습니다.<br />
          마음에 드는 축하 메시지에 하트 💗나 따봉 👍을 누르면,<br />
          그 감정이 하객에게 다시 전달됩니다.
        </p>

        <div className="text-center mb-12">
          <div className="inline-block bg-accent/20 px-6 py-3 rounded-full mb-6">
            <p className="text-xl font-bold text-accent-foreground">
              "신랑 000님이 하트를 눌렀어요 💗"
            </p>
          </div>
        </div>

        <p className="text-center text-lg mb-12 leading-relaxed">
          결혼식의 축하가 끝이 아니라,<br />
          감사의 마음으로 되돌아가는 새로운 연결이 시작됩니다.
        </p>

        <div className="space-y-8">
          <Card className="border-2 border-dashed">
            <CardContent className="pt-8 pb-8">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="text-4xl">📄</div>
                <div className="flex gap-2">
                  <Heart className="w-8 h-8 text-accent fill-accent" />
                  <ThumbsUp className="w-8 h-8 text-secondary fill-secondary" />
                </div>
              </div>
              <p className="text-center text-muted-foreground">
                ① PDF 화면에서 하트 버튼 표시
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <ArrowDown className="w-10 h-10 text-primary animate-bounce" />
          </div>

          <Card className="bg-gradient-to-r from-accent/20 to-primary/20 border-2">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="text-5xl mb-4">💗</div>
              <p className="text-xl font-bold mb-2">알림 전송</p>
              <p className="text-muted-foreground">
                ② "신랑 000님이 하트를 눌렀어요 💗"<br />
                하객에게 알림 전달
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};