// src/pages/ResultPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";

interface RouteParams {
  eventId: string;
}

type MessageRow = {
  id: string;
  created_at: string;
  side: string | null;
  guest_name: string | null;
  nickname: string | null;
  relationship: string | null;
  body: string;
};

type Recipient = {
  name: string;
  role: string;
  contact: string;
};

type EventSettingsLite = {
  ceremony_date: string | null;
  ceremony_start_time: string | null;
  ceremony_end_time: string | null;
  recipients: Recipient[] | null;
};

type TabKey = "messages" | "ledger";

type GiftMethod = "account" | "cash" | "unknown";
type CreatedSource = "manual" | "guestpage" | "import" | "scrape";

type LedgerRow = {
  id: string;
  event_id: string;
  owner_member_id: string;

  side: "groom" | "bride" | null;

  guest_name: string;
  relationship: string | null;
  guest_phone: string | null;

  attended: boolean | null;
  attended_at: string | null;

  gift_amount: number | null;
  gift_method: GiftMethod;

  ticket_count: number;
  return_given: boolean;
  thanks_done: boolean;
  memo: string | null;

  created_source?: CreatedSource | null;

  updated_at: string;
  created_at: string;
};

const PAGE_SIZE = 10;

function sourceLabel(src?: string | null) {
  if (src === "import") return "엑셀 업로드";
  if (src === "manual") return "빠른추가";
  if (src === "guestpage") return "현장 QR";
  if (src === "scrape") return "QR 축의금";
  return "빠른추가";
}

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

function formatKoreanMobile(input: string) {
  const d = onlyDigits(input).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function normalizeBool(v: any): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  if (["y", "yes", "true", "1", "o", "ok", "참석", "출석", "참"].includes(s)) return true;
  if (["n", "no", "false", "0", "x", "불참", "미참석", "불출석", "미참"].includes(s)) return false;
  return null;
}

function normalizeGiftMethod(v: any): GiftMethod {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  if (s.includes("현금") || s === "cash") return "cash";
  if (s.includes("계좌") || s.includes("이체") || s === "account") return "account";
  return "unknown";
}

function normalizeSide(v: any): "groom" | "bride" | "" {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "";
  if (s.includes("신랑") || s === "groom") return "groom";
  if (s.includes("신부") || s === "bride") return "bride";
  return "";
}

function sideToDb(side: "groom" | "bride" | null): boolean | null {
  if (side === "groom") return true;
  if (side === "bride") return false;
  return null;
}

function sideFromDb(value: any): "groom" | "bride" | null {
  if (value === true) return "groom";
  if (value === false) return "bride";
  return null;
}

function toIsoMaybe(v: any): string | null {
  if (!v) return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const js = new Date(d.y, (d.m ?? 1) - 1, d.d ?? 1, d.H ?? 0, d.M ?? 0, d.S ?? 0);
    return js.toISOString();
  }
  const s = String(v).trim();
  if (!s) return null;

  const asDate = new Date(s);
  if (!isNaN(asDate.getTime())) return asDate.toISOString();

  return null;
}

function safeNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && !isNaN(v)) return v;
  const d = onlyDigits(String(v));
  if (!d) return null;
  const n = Number(d);
  return isNaN(n) ? null : n;
}

function yyyymmdd(dateStr?: string | null) {
  const d = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${da}`;
}

// ✅ 예식 날짜 + 시각을 “로컬 시간”으로 합쳐서 Date 만들기
function combineLocalDateTimeToIso(dateStr?: string | null, timeStr?: string | null) {
  if (!dateStr || !timeStr) return null;
  const isoLike = `${dateStr}T${timeStr}:00`;
  const d = new Date(isoLike);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function initials(name: string) {
  const s = (name ?? "").trim();
  if (!s) return "G";
  const parts = s.split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  return last.slice(0, 1).toUpperCase();
}

// ✅ (추가) 짧은 시간 표기(디스플레이 느낌)
function formatKSTTime(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ResultPage() {
  const navigate = useNavigate();
  const { eventId } = useParams<RouteParams>();

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [settings, setSettings] = useState<EventSettingsLite | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 메시지 액션
  const [messagesLoading, setMessagesLoading] = useState(false);
  const messagesCaptureRef = useRef<HTMLDivElement | null>(null);

  // 축의금(스크래핑)
  const [scrapeAccountId, setScrapeAccountId] = useState<string | null>(null);
  const [txCount, setTxCount] = useState<number>(0);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<string | null>(null);

  // 탭/페이지
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<TabKey>("ledger");

  // 장부(원장)
  const [ownerMemberId, setOwnerMemberId] = useState<string | null>(null);
  const [ownerRole, setOwnerRole] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState<string>("내");
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // ✅ (중요) 최신 ledger row를 ref에 보관 (stale 방지) — 하나만 유지
  const ledgerRef = useRef<Record<string, LedgerRow>>({});
  useEffect(() => {
    const map: Record<string, LedgerRow> = {};
    for (const r of ledger) map[r.id] = r;
    ledgerRef.current = map;
  }, [ledger]);

  // 장부 필터/검색
  const [q, setQ] = useState("");
  const [onlyAttended, setOnlyAttended] = useState(false);

  // 장부 수기 추가
  const [newName, setNewName] = useState("");
  const [newRelOption, setNewRelOption] = useState("친구");
  const [newRelCustom, setNewRelCustom] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newAttended, setNewAttended] = useState<boolean | null>(null);

  // Excel UI
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [excelHelpOpen, setExcelHelpOpen] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelUploadResult, setExcelUploadResult] = useState<string | null>(null);

  // ✅ 컷오프(예식 종료 시각) = 이후부터 스크래핑 잠금
  const cutoffIso = useMemo(() => {
    return combineLocalDateTimeToIso(settings?.ceremony_date, settings?.ceremony_end_time);
  }, [settings?.ceremony_date, settings?.ceremony_end_time]);

  const scrapeLocked = useMemo(() => {
    if (!cutoffIso) return false; // 시간이 없으면 일단 잠그지 않음(운영상 안전)
    return new Date().getTime() >= new Date(cutoffIso).getTime();
  }, [cutoffIso]);

  const canRunScrape = !scrapeLocked;

  /* ------------------ 내 member id 찾기 ------------------ */
  async function resolveOwnerMemberId(): Promise<string | null> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return null;

    const user = authData.user;

    const { data, error } = await supabase
      .from("event_members")
      .select("id, role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("resolveOwnerMemberId error:", error);
      return null;
    }

    if (data?.id) {
      setOwnerLabel(data.role === "owner" ? "주최" : "내");
      setOwnerRole(data.role ?? null);
      return data.id;
    }

    setOwnerLabel("내");
    setOwnerRole(null);
    return null;
  }

  async function refreshTxCount() {
    if (!eventId) return;
    const { count, error } = await supabase
      .from("event_scrape_transactions")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("is_reflected", true);

    if (!error) setTxCount(count ?? 0);
  }

  /* ------------------ 메시지: 새로고침 ------------------ */
  async function refreshMessages() {
    if (!eventId) return;
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("id, created_at, side, guest_name, nickname, relationship, body")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (e) {
      console.error(e);
      alert("메시지를 새로고침하는 중 오류가 발생했어요.");
    } finally {
      setMessagesLoading(false);
    }
  }

  async function downloadMessagesImage(currentSliceCount: number) {
    if (!messagesCaptureRef.current) return;

    // 저장할 대상이 없으면 중단
    if (!messages.length || currentSliceCount <= 0) {
      alert("저장할 메시지가 없습니다.");
      return;
    }

    const el = messagesCaptureRef.current;

    // ✅ 캡처 안정화(폰트)
    // @ts-ignore
    if (document?.fonts?.ready) {
      // @ts-ignore
      await document.fonts.ready;
    }

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: null, // ✅ 캡처 영역 자체 배경을 그대로(디스플레이 프레임)
    });

    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `축하메시지_${yyyymmdd(settings?.ceremony_date)}_${currentSliceCount}개.png`;
    a.click();
  }

  /* ------------------ 데이터 로드 ------------------ */
  useEffect(() => {
    if (!eventId) {
      setError("잘못된 접근입니다.");
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      try {
        // 메시지
        const { data: msgData, error: msgError } = await supabase
          .from("messages")
          .select("id, created_at, side, guest_name, nickname, relationship, body")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });

        if (msgError) throw msgError;
        setMessages(msgData || []);

        // 예식 설정
        const { data: settingsData, error: setErrorRes } = await supabase
          .from("event_settings")
          .select("ceremony_date, ceremony_start_time, ceremony_end_time, recipients")
          .eq("event_id", eventId)
          .maybeSingle();

        if (setErrorRes) throw setErrorRes;
        if (settingsData) {
          setSettings({
            ceremony_date: settingsData.ceremony_date,
            ceremony_start_time: settingsData.ceremony_start_time ?? null,
            ceremony_end_time: settingsData.ceremony_end_time ?? null,
            recipients: (settingsData.recipients as Recipient[] | null) ?? null,
          });
        }

        // 스크래핑 계좌(최신)
        const { data: acc } = await supabase
          .from("event_scrape_accounts")
          .select("id")
          .eq("event_id", eventId)
          .order("verified_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (acc?.id) setScrapeAccountId(acc.id);

        // 스크래핑 반영건 수
        await refreshTxCount();

        // owner_member_id
        const memberId = await resolveOwnerMemberId();
        setOwnerMemberId(memberId ?? null);
      } catch (err) {
        console.error(err);
        setError("리포트를 불러오는 중 오류가 발생했어요.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  /* ------------------ 장부 로드 ------------------ */
  useEffect(() => {
    if (!eventId || !ownerMemberId) return;

    const fetchLedger = async () => {
      setLedgerLoading(true);
      try {
        const { data, error } = await supabase
          .from("event_ledger_entries")
          .select(
            `
            id, event_id, owner_member_id,
            side, guest_name, relationship, guest_phone,
            attended, attended_at,
            gift_amount, gift_method,
            ticket_count, return_given, thanks_done, memo,
            created_source,
            created_at, updated_at
          `
          )
          .eq("event_id", eventId)
          .eq("owner_member_id", ownerMemberId)
          .order("updated_at", { ascending: false });

        if (error) throw error;
        const rows =
          (data as any[])?.map((r) => ({
            ...r,
            side: sideFromDb((r as any).side),
          })) ?? [];
        setLedger(rows as LedgerRow[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLedgerLoading(false);
      }
    };

    fetchLedger();
  }, [eventId, ownerMemberId]);

  /* ------------------ 은행 내역 갱신 (스크래핑) ------------------ */
  const handleGenerateReport = async () => {
    if (!eventId) return;

    if (!canRunScrape) {
      setScrapeResult("예식 종료 이후에는 QR 축의금 자동 반영이 잠깁니다. (빠른추가/엑셀 입력은 계속 가능)");
      return;
    }

    setScrapeResult(null);

    const date = settings?.ceremony_date ?? "";
    const startDate = date;
    const endDate = date;

    const returnTo = encodeURIComponent(`/app/event/${eventId}/report`);
    const mode = scrapeAccountId ? "scrape_only" : "connect_then_scrape";

    const qs = new URLSearchParams({
      eventId,
      mode,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      returnTo,
    });

    navigate(`/coocon/scrape?${qs.toString()}`);
  };

  /* ------------------ 장부: 업데이트/추가 ------------------ */
  function patchLedger(id: string, nextRow: LedgerRow) {
    setLedger((prev) => prev.map((r) => (r.id === id ? nextRow : r)));
    ledgerRef.current[id] = nextRow;
  }

  function isLockedRow(row: LedgerRow) {
    return (row.created_source ?? "manual") === "scrape";
  }

  async function saveLedgerRow(rowOrId: string | LedgerRow) {
    const row: LedgerRow | undefined =
      typeof rowOrId === "string" ? ledgerRef.current[rowOrId] : rowOrId;

    if (!row) return;
    if (isLockedRow(row)) return;

    ledgerRef.current[row.id] = row;

    const payload = {
      side: sideToDb(row.side),
      guest_name: row.guest_name,
      relationship: row.relationship,
      guest_phone: row.guest_phone,
      attended: row.attended,
      attended_at: row.attended_at,
      gift_amount: row.gift_amount,
      gift_method: row.gift_method,
      ticket_count: row.ticket_count,
      return_given: row.return_given,
      thanks_done: row.thanks_done,
      memo: row.memo,
    };

    const { error } = await supabase.from("event_ledger_entries").update(payload).eq("id", row.id);

    if (error) {
      console.error(error);
      alert(`저장 실패: ${error.message}`);
    }
  }

  async function addLedgerRow() {
    if (!eventId || !ownerMemberId) return;

    if (!newName.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    const relationship = newRelOption === "기타" ? newRelCustom.trim() : newRelOption.trim();
    const giftAmount = safeNumber(newAmount);

    const payload: any = {
      event_id: eventId,
      owner_member_id: ownerMemberId,
      side: null,
      guest_name: newName.trim(),
      relationship: relationship ? relationship : null,
      guest_phone: null,
      attended: newAttended,
      attended_at: newAttended === true ? new Date().toISOString() : null,
      gift_amount: giftAmount,
      gift_method: "unknown" as GiftMethod,
      ticket_count: 0,
      return_given: false,
      thanks_done: false,
      created_source: "manual",
    };

    const { data, error } = await supabase
      .from("event_ledger_entries")
      .insert(payload)
      .select(
        `
        id, event_id, owner_member_id,
        side, guest_name, relationship, guest_phone,
        attended, attended_at,
        gift_amount, gift_method,
        ticket_count, return_given, thanks_done, memo,
        created_source,
        created_at, updated_at
      `
      )
      .maybeSingle();

    if (error) {
      console.error(error);
      alert(`추가 실패: ${error.message}`);
      return;
    }

    if (data) {
      const nextRow = {
        ...(data as any),
        side: sideFromDb((data as any).side),
      } as LedgerRow;
      setLedger((prev) => [nextRow, ...prev]);
    }

    setNewName("");
    setNewRelOption("친구");
    setNewRelCustom("");
    setNewAmount("");
    setNewAttended(null);
  }

  /* ------------------ 엑셀: 샘플 다운로드 (항상 활성) ------------------ */
  function downloadLedgerSampleExcel() {
    const sample = [
      {
        이름: "홍길동",
        관계: "친구",
        연락처: "010-1234-5678",
        "참석여부(QR스캔기준)": "참석",
        참석시간: "",
        축의금: 50000,
        "축의금방식(선택)": "현금",
        출처: "",
        "식권(매수)": 0,
        답례: "미완료",
        감사인사: "미완료",
        메모: "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "장부_입력양식");

    if (ws["!ref"]) {
      const range = XLSX.utils.decode_range(ws["!ref"]);
      ws["!autofilter"] = {
        ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: range.e.c } }),
      };
    }

    const filename = `장부_입력양식_${yyyymmdd(settings?.ceremony_date)}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  /* ------------------ 엑셀: 장부 다운로드 ------------------ */
  function downloadLedgerExcel() {
    const recipients = settings?.recipients ?? [];
    const groomName =
      recipients.find((r) => r.role === "groom" || String(r.role ?? "").includes("신랑"))?.name ?? "";
    const brideName =
      recipients.find((r) => r.role === "bride" || String(r.role ?? "").includes("신부"))?.name ?? "";

    const roleLabel = ownerRole === "groom" ? "신랑" : ownerRole === "bride" ? "신부" : "신랑or신부";
    const roleName = ownerRole === "groom" ? groomName : ownerRole === "bride" ? brideName : "";

    const rows = ledger
      .slice()
      .sort((a, b) => (a.guest_name ?? "").localeCompare(b.guest_name ?? ""))
      .map((r) => ({
        이름: r.guest_name ?? "",
        관계: r.relationship ?? "",
        연락처: r.guest_phone ?? "",
        "참석여부(QR스캔기준)": r.attended === true ? "참석" : r.attended === false ? "미참석" : "",
        참석시간: r.attended_at ? new Date(r.attended_at).toLocaleString() : "",
        축의금: r.gift_amount ?? "",
        "축의금방식(선택)": r.gift_method === "cash" ? "현금" : r.gift_method === "account" ? "계좌" : "",
        출처: sourceLabel(r.created_source ?? null),
        "식권(매수)": r.ticket_count ?? 0,
        답례: r.return_given ? "완료" : "미완료",
        감사인사: r.thanks_done ? "완료" : "미완료",
        메모: r.memo ?? "",
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "장부");

    if (ws["!ref"]) {
      const range = XLSX.utils.decode_range(ws["!ref"]);
      ws["!autofilter"] = {
        ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: range.e.c } }),
      };
    }

    const filename = `${roleLabel}_${roleName || "이름"}_웨딩리포트_${yyyymmdd(settings?.ceremony_date)}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  /* ------------------ 엑셀: 업로드 -> DB insert ------------------ */
  async function handleExcelUpload(file: File) {
    if (!eventId || !ownerMemberId) {
      alert("권한(event_members)을 찾지 못해 업로드할 수 없습니다.");
      return;
    }

    setExcelUploading(true);
    setExcelUploadResult(null);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames?.[0];
      if (!sheetName) throw new Error("엑셀 시트를 찾지 못했습니다.");
      const ws = wb.Sheets[sheetName];

      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!json.length) {
        throw new Error("업로드할 데이터가 없습니다. (첫 시트에 행이 없음)");
      }

      const key = (obj: any, candidates: string[]) => {
        for (const k of candidates) {
          if (k in obj) return obj[k];
        }
        return "";
      };

      const rowsToInsert = json
        .map((r) => {
          const guest_name = String(key(r, ["이름", "성함", "하객명"])).trim();
          if (!guest_name) return null;

          const relationship = String(key(r, ["관계", "관계(선택)"])).trim() || null;
          const guest_phone_raw = String(key(r, ["연락처", "휴대폰", "전화번호"])).trim();
          const guest_phone = guest_phone_raw ? formatKoreanMobile(guest_phone_raw) : null;

          const attendedRaw = key(r, ["참석여부(QR스캔기준)", "참석여부", "참석", "출석"]);
          const attended = normalizeBool(attendedRaw);

          const attendedAtRaw = key(r, ["참석시간", "참석시각", "attended_at"]);
          const attended_at = toIsoMaybe(attendedAtRaw);

          const gift_amount = safeNumber(key(r, ["축의금", "금액", "축의금액"]));
          const gift_method = normalizeGiftMethod(
            key(r, ["축의금방식(선택)", "축의금방식", "방식", "gift_method"])
          );

          const ticket_count = safeNumber(key(r, ["식권(매수)", "식권", "식권매수", "ticket_count"])) ?? 0;

          const return_given_raw = key(r, ["답례", "답례여부", "return_given"]);
          const return_given = normalizeBool(return_given_raw) ?? false;

          const thanks_done_raw = key(r, ["감사인사", "감사", "thanks_done"]);
          const thanks_done = normalizeBool(thanks_done_raw) ?? false;

          const memo = String(key(r, ["메모", "비고", "memo"])).trim() || null;

          const sideRaw = key(r, ["구분(선택)", "구분", "side"]);
          const sideNorm = normalizeSide(sideRaw);
          const side = sideNorm === "groom" ? true : sideNorm === "bride" ? false : null;

          return {
            event_id: eventId,
            owner_member_id: ownerMemberId,
            side,
            guest_name,
            relationship,
            guest_phone,
            attended,
            attended_at,
            gift_amount,
            gift_method: gift_method as GiftMethod,
            ticket_count,
            return_given,
            thanks_done,
            memo,
            created_source: "import" as const,
          };
        })
        .filter(Boolean) as any[];

      if (!rowsToInsert.length) {
        throw new Error("업로드할 유효 행이 없습니다. (이름 필수)");
      }

      const { data, error } = await supabase
        .from("event_ledger_entries")
        .insert(rowsToInsert)
        .select(
          `
          id, event_id, owner_member_id,
          side, guest_name, relationship, guest_phone,
          attended, attended_at,
          gift_amount, gift_method,
          ticket_count, return_given, thanks_done, memo,
          created_source,
          created_at, updated_at
        `
        );

      if (error) throw error;

      const inserted =
        (data as any[])?.map((r) => ({
          ...r,
          side: sideFromDb((r as any).side),
        })) ?? [];
      setLedger((prev) => [...(inserted as LedgerRow[]), ...prev]);

      setExcelUploadResult(`업로드 완료: ${inserted.length}건이 장부에 추가되었습니다.`);
    } catch (e: any) {
      console.error(e);
      setExcelUploadResult(e?.message ?? "엑셀 업로드 중 오류가 발생했습니다.");
    } finally {
      setExcelUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function clickExcelUpload() {
    if (!ownerMemberId) {
      alert("권한(event_members)을 찾지 못해 업로드할 수 없습니다.");
      return;
    }
    fileInputRef.current?.click();
  }

  /* ------------------ 계산 ------------------ */
  const ceremonyDateText =
    settings?.ceremony_date &&
    (() => {
      const [y, m, d] = settings.ceremony_date.split("-");
      return `${y}년 ${Number(m)}월 ${Number(d)}일`;
    })();

  const cutoffText = useMemo(() => {
    if (!settings?.ceremony_date || !settings?.ceremony_end_time) return "-";
    return `${settings.ceremony_date} ${settings.ceremony_end_time}`;
  }, [settings?.ceremony_date, settings?.ceremony_end_time]);

  const ledgerStats = useMemo(() => {
    const total = ledger.length;
    const attended = ledger.filter((r) => r.attended === true).length;
    const totalAmount = ledger.reduce((acc, r) => acc + (r.gift_amount ?? 0), 0);
    const attendedAmount = ledger.filter((r) => r.attended === true).reduce((acc, r) => acc + (r.gift_amount ?? 0), 0);
    return { total, attended, totalAmount, attendedAmount };
  }, [ledger]);

  const filteredLedger = useMemo(() => {
    const query = q.trim().toLowerCase();

    return ledger
      .filter((r) => {
        if (!query) return true;
        const hay = [r.guest_name, r.relationship ?? "", r.guest_phone ?? "", r.memo ?? ""].join(" ").toLowerCase();
        return hay.includes(query);
      })
      .filter((r) => (onlyAttended ? r.attended === true : true))
      .sort((a, b) => (a.guest_name ?? "").localeCompare(b.guest_name ?? ""));
  }, [ledger, q, onlyAttended]);

  /* ------------------ 가드 ------------------ */
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFF6F8]">
        <div className="w-12 h-12 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-medium">데이터를 안전하게 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF6F8]">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  /* ------------------ 메시지 페이지네이션 계산 ------------------ */
  const totalMessagePages = Math.max(1, Math.ceil(messages.length / PAGE_SIZE));
  const safeMsgPage = Math.min(Math.max(1, page), totalMessagePages);
  const msgStart = (safeMsgPage - 1) * PAGE_SIZE;
  const msgSlice = messages.slice(msgStart, msgStart + PAGE_SIZE);

  /* ------------------ UI ------------------ */
  return (
    <div className="min-h-screen bg-[#FFF6F8] text-[#1E293B] pb-20 md:pb-10 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* 1) 상단 헤더 & 리포트 제어 */}
        <header className="px-6 pt-12 pb-8 md:px-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={[
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                  scrapeLocked ? "bg-slate-200 text-slate-600" : "bg-pink-100 text-pink-600 animate-pulse",
                ].join(" ")}
              >
                {scrapeLocked ? "Archived" : "Live Report"}
              </span>

              {/* 탭 상태 배지 */}
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                {tab === "ledger" ? "Ledger" : "Messages"}
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight">디지털 방명록 리포트</h1>
            <p className="text-slate-400 text-sm font-medium">
              {ceremonyDateText ?? ""} • <span className="text-slate-900 font-bold">{ownerLabel}</span> 기준 데이터
            </p>

            <p className="text-[11px] text-slate-500">
              해당 화면은 <span className="font-bold text-slate-700">로그인한 본인만</span> 보는 개인 리포트입니다.
              (신랑/신부 공유 없음)
            </p>
          </div>

          {/* ✅ 탭에 따라 상단 액션이 바뀜 */}
          {tab === "ledger" ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleGenerateReport}
                disabled={scraping}
                className="flex-1 md:flex-none px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50"
                title={!canRunScrape ? "예식 종료 이후에는 QR 축의금 자동 반영이 잠깁니다." : ""}
              >
                {scraping ? "갱신 중..." : "QR 축의금 갱신하기"}
              </button>

              <div className="bg-white/90 backdrop-blur border border-slate-100 px-6 py-3 rounded-2xl shadow-sm">
                <p className="text-[10px] font-black text-slate-300 uppercase leading-none mb-1">QR 반영 마감</p>
                <p className="text-xs font-bold text-slate-600">{cutoffText}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={refreshMessages}
                disabled={messagesLoading}
                className="flex-1 md:flex-none px-6 py-3.5 bg-white text-slate-700 rounded-2xl text-sm font-bold border border-slate-100 shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                {messagesLoading ? "새로고침 중..." : "새로고침"}
              </button>

              <button
                onClick={() => downloadMessagesImage(msgSlice.length)}
                className="flex-1 md:flex-none px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl shadow-slate-200 active:scale-95 transition-all"
              >
                이미지 저장
              </button>
            </div>
          )}
        </header>

        {/* 스크래핑 결과 메시지 */}
        {scrapeResult && tab === "ledger" && (
          <div className="px-6 md:px-10 -mt-2 mb-6">
            <div className="text-xs text-slate-600">{scrapeResult}</div>
          </div>
        )}

        {/* 2) 대시보드 요약 */}
        <div className="px-6 md:px-10 grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            {
              label: "총 축의금",
              value: `${ledgerStats.totalAmount.toLocaleString()}원`,
              sub: "전체 입력 합계 (수기/엑셀 포함)",
              color: "text-slate-900",
            },
            {
              label: "QR 기준 축의금",
              value: `${ledgerStats.attendedAmount.toLocaleString()}원`,
              sub: "현장 QR 스캔 기준",
              color: "text-blue-600",
            },
            {
              label: "총 하객",
              value: `${ledgerStats.total}명`,
              sub: "QR 스캔 + 직접 입력 포함",
              color: "text-pink-500",
            },
            {
              label: "QR 기준 하객",
              value: `${ledgerStats.attended}명`,
              sub: "현장 QR 스캔 기준",
              color: "text-slate-500",
            },
          ].map((s, i) => (
            <div
              key={i}
              className="bg-white/90 backdrop-blur p-6 rounded-[2rem] shadow-sm border border-slate-100/60 hover:shadow-md transition-shadow"
            >
              <p className="text-slate-400 text-[11px] font-bold uppercase mb-1 tracking-widest">{s.label}</p>
              <p className={`text-xl md:text-2xl font-black ${s.color} mb-1`}>{s.value}</p>
              <p className="text-[10px] text-slate-400 font-medium">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* 3) 탭 네비게이션 */}
        <div className="px-6 md:px-10 flex gap-3 mb-8">
          <button
            onClick={() => {
              setTab("ledger");
              setPage(1);
            }}
            className={[
              "px-8 py-3.5 rounded-2xl text-sm font-bold transition-all",
              tab === "ledger"
                ? "bg-pink-500 text-white shadow-lg shadow-pink-100"
                : "bg-white/90 text-slate-400 border border-slate-100",
            ].join(" ")}
          >
            장부 관리
          </button>

          <button
            onClick={() => {
              setTab("messages");
              setPage(1);
            }}
            className={[
              "px-8 py-3.5 rounded-2xl text-sm font-bold transition-all",
              tab === "messages"
                ? "bg-pink-500 text-white shadow-lg shadow-pink-100"
                : "bg-white/90 text-slate-400 border border-slate-100",
            ].join(" ")}
          >
            축하 메시지
          </button>
        </div>

        {/* 4) 장부 탭 (✅ 그대로 유지: 요청대로 수정 없음) */}
        {tab === "ledger" && (
          <div className="space-y-6">
            {!ownerMemberId && (
              <div className="mx-6 md:mx-10 rounded-[2rem] bg-amber-50 border border-amber-200 p-5 text-sm text-amber-800">
                <div className="font-bold">멤버 매칭에 실패했습니다. (event_members.user_id 정합성 이슈)</div>
                <div className="mt-2 text-xs text-amber-700 leading-relaxed">
                  EventHome에서 이벤트가 보였다면 원래는 항상 매칭되어야 합니다.
                  <br />
                  초대/이벤트 생성 플로우에서 event_members에 user_id가 들어가도록 보강이 필요합니다.
                </div>
              </div>
            )}

            {/* 컷오프 안내 */}
            {cutoffIso && (
              <div className="mx-6 md:mx-10 rounded-[2.5rem] bg-white/90 backdrop-blur border border-slate-100 p-5 text-xs text-slate-600">
                <div className="font-bold text-slate-800 mb-1">QR 축의금 반영 마감</div>
                <div className="leading-relaxed">
                  예식 종료 시간(<span className="font-bold">{cutoffText}</span>) 이후에는{" "}
                  <span className="font-bold">QR 축의금 자동 반영이 잠깁니다.</span>
                  <br />
                  빠른추가/엑셀 업로드는 예식 이후에도 계속 수정 가능합니다.
                </div>
              </div>
            )}

            {/* 검색/필터 + 관리도구 토글 */}
            <div className="px-6 md:px-10 flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="이름, 관계, 연락처, 메모 검색..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full bg-white/90 border-none rounded-[1.5rem] px-6 py-4 text-sm shadow-sm focus:ring-2 focus:ring-pink-500/20"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOnlyAttended((v) => !v)}
                  disabled={ledgerLoading}
                  className={[
                    "flex-1 md:flex-none px-6 py-4 rounded-[1.5rem] text-xs font-bold transition-all ring-1",
                    onlyAttended ? "bg-blue-50 text-blue-600 ring-blue-200" : "bg-white/90 text-slate-400 ring-slate-100",
                  ].join(" ")}
                >
                  참석만 (QR)
                </button>

                <button
                  type="button"
                  onClick={() => setExcelHelpOpen((v) => !v)}
                  className="px-6 py-4 bg-white/90 text-slate-600 rounded-[1.5rem] text-xs font-bold border border-slate-100 shadow-sm"
                >
                  엑셀/빠른추가 관리 ⚙️
                </button>
              </div>
            </div>

            {/* 관리 도구 */}
            {excelHelpOpen && (
              <div className="mx-6 md:mx-10 p-8 bg-white/90 backdrop-blur rounded-[2.5rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter">엑셀로 관리하기</h4>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={downloadLedgerExcel}
                      disabled={!ownerMemberId || ledgerLoading}
                      className="px-5 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                    >
                      장부 다운로드
                    </button>

                    <button
                      onClick={clickExcelUpload}
                      disabled={!ownerMemberId || excelUploading}
                      className="px-5 py-3 bg-pink-500 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                    >
                      {excelUploading ? "업로드 중..." : "엑셀 업로드"}
                    </button>

                    <button
                      onClick={downloadLedgerSampleExcel}
                      className="px-5 py-3 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold underline"
                    >
                      양식 다운로드
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      handleExcelUpload(f);
                    }}
                  />

                  {excelUploadResult && <div className="text-xs text-slate-600">{excelUploadResult}</div>}

                  <div className="text-[11px] text-slate-500 leading-relaxed">
                    * 업로드는 기존 기록에 추가됩니다.
                    <br />* QR 축의금 자동 반영 내역(created_source='scrape')은 수정할 수 없습니다.
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter">빠른 추가</h4>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="이름 (필수)"
                      disabled={!ownerMemberId}
                      className="bg-slate-50 border-none rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
                    />

                    <select
                      value={newRelOption}
                      onChange={(e) => setNewRelOption(e.target.value)}
                      disabled={!ownerMemberId}
                      className="bg-slate-50 border-none rounded-xl px-4 py-3 text-xs disabled:opacity-50"
                    >
                      <option value="친구">친구</option>
                      <option value="가족">가족</option>
                      <option value="직장">직장</option>
                      <option value="지인">지인</option>
                      <option value="기타">기타</option>
                    </select>

                    {newRelOption === "기타" && (
                      <input
                        value={newRelCustom}
                        onChange={(e) => setNewRelCustom(e.target.value)}
                        placeholder="관계 직접 입력"
                        disabled={!ownerMemberId}
                        className="col-span-2 bg-slate-50 border-none rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
                      />
                    )}

                    <input
                      inputMode="numeric"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="금액"
                      disabled={!ownerMemberId}
                      className="bg-slate-50 border-none rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
                    />

                    <select
                      value={newAttended === true ? "attended" : newAttended === false ? "absent" : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) setNewAttended(null);
                        else setNewAttended(v === "attended");
                      }}
                      disabled={!ownerMemberId}
                      className="bg-slate-50 border-none rounded-xl px-4 py-3 text-xs disabled:opacity-50"
                    >
                      <option value="">참석 여부</option>
                      <option value="attended">참석</option>
                      <option value="absent">미참석</option>
                    </select>

                    <button
                      onClick={addLedgerRow}
                      disabled={!ownerMemberId}
                      className="col-span-2 bg-slate-900 text-white rounded-xl text-xs font-bold py-3 active:scale-95 transition-transform disabled:opacity-50"
                    >
                      추가하기
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExcelHelpOpen(false)}
                    className="text-[11px] font-bold text-slate-500 underline"
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}

            {/* [모바일] 카드형 리스트 */}
            <div className="md:hidden px-6 space-y-4">
              {ledgerLoading ? (
                <div className="text-center text-slate-500 py-10">장부를 불러오는 중...</div>
              ) : filteredLedger.length === 0 ? (
                <div className="text-center text-slate-500 py-10">표시할 데이터가 없습니다.</div>
              ) : (
                filteredLedger.map((r) => {
                  const locked = isLockedRow(r);
                  return (
                    <div
                      key={r.id}
                      className="bg-white/90 backdrop-blur p-6 rounded-[2.5rem] shadow-sm border border-slate-100"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl font-black text-slate-900">{r.guest_name}</span>
                            {locked && <span className="text-[10px] font-bold text-slate-300">자동</span>}
                          </div>
                          <p className="text-xs text-slate-500 font-medium">
                            {(r.relationship || "관계 미입력") + " · " + (r.guest_phone || "연락처 없음")}
                          </p>
                          <div className="mt-2 text-[10px] text-slate-400 font-bold uppercase">
                            {sourceLabel(r.created_source ?? null)}
                          </div>
                        </div>

                        <div className="text-right">
                          <input
                            inputMode="numeric"
                            className="w-28 text-right bg-slate-50 border-none rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
                            value={r.gift_amount ?? ""}
                            disabled={locked}
                            placeholder="금액"
                            onChange={(e) => {
                              const nextRow: LedgerRow = { ...r, gift_amount: safeNumber(e.target.value) };
                              patchLedger(r.id, nextRow);
                            }}
                            onBlur={() => saveLedgerRow(r)}
                          />
                          <select
                            className="mt-2 bg-slate-50 border-none rounded-xl px-3 py-2 text-xs text-slate-700 w-28 disabled:opacity-50"
                            value={r.gift_method}
                            disabled={locked}
                            onChange={(e) => {
                              const nextRow: LedgerRow = { ...r, gift_method: e.target.value as GiftMethod };
                              patchLedger(r.id, nextRow);
                            }}
                            onBlur={() => saveLedgerRow(r)}
                          >
                            <option value="unknown">미정</option>
                            <option value="account">계좌</option>
                            <option value="cash">현금</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <button
                          type="button"
                          disabled={locked}
                          className={[
                            "w-full py-3.5 rounded-2xl text-[11px] font-black transition-all border",
                            r.attended
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                              : "bg-slate-50 border-slate-100 text-slate-500",
                            locked ? "opacity-50" : "",
                          ].join(" ")}
                          onClick={() => {
                            const nextAttended = !(r.attended === true);
                            const nextRow: LedgerRow = {
                              ...r,
                              attended: nextAttended,
                              attended_at: nextAttended ? new Date().toISOString() : null,
                            };
                            patchLedger(r.id, nextRow);
                            saveLedgerRow(nextRow);
                          }}
                        >
                          참석 {r.attended ? "확인" : "미확인"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* [PC] 테이블 */}
            <div className="hidden md:block px-10 pb-10">
              <div className="bg-white/90 backdrop-blur rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50 border-b border-slate-50">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-8 py-5">하객 정보</th>
                      <th className="px-8 py-5">참석 여부</th>
                      <th className="px-8 py-5">축의금/방식</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-50">
                    {ledgerLoading ? (
                      <tr>
                        <td colSpan={3} className="px-8 py-12 text-center text-slate-500">
                          장부를 불러오는 중...
                        </td>
                      </tr>
                    ) : filteredLedger.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-8 py-12 text-center text-slate-500">
                          표시할 데이터가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredLedger.map((r) => {
                        const locked = isLockedRow(r);

                        return (
                          <tr key={r.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <input
                                  className="bg-slate-50 border-none rounded-xl px-3 py-2 text-xs font-bold text-slate-900 w-44 focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
                                  value={r.guest_name}
                                  disabled={locked}
                                  onChange={(e) => {
                                    const nextRow: LedgerRow = { ...r, guest_name: e.target.value };
                                    patchLedger(r.id, nextRow);
                                  }}
                                  onBlur={() => saveLedgerRow(r)}
                                />
                              </div>

                              <div className="mt-2 flex gap-2">
                                <input
                                  className="bg-slate-50 border-none rounded-xl px-3 py-2 text-xs text-slate-700 w-32 focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
                                  value={r.relationship ?? ""}
                                  disabled={locked}
                                  placeholder="관계"
                                  onChange={(e) => {
                                    const nextRow: LedgerRow = { ...r, relationship: e.target.value };
                                    patchLedger(r.id, nextRow);
                                  }}
                                  onBlur={() => saveLedgerRow(r)}
                                />
                                <input
                                  className="bg-slate-50 border-none rounded-xl px-3 py-2 text-xs text-slate-700 w-40 focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
                                  value={r.guest_phone ?? ""}
                                  disabled={locked}
                                  placeholder="연락처"
                                  onChange={(e) => {
                                    const nextRow: LedgerRow = { ...r, guest_phone: formatKoreanMobile(e.target.value) };
                                    patchLedger(r.id, nextRow);
                                  }}
                                  onBlur={() => saveLedgerRow(r)}
                                />
                              </div>

                              <div className="mt-2 text-[10px] text-slate-400 font-bold uppercase">
                                {sourceLabel(r.created_source ?? null)}
                              </div>
                            </td>

                            <td className="px-8 py-5">
                              <button
                                type="button"
                                disabled={locked}
                                className={[
                                  "h-9 px-4 rounded-2xl text-[11px] font-black border transition-all",
                                  r.attended
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : "bg-white border-slate-200 text-slate-500",
                                  locked ? "opacity-50" : "",
                                ].join(" ")}
                                onClick={() => {
                                  const nextAttended = !(r.attended === true);
                                  const nextRow: LedgerRow = {
                                    ...r,
                                    attended: nextAttended,
                                    attended_at: nextAttended ? new Date().toISOString() : null,
                                  };
                                  patchLedger(r.id, nextRow);
                                  saveLedgerRow(nextRow);
                                }}
                              >
                                {r.attended ? "참석" : "미참석"}
                              </button>
                            </td>

                            <td className="px-8 py-5">
                              <input
                                inputMode="numeric"
                                className="w-32 text-right bg-slate-50 border-none rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
                                value={r.gift_amount ?? ""}
                                disabled={locked}
                                placeholder="금액"
                                onChange={(e) => {
                                  const nextRow: LedgerRow = { ...r, gift_amount: safeNumber(e.target.value) };
                                  patchLedger(r.id, nextRow);
                                }}
                                onBlur={() => saveLedgerRow(r)}
                              />

                              <div className="mt-2">
                                <select
                                  className="bg-slate-50 border-none rounded-xl px-3 py-2 text-xs text-slate-700 w-32 disabled:opacity-50"
                                  value={r.gift_method}
                                  disabled={locked}
                                  onChange={(e) => {
                                    const nextRow: LedgerRow = { ...r, gift_method: e.target.value as GiftMethod };
                                    patchLedger(r.id, nextRow);
                                  }}
                                  onBlur={() => saveLedgerRow(r)}
                                >
                                  <option value="unknown">미정</option>
                                  <option value="account">계좌</option>
                                  <option value="cash">현금</option>
                                </select>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 text-[11px] text-slate-500">
                * 화면에는 핵심 정보(하객정보/참석여부/축의금/방식)만 표시됩니다. 자세한 항목은 엑셀 다운로드에서 확인하세요.
                <br />
                * QR 축의금 자동 반영은 예식 종료 이후 잠깁니다. (빠른추가/엑셀은 계속 가능)
              </div>
            </div>
          </div>
        )}

        {/* 5) 메시지 탭 (✅ 여기만 “디스플레이 느낌/모바일 특화”로 개선) */}
        {tab === "messages" && (
          <div className="px-6 md:px-10 pb-12">
            <div className="bg-white/90 backdrop-blur rounded-[2.5rem] border border-slate-100 shadow-sm p-6 md:p-8">
              <div className="flex items-end justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg md:text-xl font-black text-slate-900">축하 메시지</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    “디스플레이 화면을 그대로 보는 느낌”으로 현재 페이지 메시지를 모아 저장할 수 있어요.
                  </p>
                </div>

                <div className="hidden md:flex items-center gap-2">
                  <button
                    onClick={refreshMessages}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-100 text-slate-700 text-[11px] font-bold shadow-sm"
                    disabled={messagesLoading}
                  >
                    {messagesLoading ? "새로고침 중..." : "새로고침"}
                  </button>

                  <button
                    onClick={() => downloadMessagesImage(msgSlice.length)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[11px] font-bold shadow-sm"
                  >
                    이미지 저장
                  </button>

                  <div className="text-xs font-bold text-slate-400">
                    {safeMsgPage} / {totalMessagePages} • 총 {messages.length.toLocaleString()}개
                  </div>
                </div>
              </div>

              {messages.length === 0 ? (
                <div className="text-center text-slate-500 py-16">아직 메시지가 없습니다.</div>
              ) : (
                <>
                  {/* ✅ 모바일에서 ‘디스플레이 화면’처럼 보이게: 프레임 + 배경 + 워터마크 */}
                  <div className="flex flex-col lg:flex-row gap-5">
                    {/* 캡처/프리뷰 영역 */}
                    <div className="flex-1">
                      <div
                        ref={messagesCaptureRef}
                        className={[
                          "relative overflow-hidden",
                          "rounded-[2.25rem] border border-slate-200/70",
                          "shadow-[0_40px_90px_-60px_rgba(15,23,42,0.35)]",
                        ].join(" ")}
                        style={{
                          // ✅ 모바일에서 디스플레이 느낌: 세로 화면 비율
                          aspectRatio: "9 / 16",
                        }}
                      >
                        {/* background (디스플레이 템플릿 느낌) */}
                        <div className="absolute inset-0">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(244,114,182,0.35),transparent_45%),radial-gradient(circle_at_80%_35%,rgba(99,102,241,0.22),transparent_50%),radial-gradient(circle_at_50%_95%,rgba(251,113,133,0.20),transparent_55%)]" />
                          <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/10 to-white/0" />
                          <div className="absolute inset-0 bg-black/18" />
                        </div>

                        {/* top glass bar (디스플레이 상단 UI 느낌) */}
                        <div className="relative z-10 px-5 pt-5">
                          <div className="rounded-[1.5rem] border border-white/20 bg-white/12 backdrop-blur-md px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[11px] font-black tracking-widest text-white/70 uppercase">
                                  digital guestbook
                                </div>
                                <div className="mt-1 text-sm font-extrabold text-white truncate">
                                  축하 메시지
                                </div>
                              </div>
                              <div className="text-[11px] font-bold text-white/70 shrink-0">
                                {safeMsgPage}/{totalMessagePages}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* message area */}
                        <div className="relative z-10 px-5 pt-4 pb-14 h-full">
                          {/* ✅ 아래쪽으로 쌓이게(디스플레이/채팅 느낌) */}
                          <div className="h-full flex flex-col justify-end gap-3">
                            {msgSlice.map((m) => {
                              const realName = (m.guest_name ?? "").trim();
                              const nickName = (m.nickname ?? "").trim();
                              const nameText =
                                realName && nickName && realName !== nickName
                                  ? `${realName} (${nickName})`
                                  : realName || nickName || "익명";

                              const relText = (m.relationship ?? "").trim();
                              const side = m.side === "groom" ? "groom" : m.side === "bride" ? "bride" : null;

                              const align = side === "groom" ? "justify-start" : side === "bride" ? "justify-end" : "justify-start";

                              const bubbleTone =
                                side === "groom"
                                  ? "border-sky-200/40 bg-white/82"
                                  : side === "bride"
                                  ? "border-rose-200/40 bg-white/82"
                                  : "border-white/20 bg-white/78";

                              const chipTone =
                                side === "groom"
                                  ? "bg-sky-500/20 text-white/85 border-white/15"
                                  : side === "bride"
                                  ? "bg-rose-500/20 text-white/85 border-white/15"
                                  : "bg-white/12 text-white/80 border-white/15";

                              return (
                                <div key={m.id} className={`flex ${align}`}>
                                  <div className="max-w-[82%]">
                                    {/* meta chip */}
                                    <div
                                      className={[
                                        "inline-flex items-center gap-2",
                                        "rounded-full border px-3 py-1",
                                        "backdrop-blur-md",
                                        chipTone,
                                      ].join(" ")}
                                    >
                                      <span className="text-[11px] font-extrabold">{nameText}</span>
                                      {relText ? <span className="text-[11px] font-bold opacity-80">· {relText}</span> : null}
                                      <span className="text-[10px] font-bold opacity-70">
                                        {formatKSTTime(m.created_at)}
                                      </span>
                                    </div>

                                    {/* bubble */}
                                    <div
                                      className={[
                                        "mt-2 rounded-[1.6rem] border px-5 py-4",
                                        "backdrop-blur-md shadow-[0_18px_40px_-28px_rgba(0,0,0,0.6)]",
                                        bubbleTone,
                                      ].join(" ")}
                                    >
                                      <div className="text-[15px] md:text-[16px] text-slate-900 leading-relaxed whitespace-pre-wrap break-words">
                                        {m.body}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* watermark (A: 인스타 아이콘 없음) */}
                          <div className="absolute right-4 bottom-4">
                            <div className="rounded-full border border-white/15 bg-black/25 backdrop-blur-md px-3 py-1.5">
                              <span className="text-[10px] font-black tracking-widest text-white/75 uppercase">
                                digital guestbook
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* mobile quick controls */}
                      <div className="mt-4 flex items-center justify-between gap-2 md:hidden">
                        <button
                          className="flex-1 px-4 py-3 rounded-2xl border text-xs font-bold text-slate-700 bg-white/90 hover:bg-white disabled:opacity-40"
                          disabled={safeMsgPage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          이전
                        </button>

                        <button
                          className="flex-1 px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-sm"
                          onClick={() => downloadMessagesImage(msgSlice.length)}
                        >
                          이미지 저장
                        </button>

                        <button
                          className="flex-1 px-4 py-3 rounded-2xl border text-xs font-bold text-slate-700 bg-white/90 hover:bg-white disabled:opacity-40"
                          disabled={safeMsgPage >= totalMessagePages}
                          onClick={() => setPage((p) => Math.min(totalMessagePages, p + 1))}
                        >
                          다음
                        </button>
                      </div>

                      <div className="mt-3 text-[11px] text-slate-500">
                        * “이미지 저장”은 현재 페이지(최대 {PAGE_SIZE}개) 기준으로 저장됩니다.
                      </div>
                    </div>

                    {/* 데스크톱 우측: 리스트(선택) — 기존 카드 느낌 유지 */}
                    <div className="hidden lg:block w-[360px] shrink-0">
                      <div className="rounded-[2rem] bg-white/60 border border-slate-100 p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-xs font-black tracking-widest text-slate-400 uppercase">LIST</div>
                          <div className="text-xs font-bold text-slate-400">
                            {safeMsgPage}/{totalMessagePages}
                          </div>
                        </div>

                        <div className="space-y-2 max-h-[520px] overflow-auto pr-2">
                          {msgSlice.map((m) => {
                            const realName = (m.guest_name ?? "").trim();
                            const nickName = (m.nickname ?? "").trim();
                            const nameText =
                              realName && nickName && realName !== nickName
                                ? `${realName} (${nickName})`
                                : realName || nickName || "익명";
                            const relText = (m.relationship ?? "").trim();
                            const side = m.side === "groom" ? "신랑측" : m.side === "bride" ? "신부측" : "";
                            return (
                              <div
                                key={m.id}
                                className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-3"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-sm font-extrabold text-slate-900 truncate">{nameText}</div>
                                    <div className="mt-1 text-[11px] text-slate-500 font-bold truncate">
                                      {relText ? `${relText} · ` : ""}
                                      {formatKSTTime(m.created_at)}
                                    </div>
                                  </div>
                                  {side ? (
                                    <span className="shrink-0 text-[10px] font-black text-slate-400">{side}</span>
                                  ) : null}
                                </div>
                                <div className="mt-2 text-xs text-slate-600 line-clamp-2 whitespace-pre-wrap">
                                  {m.body}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <button
                            className="px-4 py-2 rounded-xl border text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            disabled={safeMsgPage <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                          >
                            이전
                          </button>
                          <button
                            className="px-4 py-2 rounded-xl border text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            disabled={safeMsgPage >= totalMessagePages}
                            onClick={() => setPage((p) => Math.min(totalMessagePages, p + 1))}
                          >
                            다음
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
