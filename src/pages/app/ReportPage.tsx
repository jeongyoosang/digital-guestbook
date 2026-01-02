// src/pages/app/ReportPage.tsx
import { useParams } from "react-router-dom";
import ResultPage from "@/pages/ResultPage";

export default function ReportPage() {
  const { eventId } = useParams<{ eventId: string }>();

  // ResultPage가 /result/:eventId 기준으로 이미 params를 읽는 구조면
  // 그대로 렌더해도 잘 동작함.
  // (만약 ResultPage가 useParams를 쓰면 eventId가 동일하게 들어가므로 OK)
  return <ResultPage key={eventId} />;
}
