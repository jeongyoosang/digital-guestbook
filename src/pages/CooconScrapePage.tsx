// src/pages/CooconScrapePage.tsx
import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function CooconScrapePage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const eventId = sp.get("eventId");
  const mode = sp.get("mode") || "connect_then_scrape";
  const startDate = sp.get("startDate");
  const endDate = sp.get("endDate");
  const returnToRaw = sp.get("returnTo");

  const returnTo = returnToRaw
    ? decodeURIComponent(returnToRaw)
    : eventId
    ? `/app/event/${eventId}/report`
    : "/app";

  useEffect(() => {
    if (!eventId || !startDate || !endDate) {
      alert("필수 파라미터가 없습니다.");
      nav("/app");
      return;
    }

    // ✅ 쿠콘 전용 HTML을 새 창으로 연다 (정석)
    const url =
      `/coocon/css/은행_거래내역조회.html` +
      `?eventId=${eventId}` +
      `&mode=${mode}` +
      `&startDate=${startDate}` +
      `&endDate=${endDate}` +
      `&returnTo=${encodeURIComponent(returnTo)}`;

    const win = window.open(
      url,
      "_blank",
      "width=1200,height=900,resizable=yes,scrollbars=yes"
    );

    if (!win) {
      alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
      nav(returnTo);
      return;
    }

    // 이 페이지에서는 대기만
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>쿠콘 계좌 인증 / 거래내역 조회</h1>
      <p>인증 창이 열리지 않으면 팝업 차단을 해제해주세요.</p>
    </div>
  );
}
