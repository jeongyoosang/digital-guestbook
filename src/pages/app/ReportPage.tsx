// src/pages/app/ReportPage.tsx
import { useParams, Navigate } from "react-router-dom";
import ResultPage from "@/pages/ResultPage";

export default function ReportPage() {
  const { eventId } = useParams<{ eventId: string }>();

  // ✅ eventId 없으면 잘못된 접근 → 이벤트 홈으로
  if (!eventId) {
    return <Navigate to="/app" replace />;
  }

  // ✅ key 유지 (eventId 변경 시 완전 리마운트)
  return <ResultPage key={eventId} />;
}
