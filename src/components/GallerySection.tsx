import { Card } from "@/components/ui/card";
import venueChurch1 from "@/assets/venue-church-1.jpg";
import venueChurch2 from "@/assets/venue-church-2.jpg";
import venueHotel1 from "@/assets/venue-hotel-1.jpg";
import venueHotel2 from "@/assets/venue-hotel-2.jpg";
import venueHall1 from "@/assets/venue-hall-1.jpg";
import venueHall2 from "@/assets/venue-hall-2.jpg";
import venueOutdoor from "@/assets/venue-outdoor.jpg";

const venues = [
  { 
    title: "성당 웨딩", 
    description: "고급스럽고 클래식한 분위기",
    image: venueChurch1
  },
  { 
    title: "성당 웨딩", 
    description: "촛불이나 스테인드글라스 포인트",
    image: venueChurch2
  },
  { 
    title: "호텔 예식", 
    description: "현대적이고 밝은 조명",
    image: venueHotel1
  },
  { 
    title: "호텔 예식", 
    description: "플라워월 배경",
    image: venueHotel2
  },
  { 
    title: "예식장 홀", 
    description: "일반 웨딩홀",
    image: venueHall1
  },
  { 
    title: "예식장 홀", 
    description: "플라워 아치가 있는 장면",
    image: venueHall2
  },
  { 
    title: "야외 파티 웨딩", 
    description: "잔디밭, 자연광, 자유로운 분위기",
    image: venueOutdoor
  },
];

export const GallerySection = () => {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
          예식 현장의 순간들
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-3xl mx-auto text-lg">
          디지털 방명록을 통해 남겨진 축하 메시지가<br />
          결혼식 공간마다 따뜻한 장면으로 피어납니다.
        </p>
        
        <div className="relative overflow-hidden">
          <div className="flex gap-6 animate-[scroll_40s_linear_infinite] hover:[animation-play-state:paused]">
            {[...venues, ...venues].map((venue, index) => (
              <Card 
                key={index} 
                className="min-w-[350px] md:min-w-[450px] flex-shrink-0 overflow-hidden bg-card hover:shadow-2xl transition-all duration-300"
              >
                <div className="relative h-[300px] md:h-[350px]">
                  <img 
                    src={venue.image} 
                    alt={`${venue.title} - ${venue.description}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h3 className="text-2xl font-bold mb-2">{venue.title}</h3>
                    <p className="text-sm opacity-90 mb-3">{venue.description}</p>
                    <p className="text-xs italic opacity-75">
                      하객들의 축하 메시지가 실시간으로 띄워지는 장면입니다.
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-350px * 7 - 1.5rem * 7));
          }
        }
        
        @media (min-width: 768px) {
          @keyframes scroll {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(calc(-450px * 7 - 1.5rem * 7));
            }
          }
        }
      `}</style>
    </section>
  );
};
