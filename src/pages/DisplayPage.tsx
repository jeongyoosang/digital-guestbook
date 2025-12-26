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
  leftPx: number; // ✅ px 기반으로 안전 배치 (끝에서 1글자만 보이는 현상 방지)
  durationMs: number;
};

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

  // 화면 폭 측정 (px 기반 안전 배치용)
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1080
  );

  // ✅ 회전(가로/세로) 자동 반영
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

  useEffect(() => {
    const onResize = () => {
      const w = containerRef.current?.clientWidth ?? window.innerWidth;
      setContainerW(w);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
    // 세로: 3~9 / 가로: 4~12
    if (isPortrait) return Math.min(9, Math.max(3, Math.round(queueLen * 0.38)));
    return Math.min(12, Math.max(4, Math.round(queueLen * 0.42)));
  }, [queueLen, isPortrait]);

  const intervalMs = useMemo(() => {
    // 500~1600ms
    const base = isPortrait ? 1500 : 1350;
    const v = Math.round(base - queueLen * (isPortrait ? 50 : 55));
    return Math.min(1600, Math.max(500, v));
  }, [queueLen, isPortrait]);

  /* ---------- ✅ 헤더/폰트 반응형 (세로는 더 크게) ---------- */
  const topBarHeight = isPortrait ? "26vh" : "28vh"; // ✅ 세로에서 글씨 키우기 위해 공간도 같이 확보

  const groomBrideLabelClass = isPortrait ? "text-2xl" : "text-lg";

  const nameStyle: CSSProperties = isPortrait
    ? {
        fontFamily: "Noto Serif KR, Nanum Myeongjo, serif",
        fontSize: "clamp(46px, 4.6vw, 84px)",
        lineHeight: 1.03,
      }
    : {
        fontFamily: "Noto Serif KR, Nanum Myeongjo, serif",
        fontSize: "clamp(28px, 4.2vw, 64px)",
        lineHeight: 1.05,
      };

  const titleStyle: CSSProperties = isPortrait
    ? {
        fontFamily: "Noto Serif KR, Nanum Myeongjo, serif",
        fontSize: "clamp(44px, 4.4vw, 82px)",
        lineHeight: 1.05,
      }
    : {
        fontFamily: "Noto Serif KR, Nanum Myeongjo, serif",
        fontSize: "clamp(22px, 3.2vw, 52px)",
        lineHeight: 1.1,
      };

  const lowerStyle: CSSProperties = isPortrait
    ? { fontSize: "clamp(22px, 2.2vw, 34px)" }
    : { fontSize: "clamp(14px, 1.6vw, 24px)" };

  const dateStyle: CSSProperties = isPortrait
    ? { fontSize: "clamp(18px, 1.8vw, 28px)" }
    : { fontSize: "clamp(12px, 1.4vw, 18px)" };

  const qrSize = isPortrait
    ? "clamp(150px, 13vw, 210px)"
    : "clamp(80px, 8vw, 120px)";

  /* ---------- ✅ 카드 폭(대략) 기반 안전 배치 ---------- */
  const cardW = useMemo(() => {
    // 세로는 더 넓게 써도 읽힘이 좋고, 가로는 조금 줄여야 겹침이 덜함
    // clamp(360px, 72vw, 760px) 정도 느낌을 px로 근사
    const max = isPortrait ? 760 : 680;
    const min = isPortrait ? 380 : 340;
    const preferred = containerW * (isPortrait ? 0.78 : 0.62);
    return Math.max(min, Math.min(max, Math.round(preferred)));
  }, [containerW, isPortrait]);

  const safePad = useMemo(() => (isPortrait ? 18 : 24), [isPortrait]);

  /* ---------- floating spawn (INFINITE ROTATION) ---------- */
  useEffect(() => {
    if (phase !== "open") return;

    const t = setInterval(() => {
      if (rotationQueueRef.current.length === 0) return;
      if (activeItems.length >= maxActive) return;

      const msg = rotationQueueRef.current.shift();
      if (!msg) return;
      rotationQueueRef.current.push(msg);

      // ✅ px 기반으로 "화면 밖으로 절대 안 나가게"
      const minX = safePad + cardW / 2;
      const maxX = Math.max(minX + 1, containerW - safePad - cardW / 2);

      // 후보 여러 개 뽑아서 겹침 최소화
      const candidates = Array.from({ length: 10 }, () => {
        const r = Math.random();
        return Math.round(minX + r * (maxX - minX));
      });

      const chosen = candidates.find((x) => {
        // 기존 카드와 x 거리 너무 가까우면 제외
        return !activeItems.some((a) => Math.abs(a.leftPx - x) < cardW * 0.35);
      });

      if (chosen === undefined) return;

      const len = msg.body.length;
      const durationMs =
        (isPortrait ? 15500 : 13200) +
        Math.min(6500, Math.max(0, len - 30) * 120);

      setActiveItems((prev) => [
        ...prev,
        {
          key: `${msg.id}-${Date.now()}`,
          message: msg,
          leftPx: chosen,
          durationMs,
        },
      ]);
    }, intervalMs);

    return () => clearInterval(t);
  }, [activeItems, phase, intervalMs, maxActive, containerW, cardW, safePad, isPortrait]);

  /* ---------- render ---------- */
  return (
    <div ref={containerRef} className="relative min-h-screen bg-black overflow-hidden">
      <style>{`
        @keyframes floatUp {
          0%   { transform: translate(-50%, 12vh) scale(0.98); opacity: 0; }
          3%   { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translate(-50%, -160vh) scale(1); opacity: 0; }
        }
      `}</style>

      <audio src="/bgm.m4a" autoPlay loop preload="auto" />

      {/* ✅ 메시지 레이어를 "루트"로 올림: 헤더 박스는 침범하되(=위로 올라감),
          QR은 더 위 레이어(z-40)로 띄워서 항상 읽히게 */}
      <div className="absolute inset-0 overflow-hidden z-30 pointer-events-none">
        {activeItems.map((item) => (
          <div
            key={item.key}
            className="absolute left-1/2 bottom-0 rounded-[32px] text-white text-center shadow-lg backdrop-blur-md"
            style={{
              left: `${item.leftPx}px`,
              width: `${cardW}px`,
              padding: isPortrait ? "28px 36px" : "24px 32px",
              backgroundColor: "rgba(0,0,0,0.28)",
              fontFamily: "Nanum Pen Script, cursive",
              animation: `floatUp ${item.durationMs}ms linear`,
              animationFillMode: "both",
              // 줄바꿈 품질 개선
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
        style={{ height: topBarHeight }}
      >
        {/* ✅ 헤더 박스(배경)는 메시지 뒤로(z-20) */}
        <div className="absolute inset-0 bg-black/40 z-20" />

        <div className="relative w-full max-w-6xl flex items-center justify-between z-40">
          {/* ✅ 신랑/신부/타이틀/QR은 z-40: 메시지가 박스를 침범해도 QR은 항상 읽힘 */}
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
        className="relative flex-1"
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
              {/* 뒤: 블러 cover */}
              <img
                src={mediaUrls[currentSlide]}
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-60"
                alt="background blur"
              />
              {/* 앞: contain */}
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
