import React from "react";
import { Card } from "@/components/ui/card";
import galleryHall from "@/assets/gallery-hall.png";
import galleryChurch from "@/assets/gallery-church.png";
import galleryParty from "@/assets/gallery-party.png";
import galleryLobby from "@/assets/gallery-lobby.png";
import galleryGarden from "@/assets/gallery-garden.png";

const venues = [
  {
    title: "야외 가든 웨딩",
    description: "야외 웨딩에서도 스크린과 함께 축하의 순간을 더 선명하게",
    image: galleryGarden,
  },
  {
    title: "성당 웨딩",
    description: "성당 입구 디지털 방명록",
    image: galleryChurch,
  },
  {
    title: "예식장 홀",
    description: "예식장 홀에 비치된 축하 메세지",
    image: galleryHall,
  },
  {
    title: "피로연",
    description: "피로연 자리에서도 스크린으로 축하 메세지를 볼 수 있어요",
    image: galleryParty,
  },
  {
    title: "예식장 로비",
    description: "입장 전, 로비에서 QR을 찍고 메시지를 남기는 하객들",
    image: galleryLobby,
  },
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

        <div className="marquee touch-pan-y">
          <div className="marquee-track">
            {[...venues, ...venues].map((venue, index) => (
              <Card key={index} className="card-item">
                <div className="relative h-[280px] sm:h-[350px] pointer-events-none select-none">
                  {/* 이미지 */}
                  <img
                    src={venue.image}
                    alt={`${venue.title} - ${venue.description}`}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />

                  {/* 아래쪽 그라데이션 (원래 있던 것 그대로) */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                  {/* 타이틀: 왼쪽 상단, 흰색 */}
                  <div className="absolute top-0 left-0 p-4 sm:p-5">
                    <h3 className="text-xl sm:text-2xl font-bold text-white drop-shadow-md">
                      {venue.title}
                    </h3>
                  </div>

                  {/* 설명 + 하단 멘트: 기존 위치 그대로 */}
                  <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 text-white">
                    <p className="text-xs sm:text-sm opacity-90 mb-2 sm:mb-3">
                      {venue.description}
                    </p>
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

      <style>{`
        .marquee {
          overflow: hidden;
          position: relative;
        }
        .touch-pan-y {
          touch-action: pan-y;
        }
        .marquee-track {
          display: flex;
          gap: 1rem;
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
          min-width: 260px;
          flex-shrink: 0;
          overflow: hidden;
          background: hsl(var(--card));
          transition: transform .25s ease, box-shadow .25s ease;
          border-radius: 1rem;
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
