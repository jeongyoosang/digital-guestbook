// src/pages/app/EventHome.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type EventRow = {
  id: string;
  groom_name?: string | null;
  bride_name?: string | null;
  ceremony_date?: string | null;
  venue_name?: string | null;
  created_at?: string | null;
};

function fmtDate(d?: string | null) {
  if (!d) return "";
  return d; // YYYY-MM-DD
}

export default function EventHome() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [meEmail, setMeEmail] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 상태 안내용
  const [statusNote, setStatusNote] = useState<
    | null
    | "NO_RESERVATION"
    | "RESERVATION_FOUND_BUT_NOT_CONFIRMED"
    | "RESERVATION_FOUND_BUT_NO_EVENT"
  >(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError(null);
      setStatusNote(null);

      // 1) 로그인 유저
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (!mounted) return;

      if (userErr) {
        setError(userErr.message);
        setLoading(false);
        return;
      }

      const user = userData?.user ?? null;
      const email = user?.email ?? null;
      setMeEmail(email);

      if (!user?.id) {
        setError("로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.");
        setLoading(false);
        return;
      }

      // 2) 내 이메일로 예약 매칭 (예약자만 접근)
      // - 실제 운영에서는 "예약 시 이메일을 받는다"가 전제.
      // - 지금은 기존 예약에 email이 비어있을 수 있으니 0개면 안내문을 보여준다.
      if (!email) {
        setStatusNote("NO_RESERVATION");
        setEvents([]);
        setLoading(false);
        return;
      }

      const { data: reservation, error: rErr } = await supabase
        .from("reservations")
        .select("id,status")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mounted) return;

      if (rErr) {
        setError(rErr.message);
        setLoading(false);
        return;
      }

      // 예약 자체가 없음 = 아직 예약자 이메일로 등록된 적 없음
      if (!reservation?.id) {
        setStatusNote("NO_RESERVATION");
        setEvents([]);
        setLoading(false);
        return;
      }

      // 예약은 있는데 상태가 new(예약금 미확인) 등이라면: 이벤트를 보여주지 않는 것이 맞음
      // (정책: 입금확인 후 in_progress로 바뀌면 이벤트 생성/연결)
      if (reservation.status !== "in_progress" && reservation.status !== "done") {
        setStatusNote("RESERVATION_FOUND_BUT_NOT_CONFIRMED");
        setEvents([]);
        setLoading(false);
        return;
      }

      // 3) reservation_id로 event 찾기
      const { data: ev, error: evFindErr } = await supabase
        .from("events")
        .select("id")
        .eq("reservation_id", reservation.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mounted) return;

      if (evFindErr) {
        setError(evFindErr.message);
        setLoading(false);
        return;
      }

      if (!ev?.id) {
        // 예약은 진행중인데 이벤트 생성이 아직 안 됨 (관리자에서 생성/연동 처리 전)
        setStatusNote("RESERVATION_FOUND_BUT_NO_EVENT");
        setEvents([]);
        setLoading(false);
        return;
      }

      // 4) ✅ 첫 로그인시 event_members에 자동 등록 (owner)
      // - unique(event_id, user_id)라 중복 방지됨
      // - 정책상 insert는 "해당 event의 owner가 추가"로 막아두면 여기서 실패할 수 있음
      //   => 지금 단계에서는 'authenticated user can insert their own membership'로 완화하거나,
      //      서버(Edge Function)로 처리하는 게 정석.
      // - 일단 MVP는 client에서 upsert 시도 후 실패해도 이벤트 조회는 계속 진행.
      try {
        await supabase
          .from("event_members")
          .upsert(
            { event_id: ev.id, user_id: user.id, role: "owner" },
            { onConflict: "event_id,user_id" }
          );
      } catch {
        // 조용히 무시 (정책이 빡세면 실패할 수 있음)
      }

      // 5) event_members 기준으로 "내 이벤트만" 조회
      //    - event_members RLS: user_id = auth.uid() select 허용
      //    - events RLS: event_members 존재하는 이벤트만 select 허용 (정공법)
      //
      // ✅ Supabase는 FK가 잡혀있으면 아래처럼 조인 형태 선택이 가능함.
      // 만약 join이 안 먹으면: 먼저 event_members에서 event_id 리스트 가져오고,
      // events.in("id", ids)로 2단계 조회하면 됨.
      const { data: memberRows, error: mErr } = await supabase
        .from("event_members")
        .select("event_id, events:events (id,groom_name,bride_name,ceremony_date,venue_name,created_at)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (mErr) {
        setError(mErr.message);
        setEvents([]);
        setLoading(false);
        return;
      }

      const rows = (memberRows ?? [])
        .map((r: any) => r?.events)
        .filter(Boolean) as EventRow[];

      setEvents(rows);
      setLoading(false);
    };

    run();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const openSettings = (id: string) => navigate(`/app/event/${id}/settings`);
  const openReport = (id: string) => navigate(`/app/event/${id}/report`);
  const openReplay = (id: string) => navigate(`/replay/${id}`); // 레거시 유지

  const headerSubtitle = useMemo(() => {
    if (loading) return "불러오는 중…";
    if (error) return "오류가 발생했습니다";
    if (!events.length) return "아직 준비 중입니다";
    return `내 이벤트 ${events.length}개`;
  }, [loading, error, events.length]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">내 이벤트</h1>
        <p className="text-sm text-muted-foreground mt-1">{headerSubtitle}</p>

        {meEmail && (
          <p className="text-xs text-muted-foreground mt-2">
            로그인: <span className="font-mono">{meEmail}</span>
          </p>
        )}
      </div>

      {error && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="text-sm font-semibold">이벤트 정보를 불러올 수 없습니다.</div>
            <div className="text-sm text-muted-foreground mt-2 break-words">{error}</div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => window.location.reload()}>새로고침</Button>
              <Button variant="outline" onClick={() => navigate("/", { replace: true })}>
                랜딩으로
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!error && !loading && events.length === 0 && (
        <Card>
          <CardContent className="p-6 space-y-2">
            <div className="text-sm font-semibold">아직 준비 중입니다</div>

            {statusNote === "NO_RESERVATION" && (
              <div className="text-sm text-muted-foreground">
                아직 예약금이 확인되지 않았습니다. <br />
                입금 완료에도 상태가 바뀌지 않을 시 카카오톡으로 문의바랍니다.
              </div>
            )}

            {statusNote === "RESERVATION_FOUND_BUT_NOT_CONFIRMED" && (
              <div className="text-sm text-muted-foreground">
                아직 예약금이 확인되지 않았습니다. <br />
                입금 완료에도 상태가 바뀌지 않을 시 카카오톡으로 문의바랍니다.
              </div>
            )}

            {statusNote === "RESERVATION_FOUND_BUT_NO_EVENT" && (
              <div className="text-sm text-muted-foreground">
                예약금 확인이 완료되었으나, 이벤트 생성이 아직 반영되지 않았습니다. <br />
                잠시 후 다시 확인해 주세요. (지속 시 카카오톡 문의)
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <Button onClick={() => window.location.reload()} variant="outline">
                새로고침
              </Button>
              <Button onClick={() => navigate("/reserve")} variant="outline">
                예약 문의하기
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!error && events.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {events.map((e) => {
            const title = [e.groom_name, e.bride_name].filter(Boolean).join(" · ") || "이벤트";
            const meta = [
              e.ceremony_date ? `예식일 ${fmtDate(e.ceremony_date)}` : null,
              e.venue_name ? `장소 ${e.venue_name}` : null,
            ]
              .filter(Boolean)
              .join(" / ");

            return (
              <Card key={e.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-base font-bold truncate">{title}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {meta || "상세 정보 없음"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 font-mono break-all">
                        Event ID: {e.id}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <Button onClick={() => openReport(e.id)}>리포트 보기</Button>
                      <Button variant="outline" onClick={() => openSettings(e.id)}>
                        예식 설정
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => openReplay(e.id)}>
                      다시보기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
