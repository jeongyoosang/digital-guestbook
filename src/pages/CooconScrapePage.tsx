// src/pages/CooconScrapePage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/**
 * 전역 객체들(쿠콘 샘플 JS가 window에 올림)
 */
declare global {
  interface Window {
    CooconiSASNX?: any;
    jQuery?: any;
    $?: any;
  }
}

type ScrapeState =
  | "idle"
  | "loading_assets"
  | "initializing"
  | "ready"
  | "cert_select"
  | "scraping"
  | "done"
  | "error";

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(s);
  });
}

function loadCss(href: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`link[href="${href}"]`);
    if (existing) return resolve();

    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    l.onload = () => resolve();
    l.onerror = () => reject(new Error(`Failed to load css: ${href}`));
    document.head.appendChild(l);
  });
}

export default function CooconScrapePage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const eventId = sp.get("eventId") || "";
  const mode = sp.get("mode") || "connect_then_scrape"; // connect_then_scrape | scrape_only
  const startDate = sp.get("startDate") || ""; // YYYY-MM-DD
  const endDate = sp.get("endDate") || ""; // YYYY-MM-DD
  const returnTo = sp.get("returnTo") || ""; // 완료 후 돌아갈 경로

  const [state, setState] = useState<ScrapeState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  // public/coocon => /coocon 으로 서빙됨
  const base = useMemo(() => "/coocon", []);

  const pushLog = (s: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${s}`]);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!eventId) {
      setErrorMsg("eventId가 없습니다. (URL에 ?eventId=... 필요)");
      setState("error");
      return;
    }

    (async () => {
      try {
        setState("loading_assets");
        pushLog("쿠콘 리소스 로딩 시작");

        // ✅ 네 폴더 기준 CSS
        // (process_manager.css 하나만 있어도 충분)
        await loadCss(`${base}/css/process_manager.css`).catch(() => {
          pushLog("process_manager.css 로딩 실패(있으면 좋고 없어도 진행)");
        });

        // ✅ JS 순서 중요: jquery → json2 → web_socket → isasscaping
        await loadScript(`${base}/jquery-1.9.1.min.js`);
        await loadScript(`${base}/json2.js`);
        await loadScript(`${base}/web_socket.js`);
        await loadScript(`${base}/isasscaping.js`); // ✅ 파일명 그대로 (r 없음)

        pushLog("쿠콘 리소스 로딩 완료");

        const nx = window.CooconiSASNX;
        if (!nx) throw new Error("CooconiSASNX가 없습니다. isasscaping.js 로딩/실행 확인 필요");

        setState("initializing");
        pushLog("NXiSAS init 시작");

        await new Promise<void>((resolve, reject) => {
          nx.init((ok: boolean) => {
            if (ok) resolve();
            else reject(new Error("nx.init 실패: 엔진/서비스/권한 확인 필요"));
          });
        });

        pushLog("NXiSAS ready");
        setState("ready");

        if (mode === "connect_then_scrape") {
          await runConnectThenScrape();
        } else if (mode === "scrape_only") {
          await runScrapeOnly();
        } else {
          pushLog(`알 수 없는 mode: ${mode}`);
        }

        setState("done");
        pushLog("완료");

        // ✅ 끝나면 돌아가기
        if (returnTo) {
          pushLog(`returnTo로 이동: ${returnTo}`);
          nav(returnTo);
        }
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e?.message || String(e));
        setState("error");
        pushLog(`오류: ${e?.message || String(e)}`);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  /**
   * A) 인증서 선택 → 연결 저장(우리 DB) → 즉시 1회 스크래핑
   */
  async function runConnectThenScrape() {
    setState("cert_select");
    pushLog("인증서 목록 조회");

    const nx = window.CooconiSASNX;

    // 인증서 목록 확인
    const certList: any[] = await new Promise((resolve, reject) => {
      nx.getCertList((list: any[]) => {
        if (!Array.isArray(list)) return reject(new Error("인증서 목록 조회 실패"));
        resolve(list);
      });
    });

    pushLog(`인증서 ${certList.length}개 발견`);

    const $ = window.$;
    if (!$) throw new Error("jQuery($)가 없습니다.");

    if ($("#certLayer").length === 0) {
      $("body").append(`<div id="certLayer" style="position:fixed; inset:0; z-index:9999;"></div>`);
    }

    pushLog("인증서 선택 팝업 표시");
    await new Promise<void>((resolve, reject) => {
      try {
        // 샘플 플러그인: makeCertManager가 cert 선택+비번 입력까지 처리
        $("#certLayer").makeCertManager((data: any) => {
          // data 내부에 비번 등 포함
          resolve();
        });
      } catch (e) {
        reject(new Error("인증서 팝업 생성 실패(makeCertManager)"));
      }
    });

    pushLog("인증서 선택 완료");

    // ✅ DB에 연결완료 저장 (너 테이블 컬럼명 맞추면 됨)
    await markConnected(eventId);

    // ✅ 인증 직후 1회 자동 갱신
    await runScrapeOnly();
  }

  /**
   * B) 스크래핑 실행만
   * - inputList는 “쿠콘 은행 API 개발 가이드”대로 바꿔야 실제로 돈다.
   * - 지금은 파이프라인/화면 흐름 확인용.
   */
  async function runScrapeOnly() {
    setState("scraping");

    const s = startDate || "";
    const e = endDate || "";
    if (!s || !e) pushLog("startDate/endDate가 비어있음 (추후 ResultPage에서 넣어줄 것)");

    pushLog("스크래핑 execute 시작");

    const nx = window.CooconiSASNX;

    // ⚠️ TODO: 실제 값은 쿠콘 가이드대로 수정
    const inputList = [
      {
        Module: "BANK",
        Class: "DUMMY",
        Job: "DUMMY",
        Input: {
          StartDate: s.replaceAll("-", ""),
          EndDate: e.replaceAll("-", ""),
        },
      },
    ];

    await new Promise<void>((resolve) => {
      nx.open(1, (_msg: any) => resolve());
    });

    const results = await new Promise<any[]>((resolve) => {
      nx.execute(inputList, 0, (res: any[]) => resolve(res));
    });

    pushLog(`스크래핑 결과 수신: ${results?.length ?? 0}개`);

    // ✅ 결과를 서버로 전달 (DB 저장은 Edge Function에서)
    await sendToEdge(eventId, results);

    pushLog("Edge Function 전송 완료");
  }

  async function markConnected(evId: string) {
    const { data: userRes } = await supabase.auth.getUser();
    const userEmail = userRes?.user?.email || null;

    const { error } = await supabase.from("event_scrape_accounts").upsert(
      {
        event_id: evId,
        connected_at: new Date().toISOString(),
        connected_by_email: userEmail,
      } as any,
      { onConflict: "event_id" }
    );

    if (error) throw new Error(`DB 연결상태 저장 실패: ${error.message}`);
    pushLog("DB에 ‘인증완료/연결완료’ 저장");
  }

  async function sendToEdge(evId: string, results: any[]) {
    // ⚠️ 네 Edge Function 이름으로 맞춰야 함
    const { data: sess } = await supabase.auth.getSession();
    const accessToken = sess?.session?.access_token;

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coocon-ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ eventId: evId, results }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Edge Function 실패(${res.status}): ${t}`);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => nav(-1)}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          ← 뒤로
        </button>
        <h1 style={{ margin: 0, fontSize: 18 }}>쿠콘 계좌 인증/스크래핑</h1>
        <span style={{ opacity: 0.7 }}>state: {state}</span>
      </div>

      {errorMsg && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #f5c2c7",
            background: "#fff5f5",
          }}
        >
          <b>오류</b>
          <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{errorMsg}</div>
        </div>
      )}

      <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          * 이 화면은 PC에서만 정상 동작(엔진/인증서 필요). 모바일은 막거나 안내만 띄우는 게 맞음.
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>로그</h2>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "white", minHeight: 200 }}>
          {log.length === 0 ? (
            <div style={{ opacity: 0.6 }}>...</div>
          ) : (
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>{log.join("\n")}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
