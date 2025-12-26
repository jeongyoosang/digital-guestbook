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

const FOOTER_HEIGHT_PX = 64;

type FloatingItem = {
  key: string;
  message: MessageRow;
  leftPct: number;
  durationMs: number;
};

function InstagramIcon({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  // 심플 인스타그램 로고 SVG (외부 의존성 없음)
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

  /** 원본 메시지(정렬된 상태) */
  const [allMessages, setAllMessages] = useState<MessageRow[]>([]);

  /** 화면에 떠 있는 카드 */
  const [activeItems, setActiveItems] = useState<FloatingItem[]>([]);

  /** 🔁 무한 순환 큐 */
  const rotationQueueRef = useRef<MessageRow[]>([]);

  /** 새 메시지 감지용 */
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

  /** ✅ 회전(가로/세로) 자동 반영 */
  const [isPortrait, setIsPortrait] = useState(
    window.matchMedia("(orientation: portrait)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches);

    // 일부 브라우저 호환
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

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

      // 🔑 새 메시지는 큐 맨 뒤에 추가 (기존 순서 유지)
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

  /* ---------- ✅ 자동 밀도 계산 ---------- */
  const queueLen = rotationQueueRef.current.length;

  const maxActive = useMemo(() => {
    // 메시지 개수에 따라 자연스럽게 상한 변화
    // 세로: 3~8 / 가로: 4~12
    if (isPortrait) {
      return Math.min(8, Math.max(3, Math.round(queueLen * 0.35)));
    }
    return Math.min(12, Math.max(4, Math.round(queueLen * 0.42)));
  }, [queueLen, isPortrait]);

  const intervalMs = useMemo(() => {
    // 메시지가 많을수록 더 자주 생성 (너무 과속 방지: 500~1600ms)
    const base = isPortrait ? 1550 : 1350;
    const v = Math.round(base - queueLen * (isPortrait ? 45 : 55));
    return Math.min(1600, Math.max(500, v));
  }, [queueLen, isPortrait]);

  /* ---------- floating spawn (INFINITE ROTATION) ---------- */
  useEffect(() => {
    if (phase !== "open") return;

    const t = setInterval(() => {
      if (rotationQueueRef.current.length === 0) return;
      if (activeItems.length >= maxActive) return;

      // 🔁 큐에서 하나 꺼내고, 끝에 다시 붙인다 (무한 순환)
      const msg = rotationQueueRef.current.shift();
      if (!msg) return;
      rotationQueueRef.current.push(msg);

      const leftCandidates = Array.from({ length: 10 }, () => 8 + Math.random() * 84);
      const leftPct = leftCandidates.find(
        (x) => !activeItems.some((a) => Math.abs(a.leftPct - x) < 14)
      );
      if (leftPct === undefined) return;

      const len = msg.body.length;
      const durationMs =
        (isPortrait ? 15000 : 13000) +
        Math.min(6000, Math.max(0, len - 30) * 120);

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
  }, [activeItems, phase, isPortrait, intervalMs, maxActive]);

  /* ---------- ✅ 레이아웃 반응형(가로에서 안 짤리게) ---------- */
  const topBarHeight = isPortrait ? "22vh" : "28vh";

  const groomBrideLabelClass = isPortrait ? "text-2xl" : "text-lg";

  const nameStyle: React.CSSProperties = {
    fontFamily: "Noto Serif KR, Nanum Myeongjo, serif",
    fontSize: "clamp(28px, 4.2vw, 64px)",
    lineHeight: 1.05,
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: "Noto Serif KR, Nanum Myeongjo, serif",
    fontSize: "clamp(22px, 3.2vw, 52px)",
    lineHeight: 1.1,
  };

  const lowerStyle: React.CSSProperties = {
    fontSize: "clamp(14px, 1.6vw, 24px)",
  };

  const dateStyle: React.CSSProperties = {
    fontSize: "clamp(12px, 1.4vw, 18px)",
  };

  const qrSize = isPortrait
    ? "clamp(110px, 12vw, 160px)"
    : "clamp(80px, 8vw, 120px)";

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

      {/* TOP */}
      <header
        className="relative z-20 w-full flex items-center justify-center px-6"
        style={{ height: topBarHeight }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative w-full max-w-6xl flex items-center justify-between">
          <div className="text-right">
            <p className={`${groomBrideLabelClass} text-white/60`}>신랑</p>
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
            <p className={`${groomBrideLabelClass} text-white/60`}>신부</p>
            <p className="text-white font-bold" style={nameStyle}>
              {brideName}
            </p>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <section
        className="relative z-10 flex-1"
        style={{
          minHeight: `calc(100vh - ${topBarHeight} - ${FOOTER_HEIGHT_PX}px)`,
        }}
      >
        {usePhotoBackground ? (
          isPortrait ? (
            <img
              src={mediaUrls[currentSlide]}
              className="absolute inset-0 w-full h-full object-cover"
              alt="background"
            />
          ) : (
            <>
              {/* 뒤: 블러 cover로 화면 채우기 */}
              <img
                src={mediaUrls[currentSlide]}
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-60"
                alt="background blur"
              />
              {/* 앞: contain으로 인물/사진 안 잘리게 */}
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

        {/* FLOATING (TOP까지 지나가게) */}
        <div className="absolute inset-0 overflow-hidden z-10">
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
                setActiveItems((prev) => prev.filter((p) => p.key !== item.key))
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
        className="relative z-30 w-full flex items-center justify-between px-6 bg-black/70 text-white"
        style={{ height: FOOTER_HEIGHT_PX }}
      >
        <span>
          마지막 업데이트:{" "}
          {lastUpdated?.toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>

        {/* ✅ 인스타 로고 + 핸들 */}
        <span className="flex items-center gap-2 text-white/90">
          <InstagramIcon className="text-white/90" />
          <span>@digital_guestbook</span>
        </span>
      </footer>
    </div>
  );
}
