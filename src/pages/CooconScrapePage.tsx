// src/pages/CooconScrapePage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/**
 * ?„ì—­ ê°ì²´??ì¿ ì½˜ ?˜í”Œ JSê°€ window???¬ë¦¼)
 */
declare global {
  interface Window {
    CooconiSASNX?: any;
    jQuery?: any;
    $?: any;

    // isasscaping.jsê°€ ?¬ë¦´ ?˜ë„ ?ˆëŠ” ?¬í¼???˜ê²½ë³?
    fn?: any;

    // cert ?ì—… ì¤‘ë³µ ë°©ì?
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
 * ???œì¡°??API???¸ì¶œë¶€??ì¿ ì½˜ ?˜í”Œ/ê³„ì•½ ?¤í™???°ë¼ ?¬ë¼ì§????ˆìŒ.
 * ?„ë˜??ìµœë???ë§ì? ?„ë³´ë¥??œì°¨ë¡??œë„?˜ëŠ” ?ˆì „???˜í¼.
 */
async function callCooconApi(nx: any, apiId: string, params: any) {
  // ?„ë³´1) nx.execute(apiId, params, cb)
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

  // ?„ë³´2) nx.call(apiId, params, cb)
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

  // ?„ë³´3) nx.run(apiId, params, cb)
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

  // ?„ë³´4) isasscaping.jsê°€ window.fn???¬í¼ë¥??¬ë¦¬??ê²½ìš°
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

  throw new Error("ì¿ ì½˜ ì¡°íšŒ API ?¸ì¶œ ë©”ì„œ?œë? ì°¾ì? ëª»í–ˆ?µë‹ˆ?? (nx.execute/call/run ?ëŠ” window.fn ?¬í¼ ?†ìŒ)");
}

export default function CooconScrapePage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const eventId = sp.get("eventId") || "";
  const mode = sp.get("mode") || "connect_then_scrape"; // connect_then_scrape | scrape_only
  const startDate = sp.get("startDate") || ""; // YYYY-MM-DD
  const endDate = sp.get("endDate") || ""; // YYYY-MM-DD
  const returnTo = sp.get("returnTo") || ""; // ?„ë£Œ ???Œì•„ê°?ê²½ë¡œ

  /**
   * ??ì¡°íšŒ API ?ë³„??ì¿ ì½˜?ì„œ ë°›ì? ë¬¸ì„œ ê¸°ì??¼ë¡œ ?£ì–´????
   * - ?? "WDR001" ê°™ì? TR code / API ID
   * - ì§€ê¸ˆì? ê¸°ë³¸ê°’ì„ ?ê³ , ?„ìš” ??URL queryë¡?override ê°€?¥í•˜ê²??´ë‘ 
   */
  const apiId = sp.get("apiId") || "TX_LIST"; // ? ï¸ TODO: ì¿ ì½˜ ê°€?´ë“œ???œê±°?˜ë‚´??ì¡°íšŒ??API IDë¡?êµì²´

  const [state, setState] = useState<ScrapeState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const openedRef = useRef(false);

  // public/coocon => /coocon ?¼ë¡œ ?œë¹™??
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
      setErrorMsg("eventIdê°€ ?†ìŠµ?ˆë‹¤. (URL???eventId=... ?„ìš”)");
      setState("error");
      return;
    }

    (async () => {
      try {
        setState("loading_assets");
        pushLog("ì¿ ì½˜ ë¦¬ì†Œ??ë¡œë”© ?œì‘");

        // (?ˆìœ¼ë©?ì¢‹ê³  ?†ì–´??ì§„í–‰)
        await loadCss(`${base}/css/process_manager.css`).catch(() => {
          pushLog("process_manager.css ë¡œë”© ?¤íŒ¨(?ˆìœ¼ë©?ì¢‹ê³  ?†ì–´??ì§„í–‰)");
        });

        // JS ?œì„œ ì¤‘ìš”: jquery ??json2 ??web_socket ??isasscaping
        await loadScript(`${base}/jquery-1.9.1.min.js`);
        await loadScript(`${base}/json2.js`);
        await loadScript(`${base}/web_socket.js`);
        await loadScript(`${base}/isasscaping.js`); // ???Œì¼ëª?ê·¸ë?ë¡?(r ?†ìŒ)

        pushLog("ì¿ ì½˜ ë¦¬ì†Œ??ë¡œë”© ?„ë£Œ");

        const nx = window.CooconiSASNX;
        if (!nx) throw new Error("CooconiSASNXê°€ ?†ìŠµ?ˆë‹¤. isasscaping.js ë¡œë”©/?¤í–‰ ?•ì¸ ?„ìš”");

        setState("initializing");
        pushLog("NXiSAS init ?œì‘");

        await new Promise<void>((resolve, reject) => {
          nx.init((ok: boolean) => {
            if (ok) resolve();
            else reject(new Error("nx.init ?¤íŒ¨: ?”ì§„/?œë¹„??ê¶Œí•œ ?•ì¸ ?„ìš”"));
          });
        });

        pushLog("NXiSAS init ?„ë£Œ");

        // ???µì‹¬: open??ë°˜ë“œ???¸ì¶œ (CERTLIST/?ì—…?????¨ëŠ” ì¼€?´ìŠ¤ ë°©ì?)
        // - open(1, cb) : (ë¬¸ì„œ/?˜í”Œ?ì„œ ë³´í†µ 1???¬ìš©)
        setState("opening");
        pushLog("NXiSAS open ?œì‘");

        await new Promise<void>((resolve, reject) => {
          try {
            if (typeof nx.open !== "function") {
              pushLog("nx.open ?¨ìˆ˜ê°€ ?†ìŠµ?ˆë‹¤. (?˜ê²½ë³„ë¡œ ?ëµ ê°€?? ??ê³„ì† ì§„í–‰");
              openedRef.current = true;
              return resolve();
            }

            nx.open(1, (msg: any) => {
              // Result: "OK" / "ALREADY" ??
              pushLog(`NXiSAS open ì½œë°±: ${JSON.stringify(msg)}`);
              openedRef.current = true;
              resolve();
            });
          } catch (e: any) {
            reject(new Error(`nx.open ?¤íŒ¨: ${e?.message || String(e)}`));
          }
        });

        pushLog("NXiSAS ready");
        setState("ready");

        // ? ì§œ ì²´í¬
        if (!isYmd(startDate) || !isYmd(endDate)) {
          throw new Error("startDate/endDateê°€ ? íš¨?˜ì? ?ŠìŠµ?ˆë‹¤. (YYYY-MM-DD)");
        }

        if (mode === "connect_then_scrape") {
          await runConnectThenScrape();
        } else if (mode === "scrape_only") {
          await runScrapeOnly();
        } else {
          pushLog(`?????†ëŠ” mode: ${mode}`);
        }

        setState("done");
        pushLog("?„ë£Œ");

        const fallback = `/app/event/${eventId}/report`;
        const to = returnTo || fallback;

        pushLog(`?´ë™: ${to}`);
        nav(to);
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e?.message || String(e));
        setState("error");
        pushLog(`?¤ë¥˜: ${e?.message || String(e)}`);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  /**
   * A) ?¸ì¦??? íƒ ???°ê²° ?€???°ë¦¬ DB) ??ì¦‰ì‹œ 1???¤í¬?˜í•‘(ì¡°íšŒ API ?¤í–‰) ??Edge Function ë°˜ì˜
   */
  async function runConnectThenScrape() {
    setState("cert_select");

    // ??certLayer/flag ì´ˆê¸°???œíŒ???¤ì‹œ ?ˆì—´ë¦¼â€?ë°©ì?)
    try {
      document.querySelector("#certLayer")?.remove();
    } catch {}
    window.__CERT_OPENED__ = false;

    const nx = window.CooconiSASNX;
    if (!nx) throw new Error("CooconiSASNXê°€ ?†ìŠµ?ˆë‹¤.");

    pushLog("?¸ì¦??ëª©ë¡ ì¡°íšŒ");

    // ?¹ì‹œ open???„ë£Œ?˜ì? ?Šì•˜?¤ë©´ ë°©ì–´?ìœ¼ë¡?1?????œë„
    if (!openedRef.current && typeof nx.open === "function") {
      pushLog("open ë¯¸ì™„ë£?ê°ì? ??nx.open ?¬ì‹œ??);
      await new Promise<void>((resolve) => {
        try {
          nx.open(1, (msg: any) => {
            pushLog(`NXiSAS open(?¬ì‹œ?? ì½œë°±: ${JSON.stringify(msg)}`);
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
          if (!Array.isArray(list)) return reject(new Error("?¸ì¦??ëª©ë¡ ì¡°íšŒ ?¤íŒ¨"));
          resolve(list);
        });
      } catch (e: any) {
        reject(new Error(`nx.getCertList ?ˆì™¸: ${e?.message || String(e)}`));
      }
    });

    pushLog(`?¸ì¦??${certList.length}ê°?ë°œê²¬`);

    const $ = window.$;
    if (!$) throw new Error("jQuery($)ê°€ ?†ìŠµ?ˆë‹¤.");

    // ??ì¤‘ë³µ ?¸ì¶œ ë°©ì? (isasscaping.jsìª½ì—?œë„ ì¤‘ë³µ ë°©ì? ë³€?˜ê? ?ˆì„ ???ˆìŒ)
    // makeCertManager´Â selector°¡ ºñ¾îÀÖÀ» ¶§¸¸ HTMLÀ» »ı¼ºÇÏ¹Ç·Î, ±âÁ¸ ·¹ÀÌ¾î´Â Á¦°Å.
    if (window.__CERT_OPENED__) {
      pushLog("?¸ì¦???ì—…???´ë? ?´ë ¤?ˆëŠ” ê²ƒìœ¼ë¡?ê°ì?????ê°•ì œ ì´ˆê¸°?????¬ì˜¤??");
    }
    try {
      $("#certLayer").remove();
    } catch {}
    window.__CERT_OPENED__ = false;

    pushLog("?¸ì¦??? íƒ ?ì—… ?œì‹œ");
    window.__CERT_OPENED__ = true;

    const certMeta = await new Promise<any>((resolve, reject) => {
      try {
        $("#certLayer").makeCertManager((data: any) => {
          // ?«í˜ ì²˜ë¦¬
          window.__CERT_OPENED__ = false;
          try {
            document.querySelector("#certLayer")?.remove();
          } catch {}
          resolve(data);
        });
      } catch (_e) {
        window.__CERT_OPENED__ = false;
        reject(new Error("?¸ì¦???ì—… ?ì„± ?¤íŒ¨(makeCertManager)"));
      }
    });

    pushLog("?¸ì¦??? íƒ ?„ë£Œ");
    if (certMeta) {
      const brief = {
        User: certMeta?.User,
        Issuer: certMeta?.Issuer,
        ExpiryDate: certMeta?.ExpiryDate,
        Type: certMeta?.Type,
      };
      pushLog(`CERT: ${JSON.stringify(brief)}`);
    }

    // ??DB???°ê²°?„ë£Œ ?€??+ scrapeAccountId ?•ë³´
    const scrapeAccountId = await upsertConnectedAccount(eventId, certMeta);

    // ???¸ì¦ ì§í›„ 1???ë™ ê°±ì‹ 
    await runScrapeWithQueryApiAndReflect(scrapeAccountId);
  }

  /**
   * B) ?¤í¬?˜í•‘ ?¤í–‰ë§?
   * - ?¸ì¦???´ë? ?„ë£Œ?˜ì–´ scrapeAccountIdê°€ DB??ì¡´ì¬?œë‹¤ê³?ê°€??
   * - ìµœì‹  verified_at ê³„ì •?¼ë¡œ ì¡°íšŒ ?¤í–‰
   */
  async function runScrapeOnly() {
    setState("scraping");
    pushLog("?¤í¬?˜í•‘ ê³„ì • ì¡°íšŒ");

    const { data: acc, error } = await supabase
      .from("event_scrape_accounts")
      .select("id")
      .eq("event_id", eventId)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`?¤í¬?˜í•‘ ê³„ì • ì¡°íšŒ ?¤íŒ¨: ${error.message}`);
    if (!acc?.id) throw new Error("?¤í¬?˜í•‘ ê³„ì •???†ìŠµ?ˆë‹¤. (ë¨¼ì? ?¸ì¦???„ìš”)");

    await runScrapeWithQueryApiAndReflect(acc.id);
  }

  /**
   * ???¸ì¦ ì§í›„: event_scrape_accounts upsert (id ?•ë³´)
   * - certified metaë¥?rawë¡??€?¥í•´?ë©´ ?”ë²„ê¹…ì— ?„ì???ì»¬ëŸ¼???ˆìœ¼ë©?
   */
  async function upsertConnectedAccount(evId: string, certMeta: any): Promise<string> {
    const { data: userRes } = await supabase.auth.getUser();
    const userEmail = userRes?.user?.email || null;

    // ? ï¸ ì»¬ëŸ¼?€ ??DB??ë§ì¶°????
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

    if (error) throw new Error(`DB ?°ê²°?íƒœ ?€???¤íŒ¨: ${error.message}`);
    if (!data?.id) throw new Error("DB ?°ê²°?íƒœ ?€?¥ì? ?ì?ë§?idë¥?ê°€?¸ì˜¤ì§€ ëª»í–ˆ?µë‹ˆ??");

    pushLog(`DB???˜ì¸ì¦ì™„ë£??°ê²°?„ë£Œ???€??(scrapeAccountId=${data.id})`);
    return data.id as string;
  }

  /**
   * ???µì‹¬: ?œì¡°??API ?¤í–‰ ??Output ?˜ì‹  ??Edge Function ë°˜ì˜??
   */
  async function runScrapeWithQueryApiAndReflect(scrapeAccountId: string) {
    setState("scraping");

    if (!startDate || !endDate) {
      throw new Error("startDate/endDateê°€ ë¹„ì–´?ˆìŠµ?ˆë‹¤. (ResultPage?ì„œ ? ì§œë¥??£ì–´ ë³´ë‚´????");
    }
    if (!isYmd(startDate) || !isYmd(endDate)) {
      throw new Error("startDate/endDate ?•ì‹ ?¤ë¥˜ (YYYY-MM-DD)");
    }

    const nx = window.CooconiSASNX;
    if (!nx) throw new Error("CooconiSASNXê°€ ?†ìŠµ?ˆë‹¤.");

    pushLog(`ì¡°íšŒ API ?¤í–‰: ${apiId} (${startDate} ~ ${endDate})`);

    /**
     * ???¬ê¸° params???œì¿ ì½?ê°€?´ë“œ??ì¡°íšŒ ?Œë¼ë¯¸í„°?ë¡œ ë§ì¶°????
     * ì§€ê¸ˆì? ìµœì†Œ??? ì§œë§??£ê³ , ?„ìš”??ê°’ì? ì¶”í›„ ?•ì •?˜ë©´ ì¶”ê?.
     */
    const params: any = {
      startDate,
      endDate,
      // bankCode, accountNo ?±ì? ì¿ ì½˜ ?¤í™ ?•ì •?˜ë©´ ì¶”ê?
    };

    // 1) ì¡°íšŒ ?¤í–‰ ??Output ë°›ê¸°
    let output: any;
    try {
      output = await callCooconApi(nx, apiId, params);
    } catch (e: any) {
      pushLog(`ì¡°íšŒ API ?¤íŒ¨: ${e?.message || String(e)}`);
      throw new Error(`ì¡°íšŒ API ?¸ì¶œ ?¤íŒ¨(ë©”ì„œ???¤í™ ?•ì¸ ?„ìš”): ${e?.message || String(e)}`);
    }

    pushLog("ì¡°íšŒ ê²°ê³¼ ?˜ì‹ (?ë³¸ Output ?•ë³´)");

    // 2) Edge Function?¼ë¡œ ë°˜ì˜ (cooconOutput ê·¸ë?ë¡??„ë‹¬ ???œë²„?ì„œ normalize)
    pushLog(`Edge Function ?¸ì¶œ: coocon-scrape-transactions (${startDate} ~ ${endDate})`);

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??");

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
        // ???œë²„?ì„œ normalizeFromCooconOutputë¡??Œì‹±
        cooconOutput: output,
      }),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = j?.message || j?.error || `ì¡°íšŒ ?¤íŒ¨(${res.status})`;
      throw new Error(msg);
    }

    const fetched = j.fetched ?? 0;
    const insertedTx = j.insertedTx ?? 0;
    const reflectedNew = j.reflectedLedgerNew ?? 0;
    const reflectedTotal = j.reflectedLedgerTotal ?? 0;

    pushLog(
      `ê°±ì‹  ?±ê³µ: fetched=${fetched}, insertedTx=${insertedTx}, ledgerNew=${reflectedNew}, ledgerTotal=${reflectedTotal}`
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => nav(-1)}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          ???¤ë¡œ
        </button>
        <h1 style={{ margin: 0, fontSize: 18 }}>ì¿ ì½˜ ê³„ì¢Œ ?¸ì¦/?¤í¬?˜í•‘</h1>
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
          <b>?¤ë¥˜</b>
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
          * ???”ë©´?€ PC?ì„œë§??•ìƒ ?™ì‘(?”ì§„/?¸ì¦???„ìš”). ëª¨ë°”?¼ì? ë§‰ê±°???ˆë‚´ë§??„ìš°??ê²?ë§ìŒ.
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          * ?ë¦„: ?¸ì¦ ?„ë£Œ ??DB ?€????ì¡°íšŒ API ?¤í–‰ ??Output ?˜ì‹  ??Edge Function?¼ë¡œ DB ë°˜ì˜ ??ë¦¬í¬??ë³µê?
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          * apiId(ê±°ë˜?´ì—­ ì¡°íšŒ ?ë³„??: <b>{apiId}</b> (?„ìš” ??URL??<code>&amp;apiId=...</code> ë¡?êµì²´)
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>ë¡œê·¸</h2>
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



