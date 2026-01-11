// src/pages/app/EventHome.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EventRow = {
  id: string;
  created_at?: string;
  owner_email: string | null;
  ceremony_date: string | null;
  venue_name: string | null;
  venue_address: string | null;
};

const ADMIN_EMAIL = "goraeuniverse@gmail.com";

export default function EventHome() {
  const [email, setEmail] = useState<string>("");
  const isAdmin = useMemo(() => email === ADMIN_EMAIL, [email]);

  // 관리자 UX: 전체/내것 토글 + 검색(옵션이지만 운영에 도움됨)
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [q, setQ] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const effectiveScope = isAdmin ? scope : "mine";

  const fetchEvents = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;

      const userEmail = sessionData.session?.user?.email ?? "";
      setEmail(userEmail);

      // ✅ 핵심: 관리자면 owner_email 필터를 걸지 않는다.
      let query = supabase
        .from("events")
        .select("id, created_at, owner_email, ceremony_date, venue_name, venue_address")
        .order("created_at", { ascending: false })
        .limit(50);

      if (effectiveScope === "mine") {
        query = query.eq("owner_email", userEmail);
      }

      // 관리자 검색(이메일 부분검색)
      if (isAdmin && q.trim()) {
        query = query.ilike("owner_email", `%${q.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      setEvents((data || []) as EventRow[]);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "이벤트 정보를 불러올 수 없습니다.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveScope]);

  return (
    <section className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink/90">내 이벤트</h1>
            <p className="mt-1 text-sm text-ink/60">
              {loading ? "불러오는 중..." : isAdmin ? "운영자 계정" : "계정"}
              {email ? ` · 로그인: ${email}` : ""}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchEvents} disabled={loading}>
              {loading ? "새로고침 중..." : "새로고침"}
            </Button>
          </div>
        </div>

        {/* ✅ 관리자 전용 컨트롤 */}
        {isAdmin && (
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={scope === "all" ? "default" : "outline"}
                onClick={() => setScope("all")}
              >
                전체 이벤트
              </Button>
              <Button
                type="button"
                variant={scope === "mine" ? "default" : "outline"}
                onClick={() => setScope("mine")}
              >
                내 이벤트만
              </Button>
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchEvents();
              }}
              placeholder="owner_email 검색 (Enter)"
              className="h-10 w-full sm:w-[320px] rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>
        )}

        {/* 에러 */}
        {errorMsg && (
          <Card className="mb-6 border-slate-200">
            <CardContent className="p-5">
              <p className="text-sm text-ink/80 font-medium">이벤트 정보를 불러올 수 없습니다.</p>
              <p className="mt-1 text-sm text-ink/60">{errorMsg}</p>
              <div className="mt-4 flex gap-2">
                <Button onClick={fetchEvents}>새로고침</Button>
                <Link to="/">
                  <Button variant="outline">랜딩으로</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 리스트 */}
        {events.length === 0 && !loading && !errorMsg ? (
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <p className="text-sm text-ink/80 font-medium">아직 준비 중입니다</p>
              <p className="mt-1 text-sm text-ink/60">
                {isAdmin
                  ? "현재 조건에서 조회되는 이벤트가 없습니다."
                  : "예약하지 않았거나, 아직 예약금이 확인되지 않았습니다."}
              </p>
              <p className="mt-3 text-xs text-ink/50">
                * 이벤트 생성/연결은 예약금 입금 확인 후 자동으로 진행됩니다.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {events.map((ev) => (
              <Card key={ev.id} className="border-slate-200">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-ink/90">이벤트</div>
                      <div className="mt-1 text-sm text-ink/60">
                        {ev.ceremony_date ? (
                          <span>{ev.ceremony_date}</span>
                        ) : (
                          <span className="text-ink/50">상세 정보 없음</span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-ink/50">
                        Event ID: <span className="font-mono">{ev.id}</span>
                      </div>
                      {isAdmin && ev.owner_email && (
                        <div className="mt-1 text-xs text-ink/50">
                          owner: <span className="font-mono">{ev.owner_email}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                      <Link to={`/app/event/${ev.id}/report`}>
                        <Button className="rounded-xl">리포트 보기</Button>
                      </Link>
                      <Link to={`/app/event/${ev.id}/settings`}>
                        <Button variant="outline" className="rounded-xl">
                          예식 설정
                        </Button>
                      </Link>
                      <Link to={`/app/event/${ev.id}/replay`}>
                        <Button variant="outline" className={cn("rounded-xl")}>
                          다시보기
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
