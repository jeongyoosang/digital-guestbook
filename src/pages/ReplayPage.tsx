// src/pages/ReplayPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface RouteParams {
  eventId: string;
}

type MessageRow = {
  id: string;
  body: string;
  nickname: string | null;
  created_at: string;
};

const POLL_INTERVAL_MS = 5000;
const ROTATION_INTERVAL_MS = 5000;
const MAX_VISIBLE = 10;

export default function ReplayPage() {
  const { eventId } = useParams<RouteParams>();

  const [allMessages, setAllMessages] = useState<MessageRow[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<MessageRow[]>([]);

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

      if (error) {
        console.error("[Replay] fetchMessages error", error);
        return;
      }
      if (!data || cancelled) return;

      setAllMessages(data);
    }

    fetchMessages();
    const timer = setInterval(fetchMessages, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [eventId]);

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

  const slotPositions = useMemo(() => {
    return visibleMessages.map(() => {
      const top = 10 + Math.random() * 70;
      const left = 15 + Math.random() * 60;
      return { top: `${top}%`, left: `${left}%` };
    });
  }, [visibleMessages]);

  if (!eventId) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white">
        잘못된 접근입니다.
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-gradient-to-b from-pink-100 via-pink-50 to-white overflow-hidden">
      {/* 잔잔한 배경음악 (있으면 좋을 때) */}
      <audio src="/bgm.m4a" autoPlay loop preload="auto" />

      {/* 전체 화면 중앙 정렬 */}
      <div className="w-full h-full flex items-center justify-center px-4">
        {/* 유튜브 가로영상처럼 중앙에만 하나 크게 보이는 영역 */}
        <div className="relative w-full max-w-[900px] h-[90vh] bg-white/95 rounded-[32px] shadow-2xl border border-white/70 overflow-hidden">
          {/* 상단 타이틀 간단히 */}
          <div className="pt-4 pb-2 text-center">
            <p className="text-[11px] tracking-[0.25em] text-pink-400 font-semibold uppercase">
              WEDDING MESSAGES
            </p>
            <p className="mt-2 text-sm text-gray-500">
              하객 분들의 마음이 전해지고 있어요 💐
            </p>
          </div>

          {/* 메세지 애니메이션 영역 */}
          <div className="relative px-4 pb-6 pt-2 w-full h-[calc(100%-64px)] overflow-hidden">
            {visibleMessages.length === 0 && (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-sm md:text-lg text-gray-400 text-center">
                  아직 등록된 축하메세지가 없습니다.
                  <br />
                  예식장에서 보셨던 디지털 방명록 메세지가 이 화면에 재생됩니다 ✨
                </p>
              </div>
            )}

            <div className="relative w-full h-full">
              {visibleMessages.map((msg, index) => {
                const pos = slotPositions[index] || {
                  top: "50%",
                  left: "50%",
                };
                const delaySec = (index * 3) % 20;

                return (
                  <div
                    key={msg.id}
                    className="absolute max-w-md bg-white/95 rounded-3xl shadow-lg px-6 py-4
                               text-center text-gray-800 text-base md:text-xl leading-relaxed
                               animate-[fadeInOut_20s_ease-in-out_infinite]
                               border border-pink-50"
                    style={{
                      ...pos,
                      transform: "translate(-50%, -50%)",
                      animationDelay: `${delaySec}s`,
                    }}
                  >
                    <p className="whitespace-pre-wrap break-keep">
                      {msg.body}
                    </p>
                    {msg.nickname && (
                      <p className="mt-3 text-sm md:text-base text-pink-400 font-semibold">
                        {msg.nickname}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 개별 메시지용 페이드 인/아웃 애니메이션 정의 */}
      <style>
        {`
          @keyframes fadeInOut_20s_ease-in-out_infinite {
            0% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0.96);
            }
            10% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
            }
            90% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
            }
            100% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0.96);
            }
          }
        `}
      </style>
    </div>
  );
}
