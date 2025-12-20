import { useEffect, useMemo, useRef, useState } from "react";
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

const TOP_BAR_HEIGHT = "22vh";
const FOOTER_HEIGHT_PX = 64;

type FloatingItem = {
  key: string;
  message: MessageRow;
  leftPct: number;
  durationMs: number;
};

export default function DisplayPage() {
  const { eventId } = useParams<RouteParams>();

  const [allMessages, setAllMessages] = useState<MessageRow[]>([]);
  const [activeItems, setActiveItems] = useState<FloatingItem[]>([]);

  const shownIdsRef = useRef<Set<string>>(new Set());
  const pendingQueueRef = useRef<MessageRow[]>([]);

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

  const isPortrait = window.matchMedia("(orientation: portrait)").matches;

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

      if (error || !data || cancelled) return;

      setAllMessages(data);
      if (data.length > 0) {
        setLastUpdated(new Date(data[data.length - 1].created_at));
      }

      data.forEach((m) => {
        if (!shownIdsRef.current.has(m.id)) {
          pendingQueueRef.current.push(m);
          shownIdsRef.current.add(m.id);
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

  /* ---------- photo slide ---------- */
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

  /* ---------- floating spawn (NO BLINK VERSION) ---------- */
  useEffect(() => {
    if (phase !== "open") return;

    const intervalMs = pendingQueueRef.current.length > 6 ? 700 : 1200;

    const t = setInterval(() => {
      if (pendingQueueRef.current.length === 0) return;
      if (activeItems.length >= (isPortrait ? 6 : 10)) return;

      const msg = pendingQueueRef.current.shift();
      if (!msg) return;

      const leftCandidates = Array.from({ length: 10 }, () => 8 + Math.random() * 84);
      const leftPct = leftCandidates.find(
        (x) => !activeItems.some((a) => Math.abs(a.leftPct - x) < 14)
      );

      // ❗ 조건 불만족 → 생성 안 하고 다시 대기
      if (leftPct === undefined) {
        pendingQueueRef.current.unshift(msg);
        return;
      }

      const len = msg.body.length;
      const durationMs =
        (isPortrait ? 14000 : 12000) + Math.min(6000, Math.max(0, len - 30) * 120);

      setActiveItems((prev) => [
        ...prev,
        {
          key: `${msg.id}-${Date.now()}`,
          message: msg,
          leftPct,
          durationMs,
        },
      ]);
    }, intervalMs);

    return () => clearInterval(t);
  }, [activeItems, phase, isPortrait]);

  /* ---------- render ---------- */
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <style>{`
        @keyframes floatUp {
          0%   { transform: translate(-50%, 12vh); opacity: 0; }
          3%   { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translate(-50%, -130vh); opacity: 0; }
        }
      `}</style>

      <audio src="/bgm.m4a" autoPlay loop preload="auto" />

      {/* TOP */}
      <header
        className="relative w-full flex items-center justify-center px-6"
        style={{ height: TOP_BAR_HEIGHT }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative w-full max-w-6xl flex items-center justify-between">
          <div className="text-right">
            <p className="text-2xl text-white/60">신랑</p>
            <p
              className="text-6xl text-white font-bold"
              style={{ fontFamily: "Noto Serif KR, Nanum Myeongjo, serif" }}
            >
              {groomName}
            </p>
          </div>

          <div className="text-center">
            <p
              className="text-5xl text-white font-bold mb-3"
              style={{ fontFamily: "Noto Serif KR, Nanum Myeongjo, serif" }}
            >
              축하의 마음 전하기
            </p>
            <img src="/preic_qr.png" className="w-40 h-40 mx-auto" />
            <p className="mt-3 text-2xl text-white/90">{lowerMessage}</p>
            {dateText && <p className="text-white/70">{dateText}</p>}
          </div>

          <div className="text-left">
            <p className="text-2xl text-white/60">신부</p>
            <p
              className="text-6xl text-white font-bold"
              style={{ fontFamily: "Noto Serif KR, Nanum Myeongjo, serif" }}
            >
              {brideName}
            </p>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <section
        className="relative flex-1"
        style={{
          minHeight: `calc(100vh - ${TOP_BAR_HEIGHT} - ${FOOTER_HEIGHT_PX}px)`,
        }}
      >
        {usePhotoBackground ? (
          <img
            src={mediaUrls[currentSlide]}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(/display-templates/${displayStyle}/background.jpg)`,
            }}
          />
        )}

        {/* FLOATING */}
        <div className="absolute inset-0 overflow-hidden">
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
              }}
              onAnimationEnd={() =>
                setActiveItems((prev) =>
                  prev.filter((p) => p.key !== item.key)
                )
              }
            >
              <p className="text-6xl leading-tight whitespace-pre-wrap">
                {item.message.body}
              </p>
              {item.message.nickname && (
                <p className="mt-6 text-4xl text-pink-200">
                  {item.message.nickname}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer
        className="w-full flex items-center justify-between px-6 bg-black/70 text-white"
        style={{ height: FOOTER_HEIGHT_PX }}
      >
        <span>
          마지막 업데이트:{" "}
          {lastUpdated?.toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span>@digital_guestbook</span>
      </footer>
    </div>
  );
}
