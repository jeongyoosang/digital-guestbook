// src/pages/CooconScrapePage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/**
 * ?꾩뿭 媛앹껜??荑좎퐯 ?섑뵆 JS媛 window???щ┝)
 */
declare global {
  interface Window {
    CooconiSASNX?: any;
    jQuery?: any;
    $?: any;

    // isasscaping.js媛 ?щ┫ ?섎룄 ?덈뒗 ?ы띁???섍꼍蹂?
    fn?: any;

    // cert ?앹뾽 以묐났 諛⑹?
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
 * ???쒖“??API???몄텧遺??荑좎퐯 ?섑뵆/怨꾩빟 ?ㅽ럺???곕씪 ?щ씪吏????덉쓬.
 * ?꾨옒??理쒕???留롮? ?꾨낫瑜??쒖감濡??쒕룄?섎뒗 ?덉쟾???섑띁.
 */
async function callCooconApi(nx: any, apiId: string, params: any) {
  // ?꾨낫1) nx.execute(apiId, params, cb)
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

  // ?꾨낫2) nx.call(apiId, params, cb)
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

  // ?꾨낫3) nx.run(apiId, params, cb)
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

  // ?꾨낫4) isasscaping.js媛 window.fn???ы띁瑜??щ━??寃쎌슦
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

  throw new Error("荑좎퐯 議고쉶 API ?몄텧 硫붿꽌?쒕? 李얠? 紐삵뻽?듬땲?? (nx.execute/call/run ?먮뒗 window.fn ?ы띁 ?놁쓬)");
}

export default function CooconScrapePage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const eventId = sp.get("eventId") || "";
  const mode = sp.get("mode") || "connect_then_scrape"; // connect_then_scrape | scrape_only
  const startDate = sp.get("startDate") || ""; // YYYY-MM-DD
  const endDate = sp.get("endDate") || ""; // YYYY-MM-DD
  const returnTo = sp.get("returnTo") || ""; // ?꾨즺 ???뚯븘媛?寃쎈줈

  /**
   * ??議고쉶 API ?앸퀎??荑좎퐯?먯꽌 諛쏆? 臾몄꽌 湲곗??쇰줈 ?ｌ뼱????
   * - ?? "WDR001" 媛숈? TR code / API ID
   * - 吏湲덉? 湲곕낯媛믪쓣 ?먭퀬, ?꾩슂 ??URL query濡?override 媛?ν븯寃??대몺
   */
  const apiId = sp.get("apiId") || "TX_LIST"; // ?좑툘 TODO: 荑좎퐯 媛?대뱶???쒓굅?섎궡??議고쉶??API ID濡?援먯껜

  const [state, setState] = useState<ScrapeState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const openedRef = useRef(false);

  // public/coocon => /coocon ?쇰줈 ?쒕튃??
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
      setErrorMsg("eventId媛 ?놁뒿?덈떎. (URL???eventId=... ?꾩슂)");
      setState("error");
      return;
    }

    (async () => {
      try {
        setState("loading_assets");
        pushLog("荑좎퐯 由ъ냼??濡쒕뵫 ?쒖옉");

        // (?덉쑝硫?醫뗪퀬 ?놁뼱??吏꾪뻾)
        await loadCss(`${base}/css/process_manager.css`).catch(() => {
          pushLog("process_manager.css 濡쒕뵫 ?ㅽ뙣(?덉쑝硫?醫뗪퀬 ?놁뼱??吏꾪뻾)");
        });

        // JS ?쒖꽌 以묒슂: jquery ??json2 ??web_socket ??isasscaping
        await loadScript(`${base}/jquery-1.9.1.min.js`);
        await loadScript(`${base}/json2.js`);
        await loadScript(`${base}/web_socket.js`);
        await loadScript(`${base}/isasscaping.js`); // ???뚯씪紐?洹몃?濡?(r ?놁쓬)

        pushLog("荑좎퐯 由ъ냼??濡쒕뵫 ?꾨즺");

        const nx = window.CooconiSASNX;
        if (!nx) throw new Error("CooconiSASNX媛 ?놁뒿?덈떎. isasscaping.js 濡쒕뵫/?ㅽ뻾 ?뺤씤 ?꾩슂");

        setState("initializing");
        pushLog("NXiSAS init ?쒖옉");

        await new Promise<void>((resolve, reject) => {
          nx.init((ok: boolean) => {
            if (ok) resolve();
            else reject(new Error("nx.init ?ㅽ뙣: ?붿쭊/?쒕퉬??沅뚰븳 ?뺤씤 ?꾩슂"));
          });
        });

        pushLog("NXiSAS init ?꾨즺");

        // ???듭떖: open??諛섎뱶???몄텧 (CERTLIST/?앹뾽?????⑤뒗 耳?댁뒪 諛⑹?)
        // - open(1, cb) : (臾몄꽌/?섑뵆?먯꽌 蹂댄넻 1???ъ슜)
        setState("opening");
        pushLog("NXiSAS open ?쒖옉");

        await new Promise<void>((resolve, reject) => {
          try {
            if (typeof nx.open !== "function") {
              pushLog("nx.open ?⑥닔媛 ?놁뒿?덈떎. (?섍꼍蹂꾨줈 ?앸왂 媛?? ??怨꾩냽 吏꾪뻾");
              openedRef.current = true;
              return resolve();
            }

            nx.open(1, (msg: any) => {
              // Result: "OK" / "ALREADY" ??
              pushLog(`NXiSAS open retry callback: ${JSON.stringify(msg)}`);
              openedRef.current = true;
              resolve();
            });
          } catch (e: any) {
            reject(new Error(`nx.open ?ㅽ뙣: ${e?.message || String(e)}`));
          }
        });

        pushLog("NXiSAS ready");
        setState("ready");

        // ?좎쭨 泥댄겕
        if (!isYmd(startDate) || !isYmd(endDate)) {
          throw new Error("startDate/endDate媛 ?좏슚?섏? ?딆뒿?덈떎. (YYYY-MM-DD)");
        }

        if (mode === "connect_then_scrape") {
          await runConnectThenScrape();
        } else if (mode === "scrape_only") {
          await runScrapeOnly();
        } else {
          pushLog(`?????녿뒗 mode: ${mode}`);
        }

        setState("done");
        pushLog("?꾨즺");

        const fallback = `/app/event/${eventId}/report`;
        const to = returnTo || fallback;

        pushLog(`?대룞: ${to}`);
        nav(to);
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e?.message || String(e));
        setState("error");
        pushLog(`?ㅻ쪟: ${e?.message || String(e)}`);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  /**
   * A) ?몄쬆???좏깮 ???곌껐 ????곕━ DB) ??利됱떆 1???ㅽ겕?섑븨(議고쉶 API ?ㅽ뻾) ??Edge Function 諛섏쁺
   */
  async function runConnectThenScrape() {
    setState("cert_select");

    // ??certLayer/flag 珥덇린???쒗뙘???ㅼ떆 ?덉뿴由쇄?諛⑹?)
    try {
      document.querySelector("#certLayer")?.remove();
    } catch {}
    window.__CERT_OPENED__ = false;

    const nx = window.CooconiSASNX;
    if (!nx) throw new Error("CooconiSASNX媛 ?놁뒿?덈떎.");

    pushLog("?몄쬆??紐⑸줉 議고쉶");

    // ?뱀떆 open???꾨즺?섏? ?딆븯?ㅻ㈃ 諛⑹뼱?곸쑝濡?1?????쒕룄
    if (!openedRef.current && typeof nx.open === "function") {
      pushLog("open not completed yet; retrying nx.open");
      await new Promise<void>((resolve) => {
        try {
          nx.open(1, (msg: any) => {
            pushLog(`NXiSAS open retry callback: ${JSON.stringify(msg)}`);
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
          if (!Array.isArray(list)) return reject(new Error("?몄쬆??紐⑸줉 議고쉶 ?ㅽ뙣"));
          resolve(list);
        });
      } catch (e: any) {
        reject(new Error(`nx.getCertList ?덉쇅: ${e?.message || String(e)}`));
      }
    });

    pushLog(`?몄쬆??${certList.length}媛?諛쒓껄`);

    const $ = window.$;
    if (!$) throw new Error("jQuery($)媛 ?놁뒿?덈떎.");

    // ??以묐났 ?몄텧 諛⑹? (isasscaping.js履쎌뿉?쒕룄 以묐났 諛⑹? 蹂?섍? ?덉쓣 ???덉쓬)
    // makeCertManager는 selector가 비어있을 때만 HTML을 생성하므로, 기존 레이어는 제거.
    if (window.__CERT_OPENED__) {
      pushLog("?몄쬆???앹뾽???대? ?대젮?덈뒗 寃껋쑝濡?媛먯?????媛뺤젣 珥덇린?????ъ삤??");
    }
    try {
      $("#certLayer").remove();
    } catch {}
    window.__CERT_OPENED__ = false;

    pushLog("?몄쬆???좏깮 ?앹뾽 ?쒖떆");
    window.__CERT_OPENED__ = true;

    const certMeta = await new Promise<any>((resolve, reject) => {
      try {
        $("#certLayer").makeCertManager((data: any) => {
          // ?ロ옒 泥섎━
          window.__CERT_OPENED__ = false;
          try {
            document.querySelector("#certLayer")?.remove();
          } catch {}
          resolve(data);
        });
      } catch (_e) {
        window.__CERT_OPENED__ = false;
        reject(new Error("?몄쬆???앹뾽 ?앹꽦 ?ㅽ뙣(makeCertManager)"));
      }
    });

    pushLog("?몄쬆???좏깮 ?꾨즺");
    if (certMeta) {
      const brief = {
        User: certMeta?.User,
        Issuer: certMeta?.Issuer,
        ExpiryDate: certMeta?.ExpiryDate,
        Type: certMeta?.Type,
      };
      pushLog(`CERT: ${JSON.stringify(brief)}`);
    }

    // ??DB???곌껐?꾨즺 ???+ scrapeAccountId ?뺣낫
    const scrapeAccountId = await upsertConnectedAccount(eventId, certMeta);

    // ???몄쬆 吏곹썑 1???먮룞 媛깆떊
    await runScrapeWithQueryApiAndReflect(scrapeAccountId);
  }

  /**
   * B) ?ㅽ겕?섑븨 ?ㅽ뻾留?
   * - ?몄쬆???대? ?꾨즺?섏뼱 scrapeAccountId媛 DB??議댁옱?쒕떎怨?媛??
   * - 理쒖떊 verified_at 怨꾩젙?쇰줈 議고쉶 ?ㅽ뻾
   */
  async function runScrapeOnly() {
    setState("scraping");
    pushLog("?ㅽ겕?섑븨 怨꾩젙 議고쉶");

    const { data: acc, error } = await supabase
      .from("event_scrape_accounts")
      .select("id")
      .eq("event_id", eventId)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`?ㅽ겕?섑븨 怨꾩젙 議고쉶 ?ㅽ뙣: ${error.message}`);
    if (!acc?.id) throw new Error("?ㅽ겕?섑븨 怨꾩젙???놁뒿?덈떎. (癒쇱? ?몄쬆???꾩슂)");

    await runScrapeWithQueryApiAndReflect(acc.id);
  }

  /**
   * ???몄쬆 吏곹썑: event_scrape_accounts upsert (id ?뺣낫)
   * - certified meta瑜?raw濡???ν빐?먮㈃ ?붾쾭源낆뿉 ?꾩???而щ읆???덉쑝硫?
   */
  async function upsertConnectedAccount(evId: string, certMeta: any): Promise<string> {
    const { data: userRes } = await supabase.auth.getUser();
    const userEmail = userRes?.user?.email || null;

    // ?좑툘 而щ읆? ??DB??留욎떠????
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

    if (error) throw new Error(`DB ?곌껐?곹깭 ????ㅽ뙣: ${error.message}`);
    if (!data?.id) throw new Error("DB ?곌껐?곹깭 ??μ? ?먯?留?id瑜?媛?몄삤吏 紐삵뻽?듬땲??");

    pushLog(`DB???섏씤利앹셿猷??곌껐?꾨즺?????(scrapeAccountId=${data.id})`);
    return data.id as string;
  }

  /**
   * ???듭떖: ?쒖“??API ?ㅽ뻾 ??Output ?섏떊 ??Edge Function 諛섏쁺??
   */
  async function runScrapeWithQueryApiAndReflect(scrapeAccountId: string) {
    setState("scraping");

    if (!startDate || !endDate) {
      throw new Error("startDate/endDate媛 鍮꾩뼱?덉뒿?덈떎. (ResultPage?먯꽌 ?좎쭨瑜??ｌ뼱 蹂대궡????");
    }
    if (!isYmd(startDate) || !isYmd(endDate)) {
      throw new Error("startDate/endDate ?뺤떇 ?ㅻ쪟 (YYYY-MM-DD)");
    }

    const nx = window.CooconiSASNX;
    if (!nx) throw new Error("CooconiSASNX媛 ?놁뒿?덈떎.");

    pushLog(`議고쉶 API ?ㅽ뻾: ${apiId} (${startDate} ~ ${endDate})`);

    /**
     * ???ш린 params???쒖퓼肄?媛?대뱶??議고쉶 ?뚮씪誘명꽣?앸줈 留욎떠????
     * 吏湲덉? 理쒖냼???좎쭨留??ｊ퀬, ?꾩슂??媛믪? 異뷀썑 ?뺤젙?섎㈃ 異붽?.
     */
    const params: any = {
      startDate,
      endDate,
      // bankCode, accountNo ?깆? 荑좎퐯 ?ㅽ럺 ?뺤젙?섎㈃ 異붽?
    };

    // 1) 議고쉶 ?ㅽ뻾 ??Output 諛쏄린
    let output: any;
    try {
      output = await callCooconApi(nx, apiId, params);
    } catch (e: any) {
      pushLog(`議고쉶 API ?ㅽ뙣: ${e?.message || String(e)}`);
      throw new Error(`議고쉶 API ?몄텧 ?ㅽ뙣(硫붿꽌???ㅽ럺 ?뺤씤 ?꾩슂): ${e?.message || String(e)}`);
    }

    pushLog("議고쉶 寃곌낵 ?섏떊(?먮낯 Output ?뺣낫)");

    // 2) Edge Function?쇰줈 諛섏쁺 (cooconOutput 洹몃?濡??꾨떖 ???쒕쾭?먯꽌 normalize)
    pushLog(`Edge Function ?몄텧: coocon-scrape-transactions (${startDate} ~ ${endDate})`);

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("濡쒓렇?몄씠 ?꾩슂?⑸땲??");

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
        // ???쒕쾭?먯꽌 normalizeFromCooconOutput濡??뚯떛
        cooconOutput: output,
      }),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = j?.message || j?.error || `議고쉶 ?ㅽ뙣(${res.status})`;
      throw new Error(msg);
    }

    const fetched = j.fetched ?? 0;
    const insertedTx = j.insertedTx ?? 0;
    const reflectedNew = j.reflectedLedgerNew ?? 0;
    const reflectedTotal = j.reflectedLedgerTotal ?? 0;

    pushLog(
      `媛깆떊 ?깃났: fetched=${fetched}, insertedTx=${insertedTx}, ledgerNew=${reflectedNew}, ledgerTotal=${reflectedTotal}`
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => nav(-1)}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          ???ㅻ줈
        </button>
        <h1 style={{ margin: 0, fontSize: 18 }}>荑좎퐯 怨꾩쥖 ?몄쬆/?ㅽ겕?섑븨</h1>
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
          <b>?ㅻ쪟</b>
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
          * ???붾㈃? PC?먯꽌留??뺤긽 ?숈옉(?붿쭊/?몄쬆???꾩슂). 紐⑤컮?쇱? 留됯굅???덈궡留??꾩슦??寃?留욎쓬.
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          * ?먮쫫: ?몄쬆 ?꾨즺 ??DB ?????議고쉶 API ?ㅽ뻾 ??Output ?섏떊 ??Edge Function?쇰줈 DB 諛섏쁺 ??由ы룷??蹂듦?
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          * apiId(嫄곕옒?댁뿭 議고쉶 ?앸퀎??: <b>{apiId}</b> (?꾩슂 ??URL??<code>&amp;apiId=...</code> 濡?援먯껜)
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>濡쒓렇</h2>
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





