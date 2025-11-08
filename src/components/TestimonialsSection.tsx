import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "박OO 신부님",
    date: "10월 예식",
    content: "하객들이 너무 좋아했고, 식이 끝난 후 정리된 방명록을 받아보는 게 정말 감동이었어요."
  },
  {
    name: "이OO 신랑님",
    date: "9월 예식",
    content: "디지털 방명록 덕분에 현장에서 축하인사를 놓치지 않았어요."
  },
  {
    name: "김OO 신부님",
    date: "8월 예식",
    content: "모바일 청첩장에 QR만 추가했는데 반응이 정말 좋았어요."
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
              className="min-w-[320px] md:min-w-[380px] snap-center bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all"
            >
              <CardContent className="pt-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-accent text-accent" />
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