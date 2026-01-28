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

        // (있으면 좋고 없어도 진행)
        await loadCss(`${base}/css/process_manager.css`).catch(() => {
          pushLog("process_manager.css 로딩 실패(있으면 좋고 없어도 진행)");
        });

        // JS 순서 중요: jquery → json2 → web_socket → isasscaping
        await loadScript(`${base}/jquery-1.9.1.min.js`);
        await loadScript(`${base}/json2.js`);
        await loadScript(`${base}/web_socket.js`);
        await loadScript(`${base}/isasscaping.js`); // ✅ 파일명 그대로

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

        const fallback = `/app/event/${eventId}/report`;
        const to = returnTo || fallback;

        pushLog(`이동: ${to}`);
        nav(to);
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
   * A) 인증서 선택 → 연결 저장(우리 DB) → 즉시 1회 스크래핑(Edge Function)
   */
  async function runConnectThenScrape() {
    setState("cert_select");
    pushLog("인증서 목록 조회");

    const nx = window.CooconiSASNX;

    const certList: any[] = await new Promise((resolve, reject) => {
      nx.getCertList((list: any[]) => {
        if (!Array.isArray(list)) return reject(new Error("인증서 목록 조회 실패"));
        resolve(list);
      });
    });

    pushLog(`인증서 ${certList.length}개 발견`);

    const $ = window.$;
    if (!$) throw new Error("jQuery($)가 없습니다.");

    /**
     * ✅ 중요: makeCertManager는 "$div.length < 1" 일 때만 내부 HTML을 생성한다.
     * 그래서 certLayer를 미리 만들어두면(=length 1) 내부가 비어서 팝업이 안 뜬다.
     * → 기존 certLayer를 제거하고 새로 만든 뒤 makeCertManager 호출
     */
    try {
      $("#certLayer").remove();
    } catch {
      // ignore
    }

    $("body").append(`<div id="certLayer" style="position:fixed; inset:0; z-index:9999;"></div>`);

    pushLog("인증서 선택 팝업 표시");

    const certInfo: any = await new Promise((resolve, reject) => {
      try {
        $("#certLayer").makeCertManager((data: any) => {
          // data: {User, Issuer, ExpiryDate, RDN, Type, Drive, CertPwd, ...}
          resolve(data);
        });
      } catch (_e) {
        reject(new Error("인증서 팝업 생성 실패(makeCertManager)"));
      }
    });

    pushLog(`인증서 선택 완료: ${certInfo?.User ?? "(unknown user)"}`);

    // ✅ DB에 연결완료 저장 + scrapeAccountId 확보
    const scrapeAccountId = await insertConnectedAccount(eventId, certInfo);

    // ✅ 인증 직후 1회 자동 갱신(Edge Function)
    await runScrapeEdgeOnly(scrapeAccountId);
  }

  /**
   * B) 스크래핑 실행만
   * - Edge Function(coocon-scrape-transactions) 호출로 통일
   */
  async function runScrapeOnly() {
    setState("scraping");
    pushLog("스크래핑 계정 조회");

    const { data: acc, error } = await supabase
      .from("event_scrape_accounts")
      .select("id")
      .eq("event_id", eventId)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`스크래핑 계정 조회 실패: ${error.message}`);
    if (!acc?.id) throw new Error("스크래핑 계정이 없습니다. (먼저 인증이 필요)");

    await runScrapeEdgeOnly(acc.id);
  }

  /**
   * ✅ upsert 대신 insert
   * - 너의 설계(verified_at 최신 계정 선택)와 일치
   * - event_id onConflict 같은 가정(이벤트당 1개 계정)은 위험
   */
  async function insertConnectedAccount(evId: string, certInfo: any): Promise<string> {
    const { data: userRes } = await supabase.auth.getUser();
    const userEmail = userRes?.user?.email || null;

    // ⚠️ DB 컬럼에 맞춰서 확장 가능 (bank_code/bank_name/account_masked 등)
    // 지금은 "인증 완료 기록"이 목적이라 최소만 넣음
    const payload: any = {
      event_id: evId,
      verified_at: new Date().toISOString(),
      connected_by_email: userEmail,

      // 디버그/추후 매핑용(있으면 도움됨)
      cert_user: certInfo?.User ?? null,
      cert_issuer: certInfo?.Issuer ?? null,
      cert_expiry: certInfo?.ExpiryDate ?? null,
      cert_type: certInfo?.Type ?? null,
    };

    const { data, error } = await supabase
      .from("event_scrape_accounts")
      .insert(payload)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(`DB 연결상태 저장 실패: ${error.message}`);
    if (!data?.id) throw new Error("DB 연결상태 저장은 됐지만 id를 가져오지 못했습니다.");

    pushLog(`DB에 ‘인증완료/연결완료’ 저장 (scrapeAccountId=${data.id})`);
    return data.id as string;
  }

  async function runScrapeEdgeOnly(scrapeAccountId: string) {
    setState("scraping");

    const s = startDate || "";
    const e = endDate || "";

    if (!s || !e) {
      throw new Error("startDate/endDate가 비어있습니다. (ResultPage에서 날짜를 넣어 보내야 함)");
    }

    pushLog(`Edge Function 호출: coocon-scrape-transactions (${s} ~ ${e})`);

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("로그인이 필요합니다.");

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coocon-scrape-transactions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventId,
          scrapeAccountId,
          startDate: s,
          endDate: e,
        }),
      }
    );

    const body = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      const msg =
        body?.message ||
        body?.error ||
        body?.detail ||
        `조회 실패(${res.status})`;
      throw new Error(msg);
    }

    // ✅ Edge Function 응답 필드명 기준 (너가 준 coocon-scrape-transactions 코드 기준)
    const fetched = Number(body?.fetched ?? 0);
    const insertedTx = Number(body?.insertedTx ?? 0);
    const reflectedLedgerNew = Number(body?.reflectedLedgerNew ?? 0);

    pushLog(`갱신 성공: fetched=${fetched}, insertedTx=${insertedTx}, ledgerNew=${reflectedLedgerNew}`);
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

      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          border: "1px solid #eee",
          background: "#fafafa",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          * 이 화면은 PC에서만 정상 동작(엔진/인증서 필요). 모바일은 막거나 안내만 띄우는 게 맞음.
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          * 흐름: 인증 완료 → DB에 계정 저장 → 즉시 1회 “은행 내역 갱신” 자동 실행 → 리포트로 복귀
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
