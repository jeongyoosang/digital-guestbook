// src/pages/ResultPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface RouteParams {
  eventId: string;
}

/* --- 타입 정의 동일 --- */
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

  /* ------------------ 리플레이 로직 (기존 그대로) ------------------ */
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

        {/* ✅ 상단 네비 추가 */}
        <div className="mb-4 flex justify-between items-center">
          <button
            onClick={() => navigate("/app")}
            className="text-xs text-gray-500 hover:underline"
          >
            ← 이벤트 홈으로
          </button>

          <button
            onClick={() => navigate("/", { replace: false })}
            className="text-xs font-semibold"
          >
            DIGITAL GUESTBOOK
          </button>
        </div>

        {/* 이하 UI / 로직은 네가 준 코드 그대로 */}
        {/* (중략 – 메시지 리스트 / CSV / 리플레이 영역 동일) */}

      </div>
    </div>
  );
}
