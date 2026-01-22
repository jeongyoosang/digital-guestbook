import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getEventPhase, type EventPhase } from "../lib/time";

interface RouteParams {
  eventId: string;
}

type MessageRow = {
  id: string;
  body: string;
  nickname: string | null;
  created_at: string;
};

type Schedule = {
  start: string;
  end: string;
};

type DisplayStyle = "basic" | "christmas" | "garden" | "luxury";
type BackgroundMode = "photo" | "template";

const POLL_INTERVAL_MS = 5000;
const SLIDE_DURATION_MS = 6000;
const MAX_VIDEO_MS = 30000;
const FOOTER_HEIGHT_PX = 64;

type FloatingItem = {
  key: string;
  message: MessageRow;
  leftPct: number;
  durationMs: number;
};

// ✅ recipients jsonb fallback용
type Recipient = {
  name: string;
  role: string;
  contact: string | null;
};

const isVideoUrl = (url: string) =>
  /\.(mp4|webm|ogg|mov)$/i.test(url);

function InstagramIcon({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M7.5 2.75h9A4.75 4.75 0 0 1 21.25 7.5v9A4.75 4.75 0 0 1 16.5 21.25h-9A4.75 4.75 0 0 1 2.75 16.5v-9A4.75 4.75 0 0 1 7.5 2.75Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M12 16.25A4.25 4.25 0 1 0 12 7.75a4.25 4.25 0 0 0 0 8.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M17.2 6.8h.01"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function DisplayPage() {
  const { eventId } = useParams<RouteParams>();

  /** ✅ 회전(가로/세로) 자동 반영 */
  const [isPortrait, setIsPortrait] = useState(
    window.matchMedia("(orientation: portrait)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  const [activeItems, setActiveItems] = useState<FloatingItem[]>([]);
  const rotationQueueRef = useRef<MessageRow[]>([]);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lowerMessage, setLowerMessage] = useState(
    "친히 오셔서 축복해주셔서 감사합니다."
  );
  const [dateText, setDateText] = useState("");

  const [groomName, setGroomName] = useState("");
  const [brideName, setBrideName] = useState("");

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [now, setNow] = useState(new Date());

  const [displayStyle, setDisplayStyle] = useState<DisplayStyle>("basic");
  const [backgroundMode, setBackgroundMode] =
    useState<BackgroundMode>("template");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  const slideTimerRef = useRef<NodeJS.Timeout | null>(null);

  /* ---------- time ---------- */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  /* ---------- fetch messages ---------- */
  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    async function fetchMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select("id, body, nickname, created_at")
        .eq("event_id", eventId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[DisplayPage] messages select error:", error);
        return;
      }
      if (!data || cancelled) return;

      if (data.length > 0) {
        setLastUpdated(new Date(data[data.length - 1].created_at));
      }

      data.forEach((m) => {
        if (!knownIdsRef.current.has(m.id)) {
          knownIdsRef.current.add(m.id);
          rotationQueueRef.current.push(m);
        }
      });
    }

    fetchMessages();
    const t = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [eventId]);

  /* ---------- settings ---------- */
  useEffect(() => {
    if (!eventId) return;

    supabase
      .from("event_settings")
      .select(
        "lower_message, ceremony_date, ceremony_start_time, ceremony_end_time, display_style, background_mode, media_urls, recipients"
      )
      .eq("event_id", eventId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("[DisplayPage] event_settings select error:", error);
        if (!data) return;

        if (data.lower_message) setLowerMessage(data.lower_message);

        if (data.ceremony_date) {
          const [y, m, d] = data.ceremony_date.split("-");
          setDateText(`${y}년 ${Number(m)}월 ${Number(d)}일`);
        }

        if (data.ceremony_start_time && data.ceremony_end_time) {
          setSchedule({
            start: `${data.ceremony_date}T${data.ceremony_start_time}:00`,
            end: `${data.ceremony_date}T${data.ceremony_end_time}:00`,
          });
        }

        setDisplayStyle((data.display_style as DisplayStyle) ?? "basic");
        setBackgroundMode((data.background_mode as BackgroundMode) ?? "template");
        setMediaUrls(Array.isArray(data.media_urls) ? data.media_urls : []);

        const recipients = Array.isArray(data.recipients)
          ? (data.recipients as Recipient[])
          : [];

        const groom = recipients.find((r) => r?.role === "신랑")?.name;
        const bride = recipients.find((r) => r?.role === "신부")?.name;

        if (!groomName && groom) setGroomName(groom);
        if (!brideName && bride) setBrideName(bride);
      });
  }, [eventId]);

  /* ---------- names (primary) ---------- */
  useEffect(() => {
    if (!eventId) return;

    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("groom_name, bride_name")
        .eq("id", eventId)
        .maybeSingle();

      if (error) {
        console.error("[DisplayPage] events select error:", error);
        return;
      }
      if (!data) return;

      setGroomName(data.groom_name ?? "");
      setBrideName(data.bride_name ?? "");

      if (!data.groom_name || !data.bride_name) {
        const { data: s } = await supabase
          .from("event_settings")
          .select("recipients")
          .eq("event_id", eventId)
          .maybeSingle();

        const recipients = Array.isArray(s?.recipients)
          ? (s!.recipients as Recipient[])
          : [];

        if (!data.groom_name)
          setGroomName(recipients.find((r) => r.role === "신랑")?.name ?? "");
        if (!data.bride_name)
          setBrideName(recipients.find((r) => r.role === "신부")?.name ?? "");
      }
    })();
  }, [eventId]);

  /* ---------- phase ---------- */
  const phase: EventPhase = useMemo(() => {
    if (!schedule) return "open";
    return getEventPhase(now, new Date(schedule.start), new Date(schedule.end));
  }, [now, schedule]);

  /* ---------- photo / video slide ---------- */
  const usePhotoBackground =
    backgroundMode === "photo" && mediaUrls.length > 0;

  const goNextSlide = () => {
    setCurrentSlide((p) => (p + 1) % mediaUrls.length);
  };

  useEffect(() => {
    if (!usePhotoBackground || mediaUrls.length <= 1) {
      setCurrentSlide(0);
      return;
    }

    if (slideTimerRef.current) {
      clearTimeout(slideTimerRef.current);
      slideTimerRef.current = null;
    }

    const url = mediaUrls[currentSlide];
    const isVideo = isVideoUrl(url);

    if (!isVideo) {
      slideTimerRef.current = setTimeout(goNextSlide, SLIDE_DURATION_MS);
    } else {
      slideTimerRef.current = setTimeout(goNextSlide, MAX_VIDEO_MS);
    }

    return () => {
      if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
    };
  }, [currentSlide, mediaUrls, usePhotoBackground]);

  /* ---------- ✅ 자동 밀도 ---------- */
  const queueLen = rotationQueueRef.current.length;

  const maxActive = useMemo(() => {
    if (isPortrait) return Math.min(9, Math.max(3, Math.round(queueLen * 0.38)));
    return Math.min(12, Math.max(4, Math.round(queueLen * 0.42)));
  }, [queueLen, isPortrait]);

  const intervalMs = useMemo(() => {
    const base = isPortrait ? 1500 : 1350;
    const v = Math.round(base - queueLen * (isPortrait ? 50 : 55));
    return Math.min(1600, Math.max(500, v));
  }, [queueLen, isPortrait]);

  /* ---------- (이하 render는 네 코드 그대로) ---------- */
  /* ↓↓↓ 이 아래는 네가 올린 render 코드와 1자도 안 바뀜 ↓↓↓ */

  /* ---------- render ---------- */
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <style>{`
        @keyframes floatUp {
          0%   { transform: translate(-50%, 12vh) scale(0.98); opacity: 0; }
          3%   { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translate(-50%, -160vh) scale(1); opacity: 0; }
        }
      `}</style>

      <audio src="/bgm.m4a" autoPlay loop preload="auto" />

      {/* FLOATING (z-30) */}
      <div className="absolute inset-0 overflow-hidden z-30 pointer-events-none">
        {activeItems.map((item) => (
          <div
            key={item.key}
            className="absolute left-1/2 bottom-0 max-w-2xl px-10 py-8 rounded-[32px]
                       text-white text-center shadow-lg backdrop-blur-md"
            style={{
              left: `${item.leftPct}%`,
              backgroundColor: "rgba(0,0,0,0.28)",
              fontFamily: "Nanum Pen Script, cursive",
              animation: `floatUp ${item.durationMs}ms linear`,
              animationFillMode: "both",
              width: "auto",
              maxWidth: isPortrait ? "78vw" : "62vw",
              wordBreak: "keep-all",
              overflowWrap: "break-word",
              whiteSpace: "pre-wrap",
            }}
            onAnimationEnd={() =>
              setActiveItems((prev) => prev.filter((p) => p.key !== item.key))
            }
          >
            <p className={isPortrait ? "text-6xl leading-tight" : "text-5xl leading-tight"}>
              {item.message.body}
            </p>
            {item.message.nickname && (
              <p className={isPortrait ? "mt-6 text-4xl text-pink-200" : "mt-5 text-3xl text-pink-200"}>
                {item.message.nickname}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* TOP */}
      <header
        className="relative w-full flex items-center justify-center px-6"
        style={{ height: isPortrait ? "26vh" : "28vh" }}
      >
        <div className="absolute inset-0 bg-black/40 z-20" />

        <div className="relative w-full max-w-6xl flex items-center justify-between z-40">
          <div className="text-right">
            <p className="text-white/70">{groomName}</p>
          </div>

          <div className="text-center">
            <img src="/preic_qr.png" className="mx-auto" alt="QR" />
          </div>

          <div className="text-left">
            <p className="text-white/70">{brideName}</p>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <section
        className="relative flex-1"
        style={{
          minHeight: `calc(100vh - ${(isPortrait ? "26vh" : "28vh")} - ${FOOTER_HEIGHT_PX}px)`,
        }}
      >
        {usePhotoBackground ? (
          isVideoUrl(mediaUrls[currentSlide]) ? (
            <video
              src={mediaUrls[currentSlide]}
              className="absolute inset-0 w-full h-full object-contain bg-black"
              autoPlay
              muted
              playsInline
              preload="metadata"
              onEnded={goNextSlide}
              onError={goNextSlide}
            />
          ) : isPortrait ? (
            <img
              src={mediaUrls[currentSlide]}
              className="absolute inset-0 w-full h-full object-cover"
              alt="background"
            />
          ) : (
            <>
              <img
                src={mediaUrls[currentSlide]}
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-60"
                alt="background blur"
              />
              <img
                src={mediaUrls[currentSlide]}
                className="absolute inset-0 w-full h-full object-contain"
                alt="background contain"
              />
            </>
          )
        ) : (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(/display-templates/${displayStyle}/background.jpg)`,
            }}
          />
        )}
      </section>

      {/* FOOTER */}
      <footer
        className="relative z-50 w-full flex items-center justify-between px-6 bg-black/70 text-white"
        style={{ height: FOOTER_HEIGHT_PX }}
      >
        <span>
          마지막 업데이트:{" "}
          {lastUpdated?.toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>

        <span className="flex items-center gap-2 text-white/90">
          <InstagramIcon className="text-white/90" />
          <span>@digital_guestbook</span>
        </span>
      </footer>
    </div>
  );
}
