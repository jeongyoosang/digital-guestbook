import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "박OO 신부님",
    date: "9월 예식",
    content: "하객들이 너무 좋아했고, 식이 끝난 후 정리된 방명록을 받아보는 게 정말 감동이었어요."
  },
  {
    name: "이OO 신부님",
    date: "10월 예식",
    content: "디지털 방명록 화면을 실시간으로 신부대기실에도 놓았어요. 덕분에 누가 오셨는지도 미리 알 수 있었고, 긴장될 뻔한 대기실 분위기가 너무 즐거웠어요! 신부대기실에 화면 함께 놓는 거, 강추합니다 💐"
  },
  {
    name: "김OO 신랑님",
    date: "10월 예식",
    content: "친구들의 짓궂기도 하고 센스있는 축하메세지 덕분에 난감했지만 하객들이 즐거웠으니 만족합니다!!"
  },
  {
    name: "최OO 신부님",
    date: "10월 예식",
    content: "어르신들도 쉽게 쓰시더라구요. 친구 결혼식 때 꼭 추천할 거예요."
  }
];

export const TestimonialsSection = () => {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
          실제 사용 후기
        </h2>
        
        <div className="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={index} 
              className="min-w-[320px] md:min-w-[380px] snap-center bg-gradient-to-br from-white to-pink-50/30 hover:shadow-2xl transition-all duration-300 border-2 border-pink-100/50"
            >
              <CardContent className="pt-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-lg mb-4 leading-relaxed">"{testimonial.content}"</p>
                <div className="border-t pt-4">
                  <p className="font-bold">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.date}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};