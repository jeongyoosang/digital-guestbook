import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export const KakaoSection = () => {
  const handleKakaoClick = () => {
    // Replace with actual KakaoTalk open chat link
    window.open("https://open.kakao.com/", "_blank");
  };

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-3xl text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">
          💛 익명으로 문의하기
        </h2>
        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
          예식 일정이 아직 미정이신가요?<br />
          간단한 질문은 카카오톡 <strong>1:1 오픈채팅</strong>으로 익명 상담이 가능합니다.<br />
          이름을 남기지 않아도 자유롭게 문의해보세요.
        </p>
        <Button 
          onClick={handleKakaoClick}
          size="lg"
          className="kakao-button text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all"
        >
          <MessageCircle className="mr-2 w-5 h-5" />
          카카오톡 1:1 오픈채팅 문의하기 💬
        </Button>
      </div>
    </section>
  );
};