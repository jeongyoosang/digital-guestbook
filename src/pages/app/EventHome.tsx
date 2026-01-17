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

  groom_name?: string | null;
  bride_name?: string | null;
  ceremony_date: string | null;

  venue_name: string | null;
  venue_address: string | null;
};

type EventSettingsRow = {
  event_id: string;
  title: string | null;
};

type InviteResult = {
  event_id: string;
  token: string;
  code: string;
  role: string;
  max_uses: number;
  expires_at: string;
};

const ADMIN_EMAIL = "goraeuniverse@gmail.com";

export default function EventHome() {
  const [email, setEmail] = useState<string>("");
  const isAdmin = useMemo(() => email === ADMIN_EMAIL, [email]);

  // 관리자 UX: 전체/내것 토글 + 검색
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [q, setQ] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // event_settings.title 매핑
  const [settingsByEventId, setSettingsByEventId] = useState<Record<string, EventSettingsRow>>(
    {}
  );

  // 초대 생성 결과/로딩 상태
  const [inviteByEventId, setInviteByEventId] = useState<Record<string, InviteResult>>({});
  const [inviteLoadingByEventId, setInviteLoadingByEventId] = useState<Record<string, boolean>>(
    {}
  );
  const [inviteMsgByEventId, setInviteMsgByEventId] = useState<Record<string, string>>({});

  const effectiveScope = isAdmin ? scope : "mine";

  const safeCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch {
        return false;
      }
    }
  };

  const getDisplayTitle = (ev: EventRow) => {
    const sTitle = settingsByEventId[ev.id]?.title?.trim();
    if (sTitle) return sTitle;

    const date = ev.ceremony_date?.trim() || "";
    const groom = (ev.groom_name || "").trim();
    const bride = (ev.bride_name || "").trim();

    const names =
      groom && bride ? `${groom} · ${bride}` : groom ? groom : bride ? bride : "";

    if (date && names) return `${date} ${names} 결혼식`;
    if (date) return `${date} 결혼식`;
    if (names) return `${names} 결혼식`;

    return "예식 설정 필요";
  };

  const getDisplaySubtitle = (ev: EventRow) => {
    const parts: string[] = [];
    if (ev.venue_name) parts.push(ev.venue_name);
    if (ev.venue_address) parts.push(ev.venue_address);
    return parts.join(" · ");
  };

  const fetchEventSettings = async (eventIds: string[]) => {
    if (eventIds.length === 0) {
      setSettingsByEventId({});
      return;
    }

    const { data, error } = await supabase
      .from("event_settings")
      .select("event_id, title")
      .in("event_id", eventIds);

    if (error) {
      console.warn("[event_settings fetch]", error.message);
      setSettingsByEventId({});
      return;
    }

    const map: Record<string, EventSettingsRow> = {};
    (data || []).forEach((row: any) => {
      if (row?.event_id) map[row.event_id] = row;
    });
    setSettingsByEventId(map);
  };

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
        .select(
          "id, created_at, owner_email, ceremony_date, groom_name, bride_name, venue_name, venue_address"
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (effectiveScope === "mine") {
        query = query.eq("owner_email", userEmail);
      }

      if (isAdmin && q.trim()) {
        query = query.ilike("owner_email", `%${q.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as EventRow[];
      setEvents(rows);

      // 제목 표시용 event_settings.title 가져오기
      await fetchEventSettings(rows.map((r) => r.id));
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "이벤트 정보를 불러올 수 없습니다.");
      setEvents([]);
      setSettingsByEventId({});
    } finally {
      setLoading(false);
    }
  };

  const createInvite = async (eventId: string) => {
    setInviteMsgByEventId((p) => ({ ...p, [eventId]: "" }));
    setInviteLoadingByEventId((p) => ({ ...p, [eventId]: true }));

    try {
      const { data, error } = await supabase.rpc("create_event_invite", {
        p_event_id: eventId,
        p_role: "member",
        p_max_uses: 1,
        p_expires_in_days: 7,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.token || !row?.code) throw new Error("초대 생성 결과가 올바르지 않습니다.");

      setInviteByEventId((p) => ({ ...p, [eventId]: row as InviteResult }));
      setInviteMsgByEventId((p) => ({ ...p, [eventId]: "초대가 생성되었습니다." }));
    } catch (e: any) {
      console.error(e);
      setInviteMsgByEventId((p) => ({
        ...p,
        [eventId]: e?.message || "초대 생성에 실패했습니다.",
      }));
    } finally {
      setInviteLoadingByEventId((p) => ({ ...p, [eventId]: false }));
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
            {events.map((ev) => {
              const title = getDisplayTitle(ev);
              const subtitle = getDisplaySubtitle(ev);

              // ✅ 초대 생성 버튼 노출 조건: 관리자 또는 owner
              const canCreateInvite = isAdmin || (email && ev.owner_email && ev.owner_email === email);

              const invite = inviteByEventId[ev.id];
              const inviteLoading = !!inviteLoadingByEventId[ev.id];
              const inviteMsg = inviteMsgByEventId[ev.id] || "";

              const inviteLink = invite ? `${window.location.origin}/invite/${invite.token}` : "";

              return (
                <Card key={ev.id} className="border-slate-200">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      {/* 좌측: 사용자용 타이틀/서브 */}
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-ink/90 truncate">{title}</div>

                        {subtitle ? (
                          <div className="mt-1 text-sm text-ink/60">{subtitle}</div>
                        ) : (
                          <div className="mt-1 text-sm text-ink/50">장소 정보 없음</div>
                        )}

                        {isAdmin && ev.owner_email && (
                          <div className="mt-2 text-xs text-ink/50">
                            owner: <span className="font-mono">{ev.owner_email}</span>
                          </div>
                        )}
                      </div>

                      {/* 우측: 액션 */}
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

                        {/* ✅ 초대 생성: 관리자/owner만 노출 */}
                        {canCreateInvite && (
                          <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => createInvite(ev.id)}
                            disabled={inviteLoading}
                          >
                            {inviteLoading ? "초대 생성 중…" : "초대 만들기"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* ✅ 초대 결과 표시: 관리자/owner만 노출 */}
                    {canCreateInvite && (invite || inviteMsg) && (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm font-medium text-ink/80">초대 공유</div>
                          {invite?.expires_at && (
                            <div className="text-xs text-ink/50">
                              만료: <span className="font-mono">{invite.expires_at}</span>
                            </div>
                          )}
                        </div>

                        {inviteMsg && (
                          <div className={cn("mt-2 text-sm", invite ? "text-ink/60" : "text-red-600")}>
                            {inviteMsg}
                          </div>
                        )}

                        {invite && (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 p-3">
                              <div className="text-xs text-ink/50">링크(토큰)</div>
                              <div className="mt-1 text-sm font-mono break-all text-ink/80">
                                {inviteLink}
                              </div>
                              <div className="mt-2">
                                <Button
                                  variant="outline"
                                  className="rounded-xl w-full"
                                  onClick={async () => {
                                    const ok = await safeCopy(inviteLink);
                                    setInviteMsgByEventId((p) => ({
                                      ...p,
                                      [ev.id]: ok ? "링크가 복사되었습니다." : "복사에 실패했습니다.",
                                    }));
                                  }}
                                >
                                  링크 복사
                                </Button>
                              </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 p-3">
                              <div className="text-xs text-ink/50">코드(6자리)</div>
                              <div className="mt-1 text-2xl font-mono tracking-widest text-ink/90">
                                {invite.code}
                              </div>
                              <div className="mt-2">
                                <Button
                                  variant="outline"
                                  className="rounded-xl w-full"
                                  onClick={async () => {
                                    const ok = await safeCopy(invite.code);
                                    setInviteMsgByEventId((p) => ({
                                      ...p,
                                      [ev.id]: ok ? "코드가 복사되었습니다." : "복사에 실패했습니다.",
                                    }));
                                  }}
                                >
                                  코드 복사
                                </Button>
                              </div>
                              <div className="mt-2 text-xs text-ink/50">
                                하객은 <span className="font-mono">/join</span>에서 코드로 참여
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
