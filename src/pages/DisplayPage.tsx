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

// ✅ 상단 바 높이 (요청: 26 → 22)
const TOP_BAR_HEIGHT = "22vh";

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

  // 메시지 순환(현재 로직 유지)
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

  // ✅ 템플릿 배경 이미지 (template 모드일 때 사용)
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

  /**
   * ✅ 메시지 카드 랜덤 위치
   * - 사진/템플릿을 너무 가리지 않도록, 하단 영역 위주로 배치
   */
  const slotPositions = useMemo(() => {
    // top 52%~88%, left 6%~74%
    return visibleMessages.map(() => {
      const top = 52 + Math.random() * 36; // 52~88
      const left = 6 + Math.random() * 68; // 6~74
      return { top: `${top}%`, left: `${left}%` };
    });
  }, [visibleMessages]);

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* ✨ 메시지 애니메이션 키프레임 */}
      <style>
        {`
          @keyframes fadeInOutSingle {
            0% { opacity: 0; transform: scale(0.96); }
            15% { opacity: 1; transform: scale(1); }
            85% { opacity: 1; transform: scale(1); }
            100% { opacity: 0; transform: scale(0.96); }
          }
        `}
      </style>

      {/* 배경 음악 */}
      <audio src="/bgm.m4a" autoPlay loop preload="auto" />

      <div className="relative min-h-screen flex flex-col">
        {/* =======================
            TOP BAR (사진과 분리)
            ======================= */}
        <header
          className="relative w-full flex items-center justify-center px-4"
          style={{ height: TOP_BAR_HEIGHT }}
        >
          {/* 상단 바 배경(살짝 투명) */}
          <div className="absolute inset-0 bg-black/35" />

          <div className="relative w-full max-w-5xl">
            <div className="flex items-center justify-between gap-4">
              {/* 좌: 신랑 */}
              <div className="min-w-[160px] text-right">
                {groomName ? (
                  <>
                    <p className="text-xl md:text-2xl text-white/70 mb-1">
                      신랑
                    </p>
                    <p className="text-3xl md:text-4xl font-extrabold text-white">
                      {groomName}
                    </p>
                  </>
                ) : (
                  <div />
                )}
              </div>

              {/* 중앙: 타이틀 + QR */}
              <div className="flex flex-col items-center">
                {/* ✅ 요청: "축하 메시지 전하기" 더 크게 */}
                <p className="text-3xl md:text-4xl font-extrabold text-white drop-shadow">
                  축하 메시지 전하기
                </p>

                <div className="mt-3 w-[150px] h-[150px] md:w-[180px] md:h-[180px] bg-white/90 rounded-3xl flex items-center justify-center overflow-hidden shadow-lg">
                  <img
                    src="/preic_qr.png"
                    alt="축하 메세지 QR"
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="mt-3 text-center space-y-1">
                  {/* ✅ 요청: lowerMessage 더 크게 */}
                  <p className="text-2xl md:text-3xl font-extrabold text-white/95 drop-shadow">
                    {lowerMessage}
                  </p>
                  {dateText && (
                    <p className="text-sm md:text-base text-white/70">
                      {dateText}
                    </p>
                  )}
                </div>
              </div>

              {/* 우: 신부 */}
              <div className="min-w-[160px] text-left">
                {brideName ? (
                  <>
                    <p className="text-xl md:text-2xl text-white/70 mb-1">
                      신부
                    </p>
                    <p className="text-3xl md:text-4xl font-extrabold text-white">
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

        {/* =======================
            BOTTOM AREA (배경 + 메시지)
            ======================= */}
        <section className="relative flex-1">
          {/* 배경 */}
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
                    // 얼굴이 위쪽에 있는 웨딩 사진이 많아서 약간 위로 포커스
                    objectPosition: "50% 35%",
                  }}
                />
              ))}
              {/* 어두운 오버레이 */}
              <div className="absolute inset-0 bg-black/28" />
              {/* 하단 그라데이션 */}
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

          {/* 메시지 레이어 */}
          <div className="relative w-full h-full">
            {/* 상태 텍스트(오픈 전/종료) */}
            {phase !== "open" ? (
              <div className="absolute inset-0 flex items-center justify-center px-6">
                <div className="bg-black/40 text-white rounded-3xl px-10 py-8 text-2xl md:text-3xl text-center whitespace-pre-line leading-relaxed backdrop-blur-md border border-white/15">
                  {phase === "before_wait"
                    ? "예식 1시간 전부터 축하 메세지 접수가 시작됩니다.\n잠시만 기다려주세요."
                    : phase === "closed"
                    ? "메시지 접수가 모두 종료되었습니다.\n축하해주셔서 감사합니다."
                    : "잠시 후 축하 메세지 접수가 시작됩니다."}
                </div>
              </div>
            ) : (
              <>
                {/* 메시지 없음 */}
                {visibleMessages.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center px-6">
                    <div className="bg-black/35 text-white rounded-3xl px-10 py-8 text-2xl md:text-3xl text-center leading-relaxed backdrop-blur-md border border-white/15">
                      아직 등록된 축하메세지가 없습니다.
                      <br />
                      상단 QR을 찍고 첫 번째 메세지를 남겨주세요 ✨
                    </div>
                  </div>
                )}

                {/* 메시지 표시 */}
                {visibleMessages.length > 0 && (
                  <div className="absolute inset-0">
                    {visibleMessages.map((msg, index) => {
                      const pos =
                        slotPositions[index] || { top: "70%", left: "50%" };

                      const durationSec = 7;
                      const delaySec = Math.random() * 3;

                      return (
                        <div
                          key={msg.id}
                          className="absolute max-w-md rounded-3xl px-8 py-6 text-center
                                     text-white text-2xl leading-relaxed
                                     border border-white/20 shadow-lg
                                     backdrop-blur-md"
                          style={{
                            ...pos,
                            // ✅ 사진/템플릿을 더 보이게: 카드 투명도 확 낮춤
                            backgroundColor: "rgba(0,0,0,0.28)",
                            animation: `fadeInOutSingle ${durationSec}s ease-in-out ${delaySec}s infinite`,
                          }}
                        >
                          <p className="whitespace-pre-wrap break-keep">
                            {msg.body}
                          </p>
                          {msg.nickname && (
                            <p className="mt-4 text-xl md:text-2xl text-pink-200 font-semibold">
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

            {/* ✅ 요청: 마지막 업데이트는 하단 왼쪽 */}
            <div className="absolute bottom-4 left-4 bg-black/40 text-white rounded-full px-5 py-2 text-lg md:text-xl backdrop-blur-md border border-white/15">
              마지막 업데이트: {lastUpdatedText}
            </div>

            {/* ✅ 요청: 인스타는 하단 오른쪽 */}
            <div className="absolute bottom-4 right-4 flex items-center gap-3 text-lg md:text-xl text-white/90 drop-shadow">
              <img
                src="/instagram-logo.jpg"
                alt="Instagram"
                className="w-10 h-10 opacity-90"
              />
              <span className="font-semibold">@digital_guestbook</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
