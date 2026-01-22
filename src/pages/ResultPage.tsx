import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

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

  updated_at: string;
  created_at: string;
};

const PAGE_SIZE = 10;

// event_members에서 이메일/유저를 식별하는 컬럼명이 다를 수 있어서 후보로 둠
const MEMBER_EMAIL_COL_CANDIDATES = ["member_email", "email", "user_email"] as const;

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}
function formatKoreanMobile(input: string) {
  const d = onlyDigits(input).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
  // NOTE: 기존 변수명 newSide는 실제로 “측” 선택이므로 유지
  const [newSide, setNewSide] = useState<"" | "groom" | "bride">("");

  // ✅ CSV 업로드 UI (현재는 준비중)
  const [showCsvHelp, setShowCsvHelp] = useState(false);

  const isFinalized = reportStatus === "finalized";

  /* ------------------ 내 member id 찾기 ------------------ */
  async function resolveOwnerMemberId(): Promise<string | null> {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) return null;

    const user = authData.user;
    const email = (user.email ?? "").toLowerCase();

    // 1) user_id 컬럼이 있으면 가장 정확함
    const byUserId = await supabase
      .from("event_members")
      .select("id")
      .eq("event_id", eventId)
      // @ts-ignore
      .eq("user_id", user.id)
      .maybeSingle();

    if (byUserId.data?.id) return byUserId.data.id as string;

    // 2) email 후보 컬럼들로 찾기
    for (const col of MEMBER_EMAIL_COL_CANDIDATES) {
      const byEmail = await supabase
        .from("event_members")
        .select("id")
        .eq("event_id", eventId)
        // @ts-ignore
        .ilike(col, email)
        .maybeSingle();

      if (byEmail.data?.id) return byEmail.data.id as string;
    }

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

        // 축의금 개수
        const { count } = await supabase
          .from("event_scrape_transactions")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId)
          .eq("is_reflected", true);

        setTxCount(count ?? 0);

        // owner_member_id
        const memberId = await resolveOwnerMemberId();
        if (!memberId) {
          // 장부는 개인 기준이므로 member id 없으면 막는 게 맞음
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
        // 장부는 탭이므로 에러만 안내
      } finally {
        setLedgerLoading(false);
      }
    };

    fetchLedger();
  }, [eventId, ownerMemberId]);

  /* ------------------ 리포트 생성/갱신 ------------------ */
  const handleGenerateReport = async () => {
    if (reportStatus === "finalized") {
      setScrapeResult("확정된 리포트는 갱신할 수 없습니다.");
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
      "이 리포트는 현장 참석자 기준의 공식 기록으로 확정됩니다.\n확정 후에는 자동 조회나 수정이 불가능합니다.\n\n리포트를 확정할까요?"
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

  async function saveLedgerRow(row: LedgerRow) {
    if (isFinalized) return; // 확정 이후 수정 불가 정책 (현재는 전체 잠금)

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

    const { error } = await supabase
      .from("event_ledger_entries")
      .update(payload)
      .eq("id", row.id);

    setSavingId(null);

    if (error) {
      console.error(error);
      alert(`저장 실패: ${error.message}`);
      return;
    }
  }

  async function addLedgerRow() {
    if (isFinalized) return;
    if (!eventId || !ownerMemberId) return;

    if (!newName.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    const payload = {
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

  /* ------------------ CSV 샘플 다운로드 ------------------ */
  function downloadCsvSample() {
    // 최소 컬럼만: 나중에 업로드 파서도 이 헤더를 그대로 쓰면 됨
    const content = [
      "guest_name,guest_phone,relationship,side,gift_amount,gift_method,attended,ticket_count,return_given,thanks_done,memo,source",
      "김철수,01012345678,친구,groom,50000,cash,true,0,false,false,현금봉투,manual",
      "이영희,01099998888,직장,bride,100000,account,false,0,false,false,청첩장송금,offsite",
    ].join("\n");

    const filename = "장부_업로드_샘플.csv";
    downloadTextFile(filename, content, "text/csv;charset=utf-8");
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
    return { total, attended, totalAmount, thanksPending };
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
                이 화면은 <span className="font-semibold">개인 기준</span> 리포트입니다. (신랑/신부/혼주 각각 분리)
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              {reportStatus === "finalized" ? (
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">확정된 현장 참석자 리포트입니다</div>
                  <div className="mt-1 text-xs text-gray-500 max-w-[320px]">
                    이 리포트는 디지털 방명록을 통해 수집된 <span className="font-medium">현장 참석자 기준</span>의 공식 기록으로,
                    확정 이후에는 수정할 수 없습니다.
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
            <span className="px-3 py-1 rounded-full bg-slate-100">축의금 {txCount}건</span>
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
                이 이벤트에 대한 개인 리포트 권한(event_members)을 찾지 못했어요.
                <div className="mt-1 text-xs text-amber-700">
                  event_members의 이메일/유저 컬럼명이 다르면 발생합니다. (필요 시 수정)
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
            </div>

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

            {/* ✅ 장부 업데이트(수기) + CSV 업로드 UI */}
            <div className="rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">장부 업데이트 (수기)</div>
                  <p className="mt-1 text-xs text-gray-500">
                    계좌 외 축의금(현금 봉투 등)도 추가 입력 가능합니다. 또한 CSV로 여러 건을 한 번에 업로드할 수 있어요.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl border text-xs hover:bg-slate-50"
                    onClick={() => setShowCsvHelp(true)}
                  >
                    업로드 안내
                  </button>
                </div>
              </div>

              {/* 수기 입력 row */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-2">
                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-600">이름</label>
                  <input
                    className="mt-1 w-full px-3 py-2 rounded-xl border text-sm"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={!ownerMemberId || isFinalized}
                    placeholder="예: 김철수"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-600">연락처(선택)</label>
                  <input
                    className="mt-1 w-full px-3 py-2 rounded-xl border text-sm"
                    value={newPhone}
                    onChange={(e) => setNewPhone(formatKoreanMobile(e.target.value))}
                    disabled={!ownerMemberId || isFinalized}
                    placeholder="010-1234-5678"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-600">관계(선택)</label>
                  <input
                    className="mt-1 w-full px-3 py-2 rounded-xl border text-sm"
                    value={newRel}
                    onChange={(e) => setNewRel(e.target.value)}
                    disabled={!ownerMemberId || isFinalized}
                    placeholder="예: 친구/직장"
                  />
                </div>

                {/* NOTE: 기존 라벨 “구분(선택)”이 헷갈려서 명확하게 수정 */}
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-600">측(선택)</label>
                  <select
                    className="mt-1 w-full px-3 py-2 rounded-xl border text-sm bg-white"
                    value={newSide}
                    onChange={(e) => setNewSide(e.target.value as any)}
                    disabled={!ownerMemberId || isFinalized}
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
                    disabled={!ownerMemberId || isFinalized}
                  >
                    추가
                  </button>
                </div>
              </div>

              {/* CSV 업로드 UI */}
              <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">CSV로 장부 한번에 업로드</div>
                    <p className="mt-1 text-xs text-gray-500">
                      축의대 지인에게 받은 엑셀/종이 장부를 CSV로 변환해 업로드하면, 장부에 자동으로 통합됩니다.
                      <span className="block mt-1 text-[11px] text-gray-400">
                        * 구분(source): onsite=현장QR, offsite=비현장(청첩장/원격), manual=현금/수기
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={true || isFinalized}
                      className="px-4 py-2 rounded-xl bg-gray-300 text-white text-sm disabled:opacity-60"
                      onClick={() => {}}
                    >
                      CSV 업로드 (준비중)
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl border bg-white text-sm hover:bg-slate-50"
                      onClick={downloadCsvSample}
                    >
                      CSV 샘플 다운로드
                    </button>
                  </div>
                </div>

                {isFinalized && (
                  <div className="mt-2 text-xs text-amber-700">
                    리포트가 확정되어 업로드/수정이 잠겨있습니다.
                  </div>
                )}
              </div>

              {isFinalized && (
                <div className="mt-3 text-xs text-amber-700">
                  리포트가 확정되어 장부 수정이 잠겨있습니다.
                </div>
              )}
            </div>

            {/* 테이블 */}
            <div className="rounded-2xl border overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-slate-50 text-xs text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-3">이름</th>
                    <th className="text-left px-3 py-3">관계</th>
                    <th className="text-left px-3 py-3">연락처</th>
                    <th className="text-left px-3 py-3">
                      참석 여부
                      <div className="text-[10px] text-gray-400">디지털방명록 스캔 기준</div>
                    </th>
                    <th className="text-left px-3 py-3">축의금</th>
                    <th className="text-left px-3 py-3">식권</th>
                    <th className="text-left px-3 py-3">답례</th>
                    <th className="text-left px-3 py-3">감사인사</th>
                    <th className="text-left px-3 py-3">메모</th>
                    <th className="text-right px-3 py-3">저장</th>
                  </tr>
                </thead>

                <tbody>
                  {ledgerLoading ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-10 text-center text-gray-500">
                        장부를 불러오는 중...
                      </td>
                    </tr>
                  ) : filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-10 text-center text-gray-500">
                        표시할 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-3">
                          <input
                            className="w-40 px-2 py-2 rounded-lg border text-sm"
                            value={r.guest_name}
                            disabled={isFinalized}
                            onChange={(e) => patchLedger(r.id, { guest_name: e.target.value })}
                            onBlur={() => saveLedgerRow(getLatestLedgerRow(r.id))}
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            className="w-28 px-2 py-2 rounded-lg border text-sm"
                            value={r.relationship ?? ""}
                            disabled={isFinalized}
                            onChange={(e) => patchLedger(r.id, { relationship: e.target.value })}
                            onBlur={() => saveLedgerRow(getLatestLedgerRow(r.id))}
                            placeholder="-"
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            className="w-36 px-2 py-2 rounded-lg border text-sm"
                            value={r.guest_phone ?? ""}
                            disabled={isFinalized}
                            onChange={(e) => patchLedger(r.id, { guest_phone: formatKoreanMobile(e.target.value) })}
                            onBlur={() => saveLedgerRow(getLatestLedgerRow(r.id))}
                            placeholder="-"
                          />
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isFinalized}
                              className={`h-8 px-3 rounded-full border text-xs font-semibold ${
                                r.attended
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                  : "bg-white border-gray-200 text-gray-600"
                              } ${isFinalized ? "opacity-50" : ""}`}
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
                            disabled={isFinalized}
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
                            disabled={isFinalized}
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
                              disabled={isFinalized}
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
                              disabled={isFinalized}
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
                            disabled={isFinalized}
                            onChange={(e) => patchLedger(r.id, { memo: e.target.value })}
                            onBlur={() => saveLedgerRow(getLatestLedgerRow(r.id))}
                            placeholder="-"
                          />
                        </td>

                        <td className="px-3 py-3 text-right">
                          <button
                            className="px-3 py-2 rounded-xl border text-xs hover:bg-slate-50 disabled:opacity-50"
                            disabled={isFinalized || savingId === r.id}
                            onClick={() => saveLedgerRow(getLatestLedgerRow(r.id))}
                          >
                            {savingId === r.id ? "저장중" : "저장"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-[11px] text-gray-500">
              * 참석 여부는 <span className="font-semibold">디지털방명록(QR) 스캔 기준</span>이며, 필요 시 수기 수정 가능합니다.
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

        {/* ✅ CSV 업로드 안내 모달 */}
        {showCsvHelp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">CSV 업로드 안내</div>
                  <p className="mt-1 text-sm text-gray-600">
                    축의대 지인이 정리한 엑셀 장부를 CSV로 변환해서 한 번에 업로드하는 기능입니다.
                    (현재는 UI만 제공하며, 업로드 기능은 준비중입니다)
                  </p>
                </div>
                <button
                  className="px-3 py-1.5 rounded-xl border text-sm hover:bg-slate-50"
                  onClick={() => setShowCsvHelp(false)}
                >
                  닫기
                </button>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-gray-700 space-y-2">
                <div className="font-semibold">필수 컬럼</div>
                <ul className="list-disc pl-5 text-sm text-gray-600">
                  <li>guest_name (이름)</li>
                  <li>gift_amount (축의금)</li>
                  <li>source (onsite / offsite / manual)</li>
                </ul>

                <div className="font-semibold mt-3">권장 컬럼</div>
                <ul className="list-disc pl-5 text-sm text-gray-600">
                  <li>guest_phone (연락처)</li>
                  <li>relationship (관계)</li>
                  <li>side (groom / bride)</li>
                  <li>memo (메모)</li>
                </ul>

                <div className="text-xs text-gray-500 mt-2">
                  * 업로드 후에는 장부(event_ledger_entries)에 통합되어, 여기서 수정/정리가 가능합니다.
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 justify-end">
                <button
                  className="px-4 py-2 rounded-xl border bg-white text-sm hover:bg-slate-50"
                  onClick={downloadCsvSample}
                >
                  CSV 샘플 다운로드
                </button>
                <button
                  className="px-4 py-2 rounded-xl bg-black text-white text-sm"
                  onClick={() => setShowCsvHelp(false)}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
