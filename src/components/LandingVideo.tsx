const LandingVideo = () => {
  return (
    <div className="relative w-full aspect-[9/16] sm:aspect-[4/5] overflow-hidden bg-black">
      <video
        src="/landingvideo.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* 아주 은근한 하단 그라데이션 (텍스트 가독용, 지금은 텍스트 없음) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent" />
    </div>
  );
};

export default LandingVideo;
