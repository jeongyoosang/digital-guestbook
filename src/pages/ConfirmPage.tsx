// src/pages/ConfirmPage.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface RouteParams {
  eventId: string;
}

type Recipient = {
  name: string;
  role: string;
  contact: string;
};

type EventSettings = {
  id?: string;
  event_id: string;
  ceremony_date: string | null;
  ceremony_start_time: string;
  ceremony_end_time: string;
  title: string;
  subtitle: string;
  theme_prompt: string;
  lower_message: string | null;
  recipients: Recipient[];
};

const FIXED_TITLE = "WEDDING MESSAGES";
const FIXED_SUBTITLE = "하객 분들의 마음이 전해지고 있어요 💐";
const DEFAULT_LOWER_MESSAGE = "친히 오셔서 축복해주셔서 감사합니다.";

export default function ConfirmPage() {
  const { eventId } = useParams<RouteParams>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [ceremonyDate, setCeremonyDate] = useState("");
  const [ceremonyStartTime, setCeremonyStartTime] = useState("");
  const [ceremonyEndTime, setCeremonyEndTime] = useState("");
  const [themePrompt, setThemePrompt] = useState("");
  const [lowerMessage, setLowerMessage] = useState(DEFAULT_LOWER_MESSAGE);

  const [recipients, setRecipients] = useState<Recipient[]>([
    { name: "", role: "신랑", contact: "" },
    { name: "", role: "신부", contact: "" },
  ]);

  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!eventId) {
      setError("잘못된 접근입니다. 이벤트 정보가 없습니다.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: settingsData, error: sError } = await supabase
          .from("event_settings")
          .select("*")
          .eq("event_id", eventId)
          .maybeSingle();

        if (sError) throw sError;

        if (settingsData) {
          setCeremonyDate(settingsData.ceremony_date ?? "");
          setCeremonyStartTime(settingsData.ceremony_start_time ?? "");
          setCeremonyEndTime(settingsData.ceremony_end_time ?? "");
          setThemePrompt(settingsData.theme_prompt ?? "");
          setLowerMessage(
            settingsData.lower_message ?? DEFAULT_LOWER_MESSAGE
          );

          if (settingsData.recipients && Array.isArray(settingsData.recipients)) {
            const list = settingsData.recipients as Recipient[];

            const groom = list.find((r) => r.role?.includes("신랑"));
            const bride = list.find((r) => r.role?.includes("신부"));
            const others = list.filter(
              (r) => !r.role?.includes("신랑") && !r.role?.includes("신부")
            );

            const ordered: Recipient[] = [
              groom || { name: "", role: "신랑", contact: "" },
              bride || { name: "", role: "신부", contact: "" },
              ...others,
            ];

            setRecipients(ordered);
          }
        }
      } catch (err) {
        console.error(err);
        setError("설정 정보를 불러오는 중 오류가 발생했어요.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId]);

  const handleRecipientChange = (
    index: number,
    field: keyof Recipient,
    value: string
  ) => {
    setRecipients((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddRecipient = () => {
    setRecipients((prev) => [
      ...prev,
      { name: "", role: "스태프", contact: "" },
    ]);
  };

  const handleRemoveRecipient = (index: number) => {
    // 신랑/신부(0,1)는 삭제 못하게
    if (index === 0 || index === 1) return;
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (ceremonyDate && ceremonyDate < todayStr) {
        setError("예식 날짜는 오늘 이후만 선택할 수 있습니다.");
        setSaving(false);
        return;
      }

      const trimmedRecipients = recipients
        .map((r, idx) =>
          idx === 0
            ? { ...r, role: "신랑" }
            : idx === 1
            ? { ...r, role: "신부" }
            : r
        )
        .filter((r) => r.name.trim() || r.contact.trim());

      const hasBride = trimmedRecipients.some(
        (r) =>
          r.role === "신부" &&
          r.name.trim().length > 0 &&
          r.contact.trim().length > 0
      );
      const hasGroom = trimmedRecipients.some(
        (r) =>
          r.role === "신랑" &&
          r.name.trim().length > 0 &&
          r.contact.trim().length > 0
      );

      if (!hasBride || !hasGroom) {
        setError("신랑, 신부의 이름과 연락처는 반드시 입력해 주세요.");
        setSaving(false);
        return;
      }

      const payload: EventSettings = {
        event_id: eventId,
        ceremony_date: ceremonyDate || null,
        ceremony_start_time: ceremonyStartTime,
        ceremony_end_time: ceremonyEndTime,
        title: FIXED_TITLE,
        subtitle: FIXED_SUBTITLE,
        theme_prompt: themePrompt,
        lower_message: lowerMessage || DEFAULT_LOWER_MESSAGE,
        recipients: trimmedRecipients,
      };

      const { error: upsertError } = await supabase
        .from("event_settings")
        .upsert(payload, { onConflict: "event_id" });

      if (upsertError) throw upsertError;

      setSuccess(
        "디지털 방명록 세부내용과 최종입금은 확인 후 카카오톡 메세지로 안내됩니다"
      );
    } catch (err) {
      console.error(err);
      setError("저장 중 오류가 발생했어요. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <p className="text-lg">설정을 불러오는 중입니다...</p>
      </div>
    );
  }

  if (!eventId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <p className="text-lg">잘못된 접근입니다. 이벤트 정보가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-lg p-8 md:p-10">
        <h1 className="text-2xl md:text-3xl font-semibold text-center mb-2">
          디지털 방명록 내용 확정하기
        </h1>
        <p className="text-center text-gray-500 mb-6">
          예식 시작 전에 한 번만 확인·저장해 주세요.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 1. 실제 예식 시간 */}
          <section>
            <h2 className="text-lg font-semibold mb-3">1. 실제 예식 시간</h2>
            <p className="text-xs text-gray-500 mb-3">
              이 시간 기준으로, 식{" "}
              <span className="font-semibold">시작 1시간 전</span>
              부터 메시지를 받기 시작하고 끝나기 10분 전에 자동으로 마감할 예정입니다.
            </p>

            {/* 날짜 한 줄 + 시간 두 칸 나란히 */}
            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-sm mb-1">예식 날짜</label>
                <input
                  type="date"
                  className="border rounded-xl px-3 py-2 text-sm"
                  value={ceremonyDate}
                  min={todayStr}
                  onChange={(e) => {
                    setCeremonyDate(e.target.value);
                    // 모바일에서 날짜 선택 후 달력창 자동 닫힘 (포커스 제거)
                    e.target.blur();
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-sm mb-1">시작 시간</label>
                  <input
                    type="time"
                    className="border rounded-xl px-3 py-2 text-sm"
                    value={ceremonyStartTime}
                    onChange={(e) => setCeremonyStartTime(e.target.value)}
                    step={600} // 10분 단위
                    required
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm mb-1">종료 시간</label>
                  <input
                    type="time"
                    className="border rounded-xl px-3 py-2 text-sm"
                    value={ceremonyEndTime}
                    onChange={(e) => setCeremonyEndTime(e.target.value)}
                    step={600} // 10분 단위
                    required
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 2. 디스플레이 하단 안내 문구 */}
          <section>
            <h2 className="text-lg font-semibold mb-3">
              2. 디스플레이 하단 안내 문구
            </h2>
            <p className="text-xs text-gray-500 mb-2">
              QR 코드 아래에 짧게 표시되는 문구입니다. <br />
              예: &quot;친히 오셔서 축복해주셔서 감사합니다.&quot;
            </p>
            <input
              type="text"
              className="w-full border rounded-xl px-3 py-2 text-sm"
              value={lowerMessage}
              onChange={(e) => setLowerMessage(e.target.value)}
              maxLength={60}
            />
          </section>

          {/* 3. 배경 분위기 설명 */}
          <section>
            <h2 className="text-lg font-semibold mb-3">
              3. 배경 분위기 설명 (선택)
            </h2>
            <p className="text-xs text-gray-500 mb-2 space-y-1">
              <span className="block">
                예: &quot;따뜻한 벚꽃이 피는 야외 결혼식&quot;, &quot;고급스럽고 모던한 실내 예식&quot;
              </span>
              <span className="block">
                입력하지 않을 시 예식장 분위기와 모바일 청첩장 등을 종합적으로 AI가
                분석해 자동 설정됩니다.
              </span>
            </p>
            <textarea
              className="w-full border rounded-xl px-3 py-2 text-sm min-h-[70px]"
              value={themePrompt}
              onChange={(e) => setThemePrompt(e.target.value)}
            />
          </section>

          {/* 4. 결과물을 받을 사람 */}
          <section>
            <h2 className="text-lg font-semibold mb-3">
              4. 결과물을 받을 사람
            </h2>
            <p className="text-xs text-gray-500 mb-2">
              예식이 끝나면 아래 사람들에게 리플레이 링크와 엑셀 정리본을 자동으로 보내 줄 예정입니다.
              <br />
              <span className="text-[11px] text-pink-500">
                1줄: 신랑, 2줄: 신부의 이름과 연락처는 반드시 입력해 주세요.
              </span>
            </p>

            <div className="space-y-3">
              {recipients.map((r, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-[minmax(70px,90px)_1fr_1.2fr_auto] gap-2 items-center"
                >
                  {/* 역할 */}
                  <div className="text-xs md:text-sm text-gray-600">
                    {index === 0 && (
                      <span className="inline-block px-3 py-1 rounded-full bg-pink-50 text-pink-600 font-medium">
                        신랑
                      </span>
                    )}
                    {index === 1 && (
                      <span className="inline-block px-3 py-1 rounded-full bg-pink-50 text-pink-600 font-medium">
                        신부
                      </span>
                    )}
                    {index > 1 && (
                      <input
                        type="text"
                        className="border rounded-xl px-3 py-2 text-xs md:text-sm w-full"
                        placeholder="역할 (부모님, 스태프 등)"
                        value={r.role}
                        onChange={(e) =>
                          handleRecipientChange(index, "role", e.target.value)
                        }
                      />
                    )}
                  </div>

                  {/* 이름 */}
                  <input
                    type="text"
                    placeholder={index === 0 ? "신랑 이름" : index === 1 ? "신부 이름" : "이름"}
                    className="border rounded-xl px-3 py-2 text-sm"
                    value={r.name}
                    onChange={(e) =>
                      handleRecipientChange(index, "name", e.target.value)
                    }
                  />

                  {/* 연락처 */}
                  <input
                    type="text"
                    placeholder="연락처 (문자 또는 카톡 가능한 번호)"
                    className="border rounded-xl px-3 py-2 text-sm"
                    value={r.contact}
                    onChange={(e) =>
                      handleRecipientChange(index, "contact", e.target.value)
                    }
                  />

                  {/* 삭제 버튼 */}
                  <button
                    type="button"
                    onClick={() => handleRemoveRecipient(index)}
                    className={`text-xs underline ${
                      index === 0 || index === 1
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-gray-500"
                    }`}
                    disabled={index === 0 || index === 1}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddRecipient}
              className="mt-3 text-sm text-pink-600 underline"
            >
              + 수신자 추가
            </button>
          </section>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-600 bg-green-50 rounded-xl px-3 py-2">
              {success}
            </p>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 rounded-full bg-pink-500 text-white text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "보내는 중..." : "보내기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
