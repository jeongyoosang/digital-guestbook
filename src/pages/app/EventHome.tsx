import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";

export default function EventHome() {
  const { eventId } = useParams<{ eventId: string }>();

  const safeEventId = useMemo(() => eventId || "", [eventId]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4">
        <div className="text-sm text-muted-foreground">Event ID</div>
        <div className="font-mono break-all">{safeEventId}</div>
      </div>

      <div className="grid gap-3">
        <Link
          to={`/app/event/${safeEventId}/settings`}
          className="rounded-xl border px-4 py-3 hover:bg-muted"
        >
          예식 설정(Confirm) 열기 →
        </Link>

        <Link
          to={`/result/${safeEventId}`}
          className="rounded-xl border px-4 py-3 hover:bg-muted"
        >
          결과 리포트(Result) 열기 →
        </Link>

        <Link
          to={`/replay/${safeEventId}`}
          className="rounded-xl border px-4 py-3 hover:bg-muted"
        >
          다시보기(Replay) 열기 →
        </Link>
      </div>

      <div className="text-xs text-muted-foreground">
        * 다음 단계에서 Result/Replay도 /app 내부로 이사합니다.
      </div>
    </div>
  );
}
