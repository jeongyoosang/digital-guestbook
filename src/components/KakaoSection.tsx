import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export const KakaoSection = () => {
  const handleKakaoClick = () => {
    const kakaoLink = "http://pf.kakao.com/_UyaHn/chat"; // 네 공식채널 링크
    window.location.href = kakaoLink;
  };

  return (
    <section className="py-20 px-4 bg-white">
      <div className="container mx-auto max-w-3xl text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">
          디지털방명록 카카오톡 공식채널
        </h2>

        <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
          예약 문의를 남겨주신 분들은 꼭{" "}
          <strong>디지털방명록 공식 카카오톡 채널</strong>을 추가해 주세요.
          <br />
          예약 확정 안내, 디지털 방명록 링크, 서비스 관련 안내는
          <br />
          모두 이 채널을 통해 발송됩니다.
          <br />
          <br />
          예식 일정이 미정이거나 간단한 질문이 있으시다면
          <br />
          <strong>1:1 채팅</strong>으로 편하게 상담받으실 수 있어요.
        </p>

        <div className="flex justify-center">
          <Button
            onClick={handleKakaoClick}
            size="lg"
            className="
              kakao-button
              w-full sm:w-auto max-w-[320px]
              text-base sm:text-lg
              py-4 sm:py-5
              px-6
              rounded-full
              shadow-lg hover:shadow-xl
              bg-[#FEE500] text-black
              transition-all
            "
          >
            <MessageCircle className="mr-2 w-5 h-5 shrink-0" />
            카카오톡 공식채널 추가 및 문의하기 💬
          </Button>
        </div>
      </div>
    </section>
  );
};
