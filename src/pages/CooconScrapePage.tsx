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

/* ================= utils ================= */

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

/* ================= cert layer ================= */

async function ensureCertLayerTemplate(base: string) {
  const layer = document.getElementById("certLayer");
  if (!layer) throw new Error("certLayer DOM 없음");

  if (layer.childElementCount > 0) return;

  const res = await fetch(`${base}/css/은행_거래내역조회.html`, { cache: "no-store" });
  if (!res.ok) throw new Error("certLayer html 로드 실패");

  layer.innerHTML = await res.text();

  Object.assign(layer.style, {
    display: "block",
    position: "fixed",
    inset: "0",
    background: "#fff",
    zIndex: "9999",
  });
}

/* ================= Coocon API ================= */

async function callNxExecute(nx: any, inputList: any[]) {
  return new Promise<any>((resolve, reject) => {
    try {
      nx.execute(inputList, 0, (r: any) => resolve(r));
    } catch (e) {
      reject(e);
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
    .select("id, bank_code, bank_name, account_number")
    .eq("event_id", eventId)
    .eq("owner_user_id", data.user.id)
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return row ?? null;
}

/* ================= page ================= */

export default function CooconScrapePage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const eventId = sp.get("eventId") || "";
  const startDate = sp.get("startDate") || "";
  const endDate = sp.get("endDate") || "";
  const returnTo = sp.get("returnTo") || "";

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
        setState("loading_assets");
        pushLog("리소스 로딩");

        await loadCss(`${base}/css/process_manager.css`);
        await loadScript(`${base}/jquery-1.9.1.min.js`);
        await loadScript(`${base}/json2.js`);
        await loadScript(`${base}/web_socket.js`);
        await loadScript(`${base}/isasscaping.js`);

        const nx = window.CooconiSASNX;
        if (!nx) throw new Error("NX 로딩 실패");

        setState("initializing");
        await new Promise<void>((res, rej) => {
          nx.init((ok: boolean) => (ok ? res() : rej(new Error("nx.init 실패"))));
        });

        if (!isYmd(startDate) || !isYmd(endDate)) {
          throw new Error("날짜 형식 오류 (YYYY-MM-DD)");
        }

        const existing = await getScrapeAccount(eventId);
        if (!existing) {
          await runConnectThenScrape(nx);
        } else {
          await runScrape(nx, existing.id, existing.bank_code, existing.account_number);
        }

        setState("done");
        nav(returnTo || `/app/event/${eventId}/report`);
      } catch (e: any) {
        setErrorMsg(e.message || String(e));
        setState("error");
        pushLog(`ERROR: ${e.message || e}`);
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
    window.$?.("#certLayer")?.show();

    const certMeta = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("인증서 응답 타임아웃")), 15000);
      window.$("#certLayer").makeCertManager((d: any) => {
        clearTimeout(timer);
        resolve(d);
      });
    });

    const memberId = await getMyMemberId(eventId);
    const { data } = await supabase
      .from("event_accounts")
      .select("bank_name, account_number")
      .eq("event_id", eventId)
      .eq("owner_member_id", memberId)
      .eq("is_active", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();

    if (!data) throw new Error("계좌 설정 없음");

    const bankCode = COOCON_BANK_CODE_MAP[data.bank_name];
    if (!bankCode) throw new Error(`미지원 은행: ${data.bank_name}`);

    const { data: user } = await supabase.auth.getUser();

    const { data: acc } = await supabase
      .from("event_scrape_accounts")
      .upsert(
        {
          event_id: eventId,
          owner_user_id: user!.user!.id,
          provider: "coocon",
          bank_code: bankCode,
          bank_name: data.bank_name,
          account_number: data.account_number,
          verified_at: new Date().toISOString(),
          cert_meta_json: certMeta,
        },
        { onConflict: "event_id,owner_user_id,provider,bank_code" }
      )
      .select("id")
      .maybeSingle();

    if (!acc?.id) throw new Error("스크래핑 계좌 저장 실패");

    await runScrape(nx, acc.id, bankCode, data.account_number);
  }

  async function runScrape(nx: any, scrapeAccountId: string, bankCode: string, accountNo: string) {
    setState("scraping");
    pushLog(`스크래핑 시작 ${bankCode} / ${maskAccountNo(accountNo)}`);

    const inputList = [
      {
        Module: bankCode,
        Class: "개인뱅킹",
        Job: "계좌거래내역조회",
        Input: {
          계좌번호: accountNo,
          조회시작일: startDate.replace(/-/g, ""),
          조회종료일: endDate.replace(/-/g, ""),
        },
      },
    ];

    const output = await callNxExecute(nx, inputList);

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("로그인 필요");

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coocon-scrape-transactions`,
      {
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
      }
    );

    if (!res.ok) throw new Error("Edge Function 실패");
    pushLog("스크래핑 완료");
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <div id="certLayer" />

      <h1>쿠콘 계좌 인증 / 스크래핑</h1>
      <div>state: {state}</div>

      {errorMsg && (
        <div style={{ marginTop: 12, color: "red" }}>
          {errorMsg}
          <div style={{ marginTop: 8 }}>
            <button onClick={retry}>인증서 창 다시 열기</button>
          </div>
        </div>
      )}

      <pre style={{ marginTop: 12, fontSize: 12, whiteSpace: "pre-wrap" }}>
        {log.join("\n")}
      </pre>
    </div>
  );
}
