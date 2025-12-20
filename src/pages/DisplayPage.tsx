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

const POLL_INTERVAL = 5000;
const MESSAGE_DURATION = 9000; // 한 메시지 생존 시간(ms)
const MAX_VISIBLE = 4;

export default function DisplayPage() {
  const { eventId } = useParams<RouteParams>();
  const [allMessages, setAllMessages] = useState<MessageRow[]>([]);
  const [activeMessages, setActiveMessages] = useState<MessageRow[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [now, setNow] = useState(new Date());

  const cursorRef = useRef(0);
  const queueRef = useRef<MessageRow[]>([]);

  /* 시간 갱신 */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  /* 메시지 polling */
  useEffect(() => {
    if (!eventId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, body, nickname, created_at")
        .eq("event_id", eventId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: true });

      if (data) {
        setAllMessages(data);
        queueRef.current = data;
      }
    };

    fetchMessages();
    const t = setInterval(fetchMessages, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [eventId]);

  /* event_settings */
  useEffect(() => {
    if (!eventId) return;

    const fetchSettings = async () => {
      const { data } = await supabase
        .from("event_settings")
        .select("ceremony_date, ceremony_start_time, ceremony_end_time")
        .eq("event_id", eventId)
        .maybeSingle();

      if (data?.ceremony_date && data.ceremony_start_time && data.ceremony_end_time) {
        setSchedule({
          start: `${data.ceremony_date}T${data.ceremony_start_time}:00`,
          end: `${data.ceremony_date}T${data.ceremony_end_time}:00`,
        });
      }
    };

    fetchSettings();
  }, [eventId]);

  const phase: EventPhase = useMemo(() => {
    if (!schedule) return "open";
    return getEventPhase(now, new Date(schedule.start), new Date(schedule.end));
  }, [now, schedule]);

  /* 동시 출력 개수 계산 */
  const visibleCount = useMemo(() => {
    const total = allMessages.length;
    if (total < 10) return 1;
    if (total < 25) return 2;
    if (total < 50) return 3;
    return MAX_VISIBLE;
  }, [allMessages.length]);

  /* 메시지 순환 엔진 */
  useEffect(() => {
    if (phase !== "open" || queueRef.current.length === 0) return;

    const spawn = () => {
      setActiveMessages((prev) => {
        const next = [...prev];

        while (next.length < visibleCount) {
          const msg = queueRef.current[cursorRef.current];
          cursorRef.current =
            (cursorRef.current + 1) % queueRef.current.length;
          next.push(msg);
        }
        return next;
      });
    };

    spawn();
    const t = setInterval(spawn, MESSAGE_DURATION / 2);
    return () => clearInterval(t);
  }, [phase, visibleCount]);

  /* 메시지 자동 제거 */
  useEffect(() => {
    if (activeMessages.length === 0) return;

    const t = setTimeout(() => {
      setActiveMessages((prev) => prev.slice(1));
    }, MESSAGE_DURATION);

    return () => clearTimeout(t);
  }, [activeMessages]);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      <style>
        {`
        @keyframes floatUp {
          from {
            transform: translateY(0);
            opacity: 0;
          }
          10% { opacity: 1; }
          to {
            transform: translateY(-120vh);
            opacity: 0;
          }
        }
        `}
      </style>

      {/* 메시지 레이어 */}
      {phase === "open" &&
        activeMessages.map((msg, idx) => {
          const left = 10 + Math.random() * 60;
          return (
            <div
              key={`${msg.id}-${idx}`}
              className="absolute bottom-0 max-w-2xl px-10 py-8 rounded-[32px]
                         bg-black/30 backdrop-blur-md border border-white/20
                         text-white text-5xl leading-tight text-center"
              style={{
                left: `${left}%`,
                animation: `floatUp ${MESSAGE_DURATION}ms linear`,
              }}
            >
              <p className="whitespace-pre-wrap">{msg.body}</p>
              {msg.nickname && (
                <p className="mt-6 text-4xl text-pink-200 font-semibold">
                  {msg.nickname}
                </p>
              )}
            </div>
          );
        })}
    </div>
  );
}
