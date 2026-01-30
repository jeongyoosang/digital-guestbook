// src/pages/CooconScrapePage.tsx
import React, { useEffect, useMemo, useState } from "react";
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
    __COOCON_CERT_META__?: any;
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
 * ✅ bank_name -> module code map
 * - event_accounts.bank_name 값(한글) 기준으로 매핑
 * - 너가 가진 은행정보 엑셀 기준으로 주요 은행 포함
 */
const COOCON_BANK_CODE_MAP: Record<string, string> = {
  // 시중은행
  "국민은행": "kbstar",
  "KB국민은행": "kbstar",
  "신한은행": "shinhan",
  "우리은행": "wooribank",
  "하나은행": "hanabank",
  "NH농협은행": "nonghyup",
  "농협은행": "nonghyup",
  "IBK기업은행": "ibk",
  "기업은행": "ibk",
  "SC제일은행": "standardchartered",
  "한국씨티은행": "citibank",
  "씨티은행": "citibank",
  "산업은행": "kdb",
  "KDB산업은행": "kdb",

  // 지방/특수
  "수협은행": "suhyupbank",
  "대구은행": "dgb", // (iM뱅크 포함)
  "부산은행": "busanbank",
  "경남은행": "knbank",
  "광주은행": "kjbank",
  "전북은행": "jbbank",
  "제주은행": "jejubank",

  // 인터넷/기타
  "카카오뱅크": "kakaobank",
  "케이뱅크": "kbank",
  "K뱅크": "kbank",

  // 협동/우체국/새마을/신협
  "우체국": "epost",
  "우체국예금": "epost",
  "새마을금고": "kfcc",
  "새마을": "kfcc",
  "신협": "cu",
};

/* ---------------- util ---------------- */

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

function maskAccountNo(acct: string) {
  const t = (acct || "").replace(/\s+/g, "");
  if (t.length <= 4) return "***";
  return `${"*".repeat(t.length - 4)}${t.slice(-4)}`;
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

/**
 * ✅ certLayer 템플릿 주입 (중요)
 * - 여기서 “인증서 선택 UI”가 뜨는 기반이 깔림
 *
 * 파일 위치는 프로젝트 public 아래에 있어야 함:
 *  - /public/coocon/process_manager.html   (또는 쿠콘 샘플이 제공한 인증서 매니저 템플릿)
 *
 * ⚠️ 너가 지금 /coocon/css/은행_거래내역조회.html 을 열면 “은행조회 폼”이 뜨는데,
 *    그 화면은 인증서 리스트가 빈 케이스가 많아서, 우리는 "cert manager"를 먼저 띄우는 방식으로 간다.
 */
async function ensureCertLayerTemplate(base: string) {
  const layer = document.getElementById("certLayer");
  if (!layer) throw new Error("certLayer DOM이 없습니다.");

  if (layer.childElementCount > 0) return;

  // ✅ 여기 경로가 중요. (너 프로젝트에 실제 있는 cert manager 템플릿으로 맞춰야 함)
  // 쿠콘 샘플 기본은 process_manager.html 쪽이 “인증서 매니저”가 붙어있는 경우가 많음
  const url = `${base}/process_manager.html`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`certLayer 템플릿 로드 실패: ${url} (${res.status})`);

  const html = await res.text();
  layer.innerHTML = html;

  // 강제 표시
  const el = layer as HTMLDivElement;
  el.style.display = "block";
  el.style.position = "fixed";
  el.style.inset = "0";
  el.style.background = "#fff";
  el.style.zIndex = "9999";
}

/* ---------------- Coocon call wrapper (SAFE) ---------------- */

type CallCooconApiOptions = {
  timeoutMs?: number;
  debugLabel?: string;
};

async function callCooconApi(nx: any, apiId: string, params: any, opts: CallCooconApiOptions = {}) {
  // ✅ 조회는 사용자 입력/로딩 때문에 오래 걸릴 수 있어서 넉넉히
  const timeoutMs = opts.timeoutMs ?? 180000;
  const label = opts.debugLabel ?? `coocon:${apiId}`;

  if (!nx) throw new Error(`[${label}] Coocon SDK not ready`);

  let settled = false;
  const settleOnce = (fn: (v: any) => void, v: any) => {
    if (settled) return;
    settled = true;
    fn(v);
  };

  return await new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      settleOnce(reject, new Error(`[${label}] timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const cleanup = () => clearTimeout(timer);

    const ok = (res: any) => {
      cleanup();
      settleOnce(resolve, res);
    };
    const fail = (e: any) => {
      cleanup();
      settleOnce(reject, normalizeErr(e));
    };

    const paramsWithCallbacks = {
      ...(params ?? {}),
      callback: (r: any) => ok(r),
      onSuccess: (r: any) => ok(r),
      success: (r: any) => ok(r),
      onComplete: (r: any) => ok(r),
      onError: (e: any) => fail(e),
      error: (e: any) => fail(e),
      fail: (e: any) => fail(e),
    };

    const tryPromiseReturn = (ret: any) => {
      if (ret && typeof ret.then === "function") {
        ret.then(ok).catch(fail);
        return true;
      }
      return false;
    };

    const tryExecute = () => {
      if (typeof nx?.execute !== "function") return false;
      try {
        const ret = nx.execute(apiId, paramsWithCallbacks, (r: any) => ok(r));
        if (tryPromiseReturn(ret)) return true;
        return true;
      } catch {
        return false;
      }
    };

    const tryCall = () => {
      if (typeof nx?.call !== "function") return false;
      try {
        const ret = nx.call(apiId, paramsWithCallbacks, (r: any) => ok(r));
        if (tryPromiseReturn(ret)) return true;
        return true;
      } catch {
        return false;
      }
    };

    const tryWindowFn = () => {
      const fn = window.fn;
      if (!fn || typeof fn !== "object") return false;

      for (const k of ["callCoocon", "getTxList", "requestTxList"]) {
        if (typeof fn[k] === "function") {
          try {
            const ret = fn[k](apiId, paramsWithCallbacks, (r: any) => ok(r));
            if (tryPromiseReturn(ret)) return true;
            return true;
          } catch {
            // next
          }
        }
      }
      return false;
    };

    try {
      if (tryExecute()) return;
      if (tryCall()) return;
      if (tryWindowFn()) return;

      fail(new Error(`[${label}] Coocon API method not found (execute/call/window.fn.*)`));
    } catch (e) {
      fail(e);
    }
  });
}

/* ---------------- DB helpers ---------------- */

async function getMyMemberId(eventId: string): Promise<string> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) throw new Error("로그인이 필요합니다.");

  const userId = user.user.id;
  const email = user.user.email;

  let q = supabase.from("event_members").select("id").eq("event_id", eventId);

  if (userId) q = q.eq("user_id", userId);
  else if (email) q = q.eq("email", email);

  const { data, error } = await q.maybeSingle();
  if (error || !data?.id) throw new Error("이벤트 멤버를 찾지 못했습니다.");
  return data.id;
}

async function getScrapeAccountInfo(eventId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) throw new Error("로그인이 필요합니다.");

  const userId = user.user.id;

  const { data, error } = await supabase
    .from("event_scrape_accounts")
    .select("id, bank_code, bank_name, account_number")
    .eq("event_id", eventId)
    .eq("owner_user_id", userId)
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/* ---------------- Page ---------------- */

export default function CooconScrapePage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const eventId = sp.get("eventId") || "";
  const modeRaw = sp.get("mode") || "connect_then_scrape";
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

  const [state, setState] = useState<ScrapeState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const base = useMemo(() => "/coocon", []);

  const pushLog = (s: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${s}`]);
    console.log("[COOCON]", s);
  };

  useEffect(() => {
    if (!eventId) {
      setErrorMsg("eventId가 없습니다.");
      setState("error");
      return;
    }

    (async () => {
      try {
        setState("loading_assets");
        pushLog("쿠콘 리소스 로딩");

        await loadCss(`${base}/css/process_manager.css`).catch(() => {});
        await loadScript(`${base}/jquery-1.9.1.min.js`);
        await loadScript(`${base}/json2.js`);
        await loadScript(`${base}/web_socket.js`);
        await loadScript(`${base}/isasscaping.js`);

        const nx = window.CooconiSASNX;
        if (!nx) throw new Error("NXiSAS 로딩 실패(window.CooconiSASNX 없음)");

        setState("initializing");
        pushLog("nx.init 시작");
        await new Promise<void>((resolve, reject) => {
          try {
            nx.init((ok: boolean) => (ok ? resolve() : reject(new Error("nx.init 실패"))));
          } catch (e) {
            reject(e);
          }
        });
        pushLog("nx.init 완료");

        if (!isYmd(startDate) || !isYmd(endDate)) throw new Error("startDate/endDate 형식 오류(YYYY-MM-DD)");

        // ✅ scrape_only로 들어와도 "인증이 없으면" connect_then_scrape 강제
        let mode: "connect_then_scrape" | "scrape_only" =
          modeRaw === "scrape_only" ? "scrape_only" : "connect_then_scrape";

        const existing = await getScrapeAccountInfo(eventId);
        if (!existing) {
          pushLog("스크래핑 계좌(DB)가 없어서 connect_then_scrape로 전환");
          mode = "connect_then_scrape";
        }

        pushLog(`mode=${mode}, apiId=${apiId}, range=${startDate}~${endDate}`);

        if (mode === "connect_then_scrape") {
          await runConnectThenScrape();
        } else {
          await runScrapeOnly();
        }

        setState("done");
        pushLog("완료. 리포트로 이동");
        nav(returnTo || `/app/event/${eventId}/report`);
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        setErrorMsg(msg);
        setState("error");
        pushLog(`오류: ${msg}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  /**
   * ✅ connect_then_scrape:
   * 1) 인증서 선택 UI 띄움(makeCertManager)
   * 2) event_accounts에서 대표 계좌 가져옴
   * 3) event_scrape_accounts upsert
   * 4) TX_LIST 호출 → output을 Edge Function으로 전달
   */
  async function runConnectThenScrape() {
    setState("cert_select");
    pushLog("인증서 선택 단계 진입");

    if (!window.$) throw new Error("쿠콘 jQuery 로딩 실패(window.$ 없음)");

    pushLog("certLayer 템플릿 로딩 시도");
    await ensureCertLayerTemplate(base);
    pushLog("certLayer 템플릿 준비 완료");

    // 레이어 강제 show
    try {
      window.$("#certLayer").show();
    } catch {
      // ignore
    }

    // DOM 반영 한 틱
    await new Promise((r) => setTimeout(r, 50));

    // ✅ makeCertManager가 호출되면 인증서 UI가 떠야 정상
    const certMeta = await new Promise<any>((resolve, reject) => {
      try {
        const el = window.$("#certLayer");
        if (!el || el.length === 0) {
          reject(new Error("certLayer DOM이 없습니다.(템플릿 주입 실패)"));
          return;
        }

        // makeCertManager 콜백이 호출되면 resolve
        if (typeof el.makeCertManager !== "function") {
          reject(
            new Error(
              "makeCertManager 함수가 없습니다. (process_manager.html 템플릿이 인증서 매니저 포함 버전인지 확인 필요)"
            )
          );
          return;
        }

        el.makeCertManager((data: any) => resolve(data));
        window.__CERT_OPENED__ = true;
      } catch (e: any) {
        reject(new Error(`인증서 팝업 실패: ${String(e?.message ?? e)}`));
      }
    });

    window.__COOCON_CERT_META__ = certMeta;
    pushLog("인증서 선택 완료");

    const { bankName, bankCode, accountNo } = await getPrimaryFromEventAccounts();
    pushLog(`계좌: ${bankName} / ${maskAccountNo(accountNo)}`);

    const scrapeAccountId = await upsertScrapeAccount(bankCode, bankName, accountNo, certMeta);
    pushLog(`event_scrape_accounts upsert OK: ${scrapeAccountId}`);

    await runScrape(scrapeAccountId, bankCode, accountNo);
  }

  async function runScrapeOnly() {
    setState("scraping");
    const acc = await getScrapeAccountInfo(eventId);
    if (!acc?.id) {
      // safety
      pushLog("scrape_only인데 스크래핑 계좌가 없어 connect_then_scrape로 전환");
      await runConnectThenScrape();
      return;
    }
    if (!acc.account_number) throw new Error("스크래핑 계좌에 account_number가 없습니다.");

    pushLog(`계좌: ${acc.bank_name} / ${maskAccountNo(acc.account_number)}`);
    await runScrape(acc.id, acc.bank_code, acc.account_number);
  }

  async function getPrimaryFromEventAccounts() {
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

    if (error || !data) throw new Error("상세설정 계좌가 없습니다.");

    const bankName = (data.bank_name || "").trim();
    const accountNo = (data.account_number || "").trim();

    const bankCode = COOCON_BANK_CODE_MAP[bankName];
    if (!bankCode) throw new Error(`은행 미지원(매핑 필요): ${bankName}`);

    return { bankName, bankCode, accountNo };
  }

  async function upsertScrapeAccount(bankCode: string, bankName: string, accountNo: string, certMeta: any) {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error("로그인이 필요합니다.");

    const payload = {
      event_id: eventId,
      owner_user_id: user.user.id,
      provider: "coocon",
      bank_code: bankCode,
      bank_name: bankName,
      account_number: accountNo,
      verified_at: new Date().toISOString(),
      cert_meta_json: certMeta ?? null,
    };

    const { data, error } = await supabase
      .from("event_scrape_accounts")
      .upsert(payload, { onConflict: "event_id,owner_user_id,provider,bank_code" })
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("event_scrape_accounts upsert error", error);
      throw new Error("스크래핑 계좌 저장 실패");
    }
    if (!data?.id) throw new Error("스크래핑 계좌 저장 실패");
    return data.id;
  }

  async function runScrape(scrapeAccountId: string, bankCode: string, accountNo: string) {
    setState("scraping");
    const nx = window.CooconiSASNX;

    const params = {
      bankCode,
      accountNo,
      startDate,
      endDate,
    };

    pushLog("거래내역 조회 API 호출 시작");
    let output: any;
    try {
      output = await callCooconApi(nx, apiId, params, { timeoutMs: 180000, debugLabel: `tx:${apiId}` });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      pushLog(`거래내역 조회 API 실패: ${msg}`);
      throw e;
    }
    pushLog("거래내역 조회 API 응답 수신(다음: Edge Function)");

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("로그인이 필요합니다.");

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
    pushLog(
      `Edge Function OK: fetched=${j.fetched ?? "?"}, insertedTx=${j.insertedTx ?? "?"}, reflectedLedgerNew=${
        j.reflectedLedgerNew ?? "?"
      }`
    );

    pushLog("스크래핑 및 리포트 반영 완료");
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      {/* ✅ certLayer는 반드시 존재해야 함 */}
      <div id="certLayer" />

      <h1>쿠콘 계좌 인증 / 스크래핑</h1>
      <div>state: {state}</div>

      <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>
        ※ 인증 창이 안 뜨면 브라우저 “팝업 차단 해제”가 필요합니다.
      </div>

      {errorMsg && <div style={{ marginTop: 12, color: "red", whiteSpace: "pre-wrap" }}>{errorMsg}</div>}

      <pre style={{ marginTop: 12, fontSize: 12, whiteSpace: "pre-wrap" }}>{log.join("\n")}</pre>
    </div>
  );
}
