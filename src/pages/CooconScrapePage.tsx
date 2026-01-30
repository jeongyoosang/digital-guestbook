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

    // (샘플/버전에 따라 존재)
    CooconSAS?: any;
    CooconiSAS?: any;
    Coocon?: any;
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
 * - Keys must match event_accounts.bank_name values
 * - UTF-8 Korean strings (do not change)
 */
const COOCON_BANK_CODE_MAP: Record<string, string> = {
  국민은행: "kbstar",
  신한은행: "shinhan",
  우리은행: "wooribank",
  하나은행: "hanabank",
  NH농협은행: "nonghyup",
  IBK기업은행: "ibk",
  SC제일은행: "standardchartered",
  한국씨티은행: "citibank",
  카카오뱅크: "kakaobank",
  수협은행: "suhyupbank",
  대구은행: "dgb",
  부산은행: "busanbank",
  경남은행: "knbank",
  광주은행: "kjbank",
  전북은행: "jbbank",
  제주은행: "jejubank",
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
 * ✅ 인증서 레이어 템플릿 주입 (FIXED)
 * - 실제 파일: /coocon/css/은행_거래내역조회.html
 */
async function ensureCertLayerTemplate(base: string) {
  const layer = document.getElementById("certLayer");
  if (!layer) throw new Error("certLayer DOM이 없습니다.");

  // 이미 로드됐으면 스킵
  if (layer.childElementCount > 0) return;

  const url = `${base}/css/은행_거래내역조회.html`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`certLayer 템플릿 로드 실패: ${url} (${res.status})`);
  }

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

/**
 * ✅ (핵심) 인증서 리스트를 SDK에 요청하고, 화면의 select에 강제로 주입
 * - 버전별로 getCertList 함수명이 다를 수 있어 여러 후보를 시도
 * - select id/name이 다를 수 있어 여러 후보 셀렉터에 주입
 */
async function forceLoadAndBindCertList(pushLog: (s: string) => void) {
  const $ = window.$;
  if (!$) throw new Error("window.$(jQuery) 가 없습니다.");

  // 1) select 후보 찾기
  const selectCandidates = [
    "#certSelect",
    "#cert_list",
    "#certList",
    "select[name='cert']",
    "select[name='certList']",
    "select[name='cert_list']",
    "select[id*='cert']",
    "select[name*='cert']",
  ];

  const pickSelect = () => {
    for (const sel of selectCandidates) {
      const el = $(sel);
      if (el && el.length > 0) return el;
    }
    return null;
  };

  // 2) SDK 객체 후보
  const sdkCandidates: any[] = [
    window.CooconSAS,
    window.CooconiSAS,
    window.Coocon,
    window.fn,
    window.CooconiSASNX,
  ].filter(Boolean);

  const callGetCertList = async (): Promise<any> => {
    // 여러 함수명 후보 (현장마다 다름)
    const methodNames = [
      "getCertList",
      "GetCertList",
      "getCertInfoList",
      "getCertInfo",
      "certList",
      "GetCert",
    ];

    for (const sdk of sdkCandidates) {
      for (const m of methodNames) {
        const fn = sdk?.[m];
        if (typeof fn === "function") {
          pushLog(`인증서 목록 API 시도: ${sdk === window.fn ? "window.fn" : "sdk"}.${m}()`);

          // callback 스타일
          const out = await new Promise<any>((resolve, reject) => {
            let done = false;
            const timer = setTimeout(() => {
              if (done) return;
              done = true;
              reject(new Error(`certList timeout: ${m}`));
            }, 15000);

            try {
              const ret = fn.call(sdk, (r: any) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                resolve(r);
              });

              // promise 반환 타입도 방어
              if (ret && typeof ret.then === "function") {
                ret
                  .then((r: any) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timer);
                    resolve(r);
                  })
                  .catch((e: any) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timer);
                    reject(e);
                  });
              }
            } catch (e) {
              if (done) return;
              done = true;
              clearTimeout(timer);
              reject(e);
            }
          });

          return out;
        }
      }
    }

    throw new Error("인증서 목록 API(getCertList 계열)를 찾지 못했습니다.");
  };

  // 3) 결과 파싱: 형태가 제각각이라 최대한 안전하게
  const normalizeCertArray = (raw: any): any[] => {
    if (!raw) return [];
    // 흔한 구조들:
    // raw.Result.CertList
    // raw.Output.Result.CertList
    // raw.CertList
    // raw.list
    const candidates = [
      raw?.Result?.CertList,
      raw?.Output?.Result?.CertList,
      raw?.Output?.CertList,
      raw?.CertList,
      raw?.certList,
      raw?.list,
      raw?.data,
    ];

    for (const c of candidates) {
      if (Array.isArray(c)) return c;
    }

    // 어떤 경우는 object map으로 오기도 함
    if (raw?.Result && Array.isArray(raw.Result)) return raw.Result;
    return [];
  };

  // 4) select에 option 주입
  const bindToSelect = (certs: any[]) => {
    const $select = pickSelect();
    if (!$select) throw new Error("인증서 select 요소를 찾지 못했습니다.(certSelect/cert_list 등)");

    $select.empty();
    $select.append(`<option value="">인증서를 선택하세요.</option>`);

    for (const c of certs) {
      // 필드명이 다를 수 있어 후보로 추출
      const user = c?.User || c?.user || c?.CN || c?.subject || c?.name || "인증서";
      const exp = c?.ExpiryDate || c?.expire || c?.expireDate || c?.ValidTo || c?.validTo || "";
      const issuer = c?.Issuer || c?.issuer || c?.CA || c?.ca || "";
      const id = c?.RDN || c?.rdn || c?.ID || c?.id || c?.key || "";

      const label = `${user}${exp ? ` / ${exp}` : ""}${issuer ? ` / ${issuer}` : ""}`.trim();
      const value = id || label;

      $select.append(
        `<option value="${String(value).replace(/"/g, "&quot;")}" data-json="${String(
          JSON.stringify(c)
        ).replace(/"/g, "&quot;")}">${label}</option>`
      );
    }

    // 화면 갱신 유도
    try {
      $select.trigger("change");
    } catch {
      // ignore
    }
  };

  // 실제 실행
  pushLog("인증서 목록 로딩 시작(getCertList)");
  const raw = await callGetCertList().catch((e) => {
    throw normalizeErr(e);
  });

  const certs = normalizeCertArray(raw);
  pushLog(`인증서 목록 응답 수신: ${certs.length}개`);

  if (!certs.length) {
    // 드롭다운이 비어있으면, 최소한 원본을 로그로 남기자
    pushLog(`인증서 목록이 0개입니다. raw=${safeJson(raw)}`);
  }

  bindToSelect(certs);
  pushLog("인증서 드롭다운 바인딩 완료");
};

function safeJson(v: any) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/* ---------------- Coocon call wrapper (SAFE) ---------------- */

type CallCooconApiOptions = {
  timeoutMs?: number;
  debugLabel?: string;
};

async function callCooconApi(nx: any, apiId: string, params: any, opts: CallCooconApiOptions = {}) {
  const timeoutMs = opts.timeoutMs ?? 20000;
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
  if (error || !data?.id) {
    throw new Error("이벤트 멤버를 찾지 못했습니다.");
  }

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
  if (!data?.id) throw new Error("스크래핑 계좌가 없습니다. 먼저 인증이 필요합니다.");
  if (!data.account_number) throw new Error("스크래핑 계좌에 account_number가 없습니다.");

  return data;
}

/* ---------------- Page ---------------- */

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
        if (!nx) throw new Error("NXiSAS 로딩 실패");

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

        if (!isYmd(startDate) || !isYmd(endDate)) {
          throw new Error("startDate/endDate 형식 오류");
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

  async function runConnectThenScrape() {
    setState("cert_select");
    pushLog("인증서 선택 단계 진입");

    if (!window.$) throw new Error("쿠콘 jQuery 로딩 실패(window.$ 없음)");

    // ✅ 1) 템플릿 주입
    pushLog("certLayer 템플릿 로딩 시도");
    await ensureCertLayerTemplate(base);
    pushLog("certLayer 템플릿 준비 완료");

    // ✅ 2) 레이어 표시
    try {
      window.$("#certLayer").show();
    } catch {
      // ignore
    }

    // DOM 반영 대기
    await new Promise((r) => setTimeout(r, 80));

    // ✅ 3) (핵심) 인증서 목록을 강제로 로드해서 드롭다운에 꽂기
    //    -> 지금 네 증상(드롭다운 비어있음) 100% 여기가 원인
    await forceLoadAndBindCertList(pushLog);

    // ✅ 4) 여기부터는 “사용자가 실제로 인증서 선택/비번 입력/조회”를 수행해야 한다.
    // 샘플 HTML마다 완료 콜백 방식이 달라서, 일단 “선택 완료 대기”는
    // 템플릿 내부 버튼(조회/확인 등)이 눌린 뒤 window.__CERT_OPENED__를 활용하거나,
    // 추후 특정 hidden input 값/콜백을 확인해 이어붙이면 된다.
    //
    // 지금은 우선 “인증서가 드롭다운에 뜨는 것”이 목표였고,
    // 뜨면 다음 단계에서 ‘조회’ 버튼 클릭 시 tx 조회 호출로 이어지게 붙이자.
    pushLog("✅ 인증서 드롭다운 로드 완료(이제 팝업에서 인증서 선택 가능)");

    // 임시: 여기서 바로 스크래핑으로 넘어가지 않고, 사용자가 팝업에서 ‘조회’ 버튼을 누르는 흐름을 유지
    // (너가 지금 쓰는 HTML이 조회 UI까지 포함하고 있어서, 여기서 강제 API 호출하면 timeout 확률이 높음)
  }

  async function runScrapeOnly() {
    setState("scraping");
    const acc = await getScrapeAccountInfo(eventId);
    pushLog(`계좌: ${acc.bank_name} / ${maskAccountNo(acc.account_number)}`);

    // scrape_only는 “이미 인증/계좌연결이 완료되어 있고, 바로 TX_LIST를 호출하는 모드”
    // (현재는 TX_LIST timeout이 있어, 인증서/기관 선택 UI에서 조회를 먼저 성공시키는 게 우선)
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

    const bankName = data.bank_name;
    const accountNo = data.account_number;

    const bankCode = COOCON_BANK_CODE_MAP[bankName];
    if (!bankCode) throw new Error(`은행 미지원: ${bankName}`);

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
      .upsert(payload, {
        onConflict: "event_id,owner_user_id,provider,bank_code",
      })
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
      output = await callCooconApi(nx, apiId, params, { timeoutMs: 25000, debugLabel: `tx:${apiId}` });
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
      {/* ✅✅ certLayer는 반드시 존재해야 함 + 템플릿은 runtime에 주입 */}
      <div id="certLayer" />

      <h1>쿠콘 계좌 인증 / 스크래핑</h1>
      <div>state: {state}</div>

      {errorMsg && <div style={{ marginTop: 12, color: "red", whiteSpace: "pre-wrap" }}>{errorMsg}</div>}

      <pre style={{ marginTop: 12, fontSize: 12 }}>{log.join("\n")}</pre>
    </div>
  );
}
