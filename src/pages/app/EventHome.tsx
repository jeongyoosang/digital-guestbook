// src/pages/app/EventHome.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar, MapPin, Share2, Copy, Check, Users, Info, Clock, RefreshCcw } from "lucide-react";

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
  ceremony_date: string | null;
};

type LinkInviteRow = {
  out_token: string;
  out_max_uses?: number | null;
};

type CodeInviteRow = {
  code?: string;
  invite_code?: string;
};

type InviteBundle = {
  linkToken: string;
  code: string;
  linkUrl: string;
  expiresLabel: string; // UI용
};

type MemberJoinRow = {
  event_id: string;
  events: EventRow | null;
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

const getNamesLine = (ev: EventRow) => {
  const names = [ev.groom_name, ev.bride_name].filter(Boolean).join(" · ");
  return names || "";
};

// D-Day 계산
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

const formatDateLine = (isoDate?: string | null) => {
  if (!isoDate) return "날짜 미정";
  return isoDate;
};

// ✅ 미리보기용 URL 축약 (복사 텍스트는 원본 URL 유지)
const shortUrlForPreview = (url: string, head = 34, tail = 10) => {
  const u = (url || "").trim();
  if (!u) return "";
  if (u.length <= head + tail + 3) return u;
  return `${u.slice(0, head)}…${u.slice(-tail)}`;
};

/**
 * ✅ 초대 섹션을 작은 컴포넌트로 분리(페이지/라우트 추가 아님)
 * - EventHome 파일 안에서만 쓰는 내부 컴포넌트
 */
function InvitePanel({
  ev,
  invite,
  copiedKey,
  onCopy,
  buildInviteText,
}: {
  ev: EventRow;
  invite: InviteBundle;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  buildInviteText: (ev: EventRow, invite: InviteBundle) => string;
}) {
  const fullText = buildInviteText(ev, invite);
  const previewText = fullText.replace(invite.linkUrl, shortUrlForPreview(invite.linkUrl));

  return (
    <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="space-y-1 min-w-0">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">INVITE</div>
          <div className="text-base font-extrabold text-slate-900">디지털방명록 이벤트 공유</div>

          <div className="mt-2 text-sm leading-relaxed text-slate-500 font-medium">
          </div>
        </div>
        <Clock className="h-4 w-4 text-slate-300 shrink-0" />
      </div>

      <Button
        onClick={() => onCopy(fullText, `${ev.id}-invitepack`)}
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

      <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-4">
        <div className="text-[11px] font-semibold text-slate-500 mb-2">미리보기</div>
        <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600">
          {previewText}
        </pre>
      </div>
    </div>
  );
}

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
  const [inviteByEventId, setInviteByEventId] = useState<Record<string, InviteBundle>>({});
  const [inviteLoadingByEventId, setInviteLoadingByEventId] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const effectiveScope = isAdmin ? scope : "mine";

  // ✅ 날짜는 event_settings 우선
  const getEventDate = (ev: EventRow) => {
    const sDate = settingsByEventId[ev.id]?.ceremony_date;
    return sDate || ev.ceremony_date || null;
  };

  // ✅ 타이틀은 settings.title 우선(기본값 무시)
  // - UI에서는 "라벨(WEDDING)" + "이름" 구조를 쓰므로
  //   타이틀은 초대장/복사용 텍스트에서만 적극 활용
  const getDisplayTitle = (ev: EventRow) => {
    const sTitle = settingsByEventId[ev.id]?.title;
    if (isMeaningfulTitle(sTitle)) return sTitle!.trim();

    const names = getNamesLine(ev);
    if (names) return `${names} 결혼식`;
    return "상세 설정 필요";
  };

  // ✅ 초대장 제목 (유지: 혹시 다른 곳에서 쓰면)
  const getInviteTitleForText = (ev: EventRow) => {
    const sTitle = settingsByEventId[ev.id]?.title;
    if (isMeaningfulTitle(sTitle)) return sTitle!.trim();

    const names = getNamesLine(ev);
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

  // ✅ 초대장 텍스트(복사되는 본문)
  // - /join 삭제
  // - 1) 링크 열기 2) 이메일 인증 3) 초대 코드 입력
  // - 안내 문구 추가(설정/메시지 공유, 축의금 비공유)
  const buildInviteText = (ev: EventRow, invite: InviteBundle) => {
    const dateLine = formatDateLine(getEventDate(ev));
    const namesLine = getNamesLine(ev) || getDisplayTitle(ev) || getInviteTitleForText(ev);

    return [
      `💌 [Digital Guestbook] 
 디지털방명록 이벤트 초대`,
      `${dateLine} · ${namesLine}`,
      ``,
      `1) 링크 열기`,
      `2) 이메일 인증`,
      `3) 초대 코드 입력`,
      ``,
      `🔗 링크: ${invite.linkUrl}`,
      `🔢 초대 코드: ${invite.code}`,
      `⏳ 유효기간: ${invite.expiresLabel}`,
      ``,
      `※ 예식 전에는 예식 설정을 함께하고,`,
      `   예식 후에는 축하 메시지를 공유해요.`,
      `   (축의금 내역은 공유되지 않아요.)`,
    ].join("\n");
  };

  const fetchSettings = async (rows: EventRow[]) => {
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) {
      setSettingsByEventId({});
      return;
    }

    const { data: sData, error: sErr } = await supabase
      .from("event_settings")
      .select("event_id, title, ceremony_date")
      .in("event_id", ids);

    if (sErr) throw sErr;

    const sMap: Record<string, EventSettingsRow> = {};
    (sData || []).forEach((row: any) => {
      sMap[row.event_id] = row;
    });
    setSettingsByEventId(sMap);
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;

      const user = sessionData.session?.user;
      if (!user) {
        setEvents([]);
        setSettingsByEventId({});
        return;
      }

      const userEmail = user.email ?? "";
      setEmail(userEmail);

      // ✅ 핵심: 새로 만들어진 이벤트(=events.owner_email만 있고 event_members 없는 상태)를 자동 보정
      await supabase.rpc("ensure_owner_memberships");

      // Admin이면 events 직접 조회 유지 (운영자 모드)
      if (isAdmin && effectiveScope === "all") {
        let qy = supabase
          .from("events")
          .select("id, created_at, owner_email, groom_name, bride_name, ceremony_date, venue_name, venue_address")
          .order("created_at", { ascending: false });

        if (q.trim()) qy = qy.ilike("owner_email", `%${q.trim()}%`);

        const { data, error } = await qy.limit(50);
        if (error) throw error;

        const rows = (data || []) as EventRow[];
        setEvents(rows);
        await fetchSettings(rows);
        return;
      }

      // ✅ event_members 기준으로만 내 이벤트 목록 구성
      const { data, error } = await supabase
        .from("event_members")
        .select(
          `
          event_id,
          events (
            id,
            created_at,
            owner_email,
            groom_name,
            bride_name,
            ceremony_date,
            venue_name,
            venue_address
          )
        `
        )
        .eq("user_id", user.id);

      if (error) throw error;

      const mapped = ((data || []) as any as MemberJoinRow[])
        .map((r) => r.events)
        .filter(Boolean) as EventRow[];

      mapped.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });

      setEvents(mapped);
      await fetchSettings(mapped);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const ensureInviteBundle = async (eventId: string): Promise<InviteBundle> => {
    // 1️⃣ 링크 초대 (다회용)
    const { data: linkData, error: linkErr } = await supabase.rpc("event_link_invite", {
      p_event_id: eventId,
      p_role: "member",
    });
    if (linkErr) throw linkErr;

    const linkRow = (Array.isArray(linkData) ? linkData[0] : linkData) as LinkInviteRow | undefined;
    const linkToken = (linkRow?.out_token || "").trim();
    if (!linkToken) throw new Error("초대 링크 생성에 실패했습니다.");

    // 2️⃣ 코드 초대 (1회용)
    const { data: codeData, error: codeErr } = await supabase.rpc("create_event_code_invite", {
      p_event_id: eventId,
      p_role: "member",
    });
    if (codeErr) throw codeErr;

    const codeRow = (Array.isArray(codeData) ? codeData[0] : codeData) as CodeInviteRow | undefined;
    const code = (codeRow?.invite_code ?? codeRow?.code ?? "").trim();
    if (!code) throw new Error("초대 코드 생성에 실패했습니다.");

    const linkUrl = `${window.location.origin}/invite/${linkToken}`;

    return {
      linkToken,
      code,
      linkUrl,
      expiresLabel: "7일 (코드 1회 사용)",
    };
  };

  const handleInviteToggle = async (eventId: string) => {
    if (expandedInviteId === eventId) {
      setExpandedInviteId(null);
      return;
    }

    setExpandedInviteId(eventId);

    if (inviteByEventId[eventId]) return;

    setInviteLoadingByEventId((p) => ({ ...p, [eventId]: true }));
    try {
      const bundle = await ensureInviteBundle(eventId);
      setInviteByEventId((p) => ({ ...p, [eventId]: bundle }));
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
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              내 이벤트
            </h1>
            <p className="mt-2 text-muted-foreground">
              {isAdmin ? "운영자 모드" : "소중한 예식 데이터를 안전하게 관리하세요."}
            </p>
          </div>

          <div className="flex justify-end sm:justify-start">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchEvents}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
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
            <div className="py-20 text-center animate-pulse text-muted-foreground">
              정보를 불러오는 중...
            </div>
          ) : events.length === 0 ? (
  <div className="py-16">
    <div className="mx-auto max-w-xl rounded-[2.5rem] border border-slate-200 bg-white/70 p-8 text-center shadow-xl shadow-slate-200/30 backdrop-blur">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
        📭
      </div>

      <h3 className="mt-4 text-xl font-extrabold tracking-tight text-slate-900">
        아직 생성된 예식 홈이 없습니다
      </h3>

      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        예약이 확인되면 예식 홈이 자동으로 생성되며,
        <br />
        이후 예식 설정과 웨딩 리포트를 확인할 수 있어요.
      </p>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
        <div className="text-[11px] font-black tracking-widest text-slate-400">
          안내
        </div>
        <ul className="mt-2 space-y-2 text-sm text-slate-600">
          <li>• 결제/입금 직후에는 반영까지 시간이 걸릴 수 있어요.</li>
          <li>• 예약금을 입금했는데도 예식 홈이 보이지 않으면 카카오톡 채널로 문의해 주세요.</li>
        </ul>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button
          variant="outline"
          onClick={fetchEvents}
          className="h-11 rounded-full border-slate-200 bg-white/70 px-6 text-slate-700 hover:bg-slate-50"
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          새로고침
        </Button>

        <a
          href="https://pf.kakao.com/_UyaHn/chat" 
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          <Button className="h-11 w-full rounded-full bg-rose-500 px-6 font-bold text-white hover:bg-rose-600 sm:w-auto">
            카카오톡 문의
          </Button>
        </a>
      </div>

    </div>
  </div>
) : (

            events.map((ev) => {
              const eventDate = getEventDate(ev);
              const dDay = getDDayInfo(eventDate);

              // 초대하기는 "이 이벤트를 만든 사람(=owner_email)" 또는 운영자만 가능
              const canInvite = isAdmin || (email && ev.owner_email === email);

              const isExpanded = expandedInviteId === ev.id;
              const invite = inviteByEventId[ev.id];

              // ✅ UI용 라벨/타이틀
              const label = "WEDDING";
              const names = getNamesLine(ev);
              const titleText = names || getDisplayTitle(ev); // fallback

              return (
                <motion.div
                  layout
                  key={ev.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="group overflow-hidden border border-rose-200/70 ring-1 ring-rose-200/40 bg-white/70 shadow-2xl shadow-rose-200/30 backdrop-blur-xl rounded-[2.5rem] transition-all hover:border-rose-300/80">
                    <CardContent className="p-0">
                      {/* ✅ D-day를 카드 최상단 좌측으로 빼기 위해 relative */}
                      <div className="relative p-8 pt-12 sm:p-10 sm:pt-12">
                        {/* ✅ D-day Badge (absolute top-left) */}
                        {dDay && (
                          <motion.span
                            animate={dDay.animate ? { scale: [1, 1.06, 1] } : {}}
                            transition={{ duration: 2, repeat: Infinity }}
                            className={cn(
                              "absolute left-6 top-5 sm:left-10 sm:top-7",
                              "inline-flex min-w-[64px] items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-black uppercase leading-none text-white shadow-lg shadow-rose-200",
                              dDay.color
                            )}
                          >
                            {dDay.label}
                          </motion.span>
                        )}

                        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-4">
                            {/* ✅ 라벨 + 타이틀(이름) */}
                            <div className="min-w-0">
                              {/* ✅ Mobile: label 위 + 가운데 정렬 */}
                              <div className="sm:hidden text-center">
                                <div className="text-[11px] font-black tracking-[0.28em] text-slate-500 uppercase">
                                  {label}
                                </div>
                                <h2 className="mt-2 text-center text-2xl font-bold tracking-tight text-slate-900">
                                  {titleText}
                                </h2>
                              </div>

                              {/* ✅ Desktop: 같은 줄(라벨 + 이름) + 왼쪽 정렬 */}
                              <div className="hidden sm:flex sm:items-baseline sm:gap-4">
                                <span className="text-[11px] font-black tracking-[0.28em] text-slate-500 uppercase whitespace-nowrap">
                                  {label}
                                </span>
                                <h2 className="min-w-0 truncate whitespace-nowrap text-2xl font-bold tracking-tight text-slate-900">
                                  {titleText}
                                </h2>
                              </div>
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

                            {ev.venue_address && (
                              <div className="text-xs text-slate-400">{ev.venue_address}</div>
                            )}
                          </div>

                          {/* ✅ 모바일에서 버튼 3개 한 줄 고정: grid-cols-3 */}
                          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                            <Link to={`/app/event/${ev.id}/settings`} className="block">
                              <Button
                                variant="outline"
                                className="h-9 w-full rounded-full border-rose-200 bg-white/60 px-0 text-sm hover:bg-rose-50 hover:border-rose-300 hover:text-slate-900 sm:h-10 sm:w-auto sm:px-4"
                              >
                                상세 설정
                              </Button>
                            </Link>

                            {canInvite ? (
                              <Button
                                onClick={() => handleInviteToggle(ev.id)}
                                variant="secondary"
                                className={cn(
                                  "h-9 w-full rounded-full px-0 text-sm font-bold transition-all sm:h-10 sm:w-auto sm:px-4",
                                  isExpanded
                                    ? "bg-rose-500 text-white hover:bg-rose-600"
                                    : "bg-slate-100 text-slate-900"
                                )}
                              >
                                <Share2 className="mr-2 h-4 w-4 hidden sm:inline" /> 초대하기
                              </Button>
                            ) : (
                              // 초대 권한 없을 때도 grid 3칸 유지 (레이아웃 깨짐 방지)
                              <div />
                            )}

                            <Link to={`/app/event/${ev.id}/report`} className="block">
                              <Button className="h-9 w-full rounded-full bg-indigo-600 px-0 text-sm font-bold text-white hover:bg-indigo-700 sm:h-10 sm:w-auto sm:px-4">
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
                                  초대받은 분은 예식 설정과 축하 메시지를 함께 확인할 수 있어요.
                                  <span className="flex items-center gap-1.5 mt-2 text-[11px] text-rose-500/80">
                                    <Info className="h-3.5 w-3.5" />
                                    축의금(계좌/내역)은 공유되지 않으며, 본인 인증 후 본인 계좌만 조회됩니다.
                                  </span>
                                </p>
                              </div>

                              {inviteLoadingByEventId[ev.id] ? (
                                <div className="py-10 text-center text-slate-400 animate-pulse">
                                  초대 정보를 준비하고 있습니다...
                                </div>
                              ) : invite ? (
                                <InvitePanel
                                  ev={ev}
                                  invite={invite}
                                  copiedKey={copiedKey}
                                  onCopy={handleCopy}
                                  buildInviteText={buildInviteText}
                                />
                              ) : (
                                <div className="py-10 text-center text-slate-400">
                                  초대 정보를 만들 수 없습니다. (함수/권한/파라미터를 확인해주세요)
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
