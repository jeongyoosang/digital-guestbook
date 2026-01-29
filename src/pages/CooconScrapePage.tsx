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

    // (?°ë¦¬ê°€ ?°ëŠ” ê°€??
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

const COOCON_BANK_CODE_MAP: Record<string, string> = {
  êµ???€?? "kbstar",
  ? í•œ?€?? "shinhan",
  ?°ë¦¬?€?? "wooribank",
  ?˜ë‚˜?€?? "hanabank",
  NH?í˜‘?€?? "nonghyup",
  IBKê¸°ì—…?€?? "ibk",
  SC?œì¼?€?? "standardchartered",
  ?œêµ­?¨í‹°?€?? "citibank",
  ì¹´ì¹´?¤ë±…?? "kakaobank",
  ?˜í˜‘?€?? "suhyupbank",
  ?€êµ¬ì??? "dgb",
  ë¶€?°ì??? "busanbank",
  ê²½ë‚¨?€?? "knbank",
  ê´‘ì£¼?€?? "kjbank",
  ?„ë¶?€?? "jbbank",
  ?œì£¼?€?? "jejubank",
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
  if (!userId && !email) throw new Error("ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??");

  let memberId: string | null = null;

  if (userId) {
    const { data, error } = await supabase
      .from("event_members")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(`ë©¤ë²„ ì¡°íšŒ ?¤íŒ¨: ${error.message}`);
    if (data?.id) memberId = data.id;
  }

  if (!memberId && email) {
    const { data, error } = await supabase
      .from("event_members")
      .select("id")
      .eq("event_id", eventId)
      .eq("email", email)
      .maybeSingle();

    if (error) throw new Error(`ë©¤ë²„ ì¡°íšŒ ?¤íŒ¨: ${error.message}`);
    if (data?.id) memberId = data.id;
  }

  if (!memberId) {
    throw new Error("?´ë²¤??ë©¤ë²„ë¥?ì°¾ì? ëª»í–ˆ?µë‹ˆ?? ì´ˆë? ?¬ë?ë¥??•ì¸?´ì£¼?¸ìš”.");
  }

  return memberId;
}

async function getPrimaryBankInfo(
  eventId: string
): Promise<{ bankName: string; bankCode: string }> {
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

  if (error) {
    throw new Error(`?€??ê³„ì¢Œ ì¡°íšŒ ?¤íŒ¨: ${error.message}`);
  }

  const bankName = (data?.bank_name || "").trim();
  if (!bankName) {
    throw new Error("??ê³„ì¢Œ???€???•ë³´ê°€ ?†ìŠµ?ˆë‹¤. ?ì„¸?¤ì •?ì„œ ?€?‰ì„ ? íƒ?´ì£¼?¸ìš”.");
  }
  if (bankName === "ê¸°í?(ì§ì ‘ ?…ë ¥)") {
    throw new Error(
      "ê¸°í?(ì§ì ‘ ?…ë ¥) ?€?‰ì? ?ë™ ì¡°íšŒë¥?ì§€?í•˜ì§€ ?ŠìŠµ?ˆë‹¤. ?‘ì? ?…ë¡œ???˜ê¸°ë¡?ì§„í–‰?´ì£¼?¸ìš”."
    );
  }
  if (bankName === "? ìŠ¤ë±…í¬") {
    throw new Error("? ìŠ¤ë±…í¬???„ì¬ ?ë™ ì¡°íšŒë¥?ì§€?í•˜ì§€ ?ŠìŠµ?ˆë‹¤. ?¤ë¥¸ ?€?‰ì„ ? íƒ?´ì£¼?¸ìš”.");
  }

  const bankCode = COOCON_BANK_CODE_MAP[bankName];
  if (!bankCode) {
    throw new Error(`?€??ë§¤í•‘ ?¤íŒ¨: ${bankName}. ?ë™ ì¡°íšŒë¥?ì§€?í•˜ì§€ ?ŠìŠµ?ˆë‹¤.`);
  }

  return { bankName, bankCode };
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
   */
  const apiId = sp.get("apiId") || "TX_LIST";

  const [state, setState] = useState<ScrapeState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isMountedRef = useRef(true);

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

        await loadCss(`${base}/css/process_manager.css`).catch(() => {
          pushLog("process_manager.css ë¡œë”© ?¤íŒ¨(?ˆìœ¼ë©?ì¢‹ê³  ?†ì–´??ì§„í–‰)");
        });

        // JS ?œì„œ ì¤‘ìš”: jquery ??json2 ??web_socket ??isasscaping
        await loadScript(`${base}/jquery-1.9.1.min.js`);
        await loadScript(`${base}/json2.js`);
        await loadScript(`${base}/web_socket.js`);
        await loadScript(`${base}/isasscaping.js`);

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
    pushLog("?¸ì¦??ëª©ë¡ ì¡°íšŒ");

    const nx = window.CooconiSASNX;

    const certList: any[] = await new Promise((resolve, reject) => {
      nx.getCertList((list: any[]) => {
        if (!Array.isArray(list)) return reject(new Error("?¸ì¦??ëª©ë¡ ì¡°íšŒ ?¤íŒ¨"));
        resolve(list);
      });
    });

    pushLog(`?¸ì¦??${certList.length}ê°?ë°œê²¬`);

    const $ = window.$;
    if (!$) throw new Error("jQuery($)ê°€ ?†ìŠµ?ˆë‹¤.");

    // ???ˆì „?? certLayer ? ìƒ???œê±° + ë§¤ë²ˆ ê°•ì œ ?¬ìƒ??+ CERT_OPENED ë¦¬ì…‹
    if (window.__CERT_OPENED__) {
      pushLog("?¸ì¦???ì—…???´ë¦° ê²ƒìœ¼ë¡?ê°ì? ??ê°•ì œ ë¦¬ì…‹");
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
          window.__CERT_OPENED__ = false;
          try {
            $("#certLayer").remove();
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

    const { bankName, bankCode } = await getPrimaryBankInfo(eventId);

    // ??DB???°ê²°?„ë£Œ ?€??+ scrapeAccountId ?•ë³´ (ì»¬ëŸ¼ ?†ìœ¼ë©??ë™ ì¶•ì†Œ)
    const scrapeAccountId = await upsertConnectedAccountSafe(eventId, certMeta, bankCode, bankName);

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
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id || null;
    if (!userId) {
      throw new Error("ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??");
    }

    const { data: acc, error } = await supabase
      .from("event_scrape_accounts")
      .select("id")
      .eq("event_id", eventId)
      .eq("owner_user_id", userId)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`?¤í¬?˜í•‘ ê³„ì • ì¡°íšŒ ?¤íŒ¨: ${error.message}`);
    if (!acc?.id) throw new Error("?¤í¬?˜í•‘ ê³„ì •???†ìŠµ?ˆë‹¤. (ë¨¼ì? ?¸ì¦???„ìš”)");

    await runScrapeWithQueryApiAndReflect(acc.id);
  }

  /**
   * ???µì‹¬ ?˜ì •: DB ?¤í‚¤ë§ˆê? ?´ë–¤ì§€ ëª°ë¼?????°ì?ê²??œë‹¨ê³„ì  upsert??
   * - 1ì°? event_id + verified_at + connected_by_email + cert_meta_json
   * - ?¤íŒ¨(ì»¬ëŸ¼ ?†ìŒ) ?? event_id + verified_at ë§Œìœ¼ë¡??¬ì‹œ??
   */
  async function upsertConnectedAccountSafe(
    evId: string,
    certMeta: any,
    bankCode: string,
    bankName: string
  ): Promise<string> {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id || null;
    const userEmail = userRes?.user?.email || null;

    if (!userId) {
      throw new Error("ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??");
    }
    if (!bankCode) {
      throw new Error("bank_codeë¥??•ì¸?????†ìŠµ?ˆë‹¤. ?€???•ë³´ë¥??¤ì‹œ ?•ì¸?´ì£¼?¸ìš”.");
    }

    // 1ì°??•ì¥ payload)
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

    // 2ì°?ìµœì†Œ payload)
    const payloadMin: any = {
      event_id: evId,
      owner_user_id: userId,
      provider: "coocon",
      bank_code: bankCode,
      bank_name: bankName,
      verified_at: new Date().toISOString(),
    };

    // helper: select -> update/insert
    const tryWrite = async (payload: any) => {
      const { data: existing, error: readErr } = await supabase
        .from("event_scrape_accounts")
        .select("id")
        .eq("event_id", evId)
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (readErr) return { data: null, error: readErr };

      if (existing?.id) {
        return supabase
          .from("event_scrape_accounts")
          .update(payload)
          .eq("id", existing.id)
          .select("id")
          .maybeSingle();
      }

      return supabase.from("event_scrape_accounts").insert(payload).select("id").maybeSingle();
    };

    // 1) full ?œë„
    let r = await tryWrite(payloadFull);
    if (r.error) {
      const msg = r.error.message || "";
      pushLog(`DB write(full) ?¤íŒ¨: ${msg}`);

      // ì»¬ëŸ¼ ?†ìŒ/?¤í‚¤ë§?ìºì‹œ ?´ìŠˆë©?ìµœì†Œë¡??¬ì‹œ??
      if (
        msg.includes("Could not find the") ||
        msg.includes("column") ||
        msg.includes("schema cache") ||
        msg.includes("does not exist")
      ) {
        pushLog("DB ?¤í‚¤ë§ˆì— ë§ê²Œ ìµœì†Œ payloadë¡??¬ì‹œ??);
        r = await tryWrite(payloadMin);
      }
    }

    if (r.error) throw new Error(`DB ?°ê²° ?íƒœ ?€???¤íŒ¨: ${r.error.message}`);
    if (!r.data?.id) throw new Error("DB ?°ê²°?íƒœ ?€?¥ì? ?ì?ë§?idë¥?ê°€?¸ì˜¤ì§€ ëª»í–ˆ?µë‹ˆ??");

    pushLog(`DB???˜ì¸ì¦ì™„ë£??°ê²°?„ë£Œ???€??(scrapeAccountId=${r.data.id})`);
    return r.data.id as string;
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

    const params: any = {
      startDate,
      endDate,
      // TODO: ì¿ ì½˜ ?¤í™ ?•ì •?˜ë©´ bankCode/accountNo ??ì¶”ê?
    };

    // 1) ì¡°íšŒ ?¤í–‰ ??Output ë°›ê¸°
    let output: any;
    try {
      output = await callCooconApi(nx, apiId, params);
    } catch (e: any) {
      pushLog(`ì¡°íšŒ API ?¤íŒ¨: ${e?.message || String(e)}`);
      logCooconDebug(nx, pushLog);
      throw new Error(`ì¡°íšŒ API ?¸ì¶œ ?¤íŒ¨(ë©”ì„œ???¤í™ ?•ì¸ ?„ìš”): ${e?.message || String(e)}`);
    }

    pushLog("ì¡°íšŒ ê²°ê³¼ ?˜ì‹ (?ë³¸ Output ?•ë³´)");

    // 2) Edge Function?¼ë¡œ ë°˜ì˜
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
        // ???œë²„?ì„œ normalizeFromCooconOutputë¡??Œì‹±(?¤ìŒ ?¨ê³„?ì„œ Edge Function ?˜ì • ?„ìš”)
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

    pushLog(`ê°±ì‹  ?±ê³µ: fetched=${fetched}, insertedTx=${insertedTx}, ledgerNew=${reflectedNew}, ledgerTotal=${reflectedTotal}`);
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



