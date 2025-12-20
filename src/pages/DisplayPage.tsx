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

const POLL_INTERVAL_MS = 5000;
const SPAWN_INTERVAL_MS = 2500;
const MAX_VISIBLE = 4;

export default function DisplayPage() {
  const { eventId } = useParams<RouteParams>();
  const [allMessages, setAllMessages] = useState<MessageRow[]>([]);
  const [visible, setVisible] = useState<MessageRow[]>([]);
  const [now, setNow] = useState(new Date());
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  const pointerRef = useRef(0);

  // 안전 가드
  if (!eventId) {
    return <div className="min-h-screen bg-black" />;
  }

  /* 시간 */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  /* 메시지 폴링 */
  useEffect(() => {
    let cancel = false;

    async function fetchMessages() {
      const { data } = await supabase
        .from("messages")
        .select("id, body, nickname, created_at")
        .eq("event_id", eventId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: true });

      if (!data || cancel) return;
      setAllMessages(data);
    }

    fetchMessages();
    const t = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => {
      cancel = true;
      clearInterval(t);
    };
  }, [eventId]);

  /* 이벤트 시간 */
  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase
        .from("event_settings")
        .select("ceremony_date, ceremony_start_time, ceremony_end_time")
        .eq("event_id", eventId)
        .maybeSingle();

      if (!data) return;

      if (data.ceremony_date && data.ceremony_start_time && data.ceremony_end_time) {
        const base = data.ceremony_date;
        setSchedule({
          start: `${base}T${data.ceremony_start_time}:00`,
          end: `${base}T${data.ceremony_end_time}:00`,
        });
      }
    }
    fetchSettings();
  }, [eventId]);

  const phase: EventPhase = useMemo(() => {
    if (!schedule) return "open";
    return getEventPhase(now, new Date(schedule.start), new Date(schedule.end));
  }, [now, schedule]);

  /* 메시지 순환 스폰 */
  useEffect(() => {
    if (allMessages.length === 0) return;

    const spawn = () => {
      setVisible((prev) => {
        if (prev.length >= MAX_VISIBLE) return prev;

        const next = allMessages[pointerRef.current % allMessages.length];
        pointerRef.current += 1;

        return [...prev, next];
      });
    };

    // 최초 보장
    if (visible.length === 0) spawn();

    const t = setInterval(spawn, SPAWN_INTERVAL_MS);
    return () => clearInterval(t);
  }, [allMessages, visible.length]);

  /* 오래된 메시지 제거 (항상 최소 1개 유지) */
  useEffect(() => {
    if (visible.length <= 1) return;
    const t = setTimeout(() => {
      setVisible((prev) => prev.slice(1));
    }, 7000);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* 메시지 레이어 */}
      {phase === "open" && (
        <div className="absolute inset-0">
          {visible.map((msg) => {
            const left = 10 + Math.random() * 70;

            return (
              <div
                key={msg.id + Math.random()}
                className="absolute bottom-0 text-white text-5xl max-w-2xl px-10 py-8 rounded-3xl backdrop-blur-md border border-white/20"
                style={{
                  left: `${left}%`,
                  background: "rgba(0,0,0,0.35)",
                  animation: "riseUp 7s linear forwards",
                }}
              >
                <p className="font-display whitespace-pre-wrap break-keep">
                  {msg.body}
                </p>
                {msg.nickname && (
                  <p className="mt-4 text-3xl opacity-80 font-display">
                    {msg.nickname}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>
        {`
          @keyframes riseUp {
            from {
              transform: translateY(0);
              opacity: 0;
            }
            10% { opacity: 1; }
            to {
              transform: translateY(-120vh);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
}
