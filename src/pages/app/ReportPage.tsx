// src/pages/app/ReportPage.tsx
import { useNavigate, useParams } from "react-router-dom";
import ResultPage from "@/pages/ResultPage";

export default function ReportPage() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();

  if (!eventId) return null;

  return (
    <div className="space-y-4">
      {/* 상단 네비게이션 */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => navigate(`/app/event/${eventId}`)}
          className="text-sm text-gray-600 hover:text-black"
        >
          ← 이벤트 홈
        </button>
      </div>

      <ResultPage key={eventId} />
    </div>
  );
}
