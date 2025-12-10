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

// display_style 타입
type DisplayStyle = "basic" | "christmas" | "garden" | "luxury";

// background_mode 타입
type BackgroundMode = "photo" | "template";

const POLL_INTERVAL_MS = 5000;
const ROTATION_INTERVAL_MS = 5000;
const MAX_VISIBLE = 10;

// 사진 슬라이드 한 장당 노출 시간
const SLIDE_DURATION_MS = 6000;

export default function DisplayPage() {
  const { eventId } = useParams<RouteParams>();

  const [allMessages, setAllMessages] = useState<MessageRow[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<MessageRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [lowerMessage, setLowerMessage] = useState(
    "친히 오셔서 축복해주셔서 감사합니다."
  );
  const [dateText, setDateText] = useState<string>("");

  // ✅ 신랑 / 신부 이름
  const [groomName, setGroomName] = useState<string>("");
  const [brideName, setBrideName] = useState<string>("");

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  // ✅ ConfirmPage에서 저장한 display_style
  const [displayStyle, setDisplayStyle] = useState<DisplayStyle>("basic");

  // ✅ 배경 모드 / 사진 URL 배열
  const [backgroundMode, setBackgroundMode] =
    useState<BackgroundMode>("template");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

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
          dateStr && dateStr.length === 10
            ? dateStr
            : new Date().toISOString().slice(0, 10);

        setSchedule({
          start: `${baseDate}T${startTime}:00`,
          end: `${baseDate}T${endTime}:00`,
        });
      }

      // ✅ display_style 상태 반영
      if (data.display_style) {
        const value = data.display_style as DisplayStyle;
        if (["basic", "christmas", "garden", "luxury"].includes(value)) {
          setDisplayStyle(value);
        } else {
          setDisplayStyle("basic");
        }
      } else {
        setDisplayStyle("basic");
      }

      // ✅ background_mode / media_urls 상태 반영
      const mode = data.background_mode as BackgroundMode | null;
      if (mode === "photo" || mode === "template") {
        setBackgroundMode(mode);
      } else {
        setBackgroundMode("template");
      }

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

  // ✅ events 테이블에서 신랑/신부 이름 가져오기
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

  // phase 계산
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

  const slotPositions = useMemo(() => {
    return visibleMessages.map(() => {
      const top = 5 + Math.random() * 80;
      const left = 5 + Math.random() * 70;
      return { top: `${top}%`, left: `${left}%` };
    });
  }, [visibleMessages]);

  // ✅ 템플릿 배경 이미지 (background_mode = template 일 때 사용)
  const templateBackgroundUrl = useMemo(
    () => `/display-templates/${displayStyle}/background.jpg`,
    [displayStyle]
  );

  // ✅ 실제로 사진 슬라이드를 사용할지 결정
  const usePhotoBackground =
    backgroundMode === "photo" && mediaUrls && mediaUrls.length > 0;

  // ✅ 사진 슬라이드 인덱스 순환
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

  return (
    <div className="relative min-h-screen bg-black">
      {/* 📷 배경: 사진 슬라이드 (photo 모드일 때만) */}
      {usePhotoBackground && (
        <div className="absolute inset-0 overflow-hidden">
          {mediaUrls.map((url, index) => (
            <img
              key={`${url}-${index}`}
              src={url}
              alt={`wedding-bg-${index}`}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms] ease-in-out"
              style={{
                opacity: index === currentSlide ? 1 : 0,
              }}
            />
          ))}
          {/* 어두운 오버레이 */}
          <div className="absolute inset-0 bg-black/35" />
        </div>
      )}

      {/* 템플릿 배경 (template 모드일 때만) */}
      {!usePhotoBackground && (
        <div
          className="absolute inset-0 bg-center bg-cover bg-no-repeat"
          style={{
            backgroundImage: `url(${templateBackgroundUrl})`,
          }}
        >
          <div className="absolute inset-0 bg-black/35" />
        </div>
      )}

      {/* 메인 컨텐츠(항상 최상단) */}
      <div className="relative min-h-screen flex flex-col">
        {/* ✨ 메시지 애니메이션 키프레임 */}
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

        {/* 배경 음악 */}
        <audio src="/bgm.m4a" autoPlay loop preload="auto" />

        <main className="flex-1 flex flex-col items-center pt-4 pb-4 px-4">
          {/* QR + 신랑/신부 */}
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

          {/* 메시지 블럭 */}
          <div className="mt-6 w-full max-w-4xl bg-white/95 rounded-[32px] shadow-xl border border-white/70 backdrop-blur flex-1 flex flex-col min-h-[520px]">
            <div className="pt-6 pb-4 text-center">
              <p className="text-sm md:text-base tracking-[0.35em] text-pink-400 font-semibold uppercase">
                WEDDING MESSAGES
              </p>
              <p className="mt-3 text-2xl md:text-3xl text-gray-600">
                {phase === "before_wait"
                  ? "잠시 후 축하 메세지 접수가 시작됩니다."
                  : phase === "closed"
                  ? "메시지 접수가 모두 종료되었습니다."
                  : "하객 분들의 마음이 전해지고 있어요 💐"}
              </p>
            </div>

            <div className="px-6 md:px-10 pb-6 pt-2 flex-1 flex flex-col">
              {phase !== "open" ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-2xl md:text-3xl text-gray-500 text-center whitespace-pre-line leading-relaxed">
                    {phase === "before_wait"
                      ? "예식 1시간 전부터 축하 메세지 접수가 시작됩니다.\n잠시만 기다려주세요."
                      : "오늘 남겨진 모든 축하 메세지는\n신랑·신부에게 바로 전달됩니다.\n축하의 마음을 전해주셔서 감사합니다."}
                  </p>
                </div>
              ) : (
                <>
                  {visibleMessages.length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-2xl md:text-3xl text-gray-400 text-center leading-relaxed">
                        아직 등록된 축하메세지가 없습니다.
                        <br />
                        상단 QR을 찍고 첫 번째 메세지를 남겨주세요 ✨
                      </p>
                    </div>
                  )}

                  {visibleMessages.length > 0 && (
                    <div className="relative flex-1">
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
                </>
              )}

              <div className="mt-4 flex items-center justify-between text-lg md:text-xl text-gray-400">
                <span>메세지 개수: {messageCount}개</span>
                <span>마지막 업데이트: {lastUpdatedText}</span>
              </div>
            </div>
          </div>

          {/* 인스타그램 홍보 */}
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
