import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {Calendar, MapPin,  Share2,  Copy,  Check,  Users,  Info,  Clock,  RefreshCw,  ExternalLink,} from "lucide-react";

// --- Types ---
type EventRow = {
  id: string;
  created_at?: string;
  owner_email: string | null;

  groom_name?: string | null;
  bride_name?: string | null;

  ceremony_date: string | null; // events fallback
  venue_name: string | null;
  venue_address: string | null;
};

type EventSettingsRow = {
  event_id: string;
  title: string | null;
  ceremony_date: string | null; // ✅ 날짜는 event_settings 우선
};

type LinkInviteResult = {
  event_id?: string;
  token?: string;
  out_token?: string;
  role?: string;
  max_uses?: number;
  expires_at?: string;
};

type CodeInviteResult = {
  event_id?: string;
  code?: string;
  out_code?: string;
  role?: string;
  max_uses?: number;
  expires_at?: string;
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

const normalizeRpcRow = <T,>(data: any): T | null => {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  return data as T;
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
  const [linkInviteByEventId, setLinkInviteByEventId] = useState<Record<string, { token: string }>>({});
  const [codeInviteByEventId, setCodeInviteByEventId] = useState<Record<string, { code: string }>>({});
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

  const getNames = (ev: EventRow) => {
    const groom = (ev.groom_name || "").trim();
    const bride = (ev.bride_name || "").trim();
    const names = [groom, bride].filter(Boolean);
    return names.length ? names.join(" · ") : "";
  };

  // ✅ 초대장 제목 줄: 신랑/신부 우선, 없으면 owner_email 로컬파트
  const getInviteTitleLine = (ev: EventRow) => {
    const names = getNames(ev);
    if (names) return `${names} 결혼식 디지털방명록 초대장`;
    const ownerLike = safeLocalNameFromEmail(ev.owner_email);
    if (ownerLike) return `${ownerLike}님의 디지털방명록 초대장`;
    return `디지털방명록 초대장`;
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch (e) {
      console.error(e);
      alert("복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
    }
  };

  // 🎨 초대 텍스트 생성 (프론트용)
  const buildInviteText = (ev: EventRow, linkToken: string, code: string) => {
    const inviteLink = `${window.location.origin}/invite/${linkToken}`;
    const date = getEventDate(ev);
    const dateLine = date ? `${date}` : `날짜 미정`;
    const titleLine = getInviteTitleLine(ev);

    // 감각/간결/카톡 붙여넣기 최적화
    return [
      `💌 [Digital GuestBook]`,
      `📅 ${dateLine}`,
      `🎉 ${titleLine}`,
      ``,
      `✅ 참여 링크`,
      `${inviteLink}`,
      ``,
      `🔢 참여 코드: ${code}`,
      ``,
      `🧭 참여 방법`,
      `- 링크로 들어오면 자동으로 참여돼요.`,
      `- 링크가 어렵다면 /join 에서 코드를 입력해도 돼요.`,
    ].join("\n");
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
        // ✅ title + ceremony_date 같이 가져오기 (날짜 미정 문제 해결)
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

  // ✅ 링크/코드 초대 정보를 준비 (링크: ensure / 코드: create)
  const ensureInvites = async (eventId: string) => {
    setInviteLoadingByEventId((p) => ({ ...p, [eventId]: true }));
    try {
      // 1) 링크 다회용 (있으면 반환, 없으면 생성)
      if (!linkInviteByEventId[eventId]?.token) {
        const { data, error } = await supabase.rpc("ensure_event_link_invite", {
          p_event_id: eventId,
          p_role: "member",
          p_max_uses: 999999, // 의미 없음(다회용) — 함수 내부 정책이 우선
          p_expires_in_days: 30,
        });
        if (error) throw error;

        const row = normalizeRpcRow<LinkInviteResult>(data);
        const token = (row?.token || row?.out_token || "").trim();
        if (token) {
          setLinkInviteByEventId((p) => ({ ...p, [eventId]: { token } }));
        }
      }

      // 2) 코드 1회용 (없으면 생성 / 있으면 기존 반환하도록 함수가 설계되어 있다면 그대로)
      if (!codeInviteByEventId[eventId]?.code) {
        const { data, error } = await supabase.rpc("create_event_code_invite", {
          p_event_id: eventId,
          p_role: "member",
          p_max_uses: 1,
          p_expires_in_days: 7,
        });
        if (error) throw error;

        const row = normalizeRpcRow<CodeInviteResult>(data);
        const code = (row?.code || row?.out_code || "").trim();
        if (code) {
          setCodeInviteByEventId((p) => ({ ...p, [eventId]: { code } }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInviteLoadingByEventId((p) => ({ ...p, [eventId]: false }));
    }
  };

  const handleInviteToggle = async (eventId: string) => {
    if (expandedInviteId === eventId) {
      setExpandedInviteId(null);
      return;
    }
    setExpandedInviteId(eventId);

    // 열자마자 ensure
    await ensureInvites(eventId);
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

            {/* 로그인 이메일 노출 */}
            {email && (
              <div className="mt-2 text-xs text-slate-400">
                로그인: <span className="font-medium text-slate-500">{email}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchEvents}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
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

              const linkToken = linkInviteByEventId[ev.id]?.token || "";
              const code = codeInviteByEventId[ev.id]?.code || "";

              const inviteTextPreview =
                linkToken && code ? buildInviteText(ev, linkToken, code) : "";

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

                              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                                {getDisplayTitle(ev)}
                              </h2>
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

                          {/* 버튼 순서: 설정 → 초대 → 리포트 */}
                          <div className="flex flex-wrap gap-2">
                            <Link to={`/app/event/${ev.id}/settings`}>
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
                              ) : linkToken && code ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                  {/* 왼쪽: 초대장 복사 + 미리보기 */}
                                  <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between mb-4">
                                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                        INVITE
                                      </span>
                                      <Clock className="h-4 w-4 text-slate-300" />
                                    </div>

                                    <p className="text-sm font-bold text-slate-800 mb-4 leading-relaxed">
                                      버튼 한 번으로 <span className="text-rose-500">초대장 전체</span>가 복사돼요.
                                    </p>

                                    <Button
                                      onClick={() =>
                                        handleCopy(inviteTextPreview, `${ev.id}-invitepack`)
                                      }
                                      className="w-full rounded-2xl h-12 font-bold bg-rose-500 text-white hover:bg-rose-600"
                                    >
                                      {copiedKey === `${ev.id}-invitepack` ? (
                                        <>
                                          <Check className="mr-2 h-4 w-4" /> 복사 완료
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="mr-2 h-4 w-4" /> 초대장 복사
                                        </>
                                      )}
                                    </Button>

                                    {/* 미리보기 */}
                                    <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4">
                                      <div className="text-[11px] font-semibold text-slate-500 mb-2">
                                        초대장 미리보기
                                      </div>
                                      <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700 font-medium">
                                        {inviteTextPreview}
                                      </pre>
                                    </div>
                                  </div>

                                  {/* 오른쪽: 링크만 복사 + 코드만 복사 */}
                                  <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between mb-4">
                                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                        LINK & CODE
                                      </span>
                                      <ExternalLink className="h-4 w-4 text-slate-300" />
                                    </div>

                                    <p className="text-sm font-bold text-slate-800 mb-6">
                                      링크만 따로 보내고 싶다면
                                      <br />
                                      아래에서 복사하세요.
                                    </p>

                                    <Button
                                      variant="outline"
                                      onClick={() =>
                                        handleCopy(`${window.location.origin}/invite/${linkToken}`, `${ev.id}-linkonly`)
                                      }
                                      className="w-full rounded-2xl h-12 font-bold bg-white/60 hover:bg-white/70"
                                    >
                                      {copiedKey === `${ev.id}-linkonly` ? (
                                        <>
                                          <Check className="mr-2 h-4 w-4 text-green-500" /> 복사 완료
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="mr-2 h-4 w-4" /> 링크만 복사
                                        </>
                                      )}
                                    </Button>

                                    <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4">
                                      <div className="text-[11px] font-semibold text-slate-500 mb-2">초대 코드</div>
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-3xl font-black tracking-tighter text-slate-900">
                                          {code}
                                        </div>
                                        <Button
                                          variant="outline"
                                          onClick={() => handleCopy(code, `${ev.id}-codeonly`)}
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
                                        유효기간: 7일 · 1회 참여용
                                      </div>
                                    </div>

                                    <div className="mt-3 text-[11px] text-slate-400">
                                      링크는 여러 번 사용 가능하고, 코드는 “첫 참여 1회”만 차감돼요.
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
