import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
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
  recipients: Recipient[] | null;
};

type ReportStatus = "draft" | "finalized" | "archived";

type TabKey = "messages" | "ledger";

type GiftMethod = "account" | "cash" | "unknown";

type CreatedSource = "manual" | "excel" | "scrape";

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

// event_members에서 이메일/유저를 식별하는 컬럼명이 다를 수 있어서 후보로 둠

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
  // Excel date could be number (serial)
  if (typeof v === "number") {
    // XLSX stores dates either as serial; best effort:
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

function yyyymmdd(dateIso?: string | null) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${da}`;
}

export default function ResultPage() {
  const { eventId } = useParams<RouteParams>();

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [settings, setSettings] = useState<EventSettingsLite | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 리포트 상태
  const [reportStatus, setReportStatus] = useState<ReportStatus>("draft");
  const [reportFinalizedAt, setReportFinalizedAt] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  // 축의금(스크래핑)
  const [scrapeAccountId, setScrapeAccountId] = useState<string | null>(null);
  const [txCount, setTxCount] = useState<number>(0);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<string | null>(null);

  const [page, setPage] = useState(1);

  // 탭
  const [tab, setTab] = useState<TabKey>("ledger");

  // 장부(원장) - 개인 기준 분리 키
  const [ownerMemberId, setOwnerMemberId] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState<string>("내");
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

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

  const isFinalized = reportStatus === "finalized";

  // ✅ 정책: "finalized"여도 수기/엑셀 장부는 계속 편집 가능
  // 다만 스크래핑(자동 갱신) 및 스크래핑 row 편집은 불가.
  const canRunScrape = !isFinalized;

      /* ------------------ 내 member id 찾기 ------------------ */
      async function resolveOwnerMemberId(): Promise<string | null> {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) return null;

        const user = authData.user;

        console.log("DEBUG eventId param:", eventId);
        console.log("DEBUG auth user id:", user.id);

        const { data, error } = await supabase
          .from("event_members")
          .select("id, role")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .maybeSingle();

        console.log("DEBUG event_members row:", data);

        if (error) {
          console.error("resolveOwnerMemberId error:", error);
          return null;
        }

        if (data?.id) {
          setOwnerLabel(data.role === "owner" ? "주최" : "내");
          return data.id;
        }

        // 여기 오면 진짜 정합성 이슈
        setOwnerLabel("내");
        return null;
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
        // 메시지 (※ 현재 스키마상 이벤트 전체 메시지임)
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
          .select("ceremony_date, recipients")
          .eq("event_id", eventId)
          .maybeSingle();

        if (setErrorRes) throw setErrorRes;
        if (settingsData) {
          setSettings({
            ceremony_date: settingsData.ceremony_date,
            recipients: settingsData.recipients as Recipient[] | null,
          });
        }

        // 이벤트 리포트 상태
        const { data: ev } = await supabase
          .from("events")
          .select("report_status, report_finalized_at")
          .eq("id", eventId)
          .maybeSingle();

        if (ev?.report_status) {
          setReportStatus(ev.report_status);
          setReportFinalizedAt(ev.report_finalized_at ?? null);
        }

        // 스크래핑 계좌
        const { data: acc } = await supabase
          .from("event_scrape_accounts")
          .select("id")
          .eq("event_id", eventId)
          .order("verified_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (acc?.id) setScrapeAccountId(acc.id);

        // 축의금 개수 (스크래핑 반영 건)
        const { count } = await supabase
          .from("event_scrape_transactions")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId)
          .eq("is_reflected", true);

        setTxCount(count ?? 0);

        // owner_member_id
        const memberId = await resolveOwnerMemberId();
        if (!memberId) {
          setOwnerMemberId(null);
        } else {
          setOwnerMemberId(memberId);
        }
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

  /* ------------------ 리포트 생성/갱신 (스크래핑) ------------------ */
  const handleGenerateReport = async () => {
    if (!canRunScrape) {
      setScrapeResult("확정된 리포트는 자동 조회/갱신이 불가능합니다.");
      return;
    }
    if (!scrapeAccountId) {
      setScrapeResult("연결된 계좌가 없습니다.");
      return;
    }
    if (txCount > 0) {
      setScrapeResult("이미 최신 리포트가 있습니다.");
      return;
    }

    try {
      setScraping(true);
      setScrapeResult(null);

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("로그인이 필요합니다.");

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
            startDate: "2026-01-01",
            endDate: "2026-01-31",
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "조회 실패");

      setTxCount(json.inserted ?? 0);
      setScrapeResult(`리포트 갱신 완료 (${json.inserted ?? 0}건 반영)`);
    } catch (e: any) {
      setScrapeResult(e.message);
    } finally {
      setScraping(false);
    }
  };

  /* ------------------ 리포트 확정 ------------------ */
  const handleFinalizeReport = async () => {
    if (!eventId || reportStatus === "finalized") return;

    const ok = window.confirm(
      "확정 시점 이후에는 계좌 스크래핑 자동 조회/갱신이 차단됩니다.\n\n※ 수기/엑셀 장부는 확정 이후에도 계속 수정 가능합니다.\n\n리포트를 확정할까요?"
    );
    if (!ok) return;

    try {
      setFinalizing(true);

      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("events")
        .update({
          report_status: "finalized",
          report_finalized_at: nowIso,
        })
        .eq("id", eventId);

      if (error) throw error;

      setReportStatus("finalized");
      setReportFinalizedAt(nowIso);
    } catch (e) {
      alert("리포트 확정 중 오류가 발생했습니다.");
    } finally {
      setFinalizing(false);
    }
  };

  /* ------------------ 장부: 업데이트/추가 ------------------ */
  function patchLedger(id: string, patch: Partial<LedgerRow>) {
    setLedger((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function getLatestLedgerRow(id: string) {
    return ledger.find((r) => r.id === id)!;
  }

  function isLockedRow(row: LedgerRow) {
    // ✅ 스크래핑으로 들어온 row는 언제나 수정 불가
    return (row.created_source ?? "manual") === "scrape";
  }

  async function saveLedgerRow(row: LedgerRow) {
    if (isLockedRow(row)) return;

    setSavingId(row.id);

    const payload = {
      side: row.side,
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

  /* ------------------ 엑셀: 샘플 다운로드 ------------------ */
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
        출처: (r.created_source ?? "manual") === "scrape" ? "스크래핑(잠김)" : r.created_source ?? "manual",
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

      // header 기반 객체 배열
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!json.length) {
        throw new Error("업로드할 데이터가 없습니다. (첫 시트에 행이 없음)");
      }

      // 헤더 키 후보들 (Korean)
      // 실제 사용자가 임의로 컬럼명을 약간 바꿀 수 있으니 유연하게 매핑
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
            created_source: "excel" as const,
          };
        })
        .filter(Boolean) as any[];

      if (!rowsToInsert.length) {
        throw new Error("업로드할 유효 행이 없습니다. (이름 필수)");
      }

      // ✅ 업로드는 "추가 insert" 방식 (병합/중복제거는 다음 단계에서 고도화)
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
      // 최신 목록 위로
      setLedger((prev) => [...inserted, ...prev]);

      setExcelUploadResult(`업로드 완료: ${inserted.length}건이 장부에 추가되었습니다.`);
    } catch (e: any) {
      console.error(e);
      setExcelUploadResult(e?.message ?? "엑셀 업로드 중 오류가 발생했습니다.");
    } finally {
      setExcelUploading(false);
      // input reset (같은 파일 재업로드 허용)
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
  const totalCount = messages.length;
  const groomCount = messages.filter((m) => m.side === "groom").length;
  const brideCount = messages.filter((m) => m.side === "bride").length;

  const ceremonyDateText =
    settings?.ceremony_date &&
    (() => {
      const [y, m, d] = settings.ceremony_date.split("-");
      return `${y}년 ${Number(m)}월 ${Number(d)}일`;
    })();

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p>리포트를 불러오는 중입니다...</p>
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
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-md p-6 md:p-8">
        {/* ===== 헤더 ===== */}
        <header className="mb-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">디지털 방명록 리포트</h1>
              {ceremonyDateText && <p className="text-xs text-gray-400">{ceremonyDateText}</p>}

              <p className="mt-2 text-xs text-gray-500">
                이 화면은 <span className="font-semibold">개인 기준</span> 리포트입니다. (각 계정/구성원별 분리)
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              {isFinalized ? (
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">확정 상태</div>
                  <div className="mt-1 text-xs text-gray-500 max-w-[360px]">
                    확정 이후에는 <span className="font-medium">계좌 스크래핑 자동 조회/갱신</span>이 차단됩니다.
                    <br />
                    단, <span className="font-medium">수기/엑셀 장부는 계속 수정 가능</span>하며
                    <span className="font-medium"> 스크래핑 내역(잠김)</span>은 항상 수정 불가입니다.
                  </div>
                  {reportFinalizedAt && (
                    <div className="mt-1 text-[11px] text-gray-400">
                      확정 시각: {new Date(reportFinalizedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <button
                    onClick={handleGenerateReport}
                    disabled={scraping}
                    className="px-4 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-50"
                  >
                    {scraping ? "리포트 생성 중…" : "리포트 생성/갱신"}
                  </button>

                  <button
                    onClick={handleFinalizeReport}
                    disabled={finalizing}
                    className="px-4 py-2 rounded-xl bg-white border text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    {finalizing ? "확정 중…" : "리포트 확정하기"}
                  </button>
                </>
              )}
            </div>
          </div>

          {scrapeResult && <p className="mt-2 text-xs text-gray-500">{scrapeResult}</p>}

          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <span className="px-3 py-1 rounded-full bg-slate-100">메시지 {totalCount}건</span>
            <span className="px-3 py-1 rounded-full bg-slate-100">신랑측 {groomCount}건</span>
            <span className="px-3 py-1 rounded-full bg-slate-100">신부측 {brideCount}건</span>
            <span className="px-3 py-1 rounded-full bg-slate-100">축의금(스크래핑) {txCount}건</span>
          </div>

          <div className="mt-2 text-[11px] text-gray-400">
            * 위 카운트(메시지/스크래핑)는 현재 구조상 <span className="font-medium">이벤트 전체 기준</span>으로 보일 수 있습니다.
            장부는 아래에서 <span className="font-medium">내(owner_member_id) 기준</span>으로 분리 표시됩니다.
          </div>
        </header>

        {/* ===== 탭 ===== */}
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => setTab("ledger")}
            className={`px-4 py-2 rounded-full text-sm border ${
              tab === "ledger" ? "bg-pink-500 text-white border-pink-500" : "bg-white hover:bg-slate-50"
            }`}
          >
            장부
          </button>
          <button
            onClick={() => setTab("messages")}
            className={`px-4 py-2 rounded-full text-sm border ${
              tab === "messages" ? "bg-pink-500 text-white border-pink-500" : "bg-white hover:bg-slate-50"
            }`}
          >
            축하 메시지
          </button>
        </div>

        {/* ===== 장부 탭 ===== */}
        {tab === "ledger" && (
          <section className="space-y-4">
            {!ownerMemberId && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                멤버 매칭에 실패했습니다. (event_members.user_id 정합성 이슈)
                <div className="mt-1 text-xs text-amber-700">
                  EventHome에서 이벤트가 보였다면 원래는 항상 매칭되어야 합니다.
                  <br />
                  초대/이벤트 생성 플로우에서 event_members에 user_id가 들어가도록 보강이 필요합니다.
                </div>
              </div>
            )}


            {/* 요약 */}
            <div className="rounded-2xl bg-slate-50 p-4 flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-white border">내 하객 {ledgerStats.total}명</span>
              <span className="px-3 py-1 rounded-full bg-white border">
                참석 {ledgerStats.attended}명 <span className="text-gray-400">(디지털방명록 스캔 기준)</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-white border">
                축의금 합계 {ledgerStats.totalAmount.toLocaleString()}원
              </span>
              <span className="px-3 py-1 rounded-full bg-white border">답례 미완료 {ledgerStats.thanksPending}명</span>
              <span className="px-3 py-1 rounded-full bg-white border">
                스크래핑(잠김) {ledgerStats.locked}건
              </span>
            </div>

            {/* 엑셀 업/다운 UI */}
            <div className="rounded-2xl border p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">장부 업데이트</div>
                  <p className="mt-1 text-xs text-gray-500">
                    축의대 지인 장부(엑셀)도 <span className="font-medium">한 번에 업로드</span>해서 통합할 수 있어요.
                    <br />
                    스크래핑 내역은 자동 반영되며 <span className="font-medium">잠겨서 수정되지 않습니다.</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="px-4 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-50"
                    onClick={downloadLedgerExcel}
                    disabled={!ownerMemberId || ledgerLoading}
                  >
                    엑셀로 장부 다운로드
                  </button>

                 <button
                  className="px-4 py-2 rounded-xl border text-sm hover:bg-slate-50"
                  onClick={downloadLedgerSampleExcel}
                >
                  엑셀 샘플 다운로드
                </button>

                <button
                  className="px-4 py-2 rounded-xl border text-sm hover:bg-slate-50"
                  onClick={() => setExcelHelpOpen(true)}
                >
                  업로드 포맷 안내
                </button>


                  <button
                    className="px-4 py-2 rounded-xl bg-pink-500 text-white text-sm disabled:opacity-50"
                    onClick={clickExcelUpload}
                    disabled={!ownerMemberId || excelUploading}
                  >
                    {excelUploading ? "업로드 중..." : "엑셀로 장부 한번에 업로드"}
                  </button>

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
                </div>
              </div>

              {excelUploadResult && <div className="mt-2 text-xs text-gray-600">{excelUploadResult}</div>}

              <div className="mt-3 text-[11px] text-gray-500">
                * 업로드는 현재 <span className="font-medium">새 행 추가</span> 방식입니다. (중복 병합/매칭 로직은 다음 단계에서 고도화)
              </div>
            </div>

            {/* 포맷 안내 모달 */}
            {excelHelpOpen && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
                <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold">엑셀 업로드 포맷 안내</div>
                      <div className="mt-1 text-xs text-gray-500">
                        첫 번째 시트의 헤더(컬럼명)를 기준으로 읽습니다. 아래 컬럼 중 일부만 있어도 업로드 가능합니다.
                        단, <span className="font-medium">이름은 필수</span>입니다.
                      </div>
                    </div>
                    <button
                      className="px-3 py-1 rounded-lg border text-sm hover:bg-slate-50"
                      onClick={() => setExcelHelpOpen(false)}
                    >
                      닫기
                    </button>
                  </div>

                  <div className="mt-4 text-sm">
                    <div className="font-semibold text-sm mb-2">권장 컬럼</div>
                    <ul className="text-xs text-gray-600 space-y-1 list-disc pl-5">
                      <li>이름 (필수)</li>
                      <li>관계, 연락처</li>
                      <li>참석여부(QR스캔기준), 참석시간</li>
                      <li>축의금, 축의방식(선택: 현금/계좌)</li>
                      <li>식권(개수), 답례(완료/미완료), 감사인사(완료/미완료), 메모</li>
                      <li>구분(선택: 신랑측/신부측)</li>
                    </ul>

                    <div className="mt-3 text-[11px] text-gray-500">
                      * 참석여부는 “참석/미참석”, “Y/N”, “TRUE/FALSE” 등도 인식합니다.
                      <br />
                      * 참석시간은 “2026-01-22 13:30”처럼 날짜/시간 문자열이면 인식합니다.
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        className="px-4 py-2 rounded-xl border text-sm hover:bg-slate-50"
                        onClick={downloadLedgerSampleExcel}
                      >
                        샘플 다운로드
                      </button>
                      <button
                        className="px-4 py-2 rounded-xl bg-pink-500 text-white text-sm"
                        onClick={() => {
                          setExcelHelpOpen(false);
                          clickExcelUpload();
                        }}
                      >
                        지금 업로드하기
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 필터 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <input
                className="w-full md:w-80 px-3 py-2 rounded-xl border text-sm"
                placeholder="이름/관계/연락처/메모 검색"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="flex items-center gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-pink-500"
                    checked={onlyAttended}
                    onChange={(e) => setOnlyAttended(e.target.checked)}
                    disabled={ledgerLoading}
                  />
                  참석만 <span className="text-xs text-gray-400">(스캔 기준)</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-pink-500"
                    checked={onlyThanksPending}
                    onChange={(e) => setOnlyThanksPending(e.target.checked)}
                    disabled={ledgerLoading}
                  />
                  답례 미완료만
                </label>
              </div>
            </div>

            {/* 수기 추가 */}
            <div className="rounded-2xl border p-4">
              <div className="text-sm font-semibold">장부 업데이트 (수기)</div>
              <p className="mt-1 text-xs text-gray-500">
                현금 봉투 축의금 등도 추가 입력 가능합니다. (스크래핑 내역은 잠김)
              </p>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-2">
                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-600">이름</label>
                  <input
                    className="mt-1 w-full px-3 py-2 rounded-xl border text-sm"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={!ownerMemberId}
                    placeholder="예: 김철수"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-600">연락처(선택)</label>
                  <input
                    className="mt-1 w-full px-3 py-2 rounded-xl border text-sm"
                    value={newPhone}
                    onChange={(e) => setNewPhone(formatKoreanMobile(e.target.value))}
                    disabled={!ownerMemberId}
                    placeholder="010-1234-5678"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-600">관계(선택)</label>
                  <input
                    className="mt-1 w-full px-3 py-2 rounded-xl border text-sm"
                    value={newRel}
                    onChange={(e) => setNewRel(e.target.value)}
                    disabled={!ownerMemberId}
                    placeholder="예: 친구/직장"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-600">구분(선택)</label>
                  <select
                    className="mt-1 w-full px-3 py-2 rounded-xl border text-sm bg-white"
                    value={newSide}
                    onChange={(e) => setNewSide(e.target.value as any)}
                    disabled={!ownerMemberId}
                  >
                    <option value="">선택 안 함</option>
                    <option value="groom">신랑측</option>
                    <option value="bride">신부측</option>
                  </select>
                </div>

                <div className="md:col-span-1 flex items-end">
                  <button
                    className="w-full px-4 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-50"
                    onClick={addLedgerRow}
                    disabled={!ownerMemberId}
                  >
                    추가
                  </button>
                </div>
              </div>
            </div>

            {/* 테이블 */}
            <div className="rounded-2xl border overflow-x-auto">
              <table className="min-w-[1200px] w-full text-sm">
                <thead className="bg-slate-50 text-xs text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-3">이름</th>
                    <th className="text-left px-3 py-3">관계</th>
                    <th className="text-left px-3 py-3">연락처</th>
                    <th className="text-left px-3 py-3">
                      참석 여부
                      <div className="text-[10px] text-gray-400">디지털방명록(QR) 스캔 기준</div>
                    </th>
                    <th className="text-left px-3 py-3">축의금</th>
                    <th className="text-left px-3 py-3">식권</th>
                    <th className="text-left px-3 py-3">답례</th>
                    <th className="text-left px-3 py-3">감사인사</th>
                    <th className="text-left px-3 py-3">메모</th>
                    <th className="text-left px-3 py-3">출처</th>
                    <th className="text-right px-3 py-3">저장</th>
                  </tr>
                </thead>

                <tbody>
                  {ledgerLoading ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-10 text-center text-gray-500">
                        장부를 불러오는 중...
                      </td>
                    </tr>
                  ) : filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-10 text-center text-gray-500">
                        표시할 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((r) => {
                      const locked = isLockedRow(r);

                      return (
                        <tr key={r.id} className="border-t">
                          <td className="px-3 py-3">
                            <input
                              className="w-40 px-2 py-2 rounded-lg border text-sm"
                              value={r.guest_name}
                              disabled={locked}
                              onChange={(e) => patchLedger(r.id, { guest_name: e.target.value })}
                              onBlur={() => saveLedgerRow(getLatestLedgerRow(r.id))}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <input
                              className="w-28 px-2 py-2 rounded-lg border text-sm"
                              value={r.relationship ?? ""}
                              disabled={locked}
                              onChange={(e) => patchLedger(r.id, { relationship: e.target.value })}
                              onBlur={() => saveLedgerRow(getLatestLedgerRow(r.id))}
                              placeholder="-"
                            />
                          </td>

                          <td className="px-3 py-3">
                            <input
                              className="w-36 px-2 py-2 rounded-lg border text-sm"
                              value={r.guest_phone ?? ""}
                              disabled={locked}
                              onChange={(e) =>
                                patchLedger(r.id, { guest_phone: formatKoreanMobile(e.target.value) })
                              }
                              onBlur={() => saveLedgerRow(getLatestLedgerRow(r.id))}
                              placeholder="-"
                            />
                          </td>

                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={locked}
                                className={`h-8 px-3 rounded-full border text-xs font-semibold ${
                                  r.attended
                                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                    : "bg-white border-gray-200 text-gray-600"
                                } ${locked ? "opacity-50" : ""}`}
                                onClick={() => {
                                  const next = !(r.attended === true);
                                  patchLedger(r.id, {
                                    attended: next,
                                    attended_at: next ? new Date().toISOString() : null,
                                  });
                                  saveLedgerRow(getLatestLedgerRow(r.id));
                                }}
                              >
                                {r.attended ? "참석" : "미참석"}
                              </button>

                              <span className="text-[11px] text-gray-400">
                                {r.attended_at ? new Date(r.attended_at).toLocaleString() : ""}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <input
                              inputMode="numeric"
                              className="w-28 px-2 py-2 rounded-lg border text-sm text-right"
                              value={r.gift_amount ?? ""}
                              disabled={locked}
                              onChange={(e) => {
                                const v = onlyDigits(e.target.value);
                                patchLedger(r.id, { gift_amount: v ? Number(v) : null });
                              }}
                              onBlur={() => saveLedgerRow(getLatestLedgerRow(r.id))}
                              placeholder="0"
                            />
                          </td>

                          <td className="px-3 py-3">
                            <input
                              inputMode="numeric"
                              className="w-16 px-2 py-2 rounded-lg border text-sm text-right"
                              value={r.ticket_count ?? 0}
                              disabled={locked}
                              onChange={(e) => {
                                const v = onlyDigits(e.target.value);
                                patchLedger(r.id, { ticket_count: v ? Number(v) : 0 });
                              }}
                              onBlur={() => saveLedgerRow(getLatestLedgerRow(r.id))}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <label className="inline-flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                className="accent-pink-500"
                                checked={r.return_given}
                                disabled={locked}
                                onChange={(e) => {
                                  patchLedger(r.id, { return_given: e.target.checked });
                                  saveLedgerRow(getLatestLedgerRow(r.id));
                                }}
                              />
                              답례 완료
                            </label>
                          </td>

                          <td className="px-3 py-3">
                            <label className="inline-flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                className="accent-pink-500"
                                checked={r.thanks_done}
                                disabled={locked}
                                onChange={(e) => {
                                  patchLedger(r.id, { thanks_done: e.target.checked });
                                  saveLedgerRow(getLatestLedgerRow(r.id));
                                }}
                              />
                              인사 완료
                            </label>
                          </td>

                          <td className="px-3 py-3">
                            <input
                              className="w-64 px-2 py-2 rounded-lg border text-sm"
                              value={r.memo ?? ""}
                              disabled={locked}
                              onChange={(e) => patchLedger(r.id, { memo: e.target.value })}
                              onBlur={() => saveLedgerRow(getLatestLedgerRow(r.id))}
                              placeholder="-"
                            />
                          </td>

                          <td className="px-3 py-3 text-xs text-gray-600">
                            {(r.created_source ?? "manual") === "scrape"
                              ? "스크래핑(잠김)"
                              : (r.created_source ?? "manual") === "excel"
                              ? "엑셀"
                              : "수기"}
                          </td>

                          <td className="px-3 py-3 text-right">
                            <button
                              className="px-3 py-2 rounded-xl border text-xs hover:bg-slate-50 disabled:opacity-50"
                              disabled={locked || savingId === r.id}
                              onClick={() => saveLedgerRow(getLatestLedgerRow(r.id))}
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

            <div className="text-[11px] text-gray-500">
              * 참석 여부는 <span className="font-semibold">디지털방명록(QR) 스캔 기준</span>이며, 필요 시 수기/엑셀로 보정 가능합니다.
              <br />
              * <span className="font-semibold">스크래핑 내역은 항상 잠김</span> 상태로 수정되지 않습니다.
            </div>
          </section>
        )}

        {/* ===== 메시지 탭 ===== */}
        {tab === "messages" && (
          <section>
            <h2 className="text-sm font-semibold mb-3">축하 메시지 목록</h2>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {messages.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((m) => (
                <div key={m.id} className="border rounded-xl px-4 py-3 bg-slate-50">
                  <p className="text-sm">{m.body}</p>
                  <div className="mt-1 text-xs text-gray-400">{m.nickname || m.guest_name || "익명"}</div>
                </div>
              ))}
            </div>

            {/* 페이지네이션(간단) */}
            <div className="mt-4 flex items-center justify-between">
              <button
                className="px-3 py-2 rounded-xl border text-xs disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                이전
              </button>
              <div className="text-xs text-gray-500">page {page}</div>
              <button
                className="px-3 py-2 rounded-xl border text-xs disabled:opacity-50"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * PAGE_SIZE >= messages.length}
              >
                다음
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
