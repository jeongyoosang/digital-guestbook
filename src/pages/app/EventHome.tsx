// src/pages/app/EventHome.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar, MapPin, Share2, Copy, Check, Users, Info, Clock } from "lucide-react";

// --- Types ---
type EventRow = {
  id: string;
  created_at?: string;
  owner_email: string | null;
  groom_name?: string | null;
  bride_name?: string | null;
  ceremony_date: string | null; // (events 테이블 값, fallback)
  venue_name: string | null;
  venue_address: string | null;
};

type EventSettingsRow = {
  event_id: string;
  title: string | null;
  ceremony_date: string | null; // ✅ 1) 날짜는 event_settings 기준 우선
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

// --- Helpers ---
const isMeaningfulTitle = (title?: string | null) => {
  const t = (title || "").trim();
  if (!t || t.toUpperCase() === "WEDDING MESSAGES") return false;
  return true;
};

const safeLocalNameFromEmail = (email?: string | null) => {
  if (!email) return "";
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
};

// D-Day 계산 및 스타일 헬퍼
const getDDayInfo = (isoDate?: string | null) => {
  if (!isoDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;

  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays > 0) return { label: `D-${diffDays}`, color: "bg-rose-500", animate: true };
  if (diffDays === 0) return { label: "D-DAY", color: "bg-rose-600", animate: true };
  return { label: `D+${Math.abs(diffDays)}`, color: "bg-slate-400", animate: false };
};

export default function EventHome() {
  const [email, setEmail] = useState<string>("");
  const isAdmin = useMemo(() => email === ADMIN_EMAIL, [email]);

  const [scope, setScope] = useState<"all" | "mine">("mine");
  const [q, setQ] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);

  // settings mapping
  const [settingsByEventId, setSettingsByEventId] = useState<Record<string, EventSettingsRow>>({});

  // invite UI state
  const [expandedInviteId, setExpandedInviteId] = useState<string | null>(null);
  const [inviteByEventId, setInviteByEventId] = useState<Record<string, InviteResult>>({});
  const [inviteLoadingByEventId, setInviteLoadingByEventId] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const effectiveScope = isAdmin ? scope : "mine";

  // ✅ 날짜는 event_settings 우선
  const getEventDate = (ev: EventRow) => {
    const sDate = settingsByEventId[ev.id]?.ceremony_date;
    return sDate || ev.ceremony_date || null;
  };

  // display title (settings.title 우선, 기본값 WEDDING MESSAGES는 무시)
  const getDisplayTitle = (ev: EventRow) => {
    const sTitle = settingsByEventId[ev.id]?.title;
    if (isMeaningfulTitle(sTitle)) return sTitle!.trim();

    const names = [ev.groom_name, ev.bride_name].filter(Boolean).join(" · ");
    if (names) return `${names} 결혼식`;
    return "상세 설정 필요";
  };

  // ✅ 초대 텍스트 타이틀: (1) 신랑·신부 이름 (2) 예약자 대체: owner_email 로컬파트
  const getInviteTitleForText = (ev: EventRow) => {
    const names = [ev.groom_name, ev.bride_name].filter(Boolean).join(" · ");
    if (names) return `${names} 결혼식 디지털방명록 초대장`;
    const ownerLike = safeLocalNameFromEmail(ev.owner_email);
    if (ownerLike) return `${ownerLike}님의 디지털방명록 초대장`;
    return `디지털방명록 초대장`;
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (e) {
      console.error(e);
      alert("복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
    }
  };

  // ✅ 4) / 4-1) 안내 텍스트 + 링크 + 코드까지 “한 번에 복사”
  const handleCopyInvitePackage = async (ev: EventRow, invite: InviteResult) => {
    const inviteLink = `${window.location.origin}/invite/${invite.token}`;
    const date = getEventDate(ev);
    const dateLine = date ? `${date}` : `날짜 미정`;
    const titleLine = getInviteTitleForText(ev);

    const text = [
      `${dateLine} · ${titleLine}`,
      ``,
      `초대 링크: ${inviteLink}`,
      `초대 코드: ${invite.code}`,
      ``,
      `참여 방법: 링크로 들어가거나, /join 에서 초대코드를 입력하세요.`,
    ].join("\n");

    await handleCopy(text, `${ev.id}-invitepack`);
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;

      const userEmail = sessionData.session?.user?.email ?? "";
      setEmail(userEmail);

      let query = supabase
        .from("events")
        .select("id, created_at, owner_email, groom_name, bride_name, ceremony_date, venue_name, venue_address")
        .order("created_at", { ascending: false });

      if (effectiveScope === "mine") query = query.eq("owner_email", userEmail);
      if (isAdmin && q.trim()) query = query.ilike("owner_email", `%${q.trim()}%`);

      const { data, error } = await query.limit(50);
      if (error) throw error;

      const rows = (data || []) as EventRow[];
      setEvents(rows);

      const ids = rows.map((r) => r.id);
      if (ids.length > 0) {
        // ✅ title + ceremony_date 같이 가져오기 (1번 해결)
        const { data: sData, error: sErr } = await supabase
          .from("event_settings")
          .select("event_id, title, ceremony_date")
          .in("event_id", ids);

        if (sErr) throw sErr;

        const sMap: Record<string, EventSettingsRow> = {};
        (sData || []).forEach((row) => {
          sMap[row.event_id] = row as EventSettingsRow;
        });
        setSettingsByEventId(sMap);
      } else {
        setSettingsByEventId({});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteToggle = async (eventId: string) => {
    if (expandedInviteId === eventId) {
      setExpandedInviteId(null);
      return;
    }

    setExpandedInviteId(eventId);

    // 이미 받아온 초대가 있으면 그대로 열기만
    if (inviteByEventId[eventId]) return;

    setInviteLoadingByEventId((p) => ({ ...p, [eventId]: true }));
    try {
      // ✅ ensure 동작으로 바뀜: 있으면 반환, 없으면 생성
      const { data, error } = await supabase.rpc("create_event_invite", {
        p_event_id: eventId,
        p_role: "member",
        p_max_uses: 1,
        p_expires_in_days: 7,
      });
      if (error) throw error;

      const row = (Array.isArray(data) ? data[0] : data) as InviteResult | undefined;
      if (row?.token && row?.code) {
        setInviteByEventId((p) => ({ ...p, [eventId]: row }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInviteLoadingByEventId((p) => ({ ...p, [eventId]: false }));
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveScope]);

  return (
    <section className="relative min-h-[calc(100vh-72px)] bg-transparent">
      <div className="relative mx-auto max-w-4xl px-6 py-16 lg:py-20">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">내 이벤트</h1>
            <p className="mt-2 text-muted-foreground">
              {isAdmin ? "운영자 모드" : "소중한 예식 데이터를 안전하게 관리하세요."}
            </p>

            {/* ✅ 6) 로그인 이메일 노출 */}
            {email && (
              <div className="mt-2 text-xs text-slate-400">
                로그인: <span className="font-medium text-slate-500">{email}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end sm:justify-start">
            <Button variant="ghost" size="sm" onClick={fetchEvents} className="text-muted-foreground hover:text-foreground">
              새로고침
            </Button>
          </div>
        </header>

        {isAdmin && (
          <div className="mb-8 flex flex-col gap-3 rounded-3xl bg-white/40 p-2 shadow-sm border border-white/60 backdrop-blur-sm sm:flex-row">
            <div className="flex bg-slate-200/50 p-1 rounded-full">
              <button
                onClick={() => setScope("all")}
                className={cn(
                  "px-5 py-1.5 text-sm font-semibold rounded-full transition",
                  scope === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                )}
              >
                전체
              </button>
              <button
                onClick={() => setScope("mine")}
                className={cn(
                  "px-5 py-1.5 text-sm font-semibold rounded-full transition",
                  scope === "mine" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                )}
              >
                내것
              </button>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchEvents()}
              placeholder="사용자 이메일 검색..."
              className="flex-1 rounded-full border-none bg-transparent px-4 text-sm focus:ring-0"
            />
          </div>
        )}

        <div className="space-y-6">
          {loading ? (
            <div className="py-20 text-center animate-pulse text-muted-foreground">정보를 불러오는 중...</div>
          ) : events.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">표시할 이벤트가 없습니다.</div>
          ) : (
            events.map((ev) => {
              const eventDate = getEventDate(ev);
              const dDay = getDDayInfo(eventDate);

              const canInvite = isAdmin || (email && ev.owner_email === email);
              const isExpanded = expandedInviteId === ev.id;
              const invite = inviteByEventId[ev.id];

              return (
                <motion.div layout key={ev.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="group overflow-hidden border border-rose-200/70 ring-1 ring-rose-200/40 bg-white/70 shadow-2xl shadow-rose-200/30 backdrop-blur-xl rounded-[2.5rem] transition-all hover:border-rose-300/80">
                    <CardContent className="p-0">
                      <div className="p-8 sm:p-10">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              {dDay && (
                                <motion.span
                                  animate={dDay.animate ? { scale: [1, 1.05, 1] } : {}}
                                  transition={{ duration: 2, repeat: Infinity }}
                                  className={cn(
                                    "rounded-full px-4 py-1 text-[11px] font-black tracking-widest text-white uppercase shadow-lg shadow-rose-200",
                                    dDay.color
                                  )}
                                >
                                  {dDay.label}
                                </motion.span>
                              )}
                              <h2 className="text-2xl font-bold tracking-tight text-slate-900">{getDisplayTitle(ev)}</h2>
                            </div>

                            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500 font-medium">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 opacity-50" />
                                {eventDate || "날짜 미정"}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <MapPin className="h-4 w-4 opacity-50" />
                                {ev.venue_name || "장소 미정"}
                              </span>
                            </div>

                            {ev.venue_address && <div className="text-xs text-slate-400">{ev.venue_address}</div>}
                          </div>

                          {/* ✅ 8) 버튼 순서: 설정 → 초대 → 리포트 */}
                          <div className="flex flex-wrap gap-2">
                            <Link to={`/app/event/${ev.id}/settings`}>
                              {/* ✅ 7) hover 가시성 개선 (흰 글씨 문제 방지) */}
                              <Button
                                variant="outline"
                                className="rounded-full border-rose-200 bg-white/60 hover:bg-rose-50 hover:border-rose-300 hover:text-slate-900"
                              >
                                상세 설정
                              </Button>
                            </Link>

                            {canInvite && (
                              <Button
                                onClick={() => handleInviteToggle(ev.id)}
                                variant="secondary"
                                className={cn(
                                  "rounded-full font-bold transition-all",
                                  isExpanded ? "bg-rose-500 text-white hover:bg-rose-600" : "bg-slate-100 text-slate-900"
                                )}
                              >
                                <Share2 className="mr-2 h-4 w-4" /> 초대하기
                              </Button>
                            )}

                            <Link to={`/app/event/${ev.id}/report`}>
                              <Button className="rounded-full bg-indigo-600 text-white font-bold hover:bg-indigo-700">
                                웨딩 리포트
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>

                      {/* Invite Section */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="border-t border-slate-100 bg-slate-50/50 overflow-hidden"
                          >
                            <div className="p-8 sm:p-10">
                              <div className="mb-8">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                  <Users className="h-5 w-5 text-rose-500" />
                                  배우자 및 혼주 초대
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-slate-500 font-medium">
                                  신랑·신부·혼주를 초대하면 예식 설정과 웨딩 리포트를 함께 확인할 수 있어요.
                                  <span className="flex items-center gap-1.5 mt-2 text-[11px] text-rose-500/80">
                                    <Info className="h-3.5 w-3.5" />
                                    축의금 상세 내역은 본인인증 후 본인 계좌의 내역만 조회할 수 있어요.
                                  </span>
                                </p>
                              </div>

                              {inviteLoadingByEventId[ev.id] ? (
                                <div className="py-10 text-center text-slate-400 animate-pulse">
                                  초대 정보를 준비하고 있습니다...
                                </div>
                              ) : invite ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                  {/* ✅ 3) 카카오 공유 카드 제거 / ✅ 4-1) 초대 텍스트+링크+코드 한번에 복사 */}
                                  <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between mb-4">
                                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                        초대하기
                                      </span>
                                      <Clock className="h-4 w-4 text-slate-300" />
                                    </div>

                                    <p className="text-sm font-bold text-slate-800 mb-4 leading-relaxed">
                                      아래 버튼을 누르면
                                      <br />
                                      <span className="text-rose-500">안내문 + 링크 + 코드</span>가 한 번에 복사돼요.
                                    </p>

                                    <Button
                                      onClick={() => handleCopyInvitePackage(ev, invite)}
                                      className="w-full rounded-2xl h-12 font-bold bg-rose-500 text-white hover:bg-rose-600"
                                    >
                                      {copiedKey === `${ev.id}-invitepack` ? (
                                        <>
                                          <Check className="mr-2 h-4 w-4" /> 복사 완료
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="mr-2 h-4 w-4" /> 초대 텍스트 복사
                                        </>
                                      )}
                                    </Button>

                                    <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-4">
                                      <div className="text-[11px] font-semibold text-slate-500 mb-2">현재 초대 코드</div>
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-3xl font-black tracking-tighter text-slate-900">
                                          {invite.code}
                                        </div>
                                        <Button
                                          variant="outline"
                                          onClick={() => handleCopy(invite.code, `${ev.id}-codeonly`)}
                                          className="rounded-xl font-bold bg-white/60 hover:bg-white/70"
                                        >
                                          {copiedKey === `${ev.id}-codeonly` ? (
                                            <Check className="mr-2 h-4 w-4 text-green-500" />
                                          ) : (
                                            <Copy className="mr-2 h-4 w-4" />
                                          )}
                                          코드만 복사
                                        </Button>
                                      </div>
                                      <div className="mt-2 text-[11px] text-slate-400">
                                        유효기간: 7일 (1회 사용)
                                      </div>
                                    </div>

                                    {/* ✅ 5) 애매한 문구 제거 → 명확한 1줄 */}
                                    <div className="mt-3 text-[11px] text-slate-400">
                                      상대가 링크를 못 열면 <span className="font-semibold">/join</span>에서 코드로 참여할 수 있어요.
                                    </div>
                                  </div>

                                  {/* 보조 카드: 링크만 필요하면 */}
                                  <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between mb-4">
                                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                        링크
                                      </span>
                                      <Share2 className="h-4 w-4 text-slate-300" />
                                    </div>

                                    <p className="text-sm font-bold text-slate-800 mb-6">
                                      링크만 따로 필요하면
                                      <br />
                                      아래 버튼으로 복사하세요.
                                    </p>

                                    <Button
                                      variant="outline"
                                      onClick={() =>
                                        handleCopy(`${window.location.origin}/invite/${invite.token}`, `${ev.id}-linkonly`)
                                      }
                                      className="w-full rounded-2xl h-12 font-bold bg-white/60 hover:bg-white/70"
                                    >
                                      {copiedKey === `${ev.id}-linkonly` ? (
                                        <>
                                          <Check className="mr-2 h-4 w-4 text-green-500" /> 복사 완료
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="mr-2 h-4 w-4" /> 링크 복사
                                        </>
                                      )}
                                    </Button>

                                    <div className="mt-3 text-[11px] text-slate-400">
                                      링크로 들어오면 자동 참여가 진행돼요.
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="py-10 text-center text-slate-400">
                                  초대 정보를 만들 수 없습니다. 잠시 후 다시 시도해주세요.
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-transparent to-transparent" />
    </section>
  );
}
