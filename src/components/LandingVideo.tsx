// src/components/LandingVideo.tsx
export default function LandingVideo() {
  return (
    <video
      className="w-full h-full object-cover"
      src="/landingvideo.mp4"
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
    />
  );
}
