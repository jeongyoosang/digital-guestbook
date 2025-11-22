// src/pages/ResultPage.tsx
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

const ROTATION_INTERVAL_MS = 5000;
const MAX_VISIBLE = 10;
const PAGE_SIZE = 10;

// 🔹 다시보기용 영상 URL (지금은 업로드된 mp4 경로를 사용)
const REPLAY_VIDEO_URL = "/mnt/data/KakaoTalk_20251122_180123048.mp4";

export default function ResultPage() {
  const { eventId } = useParams<RouteParams>();

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [settings, setSettings] = useState<EventSettingsLite | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 리플레이용 메시지 순환
  const [allReplayMessages, setAllReplayMessages] = useState<MessageRow[]>([]);
  const [visibleReplayMessages, setVisibleReplayMessages] = useState<
    MessageRow[]
  >([]);

  // 리스트용 페이지네이션
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!eventId) {
      setError("잘못된 접근입니다. 이벤트 정보가 없습니다.");
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1) 메시지 전체 조회
        const { data: msgData, error: msgError } = await supabase
          .from("messages")
          .select(
            "id, created_at, side, guest_name, nickname, relationship, body"
          )
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });

        if (msgError) throw msgError;
        const list = msgData || [];
        setMessages(list);
        setAllReplayMessages(list);

        // 2) event_settings 일부 조회 (신랑/신부, 날짜용)
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
      } catch (err) {
        console.error(err);
        setError("결과를 불러오는 중 오류가 발생했어요.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [eventId]);

  // 리플레이 영역: DisplayPage와 비슷한 순환 로직
  useEffect(() => {
    const all = allReplayMessages;
    if (!all || all.length === 0) {
      setVisibleReplayMessages([]);
      return;
    }

    if (all.length <= MAX_VISIBLE) {
      setVisibleReplayMessages(all);
      return;
    }

    let older = all.slice(0, -(MAX_VISIBLE - 1));
    let latestStable = all.slice(-(MAX_VISIBLE - 1));

    let rollingIndex = older.length - 1;
    setVisibleReplayMessages([older[rollingIndex], ...latestStable]);

    const interval = setInterval(() => {
      const current = [...all];
      if (current.length <= MAX_VISIBLE) {
        setVisibleReplayMessages(current);
        return;
      }

      older = current.slice(0, -(MAX_VISIBLE - 1));
      latestStable = current.slice(-(MAX_VISIBLE - 1));

      if (older.length === 0) {
        setVisibleReplayMessages(current.slice(-MAX_VISIBLE));
        return;
      }

      rollingIndex = (rollingIndex - 1 + older.length) % older.length;
      const rollingMessage = older[rollingIndex];

      setVisibleReplayMessages([rollingMessage, ...latestStable]);
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [allReplayMessages]);

  const slotPositions = useMemo(() => {
    return visibleReplayMessages.map(() => {
      const top = 18 + Math.random() * 50;
      const left = 10 + Math.random() * 60;
      return { top: `${top}%`, left: `${left}%` };
    });
  }, [visibleReplayMessages]);

  const totalCount = messages.length;
  const groomCount = messages.filter((m) => m.side === "groom").length;
  const brideCount = messages.filter((m) => m.side === "bride").length;

  const ceremonyDateText =
    settings?.ceremony_date &&
    (() => {
      const [y, m, d] = (settings.ceremony_date as string).split("-");
      return `${y}년 ${Number(m)}월 ${Number(d)}일`;
    })();

  const mainRecipients = (() => {
    if (!settings?.recipients) return null;
    const groom = settings.recipients.find((r) => r.role?.includes("신랑"));
    const bride = settings.recipients.find((r) => r.role?.includes("신부"));
    return { groom, bride };
  })();

  // 🔹 "영상 링크 복사"
  const handleCopyReplayLink = async () => {
    try {
      if (navigator.clipboard && REPLAY_VIDEO_URL) {
        await navigator.clipboard.writeText(REPLAY_VIDEO_URL);
        alert("영상 링크가 복사되었습니다.\n카카오톡 등으로 붙여넣어 보내주세요.");
      } else {
        window.prompt("아래 링크를 복사해 주세요.", REPLAY_VIDEO_URL);
      }
    } catch (err) {
      console.error(err);
      alert("링크 복사 중 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  };

  // 🔹 "새 창에서 크게 보기" → 영상 URL 새창 열기
  const handleOpenReplayInNewTab = () => {
    if (!REPLAY_VIDEO_URL) {
      alert("아직 영상 링크가 준비되지 않았습니다.");
      return;
    }
    window.open(REPLAY_VIDEO_URL, "_blank");
  };

  // CSV 다운로드 (모바일 + 카카오 인앱 고려)
  const handleDownloadCsv = () => {
    if (!messages.length) {
      alert("다운로드할 메세지가 없습니다.");
      return;
    }

    const header = [
      "순번",
      "작성시각",
      "신랑/신부측",
      "성함",
      "표시 이름(닉네임)",
      "관계",
      "메세지 내용",
    ];

    const rows = messages.map((m, index) => {
      const created = new Date(m.created_at).toLocaleString("ko-KR", {
        hour12: false,
      });

      const sideKorean =
        m.side === "groom" ? "신랑측" : m.side === "bride" ? "신부측" : "";

      const displayName = m.nickname || "";

      return [
        (index + 1).toString(),
        created,
        sideKorean,
        m.guest_name || "",
        displayName,
        m.relationship || "",
        m.body.replace(/\r?\n/g, " "),
      ];
    });

    const csvContent =
      [header, ...rows]
        .map((cols) =>
          cols
            .map((c) => {
              const escaped = c.replace(/"/g, '""');
              return `"${escaped}"`;
            })
            .join(",")
        )
        .join("\r\n") + "\r\n";

    // UTF-8 BOM
    const csvWithBom = "\uFEFF" + csvContent;

    const blob = new Blob([csvWithBom], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const fileDate = ceremonyDateText || "wedding";
    const fileName = `디지털방명록_${fileDate}.csv`;

    const ua = navigator.userAgent || "";
    const isKakao = /KAKAOTALK/i.test(ua);

    if (isKakao) {
      // 카카오 인앱 브라우저 특수 안내
      alert(
        "카카오톡 안에서는 파일 다운로드가 잘 되지 않을 수 있어요.\n" +
          "오른쪽 상단 ··· 버튼을 눌러 '기본 브라우저(Chrome/Safari)에서 열기'를 선택한 뒤,\n" +
          "다시 엑셀(CSV) 다운로드를 눌러주세요."
      );
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  // 페이지네이션 계산
  const totalPages = Math.max(1, Math.ceil(messages.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedMessages = messages.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-lg">결과를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!eventId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm">잘못된 접근입니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-md p-6 md:p-8">
        {/* 상단 요약 */}
        <header className="mb-6 border-b pb-4">
          <h1 className="text-2xl font-semibold mb-1">디지털 방명록 결과</h1>
          {mainRecipients && (
            <p className="text-sm text-gray-600">
              {mainRecipients.groom?.name || "신랑"} ·{" "}
              {mainRecipients.bride?.name || "신부"}님의 예식
            </p>
          )}
          {ceremonyDateText && (
            <p className="text-xs text-gray-400 mt-1">{ceremonyDateText}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-gray-700">
              전체 메세지: <strong className="ml-1">{totalCount}</strong>건
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-gray-700">
              신랑측: <strong className="ml-1">{groomCount}</strong>건
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-gray-700">
              신부측: <strong className="ml-1">{brideCount}</strong>건
            </span>
          </div>
        </header>

        {/* ✅ 디지털 방명록 다시보기 (메세지 영역만) */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">디지털 방명록 다시보기</h2>
          <p className="text-xs text-gray-500 mb-3">
            예식장에서 보였던 디지털 방명록의 메세지 영역만 다시 볼 수 있습니다.
            <br />
            영상 링크를 복사해 두셨다가, 원하실 때 열어보시거나 저장해 두시면 됩니다.
          </p>

          {/* 메시지 영역만을 위한 미니 디스플레이 */}
          <div className="w-full max-w-3xl mx-auto bg-gradient-to-b from-pink-100 via-pink-50 to-white rounded-[32px] shadow-md border border-white/70 backdrop-blur px-4 py-6">
            <div className="bg-white/95 rounded-[28px] shadow-xl border border-white/70 relative overflow-hidden">
              <div className="pt-6 pb-4 text-center">
                <p className="text-[11px] tracking-[0.25em] text-pink-400 font-semibold uppercase">
                  WEDDING MESSAGES
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  하객 분들의 마음이 전해지고 있어요 💐
                </p>
              </div>

              <div className="relative px-6 pb-8 pt-2 min-h-[220px]">
                {visibleReplayMessages.length === 0 && (
                  <div className="flex items-center justify-center h-[200px]">
                    <p className="text-sm text-gray-400 text-center">
                      아직 등록된 축하메세지가 없습니다.
                      <br />
                      방명록 메세지가 여기에서 재생됩니다 ✨
                    </p>
                  </div>
                )}

                <div className="relative h-[220px] overflow-hidden">
                  {visibleReplayMessages.map((msg, index) => {
                    const pos = slotPositions[index] || {
                      top: "50%",
                      left: "50%",
                    };
                    const delaySec = (index * 3) % 20;

                    return (
                      <div
                        key={msg.id}
                        className="absolute max-w-sm bg-white/90 rounded-3xl shadow-lg px-6 py-4
                                   text-center text-gray-800 text-sm leading-relaxed
                                   animate-[fadeInOut_20s_ease-in-out_infinite]
                                   border border-pink-50"
                        style={{
                          ...pos,
                          transform: "translate(-50%, -50%)",
                          animationDelay: `${delaySec}s`,
                        }}
                      >
                        <p className="whitespace-pre-wrap break-keep">
                          {msg.body}
                        </p>
                        {msg.nickname && (
                          <p className="mt-3 text-xs text-pink-400 font-medium">
                            {msg.nickname}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 🔘 버튼 2개: 새창보기 + 영상 링크 복사 */}
          <div className="mt-3 flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={handleOpenReplayInNewTab}
              className="px-3 py-1.5 rounded-full border border-gray-300 text-xs md:text-sm text-gray-700 bg-white"
            >
              새 창에서 크게 보기
            </button>
            <button
              type="button"
              onClick={handleCopyReplayLink}
              className="px-3 py-1.5 rounded-full bg-pink-500 text-white text-xs md:text-sm font-semibold"
            >
              영상 링크 복사
            </button>
          </div>
        </section>

        {/* ✅ 엑셀 다운로드 버튼: 첫 번째 메세지 칸 바로 위, 왼쪽 정렬 */}
        <div className="mb-3 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-800">
            축하 메세지 목록
          </h2>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="px-3 py-1.5 rounded-full bg-black text-white text-xs md:text-sm font-semibold"
          >
            엑셀(CSV)로 다운로드
          </button>
        </div>

        {/* 메세지 목록 + 페이지네이션 */}
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500">
            아직 수집된 축하 메세지가 없습니다.
          </p>
        ) : (
          <>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {pagedMessages.map((m, index) => {
                const created = new Date(m.created_at).toLocaleString("ko-KR", {
                  hour12: false,
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const globalIndex =
                  (currentPage - 1) * PAGE_SIZE + index + 1;

                const sideLabel =
                  m.side === "groom"
                    ? "신랑측"
                    : m.side === "bride"
                    ? "신부측"
                    : "";

                return (
                  <div
                    key={m.id}
                    className="border rounded-2xl px-4 py-3 bg-slate-50/60"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-400">#{globalIndex}</span>
                        {sideLabel && (
                          <span className="px-2 py-0.5 rounded-full bg-white text-gray-700 border border-gray-200">
                            {sideLabel}
                          </span>
                        )}
                        {m.relationship && (
                          <span className="px-2 py-0.5 rounded-full bg-white text-gray-700 border border-gray-200">
                            {m.relationship}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {created}
                      </span>
                    </div>

                    <p className="text-sm text-gray-800 whitespace-pre-wrap mb-2">
                      {m.body}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                      {m.guest_name && <span>실명: {m.guest_name}</span>}
                      {m.nickname && <span>표시 이름: {m.nickname}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 페이지네이션 컨트롤 */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs">
              <button
                type="button"
                onClick={goPrev}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 rounded-full border ${
                  currentPage === 1
                    ? "border-gray-200 text-gray-300 cursor-not-allowed"
                    : "border-gray-300 text-gray-700"
                } bg-white`}
              >
                이전
              </button>
              <span className="text-gray-500">
                {currentPage} / {totalPages} 페이지
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={currentPage === totalPages}
                className={`px-3 py-1.5 rounded-full border ${
                  currentPage === totalPages
                    ? "border-gray-200 text-gray-300 cursor-not-allowed"
                    : "border-gray-300 text-gray-700"
                } bg-white`}
              >
                다음
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
