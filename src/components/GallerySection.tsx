import { Card } from "@/components/ui/card";

const venueTypes = [
  { title: "성당 웨딩", emoji: "⛪" },
  { title: "호텔 예식", emoji: "🏨" },
  { title: "예식장 홀", emoji: "🏛️" },
  { title: "야외 파티 웨딩", emoji: "🌳" },
];

export const GallerySection = () => {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
          예식 현장의 순간들
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-3xl mx-auto text-lg">
          스탠바이미를 통해 남겨진 방명록이 결혼식 공간마다 따뜻한 축하의 장면으로 남습니다.
        </p>
        
        <div className="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide">
          {venueTypes.map((venue, index) => (
            <Card 
              key={index} 
              className="min-w-[300px] md:min-w-[350px] h-[400px] snap-center flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm border-2 hover:shadow-xl transition-all hover:scale-105"
            >
              <div className="text-7xl mb-6">{venue.emoji}</div>
              <h3 className="text-2xl font-bold mb-4">{venue.title}</h3>
              <p className="text-sm text-muted-foreground text-center px-6">
                Coming soon —<br />실제 현장 이미지 업데이트 예정
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};