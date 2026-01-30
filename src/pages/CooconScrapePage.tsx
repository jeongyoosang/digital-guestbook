import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/**
 * CooconScrapePage (iframe 방식)
 *
 * - 은행_거래내역조회.html 은 절대 수정하지 않음
 * - iframe 으로 로드
 * - 쿠콘 결과는 window.postMessage 로 수신
 */

type State = "idle" | "loading" | "scraping" | "done" | "error";

export default function CooconScrapePage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const eventId = sp.get("eventId")!;
  const startDate = sp.get("startDate")!;
  const endDate = sp.get("endDate")!;
  const returnTo = sp.get("returnTo") || `/app/event/${eventId}/report`;

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [state, setState] = useState<State>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pushLog = (msg: string) => {
    const line = `${new Date().toLocaleTimeString()} ${msg}`;
    setLog((p) => [...p, line]);
    console.log("[COOCON]", msg);
  };

  /* ===============================
   * postMessage 수신
   * =============================== */
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data) return;

      // 쿠콘 HTML에서 보내는 payload 가정
      // { type: "COOCON_RESULT", payload: {...} }
      if (e.data.type !== "COOCON_RESULT") return;

      pushLog("쿠콘 결과 수신");
      setState("scraping");

      handleScrapeResult(e.data.payload).catch((err) => {
        console.error(err);
        setErrorMsg(err.message || String(err));
        setState("error");
      });
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  /* ===============================
   * iframe 로드 시작
   * =============================== */
  useEffect(() => {
    if (!eventId || !startDate || !endDate) {
      setErrorMsg("필수 파라미터 누락");
      setState("error");
      return;
    }

    setState("loading");
    pushLog("쿠콘 iframe 로딩");

    // iframe src 세팅
    const qs = new URLSearchParams({
      eventId,
      startDate,
      endDate,
    });

    if (iframeRef.current) {
      iframeRef.current.src = `/coocon/은행_거래내역조회.html?${qs.toString()}`;
    }
  }, [eventId, startDate, endDate]);

  /* ===============================
   * Edge Function 호출
   * =============================== */
  async function handleScrapeResult(cooconOutput: any) {
    pushLog("Edge Function 호출");

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("로그인 필요");

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coocon-scrape-transactions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          startDate,
          endDate,
          cooconOutput,
        }),
      }
    );

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Edge Function 실패: ${t}`);
    }

    pushLog("스크래핑 저장 완료");
    setState("done");

    nav(returnTo);
  }

  /* ===============================
   * UI
   * =============================== */
  return (
    <div style={{ padding: 16 }}>
      <h1>쿠콘 계좌 인증 / 스크래핑</h1>
      <div style={{ marginBottom: 8 }}>state: {state}</div>

      {errorMsg && (
        <div style={{ color: "red", marginBottom: 12 }}>
          {errorMsg}
          <div>
            <button onClick={() => window.location.reload()}>
              다시 시도
            </button>
          </div>
        </div>
      )}

      {/* 쿠콘 전용 iframe */}
      <iframe
        ref={iframeRef}
        title="coocon-scrape"
        style={{
          width: "100%",
          height: "80vh",
          border: "none",
          background: "#fff",
        }}
      />

      <pre
        style={{
          marginTop: 12,
          fontSize: 12,
          whiteSpace: "pre-wrap",
          background: "#f8f8f8",
          padding: 8,
        }}
      >
        {log.join("\n")}
      </pre>
    </div>
  );
}
