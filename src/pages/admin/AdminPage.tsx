// src/pages/AdminPage.tsx
import { useEffect, useMemo, useState } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReservationStatus = "new" | "in_progress" | "done";

type ReservationRow = {
  id: string;
  created_at: string;
  name: string | null;
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

type EventRow = {
  id: string;
  reservation_id: string | null;
  owner_email?: string | null;
  is_public?: boolean | null;
  [key: string]: any;
};

type EventSettingsRow = {
  id: string;
  event_id: string;
  [key: string]: any;
};

const ADMIN_EMAIL = "goraeuniverse@gmail.com";

export const AdminPage = () => {
  const [booting, setBooting] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [statusChanging, setStatusChanging] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);

  // reservation_id -> event row
  const [eventMap, setEventMap] = useState<Record<string, EventRow | undefined>>({});
  // event_id -> settings row
  const [settingsMap, setSettingsMap] = useState<Record<string, EventSettingsRow | undefined>>({});

  const selected = useMemo(
    () => reservations.find((r) => r.id === selectedId) ?? null,
    [reservations, selectedId]
  );

  const selectedEvent = useMemo(() => {
    if (!selected?.id) return null;
    return eventMap[selected.id] ?? null;
  }, [selected?.id, eventMap]);

  const selectedSettings = useMemo(() => {
    const eid = selectedEvent?.id;
    if (!eid) return null;
    return settingsMap[eid] ?? null;
  }, [selectedEvent?.id, settingsMap]);

  // ✅ IA 정공법 URL들
  const getSettingsUrl = (eventId: string) => `${window.location.origin}/app/event/${eventId}/settings`;
  const getReportUrl = (eventId: string) => `${window.location.origin}/app/event/${eventId}/report`;
  const getDisplayUrl = (eventId: string) => `${window.location.origin}/display/${eventId}`;
  const getGuestUrl = (eventId: string) => `${window.location.origin}/guest/${eventId}`;

  const copyToClipboardBestEffort = async (text: string, okMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(okMessage);
      return true;
    } catch {
      return false;
    }
  };

  const fetchEventsForReservations = async (rows: ReservationRow[]) => {
    const ids = rows.map((r) => r.id).filter(Boolean);
    if (ids.length === 0) {
      setEventMap({});
      setSettingsMap({});
      return;
    }

    try {
      // ✅ supabase -> supabaseAdmin
      const { data, error } = await supabaseAdmin
        .from("events")
        .select("*")
        .in("reservation_id", ids);

      if (error) throw error;

      const map: Record<string, EventRow> = {};
      (data as EventRow[]).forEach((e) => {
        if (e.reservation_id) map[e.reservation_id] = e;
      });

      setEventMap(map);

      // 이벤트가 있는 것들에 대해 settings도 한 번에 로드
      const eventIds = (data as EventRow[]).map((e) => e.id).filter(Boolean);
      void fetchSettingsForEvents(eventIds);
    } catch (e) {
      console.error("이벤트 매핑 조회 오류:", e);
      // 치명적이지 않으니 조용히 실패
    }
  };

  const fetchSettingsForEvents = async (eventIds: string[]) => {
    if (eventIds.length === 0) {
      setSettingsMap({});
      return;
    }

    try {
      // ✅ supabase -> supabaseAdmin
      const { data, error } = await supabaseAdmin
        .from("event_settings")
        .select("*")
        .in("event_id", eventIds);

      if (error) throw error;

      const map: Record<string, EventSettingsRow> = {};
      (data as EventSettingsRow[]).forEach((s) => {
        if (s.event_id) map[s.event_id] = s;
      });
      setSettingsMap(map);
    } catch (e) {
      console.error("event_settings 조회 오류:", e);
    }
  };

  const fetchReservations = async () => {
    setLoading(true);
    try {
      // ✅ supabase -> supabaseAdmin
      const { data, error } = await supabaseAdmin
        .from("reservations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data || []) as ReservationRow[];
      setReservations(rows);

      void fetchEventsForReservations(rows);

      if (!selectedId && rows.length > 0) setSelectedId(rows[0].id);
    } catch (e) {
      console.error("예약 조회 오류:", e);
      alert("예약 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

         // ✅ 이벤트 없으면 생성 (관리자는 insert 가능)
    const ensureEventForReservation = async (row: ReservationRow) => {
      const existing = eventMap[row.id];
      if (existing?.id) return existing.id;

      // ✅ owner_email / is_public까지 같이 넣어서 재발 방지
      const payload: Partial<EventRow> = {
        reservation_id: row.id,
        owner_email: row.email ?? null,   // ✅ 핵심
        is_public: true,                 // ✅ 기본값(원하면 false로)
      };

      const { data, error } = await supabaseAdmin
        .from("events")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;

      const newEvent = data as EventRow;

      setEventMap((prev) => ({ ...prev, [row.id]: newEvent }));

      // settings도 미리 로드
      void fetchSettingsForEvents([newEvent.id]);

      return newEvent.id;
    };


  const promptOpenOrCopySettings = async (eventId: string) => {
    const settingsUrl = getSettingsUrl(eventId);

    const openNow = window.confirm(
      `진행 상태로 전환되며 예약설정 링크가 준비되었습니다.\n\n예약설정 페이지를 새 창에서 여시겠습니까?\n\n${settingsUrl}`
    );

    if (openNow) {
      window.open(settingsUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const copied = await copyToClipboardBestEffort(
      settingsUrl,
      "예약설정 링크가 클립보드에 복사되었습니다."
    );
    if (!copied) alert(settingsUrl);
  };

  const updateStatus = async (row: ReservationRow) => {
    if (!row.id) return;
    setStatusChanging(true);

    try {
      const current: ReservationStatus = (row.status ?? "new") as ReservationStatus;
      const next: ReservationStatus =
        current === "new" ? "in_progress" : current === "in_progress" ? "done" : "new";

      // ✅ supabase -> supabaseAdmin
      const { error } = await supabaseAdmin
        .from("reservations")
        .update({ status: next })
        .eq("id", row.id);

      if (error) throw error;

      setReservations((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: next } : r))
      );

      // 신규 -> 진행 : 이벤트 생성 + 예약설정 링크 안내
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

  const handleCreateOrOpenEvent = async (row: ReservationRow) => {
    if (!row.id) return;

    setCreatingEvent(true);
    try {
      const eventId = await ensureEventForReservation(row);
      const url = getSettingsUrl(eventId);

      const openNow = window.confirm(`예약설정 페이지를 새 창에서 여시겠습니까?\n\n${url}`);
      if (openNow) window.open(url, "_blank", "noopener,noreferrer");
      else {
        const copied = await copyToClipboardBestEffort(url, "예약설정 링크가 클립보드에 복사되었습니다.");
        if (!copied) alert(url);
      }
    } catch (e) {
      console.error("이벤트 생성/열기 오류:", e);
      alert("이벤트를 생성/열기 하는 중 오류가 발생했습니다.");
    } finally {
      setCreatingEvent(false);
    }
  };

  // ✅ /admin 접근 자체를 “운영자 계정”으로 제한 (숨은 우회 접근)
  useEffect(() => {
    const boot = async () => {
      try {
        const { data, error } = await supabaseAdmin.auth.getUser();
        if (error) throw error;

        const email = data.user?.email ?? null;
        setAdminEmail(email);

        // 운영자 이메일만 허용
        setIsAdmin(!!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
      } catch (e) {
        console.error("어드민 권한 확인 실패:", e);
        setIsAdmin(false);
        setAdminEmail(null);
      } finally {
        setBooting(false);
      }
    };
    void boot();
  }, []);

  useEffect(() => {
    if (!booting && isAdmin) {
      fetchReservations();
      const t = setInterval(fetchReservations, 30_000);
      return () => clearInterval(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, isAdmin]);

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const statusLabel = (s?: ReservationStatus | null) =>
    s === "done" ? "완료" : s === "in_progress" ? "진행 중" : "신규";

  // ---- UI (권한) ----
  if (booting) {
    return (
      <section className="min-h-screen bg-ivory px-4 py-10">
        <div className="container mx-auto max-w-4xl">
          <Card className="bg-white/90 border-leafLight/60">
            <CardContent className="p-6 text-sm text-ink/70">권한 확인 중…</CardContent>
          </Card>
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    // ✅ B안: /admin/login으로 이동 (redirect는 /admin)
    const loginUrl = `/admin/login?redirect=${encodeURIComponent("/admin")}`;

    return (
      <section className="min-h-screen bg-ivory px-4 py-10">
        <div className="container mx-auto max-w-4xl">
          <Card className="bg-white/90 border-leafLight/60">
            <CardContent className="p-6 space-y-3">
              <div className="text-lg font-semibold text-ink/90">접근 권한이 없습니다.</div>
              <div className="text-sm text-ink/70">
                이 페이지는 운영자 전용입니다.
                {adminEmail ? (
                  <>
                    <br />
                    현재 로그인: <span className="font-mono">{adminEmail}</span>
                  </>
                ) : (
                  <>
                    <br />
                    현재 로그인 상태가 아닙니다.
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = loginUrl)}
                  className="border-leafLight text-ink hover:bg-ivory/70"
                >
                  운영자 로그인
                </Button>
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = "/")}
                  className="border-leafLight text-ink hover:bg-ivory/70"
                >
                  랜딩으로
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  // ---- 운영 콘솔 ----
  return (
    <section className="min-h-screen bg-ivory px-4 py-8">
      <div className="container mx-auto max-w-6xl">
        {/* 헤더 */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl text-ink/90">관리자 페이지</h1>
              <p className="text-sm text-ink/60 mt-1">
                운영자 계정: <span className="font-mono">{adminEmail}</span>
                <br className="hidden sm:block" />
                예약 → 이벤트 생성 → 예식 설정/리포트/디스플레이 운영까지 한 화면에서 확인합니다.
              </p>
            </div>

            {/* ✅ 우측 액션: 새로고침 + 로그아웃 */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                variant="outline"
                onClick={fetchReservations}
                disabled={loading}
                className="border-leafLight text-ink hover:bg-ivory/70"
              >
                {loading ? "불러오는 중…" : "예약 새로고침"}
              </Button>

              <Button
                variant="outline"
                onClick={async () => {
                  await supabaseAdmin.auth.signOut();
                  window.location.href = "/admin/login";
                }}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                로그아웃
              </Button>
            </div>
          </div>

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
                  <div className="py-16 text-center text-ink/60 text-sm">아직 접수된 예약이 없습니다.</div>
                ) : (
                  <ul className="divide-y divide-leafLight/40 overflow-auto max-h-[520px]">
                    {reservations.map((r) => {
                      const isSelected = r.id === selectedId;
                      const ev = eventMap[r.id];
                      const hasEvent = !!ev?.id;

                      const dateText =
                        r.date_status === "confirmed" ? r.event_date ?? "-" : r.tentative_date || "미정";

                      const timeText =
                        r.date_status === "confirmed" && r.wedding_time ? r.wedding_time.slice(0, 5) : "";

                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(r.id)}
                            className={cn(
                              "w-full text-left px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-1 hover:bg-white/70",
                              isSelected && "bg-bg-blue-50 ring-2 ring-blue-400 ring-inset"
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
                                  {statusLabel(r.status)}
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

                            {!!r.email && (
                              <div className="text-[11px] text-ink/55 font-mono truncate">{r.email}</div>
                            )}

                            {r.venue_name && <div className="text-xs text-ink/70 truncate">{r.venue_name}</div>}

                            <div className="text-[11px] text-ink/50">접수 : {formatDateTime(r.created_at)}</div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 오른쪽: 운영 상세 */}
          <Card className="bg-white/90 backdrop-blur border-leafLight/60">
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-ink/90 mb-4">운영 상세</h2>

              {!selected ? (
                <div className="py-20 text-center text-ink/60 text-sm">왼쪽 목록에서 예약을 선택해주세요.</div>
              ) : (
                <div className="space-y-5 text-sm text-ink/80">
                  {/* 기본 정보 */}
                  <section className="space-y-1">
                    <h3 className="font-semibold text-ink/90 mb-1">예약 정보</h3>
                    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-y-1.5">
                      <span className="text-ink/60">이름</span>
                      <span>
                        {selected.name || "-"}{" "}
                        {selected.role && <span className="text-ink/60">/ {selected.role}</span>}
                      </span>

                      <span className="text-ink/60">이메일</span>
                      <span className="font-mono break-all">{selected.email || "-"}</span>

                      <span className="text-ink/60">연락처</span>
                      <span>{selected.phone || "-"}</span>

                      <span className="text-ink/60">상태</span>
                      <span>{statusLabel(selected.status)}</span>
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
                          : eventMap[selected.id]?.id
                          ? "예약설정페이지 열기"
                          : "예약설정 링크 생성/열기"}
                      </Button>
                    </div>
                  </section>

                  {/* 이벤트/설정 미리보기 */}
                  <section className="space-y-1">
                    <h3 className="font-semibold text-ink/90 mb-1">이벤트 & 설정 미리보기</h3>

                    {!selectedEvent ? (
                      <div className="text-ink/60 text-sm bg-ivory/70 border border-leafLight/50 rounded-xl px-3 py-3">
                        아직 이벤트가 없습니다. <strong>상태를 “진행”</strong>으로 바꾸면 이벤트가 자동 생성됩니다.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-y-1.5">
                          <span className="text-ink/60">Event ID</span>
                          <span className="font-mono break-all">{selectedEvent.id}</span>

                          <span className="text-ink/60">Owner</span>
                          <span className="font-mono break-all">
                            {selectedEvent.owner_email || selected.email || "-"}
                          </span>

                          <span className="text-ink/60">공개</span>
                          <span>{selectedEvent.is_public ? "TRUE" : "FALSE/미설정"}</span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-200 text-blue-700 hover:bg-blue-50"
                            onClick={() => window.open(getSettingsUrl(selectedEvent.id), "_blank", "noopener,noreferrer")}
                          >
                            예식 설정
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-200 text-blue-700 hover:bg-blue-50"
                            onClick={() => window.open(getReportUrl(selectedEvent.id), "_blank", "noopener,noreferrer")}
                          >
                            리포트
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-200 text-blue-700 hover:bg-blue-50"
                            onClick={() => window.open(getDisplayUrl(selectedEvent.id), "_blank", "noopener,noreferrer")}
                          >
                            디스플레이
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-200 text-blue-700 hover:bg-blue-50"
                            onClick={() => window.open(getGuestUrl(selectedEvent.id), "_blank", "noopener,noreferrer")}
                          >
                            게스트 입력
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="border-leafLight text-ink hover:bg-ivory/70"
                            onClick={async () => {
                              const url = getSettingsUrl(selectedEvent.id);
                              const ok = await copyToClipboardBestEffort(url, "예약설정 링크가 클립보드에 복사되었습니다.");
                              if (!ok) alert(url);
                            }}
                          >
                            설정 링크 복사
                          </Button>
                        </div>

                        {/* settings 미리보기 */}
                        <div className="bg-ivory/70 border border-leafLight/50 rounded-xl px-3 py-3">
                          <div className="text-xs text-ink/60 mb-2">event_settings 요약 (없으면 “-”)</div>

                          <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-y-1.5 text-sm">
                            <span className="text-ink/60">예식일자</span>
                            <span>{selectedSettings?.ceremony_date ?? selectedSettings?.event_date ?? "-"}</span>

                            <span className="text-ink/60">시작</span>
                            <span>{selectedSettings?.ceremony_start_time ?? "-"}</span>

                            <span className="text-ink/60">종료</span>
                            <span>{selectedSettings?.ceremony_end_time ?? "-"}</span>

                            <span className="text-ink/60">신랑</span>
                            <span>{selectedSettings?.groom_name ?? "-"}</span>

                            <span className="text-ink/60">신부</span>
                            <span>{selectedSettings?.bride_name ?? "-"}</span>

                            <span className="text-ink/60">예식장명</span>
                            <span>{selectedSettings?.venue_name ?? selected.venue_name ?? "-"}</span>

                            <span className="text-ink/60">주소</span>
                            <span className="whitespace-pre-line">
                              {selectedSettings?.venue_address ?? selected.venue_address ?? "-"}
                            </span>

                            <span className="text-ink/60">디스플레이 스타일</span>
                            <span>{selectedSettings?.display_style ?? "-"}</span>

                            <span className="text-ink/60">배경 모드</span>
                            <span>{selectedSettings?.background_mode ?? "-"}</span>

                            <span className="text-ink/60">배경 이미지 URL</span>
                            <span className="font-mono break-all">
                              {selectedSettings?.background_photo_url ?? selectedSettings?.background_image_url ?? "-"}
                            </span>
                          </div>

                          <div className="mt-2 text-[11px] text-ink/55">
                            ※ settings 컬럼명은 바뀔 수 있어서, 여기서는 “있으면 보여주고 없으면 -”로 안전 처리.
                          </div>
                        </div>
                      </div>
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
                      • 예약금 입금 확인 후 <strong>신규 → 진행</strong>으로 바꾸면{" "}
                      <strong>이벤트가 자동 생성</strong>되고 <strong>예약설정 링크</strong>로 운영 가능.
                    </p>
                    <p>
                      • 운영자 계정은 <strong>/app</strong>에서 전체 이벤트를 조회할 수 있고, 개인 계정은 자기 이벤트만 봅니다.
                    </p>
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
