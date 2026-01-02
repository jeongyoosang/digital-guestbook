// src/pages/app/EventHome.tsx
import { Link, useParams } from "react-router-dom";

export default function EventHome() {
  const { eventId } = useParams<{ eventId: string }>();

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">이벤트 홈</h1>
      <p className="text-sm text-muted-foreground">
        IA 1단계: /app 구조만 만든 상태야. (Confirm/Result는 다음 단계에서 옮김)
      </p>

      <div className="rounded-2xl border p-4 space-y-2">
        <div className="text-sm">
          eventId: <span className="font-mono">{eventId}</span>
        </div>

        {/* 임시로 기존 페이지로 연결 */}
        {eventId && (
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-xl border px-3 py-1.5 text-sm" to={`/confirm/${eventId}`}>
              기존 Confirm로 이동
            </Link>
            <Link className="rounded-xl border px-3 py-1.5 text-sm" to={`/result/${eventId}`}>
              기존 Result로 이동
            </Link>
            <Link className="rounded-xl border px-3 py-1.5 text-sm" to={`/replay/${eventId}`}>
              기존 Replay로 이동
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
