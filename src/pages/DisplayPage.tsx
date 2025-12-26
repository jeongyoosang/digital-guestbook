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
const FOOTER_HEIGHT_PX = 64;

type FloatingItem = {
  key: string;
  message: MessageRow;
  leftPct: number;
  durationMs: number;
};

function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
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

  /* ---------- orientation ---------- */
  const [isPortrait, setIsPortrait] = useState(
    window.matchMedia("(orientation: portrait)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mq.addEventListener?.("change", handler);
    mq.addListener?.(handler);
    return () => {
      mq.removeEventListener?.("change", handler);
      mq.removeListener?.(handler);
    };
  }, []);

  /* ---------- states ---------- */
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

  /* ---------- time ---------- */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  /* ---------- fetch messages ---------- */
  useEffect(() => {
    if (!eventId) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, body, nickname, created_at")
        .eq("event_id", eventId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: true });

      if (!data) return;

      if (data.length > 0) {
        setLastUpdated(new Date(data[data.length - 1].created_at));
      }

      data.forEach((m) => {
        if (!knownIdsRef.current.has(m.id)) {
          knownIdsRef.current.add(m.id);
          rotationQueueRef.current.push(m);
        }
      });
    };

    fetchMessages();
    const t = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [eventId]);

  /* ---------- settings ---------- */
  useEffect(() => {
    if (!eventId) return;
    supabase
      .from("event_settings")
      .select(
        "lower_message, ceremony_date, ceremony_start_time, ceremony_end_time, display_style, background_mode, media_urls"
      )
      .eq("event_id", eventId)
      .maybeSingle()
      .then(({ data }) => {
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
        setDisplayStyle(data.display_style ?? "basic");
        setBackgroundMode(data.background_mode ?? "template");
        setMediaUrls(Array.isArray(data.media_urls) ? data.media_urls : []);
      });
  }, [eventId]);

  /* ---------- names ---------- */
  useEffect(() => {
    if (!eventId) return;
    supabase
      .from("events")
      .select("groom_name, bride_name")
      .eq("id", eventId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setGroomName(data.groom_name ?? "");
        setBrideName(data.bride_name ?? "");
      });
  }, [eventId]);

  /* ---------- phase ---------- */
  const phase: EventPhase = useMemo(() => {
    if (!schedule) return "open";
    return getEventPhase(now, new Date(schedule.start), new Date(schedule.end));
  }, [now, schedule]);

  /* ---------- slide ---------- */
  const usePhotoBackground =
    backgroundMode === "photo" && mediaUrls.length > 0;

  useEffect(() => {
    if (!usePhotoBackground || mediaUrls.length <= 1) {
      setCurrentSlide(0);
      return;
    }
    const t = setInterval(
      () => setCurrentSlide((p) => (p + 1) % mediaUrls.length),
      SLIDE_DURATION_MS
    );
    return () => clearInterval(t);
  }, [usePhotoBackground, mediaUrls]);

  /* ---------- styles ---------- */
  const topBarHeight = isPortrait ? "26vh" : "28vh";

  /** ✅ 여기만 변경: 신랑/신부 라벨 크기 업 */
  const groomBrideLabelClass = isPortrait ? "text-4xl" : "text-2xl";

  const nameStyle: CSSProperties = {
    fontFamily: "Noto Serif KR, Nanum Myeongjo, serif",
    fontSize: isPortrait
      ? "clamp(46px, 4.6vw, 84px)"
      : "clamp(28px, 4.2vw, 64px)",
    lineHeight: 1.05,
  };

  const titleStyle: CSSProperties = {
    fontFamily: "Noto Serif KR, Nanum Myeongjo, serif",
    fontSize: isPortrait
      ? "clamp(60px, 5vw, 102px)"
      : "clamp(22px, 3.2vw, 52px)",
  };

  const lowerStyle: CSSProperties = {
    fontSize: isPortrait
      ? "clamp(30px, 2.6vw, 46px)"
      : "clamp(14px, 1.6vw, 24px)",
  };

  const dateStyle: CSSProperties = {
    fontSize: isPortrait
      ? "clamp(24px, 2.2vw, 36px)"
      : "clamp(12px, 1.4vw, 18px)",
  };

  const qrSize = isPortrait
    ? "clamp(200px, 15vw, 280px)"
    : "clamp(80px, 8vw, 120px)";

  /* ---------- render ---------- */
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <audio src="/bgm.m4a" autoPlay loop preload="auto" />

      {/* TOP */}
      <header
        className="relative w-full flex items-center justify-center px-6"
        style={{ height: topBarHeight }}
      >
        <div className="absolute inset-0 bg-black/40 z-20" />

        <div className="relative w-full max-w-6xl flex items-center justify-between z-40">
          <div className="text-right">
            <p className={`${groomBrideLabelClass} text-white/70`}>신랑</p>
            <p className="text-white font-bold" style={nameStyle}>
              {groomName}
            </p>
          </div>

          <div className="text-center">
            <p className="text-white font-bold mb-3" style={titleStyle}>
              축하의 마음 전하기
            </p>

            <img
              src="/preic_qr.png"
              className="mx-auto"
              style={{ width: qrSize, height: qrSize }}
              alt="QR"
            />

            <p className="mt-3 text-white/90" style={lowerStyle}>
              {lowerMessage}
            </p>

            {dateText && (
              <p className="text-white/70" style={dateStyle}>
                {dateText}
              </p>
            )}
          </div>

          <div className="text-left">
            <p className={`${groomBrideLabelClass} text-white/70`}>신부</p>
            <p className="text-white font-bold" style={nameStyle}>
              {brideName}
            </p>
          </div>
        </div>
      </header>

      {/* FOOTER */}
      <footer
        className="absolute bottom-0 w-full flex items-center justify-between px-6 bg-black/70 text-white"
        style={{ height: FOOTER_HEIGHT_PX }}
      >
        <span>
          마지막 업데이트:{" "}
          {lastUpdated?.toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span className="flex items-center gap-2">
          <InstagramIcon />
          @digital_guestbook
        </span>
      </footer>
    </div>
  );
}
