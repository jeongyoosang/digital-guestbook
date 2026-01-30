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

/* ---------------- Coocon call wrapper ---------------- */

async function callCooconApi(nx: any, apiId: string, params: any) {
  if (typeof nx?.execute === "function") {
    return await new Promise<any>((resolve, reject) => {
      try {
        nx.execute(apiId, params, (res: any) => resolve(res));
      } catch (e) {
        reject(e);
      }
    });
  }

  if (typeof nx?.call === "function") {
    return await new Promise<any>((resolve, reject) => {
      try {
        nx.call(apiId, params, (res: any) => resolve(res));
      } catch (e) {
        reject(e);
      }
    });
  }

  const fn = window.fn;
  if (fn && typeof fn === "object") {
    for (const k of ["callCoocon", "getTxList", "requestTxList"]) {
      if (typeof fn[k] === "function") {
        return await new Promise<any>((resolve, reject) => {
          try {
            fn[k](apiId, params, (res: any) => resolve(res));
          } catch (e) {
            reject(e);
          }
        });
      }
    }
  }

  throw new Error("Coocon API method not found");
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

/**
 * ✅ 단일 진실 소스
 * event_scrape_accounts 에서 bank + account_number 조회
 */
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
  const returnTo = sp.get("returnTo") || "";
  const apiId = sp.get("apiId") || "TX_LIST";

  const [state, setState] = useState<ScrapeState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const base = useMemo(() => "/coocon", []);

  const pushLog = (s: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${s}`]);
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
        await new Promise<void>((resolve, reject) => {
          nx.init((ok: boolean) => (ok ? resolve() : reject(new Error("nx.init 실패"))));
        });

        if (!isYmd(startDate) || !isYmd(endDate)) {
          throw new Error("startDate/endDate 형식 오류");
        }

        if (mode === "connect_then_scrape") {
          await runConnectThenScrape();
        } else {
          await runScrapeOnly();
        }

        setState("done");
        nav(returnTo || `/app/event/${eventId}/report`);
      } catch (e: any) {
        setErrorMsg(e.message);
        setState("error");
        pushLog(`오류: ${e.message}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function runConnectThenScrape() {
    setState("cert_select");
    pushLog("인증서 선택");

    const nx = window.CooconiSASNX;

    const certMeta = await new Promise<any>((resolve, reject) => {
      try {
        window.$("#certLayer").makeCertManager((data: any) => resolve(data));
      } catch {
        reject(new Error("인증서 팝업 실패"));
      }
    });

    const { bankName, bankCode, accountNo } = await getPrimaryFromEventAccounts();
    pushLog(`계좌: ${bankName} / ${maskAccountNo(accountNo)}`);

    const scrapeAccountId = await upsertScrapeAccount(bankCode, bankName, accountNo, certMeta);
    await runScrape(scrapeAccountId, bankCode, accountNo);
  }

  async function runScrapeOnly() {
    setState("scraping");
    const acc = await getScrapeAccountInfo(eventId);
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

    const bankName = data.bank_name;
    const accountNo = data.account_number;

    const bankCode = COOCON_BANK_CODE_MAP[bankName];
    if (!bankCode) throw new Error(`은행 미지원: ${bankName}`);

    return { bankName, bankCode, accountNo };
  }

  async function upsertScrapeAccount(bankCode: string, bankName: string, accountNo: string, certMeta: any) {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error("로그인이 필요합니다.");

    // ✅ 필수값 검증 (인덱스 onConflict 키와 정합성)
    if (!eventId) throw new Error("eventId가 없습니다.");
    if (!user.user.id) throw new Error("user.id가 없습니다.");
    if (!bankCode) throw new Error("bankCode가 없습니다.");
    if (!bankName) throw new Error("bankName이 없습니다.");
    if (!accountNo) throw new Error("accountNo가 없습니다.");

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

    // ✅ FIX: onConflict must match unique index
    // event_scrape_accounts_on_conflict_uidx (event_id, owner_user_id, provider, bank_code)
    const { data, error } = await supabase
      .from("event_scrape_accounts")
      .upsert(payload, { onConflict: "event_id,owner_user_id,provider,bank_code" })
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("event_scrape_accounts upsert error:", error);
      throw new Error(`스크래핑 계좌 저장 실패: ${error.message}`);
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

    pushLog("거래내역 조회 API 호출");
    const output = await callCooconApi(nx, apiId, params);

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
      throw new Error(j.message || "Edge Function 실패");
    }

    pushLog("스크래핑 및 리포트 반영 완료");
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h1>쿠콘 계좌 인증 / 스크래핑</h1>
      <div>state: {state}</div>

      {errorMsg && (
        <div style={{ marginTop: 12, color: "red", whiteSpace: "pre-wrap" }}>
          {errorMsg}
        </div>
      )}

      <pre style={{ marginTop: 12, fontSize: 12 }}>{log.join("\n")}</pre>
    </div>
  );
}
