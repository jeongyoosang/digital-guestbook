// src/pages/DisplayPage.tsx
import { useEffect, useMemo, useState } from "react";
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

const POLL_INTERVAL_MS = 5000;
const ROTATION_INTERVAL_MS = 5000;
const MAX_VISIBLE = 10;

// display_style + smallwedding
type DisplayStyle = "basic" | "christmas" | "garden" | "luxury" | "smallwedding";

// 템플릿별 기본 배경 (커플 사진이 없을 때 쓰는 이미지들)
const TEMPLATE_BACKGROUNDS: Record<DisplayStyle, string[]> = {
  basic: ["/display-templates/basic/background.jpg"],
  christmas: ["/display-templates/christmas/background.jpg"],
  garden: ["/display-templates/garden/background.jpg"],
  luxury: ["/display-templates/luxury/background.jpg"],
  smallwedding: ["/display-templates/smallwedding/background.jpg"],
};

export default function DisplayPage() {
  const { eventId } = useParams<RouteParams>();

  const [allMessages, setAllMessages] = useState<MessageRow[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<MessageRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [lowerMessage, setLowerMessage] = useState(
    "친히 오셔서 축복해주셔서 감사합니다."
  );
  const [dateText, setDateText] = useState<string>("");

  const [groomName, setGroomName] = useState<string>("");
  const [brideName, setBrideName] = useState<string>("");

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  const [displayStyle, setDisplayStyle] = useState<DisplayStyle>("basic");

  // ✅ 새 컬럼들 상태
  const [backgroundMode, setBackgroundMode] = useState<"photo" | "template">(
    "template"
  );
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);

  // 배경 슬라이드 인덱스
  const [bgIndex, setBgIndex] = useState<number>(0);

  if (!eventId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-2xl text-gray-200">이벤트 ID가 없습니다.</p>
      </div>
    );
  }

  // now 1분마다 갱신
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // ✅ 메시지 폴링
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
    }

    fetchMessages();
    const timer = setInterval(fetchMessages, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [eventId]);

  // ✅ event_settings (날짜, 문구, display_style, background_mode, media_urls)
  useEffect(() => {
    let cancelled = false;

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("event_settings")
        .select(
          "lower_message, ceremony_date, ceremony_start_time, ceremony_end_time, display_style, background_mode, media_urls"
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
          dateStr && dateStr.length === 10
            ? dateStr
            : new Date().toISOString().slice(0, 10);

        setSchedule({
          start: `${baseDate}T${startTime}:00`,
          end: `${baseDate}T${endTime}:00`,
        });
      }

      // display_style
      if (data.display_style) {
        const value = data.display_style as DisplayStyle;
        if (
          ["basic", "christmas", "garden", "luxury", "smallwedding"].includes(
            value
          )
        ) {
          setDisplayStyle(value);
        } else {
          setDisplayStyle("basic");
        }
      } else {
        setDisplayStyle("basic");
      }

      // ✅ background_mode
      if (data.background_mode === "photo" || data.background_mode === "template") {
        setBackgroundMode(data.background_mode);
      } else {
        setBackgroundMode("template");
      }

      // ✅ media_urls
      if (Array.isArray(data.media_urls)) {
        setMediaUrls(data.media_urls.filter((u: string) => !!u));
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

  // ✅ events 테이블에서 신랑/신부 이름
  useEffect(() => {
    if (!eventId) return;
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

  // 예식 phase 계산
  const phase: EventPhase = useMemo(() => {
    if (!schedule) return "open";

    const start = new Date(schedule.start);
    const end = new Date(schedule.end);
    return getEventPhase(now, start, end);
  }, [now, schedule]);

  // 메시지 순환
  useEffect(() => {
    if (allMessages.length === 0) {
      setVisibleMessages([]);
      return;
    }

    if (allMessages.length <= MAX_VISIBLE) {
      setVisibleMessages(allMessages);
      return;
    }

    let older = allMessages.slice(0, -(MAX_VISIBLE - 1));
    let latestStable = allMessages.slice(-(MAX_VISIBLE - 1));

    let rollingIndex = older.length - 1;
    setVisibleMessages([older[rollingIndex], ...latestStable]);

    const interval = setInterval(() => {
      const current = [...allMessages];
      if (current.length <= MAX_VISIBLE) {
        setVisibleMessages(current);
        return;
      }

      older = current.slice(0, -(MAX_VISIBLE - 1));
      latestStable = current.slice(-(MAX_VISIBLE - 1));

      if (older.length === 0) {
        setVisibleMessages(current.slice(-MAX_VISIBLE));
        return;
      }

      rollingIndex = (rollingIndex - 1 + older.length) % older.length;
      const rollingMessage = older[rollingIndex];

      setVisibleMessages([rollingMessage, ...latestStable]);
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [allMessages]);

  const lastUpdatedText = useMemo(() => {
    if (!lastUpdated) return "-";
    return lastUpdated.toLocaleTimeString("ko-KR", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [lastUpdated]);

  const messageCount = allMessages.length;

  // 메시지 위치 (상단 박스 제외 25~85%)
  const slotPositions = useMemo(() => {
    return visibleMessages.map(() => {
      const top = 25 + Math.random() * 60;
      const left = 8 + Math.random() * 70;
      return { top: `${top}%`, left: `${left}%` };
    });
  }, [visibleMessages]);

  // ✅ 최종 배경 슬라이드 배열 결정
  const usePhotoMode =
    backgroundMode === "photo" && mediaUrls && mediaUrls.length > 0;

  const backgroundImages = useMemo(() => {
    if (usePhotoMode) return mediaUrls;

    return (
      TEMPLATE_BACKGROUNDS[displayStyle] ?? TEMPLATE_BACKGROUNDS["basic"]
    );
  }, [usePhotoMode, mediaUrls, displayStyle]);

  // 슬라이드 인덱스
  useEffect(() => {
    if (!backgroundImages || backgroundImages.length <= 1) return;

    const timer = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [backgroundImages]);

  const effectiveBackgroundUrl =
    backgroundImages[bgIndex] ?? backgroundImages[0];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundImage: `url(${effectiveBackgroundUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* 어두운 오버레이 */}
      <div className="min-h-screen flex flex-col bg-black/35">
        <style>
          {`
          @keyframes fadeInOutSingle {
            0% {
              opacity: 0;
              transform: scale(0.96);
            }
            15% {
              opacity: 1;
              transform: scale(1);
            }
            85% {
              opacity: 1;
              transform: scale(1);
            }
            100% {
              opacity: 0;
              transform: scale(0.96);
            }
          }
        `}
        </style>

        <audio src="/bgm.m4a" autoPlay loop preload="auto" />

        <main className="flex-1 flex flex-col items-center pt-4 pb-4 px-4">
          {/* 상단 QR + 신랑/신부 박스 (기존 유지) */}
          <div className="w-full max-w-4xl bg-white/95 rounded-[32px] shadow-xl border border-white/70 backdrop-blur px-6 md:px-10 pt-8 pb-6">
            <div className="text-center">
              <p className="text-4xl md:text-5xl font-extrabold text-gray-900">
                축하 메시지 전하기
              </p>
            </div>

            <div className="mt-6 flex items-center justify-center gap-10 md:gap-16">
              <div className="text-right min-w-[150px]">
                {groomName && (
                  <>
                    <p className="text-3xl md:text-4xl text-gray-500 mb-2">
                      신랑
                    </p>
                    <p className="text-5xl md:text-6xl font-extrabold text-gray-800">
                      {groomName}
                    </p>
                  </>
                )}
              </div>

              <div>
                <div className="w-[260px] h-[260px] md:w-[320px] md:h-[320px] bg-gray-50 rounded-[40px] flex items-center justify-center overflow-hidden shadow-inner">
                  <img
                    src="/preic_qr.png"
                    alt="축하 메세지 QR"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              <div className="text-left min-w-[150px]">
                {brideName && (
                  <>
                    <p className="text-3xl md:text-4xl text-gray-500 mb-2">
                      신부
                    </p>
                    <p className="text-5xl md:text-6xl font-extrabold text-gray-800">
                      {brideName}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="mt-5 text-center space-y-1">
              <p className="text-3xl md:text-4xl font-extrabold text-gray-700">
                {lowerMessage}
              </p>
              {dateText && (
                <p className="text-lg md:text-xl text-gray-400">{dateText}</p>
              )}
            </div>
          </div>

          {/* 하단 박스 제거 → 메시지가 배경 위에 떠다니는 영역 */}
          <div className="mt-6 w-full max-w-4xl flex-1 relative">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

            {phase !== "open" ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-2xl md:text-3xl text-gray-100 text-center whitespace-pre-line leading-relaxed drop-shadow-lg">
                  {phase === "before_wait"
                    ? "예식 1시간 전부터 축하 메세지 접수가 시작됩니다.\n잠시만 기다려주세요."
                    : "오늘 남겨진 모든 축하 메세지는\n신랑·신부에게 바로 전달됩니다.\n축하의 마음을 전해주셔서 감사합니다."}
                </p>
              </div>
            ) : visibleMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-2xl md:text-3xl text-gray-100 text-center leading-relaxed drop-shadow-lg">
                  아직 등록된 축하메세지가 없습니다.
                  <br />
                  상단 QR을 찍고 첫 번째 메세지를 남겨주세요 ✨
                </p>
              </div>
            ) : (
              <div className="relative h-full w-full">
                {visibleMessages.map((msg, index) => {
                  const pos =
                    slotPositions[index] || { top: "50%", left: "50%" };
                  const durationSec = 7;
                  const delaySec = Math.random() * 3;

                  return (
                    <div
                      key={msg.id}
                      className="absolute max-w-md bg-white/95 rounded-3xl shadow-lg px-8 py-6
                             text-center text-gray-800 text-2xl leading-relaxed
                             border border-pink-50"
                      style={{
                        ...pos,
                        animation: `fadeInOutSingle ${durationSec}s ease-in-out ${delaySec}s infinite`,
                      }}
                    >
                      <p className="whitespace-pre-wrap break-keep">
                        {msg.body}
                      </p>
                      {msg.nickname && (
                        <p className="mt-4 text-xl md:text-2xl text-pink-400 font-semibold">
                          {msg.nickname}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="absolute left-0 right-0 bottom-0 flex items-center justify-between text-lg md:text-xl text-gray-200 px-1 pb-1 drop-shadow">
              <span>메세지 개수: {messageCount}개</span>
              <span>마지막 업데이트: {lastUpdatedText}</span>
            </div>
          </div>

          <div className="mt-4 w-full max-w-4xl flex justify-end items-center gap-3 text-xl md:text-2xl text-gray-100 drop-shadow">
            <img
              src="/instagram-logo.jpg"
              alt="Instagram"
              className="w-10 h-10 opacity-90"
            />
            <span className="font-semibold">@digital_guestbook</span>
          </div>
        </main>
      </div>
    </div>
  );
}
