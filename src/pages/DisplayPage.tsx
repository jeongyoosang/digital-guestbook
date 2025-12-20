// src/pages/DisplayPage.tsx
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

type ActiveItem = {
  key: string;
  msgId: string;
  body: string;
  nickname: string | null;
  createdAt: string;

  xPct: number;
  yStartPct: number; // start y (%)

  startAt: number;
  endAt: number;
  durationMs: number;

  widthPct: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function estimateDurationMs(text: string, isPortrait: boolean) {
  const t = (text ?? "").trim();
  const len = t.length;

  const base = isPortrait ? 10800 : 9300;

  const lineBreaks = (t.match(/\n/g) || []).length;
  const lineBoost = Math.min(1800, lineBreaks * 650);

  const extra = Math.min(6800, Math.max(0, len - 26) * 95);

  return base + extra + lineBoost;
}

function getSpawnIntervalMs(backlog: number, isPortrait: boolean) {
  const slow = isPortrait ? 1500 : 1200;
  const fast = isPortrait ? 620 : 480;

  const t = clamp(backlog / 30, 0, 1);
  return Math.round(slow - (slow - fast) * t);
}

function estimateCardWidthPct(body: string, nickname: string | null, isPortrait: boolean) {
  const text = (body ?? "").trim();
  const lines = text.split("\n");
  const maxLineLen = Math.max(...lines.map((l) => l.trim().length), 0);

  const len = text.length;
  const hasNick = Boolean(nickname && nickname.trim());

  const base = isPortrait ? 44 : 34;
  const lineFactor = clamp(maxLineLen / 22, 0, 2.2);
  const lenFactor = clamp(len / 70, 0, 1.6);
  const nickBoost = hasNick ? 3 : 0;

  let width = base + lineFactor * 10 + lenFactor * 6 + nickBoost;
  width = clamp(width, isPortrait ? 38 : 28, isPortrait ? 78 : 62);

  return width;
}

function overlapsInTime(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function overlapsInX(
  aCenter: number,
  aWidth: number,
  bCenter: number,
  bWidth: number,
  gap = 2
) {
  const aL = aCenter - aWidth / 2 - gap;
  const aR = aCenter + aWidth / 2 + gap;
  const bL = bCenter - bWidth / 2 - gap;
  const bR = bCenter + bWidth / 2 + gap;
  return aL < bR && bL < aR;
}

export default function DisplayPage() {
  const { eventId } = useParams<RouteParams>();

  const [allMessages, setAllMessages] = useState<MessageRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [lowerMessage, setLowerMessage] = useState("친히 오셔서 축복해주셔서 감사합니다.");
  const [dateText, setDateText] = useState<string>("");

  const [groomName, setGroomName] = useState<string>("");
  const [brideName, setBrideName] = useState<string>("");

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  const [displayStyle, setDisplayStyle] = useState<DisplayStyle>("basic");

  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("template");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1000,
    h: typeof window !== "undefined" ? window.innerHeight : 1600,
  }));

  const isPortrait = useMemo(() => viewport.h >= viewport.w, [viewport]);
  const TOP_BAR_HEIGHT = useMemo(() => (isPortrait ? "22vh" : "18vh"), [isPortrait]);

  const [activeItems, setActiveItems] = useState<ActiveItem[]>([]);
  const activeItemsRef = useRef<ActiveItem[]>([]);
  useEffect(() => {
    activeItemsRef.current = activeItems;
  }, [activeItems]);

  const pendingQueueRef = useRef<MessageRow[]>([]);
  const queuedSetRef = useRef<Set<string>>(new Set());
  const shownSetRef = useRef<Set<string>>(new Set());
  const replayCursorRef = useRef<number>(0);

  const spawnTimerRef = useRef<number | null>(null);
  const lastSpawnAtRef = useRef<number>(0);

  if (!eventId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-2xl text-gray-200">이벤트 ID가 없습니다.</p>
      </div>
    );
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize as any);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize as any);
    };
  }, []);

  // messages polling + enqueue new
  useEffect(() => {
    let cancelled = false;

    async function fetchMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select("id, body, nickname, created_at")
        .eq("event_id", eventId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[Display] fetchMessages error", error);
        return;
      }
      if (!data || cancelled) return;

      setAllMessages(data);

      if (data.length > 0) {
        setLastUpdated(new Date(data[data.length - 1].created_at));
      }

      for (const m of data) {
        if (shownSetRef.current.has(m.id)) continue;
        if (queuedSetRef.current.has(m.id)) continue;
        pendingQueueRef.current.push(m);
        queuedSetRef.current.add(m.id);
      }
    }

    fetchMessages();
    const timer = setInterval(fetchMessages, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [eventId]);

  // event_settings
  useEffect(() => {
    let cancelled = false;

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("event_settings")
        .select(
          `
          lower_message,
          ceremony_date,
          ceremony_start_time,
          ceremony_end_time,
          display_style,
          background_mode,
          media_urls
        `
        )
        .eq("event_id", eventId)
        .maybeSingle();

      if (error) {
        console.error("[Display] fetchSettings error", error);
        return;
      }
      if (!data || cancelled) return;

      if (data.lower_message) setLowerMessage(data.lower_message);

      if (data.ceremony_date) {
        try {
          const [y, m, d] = (data.ceremony_date as string).split("-");
          setDateText(`${y}년 ${Number(m)}월 ${Number(d)}일`);
        } catch (e) {
          console.error("[Display] ceremony_date parse error", e);
        }
      }

      if (data.ceremony_start_time && data.ceremony_end_time) {
        const dateStr = (data.ceremony_date as string) ?? "";
        const startTime = data.ceremony_start_time as string;
        const endTime = data.ceremony_end_time as string;

        const baseDate =
          dateStr && dateStr.length === 10 ? dateStr : new Date().toISOString().slice(0, 10);

        setSchedule({
          start: `${baseDate}T${startTime}:00`,
          end: `${baseDate}T${endTime}:00`,
        });
      }

      if (data.display_style) {
        const value = data.display_style as DisplayStyle;
        setDisplayStyle(["basic", "christmas", "garden", "luxury"].includes(value) ? value : "basic");
      } else {
        setDisplayStyle("basic");
      }

      const mode = data.background_mode as BackgroundMode | null;
      setBackgroundMode(mode === "photo" || mode === "template" ? mode : "template");

      if (Array.isArray(data.media_urls) && data.media_urls.length > 0) {
        setMediaUrls(data.media_urls as string[]);
      } else {
        setMediaUrls([]);
      }
    };

    fetchSettings();
    const timer = setInterval(fetchSettings, 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [eventId]);

  // events: names
  useEffect(() => {
    let cancelled = false;

    const fetchEventNames = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("groom_name, bride_name")
        .eq("id", eventId)
        .maybeSingle();

      if (error) {
        console.error("[Display] fetchEventNames error", error);
        return;
      }
      if (!data || cancelled) return;

      setGroomName(data.groom_name ?? "");
      setBrideName(data.bride_name ?? "");
    };

    fetchEventNames();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const phase: EventPhase = useMemo(() => {
    if (!schedule) return "open";
    const start = new Date(schedule.start);
    const end = new Date(schedule.end);
    return getEventPhase(now, start, end);
  }, [now, schedule]);

  const lastUpdatedText = useMemo(() => {
    if (!lastUpdated) return "-";
    return lastUpdated.toLocaleTimeString("ko-KR", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [lastUpdated]);

  const templateBackgroundUrl = useMemo(
    () => `/display-templates/${displayStyle}/background.jpg`,
    [displayStyle]
  );

  const usePhotoBackground = backgroundMode === "photo" && mediaUrls && mediaUrls.length > 0;

  useEffect(() => {
    if (!usePhotoBackground || mediaUrls.length <= 1) {
      setCurrentSlide(0);
      return;
    }
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % mediaUrls.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(timer);
  }, [usePhotoBackground, mediaUrls]);

  const maxConcurrent = useMemo(() => (isPortrait ? 7 : 10), [isPortrait]);

  const getNextMessageToShow = () => {
    if (pendingQueueRef.current.length > 0) {
      const m = pendingQueueRef.current.shift()!;
      queuedSetRef.current.delete(m.id);
      return m;
    }
    if (allMessages.length === 0) return null;

    const start = replayCursorRef.current;

    for (let i = 0; i < allMessages.length; i++) {
      const idx = (start + i) % allMessages.length;
      const m = allMessages[idx];

      const alreadyActive = activeItemsRef.current.some((it) => it.msgId === m.id);
      if (!alreadyActive) {
        replayCursorRef.current = (idx + 1) % allMessages.length;
        return m;
      }
    }
    return null;
  };

  const pickPlacementX = (nowTs: number, durationMs: number, widthPct: number) => {
    const minX = isPortrait ? 8 : 6;
    const maxX = isPortrait ? 92 : 94;

    const startAt = nowTs;
    const endAt = nowTs + durationMs;

    const gap = isPortrait ? 3.0 : 2.2;

    const candidates: number[] = [];
    for (let i = 0; i < 18; i++) {
      candidates.push(minX + Math.random() * (maxX - minX));
    }

    let best = candidates[0];
    let bestScore = Number.POSITIVE_INFINITY;

    const actives = activeItemsRef.current;

    for (const x of candidates) {
      let score = 0;

      for (const it of actives) {
        const timeHit = overlapsInTime(startAt, endAt, it.startAt, it.endAt);
        if (!timeHit) continue;

        const xHit = overlapsInX(x, widthPct, it.xPct, it.widthPct, gap);

        if (xHit) score += 1000;
        else {
          const dist = Math.abs(x - it.xPct);
          score += clamp(40 - dist, 0, 40);
        }

        const age = nowTs - it.startAt;
        if (age < 2200) {
          const dist = Math.abs(x - it.xPct);
          score += clamp(26 - dist, 0, 26);
        }
      }

      if (score < bestScore) {
        bestScore = score;
        best = x;
      }
    }

    if (bestScore >= 1200) {
      return Math.random() < 0.5 ? minX + 4 : maxX - 4;
    }
    return best;
  };

  // ✅ 카드가 "사진영역 바닥"에서 출발하도록 계산
  const yStartPctForPhotoBottom = () => {
    // section 내부 기준(%). 100% = footer 바로 위 사진영역 바닥.
    // 완전히 바닥에서 튀어나오게 하려면 100~104% 정도가 자연스러움.
    const base = 100;
    const jitter = isPortrait ? 3 : 2;
    return base + Math.random() * jitter; // 100~103 (또는 100~102)
  };

  // spawn loop
  useEffect(() => {
    if (phase !== "open") {
      if (spawnTimerRef.current) {
        window.clearTimeout(spawnTimerRef.current);
        spawnTimerRef.current = null;
      }
      return;
    }

    const tick = () => {
      const backlog = pendingQueueRef.current.length;
      const interval = getSpawnIntervalMs(backlog, isPortrait);

      const nowTs = Date.now();
      const sinceLast = nowTs - lastSpawnAtRef.current;

      const actives = activeItemsRef.current;
      const densityGuard = actives.length >= Math.floor(maxConcurrent * 0.85) ? 220 : 0;

      const guardedInterval =
        sinceLast < 320 ? Math.max(interval, 520) + densityGuard : interval + densityGuard;

      setActiveItems((prev) => {
        if (prev.length >= maxConcurrent) return prev;

        const msg = getNextMessageToShow();
        if (!msg) return prev;

        shownSetRef.current.add(msg.id);

        const durationMs = estimateDurationMs(msg.body, isPortrait);
        const widthPct = estimateCardWidthPct(msg.body, msg.nickname, isPortrait);

        const yStart = yStartPctForPhotoBottom(); // ✅ 바닥에서 출발
        const x = pickPlacementX(nowTs, durationMs, widthPct);

        lastSpawnAtRef.current = nowTs;

        const key = `${nowTs}_${msg.id}`;

        return [
          ...prev,
          {
            key,
            msgId: msg.id,
            body: msg.body,
            nickname: msg.nickname,
            createdAt: msg.created_at,
            xPct: x,
            yStartPct: yStart,
            durationMs,
            startAt: nowTs,
            endAt: nowTs + durationMs,
            widthPct,
          },
        ];
      });

      spawnTimerRef.current = window.setTimeout(tick, guardedInterval);
    };

    spawnTimerRef.current = window.setTimeout(tick, 450);

    return () => {
      if (spawnTimerRef.current) {
        window.clearTimeout(spawnTimerRef.current);
        spawnTimerRef.current = null;
      }
    };
  }, [phase, allMessages, isPortrait, maxConcurrent]);

  // fonts
  const serifFont = `"Noto Serif KR", "Nanum Myeongjo", serif`;
  const scriptFont = `"Nanum Pen Script", cursive`;

  const titleStyle = {
    fontFamily: serifFont,
    fontSize: "clamp(28px, 3.2vw, 54px)",
    letterSpacing: "-0.02em",
  } as React.CSSProperties;

  // ✅ 신랑/신부 + 이름 더 키움
  const roleStyle = {
    fontSize: "clamp(20px, 2.2vw, 32px)",
  } as React.CSSProperties;

  const nameStyle = {
    fontSize: "clamp(40px, 4.0vw, 68px)",
    fontWeight: 900,
    letterSpacing: "-0.02em",
  } as React.CSSProperties;

  // ✅ 메시지 본문도 필기체로
  const bodyTextStyle = {
    fontFamily: scriptFont,
    fontSize: isPortrait ? "clamp(26px, 2.8vw, 48px)" : "clamp(22px, 2.2vw, 40px)",
    lineHeight: 1.16,
    letterSpacing: "-0.02em",
  } as React.CSSProperties;

  const nicknameStyle = {
    fontFamily: scriptFont,
    fontSize: isPortrait ? "clamp(22px, 2.2vw, 40px)" : "clamp(20px, 1.7vw, 34px)",
    lineHeight: 1.05,
  } as React.CSSProperties;

  const cardMaxWidth = isPortrait ? "min(86vw, 760px)" : "min(64vw, 760px)";

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <style>
        {`
          @keyframes floatUp {
            0%   { transform: translate(-50%, 0); opacity: 0; }
            10%  { opacity: 1; }
            90%  { opacity: 1; }
            100% { transform: translate(-50%, -120vh); opacity: 0; }
          }
        `}
      </style>

      <audio src="/bgm.m4a" autoPlay loop preload="auto" />

      <div className="relative min-h-screen flex flex-col">
        {/* TOP BAR */}
        <header className="relative w-full flex items-center justify-center px-4" style={{ height: TOP_BAR_HEIGHT }}>
          <div className="absolute inset-0 bg-black/35" />

          <div className="relative w-full max-w-6xl">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-[160px] text-right">
                {groomName ? (
                  <>
                    <p className="text-white/75 mb-1" style={roleStyle}>
                      신랑
                    </p>
                    <p className="text-white drop-shadow" style={nameStyle}>
                      {groomName}
                    </p>
                  </>
                ) : (
                  <div />
                )}
              </div>

              <div className="flex flex-col items-center">
                <p className="font-extrabold text-white drop-shadow text-center" style={titleStyle}>
                  축하의 마음 전하기
                </p>

                <div className="mt-2 w-[140px] h-[140px] md:w-[170px] md:h-[170px] bg-white/90 rounded-3xl flex items-center justify-center overflow-hidden shadow-lg">
                  <img src="/preic_qr.png" alt="축하 메세지 QR" className="w-full h-full object-contain" />
                </div>

                <div className="mt-2 text-center space-y-1 px-2">
                  <p className="font-extrabold text-white/95 drop-shadow" style={{ fontSize: "clamp(18px, 2.1vw, 34px)" }}>
                    {lowerMessage}
                  </p>
                  {dateText && (
                    <p className="text-white/70" style={{ fontSize: "clamp(12px, 1.2vw, 16px)" }}>
                      {dateText}
                    </p>
                  )}
                </div>
              </div>

              <div className="min-w-[160px] text-left">
                {brideName ? (
                  <>
                    <p className="text-white/75 mb-1" style={roleStyle}>
                      신부
                    </p>
                    <p className="text-white drop-shadow" style={nameStyle}>
                      {brideName}
                    </p>
                  </>
                ) : (
                  <div />
                )}
              </div>
            </div>
          </div>
        </header>

        {/* PHOTO/TEMPLATE AREA */}
        <section
          className="relative flex-1"
          style={{
            minHeight: `calc(100vh - ${TOP_BAR_HEIGHT} - ${FOOTER_HEIGHT_PX}px)`,
          }}
        >
          {/* Background */}
          {usePhotoBackground ? (
            <div className="absolute inset-0 overflow-hidden">
              {mediaUrls.map((url, index) => (
                <img
                  key={`${url}-${index}`}
                  src={url}
                  alt={`wedding-bg-${index}`}
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms] ease-in-out"
                  style={{
                    opacity: index === currentSlide ? 1 : 0,
                    objectPosition: isPortrait ? "50% 35%" : "50% 45%",
                  }}
                />
              ))}
              <div className="absolute inset-0 bg-black/28" />
              <div className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/55 via-black/18 to-transparent" />
            </div>
          ) : (
            <div
              className="absolute inset-0 bg-center bg-cover bg-no-repeat"
              style={{ backgroundImage: `url(${templateBackgroundUrl})` }}
            >
              <div className="absolute inset-0 bg-black/28" />
              <div className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/55 via-black/18 to-transparent" />
            </div>
          )}

          {/* Messages layer */}
          <div className="relative w-full h-full">
            {phase !== "open" ? (
              <div className="absolute inset-0 flex items-center justify-center px-6">
                <div
                  className="bg-black/40 text-white rounded-3xl px-10 py-8 text-center whitespace-pre-line leading-relaxed backdrop-blur-md border border-white/15"
                  style={{ fontSize: "clamp(20px, 2.4vw, 34px)" }}
                >
                  {phase === "before_wait"
                    ? "예식 1시간 전부터 축하 메세지 접수가 시작됩니다.\n잠시만 기다려주세요."
                    : phase === "closed"
                    ? "메시지 접수가 모두 종료되었습니다.\n축하해주셔서 감사합니다."
                    : "잠시 후 축하 메세지 접수가 시작됩니다."}
                </div>
              </div>
            ) : (
              <>
                {allMessages.length === 0 && activeItems.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center px-6">
                    <div
                      className="bg-black/35 text-white rounded-3xl px-10 py-8 text-center leading-relaxed backdrop-blur-md border border-white/15"
                      style={{ fontSize: "clamp(20px, 2.4vw, 34px)" }}
                    >
                      아직 등록된 축하메세지가 없습니다.
                      <br />
                      상단 QR을 찍고 첫 번째 메세지를 남겨주세요 ✨
                    </div>
                  </div>
                )}

                <div className="absolute inset-0">
                  {activeItems.map((it) => (
                    <div
                      key={it.key}
                      className="absolute rounded-[30px] text-center text-white border border-white/18 shadow-lg backdrop-blur-md"
                      style={{
                        left: `${it.xPct}%`,
                        top: `${it.yStartPct}%`, // ✅ section 바닥(사진영역 바닥)에서 시작
                        maxWidth: cardMaxWidth,
                        width: "fit-content",
                        padding: isPortrait ? "24px 28px" : "18px 24px",
                        backgroundColor: "rgba(0,0,0,0.26)",
                        transform: "translate(-50%, 0)",
                        animation: `floatUp ${it.durationMs}ms linear 0ms 1`,
                        boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
                      }}
                      onAnimationEnd={() => {
                        setActiveItems((prev) => prev.filter((x) => x.key !== it.key));
                      }}
                    >
                      <p className="whitespace-pre-wrap break-keep" style={bodyTextStyle}>
                        {it.body}
                      </p>

                      {it.nickname && (
                        <p className="mt-4 text-pink-200 drop-shadow" style={nicknameStyle}>
                          {it.nickname}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* FOOTER BAR */}
        <footer
          className="w-full flex items-center justify-between px-5 bg-black/70 text-white border-t border-white/10"
          style={{ height: `${FOOTER_HEIGHT_PX}px` }}
        >
          <div style={{ fontSize: "clamp(14px, 1.4vw, 20px)" }}>마지막 업데이트: {lastUpdatedText}</div>

          <div className="flex items-center gap-3" style={{ fontSize: "clamp(14px, 1.4vw, 20px)" }}>
            <img src="/instagram-logo.jpg" alt="Instagram" className="w-8 h-8 opacity-90" />
            <span className="font-semibold">@digital_guestbook</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
