import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "김OO 신랑님",
    date: "10월 예식",
    content:
      "친구들의 재치있는 축하메시지ㅋㅋ 덕분에 하객들이 즐거워했어요! 지금은 좋은 추억 입니다:) ",
  },
  {
    name: "최OO 신부님",
    date: "11월 예식",
    content: "어르신들도 쉽게 쓰시더라구요. 친구 결혼식 때 꼭 추천할 거예요!",
  },{
    name: "박OO 신부님",
    date: "11월 예식",
    content:
      "하객들이 너무 좋아했고, 식이 끝난 후 정리된 방명록을 받아보는 게 정말 감동이었어요😊",
  },
  {
    name: "최OO 신부님",
    date: "10월 예식",
    content: "예식이 끝나자마자 바로 파일로 받아볼 수 있어서 너무 신기해요😍",
  },
  {
    name: "이OO 신부님",
    date: "10월 예식",
    content:
      "디지털 방명록 화면을 신부대기실에도 놓았어요. 덕분에 누가 오셨는지도 미리 알 수 있었고, 분위기가 너무 즐거웠어요 💐",
  },
  

];

export const TestimonialsSection = () => {
  return (
    <section className="py-20 px-4 bg-muted/30 overflow-hidden">
      <div className="container mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-14">
          실제 사용 후기
        </h2>

        {/* ✨ 자연스럽게 흐르는 리뷰 */}
        <div className="marquee-wrapper">
          <div className="marquee-track">
            {[...testimonials, ...testimonials].map((testimonial, index) => (
              <Card
                key={index}
                className="min-w-[240px] md:min-w-[300px] bg-gradient-to-br from-white to-pink-50/40 hover:shadow-xl transition-all duration-300 border border-pink-100/50 flex-shrink-0 rounded-2xl"
              >
                <CardContent className="pt-5 pb-5 px-5 text-left">
                  <div className="flex mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <p className="text-sm md:text-base mb-3 leading-snug max-w-[260px] break-keep text-gray-700">
                    "{testimonial.content}"
                  </p>
                  <div className="border-t pt-3">
                    <p className="font-bold text-sm md:text-base">
                      {testimonial.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {testimonial.date}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
