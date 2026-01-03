export default function LandingVideo() {
  return (
    <video
      className="block w-full h-full object-cover"
      src="/landingvideo.mp4"
      poster="/landing-poster.jpg"
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
    />
  );
}
