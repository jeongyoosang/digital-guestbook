// src/pages/AdminPage.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReservationStatus = "new" | "in_progress" | "done";

type ReservationRow = {
  id: string;
  created_at: string;
  name: string | null;

  // ✅ 추가 (reservations 테이블에 email 컬럼이 이미 있음)
  email?: string | null;

  role: string | null;
  relation: string | null;
  phone: string | null;

  event_date: string | null;
  wedding_time: string | null;
  date_status: "confirmed" | "tentative";

  tentative_date: string | null;

  venue_name: string | null;
  venue_address: string | null;

  mobile_invitation_link: string | null;
  message: string | null;

  status: ReservationStatus | null;
};

type EventRowForMap = {
  id: string;
  reservation_id: string | null;
};

export const AdminPage = () => {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);

  // reservation_id -> event_id 매핑
  const [eventIdMap, setEventIdMap] = useState<Record<string, string | undefined>>({});
  const [creatingEvent, setCreatingEvent] = useState(false);

  const selected = reservations.find((r) => r.id === selectedId) ?? null;

  // ✅ "예약설정 페이지" URL (IA 정공법 기준)
  const getSettingsUrl = (eventId: string) => `${window.location.origin}/app/event/${eventId}/settings`;

  const copyToClipboardBestEffort = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("예약설정 링크가 클립보드에 복사되었습니다.");
      return true;
    } catch {
      return false;
    }
  };

  // reservations에 해당하는 events를 한 번에 가져와 맵으로 저장
  const fetchEventsForReservations = async (rows: ReservationRow[]) => {
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) {
      setEventIdMap({});
      return;
    }

    try {
      const { data, error } = await supabase.from("events").select("id, reservation_id").in("reservation_id", ids);
      if (error) throw error;

      const map: Record<string, string> = {};
      (data as EventRowForMap[]).forEach((row) => {
        if (row.reservation_id) map[row.reservation_id] = row.id;
      });

      setEventIdMap(map);
    } catch (e) {
      console.error("이벤트 매핑 조회 오류:", e);
    }
  };

  const fetchReservations = async () => {
    setLoading(true);
    try {
      // ✅ email 포함해서 가져오기 (select *면 이미 포함되지만 명시해도 OK)
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rows = (data || []) as ReservationRow[];
      setReservations(rows);

      // 이벤트 매핑도 함께 로드
      void fetchEventsForReservations(rows);

      // 첫 로드 시 맨 위 예약 자동 선택
      if (!selectedId && rows.length > 0) {
        setSelectedId(rows[0].id);
      }
    } catch (e) {
      console.error("예약 조회 오류:", e);
      alert("예약 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ 이벤트가 없으면 생성하고, 있으면 기존 eventId 반환
  const ensureEventForReservation = async (row: ReservationRow) => {
    const existingEventId = eventIdMap[row.id];
    if (existingEventId) return existingEventId;

    const { data, error } = await supabase
      .from("events")
      .insert({ reservation_id: row.id })
      .select("id")
      .single();

    if (error) throw error;

    const newEventId = (data as { id: string }).id;

    // 매핑 업데이트
    setEventIdMap((prev) => ({ ...prev, [row.id]: newEventId }));

    return newEventId;
  };

  // ✅ 진행 전환(예약금 확인) 시 예약설정 링크 발급/복사/열기
  const promptOpenOrCopySettings = async (eventId: string) => {
    const settingsUrl = getSettingsUrl(eventId);

    const openNow = window.confirm(
      `진행 상태로 전환되며 예약설정 링크가 준비되었습니다.\n\n예약설정 페이지를 새 창에서 여시겠습니까?\n\n${settingsUrl}`
    );

    if (openNow) {
      window.open(settingsUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const copied = await copyToClipboardBestEffort(settingsUrl);
    if (!copied) {
      alert(`아래 링크를 복사해 고객에게 전달해주세요:\n\n${settingsUrl}`);
    }
  };

  // 상태 변경 (신규 → 진행 중 → 완료 → 신규)
  const updateStatus = async (row: ReservationRow) => {
    if (!row.id) return;
    setStatusChanging(true);

    try {
      const current: ReservationStatus = (row.status ?? "new") as ReservationStatus;
      const next: ReservationStatus =
        current === "new" ? "in_progress" : current === "in_progress" ? "done" : "new";

      // 1) 상태 업데이트
      const { error } = await supabase.from("reservations").update({ status: next }).eq("id", row.id);
      if (error) throw error;

      // 2) 로컬 state 동기화
      setReservations((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));

      // 3) ✅ 신규 -> 진행(in_progress) 이라면 이벤트 자동 생성 + 예약설정 링크 처리
      if (current === "new" && next === "in_progress") {
        const eventId = await ensureEventForReservation(row);
        await promptOpenOrCopySettings(eventId);
      }
    } catch (e) {
      console.error("상태 변경 오류:", e);
      alert("상태를 변경하는 중 오류가 발생했습니다.");
    } finally {
      setStatusChanging(false);
    }
  };

  // 선택된 예약에 대한 이벤트 생성 또는 예약설정 페이지 열기
  const handleCreateOrOpenEvent = async (row: ReservationRow) => {
    if (!row.id) return;

    setCreatingEvent(true);
    try {
      const eventId = await ensureEventForReservation(row);
      const settingsUrl = getSettingsUrl(eventId);

      const openNow = window.confirm(`예약설정 페이지를 새 창에서 여시겠습니까?\n\n${settingsUrl}`);
      if (openNow) {
        window.open(settingsUrl, "_blank", "noopener,noreferrer");
      } else {
        const copied = await copyToClipboardBestEffort(settingsUrl);
        if (!copied) alert(settingsUrl);
      }
    } catch (e) {
      console.error("이벤트 생성/열기 오류:", e);
      alert("이벤트를 생성/열기 하는 중 오류가 발생했습니다.");
    } finally {
      setCreatingEvent(false);
    }
  };

  useEffect(() => {
    fetchReservations();
    const t = setInterval(fetchReservations, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="min-h-screen bg-ivory px-4 py-8">
      <div className="container mx-auto max-w-6xl">
        {/* 헤더 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl text-ink/90">Admin 대시보드</h1>
            <p className="text-sm text-ink/60 mt-1">
              현재는 <strong>예약 관리</strong>와 <strong>이벤트 생성</strong> 기능만 활성화된 상태입니다.
              <br className="hidden sm:block" />
              추후 이 화면에서 이벤트(결혼식), 디스플레이 템플릿, 데이터 리포트까지 한 번에 확인할 수 있게 확장할 예정입니다.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={fetchReservations}
            disabled={loading}
            className="self-start border-leafLight text-ink hover:bg-ivory/70"
          >
            {loading ? "불러오는 중…" : "예약 새로고침"}
          </Button>
        </div>

        {/* 메인 레이아웃 */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)]">
          {/* 왼쪽: 예약 리스트 */}
          <Card className="bg-white/80 backdrop-blur border-leafLight/60">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-ink/90">예약 목록</h2>
                <span className="text-xs text-ink/50">총 {reservations.length}건</span>
              </div>

              <div className="border border-leafLight/50 rounded-2xl overflow-hidden bg-ivory/40 max-h-[520px]">
                {reservations.length === 0 ? (
                  <div className="py-16 text-center text-ink/60 text-sm">
                    아직 접수된 예약이 없습니다.
                    <br />
                    랜딩페이지의 예약 문의가 접수되면 이곳에 순서대로 표시됩니다.
                  </div>
                ) : (
                  <ul className="divide-y divide-leafLight/40 overflow-auto max-h-[520px]">
                    {reservations.map((r) => {
                      const isSelected = r.id === selectedId;
                      const hasEvent = !!eventIdMap[r.id];

                      const dateText =
                        r.date_status === "confirmed" ? r.event_date ?? "-" : r.tentative_date || "미정";

                      const timeText =
                        r.date_status === "confirmed" && r.wedding_time ? r.wedding_time.slice(0, 5) : "";

                      const statusLabel =
                        r.status === "done" ? "완료" : r.status === "in_progress" ? "진행 중" : "신규";

                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(r.id)}
                            className={cn(
                              "w-full text-left px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-1 hover:bg-white/70",
                              isSelected && "bg-white"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-ink truncate">
                                {r.name || "(이름 없음)"}{" "}
                                {r.role && <span className="text-xs text-ink/60">/ {r.role}</span>}
                              </div>
                              <div className="flex items-center gap-1">
                                {hasEvent && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                    이벤트 있음
                                  </span>
                                )}
                                <span
                                  className={cn(
                                    "text-[11px] px-2 py-0.5 rounded-full border",
                                    r.status === "done"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                      : r.status === "in_progress"
                                      ? "bg-amber-50 text-amber-700 border-amber-100"
                                      : "bg-slate-50 text-slate-600 border-slate-200"
                                  )}
                                >
                                  {statusLabel}
                                </span>
                              </div>
                            </div>

                            <div className="text-xs text-ink/60 flex flex-wrap gap-x-2 gap-y-0.5">
                              <span>{r.date_status === "confirmed" ? "날짜 확정" : "날짜 미정"}</span>
                              <span>·</span>
                              <span>
                                {dateText}
                                {timeText && ` ${timeText}`}
                              </span>
                            </div>

                            {r.venue_name && <div className="text-xs text-ink/70 truncate">{r.venue_name}</div>}

                            <div className="text-[11px] text-ink/50">
                              접수 :{" "}
                              {new Date(r.created_at).toLocaleString("ko-KR", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 오른쪽: 상세 보기 */}
          <Card className="bg-white/90 backdrop-blur border-leafLight/60">
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-ink/90 mb-4">예약 상세</h2>

              {!selected ? (
                <div className="py-20 text-center text-ink/60 text-sm">왼쪽 목록에서 확인하고 싶은 예약을 선택해주세요.</div>
              ) : (
                <div className="space-y-5 text-sm text-ink/80">
                  {/* 기본 정보 */}
                  <section className="space-y-1">
                    <h3 className="font-semibold text-ink/90 mb-1">기본 정보</h3>
                    <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-y-1.5">
                      <span className="text-ink/60">이름</span>
                      <span>
                        {selected.name || "-"}{" "}
                        {selected.role && <span className="text-ink/60">/ {selected.role}</span>}
                      </span>

                      {/* ✅ 이메일 표시 */}
                      <span className="text-ink/60">이메일</span>
                      <span className="font-mono break-all">{selected.email || "-"}</span>

                      <span className="text-ink/60">관계</span>
                      <span>{selected.relation || "-"}</span>

                      <span className="text-ink/60">연락처</span>
                      <span>{selected.phone || "-"}</span>

                      <span className="text-ink/60">상태</span>
                      <span>
                        {selected.status === "done" ? "완료" : selected.status === "in_progress" ? "진행 중" : "신규"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={statusChanging}
                        className="border-leafLight text-ink hover:bg-ivory/70"
                        onClick={() => updateStatus(selected)}
                      >
                        {statusChanging ? "변경 중..." : "상태 바꾸기 (신규 → 진행 → 완료)"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={creatingEvent}
                        className="border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={() => handleCreateOrOpenEvent(selected)}
                      >
                        {creatingEvent
                          ? "처리 중..."
                          : eventIdMap[selected.id]
                          ? "예약설정페이지 열기"
                          : "예약설정 링크 생성/열기"}
                      </Button>
                    </div>
                  </section>

                  {/* 일정/장소 */}
                  <section className="space-y-1">
                    <h3 className="font-semibold text-ink/90 mb-1">일정 & 장소</h3>
                    <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-y-1.5">
                      <span className="text-ink/60">날짜 상태</span>
                      <span>{selected.date_status === "confirmed" ? "날짜 확정" : "날짜 미정"}</span>

                      <span className="text-ink/60">예식일자</span>
                      <span>
                        {selected.date_status === "confirmed" ? selected.event_date || "-" : selected.tentative_date || "미정"}
                      </span>

                      <span className="text-ink/60">예식 시간</span>
                      <span>{selected.wedding_time ? selected.wedding_time.slice(0, 5) : "-"}</span>

                      <span className="text-ink/60">예식장</span>
                      <span>{selected.venue_name || "-"}</span>

                      <span className="text-ink/60">주소</span>
                      <span className="whitespace-pre-line">{selected.venue_address || "-"}</span>
                    </div>
                  </section>

                  {/* 모바일 청첩장 */}
                  <section className="space-y-1">
                    <h3 className="font-semibold text-ink/90 mb-1">모바일 청첩장</h3>
                    {selected.mobile_invitation_link ? (
                      <a
                        href={selected.mobile_invitation_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-leaf underline break-all"
                      >
                        {selected.mobile_invitation_link}
                      </a>
                    ) : (
                      <p className="text-ink/60 text-sm">입력된 모바일 청첩장 링크가 없습니다.</p>
                    )}
                  </section>

                  {/* 문의내용 */}
                  <section className="space-y-1">
                    <h3 className="font-semibold text-ink/90 mb-1">문의 내용</h3>
                    <div className="text-sm text-ink/80 whitespace-pre-line bg-ivory/70 border border-leafLight/50 rounded-xl px-3 py-2 min-h-[60px]">
                      {selected.message?.trim() || "별도 문의 내용이 없습니다."}
                    </div>
                  </section>

                  <section className="border-t border-dashed border-leafLight/60 pt-3 text-xs text-ink/60">
                    <p className="mb-1">
                      • 예약금 입금 확인 후 <strong>신규 → 진행</strong>으로 변경하면{" "}
                      <strong>이벤트가 자동 생성</strong>되고 <strong>예약설정 링크</strong>가 발급됩니다.
                    </p>
                    <p>• 당일 종료 및 리포트 발송까지 완료되면 <strong>완료</strong>로 변경하세요.</p>
                  </section>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
