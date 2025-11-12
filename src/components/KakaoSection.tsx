import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export const KakaoSection = () => {
  const handleKakaoClick = () => {
    const channelId = "_YOUR_CHANNEL_ID_"; // ✅ 카카오 채널 ID로 교체 (예: "_xkxnTxb")
    const kakaoLink = `http://pf.kakao.com/_UyaHn/chat`; // ✅ 채널 채팅 바로가기 주소

    // 모바일 브라우저에서 카톡앱으로 직접 이동
    window.location.href = kakaoLink;
  };

  return (
    <section className="py-20 px-4 bg-white">
      <div className="container mx-auto max-w-3xl text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">
          빠른 상담
        </h2>

        <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
          예식 일정이 아직 미정이신가요?<br />
          간단한 질문은 <strong>카카오톡 공식채널 1:1 상담</strong>으로 빠르게 답변드립니다.<br />
          톡으로 편하게 문의해주세요.
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
            카카오톡 공식채널로 문의하기 💬
          </Button>
        </div>
      </div>
    </section>
  );
};
