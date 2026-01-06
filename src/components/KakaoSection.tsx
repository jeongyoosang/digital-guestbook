import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export const KakaoSection = () => {
  const handleKakaoClick = () => {
    const kakaoLink = "http://pf.kakao.com/_UyaHn/chat";
    window.open(kakaoLink, "_blank"); // ✅ 새 창 권장
  };

  return (
    <section className="mt-6">
      <div className="rounded-2xl border border-border/60 bg-white/70 backdrop-blur-xl p-6 sm:p-7 text-center">
        <h3 className="text-xl sm:text-2xl font-semibold tracking-tight">
          카카오톡 공식채널 추가 (필수)
        </h3>

        <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
          예약 확정 안내, 디지털 방명록 링크, 서비스 안내는
          <br className="hidden sm:block" />
          <span className="font-semibold text-foreground">공식 카카오톡 채널</span>로 발송됩니다.
        </p>

        <div className="mt-5 flex justify-center">
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
            공식채널 추가 및 문의하기 💬
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          * 채널 추가 후 다시 이 페이지로 돌아와도 됩니다.
        </p>
      </div>
    </section>
  );
};
