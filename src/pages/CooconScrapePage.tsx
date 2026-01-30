import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/* ================= globals ================= */

declare global {
  interface Window {
    CooconiSASNX?: any;
    $?: any;
    __COOCON_CERT_DONE__?: (certMeta: any) => void; // ✅ 조회 버튼(doScrape) 눌렀을 때 resolve
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

function ymdToYmd8(ymd: string) {
  return ymd.replace(/-/g, "");
}

/* ================= cert layer (IMPORTANT FIX) ================= */
/**
 * ✅ 핵심:
 * - 은행_거래내역조회.html은 "전체 문서"라서 그대로 innerHTML로 넣으면 UI 깨짐
 * - 그리고 innerHTML에 포함된 <script>는 실행 안 됨
 * => 해결: HTML을 파싱해서 body만 certLayer에 넣고,
 *    스크립트는 이미 상위에서 로딩된 isasscaping.js를 사용한다.
 */
async function ensureCertLayerTemplate(base: string) {
  const layer = document.getElementById("certLayer");
  if (!layer) throw new Error("certLayer DOM 없음");

  // 이미 넣었으면 재주입 X
  if (layer.childElementCount > 0) return;

  const res = await fetch(`${base}/css/은행_거래내역조회.html`, { cache: "no-store" });
  if (!res.ok) throw new Error("certLayer html 로드 실패");

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  // ✅ body만 주입 (문서 구조/헤더/푸터 등 포함됨)
  layer.innerHTML = doc.body?.innerHTML || html;

  Object.assign(layer.style, {
    display: "block",
    position: "fixed",
    inset: "0",
    background: "#fff",
    zIndex: "9999",
    overflow: "auto",
  });
}

function hideCertLayer() {
  const layer = document.getElementById("certLayer");
  if (!layer) return;
  layer.style.display = "none";
}

/* ================= nx execute wrapper ================= */

async function nxExecute(nx: any, inputList: any[]) {
  return new Promise<any>((resolve, reject) => {
    try {
      // 보통 샘플은 (inputList, 0, callback) 형태
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
    .select("id, bank_code, bank_name, account_number, cert_meta_json")
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

  // ✅ Step4: 무조건 connect_then_scrape로 강제 (요청대로)
  const mode = "connect_then_scrape";

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
        if (!nx) throw new Error("NX 로딩 실패(window.CooconiSASNX 없음)");

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

        pushLog(`mode=${mode}, range=${startDate}~${endDate}`);

        // ✅ 항상 connect_then_scrape
        await runConnectThenScrape(nx);

        setState("done");
        pushLog("완료 → 리포트 이동");
        nav(returnTo || `/app/event/${eventId}/report`);
      } catch (e: any) {
        const msg = e?.message || String(e);
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
    pushLog("인증서/로그인 UI 준비");

    await ensureCertLayerTemplate(base);

    // ✅ 조회 버튼(doScrape)을 "인증 완료" 트리거로 가로채기
    const certMeta = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("인증서 입력 응답 타임아웃(60s)")), 60000);

      // 전역 콜백: doScrape에서 호출하도록 만든다
      window.__COOCON_CERT_DONE__ = (meta: any) => {
        clearTimeout(timer);
        resolve(meta);
      };

      // ✅ 여기서 핵심: 템플릿 안의 a href="javascript:doScrape()" 때문에
      // doScrape가 전역에 있어야 함. 우리가 전역 doScrape를 주입한다.
      (window as any).doScrape = () => {
        try {
          const $ = window.$;
          if (!$) throw new Error("jQuery(window.$) 없음");

          const certDataAttr = $("#cert_list option:selected").attr("data") || "";
          let certData: any = null;
          try {
            certData = certDataAttr ? JSON.parse(certDataAttr) : null;
          } catch {
            certData = null;
          }

          const certPwd = String($("#cert_pwd").val() || "").trim();

          if (!certData) {
            alert("인증서를 선택하세요.");
            return;
          }
          if (!certPwd) {
            alert("인증서 비밀번호를 입력하세요.");
            return;
          }

          // jumin_no는 현재 템플릿에 input이 없을 수 있어서 optional 처리
          const jumin = String($("#jumin_no").val() || "").trim();

          // 은행/계좌/기간은 실제론 상세설정 기반으로 우리가 nx.execute에 넣는다.
          const meta = { certData, certPwd, jumin };

          hideCertLayer();
          window.__COOCON_CERT_DONE__?.(meta);
        } catch (e: any) {
          alert(e?.message || String(e));
        }
      };

      // 화면 표시 보장
      try {
        (document.getElementById("certLayer") as HTMLDivElement).style.display = "block";
      } catch {
        // ignore
      }
    });

    pushLog("인증서 입력 완료 → 계좌/은행 조회");

    const { bankName, bankCode, accountNo } = await getPrimaryFromEventAccounts();
    pushLog(`계좌: ${bankName} / ${maskAccountNo(accountNo)}`);

    const scrapeAccountId = await upsertScrapeAccount(bankCode, bankName, accountNo, certMeta);
    pushLog(`event_scrape_accounts upsert OK: ${scrapeAccountId}`);

    await runLoginAndScrape(nx, scrapeAccountId, bankCode, accountNo, certMeta);
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

  /**
   * ✅ Step4 핵심: nx.execute로 "로그인" + "계좌거래내역조회"를 한 번에 수행
   * - 이전 timeout 원인: 로그인 세션 없이 TX_LIST만 호출
   */
  async function runLoginAndScrape(nx: any, scrapeAccountId: string, bankCode: string, accountNo: string, certMeta: any) {
    setState("scraping");
    pushLog(`스크래핑 시작 ${bankCode} / ${maskAccountNo(accountNo)}`);

    // certMeta 구조: { certData, certPwd, jumin }
    const certData = certMeta?.certData;
    const certPwd = certMeta?.certPwd;

    if (!certData || !certPwd) {
      throw new Error("certMeta 누락(인증서/비밀번호)");
    }

    // Coocon 샘플에서 RDN을 인증서 이름으로 쓰던 흐름을 최대한 맞춤
    const certName = certData?.RDN || certData?.User || certData?.CN || "";

    const inputList = [
      {
        Module: bankCode,
        Class: "개인뱅킹",
        Job: "로그인",
        Input: {
          로그인방식: "CERT",
          사용자아이디: "",
          사용자비밀번호: "",
          인증서: {
            이름: certName,
            만료일자: certData?.ExpiryDate || "",
            비밀번호: certPwd,
          },
        },
      },
      {
        Module: bankCode,
        Class: "개인뱅킹",
        Job: "계좌거래내역조회",
        Input: {
          계좌번호: accountNo,
          조회시작일: ymdToYmd8(startDate),
          조회종료일: ymdToYmd8(endDate),
        },
      },
    ];

    pushLog("nx.execute(login + tx) 호출");
    const output = await nxExecute(nx, inputList);
    pushLog("nx.execute 응답 수신 → Edge Function 전달");

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
    pushLog(`Edge OK: fetched=${j.fetched ?? "?"}, insertedTx=${j.insertedTx ?? "?"}, reflectedLedgerNew=${j.reflectedLedgerNew ?? "?"}`);

    pushLog("스크래핑 완료");
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      {/* certLayer는 반드시 존재해야 함 */}
      <div id="certLayer" />

      <h1>쿠콘 계좌 인증 / 스크래핑</h1>
      <div>state: {state}</div>

      {errorMsg && (
        <div style={{ marginTop: 12, color: "red", whiteSpace: "pre-wrap" }}>
          {errorMsg}
          <div style={{ marginTop: 8 }}>
            <button onClick={retry} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}>
              다시 시도
            </button>
          </div>
        </div>
      )}

      <pre style={{ marginTop: 12, fontSize: 12, whiteSpace: "pre-wrap" }}>{log.join("\n")}</pre>
    </div>
  );
}
