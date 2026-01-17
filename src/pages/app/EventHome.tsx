// src/pages/app/EventHome.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Calendar,
  MapPin,
  Share2,
  Copy,
  Check,
  Users,
  Info,
  MessageCircle,
  Clock,
} from "lucide-react";

// --- Types ---
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

// --- Helpers ---
const isMeaningfulTitle = (title?: string | null) => {
  const t = (title || "").trim();
  if (!t || t.toUpperCase() === "WEDDING MESSAGES") return false;
  return true;
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

  // display title (settings.title 우선, 기본값 WEDDING MESSAGES는 무시)
  const getDisplayTitle = (ev: EventRow) => {
    const sTitle = settingsByEventId[ev.id]?.title;
    if (isMeaningfulTitle(sTitle)) return sTitle!.trim();

    const names = [ev.groom_name, ev.bride_name].filter(Boolean).join(" · ");
    if (names) return `${names} 결혼식`;
    return "예식 설정 필요";
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const shareToKakao = (ev: EventRow, invite: InviteResult) => {
    const inviteLink = `${window.location.origin}/invite/${invite.token}`;

    // ✅ TS 안전 처리
    const Kakao = (window as any)?.Kakao;

    // Kakao SDK가 로드/초기화되어 있으면 Share 사용
    if (Kakao && typeof Kakao.isInitialized === "function" && Kakao.isInitialized()) {
      try {
        Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: "예식 공동관리 초대",
            description: `${getDisplayTitle(ev)}에 초대받으셨습니다. 예식 설정과 리포트를 함께 확인해보세요.`,
            // imageUrl: "https://<YOUR_DOMAIN>/kakao-share.png",
            link: { mobileWebUrl: inviteLink, webUrl: inviteLink },
          },
          buttons: [
            {
              title: "초대 수락하기",
              link: { mobileWebUrl: inviteLink, webUrl: inviteLink },
            },
          ],
        });
        return;
      } catch (e) {
        console.error(e);
      }
    }

    // SDK 미로드/미초기화/실패 시: 링크 복사로 fallback
    handleCopy(inviteLink, `${ev.id}-kakao`);
    alert("카카오톡 공유가 준비되지 않아 초대 링크를 복사했습니다. 카톡으로 붙여넣어 보내주세요.");
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
        const { data: sData, error: sErr } = await supabase
          .from("event_settings")
          .select("event_id, title")
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

    // 이미 생성된 초대가 있으면 그대로 열기만
    if (inviteByEventId[eventId]) return;

    setInviteLoadingByEventId((p) => ({ ...p, [eventId]: true }));
    try {
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
    // ✅ AppLayout에서 전체 배경을 깔고 있으므로, 여기서는 투명으로 “얹기”
    <section className="relative min-h-[calc(100vh-72px)] bg-transparent">
      <div className="relative mx-auto max-w-4xl px-6 py-16 lg:py-20">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">내 이벤트</h1>
            <p className="mt-2 text-muted-foreground">
              {isAdmin ? "운영자 모드" : "소중한 예식 데이터를 안전하게 관리하세요."}
            </p>
          </div>

          {/* ✅ 모바일: 오른쪽 정렬 / 데스크탑: 기존처럼 오른쪽 */}
          <div className="flex justify-end sm:justify-start">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchEvents}
              className="text-muted-foreground hover:text-foreground"
            >
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
              const dDay = getDDayInfo(ev.ceremony_date);
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
                                {ev.ceremony_date || "날짜 미정"}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <MapPin className="h-4 w-4 opacity-50" />
                                {ev.venue_name || "장소 미정"}
                              </span>
                            </div>

                            {ev.venue_address && <div className="text-xs text-slate-400">{ev.venue_address}</div>}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Link to={`/app/event/${ev.id}/report`}>
                              {/* ✅ 블랙 대신 “인디고” 유지 (가독성+고급톤) */}
                              <Button className="rounded-full bg-indigo-600 text-white font-bold hover:bg-indigo-700">
                                웨딩 리포트
                              </Button>
                            </Link>
                            <Link to={`/app/event/${ev.id}/settings`}>
                              <Button variant="outline" className="rounded-full border-slate-200 bg-white/60 hover:bg-white/70">
                                상세 설정
                              </Button>
                            </Link>

                            {canInvite && (
                              <Button
                                onClick={() => handleInviteToggle(ev.id)}
                                variant="secondary"
                                className={cn(
                                  "rounded-full font-bold transition-all",
                                  isExpanded ? "bg-primary text-white" : "bg-slate-100 text-slate-900"
                                )}
                              >
                                <Share2 className="mr-2 h-4 w-4" /> 초대하기
                              </Button>
                            )}
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
                                  <Users className="h-5 w-5 text-primary" />
                                  가족 및 혼주 초대
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
                                  {/* Kakao share card */}
                                  <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between mb-4">
                                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                        스마트 공유
                                      </span>
                                      <div className="rounded-full bg-yellow-100 p-1.5">
                                        <MessageCircle className="h-4 w-4 text-yellow-600 fill-yellow-600" />
                                      </div>
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 mb-6">
                                      가장 쉽고 빠른 방법으로
                                      <br />
                                      카카오톡으로 초대해보세요.
                                    </p>
                                    <Button
                                      onClick={() => shareToKakao(ev, invite)}
                                      className="w-full rounded-2xl bg-[#FEE500] text-[#191919] hover:bg-[#FADA0A] font-bold border-none h-12"
                                    >
                                      카카오톡으로 초대 보내기
                                    </Button>
                                  </div>

                                  {/* Copy card */}
                                  <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between mb-4">
                                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                        초대 코드
                                      </span>
                                      <Clock className="h-4 w-4 text-slate-300" />
                                    </div>

                                    <div className="mb-6 flex items-baseline gap-2">
                                      <span className="text-4xl font-black tracking-tighter text-slate-900">
                                        {invite.code}
                                      </span>
                                      <span className="text-xs font-bold text-slate-400">7일간 유효</span>
                                    </div>

                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => handleCopy(invite.code, `${ev.id}-code`)}
                                        className="flex-1 rounded-2xl h-12 font-bold bg-white/60 hover:bg-white/70"
                                      >
                                        {copiedKey === `${ev.id}-code` ? (
                                          <Check className="mr-2 h-4 w-4 text-green-500" />
                                        ) : (
                                          <Copy className="mr-2 h-4 w-4" />
                                        )}
                                        코드 복사
                                      </Button>

                                      <Button
                                        variant="outline"
                                        onClick={() =>
                                          handleCopy(`${window.location.origin}/invite/${invite.token}`, `${ev.id}-link`)
                                        }
                                        className="flex-1 rounded-2xl h-12 font-bold bg-white/60 hover:bg-white/70"
                                      >
                                        {copiedKey === `${ev.id}-link` ? (
                                          <Check className="mr-2 h-4 w-4 text-green-500" />
                                        ) : (
                                          <Share2 className="mr-2 h-4 w-4" />
                                        )}
                                        링크 복사
                                      </Button>
                                    </div>

                                    <div className="mt-3 text-[11px] text-slate-400">
                                      * 코드는 전화/문자로 전달할 때 편리해요. 상대는 /join 에서 입력해요.
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

      {/* ✅ from-background 때문에 AppLayout 배경이 “흰색”으로 덮이는 느낌이 날 수 있어서, 투명 기반으로 교체 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-transparent to-transparent" />
    </section>
  );
}
