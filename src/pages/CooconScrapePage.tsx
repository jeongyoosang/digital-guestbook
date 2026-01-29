// src/pages/CooconScrapePage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/**
 * global objects (Coocon sample JS attaches to window)
 */
declare global {
  interface Window {
    CooconiSASNX?: any;
    jQuery?: any;
    $?: any;
    fn?: any;
    __CERT_OPENED__?: boolean;
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

/**
 * IMPORTANT:
 * - The keys must match event_accounts.bank_name values.
 * - Keep these Korean strings intact (UTF-8).
 */
const COOCON_BANK_CODE_MAP: Record<string, string> = {
  "국민은행": "kbstar",
  "신한은행": "shinhan",
  "우리은행": "wooribank",
  "하나은행": "hanabank",
  "NH농협은행": "nonghyup",
  "IBK기업은행": "ibk",
  "SC제일은행": "standardchartered",
  "한국씨티은행": "citibank",
  "카카오뱅크": "kakaobank",
  "수협은행": "suhyupbank",
  "대구은행": "dgb",
  "부산은행": "busanbank",
  "경남은행": "knbank",
  "광주은행": "kjbank",
  "전북은행": "jbbank",
  "제주은행": "jejubank",
};

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
 * Coocon API caller wrapper (sample/contract differs per customer)
 */
async function callCooconApi(nx: any, apiId: string, params: any) {
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

  throw new Error("Coocon API method not found (nx.execute/call/run or window.fn helper).");
}

function logCooconDebug(nx: any, pushLog: (s: string) => void) {
  const nxKeys = Object.keys(nx ?? {}).slice(0, 30);
  pushLog(`nx keys(<=30): ${nxKeys.join(", ") || "-"}`);
  pushLog(`nx.execute: ${typeof nx?.execute}, nx.call: ${typeof nx?.call}, nx.run: ${typeof nx?.run}`);

  const fn = window.fn;
  pushLog(`window.fn: ${typeof fn}`);
  if (fn && typeof fn === "object") {
    const fnKeys = Object.keys(fn).slice(0, 30);
    pushLog(`window.fn keys(<=30): ${fnKeys.join(", ") || "-"}`);
  }
}

async function getMyMemberId(eventId: string): Promise<string> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const userId = userRes?.user?.id;
  const email = userRes?.user?.email;
  if (!userId && !email) throw new Error("로그인이 필요합니다.");

  let memberId: string | null = null;

  if (userId) {
    const { data, error } = await supabase
      .from("event_members")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(`멤버 조회 실패: ${error.message}`);
    if (data?.id) memberId = data.id;
  }

  if (!memberId && email) {
    const { data, error } = await supabase
      .from("event_members")
      .select("id")
      .eq("event_id", eventId)
      .eq("email", email)
      .maybeSingle();

    if (error) throw new Error(`멤버 조회 실패: ${error.message}`);
    if (data?.id) memberId = data.id;
  }

  if (!memberId) {
    throw new Error("이벤트 멤버를 찾지 못했습니다. 초대/로그인 상태를 확인해주세요.");
  }

  return memberId;
}

/**
 * ✅ 수정: event_accounts에서는 "은행명"만 가져오고
 * accountNo는 여기서 절대 다루지 않는다.
 */
async function getPrimaryBankInfo(eventId: string): Promise<{ bankName: string; bankCode: string }> {
  const myMemberId = await getMyMemberId(eventId);

  const { data, error } = await supabase
    .from("event_accounts")
    .select("bank_name, is_active, sort_order")
    .eq("event_id", eventId)
    .eq("owner_member_id", myMemberId)
    .order("is_active", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`계좌 조회 실패: ${error.message}`);

  const bankName = (data?.bank_name || "").trim();
  if (!bankName) throw new Error("계좌 은행 정보가 없습니다. 상세설정에서 은행을 선택해주세요.");

  if (bankName === "기타(직접 입력)") {
    throw new Error("기타(직접 입력) 은행은 자동 조회를 지원하지 않습니다. 다른 은행을 선택해주세요.");
  }
  if (bankName === "토스뱅크") {
    throw new Error("토스뱅크는 현재 자동 조회를 지원하지 않습니다. 다른 은행을 선택해주세요.");
  }

  const bankCode = COOCON_BANK_CODE_MAP[bankName];
  if (!bankCode) throw new Error(`은행 매핑 실패: ${bankName} (자동 조회 미지원)`);

  return { bankName, bankCode };
}

export default function CooconScrapePage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const eventId = sp.get("eventId") || "";
  const mode = sp.get("mode") || "connect_then_scrape"; // connect_then_scrape | scrape_only
  const startDate = sp.get("startDate") || ""; // YYYY-MM-DD
  const endDate = sp.get("endDate") || ""; // YYYY-MM-DD
  const returnTo = sp.get("returnTo") || "";
  const apiId = sp.get("apiId") || "TX_LIST";

  const [state, setState] = useState<ScrapeState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isMountedRef = useRef(true);
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

        await loadCss(`${base}/css/process_manager.css`).catch(() => {
          pushLog("process_manager.css 로딩 실패(없어도 진행)");
        });

        await loadScript(`${base}/jquery-1.9.1.min.js`);
        await loadScript(`${base}/json2.js`);
        await loadScript(`${base}/web_socket.js`);
        await loadScript(`${base}/isasscaping.js`);

        pushLog("쿠콘 리소스 로딩 완료");

        const nx = window.CooconiSASNX;
        if (!nx) throw new Error("CooconiSASNX가 없습니다. isasscaping.js 로딩/실행을 확인하세요.");

        setState("initializing");
        pushLog("NXiSAS init 시작");

        await new Promise<void>((resolve, reject) => {
          nx.init((ok: boolean) => {
            if (ok) resolve();
            else reject(new Error("nx.init 실패: 엔진/디바이스 권한을 확인하세요."));
          });
        });

        pushLog("NXiSAS ready");
        setState("ready");

        if (!isYmd(startDate) || !isYmd(endDate)) {
          throw new Error("startDate/endDate가 유효하지 않습니다. (YYYY-MM-DD)");
        }

        if (mode === "connect_then_scrape") {
          await runConnectThenScrape();
        } else if (mode === "scrape_only") {
          await runScrapeOnly();
        } else {
          pushLog(`Unknown mode: ${mode}`);
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
   * A) cert select -> save connection -> immediately scrape once -> reflect via Edge Function
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

    try {
      $("#certLayer").remove();
    } catch {}
    window.__CERT_OPENED__ = false;

    pushLog("인증서 선택 팝업 시작");
    window.__CERT_OPENED__ = true;

    const certMeta = await new Promise<any>((resolve, reject) => {
      try {
        $("#certLayer").makeCertManager((data: any) => {
          window.__CERT_OPENED__ = false;
          try {
            $("#certLayer").remove();
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

    // ✅ 수정: accountNo를 더 이상 가져오지 않는다.
    const { bankName, bankCode } = await getPrimaryBankInfo(eventId);
    pushLog(`계좌 확인(은행): ${bankName}`);

    // save to DB & get scrapeAccountId
    const scrapeAccountId = await upsertConnectedAccountSafe(eventId, certMeta, bankCode, bankName);

    // ✅ 수정: accountNo 없이 실행
    await runScrapeWithQueryApiAndReflect(scrapeAccountId, bankCode);
  }

  /**
   * B) scrape only:
   * - assumes account exists in DB and verified_at is set
   */
  async function runScrapeOnly() {
    setState("scraping");
    pushLog("스크래핑 계정 조회");

    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id || null;
    if (!userId) throw new Error("로그인이 필요합니다.");

    const { data: acc, error } = await supabase
      .from("event_scrape_accounts")
      .select("id, bank_code, bank_name")
      .eq("event_id", eventId)
      .eq("owner_user_id", userId)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`스크래핑 계정 조회 실패: ${error.message}`);
    if (!acc?.id) throw new Error("스크래핑 계정이 없습니다. (먼저 인증이 필요합니다)");

    // ✅ 수정: accountNo를 더 이상 가져오지 않는다.
    const { bankName, bankCode } = await getPrimaryBankInfo(eventId);
    pushLog(`계좌 확인(은행): ${bankName}`);

    await runScrapeWithQueryApiAndReflect(acc.id, bankCode);
  }

  /**
   * Safe upsert for event_scrape_accounts (handles unknown schema fields)
   */
  async function upsertConnectedAccountSafe(evId: string, certMeta: any, bankCode: string, bankName: string): Promise<string> {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id || null;
    const userEmail = userRes?.user?.email || null;

    if (!userId) throw new Error("로그인이 필요합니다.");
    if (!bankCode) throw new Error("bank_code가 비어있습니다. 은행 매핑을 확인해주세요.");

    const payloadFull: any = {
      event_id: evId,
      owner_user_id: userId,
      provider: "coocon",
      bank_code: bankCode,
      bank_name: bankName,
      verified_at: new Date().toISOString(),
      connected_by_email: userEmail,
      cert_meta_json: certMeta ?? null,
    };

    const payloadMin: any = {
      event_id: evId,
      owner_user_id: userId,
      provider: "coocon",
      bank_code: bankCode,
      bank_name: bankName,
      verified_at: new Date().toISOString(),
    };

    const tryWrite = async (payload: any) => {
      const { data: existing, error: readErr } = await supabase
        .from("event_scrape_accounts")
        .select("id")
        .eq("event_id", evId)
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (readErr) return { data: null, error: readErr };

      if (existing?.id) {
        return supabase.from("event_scrape_accounts").update(payload).eq("id", existing.id).select("id").maybeSingle();
      }

      return supabase.from("event_scrape_accounts").insert(payload).select("id").maybeSingle();
    };

    // 1) full attempt
    let r = await tryWrite(payloadFull);

    if (r.error) {
      const msg = r.error.message || "";
      pushLog(`DB write(full) 실패: ${msg}`);

      if (msg.includes("Could not find the") || msg.includes("column") || msg.includes("schema cache") || msg.includes("does not exist")) {
        pushLog("DB 스키마에 맞게 최소 payload로 재시도");
        r = await tryWrite(payloadMin);
      }
    }

    if (r.error) throw new Error(`DB 연결 상태 저장 실패: ${r.error.message}`);
    if (!r.data?.id) throw new Error("DB 연결 상태 저장 성공했지만 id를 받지 못했습니다.");

    pushLog(`DB에 인증 완료 연결 저장됨 (scrapeAccountId=${r.data.id})`);
    return r.data.id as string;
  }

  /**
   * Core: run query API -> send output to Edge Function to reflect DB
   * ✅ 수정: accountNo 파라미터 제거
   */
  async function runScrapeWithQueryApiAndReflect(scrapeAccountId: string, bankCode: string) {
    setState("scraping");

    if (!startDate || !endDate) {
      throw new Error("startDate/endDate가 비어있습니다. (ResultPage에서 날짜를 넘겨야 함)");
    }
    if (!isYmd(startDate) || !isYmd(endDate)) {
      throw new Error("startDate/endDate 형식 오류 (YYYY-MM-DD)");
    }

    const nx = window.CooconiSASNX;
    if (!nx) throw new Error("CooconiSASNX가 없습니다.");

    pushLog(`조회 API 실행: ${apiId} (${startDate} ~ ${endDate})`);
    pushLog(`조회 파라미터: bankCode=${bankCode}`);

    const params: any = {
      startDate,
      endDate,

      bankCode,
      bank_code: bankCode,
      BANK_CODE: bankCode,

      // ✅ accountNo는 여기서 절대 전달하지 않는다.
      // ✅ 인증서/엔진 세션 + bankCode로만 조회하도록 계약 스펙에 맞추는 방향
    };

    let output: any;
    try {
      output = await callCooconApi(nx, apiId, params);
    } catch (e: any) {
      pushLog(`조회 API 실패: ${e?.message || String(e)}`);
      logCooconDebug(nx, pushLog);
      throw new Error(
        `조회 API 호출 실패: ${e?.message || String(e)}\n(30초 응답지연이면: apiId/필수 파라미터/키명 불일치 가능성이 큼)`
      );
    }

    pushLog("조회 결과 수신 (Output received)");
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
        cooconOutput: output,
      }),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = j?.message || j?.error || j?.detail || `조회 실패(${res.status})`;
      throw new Error(msg);
    }

    const fetched = j.fetched ?? 0;
    const insertedTx = j.insertedTx ?? 0;
    const reflectedNew = j.reflectedLedgerNew ?? 0;
    const reflectedTotal = j.reflectedLedgerTotal ?? 0;

    pushLog(`갱신 성공: fetched=${fetched}, insertedTx=${insertedTx}, ledgerNew=${reflectedNew}, ledgerTotal=${reflectedTotal}`);
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => nav(-1)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
          뒤로
        </button>
        <h1 style={{ margin: 0, fontSize: 18 }}>쿠콘 계좌 인증/스크래핑</h1>
        <span style={{ opacity: 0.7 }}>state: {state}</span>
      </div>

      {errorMsg && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #f5c2c7", background: "#fff5f5" }}>
          <b>오류</b>
          <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{errorMsg}</div>
        </div>
      )}

      <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          * 본 화면은 PC에서 정상 동작(엔진/인증서 필요). 모바일은 막히거나 레이어가 깨질 수 있습니다.
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          * 흐름: 인증 완료 → DB 저장 → 조회 API 실행 → Output 수신 → Edge Function으로 DB 반영 → 리포트 복귀
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          * apiId(거래내역 조회 식별자): <b>{apiId}</b> (필요 시 URL에서 <code>&amp;apiId=...</code>로 교체)
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
