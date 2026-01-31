// src/pages/ResultPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

interface RouteParams {
  eventId: string;
}

/** ---------- Types (유연하게: 컬럼 바뀌어도 최대한 깨지지 않게) ---------- */
type EventSettingsRow = {
  id: string;
  event_id: string;
  ceremony_date: string | null;
  ceremony_start_time: string | null;
  ceremony_end_time: string | null;
  recipients: any | null;
  mobile_invitation_link?: string | null;
};

type EventRow = {
  id: string;
  groom_name?: string | null;
  bride_name?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  [k: string]: any;
};

type MemberRow = {
  id: string;
  event_id: string;
  user_id: string | null;
  email: string | null;
  role?: string | null;
  [k: string]: any;
};

type ScrapeAccountRow = {
  id: string;
  event_id: string;
  owner_user_id: string | null;
  provider: string | null;
  bank_code: string | null;
  bank_name: string | null;
  account_masked: string | null;
  status: string | null;
  verified_at: string | null;
  [k: string]: any;
};

type LedgerRow = {
  id: string;
  event_id: string;
  owner_member_id?: string | null;

  guest_name?: string | null;
  relationship?: string | null;

  amount?: number | null;
  payment_method?: string | null; // 'qr' | 'cash' | 'etc' 등
  is_attended?: boolean | null;

  created_source?: string | null; // 'scrape' | 'manual' | 'excel' 등
  created_at?: string | null;

  memo?: string | null;
  phone?: string | null;

  [k: string]: any;
};

type MessageRow = {
  id: string;
  event_id: string;
  created_at: string;
  side?: string | null;
  guest_name?: string | null;
  nickname?: string | null;
  relationship?: string | null;
  body: string;
  [k: string]: any;
};

type TabKey = "ledger" | "messages";

/** ---------- Helpers ---------- */
function ymdTodayKST(): string {
  // 브라우저 로컬이 KST인 전제(너 환경 기준)
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toISODateTimeKST(ymd: string, hhmm: string): Date | null {
  if (!ymd || !hhmm) return null;
  const [hh, mm] = hhmm.split(":");
  if (hh == null || mm == null) return null;

  // 로컬 타임존 기반 Date 생성 (KST 환경 가정)
  const d = new Date(`${ymd}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`);
  return isNaN(d.getTime()) ? null : d;
}

function formatMoney(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("ko-KR");
}

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickName(row: any) {
  const a = String(row?.guest_name ?? "").trim();
  if (a) return a;
  const b = String(row?.name ?? "").trim();
  if (b) return b;
  return "이름없음";
}

function pickRelationship(row: any) {
  const r = String(row?.relationship ?? "").trim();
  return r || "-";
}

function pickAmount(row: any) {
  const a = row?.amount;
  if (a == null) return 0;
  return safeNum(a);
}

function isScrapeLockedBySource(row: LedgerRow): boolean {
  return String(row?.created_source ?? "") === "scrape";
}

function isTruthy(v: any) {
  return v === true || v === "true" || v === 1 || v === "1";
}

/** ---------- Excel: Sample & Export ---------- */
function makeSampleWorkbook(opts: { groom?: string; bride?: string; date?: string }) {
  const sheetName = "축의금_업로드";
  const headers = [
    "이름",
    "관계",
    "금액",
    "참석여부(Y/N)",
    "방식(qr/cash/etc)",
    "메모(선택)",
    "연락처(선택)",
  ];

  const rows = [
    headers,
    ["홍길동", "회사동료", "50000", "Y", "qr", "", ""],
    ["김영희", "친구", "100000", "N", "cash", "현금으로 받음", "010-0000-0000"],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  // autofilter
  ws["!autofilter"] = { ref: `A1:G1` };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const base = `${opts.groom ?? "신랑"}_${opts.bride ?? "신부"}_웨딩리포트_${opts.date ?? ymdTodayKST()}`;
  const filename = `${base}_샘플.xlsx`;

  return { wb, filename };
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

function parseExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const first = wb.SheetNames[0];
        const ws = wb.Sheets[first];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" }); // header: A1 row 기준
        resolve(json as any[]);
      } catch (err: any) {
        reject(new Error(err?.message ?? "엑셀 파싱 오류"));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function normalizeYN(v: any): boolean | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return null;
  if (s === "Y" || s === "YES" || s === "TRUE" || s === "1") return true;
  if (s === "N" || s === "NO" || s === "FALSE" || s === "0") return false;
  return null;
}

function normalizeMethod(v: any): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "qr" || s === "qrcode") return "qr";
  if (s === "cash" || s === "현금") return "cash";
  return s; // etc / transfer / ...
}

function normalizeAmountCell(v: any): number | null {
  const s = String(v ?? "").replace(/[^\d.-]/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n);
}

/** ---------- Component ---------- */
export default function ResultPage() {
  const { eventId } = useParams<RouteParams>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [toast, setToast] = useState<{ type: "info" | "error"; text: string } | null>(null);

  const [event, setEvent] = useState<EventRow | null>(null);
  const [settings, setSettings] = useState<EventSettingsRow | null>(null);
  const [me, setMe] = useState<{ userId: string; email: string | null } | null>(null);
  const [member, setMember] = useState<MemberRow | null>(null);

  const [tab, setTab] = useState<TabKey>("ledger");

  // Ledger
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Messages
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Scrape account
  const [scrapeAccount, setScrapeAccount] = useState<ScrapeAccountRow | null>(null);

  // quick add
  const [qaName, setQaName] = useState("");
  const [qaRel, setQaRel] = useState("지인");
  const [qaRelCustom, setQaRelCustom] = useState("");
  const [qaAmount, setQaAmount] = useState("");
  const [qaAttend, setQaAttend] = useState<boolean>(true);

  // excel upload
  const fileRef = useRef<HTMLInputElement | null>(null);

  // stale 방지용 ref(니가 언급한 패턴)
  const ledgerRef = useRef<LedgerRow[]>([]);
  useEffect(() => {
    ledgerRef.current = ledger;
  }, [ledger]);

  // toast auto close
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  /** ---------- Derived: cutoff / lock ---------- */
  const ceremonyStart = useMemo(() => {
    const ymd = settings?.ceremony_date ?? "";
    const t = settings?.ceremony_start_time ?? "";
    return toISODateTimeKST(ymd, t);
  }, [settings?.ceremony_date, settings?.ceremony_start_time]);

  const ceremonyEnd = useMemo(() => {
    const ymd = settings?.ceremony_date ?? "";
    const t = settings?.ceremony_end_time ?? "";
    return toISODateTimeKST(ymd, t);
  }, [settings?.ceremony_date, settings?.ceremony_end_time]);

  const isAfterCutoff = useMemo(() => {
    if (!ceremonyEnd) return false;
    return new Date().getTime() > ceremonyEnd.getTime();
  }, [ceremonyEnd]);

  const lockLabel = useMemo(() => {
    if (!ceremonyEnd) return "QR 반영 마감: (예식 종료시간 미설정)";
    const hh = String(ceremonyEnd.getHours()).padStart(2, "0");
    const mm = String(ceremonyEnd.getMinutes()).padStart(2, "0");
    return `QR 반영 마감: ${hh}:${mm} (예식 종료)`;
  }, [ceremonyEnd]);

  /** ---------- Load bootstrap ---------- */
  useEffect(() => {
    if (!eventId) return;
    void bootstrap(eventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function bootstrap(evId: string) {
    setLoading(true);
    setBusy(false);

    try {
      // auth
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!userRes?.user) throw new Error("로그인이 필요합니다.");
      const userId = userRes.user.id;
      const email = userRes.user.email ?? null;
      setMe({ userId, email });

      // events
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", evId)
        .maybeSingle();
      if (eventError) throw eventError;
      setEvent((eventData ?? { id: evId }) as EventRow);

      // settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("event_settings")
        .select("id,event_id,ceremony_date,ceremony_start_time,ceremony_end_time,recipients,mobile_invitation_link")
        .eq("event_id", evId)
        .maybeSingle();
      if (settingsError) throw settingsError;
      setSettings(settingsData as any);

      // member (user_id 우선, 없으면 email)
      let mem: MemberRow | null = null;

      const { data: memByUid, error: memUidErr } = await supabase
        .from("event_members")
        .select("*")
        .eq("event_id", evId)
        .eq("user_id", userId)
        .maybeSingle();
      if (memUidErr) throw memUidErr;
      if (memByUid) mem = memByUid as any;

      if (!mem && email) {
        const { data: memByEmail, error: memEmailErr } = await supabase
          .from("event_members")
          .select("*")
          .eq("event_id", evId)
          .eq("email", email)
          .maybeSingle();
        if (memEmailErr) throw memEmailErr;
        if (memByEmail) mem = memByEmail as any;
      }

      setMember(mem);

      // scrape account (latest verified_at)
      await refreshScrapeAccount(evId, userId);

      // load initial
      await Promise.all([refreshLedger(evId), refreshMessages(evId)]);
    } catch (e: any) {
      console.error("[ResultPage] bootstrap error:", e);
      setToast({ type: "error", text: e?.message ?? "초기 로딩 실패" });
    } finally {
      setLoading(false);
    }
  }

  async function refreshScrapeAccount(evId: string, userId: string) {
    // 정책: event_scrape_accounts는 latest verified_at 기준 선택
    const { data, error } = await supabase
      .from("event_scrape_accounts")
      .select("*")
      .eq("event_id", evId)
      .eq("owner_user_id", userId)
      .eq("provider", "coocon")
      .order("verified_at", { ascending: false, nullsFirst: false })
      .limit(1);

    if (error) {
      console.warn("[ResultPage] refreshScrapeAccount error:", error);
      setScrapeAccount(null);
      return;
    }
    setScrapeAccount((data?.[0] ?? null) as any);
  }

  async function refreshLedger(evId: string) {
    setLedgerLoading(true);
    try {
      const { data, error } = await supabase
        .from("event_ledger_entries")
        .select("*")
        .eq("event_id", evId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLedger((data ?? []) as any);
    } catch (e: any) {
      console.error("[ResultPage] refreshLedger error:", e);
      setToast({ type: "error", text: e?.message ?? "장부 로딩 실패" });
    } finally {
      setLedgerLoading(false);
    }
  }

  async function refreshMessages(evId: string) {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("event_id", evId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setMessages((data ?? []) as any);
    } catch (e: any) {
      console.error("[ResultPage] refreshMessages error:", e);
      setToast({ type: "error", text: e?.message ?? "메시지 로딩 실패" });
    } finally {
      setMessagesLoading(false);
    }
  }

  /** ---------- Stats ---------- */
  const stats = useMemo(() => {
    const totalMoney = ledger.reduce((acc, r) => acc + pickAmount(r), 0);

    // qr 기준 축의금: payment_method === 'qr' 또는 created_source === 'scrape'를 qr로 간주(현 정책상)
    const qrMoney = ledger.reduce((acc, r) => {
      const method = String(r.payment_method ?? "").toLowerCase();
      const src = String(r.created_source ?? "").toLowerCase();
      const isQr = method === "qr" || src === "scrape";
      return acc + (isQr ? pickAmount(r) : 0);
    }, 0);

    const totalGuests = ledger.length;

    // qr 기준 하객: payment_method === 'qr' or created_source='scrape'
    const qrGuests = ledger.filter((r) => {
      const method = String(r.payment_method ?? "").toLowerCase();
      const src = String(r.created_source ?? "").toLowerCase();
      return method === "qr" || src === "scrape";
    }).length;

    return { totalMoney, qrMoney, totalGuests, qrGuests };
  }, [ledger]);

  /** ---------- Actions: Coocon ---------- */
  function goCooconScrape() {
    if (!eventId) return;
    navigate(`/coocon/scrape?eventId=${encodeURIComponent(eventId)}`);
  }

  async function runScrapeNow() {
    if (!eventId) return;
    if (!me?.userId) {
      setToast({ type: "error", text: "로그인이 필요합니다." });
      return;
    }

    // 종료 이후 잠금
    if (isAfterCutoff) {
      setToast({ type: "error", text: "예식 종료 이후에는 QR(쿠콘) 반영이 마감됩니다." });
      return;
    }

    // 연결 여부
    const connected =
      scrapeAccount &&
      (String(scrapeAccount.status ?? "").includes("connected") ||
        !!scrapeAccount.verified_at);

    if (!connected) {
      // 인증 유도
      goCooconScrape();
      return;
    }

    // 여기서는 “서버가 cooconOutput 없이도 스크래핑을 수행한다” 전제로 호출.
    // (만약 현재 Edge Function이 cooconOutput 필요하면 0건 나올 수 있음 → 4/5번에서 맞춤)
    const scrapeAccountId = scrapeAccount!.id;

    const startDate = settings?.ceremony_date ?? ymdTodayKST();
    const endDate = settings?.ceremony_date ?? ymdTodayKST();

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("coocon-scrape-transactions", {
        body: {
          eventId,
          scrapeAccountId,
          startDate,
          endDate,
          // cooconOutput: undefined (서버에서 호출/정규화한다는 전제)
        },
      });

      if (error) throw error;

      const insertedTx = Number(data?.insertedTx ?? 0);
      const fetched = Number(data?.fetched ?? 0);

      setToast({
        type: "info",
        text: `QR 축의금 갱신 완료 (fetched ${fetched}, inserted ${insertedTx})`,
      });

      // 갱신 후 장부 재조회
      await refreshLedger(eventId);
    } catch (e: any) {
      console.error("[ResultPage] runScrapeNow error:", e);
      setToast({ type: "error", text: e?.message ?? "갱신 실패" });
    } finally {
      setBusy(false);
    }
  }

  /** ---------- Actions: Ledger Quick Add ---------- */
  async function quickAdd() {
    if (!eventId) return;
    if (!member?.id) {
      setToast({ type: "error", text: "권한(event_members)을 확인할 수 없습니다. (초대/멤버 필요)" });
      return;
    }

    const name = qaName.trim();
    if (!name) return setToast({ type: "error", text: "이름을 입력해주세요." });

    const rel = qaRel === "기타" ? qaRelCustom.trim() : qaRel.trim();
    if (!rel) return setToast({ type: "error", text: "관계를 선택/입력해주세요." });

    const amt = normalizeAmountCell(qaAmount);
    if (!amt) return setToast({ type: "error", text: "금액을 입력해주세요." });

    setBusy(true);
    try {
      const payload: any = {
        event_id: eventId,
        owner_member_id: member.id,
        guest_name: name,
        relationship: rel,
        amount: amt,
        is_attended: qaAttend,
        payment_method: "cash", // “빠른추가”는 기본 현금/수기 성격
        created_source: "manual",
      };

      const { error } = await supabase.from("event_ledger_entries").insert(payload);
      if (error) throw error;

      setQaName("");
      setQaRel("지인");
      setQaRelCustom("");
      setQaAmount("");
      setQaAttend(true);

      setToast({ type: "info", text: "추가 완료" });
      await refreshLedger(eventId);
    } catch (e: any) {
      console.error("[ResultPage] quickAdd error:", e);
      setToast({ type: "error", text: e?.message ?? "추가 실패" });
    } finally {
      setBusy(false);
    }
  }

  /** ---------- Actions: Excel ---------- */
  function downloadSample() {
    const groom = event?.groom_name ?? "신랑";
    const bride = event?.bride_name ?? "신부";
    const date = settings?.ceremony_date ?? ymdTodayKST();
    const { wb, filename } = makeSampleWorkbook({ groom, bride, date });
    downloadWorkbook(wb, filename);
  }

  async function uploadExcel(file: File) {
    if (!eventId) return;
    if (!member?.id) {
      setToast({ type: "error", text: "업로드 권한이 없습니다. (event_members 매칭 필요)" });
      return;
    }

    setBusy(true);
    try {
      const rows = await parseExcelFile(file);

      // 헤더명이 정확히 일치한다는 전제는 위험 → 최대한 유연하게 매핑
      // 기대 컬럼: 이름, 관계, 금액, 참석여부(Y/N), 방식(qr/cash/etc), 메모(선택), 연락처(선택)
      const payloads: any[] = [];

      for (const r of rows) {
        // sheet_to_json은 헤더명을 키로 사용
        const name = String(r["이름"] ?? r["성명"] ?? r["name"] ?? "").trim();
        const rel = String(r["관계"] ?? r["relationship"] ?? "").trim();
        const amt = normalizeAmountCell(r["금액"] ?? r["amount"]);
        const attend = normalizeYN(r["참석여부(Y/N)"] ?? r["참석여부"] ?? r["attendance"]);
        const method = normalizeMethod(r["방식(qr/cash/etc)"] ?? r["방식"] ?? r["method"]);
        const memo = String(r["메모(선택)"] ?? r["메모"] ?? "").trim() || null;
        const phone = String(r["연락처(선택)"] ?? r["연락처"] ?? r["phone"] ?? "").trim() || null;

        if (!name || !rel || !amt) continue;

        payloads.push({
          event_id: eventId,
          owner_member_id: member.id,
          guest_name: name,
          relationship: rel,
          amount: amt,
          is_attended: attend,
          payment_method: method ?? "etc",
          memo,
          phone,
          created_source: "excel",
        });
      }

      if (payloads.length === 0) {
        setToast({ type: "error", text: "업로드할 유효 데이터가 없습니다. (이름/관계/금액 필수)" });
        return;
      }

      const { error } = await supabase.from("event_ledger_entries").insert(payloads);
      if (error) throw error;

      setToast({ type: "info", text: `업로드 완료 (${payloads.length}건)` });
      await refreshLedger(eventId);
    } catch (e: any) {
      console.error("[ResultPage] uploadExcel error:", e);
      setToast({ type: "error", text: e?.message ?? "업로드 실패" });
    } finally {
      setBusy(false);
    }
  }

  async function downloadLedgerExcel() {
    // 니 정책: 샘플은 항상 가능, “다운로드(실데이터)”는 멤버 권한 있으면 좋지만, 여기선 막지 않음
    const sheetName = "웨딩_리포트";
    const rows = ledgerRef.current ?? [];

    // 보기 좋은 열만 export (니가 말한 “장부관리 3컬럼 중심”을 기반으로)
    const exportRows = rows.map((r) => ({
      이름: pickName(r),
      관계: pickRelationship(r),
      금액: pickAmount(r),
      참석여부: isTruthy(r.is_attended) ? "Y" : "N",
      방식: r.payment_method ?? (r.created_source === "scrape" ? "qr" : "etc"),
      데이터출처: r.created_source ?? "",
      메모: r.memo ?? "",
      연락처: r.phone ?? "",
      생성일시: r.created_at ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!autofilter"] = { ref: `A1:I1` };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const groom = event?.groom_name ?? "신랑";
    const bride = event?.bride_name ?? "신부";
    const date = settings?.ceremony_date ?? ymdTodayKST();
    const filename = `${groom}_${bride}_웨딩리포트_${date}.xlsx`;

    downloadWorkbook(wb, filename);
  }

  /** ---------- Actions: Messages PDF Save (Print) ---------- */
  function printMessages() {
    // 간단하게 현재 페이지 인쇄(메시지 탭일 때)
    window.print();
  }

  /** ---------- Render ---------- */
  if (loading) {
    return (
      <div className="p-6">
        <p>로딩 중...</p>
      </div>
    );
  }

  if (!eventId) {
    return (
      <div className="p-6">
        <p>eventId가 없습니다.</p>
      </div>
    );
  }

  const connected =
    scrapeAccount &&
    (String(scrapeAccount.status ?? "").includes("connected") || !!scrapeAccount.verified_at);

  const headerTitle = `${event?.groom_name ?? "신랑"} · ${event?.bride_name ?? "신부"} 리포트`;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999]">
          <div
            className={`px-4 py-2 rounded-full text-xs shadow-lg border backdrop-blur bg-white/90 ${
              toast.type === "error" ? "border-red-200 text-red-700" : "border-gray-200 text-gray-700"
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight">{headerTitle}</h1>
          <div className="mt-1 text-xs text-gray-500">
            {settings?.ceremony_date ? `${settings.ceremony_date}` : "예식 날짜 미설정"} ·{" "}
            {event?.venue_name ?? "예식장 미설정"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="text-xs md:text-sm text-gray-500 underline underline-offset-4 hover:text-gray-900"
          >
            이벤트 홈
          </button>
          <button
            type="button"
            onClick={() => navigate(`/app/event/${eventId}/settings`)}
            className="text-xs md:text-sm text-gray-500 underline underline-offset-4 hover:text-gray-900"
          >
            설정
          </button>
        </div>
      </div>

      {/* Coocon scrape action */}
      <div className="bg-white/70 border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-black text-slate-900">QR 축의금 갱신하기</div>
            <div className="text-[11px] text-slate-500">
              {lockLabel} ·{" "}
              {connected ? (
                <span className="text-emerald-700 font-semibold">
                  연결됨 {scrapeAccount?.bank_name ? `(${scrapeAccount.bank_name})` : ""}
                </span>
              ) : (
                <span className="text-slate-600">미연결 (인증 필요)</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              정책: <b>예식 종료 이후</b>에는 QR(쿠콘) 반영이 마감되며, 스크래핑 데이터는 수정할 수 없습니다. (엑셀/수기는 계속 수정 가능)
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            {!connected && (
              <button
                type="button"
                onClick={goCooconScrape}
                className="px-4 py-2 rounded-full border bg-white text-xs md:text-sm hover:bg-slate-50"
              >
                쿠콘 인증하기
              </button>
            )}

            <button
              type="button"
              onClick={runScrapeNow}
              disabled={busy || isAfterCutoff}
              className="px-4 py-2 rounded-full bg-black text-white text-xs md:text-sm hover:opacity-90 disabled:opacity-50"
            >
              {isAfterCutoff ? "QR 반영 마감" : busy ? "갱신 중..." : "축의금 갱신하기"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] text-slate-500 font-semibold">총 축의금</div>
          <div className="mt-1 text-xl font-black">{formatMoney(stats.totalMoney)}원</div>
          <div className="mt-1 text-[11px] text-slate-400">장부 전체 합계</div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] text-slate-500 font-semibold">QR 기준 축의금</div>
          <div className="mt-1 text-xl font-black">{formatMoney(stats.qrMoney)}원</div>
          <div className="mt-1 text-[11px] text-slate-400">스크래핑/QR 송금 기반</div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] text-slate-500 font-semibold">총 하객</div>
          <div className="mt-1 text-xl font-black">{formatMoney(stats.totalGuests)}</div>
          <div className="mt-1 text-[11px] text-slate-400">장부 기준 인원</div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] text-slate-500 font-semibold">QR 기준 하객</div>
          <div className="mt-1 text-xl font-black">{formatMoney(stats.qrGuests)}</div>
          <div className="mt-1 text-[11px] text-slate-400">QR/스크래핑 기반</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("ledger")}
          className={`px-4 py-2 rounded-full text-xs md:text-sm border ${
            tab === "ledger" ? "bg-black text-white border-black" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          장부 관리
        </button>
        <button
          type="button"
          onClick={() => setTab("messages")}
          className={`px-4 py-2 rounded-full text-xs md:text-sm border ${
            tab === "messages" ? "bg-black text-white border-black" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          메시지
        </button>
      </div>

      {/* Ledger tab */}
      {tab === "ledger" && (
        <div className="space-y-4">
          {/* 관리 도구 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-900">엑셀로 관리하기</div>
                <div className="text-[11px] text-slate-500">
                  샘플은 언제든 다운로드 가능 · 업로드는 로그인/멤버 권한이 필요합니다.
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={downloadSample}
                  className="px-4 py-2 rounded-full border bg-white text-xs md:text-sm hover:bg-slate-50"
                >
                  엑셀 샘플 다운로드
                </button>

                <button
                  type="button"
                  onClick={downloadLedgerExcel}
                  className="px-4 py-2 rounded-full border bg-white text-xs md:text-sm hover:bg-slate-50"
                >
                  엑셀 다운로드
                </button>

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={!member?.id}
                  className="px-4 py-2 rounded-full bg-black text-white text-xs md:text-sm hover:opacity-90 disabled:opacity-50"
                  title={!member?.id ? "업로드 권한(event_members)이 필요합니다." : ""}
                >
                  엑셀 업로드
                </button>

                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    await uploadExcel(f);
                  }}
                />
              </div>
            </div>
          </div>

          {/* 빠른 추가 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <div className="text-sm font-black text-slate-900">빠른 추가</div>
            <div className="mt-1 text-[11px] text-slate-500">현금/수기 등 빠르게 입력할 때 사용하세요. (스크래핑 데이터는 수정불가)</div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                className="border rounded-xl px-3 py-2 text-sm"
                placeholder="이름"
                value={qaName}
                onChange={(e) => setQaName(e.target.value)}
              />

              <div className="flex gap-2">
                <select
                  className="border rounded-xl px-3 py-2 text-sm w-full"
                  value={qaRel}
                  onChange={(e) => setQaRel(e.target.value)}
                >
                  <option value="지인">지인</option>
                  <option value="친구">친구</option>
                  <option value="가족">가족</option>
                  <option value="회사">회사</option>
                  <option value="기타">기타(직접)</option>
                </select>
                {qaRel === "기타" && (
                  <input
                    className="border rounded-xl px-3 py-2 text-sm w-full"
                    placeholder="관계 입력"
                    value={qaRelCustom}
                    onChange={(e) => setQaRelCustom(e.target.value)}
                  />
                )}
              </div>

              <input
                className="border rounded-xl px-3 py-2 text-sm"
                placeholder="금액"
                value={qaAmount}
                onChange={(e) => setQaAmount(e.target.value)}
              />

              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={qaAttend}
                    onChange={(e) => setQaAttend(e.target.checked)}
                  />
                  참석
                </label>
                <button
                  type="button"
                  onClick={quickAdd}
                  disabled={busy}
                  className="px-4 py-2 rounded-full bg-black text-white text-xs md:text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "처리 중..." : "추가"}
                </button>
              </div>
            </div>
          </div>

          {/* 장부 리스트 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-slate-900">장부 관리</div>
                <div className="text-[11px] text-slate-500">
                  PC: 표로 보기 · 모바일: 카드로 보기
                </div>
              </div>
              <button
                type="button"
                onClick={() => refreshLedger(eventId)}
                disabled={ledgerLoading}
                className="px-3 py-2 rounded-full border bg-white text-xs hover:bg-slate-50 disabled:opacity-50"
              >
                {ledgerLoading ? "불러오는 중..." : "새로고침"}
              </button>
            </div>

            {/* 모바일 카드 */}
            <div className="mt-3 md:hidden space-y-2">
              {ledgerLoading ? (
                <div className="py-8 text-center text-sm text-slate-500">로딩 중...</div>
              ) : ledger.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">아직 장부 데이터가 없습니다.</div>
              ) : (
                ledger.map((r) => {
                  const locked = isScrapeLockedBySource(r);
                  return (
                    <div key={r.id} className="border rounded-2xl p-3 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{pickName(r)}</div>
                        <div className="font-black">{formatMoney(pickAmount(r))}원</div>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {pickRelationship(r)} · {isTruthy(r.is_attended) ? "참석" : "미참석"} ·{" "}
                        {String(r.payment_method ?? (r.created_source === "scrape" ? "qr" : "etc"))}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        출처: {r.created_source ?? "-"} {locked ? "· (스크래핑 데이터 잠김)" : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* PC 테이블 */}
            <div className="mt-3 hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-slate-500 border-b">
                    <th className="py-2 pr-4">하객정보</th>
                    <th className="py-2 pr-4">참석여부</th>
                    <th className="py-2 pr-4">축의금 · 방식</th>
                    <th className="py-2 pr-4">출처</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerLoading ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        로딩 중...
                      </td>
                    </tr>
                  ) : ledger.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        아직 장부 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    ledger.map((r) => {
                      const locked = isScrapeLockedBySource(r);
                      return (
                        <tr key={r.id} className="border-b last:border-b-0">
                          <td className="py-3 pr-4">
                            <div className="font-semibold">{pickName(r)}</div>
                            <div className="text-[11px] text-slate-500">{pickRelationship(r)}</div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-[12px]">
                              {isTruthy(r.is_attended) ? "참석" : "미참석"}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="font-black">{formatMoney(pickAmount(r))}원</div>
                            <div className="text-[11px] text-slate-500">
                              {String(r.payment_method ?? (r.created_source === "scrape" ? "qr" : "etc"))}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="text-[12px]">
                              {r.created_source ?? "-"}
                              {locked ? <span className="text-[11px] text-slate-400"> · 잠김</span> : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-[11px] text-slate-400">
              * 스크래핑 데이터(created_source="scrape")는 수정할 수 없습니다. (엑셀/수기/현금은 계속 수정 가능)
            </div>
          </div>
        </div>
      )}

      {/* Messages tab */}
      {tab === "messages" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-slate-900">축하 메시지</div>
                <div className="text-[11px] text-slate-500">본명+(닉네임) 표기</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshMessages(eventId)}
                  disabled={messagesLoading}
                  className="px-3 py-2 rounded-full border bg-white text-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  {messagesLoading ? "불러오는 중..." : "새로고침"}
                </button>
                <button
                  type="button"
                  onClick={printMessages}
                  className="px-3 py-2 rounded-full bg-black text-white text-xs hover:opacity-90"
                >
                  축하메시지 PDF 저장
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {messagesLoading ? (
                <div className="py-8 text-center text-sm text-slate-500">로딩 중...</div>
              ) : messages.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">아직 메시지가 없습니다.</div>
              ) : (
                messages.map((m) => {
                  const realName = String(m.guest_name ?? "").trim();
                  const nick = String(m.nickname ?? "").trim();
                  const name = realName ? (nick ? `${realName} (${nick})` : realName) : nick || "익명";
                  return (
                    <div key={m.id} className="border rounded-2xl p-3 bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{name}</div>
                        <div className="text-[11px] text-slate-400">
                          {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                        </div>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">{m.relationship ? `${m.relationship}` : ""}</div>
                      <div className="mt-2 text-sm text-slate-900 whitespace-pre-wrap">{m.body}</div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-3 text-[11px] text-slate-400">
              * “PDF 저장” 버튼은 브라우저 인쇄 기능을 사용합니다. (대상: 메시지 화면)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
