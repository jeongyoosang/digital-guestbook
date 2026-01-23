import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export const KakaoSection = () => {
  const handleKakaoClick = () => {
    const kakaoLink = "https://pf.kakao.com/_UyaHn/chat";
    window.open(kakaoLink, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="mt-6 flex justify-center">
      <Button
        onClick={handleKakaoClick}
        size="lg"
        className="
          w-full sm:w-auto max-w-[360px]
          rounded-full
          bg-[#FEE500] text-black
          hover:bg-[#FEE500]/90
          shadow-sm hover:shadow-md
          transition
        "
      >
        <MessageCircle className="mr-2 w-5 h-5 shrink-0" />
        카카오톡 채널추가(필수)
      </Button>
    </section>
  );
};
