// src/pages/ResultPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

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
  if (src === "scrape") return "은행 자동 반영 (수정 불가)";
  if (src === "import") return "엑셀 업로드";
  if (src === "guestpage") return "하객 입력";
  return "수기 입력";
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
  if (["y", "yes", "true", "1", "o", "ok", "참", "참석"].includes(s)) return true;
  if (["n", "no", "false", "0", "x", "불", "미참석"].includes(s)) return false;
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

export default function ResultPage() {
  const navigate = useNavigate();
  const { eventId } = useParams<RouteParams>();

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [settings, setSettings] = useState<EventSettingsLite | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const [ownerLabel, setOwnerLabel] = useState<string>("내");
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // ✅ 최신 ledger 스냅샷을 저장해서 stale row 저장 버그 방지
  const ledgerRef = useRef<LedgerRow[]>([]);
  useEffect(() => {
    ledgerRef.current = ledger;
  }, [ledger]);

  // 장부 필터/검색
  const [q, setQ] = useState("");
  const [onlyAttended, setOnlyAttended] = useState(false);
  const [onlyThanksPending, setOnlyThanksPending] = useState(false);


  // 장부 수기 추가
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRel, setNewRel] = useState("");
  const [newSide, setNewSide] = useState<"" | "groom" | "bride">("");

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

  // ✅ 종료 이후에도 버튼은 눌리게 두고, 클릭 시 안내만(UX)
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
      return data.id;
    }

    setOwnerLabel("내");
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
        setLedger((data as LedgerRow[]) || []);
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

    // 컷오프 잠금: 종료 이후엔 안내만(버튼은 눌리게)
    if (!canRunScrape) {
      setScrapeResult("예식 종료 이후에는 은행 자동 반영(갱신)이 잠깁니다. (수기/엑셀 입력은 계속 가능)");
      return;
    }

    // 인증 전이면 쿠콘 인증 페이지로 유도(PC에서만 의미 있음)
    if (!scrapeAccountId) {
      const date = settings?.ceremony_date ?? "";
      const startDate = date;
      const endDate = date;

      const qs = new URLSearchParams({
        eventId,
        mode: "connect_then_scrape",
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      });

      // ✅ App.tsx 라우트와 반드시 일치시켜야 함!
      // 현재는 /coocon/scrape 로 통일
      navigate(`/coocon/scrape?${qs.toString()}`);
      return;
    }

    // 인증되어 있으면: Edge Function으로 “반영/정규화” 스크래핑 실행
    try {
      setScraping(true);
      setScrapeResult(null);

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("로그인이 필요합니다.");

      // 날짜 범위: 우선 예식일 하루
      const date = settings?.ceremony_date ?? "2026-01-01";
      const startDate = date;
      const endDate = date;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coocon-scrape-transactions`,
        {
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
          }),
        }
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "조회 실패");

      const inserted = json.inserted ?? 0;

      // ✅ 안전: count 재조회
      await refreshTxCount();

      setScrapeResult(`은행 내역 갱신 완료 (${inserted}건 반영)`);
    } catch (e: any) {
      setScrapeResult(e?.message ?? "갱신 중 오류가 발생했습니다.");
    } finally {
      setScraping(false);
    }
  };

  /* ------------------ 장부: 업데이트/추가 ------------------ */
  function patchLedger(id: string, nextRow: LedgerRow) {
    setLedger((prev) => prev.map((r) => (r.id === id ? nextRow : r)));
  }

  function isLockedRow(row: LedgerRow) {
    return (row.created_source ?? "manual") === "scrape";
  }

  async function saveLedgerRow(row: LedgerRow) {
    // ✅ stale 방지: 현재 ledger에서 최신 row를 찾아 사용
    const latest = ledgerRef.current.find((r) => r.id === row.id) ?? row;

    if (isLockedRow(latest)) return;

    setSavingId(latest.id);

    const payload = {
      side: latest.side,
      guest_name: latest.guest_name,
      relationship: latest.relationship,
      guest_phone: latest.guest_phone,

      attended: latest.attended,
      attended_at: latest.attended_at,

      gift_amount: latest.gift_amount,
      gift_method: latest.gift_method,

      ticket_count: latest.ticket_count,
      return_given: latest.return_given,
      thanks_done: latest.thanks_done,
      memo: latest.memo,
    };

    const { error } = await supabase
      .from("event_ledger_entries")
      .update(payload)
      .eq("id", latest.id);

    setSavingId(null);

    if (error) {
      console.error(error);
      alert(`저장 실패: ${error.message}`);
      return;
    }
  }


  async function addLedgerRow() {
    if (!eventId || !ownerMemberId) return;

    if (!newName.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    const payload: any = {
      event_id: eventId,
      owner_member_id: ownerMemberId,
      side: newSide || null,
      guest_name: newName.trim(),
      relationship: newRel.trim() ? newRel.trim() : null,
      guest_phone: newPhone.trim() ? formatKoreanMobile(newPhone) : null,
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

    if (data) setLedger((prev) => [data as LedgerRow, ...prev]);

    setNewName("");
    setNewPhone("");
    setNewRel("");
    setNewSide("");
  }

  /* ------------------ 엑셀: 샘플 다운로드 (항상 활성) ------------------ */
  function downloadLedgerSampleExcel() {
    const sample = [
      {
        이름: "김철수",
        관계: "친구",
        연락처: "010-1234-5678",
        "참석여부(QR스캔기준)": "참석",
        참석시간: "",
        축의금: 50000,
        "축의방식(선택)": "현금",
        "식권(개수)": 0,
        답례: "미완료",
        감사인사: "미완료",
        메모: "",
        "구분(선택)": "신랑측",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "장부_업로드샘플");

    const filename = `장부_업로드샘플_${yyyymmdd(settings?.ceremony_date)}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  /* ------------------ 엑셀: 장부 다운로드 ------------------ */
  function downloadLedgerExcel() {
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
        "축의방식(선택)": r.gift_method === "cash" ? "현금" : r.gift_method === "account" ? "계좌" : "",
        "식권(개수)": r.ticket_count ?? 0,
        답례: r.return_given ? "완료" : "미완료",
        감사인사: r.thanks_done ? "완료" : "미완료",
        메모: r.memo ?? "",
        "구분(선택)": r.side === "groom" ? "신랑측" : r.side === "bride" ? "신부측" : "",
        출처: sourceLabel(r.created_source ?? null),
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "장부");

    const filename = `${ownerLabel}_장부_${yyyymmdd(settings?.ceremony_date)}.xlsx`;
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
          const guest_phone_raw = String(key(r, ["연락처", "전화번호", "휴대폰"])).trim();
          const guest_phone = guest_phone_raw ? formatKoreanMobile(guest_phone_raw) : null;

          const attendedRaw = key(r, ["참석여부(QR스캔기준)", "참석여부", "참석", "출석"]);
          const attended = normalizeBool(attendedRaw);

          const attendedAtRaw = key(r, ["참석시간", "참석시각", "attended_at"]);
          const attended_at = toIsoMaybe(attendedAtRaw);

          const gift_amount = safeNumber(key(r, ["축의금", "금액", "축의금액"]));
          const gift_method = normalizeGiftMethod(key(r, ["축의방식(선택)", "축의방식", "방식", "gift_method"]));

          const ticket_count = safeNumber(key(r, ["식권(개수)", "식권", "식권수", "ticket_count"])) ?? 0;

          const return_given_raw = key(r, ["답례", "답례품", "return_given"]);
          const return_given = normalizeBool(return_given_raw) ?? false;

          const thanks_done_raw = key(r, ["감사인사", "인사", "thanks_done"]);
          const thanks_done = normalizeBool(thanks_done_raw) ?? false;

          const memo = String(key(r, ["메모", "비고", "memo"])).trim() || null;

          const sideRaw = key(r, ["구분(선택)", "구분", "side"]);
          const sideNorm = normalizeSide(sideRaw);
          const side = sideNorm ? (sideNorm as any) : null;

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

      const inserted = (data as LedgerRow[]) || [];
      setLedger((prev) => [...inserted, ...prev]);

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
    const thanksPending = ledger.filter((r) => r.thanks_done === false).length;
    const locked = ledger.filter((r) => isLockedRow(r)).length;
    return { total, attended, totalAmount, thanksPending, locked };
  }, [ledger]);

  const filteredLedger = useMemo(() => {
    const query = q.trim().toLowerCase();

    return ledger
      .filter((r) => {
        if (!query) return true;
        const hay = [r.guest_name, r.relationship ?? "", r.guest_phone ?? "", r.memo ?? ""]
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      })
      .filter((r) => (onlyAttended ? r.attended === true : true))
      .filter((r) => (onlyThanksPending ? r.thanks_done === false : true))
      .sort((a, b) => (a.guest_name ?? "").localeCompare(b.guest_name ?? ""));
  }, [ledger, q, onlyAttended, onlyThanksPending]);

  /* ------------------ 가드 ------------------ */
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
        <div className="w-12 h-12 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-medium">데이터를 안전하게 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  /* ------------------ UI ------------------ */
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] pb-20 md:pb-10 font-sans">
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
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight">디지털 방명록 리포트</h1>
            <p className="text-slate-400 text-sm font-medium">
              {ceremonyDateText ?? ""} • <span className="text-slate-900 font-bold">{ownerLabel}</span> 기준 데이터
            </p>

            <p className="text-[11px] text-slate-400">
              이 화면은 <span className="font-bold text-slate-700">개인 기준</span> 리포트입니다. (각 계정/구성원별 분리)
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleGenerateReport}
              disabled={scraping}
              className="flex-1 md:flex-none px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50"
              title={!canRunScrape ? "예식 종료 이후에는 자동 반영이 잠깁니다." : ""}
            >
              {scraping ? "조회 중..." : "은행 내역 갱신"}
            </button>

            <div className="bg-white border border-slate-100 px-6 py-3 rounded-2xl shadow-sm">
              <p className="text-[10px] font-black text-slate-300 uppercase leading-none mb-1">Data Cutoff</p>
              <p className="text-xs font-bold text-slate-600">{cutoffText}</p>
            </div>
          </div>
        </header>

        {/* 스크래핑 결과 메시지 */}
        {scrapeResult && (
          <div className="px-6 md:px-10 -mt-2 mb-6">
            <div className="text-xs text-slate-500">{scrapeResult}</div>
          </div>
        )}

        {/* 2) 대시보드 요약 */}
        <div className="px-6 md:px-10 grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            {
              label: "총 축의금",
              value: `${ledgerStats.totalAmount.toLocaleString()}원`,
              sub: `하객 ${ledgerStats.total}명`,
              color: "text-slate-900",
            },
            {
              label: "실제 참석",
              value: `${ledgerStats.attended}명`,
              sub: "QR 스캔 기준",
              color: "text-blue-600",
            },
            {
              label: "답례 미완료",
              value: `${ledgerStats.thanksPending}명`,
              sub: "관리 필요",
              color: "text-pink-500",
            },
            {
              label: "자동 반영",
              value: `${txCount}건`,
              sub: scrapeLocked ? "예식 종료로 잠김" : "은행 스크래핑",
              color: "text-slate-500",
            },
          ].map((s, i) => (
            <div
              key={i}
              className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100/50 hover:shadow-md transition-shadow"
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
                : "bg-white text-slate-400 border border-slate-100",
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
                : "bg-white text-slate-400 border border-slate-100",
            ].join(" ")}
          >
            축하 메시지
          </button>
        </div>

        {/* 4) 장부 탭 */}
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
              <div className="mx-6 md:mx-10 rounded-[2rem] bg-white border border-slate-100 p-5 text-xs text-slate-500">
                <div className="font-bold text-slate-700 mb-1">은행 자동 반영(스크래핑) 컷오프</div>
                <div className="leading-relaxed">
                  예식 종료 시각(<span className="font-bold">{cutoffText}</span>) 이후에는{" "}
                  <span className="font-bold">은행 자동 반영이 잠깁니다.</span>
                  <br />
                  수기 입력/엑셀 업로드는 예식 이후에도 계속 수정할 수 있습니다.
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
                  className="w-full bg-white border-none rounded-[1.5rem] px-6 py-4 text-sm shadow-sm focus:ring-2 focus:ring-pink-500/20"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOnlyAttended((v) => !v)}
                  disabled={ledgerLoading}
                  className={[
                    "flex-1 md:flex-none px-6 py-4 rounded-[1.5rem] text-xs font-bold transition-all ring-1",
                    onlyAttended ? "bg-blue-50 text-blue-600 ring-blue-200" : "bg-white text-slate-400 ring-slate-100",
                  ].join(" ")}
                >
                  참석만 (QR)
                </button>

                <button
                  type="button"
                  onClick={() => setOnlyThanksPending((v) => !v)}
                  disabled={ledgerLoading}
                  className={[
                    "flex-1 md:flex-none px-6 py-4 rounded-[1.5rem] text-xs font-bold transition-all ring-1",
                    onlyThanksPending
                      ? "bg-pink-50 text-pink-600 ring-pink-200"
                      : "bg-white text-slate-400 ring-slate-100",
                  ].join(" ")}
                >
                  답례 미완료만
                </button>

                <button
                  type="button"
                  onClick={() => setExcelHelpOpen((v) => !v)}
                  className="px-6 py-4 bg-white text-slate-600 rounded-[1.5rem] text-xs font-bold border border-slate-100 shadow-sm"
                >
                  데이터 관리 ⚙️
                </button>
              </div>
            </div>

            {/* 관리 도구 */}
            {excelHelpOpen && (
              <div className="mx-6 md:mx-10 p-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Excel Management</h4>

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
                      className="px-5 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold underline"
                    >
                      양식 받기
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

                  {excelUploadResult && <div className="text-xs text-slate-500">{excelUploadResult}</div>}

                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    * 업로드는 현재 <span className="font-bold text-slate-600">새 행 추가</span> 방식입니다.
                    <br />* <span className="font-bold text-slate-600">은행 자동 반영</span> 내역은 항상 수정 불가입니다.
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Quick Add</h4>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="이름 (필수)"
                      disabled={!ownerMemberId}
                      className="bg-slate-50 border-none rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
                    />
                    <input
                      value={newPhone}
                      onChange={(e) => setNewPhone(formatKoreanMobile(e.target.value))}
                      placeholder="연락처"
                      disabled={!ownerMemberId}
                      className="bg-slate-50 border-none rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
                    />
                    <input
                      value={newRel}
                      onChange={(e) => setNewRel(e.target.value)}
                      placeholder="관계"
                      disabled={!ownerMemberId}
                      className="bg-slate-50 border-none rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
                    />
                    <select
                      value={newSide}
                      onChange={(e) => setNewSide(e.target.value as any)}
                      disabled={!ownerMemberId}
                      className="bg-slate-50 border-none rounded-xl px-4 py-3 text-xs disabled:opacity-50"
                    >
                      <option value="">구분 선택</option>
                      <option value="groom">신랑측</option>
                      <option value="bride">신부측</option>
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
                    className="text-[11px] font-bold text-slate-400 underline"
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}

            {/* [모바일] 카드형 리스트 */}
            <div className="md:hidden px-6 space-y-4">
              {ledgerLoading ? (
                <div className="text-center text-slate-400 py-10">장부를 불러오는 중...</div>
              ) : filteredLedger.length === 0 ? (
                <div className="text-center text-slate-400 py-10">표시할 데이터가 없습니다.</div>
              ) : (
                filteredLedger.map((r) => {
                  const locked = isLockedRow(r);
                  return (
                    <div key={r.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl font-black text-slate-900">{r.guest_name}</span>
                            <span
                              className={[
                                "text-[10px] px-2 py-0.5 rounded-full font-black uppercase",
                                r.side === "groom"
                                  ? "bg-blue-50 text-blue-500"
                                  : r.side === "bride"
                                  ? "bg-pink-50 text-pink-500"
                                  : "bg-slate-50 text-slate-400",
                              ].join(" ")}
                            >
                              {r.side === "groom" ? "Groom" : r.side === "bride" ? "Bride" : "Side"}
                            </span>
                            {locked && <span className="text-[10px] font-bold text-slate-300">자동</span>}
                          </div>
                          <p className="text-xs text-slate-400 font-medium">
                            {(r.relationship || "관계 미입력") + " • " + (r.guest_phone || "연락처 없음")}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xl font-black text-slate-900">{(r.gift_amount ?? 0).toLocaleString()}원</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">
                            {r.gift_method === "cash" ? "CASH" : r.gift_method === "account" ? "ACCOUNT" : "UNKNOWN"}
                          </p>
                        </div>
                      </div>

                      <div className="mb-3">
                        <button
                          type="button"
                          disabled={locked}
                          className={[
                            "w-full py-3.5 rounded-2xl text-[11px] font-black transition-all border",
                            r.attended
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                              : "bg-slate-50 border-slate-100 text-slate-400",
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
                          참석 {r.attended ? "확인" : "미확인"}{" "}
                          <span className="ml-2 text-[10px] font-bold text-slate-300">
                            {r.attended_at ? new Date(r.attended_at).toLocaleString() : ""}
                          </span>
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <button
                          disabled={locked}
                          onClick={() => {
                            const nextRow: LedgerRow = { ...r, return_given: !r.return_given };
                            patchLedger(r.id, nextRow);
                            saveLedgerRow(nextRow);
                          }}
                          className={[
                            "flex-1 py-3.5 rounded-2xl text-[11px] font-black transition-all",
                            r.return_given ? "bg-pink-500 text-white shadow-md shadow-pink-100" : "bg-slate-50 text-slate-400",
                            locked ? "opacity-50" : "",
                          ].join(" ")}
                        >
                          답례 {r.return_given ? "완료" : "대기"}
                        </button>

                        <button
                          disabled={locked}
                          onClick={() => {
                            const nextRow: LedgerRow = { ...r, thanks_done: !r.thanks_done };
                            patchLedger(r.id, nextRow);
                            saveLedgerRow(nextRow);
                          }}
                          className={[
                            "flex-1 py-3.5 rounded-2xl text-[11px] font-black transition-all",
                            r.thanks_done ? "bg-pink-500 text-white shadow-md shadow-pink-100" : "bg-slate-50 text-slate-400",
                            locked ? "opacity-50" : "",
                          ].join(" ")}
                        >
                          인사 {r.thanks_done ? "완료" : "대기"}
                        </button>
                      </div>

                      <div className="mt-3">
                        <input
                          value={r.memo ?? ""}
                          disabled={locked}
                          onChange={(e) => {
                            const nextRow: LedgerRow = { ...r, memo: e.target.value };
                            patchLedger(r.id, nextRow);
                          }}
                          onBlur={() => saveLedgerRow({ ...r, memo: r.memo ?? "" })}
                          placeholder="메모"
                          className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-xs text-slate-600 placeholder:text-slate-300 disabled:opacity-50"
                        />
                      </div>

                      <div className="mt-3 flex justify-between items-center text-[11px]">
                        <div className="text-slate-400">{sourceLabel(r.created_source ?? null)}</div>
                        <button
                          className="px-4 py-2 rounded-xl border text-[11px] font-bold hover:bg-slate-50 disabled:opacity-50"
                          disabled={locked || savingId === r.id}
                          onClick={() => saveLedgerRow(r)}
                        >
                          {savingId === r.id ? "저장중" : locked ? "잠김" : "저장"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* [PC] 테이블 */}
            <div className="hidden md:block px-10 pb-10">
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50 border-b border-slate-50">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-8 py-5">하객 정보</th>
                      <th className="px-8 py-5">참석</th>
                      <th className="px-8 py-5">축의금/방식</th>
                      <th className="px-8 py-5 text-center">식권</th>
                      <th className="px-8 py-5 text-center">상태</th>
                      <th className="px-8 py-5">메모</th>
                      <th className="px-8 py-5 text-right">저장</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-50">
                    {ledgerLoading ? (
                      <tr>
                        <td colSpan={7} className="px-8 py-12 text-center text-slate-400">
                          장부를 불러오는 중...
                        </td>
                      </tr>
                    ) : filteredLedger.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-8 py-12 text-center text-slate-400">
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

                                <span
                                  className={[
                                    "text-[9px] px-2 py-0.5 rounded-full font-black uppercase",
                                    r.side === "groom"
                                      ? "bg-blue-50 text-blue-500"
                                      : r.side === "bride"
                                      ? "bg-pink-50 text-pink-500"
                                      : "bg-slate-50 text-slate-400",
                                  ].join(" ")}
                                >
                                  {r.side === "groom" ? "Groom" : r.side === "bride" ? "Bride" : "Side"}
                                </span>
                              </div>

                              <div className="mt-2 flex gap-2">
                                <input
                                  className="bg-slate-50 border-none rounded-xl px-3 py-2 text-xs text-slate-600 w-32 focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
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
                                  className="bg-slate-50 border-none rounded-xl px-3 py-2 text-xs text-slate-600 w-40 focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
                                  value={r.guest_phone ?? ""}
                                  disabled={locked}
                                  placeholder="연락처"
                                  onChange={(e) => {
                                    const nextRow: LedgerRow = {
                                      ...r,
                                      guest_phone: formatKoreanMobile(e.target.value),
                                    };
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
                                    : "bg-white border-slate-200 text-slate-400",
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

                              <div className="mt-2 text-[10px] text-slate-300 font-bold">
                                {r.attended_at ? new Date(r.attended_at).toLocaleString() : ""}
                              </div>
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

                              <div className="mt-2 flex gap-2">
                                <select
                                  className="bg-slate-50 border-none rounded-xl px-3 py-2 text-xs text-slate-600 w-32 disabled:opacity-50"
                                  value={r.gift_method}
                                  disabled={locked}
                                  onChange={(e) => {
                                    const nextRow: LedgerRow = { ...r, gift_method: e.target.value as GiftMethod };
                                    patchLedger(r.id, nextRow);
                                  }}
                                  onBlur={() => saveLedgerRow(r)}
                                >
                                  <option value="unknown">미지정</option>
                                  <option value="account">계좌</option>
                                  <option value="cash">현금</option>
                                </select>

                                <select
                                  className="bg-slate-50 border-none rounded-xl px-3 py-2 text-xs text-slate-600 w-32 disabled:opacity-50"
                                  value={r.side ?? ""}
                                  disabled={locked}
                                  onChange={(e) => {
                                    const nextRow: LedgerRow = {
                                      ...r,
                                      side: (e.target.value || null) as any,
                                    };
                                    patchLedger(r.id, nextRow);
                                  }}
                                  onBlur={() => saveLedgerRow(r)}
                                >
                                  <option value="">구분 없음</option>
                                  <option value="groom">신랑측</option>
                                  <option value="bride">신부측</option>
                                </select>
                              </div>
                            </td>

                            <td className="px-8 py-5 text-center">
                              <input
                                inputMode="numeric"
                                className="w-16 text-center bg-slate-50 border-none rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
                                value={r.ticket_count ?? 0}
                                disabled={locked}
                                onChange={(e) => {
                                  const nextRow: LedgerRow = {
                                    ...r,
                                    ticket_count: safeNumber(e.target.value) ?? 0,
                                  };
                                  patchLedger(r.id, nextRow);
                                }}
                                onBlur={() => saveLedgerRow(r)}
                              />
                            </td>

                            <td className="px-8 py-5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  disabled={locked}
                                  onClick={() => {
                                    const nextRow: LedgerRow = { ...r, return_given: !r.return_given };
                                    patchLedger(r.id, nextRow);
                                    saveLedgerRow(nextRow);
                                  }}
                                  className={[
                                    "h-9 px-4 rounded-2xl text-[11px] font-black transition-all",
                                    r.return_given
                                      ? "bg-pink-500 text-white shadow-md shadow-pink-100"
                                      : "bg-slate-50 text-slate-400",
                                    locked ? "opacity-50" : "",
                                  ].join(" ")}
                                >
                                  답례 {r.return_given ? "완료" : "대기"}
                                </button>

                                <button
                                  disabled={locked}
                                  onClick={() => {
                                    const nextRow: LedgerRow = { ...r, thanks_done: !r.thanks_done };
                                    patchLedger(r.id, nextRow);
                                    saveLedgerRow(nextRow);
                                  }}
                                  className={[
                                    "h-9 px-4 rounded-2xl text-[11px] font-black transition-all",
                                    r.thanks_done
                                      ? "bg-pink-500 text-white shadow-md shadow-pink-100"
                                      : "bg-slate-50 text-slate-400",
                                    locked ? "opacity-50" : "",
                                  ].join(" ")}
                                >
                                  인사 {r.thanks_done ? "완료" : "대기"}
                                </button>
                              </div>

                              {locked && <div className="mt-2 text-[10px] text-slate-300 font-bold">자동 반영 내역은 잠김</div>}
                            </td>

                            <td className="px-8 py-5">
                              <input
                                value={r.memo ?? ""}
                                disabled={locked}
                                onChange={(e) => {
                                  const nextRow: LedgerRow = { ...r, memo: e.target.value };
                                  patchLedger(r.id, nextRow);
                                }}
                                onBlur={() => saveLedgerRow(r)}
                                placeholder="메모"
                                className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-xs text-slate-600 placeholder:text-slate-300 focus:ring-1 focus:ring-pink-500 disabled:opacity-50"
                              />
                            </td>

                            <td className="px-8 py-5 text-right">
                              <button
                                className="h-9 px-4 rounded-2xl border text-[11px] font-black hover:bg-slate-50 disabled:opacity-50"
                                disabled={locked || savingId === r.id}
                                onClick={() => saveLedgerRow(r)}
                              >
                                {savingId === r.id ? "저장중" : locked ? "잠김" : "저장"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 text-[11px] text-slate-400">
                * “양식 받기”는 항상 가능 / 업로드는 로그인 멤버(event_members) 매칭이 필요합니다.
                <br />
                * 은행 자동 반영(스크래핑)은 예식 종료 컷오프 이후 잠깁니다. (수기/엑셀은 계속 가능)
              </div>
            </div>
          </div>
        )}

        {/* 5) 메시지 탭 */}
        {tab === "messages" && (
          <div className="px-6 md:px-10 pb-12">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 md:p-8">
              <div className="flex items-end justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg md:text-xl font-black text-slate-900">축하 메시지</h2>
                  <p className="text-xs text-slate-400 mt-1">하객이 남긴 메시지를 시간순으로 확인할 수 있어요.</p>
                </div>
                <div className="text-xs font-bold text-slate-400">총 {messages.length.toLocaleString()}개</div>
              </div>

              {messages.length === 0 ? (
                <div className="text-center text-slate-400 py-16">아직 메시지가 없습니다.</div>
              ) : (
                (() => {
                  const totalPages = Math.max(1, Math.ceil(messages.length / PAGE_SIZE));
                  const safePage = Math.min(Math.max(1, page), totalPages);
                  const start = (safePage - 1) * PAGE_SIZE;
                  const slice = messages.slice(start, start + PAGE_SIZE);

                  return (
                    <>
                      <div className="space-y-3">
                        {slice.map((m) => (
                          <div key={m.id} className="p-5 rounded-[2rem] border border-slate-100 bg-slate-50/40">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-900">{m.guest_name || m.nickname || "익명"}</span>
                                <span className="text-[10px] font-bold text-slate-400">
                                  {m.relationship ? `(${m.relationship})` : ""}
                                </span>

                                <span
                                  className={[
                                    "text-[9px] px-2 py-0.5 rounded-full font-black uppercase",
                                    m.side === "groom"
                                      ? "bg-blue-50 text-blue-500"
                                      : m.side === "bride"
                                      ? "bg-pink-50 text-pink-500"
                                      : "bg-slate-100 text-slate-400",
                                  ].join(" ")}
                                >
                                  {m.side === "groom" ? "Groom" : m.side === "bride" ? "Bride" : "Side"}
                                </span>
                              </div>

                              <div className="text-[10px] text-slate-400 font-bold">
                                {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                              </div>
                            </div>

                            <div className="mt-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{m.body}</div>
                          </div>
                        ))}
                      </div>

                      {/* pagination */}
                      <div className="mt-6 flex items-center justify-between">
                        <button
                          className="px-4 py-2 rounded-xl border text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                          disabled={safePage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          이전
                        </button>

                                                <div className="text-xs font-black text-slate-500">
                          {safePage} / {totalPages}
                        </div>

                        <button
                          className="px-4 py-2 rounded-xl border text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                          disabled={safePage >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                          다음
                        </button>
                      </div>
                    </>
                  );
                })()
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

