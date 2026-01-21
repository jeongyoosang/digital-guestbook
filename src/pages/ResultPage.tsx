import { useEffect, useState } from "react";
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

const PAGE_SIZE = 10;

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

  // 축의금
  const [scrapeAccountId, setScrapeAccountId] = useState<string | null>(null);
  const [txCount, setTxCount] = useState<number>(0);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<string | null>(null);

  const [page, setPage] = useState(1);

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
          .select(
            "id, created_at, side, guest_name, nickname, relationship, body"
          )
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
      } catch (err) {
        console.error(err);
        setError("리포트를 불러오는 중 오류가 발생했어요.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [eventId]);

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

      const { error } = await supabase
        .from("events")
        .update({
          report_status: "finalized",
          report_finalized_at: new Date().toISOString(),
        })
        .eq("id", eventId);

      if (error) throw error;

      setReportStatus("finalized");
      setReportFinalizedAt(new Date().toISOString());
    } catch (e) {
      alert("리포트 확정 중 오류가 발생했습니다.");
    } finally {
      setFinalizing(false);
    }
  };

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
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-md p-6 md:p-8">

        {/* ===== 헤더 ===== */}
        <header className="mb-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">디지털 방명록 리포트</h1>
              {ceremonyDateText && (
                <p className="text-xs text-gray-400">{ceremonyDateText}</p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              {reportStatus === "finalized" ? (
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    확정된 현장 참석자 리포트입니다
                  </div>
                  <div className="mt-1 text-xs text-gray-500 max-w-[280px]">
                    이 리포트는 디지털 방명록을 통해 수집된{" "}
                    <span className="font-medium">현장 참석자 기준</span>의
                    공식 기록으로, 확정 이후에는 수정할 수 없습니다.
                  </div>
                  {reportFinalizedAt && (
                    <div className="mt-1 text-[11px] text-gray-400">
                      확정 시각:{" "}
                      {new Date(reportFinalizedAt).toLocaleString()}
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

          {scrapeResult && (
            <p className="mt-2 text-xs text-gray-500">{scrapeResult}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <span className="px-3 py-1 rounded-full bg-slate-100">
              전체 {totalCount}건
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100">
              신랑측 {groomCount}건
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100">
              신부측 {brideCount}건
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100">
              축의금 {txCount}건
            </span>
          </div>
        </header>

        {/* ===== 영상 다운로드 ===== */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-2">영상 다운로드</h2>
          <div className="rounded-2xl bg-slate-50 p-6 text-sm text-gray-600">
            예식 현장의 디스플레이 화면을 영상으로 저장해둘 수 있어요.
            <div className="mt-3">
              <button
                disabled
                className="px-4 py-2 rounded-xl bg-gray-300 text-white text-sm"
              >
                영상 다운로드 (준비중)
              </button>
            </div>
          </div>
        </section>

        {/* ===== 축하 메시지 ===== */}
        <section>
          <h2 className="text-sm font-semibold mb-3">축하 메시지 목록</h2>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {messages
              .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              .map((m) => (
                <div
                  key={m.id}
                  className="border rounded-xl px-4 py-3 bg-slate-50"
                >
                  <p className="text-sm">{m.body}</p>
                  <div className="mt-1 text-xs text-gray-400">
                    {m.nickname || m.guest_name || "익명"}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
