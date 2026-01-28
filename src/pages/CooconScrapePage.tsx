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

    // isasscaping.js가 올릴 수도 있는 헬퍼들(환경별)
    fn?: any;

    // cert 팝업 중복 방지
    __CERT_OPENED__?: boolean;
  }
}

type ScrapeState =
  | "idle"
  | "loading_assets"
  | "initializing"
  | "opening"
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

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * ✅ “조회 API” 호출부는 쿠콘 샘플/계약 스펙에 따라 달라질 수 있음.
 * 아래는 최대한 많은 후보를 순차로 시도하는 안전한 래퍼.
 */
async function callCooconApi(nx: any, apiId: string, params: any) {
  // 후보1) nx.execute(apiId, params, cb)
  if (typeof nx?.execute === "function") {
    const out = await new Promise<any>((resolve, reject) => {
      try {
        nx.execute(apiId, params, (res: any) => resolve(res));
      } catch (e) {
        reject(e);
      }
    });
    return out;
  }

  // 후보2) nx.call(apiId, params, cb)
  if (typeof nx?.call === "function") {
    const out = await new Promise<any>((resolve, reject) => {
      try {
        nx.call(apiId, params, (res: any) => resolve(res));
      } catch (e) {
        reject(e);
      }
    });
    return out;
  }

  // 후보3) nx.run(apiId, params, cb)
  if (typeof nx?.run === "function") {
    const out = await new Promise<any>((resolve, reject) => {
      try {
        nx.run(apiId, params, (res: any) => resolve(res));
      } catch (e) {
        reject(e);
      }
    });
    return out;
  }

  // 후보4) isasscaping.js가 window.fn에 헬퍼를 올리는 경우
  const fn = window.fn;
  const fnCandidates = ["callCoocon", "execute", "getTxList", "getTradeList", "requestTxList"];
  for (const name of fnCandidates) {
    if (typeof fn?.[name] === "function") {
      const out = await new Promise<any>((resolve, reject) => {
        try {
          fn[name](apiId, params, (res: any) => resolve(res));
        } catch (e) {
          reject(e);
        }
      });
      return out;
    }
  }

  throw new Error("쿠콘 조회 API 호출 메서드를 찾지 못했습니다. (nx.execute/call/run 또는 window.fn 헬퍼 없음)");
}

export default function CooconScrapePage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const eventId = sp.get("eventId") || "";
  const mode = sp.get("mode") || "connect_then_scrape"; // connect_then_scrape | scrape_only
  const startDate = sp.get("startDate") || ""; // YYYY-MM-DD
  const endDate = sp.get("endDate") || ""; // YYYY-MM-DD
  const returnTo = sp.get("returnTo") || ""; // 완료 후 돌아갈 경로

  /**
   * ✅ 조회 API 식별자(쿠콘에서 받은 문서 기준으로 넣어야 함)
   * - 예: "WDR001" 같은 TR code / API ID
   * - 지금은 기본값을 두고, 필요 시 URL query로 override 가능하게 해둠
   */
  const apiId = sp.get("apiId") || "TX_LIST"; // ⚠️ TODO: 쿠콘 가이드의 “거래내역 조회” API ID로 교체

  const [state, setState] = useState<ScrapeState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const openedRef = useRef(false);

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

        pushLog("NXiSAS init 완료");

        // ✅ 핵심: open을 반드시 호출 (CERTLIST/팝업이 안 뜨는 케이스 방지)
        // - open(1, cb) : (문서/샘플에서 보통 1을 사용)
        setState("opening");
        pushLog("NXiSAS open 시작");

        await new Promise<void>((resolve, reject) => {
          try {
            if (typeof nx.open !== "function") {
              pushLog("nx.open 함수가 없습니다. (환경별로 생략 가능) → 계속 진행");
              openedRef.current = true;
              return resolve();
            }

            nx.open(1, (msg: any) => {
              // Result: "OK" / "ALREADY" 등
              pushLog(`NXiSAS open 콜백: ${JSON.stringify(msg)}`);
              openedRef.current = true;
              resolve();
            });
          } catch (e: any) {
            reject(new Error(`nx.open 실패: ${e?.message || String(e)}`));
          }
        });

        pushLog("NXiSAS ready");
        setState("ready");

        // 날짜 체크
        if (!isYmd(startDate) || !isYmd(endDate)) {
          throw new Error("startDate/endDate가 유효하지 않습니다. (YYYY-MM-DD)");
        }

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
   * A) 인증서 선택 → 연결 저장(우리 DB) → 즉시 1회 스크래핑(조회 API 실행) → Edge Function 반영
   */
  async function runConnectThenScrape() {
    setState("cert_select");

    // ✅ certLayer/flag 초기화(“팝업 다시 안열림” 방지)
    try {
      document.querySelector("#certLayer")?.remove();
    } catch {}
    window.__CERT_OPENED__ = false;

    const nx = window.CooconiSASNX;
    if (!nx) throw new Error("CooconiSASNX가 없습니다.");

    pushLog("인증서 목록 조회");

    // 혹시 open이 완료되지 않았다면 방어적으로 1회 더 시도
    if (!openedRef.current && typeof nx.open === "function") {
      pushLog("open 미완료 감지 → nx.open 재시도");
      await new Promise<void>((resolve) => {
        try {
          nx.open(1, (msg: any) => {
            pushLog(`NXiSAS open(재시도) 콜백: ${JSON.stringify(msg)}`);
            openedRef.current = true;
            resolve();
          });
        } catch {
          resolve();
        }
      });
    }

    const certList: any[] = await new Promise((resolve, reject) => {
      try {
        nx.getCertList((list: any[]) => {
          if (!Array.isArray(list)) return reject(new Error("인증서 목록 조회 실패"));
          resolve(list);
        });
      } catch (e: any) {
        reject(new Error(`nx.getCertList 예외: ${e?.message || String(e)}`));
      }
    });

    pushLog(`인증서 ${certList.length}개 발견`);

    const $ = window.$;
    if (!$) throw new Error("jQuery($)가 없습니다.");

    if ($("#certLayer").length === 0) {
      $("body").append(`<div id="certLayer" style="position:fixed; inset:0; z-index:9999;"></div>`);
    }

    // ✅ 중복 호출 방지 (isasscaping.js쪽에서도 중복 방지 변수가 있을 수 있음)
    if (window.__CERT_OPENED__) {
      pushLog("인증서 팝업이 이미 열려있는 것으로 감지됨 → 강제 초기화 후 재오픈");
      try {
        $("#certLayer").empty();
      } catch {}
      window.__CERT_OPENED__ = false;
    }

    pushLog("인증서 선택 팝업 표시");
    window.__CERT_OPENED__ = true;

    const certMeta = await new Promise<any>((resolve, reject) => {
      try {
        $("#certLayer").makeCertManager((data: any) => {
          // 닫힘 처리
          window.__CERT_OPENED__ = false;
          try {
            document.querySelector("#certLayer")?.remove();
          } catch {}
          resolve(data);
        });
      } catch (_e) {
        window.__CERT_OPENED__ = false;
        reject(new Error("인증서 팝업 생성 실패(makeCertManager)"));
      }
    });

    pushLog("인증서 선택 완료");
    if (certMeta) {
      const brief = {
        User: certMeta?.User,
        Issuer: certMeta?.Issuer,
        ExpiryDate: certMeta?.ExpiryDate,
        Type: certMeta?.Type,
      };
      pushLog(`CERT: ${JSON.stringify(brief)}`);
    }

    // ✅ DB에 연결완료 저장 + scrapeAccountId 확보
    const scrapeAccountId = await upsertConnectedAccount(eventId, certMeta);

    // ✅ 인증 직후 1회 자동 갱신
    await runScrapeWithQueryApiAndReflect(scrapeAccountId);
  }

  /**
   * B) 스크래핑 실행만
   * - 인증이 이미 완료되어 scrapeAccountId가 DB에 존재한다고 가정
   * - 최신 verified_at 계정으로 조회 실행
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

    await runScrapeWithQueryApiAndReflect(acc.id);
  }

  /**
   * ✅ 인증 직후: event_scrape_accounts upsert (id 확보)
   * - certified meta를 raw로 저장해두면 디버깅에 도움됨(컬럼이 있으면)
   */
  async function upsertConnectedAccount(evId: string, certMeta: any): Promise<string> {
    const { data: userRes } = await supabase.auth.getUser();
    const userEmail = userRes?.user?.email || null;

    // ⚠️ 컬럼은 네 DB에 맞춰야 함.
    const payload: any = {
      event_id: evId,
      verified_at: new Date().toISOString(),
      connected_by_email: userEmail,
      cert_meta_json: certMeta ?? null,
    };

    const { data, error } = await supabase
      .from("event_scrape_accounts")
      .upsert(payload, { onConflict: "event_id" })
      .select("id")
      .maybeSingle();

    if (error) throw new Error(`DB 연결상태 저장 실패: ${error.message}`);
    if (!data?.id) throw new Error("DB 연결상태 저장은 됐지만 id를 가져오지 못했습니다.");

    pushLog(`DB에 ‘인증완료/연결완료’ 저장 (scrapeAccountId=${data.id})`);
    return data.id as string;
  }

  /**
   * ✅ 핵심: “조회 API 실행 → Output 수신 → Edge Function 반영”
   */
  async function runScrapeWithQueryApiAndReflect(scrapeAccountId: string) {
    setState("scraping");

    if (!startDate || !endDate) {
      throw new Error("startDate/endDate가 비어있습니다. (ResultPage에서 날짜를 넣어 보내야 함)");
    }
    if (!isYmd(startDate) || !isYmd(endDate)) {
      throw new Error("startDate/endDate 형식 오류 (YYYY-MM-DD)");
    }

    const nx = window.CooconiSASNX;
    if (!nx) throw new Error("CooconiSASNX가 없습니다.");

    pushLog(`조회 API 실행: ${apiId} (${startDate} ~ ${endDate})`);

    /**
     * ✅ 여기 params는 “쿠콘 가이드의 조회 파라미터”로 맞춰야 함.
     * 지금은 최소한 날짜만 넣고, 필요한 값은 추후 확정되면 추가.
     */
    const params: any = {
      startDate,
      endDate,
      // bankCode, accountNo 등은 쿠콘 스펙 확정되면 추가
    };

    // 1) 조회 실행 → Output 받기
    let output: any;
    try {
      output = await callCooconApi(nx, apiId, params);
    } catch (e: any) {
      pushLog(`조회 API 실패: ${e?.message || String(e)}`);
      throw new Error(`조회 API 호출 실패(메서드/스펙 확인 필요): ${e?.message || String(e)}`);
    }

    pushLog("조회 결과 수신(원본 Output 확보)");

    // 2) Edge Function으로 반영 (cooconOutput 그대로 전달 → 서버에서 normalize)
    pushLog(`Edge Function 호출: coocon-scrape-transactions (${startDate} ~ ${endDate})`);

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("로그인이 필요합니다.");

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coocon-scrape-transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        eventId,
        scrapeAccountId,
        startDate,
        endDate,
        // ✅ 서버에서 normalizeFromCooconOutput로 파싱
        cooconOutput: output,
      }),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = j?.message || j?.error || `조회 실패(${res.status})`;
      throw new Error(msg);
    }

    const fetched = j.fetched ?? 0;
    const insertedTx = j.insertedTx ?? 0;
    const reflectedNew = j.reflectedLedgerNew ?? 0;
    const reflectedTotal = j.reflectedLedgerTotal ?? 0;

    pushLog(
      `갱신 성공: fetched=${fetched}, insertedTx=${insertedTx}, ledgerNew=${reflectedNew}, ledgerTotal=${reflectedTotal}`
    );
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
          * 흐름: 인증 완료 → DB 저장 → 조회 API 실행 → Output 수신 → Edge Function으로 DB 반영 → 리포트 복귀
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          * apiId(거래내역 조회 식별자): <b>{apiId}</b> (필요 시 URL에 <code>&amp;apiId=...</code> 로 교체)
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>로그</h2>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "white", minHeight: 220 }}>
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
