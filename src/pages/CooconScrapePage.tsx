import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

type PageState = "idle" | "loading" | "ready" | "error";

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export default function CooconScrapePage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const eventId = sp.get("eventId") || "";
  const mode = sp.get("mode") || "";
  const startDate = sp.get("startDate") || "";
  const endDate = sp.get("endDate") || "";
  const returnToRaw = sp.get("returnTo") || "";
  const returnTo = useMemo(() => safeDecode(returnToRaw), [returnToRaw]);

  const [state, setState] = useState<PageState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const pushLog = (m: string) => {
    const line = `${new Date().toLocaleTimeString()} ${m}`;
    setLogs((p) => [...p, line]);
    console.log("[COOCON]", m);
  };

  // ✅ 쿠콘 제공 트리 기준: public/coocon/css/은행_거래내역조회.html
  const iframeSrc = useMemo(() => {
    const bust = `${Date.now()}_${reloadKey}`;
    return `/coocon/css/은행_거래내역조회.html?bust=${encodeURIComponent(bust)}`;
  }, [reloadKey]);

  useEffect(() => {
    setState("loading");
    setErrorMsg(null);
    setLogs([]);

    if (!eventId) {
      setState("error");
      setErrorMsg("eventId 없음 (URL 파라미터 확인 필요)");
      return;
    }

    pushLog("쿠콘 iframe 모드로 실행 (쿠콘 제공 HTML이 인증/스크래핑 전담)");
    pushLog(`eventId=${eventId}`);
    if (mode) pushLog(`mode=${mode}`);

    if (startDate || endDate) {
      pushLog(`range param: ${startDate || "(none)"} ~ ${endDate || "(none)"}`);
      if ((startDate && !isYmd(startDate)) || (endDate && !isYmd(endDate))) {
        pushLog("⚠️ startDate/endDate 형식이 YYYY-MM-DD가 아님 (쿠콘 화면에서 직접 입력 권장)");
      }
    } else {
      pushLog("range param 없음 (쿠콘 화면에서 시작일/종료일 직접 입력)");
    }

    if (returnTo) pushLog(`returnTo=${returnTo}`);

    setState("ready");
  }, [eventId, mode, startDate, endDate, returnToRaw, returnTo, reloadKey]);

  const goBack = () => {
    const fallback = eventId ? `/app/event/${eventId}/report` : "/app";
    nav(returnTo || fallback);
  };

  const retryReloadIframe = () => {
    pushLog("다시 시도: iframe reload");
    setErrorMsg(null);
    setState("ready");
    setReloadKey((k) => k + 1);

    // same-origin(정적파일)이라면 동작, 아니어도 bust로 새로 로딩됨
    try {
      iframeRef.current?.contentWindow?.location.reload();
    } catch {}
  };

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#fff" }}>
      <div style={{ padding: 16, borderBottom: "1px solid #eee" }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>쿠콘 계좌 인증 / 스크래핑</div>
        <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>state: {state}</div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button
            onClick={goBack}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            리포트로 돌아가기
          </button>

          <button
            onClick={retryReloadIframe}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            다시 시도(iframe 새로고침)
          </button>
        </div>

        {errorMsg && (
          <div style={{ marginTop: 12, color: "crimson", fontSize: 13, whiteSpace: "pre-wrap" }}>
            {errorMsg}
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 12, color: "#999" }}>
          체크:
          <div>• 팝업 차단 해제</div>
          <div>• 로컬 보안모듈/프로그램(쿠콘/웹케시) 설치 여부</div>
          <div>• iframe 경로: /coocon/css/은행_거래내역조회.html</div>
        </div>
      </div>

      <div style={{ width: "100%", height: "calc(100vh - 220px)" }}>
        {state === "ready" ? (
          <iframe
            ref={iframeRef}
            title="coocon-scrape"
            src={iframeSrc}   // ✅ 절대 "src='{iframeSrc}'" 이런 식으로 쓰면 안 됨
            style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
            onLoad={() => pushLog("iframe loaded")}
            onError={() => {
              setState("error");
              setErrorMsg("iframe 로딩 실패 (vercel rewrite/public 경로 확인 필요)");
              pushLog("ERROR: iframe onError");
            }}
          />
        ) : (
          <div style={{ padding: 16 }}>{state === "loading" ? "로딩중..." : "오류 상태"}</div>
        )}
      </div>

      <div style={{ padding: 16, borderTop: "1px solid #eee" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>로그</div>
        <pre style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap" }}>{logs.join("\n")}</pre>
      </div>
    </div>
  );
}
