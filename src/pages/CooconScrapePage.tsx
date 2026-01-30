// src/pages/CooconScrapePage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

/**
 * ✅ 원칙
 * - public/coocon/* (쿠콘 제공 파일 트리) 절대 안 건드림
 * - React에서 script/css 로딩/ nx.init/ makeCertManager 호출 ❌ (전부 쿠콘 html이 담당)
 * - React는 iframe으로 public/coocon/css/은행_거래내역조회.html만 띄움 ✅
 *
 * ✅ 여기서 하는 것
 * - eventId/returnTo/startDate/endDate 파라미터 검증
 * - 화면 상태/로그 출력
 * - 필요 시 캐시 무력화용 bust 파라미터 추가
 * - “나가기(리포트로)” 버튼
 * - “다시 시도(iframe reload)” 버튼
 *
 * ⚠️ 스크래핑 결과를 DB에 넣는 postMessage 연동은 ‘iframe 화면이 정상 동작’ 확인 후 Step2로 붙인다.
 */

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

  // ---------- query params ----------
  const eventId = sp.get("eventId") || "";
  const returnToRaw = sp.get("returnTo") || "";
  const returnTo = useMemo(() => safeDecode(returnToRaw), [returnToRaw]);

  // start/end는 “쿠콘 화면에서 입력할 수도” 있어서 필수 강제 X
  // 파라미터로 들어오면 형식 검증만 하고 로그만 찍음
  const startDate = sp.get("startDate") || "";
  const endDate = sp.get("endDate") || "";

  // 모드값은 지금 단계에서 iframe 동작 확인용 (기능 분기 X)
  const mode = sp.get("mode") || "";

  // ---------- state ----------
  const [state, setState] = useState<PageState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const pushLog = (m: string) => {
    const line = `${new Date().toLocaleTimeString()} ${m}`;
    setLogs((p) => [...p, line]);
    // eslint-disable-next-line no-console
    console.log("[COOCON]", m);
  };

  // ---------- computed ----------
  const iframeSrc = useMemo(() => {
    // ✅ 쿠콘 제공 트리 기준: public/coocon/css/은행_거래내역조회.html
    // 캐시 꼬임 방지용 bust
    const bust = `${Date.now()}_${reloadKey}`;

    // 필요하면 eventId/start/end/returnTo 등을 html에 넘길 수도 있지만,
    // 지금 Step1 목표는 "iframe이 정상 뜨는지" 확인이므로 bust만 붙임.
    return `/coocon/css/은행_거래내역조회.html?bust=${encodeURIComponent(bust)}`;
  }, [reloadKey]);

  // ---------- lifecycle ----------
  useEffect(() => {
    try {
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
    } catch (e: any) {
      setState("error");
      setErrorMsg(e?.message || String(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, returnToRaw, startDate, endDate, mode, reloadKey]);

  // ---------- actions ----------
  const goBack = () => {
    const fallback = eventId ? `/app/event/${eventId}/report` : "/app";
    nav(returnTo || fallback);
  };

  const retryReloadIframe = () => {
    pushLog("다시 시도: iframe reload");
    setErrorMsg(null);
    setState("ready");

    // bust 갱신
    setReloadKey((k) => k + 1);

    // 안전하게 reload도 한번
    try {
      iframeRef.current?.contentWindow?.location.reload();
    } catch {
      // same-origin이 아닐 가능성은 낮지만(정적파일), 실패해도 bust로 새로 로드됨
    }
  };

  // ---------- render ----------
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
          <div>• 이 페이지는 쿠콘 제공 HTML을 그대로 띄우며 React는 관여하지 않습니다.</div>
          <div>• iframe 경로: /coocon/css/은행_거래내역조회.html</div>
        </div>
      </div>

      {/* iframe area */}
      <div style={{ width: "100%", height: "calc(100vh - 220px)" }}>
        {state === "ready" ? (
          <iframe
            ref={iframeRef}
            title="coocon-scrape"
            src={iframeSrc}
            style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
            onLoad={() => pushLog("iframe loaded")}
            onError={() => {
              setState("error");
              setErrorMsg("iframe 로딩 실패 (public/coocon/css/ 파일 경로 확인 필요)");
              pushLog("ERROR: iframe onError");
            }}
          />
        ) : (
          <div style={{ padding: 16 }}>{state === "loading" ? "로딩중..." : "오류 상태"}</div>
        )}
      </div>

      {/* logs */}
      <div style={{ padding: 16, borderTop: "1px solid #eee" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>로그</div>
        <pre style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap" }}>{logs.join("\n")}</pre>
      </div>
    </div>
  );
}
