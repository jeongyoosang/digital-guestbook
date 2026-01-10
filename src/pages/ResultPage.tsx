import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface RouteParams {
  eventId: string;
}

type MessageRow = {
  id: string;
  created_at: string;
  side: string | null;
  guest_name: string | null;
  nickname: string | null;
  relationship: string | null;
  body: string;
};

type Recipient = {
  name: string;
  role: string;
  contact: string;
};

type EventSettingsLite = {
  ceremony_date: string | null;
  recipients: Recipient[] | null;
};

const ROTATION_INTERVAL_MS = 5000;
const MAX_VISIBLE = 10;
const PAGE_SIZE = 10;

export default function ResultPage() {
  const { eventId } = useParams<RouteParams>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [settings, setSettings] = useState<EventSettingsLite | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [allReplayMessages, setAllReplayMessages] = useState<MessageRow[]>([]);
  const [visibleReplayMessages, setVisibleReplayMessages] =
    useState<MessageRow[]>([]);

  const [page, setPage] = useState(1);

  /* ------------------ 데이터 로드 ------------------ */
  useEffect(() => {
    if (!eventId) {
      setError("잘못된 접근입니다. 이벤트 정보가 없습니다.");
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: msgData, error: msgError } = await supabase
          .from("messages")
          .select(
            "id, created_at, side, guest_name, nickname, relationship, body"
          )
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });

        if (msgError) throw msgError;

        const list = msgData || [];
        setMessages(list);
        setAllReplayMessages(list);

        const { data: settingsData, error: setErrorRes } = await supabase
          .from("event_settings")
          .select("ceremony_date, recipients")
          .eq("event_id", eventId)
          .maybeSingle();

        if (setErrorRes) throw setErrorRes;

        if (settingsData) {
          setSettings({
            ceremony_date: settingsData.ceremony_date,
            recipients: settingsData.recipients as Recipient[] | null,
          });
        }
      } catch (err) {
        console.error(err);
        setError("결과를 불러오는 중 오류가 발생했어요.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [eventId]);

  /* ------------------ 리플레이 로직 ------------------ */
  useEffect(() => {
    const all = allReplayMessages;
    if (!all.length) {
      setVisibleReplayMessages([]);
      return;
    }

    if (all.length <= MAX_VISIBLE) {
      setVisibleReplayMessages(all);
      return;
    }

    let older = all.slice(0, -(MAX_VISIBLE - 1));
    let latestStable = all.slice(-(MAX_VISIBLE - 1));
    let rollingIndex = older.length - 1;

    setVisibleReplayMessages([older[rollingIndex], ...latestStable]);

    const interval = setInterval(() => {
      rollingIndex = (rollingIndex - 1 + older.length) % older.length;
      setVisibleReplayMessages([older[rollingIndex], ...latestStable]);
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [allReplayMessages]);

  /* ------------------ 계산 ------------------ */
  const slotPositions = useMemo(() => {
    return visibleReplayMessages.map(() => {
      const top = 18 + Math.random() * 50;
      const left = 10 + Math.random() * 60;
      return { top: `${top}%`, left: `${left}%` };
    });
  }, [visibleReplayMessages]);

  const totalCount = messages.length;
  const groomCount = messages.filter((m) => m.side === "groom").length;
  const brideCount = messages.filter((m) => m.side === "bride").length;

  const ceremonyDateText =
    settings?.ceremony_date &&
    (() => {
      const [y, m, d] = settings.ceremony_date.split("-");
      return `${y}년 ${Number(m)}월 ${Number(d)}일`;
    })();

  /* ------------------ 가드 ------------------ */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p>결과를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!eventId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p>잘못된 접근입니다.</p>
      </div>
    );
  }

  /* ------------------ UI ------------------ */
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-md p-6 md:p-8">

        {/* ✅ 상단 네비 */}
        <div className="mb-6 flex justify-between items-center">
          <button
            onClick={() => navigate(`/app/event/${eventId}`)}
            className="text-xs text-gray-500 hover:underline"
          >
            ← 이벤트 홈으로
          </button>

          <button
            onClick={() => navigate("/")}
            className="text-xs font-semibold tracking-tight"
          >
            DIGITAL GUESTBOOK
          </button>
        </div>

        {/* ===== 헤더 ===== */}
        <header className="mb-6 border-b pb-4">
          <h1 className="text-2xl font-semibold mb-1">디지털 방명록 결과</h1>
          {ceremonyDateText && (
            <p className="text-xs text-gray-400">{ceremonyDateText}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <span className="px-3 py-1 rounded-full bg-slate-100">
              전체 {totalCount}건
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100">
              신랑측 {groomCount}건
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100">
              신부측 {brideCount}건
            </span>
          </div>
        </header>

        {/* ===== 리플레이 영역 ===== */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-2">
            디지털 방명록 다시보기
          </h2>

          <div className="relative h-[240px] bg-slate-50 rounded-2xl overflow-hidden">
            {visibleReplayMessages.map((msg, idx) => {
              const pos = slotPositions[idx];
              return (
                <div
                  key={msg.id}
                  className="absolute max-w-sm bg-white rounded-2xl shadow px-4 py-3 text-sm"
                  style={{
                    ...pos,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <p>{msg.body}</p>
                  {msg.nickname && (
                    <p className="mt-2 text-xs text-gray-400">
                      {msg.nickname}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== 메시지 목록 ===== */}
        <section>
          <h2 className="text-sm font-semibold mb-3">축하 메시지 목록</h2>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {messages
              .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              .map((m, i) => (
                <div
                  key={m.id}
                  className="border rounded-xl px-4 py-3 bg-slate-50"
                >
                  <p className="text-sm">{m.body}</p>
                  <div className="mt-1 text-xs text-gray-400">
                    {m.nickname || m.guest_name || "익명"}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
