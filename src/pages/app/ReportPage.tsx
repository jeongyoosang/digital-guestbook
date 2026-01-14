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
      {/* ✅ 상단 헤더 (ConfirmPage 톤과 통일) */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">리포트</h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">
            축하 메시지와 축의금 내역을 한 번에 확인하고 내려받을 수 있어요.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-2 text-sm border rounded-full bg-white hover:bg-gray-50"
            onClick={() => navigate(`/app/event/${safeEventId}`)}
          >
            이벤트 홈 →
          </button>

          <button
            type="button"
            className="px-3 py-2 text-sm border rounded-full bg-white hover:bg-gray-50"
            onClick={() => window.location.reload()}
            title="리포트 새로고침"
          >
            새로고침
          </button>
        </div>
      </div>

      {/* ✅ 기존 ResultPage 재사용 */}
      <ResultPage key={safeEventId} />
    </div>
  );
}
