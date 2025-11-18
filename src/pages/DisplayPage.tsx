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

type Recipient = {
  name: string;
  role: string;
  contact: string;
};

type Schedule = {
  start: string;
  end: string;
};

const POLL_INTERVAL_MS = 5000;
const ROTATION_INTERVAL_MS = 5000;
const MAX_VISIBLE = 10;

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

  if (!eventId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-100 via-pink-50 to-white">
        <p className="text-sm text-gray-500">이벤트 ID가 없습니다.</p>
      </div>
    );
  }

  // now 1분마다 갱신
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // 메시지 폴링
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

  // event_settings에서 설정값/예식시간 가져오기
  useEffect(() => {
    let cancelled = false;

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("event_settings")
        .select(
          "lower_message, ceremony_date, recipients, ceremony_start_time, ceremony_end_time"
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

      if (Array.isArray(data.recipients)) {
        const recipients = data.recipients as Recipient[];
        const groom = recipients.find((r) => r.role?.includes("신랑"));
        const bride = recipients.find((r) => r.role?.includes("신부"));

        if (groom?.name) setGroomName(groom.name);
        if (bride?.name) setBrideName(bride.name);
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
    };

    fetchSettings();
    const timer = setInterval(fetchSettings, 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
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

  // 말풍선 위치
  const slotPositions = useMemo(() => {
    return visibleMessages.map(() => {
      const top = 8 + Math.random() * 60; // 더 위에서부터 시작
      const left = 10 + Math.random() * 60;
      return { top: `${top}%`, left: `${left}%` };
    });
  }, [visibleMessages]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-pink-100 via-pink-50 to-white">
      <div className="flex-1 flex flex-col items-center px-4 py-4">
        <div className="w-full max-w-4xl flex flex-col gap-4">
          {/* 상단 QR 섹션 : 화면 위쪽 1/3 근처 */}
          <section className="bg-white/95 rounded-[32px] shadow-xl border border-white/70 backdrop-blur px-6 py-5 md:px-10 md:py-6">
            <div className="text-center mb-4">
              <p className="text-base md:text-lg font-semibold text-gray-900">
                축하 메시지 전하기
              </p>
            </div>

            <div className="flex items-center justify-center gap-8 md:gap-16">
              <div className="text-right min-w-[90px]">
                {groomName && (
                  <>
                    <p className="text-xs md:text-sm text-gray-500 mb-1">
                      신랑
                    </p>
                    <p className="text-sm md:text-base font-medium text-gray-800">
                      {groomName}
                    </p>
                  </>
                )}
              </div>

              <div>
                <div className="w-[140px] h-[180px] md:w-[170px] md:h-[210px] bg-gray-50 rounded-3xl flex items-center justify-center overflow-hidden shadow-inner">
                  <img
                    src="/preic_qr.png"
                    alt="축하 메세지 QR"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              <div className="text-left min-w-[90px]">
                {brideName && (
                  <>
                    <p className="text-xs md:text-sm text-gray-500 mb-1">
                      신부
                    </p>
                    <p className="text-sm md:text-base font-medium text-gray-800">
                      {brideName}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="mt-3 text-center space-y-1">
              <p className="text-xs md:text-sm text-gray-500">{lowerMessage}</p>
              {dateText && (
                <p className="text-[11px] text-gray-400">{dateText}</p>
              )}
            </div>
          </section>

          {/* 하단 메시지 섹션 : 세로 3/4 이상 사용 */}
          <section className="flex-1 bg-white/95 rounded-[32px] shadow-xl border border-white/70 backdrop-blur px-6 py-5 md:px-10 md:py-6 overflow-hidden">
            <div className="text-center mb-4">
              <p className="text-[11px] tracking-[0.25em] text-pink-400 font-semibold uppercase">
                WEDDING MESSAGES
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {phase === "before_wait"
                  ? "잠시 후 축하 메세지 접수가 시작됩니다."
                  : phase === "closed"
                  ? "메시지 접수가 모두 종료되었습니다."
                  : "하객 분들의 마음이 전해지고 있어요 💐"}
              </p>
            </div>

            <div className="relative w-full h-[420px] md:h-[520px]">
              {phase !== "open" ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-500 text-center whitespace-pre-line">
                    {phase === "before_wait"
                      ? "예식 1시간 전부터 축하 메세지 접수가 시작됩니다.\n잠시만 기다려주세요."
                      : "오늘 남겨진 모든 축하 메세지는\n신랑·신부에게 바로 전달됩니다.\n축하의 마음을 전해주셔서 감사합니다."}
                  </p>
                </div>
              ) : visibleMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-400 text-center">
                    아직 등록된 축하메세지가 없습니다.
                    <br />
                    위쪽 QR을 찍고 첫 번째 메세지를 남겨주세요 ✨
                  </p>
                </div>
              ) : (
                <>
                  {visibleMessages.map((msg, index) => {
                    const pos =
                      slotPositions[index] || { top: "50%", left: "50%" };
                    const delaySec = (index * 3) % 20;

                    return (
                      <div
                        key={msg.id}
                        className="absolute max-w-sm bg-white/90 rounded-3xl shadow-lg px-6 py-4
                          text-center text-gray-800 text-sm leading-relaxed
                          animate-[fadeInOut_20s_ease-in-out_infinite]
                          border border-pink-50"
                        style={{
                          ...pos,
                          animationDelay: `${delaySec}s`,
                        }}
                      >
                        <p className="whitespace-pre-wrap break-keep">
                          {msg.body}
                        </p>
                        {msg.nickname && (
                          <p className="mt-3 text-xs text-pink-400 font-medium">
                            {msg.nickname}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px] text-gray-400">
              <span>메세지 개수: {messageCount}개</span>
              <span>마지막 업데이트: {lastUpdatedText}</span>
            </div>
          </section>

          {/* 인스타그램 크레딧 */}
          <div className="flex justify-end items-center gap-1 text-[11px] text-gray-400 pr-1 pb-1">
            <img
              src="/instagram-logo.jpg"
              alt="Instagram"
              className="w-4 h-4 opacity-70"
            />
            <span>@digital_guestbook</span>
          </div>
        </div>
      </div>
    </div>
  );
}
