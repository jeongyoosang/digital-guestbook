// src/pages/GuestPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getEventPhase, type EventPhase } from "../lib/time";

type DisplayMode = "nickname" | "anonymous";

interface RouteParams {
  eventId: string;
}

// 디스플레이 영역(스크롤 없음)을 고려한 최대 글자 수
const MESSAGE_MAX = 80;

type Schedule = {
  start: string; // ISO 문자열
  end: string;
};

type EventAccountRow = {
  id: string;
  label: string;
  holder_name: string;
  bank_name: string;
  account_number: string;
  sort_order: number | null;
  is_active: boolean | null;
};

const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_UyaHn";

export default function GuestPage() {
  const { eventId } = useParams<RouteParams>();

  // 1. 신랑측/신부측
  const [side, setSide] = useState<"" | "groom" | "bride">("");

  // 2. 실명 (엑셀용)
  const [realName, setRealName] = useState("");

  // 3. 축하메세지
  const [message, setMessage] = useState("");

  // 4. 표시 방식 (닉네임 / 메세지만)
  const [displayMode, setDisplayMode] = useState<DisplayMode | "">("");
  const [nickname, setNickname] = useState("");

  // 5. 관계 (옵션 + 직접입력)
  const [relationship, setRelationship] = useState("");
  const [relationshipDetail, setRelationshipDetail] = useState("");

  // 6. 축의금 계좌
  const [accounts, setAccounts] = useState<EventAccountRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );
  const [selectedAccountForSummary, setSelectedAccountForSummary] =
    useState<EventAccountRow | null>(null);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 예식 시간 스케줄 & 상태
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [phase, setPhase] = useState<EventPhase>("open");

  if (!eventId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center text-sm text-gray-600">
          잘못된 접근입니다. (eventId 없음)
        </div>
      </div>
    );
  }

  // 0) event_settings에서 예식 시간 가져오기
  useEffect(() => {
    let cancelled = false;

    const fetchSchedule = async () => {
      const { data, error } = await supabase
        .from("event_settings")
        .select("ceremony_date, ceremony_start_time, ceremony_end_time")
        .eq("event_id", eventId)
        .maybeSingle();

      if (error) {
        console.error("[Guest] fetchSchedule error", error);
        return;
      }
      if (!data || cancelled) return;

      if (data.ceremony_start_time && data.ceremony_end_time) {
        const dateStr = (data.ceremony_date as string) ?? "";
        const startTime = data.ceremony_start_time as string; // "09:30"
        const endTime = data.ceremony_end_time as string; // "11:00"

        const baseDate =
          dateStr && dateStr.length === 10
            ? dateStr
            : new Date().toISOString().slice(0, 10);

        setSchedule({
          start: `${baseDate}T${startTime}:00`,
          end: `${baseDate}T${endTime}:00`,
        });
      }
    };

    fetchSchedule();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // 0-1) 스케줄에 따라 phase 계산 (1분마다 갱신)
  useEffect(() => {
    if (!schedule) return;

    const updatePhase = () => {
      const now = new Date();
      const start = new Date(schedule.start);
      const end = new Date(schedule.end);
      setPhase(getEventPhase(now, start, end));
    };

    updatePhase(); // 처음 한 번
    const timer = setInterval(updatePhase, 60 * 1000);

    return () => clearInterval(timer);
  }, [schedule]);

  // 0-2) event_accounts 가져오기
  useEffect(() => {
    let cancelled = false;

    const fetchAccounts = async () => {
      const { data, error } = await supabase
        .from("event_accounts")
        .select(
          `
          id,
          label,
          holder_name,
          bank_name,
          account_number,
          sort_order,
          is_active
        `
        )
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("[Guest] fetchAccounts error", error);
        return;
      }
      if (!data || cancelled) return;

      setAccounts(data as EventAccountRow[]);
    };

    fetchAccounts();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // 신랑/신부측에 따라 보여줄 계좌 필터링
  const filteredAccounts = useMemo(() => {
    if (!side) return accounts;

    if (side === "groom") {
      return accounts.filter((a) => a.label.includes("신랑"));
    }
    if (side === "bride") {
      return accounts.filter((a) => a.label.includes("신부"));
    }
    return accounts;
  }, [accounts, side]);

  // side가 바뀌면 선택했던 계좌가 안 맞을 수 있으니 초기화
  useEffect(() => {
    if (!selectedAccountId) return;
    if (!filteredAccounts.find((a) => a.id === selectedAccountId)) {
      setSelectedAccountId(null);
    }
  }, [filteredAccounts, selectedAccountId]);

  async function handleSubmit() {
    // 입력 순서대로 필수값 체크
    if (!realName.trim()) {
      alert("성함을 입력해주세요. (신랑·신부에게만 보입니다)");
      return;
    }

    if (!message.trim()) {
      alert("축하메세지를 입력해주세요.");
      return;
    }

    if (message.length > MESSAGE_MAX) {
      alert(`축하메세지는 최대 ${MESSAGE_MAX}자까지 가능합니다.`);
      return;
    }

    if (!displayMode) {
      alert("화면에 어떻게 표시할지 선택해주세요.");
      return;
    }

    if (displayMode === "nickname" && !nickname.trim()) {
      alert("닉네임을 입력해주세요.");
      return;
    }

    if (!side) {
      alert("어느 쪽 하객이신지 선택해주세요.");
      return;
    }

    // 관계 직접입력 처리
    let finalRelationship = relationship;
    if (relationship === "직접입력") {
      if (!relationshipDetail.trim()) {
        alert("관계를 직접 입력해주세요.");
        return;
      }
      finalRelationship = relationshipDetail.trim();
    }

    // 계좌 선택 (계좌가 설정되어 있다면 필수)
    if (filteredAccounts.length > 0 && !selectedAccountId) {
      alert("축의금을 송금하실 계좌를 선택해주세요.");
      return;
    }

    const selectedAccount = filteredAccounts.find(
      (a) => a.id === selectedAccountId
    );

    setLoading(true);

    const { error } = await supabase.from("messages").insert({
      event_id: eventId,
      side,
      guest_name: realName.trim(), // 엑셀용 실명
      nickname: displayMode === "nickname" ? nickname.trim() : null,
      is_anonymous: displayMode === "anonymous", // 메세지만 보이기일 때 true
      relationship: finalRelationship || null,
      body: message.trim(),
      source: "onsite",
    });

    setLoading(false);

    if (error) {
      console.error(error);
      alert("메세지 전송 중 오류가 발생했습니다.");
      return;
    }

    setSelectedAccountForSummary(selectedAccount ?? null);
    setSubmitted(true);
  }

  function copyAccountNumber() {
    if (!selectedAccountForSummary) return;

    const text = selectedAccountForSummary.account_number;
    if (!text) return;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
          alert("계좌번호가 복사되었습니다.");
        },
        () => {
          alert("복사에 실패했습니다. 직접 입력해 주세요.");
        }
      );
    } else {
      alert("복사가 지원되지 않는 브라우저입니다. 직접 입력해 주세요.");
    }
  }

  // 이미 전송한 경우: 2단계 - 송금 안내 + 카카오 채널 옵션
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center">
        <div className="max-w-md mx-auto w-full px-4 py-8">
          <div className="bg-white rounded-2xl shadow-md px-6 py-7 text-center space-y-4">
            <p className="text-sm font-medium text-pink-500">
              축하메세지가 전송되었어요 💐
            </p>
            <p className="text-lg font-semibold">
              이제 선택하신 계좌로
              <br />
              축의금을 보내실 수 있어요.
            </p>

            {selectedAccountForSummary ? (
              <div className="mt-4 text-left border rounded-2xl bg-pink-50/60 border-pink-100 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-pink-600">
                  축의금 수취 계좌
                </p>
                <p className="text-sm font-semibold">
                  {selectedAccountForSummary.label} ·{" "}
                  {selectedAccountForSummary.holder_name}
                </p>
                <p className="text-sm text-gray-700">
                  {selectedAccountForSummary.bank_name}{" "}
                  {selectedAccountForSummary.account_number}
                </p>
                <button
                  type="button"
                  onClick={copyAccountNumber}
                  className="mt-2 inline-flex items-center justify-center rounded-full border border-pink-400 px-4 py-1.5 text-xs font-medium text-pink-700 bg-white hover:bg-pink-50 transition"
                >
                  계좌번호 복사하기
                </button>
                <p className="mt-1 text-[10px] text-gray-500">
                  복사된 계좌번호로 사용하는 은행/간편결제 앱에서 송금해 주세요.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-xs text-gray-500">
                축의금 계좌 정보가 아직 준비되지 않았습니다.
                <br />
                예식장 안내에 따라 송금해 주세요.
              </p>
            )}

            {/* 카카오 채널 옵션 (선택 사항) */}
            <div className="pt-3 border-t border-gray-100 mt-4 space-y-2">
              <p className="text-[11px] text-gray-500">
                신랑·신부의 감사 인사를 카카오톡으로 받고 싶다면
                <br className="sm:hidden" /> 아래 채널을 친구추가해 주세요.
              </p>
              <a
                href={KAKAO_CHANNEL_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold bg-[#FEE500] text-black hover:bg-yellow-300 transition"
              >
                카카오톡 채널 친구추가
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 예식 1시간 전 이전: 대기 화면
  if (phase === "before_wait") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center">
        <div className="max-w-md mx-auto w-full px-4">
          <div className="bg-white rounded-2xl shadow-md px-6 py-8 text-center space-y-4">
            <p className="text-sm font-medium text-pink-500">
              아직 조금 이른 시간이에요
            </p>
            <p className="text-lg font-semibold">
              예식 1시간 전부터
              <br />
              축하메세지 작성이 가능합니다.
            </p>
            <p className="text-xs text-gray-500">
              잠시 후 다시 접속하시거나,
              <br className="sm:hidden" /> 잠깐 후에 새로고침해 주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 예식 종료 10분 전 이후: 마감 화면
  if (phase === "closed") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center">
        <div className="max-w-md mx-auto w-full px-4">
          <div className="bg-white rounded-2xl shadow-md px-6 py-8 text-center space-y-4">
            <p className="text-lg font-semibold">
              메시지 접수가 모두 종료되었습니다.
            </p>
            <p className="text-sm text-gray-600">
              오늘 남겨주신 모든 축하메세지는
              <br className="sm:hidden" /> 신랑·신부에게 잘 전달될 예정입니다.
            </p>
            <p className="text-xs text-gray-400">
              소중한 축하의 마음을 전해주셔서 감사합니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // phase === "open" → 1단계 입력 폼
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto w-full px-4 py-6 sm:py-10">
        {/* 상단 헤더 */}
        <header className="mb-6 text-center">
          <p className="text-xs font-medium tracking-wide text-pink-500 uppercase">
            DIGITAL GUESTBOOK
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            축하 메세지를 남겨주세요 💌
          </h1>
          <p className="mt-2 text-xs text-gray-500">
            메세지를 남기면 축의금을 보낼 수 있어요.
            <br className="sm:hidden" /> 작성하신 메세지는 디스플레이에 나오고,
            종합하여 신랑신부에게 전달됩니다.
          </p>
        </header>

        <div className="bg-white rounded-2xl shadow-sm px-4 py-5 sm:px-6 sm:py-7 space-y-5">
          {/* 1. 성함 */}
          <section>
            <label className="block text-sm font-semibold">성함</label>
            <input
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
              placeholder="신랑·신부에게만 보이는 실제 이름"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-gray-500">
              실명은 신랑신부에게만 전달되고,
              <br className="sm:hidden" /> 디스플레이에는 절대 노출되지 않습니다.
            </p>
          </section>

          {/* 2. 축하메세지 */}
          <section>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold">
                축하메세지
              </label>
              <span className="text-[11px] text-gray-400">
                {message.length} / {MESSAGE_MAX}자
              </span>
            </div>
            <textarea
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
              rows={4}
              maxLength={MESSAGE_MAX}
              placeholder="따뜻한 축하의 말을 남겨주세요 💐"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-gray-400 text-right">
              예: 오늘 두 분 결혼 너무 축하해요!
            </p>
          </section>

          {/* 3. 표시 방식 (닉네임 / 메세지만) */}
          <section>
            <label className="block text-sm font-semibold">
              화면에 어떻게 보일까요?
            </label>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setDisplayMode("nickname")}
                className={`flex h-11 items-center justify-between rounded-xl border px-3 text-sm transition ${
                  displayMode === "nickname"
                    ? "border-pink-500 bg-pink-500 text-white"
                    : "border-gray-300 bg-white text-gray-800"
                }`}
              >
                <span>닉네임으로 표시</span>
                <span className="text-[11px] opacity-80">
                  예: 잠보기, 고래 등
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDisplayMode("anonymous")}
                className={`flex h-11 items-center justify-between rounded-xl border px-3 text-sm transition ${
                  displayMode === "anonymous"
                    ? "border-pink-500 bg-pink-500 text-white"
                    : "border-gray-300 bg-white text-gray-800"
                }`}
              >
                <span>메세지만 보이기</span>
                <span className="text-[11px] opacity-80">
                  화면에는 메세지만 나와요
                </span>
              </button>
            </div>

            {displayMode === "nickname" && (
              <div className="mt-3">
                <label className="block text-xs font-medium">닉네임</label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                  placeholder="예: 잠보기, 깐부, 고래"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
            )}
          </section>

          {/* 4. 신랑측 / 신부측 */}
          <section>
            <label className="block text-sm font-semibold">
              어느 쪽 하객이신가요?
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSide("groom")}
                className={`h-11 rounded-full border text-sm font-medium transition ${
                  side === "groom"
                    ? "bg-pink-500 text-white border-pink-500"
                    : "bg-white text-gray-800 border-gray-300"
                }`}
              >
                신랑측
              </button>
              <button
                type="button"
                onClick={() => setSide("bride")}
                className={`h-11 rounded-full border text-sm font-medium transition ${
                  side === "bride"
                    ? "bg-pink-500 text-white border-pink-500"
                    : "bg-white text-gray-800 border-gray-300"
                }`}
              >
                신부측
              </button>
            </div>
          </section>

          {/* 5. 관계 (옵션 + 직접입력) */}
          <section>
            <label className="block text-sm font-semibold">
              관계 <span className="text-gray-400 text-xs">(선택)</span>
            </label>
            <select
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none bg-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
            >
              <option value="">선택 안 함</option>
              <option value="친구">친구</option>
              <option value="직장">직장</option>
              <option value="가족">가족/친척</option>
              <option value="동창">동창</option>
              <option value="직접입력">직접입력</option>
            </select>

            {relationship === "직접입력" && (
              <div className="mt-3">
                <label className="block text-xs font-medium">
                  관계 직접입력
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                  placeholder="예: 마태오 성당"
                  value={relationshipDetail}
                  onChange={(e) => setRelationshipDetail(e.target.value)}
                />
              </div>
            )}
          </section>

          {/* 6. 축의금 계좌 선택 (선택만, 복사 없음) */}
          <section>
            <label className="block text-sm font-semibold">
              축의금 받으실 분 
            </label>
            <p className="mt-1 text-[11px] text-gray-500">
              메세지를 남기면 다음 단계에서 선택하신 계좌번호로
              <br className="sm:hidden" /> 축의금을 보내실 수 있어요.
            </p>

            {filteredAccounts.length === 0 ? (
              <p className="mt-2 text-xs text-gray-400">
                아직 등록된 축의금 계좌가 없습니다.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {filteredAccounts.map((acct) => (
                  <button
                    type="button"
                    key={acct.id}
                    onClick={() => setSelectedAccountId(acct.id)}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 text-sm transition ${
                      selectedAccountId === acct.id
                        ? "border-pink-500 bg-pink-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <p className="text-xs font-semibold text-gray-700">
                      {acct.label}
                    </p>
                    <p className="text-xs text-gray-600">
                      {acct.holder_name} · {acct.bank_name}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* 제출 버튼 */}
          <section className="pt-1">
            <button
              className="w-full h-12 rounded-xl bg-pink-500 text-white text-sm font-semibold disabled:opacity-60 active:scale-[0.99] transition shadow-sm hover:bg-pink-600"
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? "메세지 전송 중..." : "메세지 남기기"}
            </button>
          </section>
        </div>

        {/* 하단 작은 안내 */}
        <p className="mt-4 text-[11px] text-center text-gray-400">
          전송 버튼을 누르시면 이용약관 및 개인정보 처리방침에 동의한 것으로
          간주됩니다.
        </p>
      </div>
    </div>
  );
}
