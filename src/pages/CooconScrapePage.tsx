// src/pages/CooconScrapePage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/* ================= globals ================= */

declare global {
  interface Window {
    CooconiSASNX?: any;
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
  const returnToRaw = sp.get("returnTo") || "";
  const mode = sp.get("mode") || "connect_then_scrape";

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

  const [showIframe, setShowIframe] = useState(false);
  const certMetaRef = useRef<any>(null);

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

    let unmounted = false;

    const onMessage = (ev: MessageEvent) => {
      if (!ev?.data) return;
      const { type, payload } = ev.data || {};
      if (type === "COOCON_CERT_META") {
        certMetaRef.current = payload;
        pushLog("인증서 메타 수신(postMessage)");
        setShowIframe(false);
      }
      if (type === "COOCON_CERT_CANCEL") {
        pushLog("인증 UI 닫힘");
        setShowIframe(false);
        setErrorMsg("인증이 취소되었습니다.");
        setState("error");
      }
    };

    window.addEventListener("message", onMessage);

    (async () => {
      try {
        setState("loading_assets");
        pushLog("리소스 로딩");

        await loadCss(`${base}/css/process_manager.css`);
        await loadScript(`${base}/jquery-1.9.1.min.js`).catch(() => {});
        await loadScript(`${base}/json2.js`).catch(() => {});
        await loadScript(`${base}/web_socket.js`).catch(() => {});
        await loadScript(`${base}/isasscaping.js`);

        const nx = window.CooconiSASNX;
        if (!nx) throw new Error("NX 로딩 실패");

        setState("initializing");
        pushLog("nx.init 시작");
        await new Promise<void>((res, rej) => {
          nx.init((ok: boolean) => (ok ? res() : rej(new Error("nx.init 실패"))));
        });
        pushLog("nx.init 완료");

        if (!isYmd(startDate) || !isYmd(endDate)) {
          throw new Error("날짜 형식 오류 (YYYY-MM-DD)");
        }

        // connect_then_scrape 강제
        pushLog(`mode=${mode}, range=${startDate}~${endDate}`);

        const existing = await getScrapeAccount(eventId);

        if (!existing) {
          await runConnectThenScrape(nx);
        } else {
          // scrape_only로 왔는데 signParam 없다면 connect로 유도
          await runScrape(nx, existing.id, existing.bank_code, existing.account_number);
        }

        if (unmounted) return;
        setState("done");
        nav(returnTo || `/app/event/${eventId}/report`);
      } catch (e: any) {
        if (unmounted) return;
        setErrorMsg(e.message || String(e));
        setState("error");
        pushLog(`ERROR: ${e.message || e}`);
      }
    })();

    return () => {
      unmounted = true;
      window.removeEventListener("message", onMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runConnectThenScrape(nx: any) {
    setState("cert_select");
    pushLog("인증서/로그인 UI 준비");

    // ✅ iframe 오버레이로 “문서” 자체를 로드해야 scripts가 정상 실행됨
    certMetaRef.current = null;
    setShowIframe(true);

    // 인증 완료(postMessage) 기다리기
    const meta = await new Promise<any>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("인증서 입력 응답 타임아웃(60s)")), 60000);

      const tick = setInterval(() => {
        if (certMetaRef.current) {
          clearTimeout(t);
          clearInterval(tick);
          resolve(certMetaRef.current);
        }
      }, 200);
    });

    pushLog("인증서 입력 완료");

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

    if (error || !data) throw new Error("계좌 설정 없음");

    const bankCode = COOCON_BANK_CODE_MAP[data.bank_name];
    if (!bankCode) throw new Error(`미지원 은행: ${data.bank_name}`);

    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error("로그인 필요");

    // ✅ bank_code는 “상세설정 계좌” 기준으로 저장 (UI에서 선택한 값은 참고로만)
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
          cert_meta_json: meta ?? null,
        },
        { onConflict: "event_id,owner_user_id,provider,bank_code" }
      )
      .select("id")
      .maybeSingle();

    if (upErr || !acc?.id) throw new Error("스크래핑 계좌 저장 실패");

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

    pushLog("스크래핑 완료");
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h1>쿠콘 계좌 인증 / 스크래핑</h1>
      <div>state: {state}</div>

      {showIframe && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <div style={{ width: "min(1100px, 100%)", height: "min(720px, 100%)", background: "#fff", borderRadius: 12, overflow: "hidden" }}>
            <iframe
              title="coocon-cert"
              src={`${base}/css/은행_거래내역조회.html`}
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          </div>
        </div>
      )}

      {errorMsg && (
        <div style={{ marginTop: 12, color: "red", whiteSpace: "pre-wrap" }}>
          {errorMsg}
          <div style={{ marginTop: 8, color: "#333", fontSize: 12 }}>
            체크:
            <ul style={{ marginTop: 6 }}>
              <li>브라우저 팝업/보안프로그램(쿠콘/웹케시) 설치 여부</li>
              <li>공동인증서: LocalLow\NPKI 존재</li>
              <li>iframe 화면에서 “인증 완료” 눌렀는지</li>
            </ul>
          </div>
        </div>
      )}

      <pre style={{ marginTop: 12, fontSize: 12, whiteSpace: "pre-wrap" }}>{log.join("\n")}</pre>
    </div>
  );
}
