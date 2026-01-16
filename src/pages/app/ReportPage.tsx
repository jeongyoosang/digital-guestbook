// src/pages/app/ReportPage.tsx
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ResultPage from "@/pages/ResultPage";

export default function ReportPage() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();

  const safeEventId = useMemo(() => eventId?.trim() ?? "", [eventId]);
  if (!safeEventId) return null;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">리포트</h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">
            축하 메시지와 축의금 내역을 한 번에 확인하고 내려받을 수 있어요.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="text-xs md:text-sm text-gray-500 underline underline-offset-4 hover:text-gray-900 whitespace-nowrap"
          >
            이벤트 홈
          </button>

          <button
            type="button"
            onClick={() => navigate(`/app/event/${safeEventId}/settings`)}
            className="text-xs md:text-sm text-gray-500 underline underline-offset-4 hover:text-gray-900 whitespace-nowrap"
          >
            예식 설정
          </button>
        </div>
      </div>

      <ResultPage key={safeEventId} />
    </div>
  );
}
