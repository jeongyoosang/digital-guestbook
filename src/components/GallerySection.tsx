import React from "react";
import { Card } from "@/components/ui/card";
import venueChurch1 from "@/assets/venue-church-1.jpg";
import venueChurch2 from "@/assets/venue-church-2.jpg";
import venueHotel1 from "@/assets/venue-hotel-1.jpg";
import venueHotel2 from "@/assets/venue-hotel-2.jpg";
import venueHall1 from "@/assets/venue-hall-1.jpg";
import venueHall2 from "@/assets/venue-hall-2.jpg";
import venueOutdoor from "@/assets/venue-outdoor.jpg";

const venues = [
  { title: "성당 웨딩", description: "고급스럽고 클래식한 분위기", image: venueChurch1 },
  { title: "성당 웨딩", description: "촛불이나 스테인드글라스 포인트", image: venueChurch2 },
  { title: "호텔 예식", description: "현대적이고 밝은 조명", image: venueHotel1 },
  { title: "호텔 예식", description: "플라워월 배경", image: venueHotel2 },
  { title: "예식장 홀", description: "일반 웨딩홀", image: venueHall1 },
  { title: "예식장 홀", description: "플라워 아치가 있는 장면", image: venueHall2 },
  { title: "야외 파티 웨딩", description: "잔디밭, 자연광, 자유로운 분위기", image: venueOutdoor },
];

export const GallerySection = () => {
  return (
    <section className="py-20 px-0 sm:px-6 lg:px-8 bg-muted/30">
      <div className="container mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
          예식 현장의 순간들
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-3xl mx-auto text-lg">
          디지털 방명록을 통해 남겨진 축하 메시지가<br />
          결혼식 공간마다 따뜻한 장면으로 피어납니다.
        </p>

        {/* ✅ 자동 흐름: 터치해도 멈추지 않음 */}
        <div className="marquee touch-pan-y">
          <div className="marquee-track">
            {[...venues, ...venues].map((venue, index) => (
              <Card
                key={index}
                className="card-item"
              >
                <div className="relative h-[280px] sm:h-[350px] pointer-events-none select-none">
                  <img
                    src={venue.image}
                    alt={`${venue.title} - ${venue.description}`}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 text-white">
                    <h3 className="text-xl sm:text-2xl font-bold mb-1.5 sm:mb-2">{venue.title}</h3>
                    <p className="text-xs sm:text-sm opacity-90 mb-2 sm:mb-3">{venue.description}</p>
                    <p className="text-[10px] sm:text-xs italic opacity-75">
                      하객들의 축하 메시지가 실시간으로 띄워지는 장면입니다.
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* 내부 스타일: 마키 애니메이션 (중복 X, 터치 중단 X) */}
      <style>{`
        .marquee {
          overflow: hidden;
          position: relative;
          /* 모바일에서 세로 스크롤 우선 -> 터치해도 가로 애니메이션 중단 안 됨 */
        }
        .touch-pan-y {
          touch-action: pan-y;
        }
        .marquee-track {
          display: flex;
          gap: 1rem; /* 모바일 간격 */
          width: max-content;
          will-change: transform;
          animation: marqueeX 30s linear infinite;
        }
        @media (min-width: 640px) {
          .marquee-track { gap: 1.5rem; animation-duration: 38s; }
        }

        @keyframes marqueeX {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .card-item {
          min-width: 260px; /* 모바일 카드 폭 */
          flex-shrink: 0;
          overflow: hidden;
          background: hsl(var(--card));
          transition: transform .25s ease, box-shadow .25s ease;
          border-radius: 1rem; /* Tailwind rounded-2xl에 해당 */
          box-shadow: 0 6px 18px rgba(0,0,0,.08);
        }
        @media (min-width: 640px) {
          .card-item { min-width: 360px; }
        }
        @media (min-width: 768px) {
          .card-item { min-width: 420px; }
        }
        .card-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(0,0,0,.12);
        }
      `}</style>
    </section>
  );
};
