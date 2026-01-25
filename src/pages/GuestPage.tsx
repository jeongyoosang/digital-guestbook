// src/pages/GuestPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getEventPhase, type EventPhase } from "../lib/time";

type Lang = "KO" | "EN";
type DisplayMode = "nickname" | "anonymous";
type Side = "" | "groom" | "bride";

interface RouteParams {
  eventId: string;
}

type EventSettingsRow = {
  ceremony_date: string | null;
  ceremony_start_time: string | null;
  ceremony_end_time: string | null;
};

type EventMemberRow = {
  id: string;
  role: "owner" | "member" | string;
};

type EventAccountRow = {
  id: string;
  event_id: string;
  label: string;
  holder_name: string | null;
  bank_name: string | null;
  account_number: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

const MESSAGE_MAX = 80;
const DEFAULT_DISPLAY_MESSAGE = "축하드립니다 💐";
const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_UyaHn";

/* ---------- utils ---------- */
function onlyDigits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}
function formatKoreanMobile(input: string) {
  const d = onlyDigits(input).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
function isValidKoreanMobile(digits: string) {
  return /^010\d{8}$/.test(digits);
}
function isBlank(v: any) {
  return v === null || v === undefined || String(v).trim() === "";
}

/* ---------- i18n ---------- */
const I18N: Record<Lang, any> = {
  KO: {
    title: "Happy Wedding",
    subtitle: "소중한 발걸음, 감사한 마음을 남겨주세요",
    step1: "방문 확인",
    step2: "축하 메시지",
    step3: "마음 전하실 곳",
    namePH: "성함 (실명)",
    phonePH: "연락처",
    groomSide: "신랑측 하객",
    brideSide: "신부측 하객",
    relationshipLabel: "관계",
    relationshipPH: "관계를 선택하세요",
    relationshipDetailPH: "관계 직접입력",
    messagePH: "신랑·신부에게 전할 따뜻한 한마디",
    skipMessage: "메시지 생략",
    nickname: "닉네임 표시",
    anonymous: "익명으로 표시",
    nextBtn: "전달하고 계좌 보기",
    sending: "전송 중...",
    infoUse: "입력하신 정보는 예식 확인 및 감사인사 목적으로만 사용됩니다.",
    successTitle: "마음이 전달되었습니다",
    successDesc: "두 분의 앞날을 함께 축복해주셔서 감사합니다.",
    giftTitle: "축의금 송금하기",
    copyBtn: "계좌번호 복사하기",
    copied: "계좌번호가 복사되었습니다.",
    attendanceNoteShort: "복사해서 송금하셔도\n현장 참석으로 기록됩니다.",
    kakaoThanks: "카카오톡 알림톡으로 감사인사 받기",
    selectSideFirst: "어느 쪽 하객이신지 선택해주세요.",
    selectRelationship: "관계를 선택해주세요.",
    invalidBasic: "성함과 연락처를 확인해주세요.",
    writeMessage: "축하 메시지를 적어주세요.",
    closedNotice: "현재는 작성 가능 시간이 아닙니다.",
  },
  EN: {
    title: "Happy Wedding",
    subtitle: "Leave your warm wishes for the couple",
    step1: "Check-in",
    step2: "Message",
    step3: "Gift",
    namePH: "Full name",
    phonePH: "Mobile number",
    groomSide: "Groom side",
    brideSide: "Bride side",
    relationshipLabel: "Relationship",
    relationshipPH: "Select relationship",
    relationshipDetailPH: "Type relationship",
    messagePH: "Write a short wish",
    skipMessage: "Skip message",
    nickname: "Show nickname",
    anonymous: "Post anonymously",
    nextBtn: "Submit & view account",
    sending: "Sending...",
    infoUse: "Your info is used only for check-in and thank-you messages.",
    successTitle: "Delivered",
    successDesc: "Thank you for celebrating with them.",
    giftTitle: "Send a gift",
    copyBtn: "Copy account",
    copied: "Copied.",
    attendanceNoteShort: "Even if you paste & send,\nyou’ll be recorded as attending.",
    kakaoThanks: "Get thank-you via Kakao",
    selectSideFirst: "Please select a side.",
    selectRelationship: "Please select a relationship.",
    invalidBasic: "Please check your name and phone.",
    writeMessage: "Please write a message.",
    closedNotice: "Not available right now.",
  },
};

export default function GuestPage() {
  const { eventId } = useParams<RouteParams>();

  const [lang, setLang] = useState<Lang>("KO");
  const t = I18N[lang];

  const [side, setSide] = useState<Side>("");
  const [realName, setRealName] = useState("");
  const [phone, setPhone] = useState("");

  const [relationship, setRelationship] = useState("");
  const [relationshipDetail, setRelationshipDetail] = useState("");

  const [sendMoneyOnly, setSendMoneyOnly] = useState(false);
  const [message, setMessage] = useState("");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("nickname");
  const [nickname, setNickname] = useState("");

  const [accounts, setAccounts] = useState<EventAccountRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedAccountForSummary, setSelectedAccountForSummary] =
    useState<EventAccountRow | null>(null);

  const [phase, setPhase] = useState<EventPhase>("open");
  const [canWrite, setCanWrite] = useState(true);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  /* ---------- init ---------- */
  useEffect(() => {
    async function init() {
      if (!eventId) return;

      const { data: settings } = await supabase
        .from("event_settings")
        .select("ceremony_date, ceremony_start_time, ceremony_end_time")
        .eq("event_id", eventId)
        .maybeSingle<EventSettingsRow>();

      if (
        settings &&
        !isBlank(settings.ceremony_date) &&
        !isBlank(settings.ceremony_start_time) &&
        !isBlank(settings.ceremony_end_time)
      ) {
        const start = new Date(
          `${settings.ceremony_date}T${settings.ceremony_start_time}`
        );
        const end = new Date(
          `${settings.ceremony_date}T${settings.ceremony_end_time}`
        );
        const p = getEventPhase(new Date(), start, end);
        setPhase(p);
        setCanWrite(p === "open");
      } else {
        setPhase("open");
        setCanWrite(true);
      }

      const { data: accs } = await supabase
        .from("event_accounts")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });

      setAccounts((accs ?? []).filter((a) => a.is_active !== false));
    }

    init();
  }, [eventId]);

  /* ---------- 🔧 수정: side 변경 시 계좌 선택 초기화 ---------- */
  useEffect(() => {
    setSelectedAccountId(null);
  }, [side]);

  const filteredAccounts = useMemo(() => {
    if (!side) return [];
    return accounts.filter((a) => {
      const label = (a.label ?? "").toLowerCase();
      if (side === "groom") return label.includes("신랑") || label.includes("groom");
      return label.includes("신부") || label.includes("bride");
    });
  }, [accounts, side]);

  const relationshipValue =
    relationship === "직접입력" || relationship === "Custom"
      ? relationshipDetail.trim()
      : relationship.trim();

  /* ---------- submit ---------- */
  const handleSubmit = async () => {
    if (!eventId) return;
    if (!canWrite) return alert(t.closedNotice);

    const phoneDigits = onlyDigits(phone);
    if (!realName.trim() || !isValidKoreanMobile(phoneDigits))
      return alert(t.invalidBasic);
    if (!side) return alert(t.selectSideFirst);
    if (!relationshipValue) return alert(t.selectRelationship);

    // 🔧 수정: 메시지 생략 시 기본 메시지 자동 사용
    const bodyToSave = sendMoneyOnly
      ? DEFAULT_DISPLAY_MESSAGE
      : message.trim();

    if (!sendMoneyOnly && !bodyToSave) return alert(t.writeMessage);

    setLoading(true);

    try {
      const nicknameToSave =
        displayMode === "nickname"
          ? isBlank(nickname)
            ? realName.trim()
            : nickname.trim()
          : null;

      // messages
      const { data: msgData, error: msgErr } = await supabase
        .from("messages")
        .insert({
          event_id: eventId,
          side,
          guest_name: realName.trim(),
          guest_phone: phoneDigits,
          relationship: relationshipValue,
          body: bodyToSave,
          source: "onsite",
          is_anonymous: displayMode === "anonymous" || sendMoneyOnly,
          nickname: nicknameToSave,
        })
        .select("id, created_at")
        .maybeSingle();

      if (msgErr || !msgData?.id) throw msgErr;

      // 🔧 기존 로직 유지: ledger_entries upsert
      await upsertLedgerForOwners({
        eventId,
        side,
        guestName: realName.trim(),
        guestPhoneDigits: phoneDigits,
        relationship: relationshipValue,
        messageId: msgData.id,
        messageBody: bodyToSave,
        messageCreatedAtIso: msgData.created_at ?? new Date().toISOString(),
      });

      const selected = accounts.find((a) => a.id === selectedAccountId) ?? null;
      setSelectedAccountForSummary(selected);
      setSubmitted(true);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */

  // 🔧 수정: 메시지 생략 시 textarea 유지 + 회색 기본 메시지
  const messageValue = sendMoneyOnly ? DEFAULT_DISPLAY_MESSAGE : message;

  /* ---------- success ---------- */
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="text-4xl mb-4">💐</div>
          <h2 className="text-2xl font-serif mb-6">{t.successTitle}</h2>

          {selectedAccountForSummary && (
            <div className="bg-white rounded-3xl p-6 shadow-sm text-left">
              <p className="text-xs text-gray-400 mb-1">
                {selectedAccountForSummary.label}
              </p>
              <p className="font-semibold">
                {selectedAccountForSummary.holder_name}
              </p>
              <p className="text-gray-600 mt-1">
                {selectedAccountForSummary.bank_name}{" "}
                {selectedAccountForSummary.account_number}
              </p>

              <button
                onClick={() =>
                  navigator.clipboard.writeText(
                    `${selectedAccountForSummary.bank_name} ${selectedAccountForSummary.account_number}`
                  )
                }
                className="w-full mt-4 py-3 bg-rose-50 text-rose-600 rounded-2xl text-sm font-bold"
              >
                {t.copyBtn}
              </button>

              <p className="mt-3 text-xs text-gray-400 whitespace-pre-line">
                {t.attendanceNoteShort}
              </p>
            </div>
          )}

          <a
            href={KAKAO_CHANNEL_URL}
            className="inline-block mt-6 text-xs text-gray-400 underline"
            target="_blank"
            rel="noreferrer"
          >
            {t.kakaoThanks}
          </a>
        </div>
      </div>
    );
  }

  /* ---------- main ---------- */
  return (
    <div className="min-h-screen bg-[#FDFCFB] pb-10">
      <header className="px-6 pt-10 pb-8 text-center relative">
        <button
          onClick={() => setLang((v) => (v === "KO" ? "EN" : "KO"))}
          className="absolute right-6 top-6 text-[10px] font-bold text-gray-400 underline"
        >
          {lang === "KO" ? "EN" : "KO"}
        </button>

        <h1 className="text-3xl font-serif mb-2">{t.title}</h1>
        <p className="text-gray-500">{t.subtitle}</p>
      </header>

      <main className="px-6 max-w-md mx-auto space-y-10">
        {/* Step 1 */}
        <section className="space-y-4">
          <input
            placeholder={t.namePH}
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            className="w-full border-b py-3"
          />
          <input
            placeholder={t.phonePH}
            value={phone}
            onChange={(e) => setPhone(formatKoreanMobile(e.target.value))}
            className="w-full border-b py-3"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setSide("groom")}
              className={`flex-1 py-3 rounded-2xl ${
                side === "groom" ? "bg-rose-500 text-white" : "bg-white border"
              }`}
            >
              {t.groomSide}
            </button>
            <button
              onClick={() => setSide("bride")}
              className={`flex-1 py-3 rounded-2xl ${
                side === "bride" ? "bg-rose-500 text-white" : "bg-white border"
              }`}
            >
              {t.brideSide}
            </button>
          </div>

          {/* 🔧 수정: 관계 선택 시 blur */}
          <select
            value={relationship}
            onChange={(e) => {
              setRelationship(e.target.value);
              (e.target as HTMLSelectElement).blur(); // 🔧
            }}
            className="w-full rounded-2xl border px-4 py-3"
          >
            <option value="">{t.relationshipPH}</option>
            <option value="가족">가족</option>
            <option value="친구">친구</option>
            <option value="직장">직장</option>
            <option value="지인">지인</option>
            <option value="직접입력">직접입력</option>
          </select>

          {(relationship === "직접입력") && (
            <input
              value={relationshipDetail}
              onChange={(e) => setRelationshipDetail(e.target.value)}
              placeholder={t.relationshipDetailPH}
              className="w-full border px-4 py-3 rounded-2xl"
            />
          )}
        </section>

        {/* Step 2 */}
        <section>
          <label className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <input
              type="checkbox"
              checked={sendMoneyOnly}
              onChange={(e) => setSendMoneyOnly(e.target.checked)}
            />
            {t.skipMessage}
          </label>

          <textarea
            rows={3}
            maxLength={MESSAGE_MAX}
            value={messageValue}
            disabled={sendMoneyOnly} // 🔧
            onChange={(e) => setMessage(e.target.value)}
            className={`w-full rounded-2xl p-4 ${
              sendMoneyOnly ? "text-gray-400 bg-gray-50" : "bg-white"
            }`}
            placeholder={t.messagePH}
          />
        </section>

        {/* Step 3 */}
        {side && (
          <section className="space-y-2">
            {filteredAccounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className={`w-full p-4 rounded-2xl border ${
                  selectedAccountId === acc.id
                    ? "border-rose-400 bg-rose-50"
                    : "bg-white"
                }`}
              >
                <p className="text-xs text-gray-400">{acc.label}</p>
                <p className="font-semibold">{acc.holder_name}</p>
              </button>
            ))}
          </section>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !canWrite}
          className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold disabled:bg-gray-300"
        >
          {loading ? t.sending : t.nextBtn}
        </button>

        <p className="text-center text-[10px] text-gray-400">{t.infoUse}</p>
      </main>
    </div>
  );
}

/* ================= helpers ================= */

// 🔧 기존 그대로 유지 (중요 로직)
async function upsertLedgerForOwners(params: {
  eventId: string;
  side: Side;
  guestName: string;
  guestPhoneDigits: string;
  relationship: string;
  messageId: string;
  messageBody: string;
  messageCreatedAtIso: string;
}) {
  const {
    eventId,
    side,
    guestName,
    guestPhoneDigits,
    relationship,
    messageId,
    messageBody,
    messageCreatedAtIso,
  } = params;

  const { data: owners } = await supabase
    .from("event_members")
    .select("id, role")
    .eq("event_id", eventId)
    .eq("role", "owner");

  const ownerList = (owners ?? []) as EventMemberRow[];
  const nowIso = new Date().toISOString();

  for (const owner of ownerList) {
    const { data: exist } = await supabase
      .from("event_ledger_entries")
      .select("id, attended_at")
      .eq("event_id", eventId)
      .eq("owner_member_id", owner.id)
      .eq("guest_phone", guestPhoneDigits)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (exist?.id) {
      await supabase
        .from("event_ledger_entries")
        .update({
          side,
          guest_name: guestName,
          relationship,
          attended: true,
          attended_at: exist.attended_at ?? nowIso,
          message_id: messageId,
          main_message: messageBody,
          message_created_at: messageCreatedAtIso,
          created_source: "guestpage",
        })
        .eq("id", exist.id);
    } else {
      await supabase.from("event_ledger_entries").insert({
        event_id: eventId,
        owner_member_id: owner.id,
        side,
        guest_name: guestName,
        guest_phone: guestPhoneDigits,
        relationship,
        attended: true,
        attended_at: nowIso,
        message_id: messageId,
        main_message: messageBody,
        message_created_at: messageCreatedAtIso,
        gift_method: "unknown",
        created_source: "guestpage",
      });
    }
  }
}
