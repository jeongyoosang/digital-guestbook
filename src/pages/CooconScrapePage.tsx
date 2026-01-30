// src/pages/CooconScrapePage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/* ================= globals ================= */
declare global {
  interface Window {
    CooconiSASNX?: any;
    $?: any;
    __CERT_OPENED__?: boolean;
  }
}

type ScrapeState =
  | "idle"
  | "loading_assets"
  | "initializing"
  | "cert_select"
  | "scraping"
  | "done"
  | "error";

/* ================= constants ================= */

const COOCON_BANK_CODE_MAP: Record<string, string> = {
  국민은행: "kbstar",
  신한은행: "shinhan",
  우리은행: "wooribank",
  하나은행: "hanabank",
  NH농협은행: "nonghyup",
  IBK기업은행: "ibk",
  SC제일은행: "standardchartered",
  한국씨티은행: "citibank",
  수협은행: "suhyupbank",
  대구은행: "dgb",
  부산은행: "busanbank",
  경남은행: "knbank",
  광주은행: "kjbank",
  전북은행: "jbbank",
  제주은행: "jejubank",
};

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`script load fail: ${src}`));
    document.body.appendChild(s);
  });
}

function loadCss(href: string) {
  return new Promise<void>((resolve) => {
    if (document.querySelector(`link[href="${href}"]`)) return resolve();
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    l.onload = () => resolve();
    document.head.appendChild(l);
  });
}

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function maskAccountNo(v: string) {
  if (!v) return "";
  const t = v.replace(/\s+/g, "");
  return t.length <= 4 ? "***" : "*".repeat(t.length - 4) + t.slice(-4);
}

function normalizeErr(err: any) {
  if (!err) return new Error("Unknown Coocon error");
  if (err instanceof Error) return err;
  if (typeof err === "string") return new Error(err);
  try {
    return new Error(typeof err === "object" ? JSON.stringify(err) : String(err));
  } catch {
    return new Error(String(err));
  }
}

/* ================= cert layer template =================
   - 중요: fetch해서 innerHTML로 넣어도 <script>는 실행 안 됨
   - 따라서 이 HTML은 "레이어 UI 틀"로만 사용
   - 템플릿 안의 조회 링크(doScrape)는 클릭 막아서 에러 방지
*/
async function ensureCertLayerTemplate(base: string) {
  const layer = document.getElementById("certLayer");
  if (!layer) throw new Error("certLayer DOM 없음");

  if (layer.childElementCount > 0) return;

  const res = await fetch(`${base}/css/은행_거래내역조회.html`, { cache: "no-store" });
  if (!res.ok) throw new Error(`certLayer html 로드 실패: ${res.status}`);

  const raw = await res.text();

  // body만 뽑아서 주입 (전체 html/head/script 다 필요 없음)
  const m = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = m ? m[1] : raw;

  layer.innerHTML = bodyHtml;

  Object.assign(layer.style, {
    display: "none",
    position: "fixed",
    inset: "0",
    background: "#fff",
    zIndex: "9999",
    overflow: "auto",
  } as CSSStyleDeclaration);

  // 템플릿 내부의 "조회" 링크가 doScrape를 호출하는데,
  // innerHTML 주입 방식에서는 doScrape가 정의되지 않으므로 클릭을 막는다.
  // (우리는 makeCertManager 콜백만 씀)
  layer.querySelectorAll('a[href^="javascript:"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      alert("이 화면의 '조회' 버튼은 샘플용입니다. 상단 흐름에서 인증 후 자동으로 진행됩니다.");
    });
  });
}

/* ================= Coocon API wrapper ================= */

async function callCooconApi(nx: any, apiId: string, params: any, timeoutMs = 25000) {
  if (!nx) throw new Error("NX not ready");
  let settled = false;

  return await new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`[${apiId}] timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const ok = (r: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };

    const fail = (e: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(normalizeErr(e));
    };

    const payload = {
      ...(params ?? {}),
      callback: (r: any) => ok(r),
      onSuccess: (r: any) => ok(r),
      success: (r: any) => ok(r),
      onComplete: (r: any) => ok(r),
      onError: (e: any) => fail(e),
      error: (e: any) => fail(e),
      fail: (e: any) => fail(e),
    };

    try {
      if (typeof nx.execute === "function") {
        const ret = nx.execute(apiId, payload, (r: any) => ok(r));
        if (ret && typeof ret.then === "function") ret.then(ok).catch(fail);
        return;
      }
      if (typeof nx.call === "function") {
        const ret = nx.call(apiId, payload, (r: any) => ok(r));
        if (ret && typeof ret.then === "function") ret.then(ok).catch(fail);
        return;
      }
      fail(new Error("NX execute/call not found"));
    } catch (e) {
      fail(e);
    }
  });
}

/* ================= DB helpers ================= */

async function getMyMemberId(eventId: string) {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("로그인이 필요합니다.");

  const { data: row, error } = await supabase
    .from("event_members")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (error || !row?.id) throw new Error("event_members 조회 실패");
  return row.id;
}

async function getScrapeAccount(eventId: string) {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("로그인이 필요합니다.");

  const { data: row } = await supabase
    .from("event_scrape_accounts")
    .select("id, bank_code, bank_name, account_number, cert_meta_json")
    .eq("event_id", eventId)
    .eq("owner_user_id", data.user.id)
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return row ?? null;
}

function extractSignParam(meta: any): string | null {
  // makeCertManager 반환 형태가 환경별로 달라서 최대한 넓게 대응
  return (
    meta?.SignParam ??
    meta?.signParam ??
    meta?.Output?.Result?.req?.SignParam ??
    meta?.Output?.Result?.SignParam ??
    meta?.Result?.req?.SignParam ??
    meta?.Result?.SignParam ??
    null
  );
}

/* ================= page ================= */

export default function CooconScrapePage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const eventId = sp.get("eventId") || "";
  const mode = sp.get("mode") || "connect_then_scrape";
  const startDate = sp.get("startDate") || "";
  const endDate = sp.get("endDate") || "";
  const returnToRaw = sp.get("returnTo") || "";
  const apiId = sp.get("apiId") || "TX_LIST";

  const returnTo = useMemo(() => {
    if (!returnToRaw) return "";
    try {
      return decodeURIComponent(returnToRaw);
    } catch {
      return returnToRaw;
    }
  }, [returnToRaw]);

  const base = "/coocon";

  const [state, setState] = useState<ScrapeState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const retryRef = useRef(0);

  const pushLog = (m: string) => {
    setLog((p) => [...p, `${new Date().toLocaleTimeString()} ${m}`]);
    console.log("[COOCON]", m);
  };

  useEffect(() => {
    if (!eventId) {
      setErrorMsg("eventId 없음");
      setState("error");
      return;
    }

    (async () => {
      try {
        setErrorMsg(null);
        setState("loading_assets");
        pushLog("리소스 로딩");

        await loadCss(`${base}/css/process_manager.css`);
        await loadScript(`${base}/jquery-1.9.1.min.js`);
        await loadScript(`${base}/json2.js`);
        await loadScript(`${base}/web_socket.js`);
        await loadScript(`${base}/isasscaping.js`);

        const nx = window.CooconiSASNX;
        if (!nx) throw new Error("NX 로딩 실패 (window.CooconiSASNX 없음)");

        setState("initializing");
        pushLog("nx.init 시작");
        await new Promise<void>((res, rej) => {
          try {
            nx.init((ok: boolean) => (ok ? res() : rej(new Error("nx.init 실패"))));
          } catch (e) {
            rej(e);
          }
        });
        pushLog("nx.init 완료");

        if (!isYmd(startDate) || !isYmd(endDate)) {
          throw new Error("날짜 형식 오류 (YYYY-MM-DD)");
        }

        pushLog(`mode=${mode}, apiId=${apiId}, range=${startDate}~${endDate}`);

        // scrape_only인데 계좌/인증정보 없으면 connect_then_scrape로 강제
        const existing = await getScrapeAccount(eventId);

        if (mode === "scrape_only" && !existing) {
          pushLog("scrape_only인데 인증/계좌정보(DB)가 없어서 connect_then_scrape로 전환");
        }

        if (mode !== "scrape_only" || !existing) {
          await runConnectThenScrape(nx);
        } else {
          await runScrapeWithExisting(nx, existing);
        }

        setState("done");
        pushLog("완료. 리포트로 이동");
        nav(returnTo || `/app/event/${eventId}/report`);
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        setErrorMsg(msg);
        setState("error");
        pushLog(`ERROR: ${msg}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryRef.current]);

  function retry() {
    retryRef.current++;
    setLog([]);
    setErrorMsg(null);
    setState("idle");
  }

  async function runConnectThenScrape(nx: any) {
    setState("cert_select");
    pushLog("인증서 선택 단계");

    await ensureCertLayerTemplate(base);

    // 템플릿은 보여줄 필요 없음(사용자 클릭 방지). makeCertManager는 DOM만 있으면 됨.
    // 다만 일부 환경에서 레이어가 display:none이면 안 열리는 케이스가 있어, 콜백 받을 때까지만 표시.
    const layer = document.getElementById("certLayer") as HTMLDivElement | null;
    if (layer) layer.style.display = "block";

    if (!window.$) throw new Error("쿠콘 jQuery 로딩 실패(window.$ 없음)");

    const certMeta = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("인증서 응답 타임아웃(15s)")), 15000);
      try {
        window.$("#certLayer").makeCertManager((d: any) => {
          clearTimeout(timer);
          resolve(d);
        });
        window.__CERT_OPENED__ = true;
      } catch (e) {
        clearTimeout(timer);
        reject(new Error(`인증서 팝업 실패: ${String((e as any)?.message ?? e)}`));
      }
    });

    const signParam = extractSignParam(certMeta);
    pushLog(`인증서 선택 완료 (SignParam=${signParam ? "OK" : "EMPTY"})`);

    if (layer) layer.style.display = "none";

    if (!signParam) {
      throw new Error(
        "인증은 됐는데 SignParam을 찾지 못했습니다. (makeCertManager 반환 구조 확인 필요)"
      );
    }

    // 상세설정 계좌 1개 가져오기
    const memberId = await getMyMemberId(eventId);
    const { data, error } = await supabase
      .from("event_accounts")
      .select("bank_name, account_number")
      .eq("event_id", eventId)
      .eq("owner_member_id", memberId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) throw new Error("계좌 설정 없음(event_accounts)");

    const bankCode = COOCON_BANK_CODE_MAP[data.bank_name];
    if (!bankCode) throw new Error(`미지원 은행: ${data.bank_name}`);

    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error("로그인이 필요합니다.");

    // 인증정보 저장
    const { data: acc, error: upErr } = await supabase
      .from("event_scrape_accounts")
      .upsert(
        {
          event_id: eventId,
          owner_user_id: user.user.id,
          provider: "coocon",
          bank_code: bankCode,
          bank_name: data.bank_name,
          account_number: data.account_number,
          verified_at: new Date().toISOString(),
          cert_meta_json: { ...certMeta, __extractedSignParam: signParam },
        },
        { onConflict: "event_id,owner_user_id,provider,bank_code" }
      )
      .select("id")
      .maybeSingle();

    if (upErr || !acc?.id) throw new Error("스크래핑 계좌 저장 실패(event_scrape_accounts)");

    pushLog(`계좌 저장 OK: ${data.bank_name} / ${maskAccountNo(data.account_number)}`);

    await runScrape(nx, acc.id, bankCode, data.account_number, signParam);
  }

  async function runScrapeWithExisting(nx: any, existing: any) {
    const signParam =
      extractSignParam(existing?.cert_meta_json) ??
      existing?.cert_meta_json?.__extractedSignParam ??
      null;

    if (!signParam) {
      throw new Error("저장된 인증정보(SignParam)가 없습니다. mode=connect_then_scrape로 다시 인증하세요.");
    }

    pushLog(`기존 계좌 사용: ${existing.bank_name} / ${maskAccountNo(existing.account_number)}`);
    await runScrape(nx, existing.id, existing.bank_code, existing.account_number, signParam);
  }

  async function runScrape(
    nx: any,
    scrapeAccountId: string,
    bankCode: string,
    accountNo: string,
    signParam: string
  ) {
    setState("scraping");
    pushLog(`거래내역 조회 호출 시작: ${bankCode} / ${maskAccountNo(accountNo)}`);

    // ✅ 여기서 SignParam을 반드시 포함 (없으면 timeout 나는 케이스가 많음)
    const params = {
      bankCode,
      accountNo,
      startDate,
      endDate,
      SignParam: signParam,
      signParam: signParam,
    };

    let output: any;
    try {
      output = await callCooconApi(nx, apiId, params, 25000);
    } catch (e: any) {
      pushLog(`거래내역 조회 실패: ${e?.message ?? String(e)}`);
      throw e;
    }

    pushLog("거래내역 응답 수신 -> Edge Function 전달");

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("로그인 필요");

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coocon-scrape-transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventId,
        scrapeAccountId,
        startDate,
        endDate,
        cooconOutput: output,
      }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.message || j.error || "Edge Function 실패");
    }

    const j = await res.json().catch(() => ({}));
    pushLog(`Edge OK: fetched=${j.fetched ?? "?"}`);
    pushLog("스크래핑 완료");
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      {/* makeCertManager가 붙을 DOM */}
      <div id="certLayer" />

      <h1>쿠콘 계좌 인증 / 스크래핑</h1>
      <div>state: {state}</div>

      {errorMsg && (
        <div style={{ marginTop: 12, color: "red", whiteSpace: "pre-wrap" }}>
          {errorMsg}
          <div style={{ marginTop: 8 }}>
            <button
              onClick={retry}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" }}
            >
              재시도(인증서 다시 열기)
            </button>
          </div>
          <div style={{ marginTop: 10, color: "#333" }}>
            체크:
            <ul style={{ marginTop: 6 }}>
              <li>팝업 차단 해제</li>
              <li>로컬 보안모듈/프로그램(쿠콘/웹케시) 설치 여부</li>
              <li>mode=scrape_only인데 SignParam 저장이 없으면 connect_then_scrape로 먼저 인증</li>
            </ul>
          </div>
        </div>
      )}

      <pre style={{ marginTop: 12, fontSize: 12, whiteSpace: "pre-wrap" }}>{log.join("\n")}</pre>
    </div>
  );
}
