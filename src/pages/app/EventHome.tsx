// src/pages/app/EventHome.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  owner_email?: string | null;
};

function fmtDate(d?: string | null) {
  if (!d) return "";
  return d; // YYYY-MM-DD
}

export default function EventHome() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();

  const [loading, setLoading] = useState(true);
  const [meEmail, setMeEmail] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedEvent = useMemo(() => {
    if (!eventId) return null;
    return events.find((e) => e.id === eventId) ?? null;
  }, [eventId, events]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError(null);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (!mounted) return;

      if (userErr) {
        setError(userErr.message);
        setLoading(false);
        return;
      }

      const email = userData?.user?.email ?? null;
      setMeEmail(email);

      if (!email) {
        setError("로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.");
        setLoading(false);
        return;
      }

      // ✅ title 컬럼 제거 (DB에 없음)
      const { data, error: evErr } = await supabase
        .from("events")
        .select("id,groom_name,bride_name,ceremony_date,venue_name,created_at,owner_email")
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (evErr) {
        setError(evErr.message);
        setEvents([]);
        setLoading(false);
        return;
      }

      setEvents((data ?? []) as EventRow[]);
      setLoading(false);
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  const openSettings = (id: string) => navigate(`/app/event/${id}/settings`);
  const openReport = (id: string) => navigate(`/app/event/${id}/report`);
  const openReplay = (id: string) => navigate(`/replay/${id}`); // 레거시 유지

  const headerSubtitle = useMemo(() => {
    if (loading) return "불러오는 중…";
    if (error) return "오류가 발생했습니다";
    if (!events.length) return "아직 연결된 이벤트가 없습니다";
    return `내 이벤트 ${events.length}개`;
  }, [loading, error, events.length]);

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full border-b bg-white/60 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="font-bold">디지털 방명록</div>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/", { replace: true });
            }}
          >
            로그아웃
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
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
            <CardContent className="p-6">
              <div className="text-sm font-semibold">연결된 이벤트가 없습니다.</div>
              <div className="text-sm text-muted-foreground mt-2">
                아직 예약/생성된 이벤트가 없거나, 해당 계정에 연결되지 않았습니다.
              </div>
            </CardContent>
          </Card>
        )}

        {!error && events.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {eventId && !selectedEvent && (
              <Card>
                <CardContent className="p-6">
                  <div className="text-sm font-semibold">이 이벤트를 찾을 수 없습니다.</div>
                  <div className="text-sm text-muted-foreground mt-2">
                    요청한 eventId(<span className="font-mono">{eventId}</span>)가 현재 로그인 계정에
                    연결되어 있지 않습니다.
                  </div>
                </CardContent>
              </Card>
            )}

            {events.map((e) => {
              const title =
                [e.groom_name, e.bride_name].filter(Boolean).join(" · ") || "이벤트";

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
                        <Button onClick={() => navigate(`/app/event/${e.id}`)}>이벤트 홈</Button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => openSettings(e.id)}>
                        예식 설정(Confirm)
                      </Button>
                      <Button variant="outline" onClick={() => openReport(e.id)}>
                        결과 리포트(Result)
                      </Button>
                      <Button variant="outline" onClick={() => openReplay(e.id)}>
                        다시보기(Replay)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
