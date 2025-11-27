// src/pages/ConfirmPage.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface RouteParams {
  eventId: string;
}

type EventRow = {
  id: string;
  title?: string | null;
  groom_name?: string | null;
  bride_name?: string | null;
  ceremony_date?: string | null;
  venue_name?: string | null;
  [key: string]: any;
};

type EventSettingsRow = {
  id: string;
  event_id: string;
  ceremony_date: string | null;
  ceremony_start_time: string | null;
  ceremony_end_time: string | null;
  title: string | null;
  subtitle: string | null;
  theme_prompt: string | null;
  recipients: string | null;
  display_start_offset_minutes: number | null;
  display_end_offset_minutes: number | null;
  lower_message: string | null;
};

type AccountForm = {
  id?: string;
  label: string;
  holder_name: string;
  bank_name: string;
  account_number: string;
  sort_order: number;
  is_active: boolean;
};

const MAX_ACCOUNTS = 6;

const DEFAULT_TITLE = "WEDDING MESSAGES";
const DEFAULT_SUBTITLE = "하객 분들의 마음이 전해지고 있어요 💐";
const DEFAULT_LOWER_MESSAGE = "친히 오셔서 축복해주시어 감사합니다.";
const DEFAULT_THEME_PROMPT =
  "따뜻한 결혼식, 은은한 조명, 크리스마스 분위기, 부드러운 움직임의 배경 애니메이션 등";

const DEFAULT_START_OFFSET = -60; // 예식 시작 1시간 전
const DEFAULT_END_OFFSET = -10; // 예식 종료 10분 전

// 시/분 선택용 옵션
const HOURS: string[] = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0")
);
const MINUTES_10: string[] = ["00", "10", "20", "30", "40", "50"];

// ✅ 한국 주요 은행 리스트 + 기타
const BANK_OPTIONS = [
  "국민은행",
  "신한은행",
  "우리은행",
  "하나은행",
  "NH농협은행",
  "IBK기업은행",
  "SC제일은행",
  "한국씨티은행",
  "카카오뱅크",
  "토스뱅크",
  "수협은행",
  "대구은행",
  "부산은행",
  "경남은행",
  "광주은행",
  "전북은행",
  "제주은행",
  "기타(직접 입력)",
];

export default function ConfirmPage() {
  const { eventId } = useParams<RouteParams>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [event, setEvent] = useState<EventRow | null>(null);
  const [settings, setSettings] = useState<EventSettingsRow | null>(null);
  const [accounts, setAccounts] = useState<AccountForm[]>([]);

  const [ceremonyDate, setCeremonyDate] = useState("");
  const [ceremonyStartTime, setCeremonyStartTime] = useState("");
  const [ceremonyEndTime, setCeremonyEndTime] = useState("");
  const [displayTitle, setDisplayTitle] = useState(DEFAULT_TITLE);
  const [displaySubtitle, setDisplaySubtitle] = useState(DEFAULT_SUBTITLE);
  const [themePrompt, setThemePrompt] = useState(DEFAULT_THEME_PROMPT);
  const [lowerMessage, setLowerMessage] = useState(DEFAULT_LOWER_MESSAGE);

  useEffect(() => {
    if (!eventId) return;
    void fetchData(eventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function fetchData(eventId: string) {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log("[ConfirmPage] fetchData eventId:", eventId);

      // 1) events
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .maybeSingle();

      console.log("[ConfirmPage] events result:", { eventData, eventError });

      if (eventError) throw eventError;

      let e: EventRow;
      if (!eventData) {
        console.warn(
          "[ConfirmPage] eventData 없음 → 최소 정보로 fallback 이벤트 생성"
        );
        e = {
          id: eventId,
          title: null,
          groom_name: null,
          bride_name: null,
          ceremony_date: null,
          venue_name: null,
        };
      } else {
        e = eventData as EventRow;
      }

      setEvent(e);

      // 2) event_settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("event_settings")
        .select(
          `
          id,
          event_id,
          ceremony_date,
          ceremony_start_time,
          ceremony_end_time,
          title,
          subtitle,
          theme_prompt,
          recipients,
          display_start_offset_minutes,
          display_end_offset_minutes,
          lower_message
        `
        )
        .eq("event_id", eventId)
        .maybeSingle();

      console.log("[ConfirmPage] event_settings result:", {
        settingsData,
        settingsError,
      });

      if (settingsError) throw settingsError;

      if (settingsData) {
        const s = settingsData as EventSettingsRow;
        setSettings(s);

        setCeremonyDate(s.ceremony_date ?? e.ceremony_date ?? "");
        setCeremonyStartTime(s.ceremony_start_time ?? "");
        setCeremonyEndTime(s.ceremony_end_time ?? "");

        setDisplayTitle(s.title ?? DEFAULT_TITLE);
        setDisplaySubtitle(s.subtitle ?? DEFAULT_SUBTITLE);
        setThemePrompt(s.theme_prompt ?? DEFAULT_THEME_PROMPT);
        setLowerMessage(s.lower_message ?? DEFAULT_LOWER_MESSAGE);
      } else {
        setCeremonyDate(e.ceremony_date ?? "");
        setCeremonyStartTime("");
        setCeremonyEndTime("");
        setDisplayTitle(DEFAULT_TITLE);
        setDisplaySubtitle(DEFAULT_SUBTITLE);
        setThemePrompt(DEFAULT_THEME_PROMPT);
        setLowerMessage(DEFAULT_LOWER_MESSAGE);
      }

      // 3) event_accounts
      const { data: accountData, error: accountError } = await supabase
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

      console.log("[ConfirmPage] event_accounts result:", {
        accountData,
        accountError,
      });

      if (accountError && accountError.code !== "42P01") throw accountError;

      if (accountData && accountData.length > 0) {
        setAccounts(
          accountData.map((row: any) => ({
            id: row.id,
            label: row.label,
            holder_name: row.holder_name,
            bank_name: row.bank_name,
            account_number: row.account_number,
            sort_order: row.sort_order ?? 0,
            is_active: row.is_active ?? true,
          }))
        );
      } else {
        setAccounts([
          {
            label: "신랑",
            holder_name: "",
            bank_name: "",
            account_number: "",
            sort_order: 0,
            is_active: true,
          },
          {
            label: "신부",
            holder_name: "",
            bank_name: "",
            account_number: "",
            sort_order: 1,
            is_active: true,
          },
        ]);
      }
    } catch (e: any) {
      console.error("[ConfirmPage] fetchData error:", e);
      setError(e.message ?? "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleAccountChange(
    index: number,
    field: keyof AccountForm,
    value: string | boolean
  ) {
    setAccounts((prev) =>
      prev.map((acct, i) => (i === index ? { ...acct, [field]: value } : acct))
    );
  }

  function addAccount() {
    if (accounts.length >= MAX_ACCOUNTS) return;
    setAccounts((prev) => [
      ...prev,
      {
        label: "기타",
        holder_name: "",
        bank_name: "",
        account_number: "",
        sort_order: prev.length,
        is_active: true,
      },
    ]);
  }

  function removeAccount(index: number) {
    setAccounts((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((acct, i) => ({ ...acct, sort_order: i }))
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!eventId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const startOffsetNum = DEFAULT_START_OFFSET;
      const endOffsetNum = DEFAULT_END_OFFSET;

      const payload = {
        event_id: eventId,
        ceremony_date: ceremonyDate || null,
        ceremony_start_time: ceremonyStartTime || null,
        ceremony_end_time: ceremonyEndTime || null,
        title: displayTitle || null,
        subtitle: displaySubtitle || null,
        theme_prompt: themePrompt || null,
        lower_message: lowerMessage || null,
        display_start_offset_minutes: startOffsetNum,
        display_end_offset_minutes: endOffsetNum,
      };

      if (settings?.id) {
        const { error: updateError } = await supabase
          .from("event_settings")
          .update(payload)
          .eq("id", settings.id);
        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("event_settings")
          .insert(payload)
          .select()
          .maybeSingle();
        if (insertError) throw insertError;
        if (inserted) setSettings(inserted as EventSettingsRow);
      }

      const validAccounts = accounts
        .filter(
          (a) =>
            a.label.trim() &&
            a.holder_name.trim() &&
            a.bank_name.trim() &&
            a.account_number.trim()
        )
        .map((a, index) => ({
          event_id: eventId,
          label: a.label.trim(),
          holder_name: a.holder_name.trim(),
          bank_name: a.bank_name.trim(),
          account_number: a.account_number.trim(),
          sort_order: index,
          is_active: a.is_active,
        }));

      const { error: deleteError } = await supabase
        .from("event_accounts")
        .delete()
        .eq("event_id", eventId);
      if (deleteError && deleteError.code !== "42P01") throw deleteError;

      if (validAccounts.length > 0) {
        const { error: insertAccountsError } = await supabase
          .from("event_accounts")
          .insert(validAccounts);
        if (insertAccountsError && insertAccountsError.code !== "42P01") {
          throw insertAccountsError;
        }
      }

      setSuccess("이벤트 설정이 저장되었습니다.");
    } catch (e: any) {
      console.error("[ConfirmPage] handleSave error:", e);
      setError(e.message ?? "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p>로딩 중...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6">
        <p>이벤트 정보를 불러올 수 없습니다.</p>
        {error && (
          <p className="mt-2 text-sm text-red-600">상세 오류: {error}</p>
        )}
      </div>
    );
  }

  // 시간 분해
  const [startHourRaw = "", startMinuteRaw = ""] = (
    ceremonyStartTime || ""
  ).split(":");
  const startHour = startHourRaw;
  const startMinute = MINUTES_10.includes(startMinuteRaw)
    ? startMinuteRaw
    : "";

  const [endHourRaw = "", endMinuteRaw = ""] = (
    ceremonyEndTime || ""
  ).split(":");
  const endHour = endHourRaw;
  const endMinute = MINUTES_10.includes(endMinuteRaw) ? endMinuteRaw : "";

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">디지털방명록 세부사항 확정</h1>
        <p className="text-sm text-gray-600">
          예식 시간, 디스플레이 분위기, 축의금 수취 계좌를 설정하면 현장에서
          QR을 스캔한 하객 모바일 화면과 디스플레이 화면에 적용됩니다.
        </p>
      </header>

      {/* 기본 정보 */}
      <section className="border rounded-xl p-4 space-y-3 bg-gray-50">
        <h2 className="text-lg font-semibold">기본 정보</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              신랑
            </label>
            <div className="font-semibold">{event.groom_name || "-"}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              신부
            </label>
            <div className="font-semibold">{event.bride_name || "-"}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              예식장
            </label>
            <div>{event.venue_name || "-"}</div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          신랑/신부 이름은 예약 단계에서 확정되며, 여기서는 수정할 수 없습니다.
        </p>
      </section>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 예식 시간 */}
        <section className="border rounded-xl p-4 space-y-4">
          <h2 className="text-lg font-semibold">예식 시간</h2>

          <p className="text-xs text-gray-500">
            예식 시작 <span className="font-semibold">1시간 전</span>부터 종료{" "}
            <span className="font-semibold">10분 전</span>까지 디지털 방명록
            디스플레이가 재생됩니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                예식 날짜
              </label>
              <input
                type="date"
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={ceremonyDate}
                onChange={(e) => setCeremonyDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                시작 시간
              </label>
              <div className="flex gap-2">
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={startHour}
                  onChange={(e) => {
                    const newHour = e.target.value;
                    const minute = startMinute || "00";
                    if (!newHour) {
                      setCeremonyStartTime("");
                    } else {
                      setCeremonyStartTime(`${newHour}:${minute}`);
                    }
                  }}
                >
                  <option value="">시 선택</option>
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}시
                    </option>
                  ))}
                </select>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={startMinute}
                  onChange={(e) => {
                    const newMinute = e.target.value;
                    const hour = startHour || "00";
                    if (!newMinute) {
                      setCeremonyStartTime("");
                    } else {
                      setCeremonyStartTime(`${hour}:${newMinute}`);
                    }
                  }}
                >
                  <option value="">분 선택</option>
                  {MINUTES_10.map((m) => (
                    <option key={m} value={m}>
                      {m}분
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                예: 13:00 (실제 예식 시작 시간)
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                종료 시간
              </label>
              <div className="flex gap-2">
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={endHour}
                  onChange={(e) => {
                    const newHour = e.target.value;
                    const minute = endMinute || "00";
                    if (!newHour) {
                      setCeremonyEndTime("");
                    } else {
                      setCeremonyEndTime(`${newHour}:${minute}`);
                    }
                  }}
                >
                  <option value="">시 선택</option>
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}시
                    </option>
                  ))}
                </select>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={endMinute}
                  onChange={(e) => {
                    const newMinute = e.target.value;
                    const hour = endHour || "00";
                    if (!newMinute) {
                      setCeremonyEndTime("");
                    } else {
                      setCeremonyEndTime(`${hour}:${newMinute}`);
                    }
                  }}
                >
                  <option value="">분 선택</option>
                  {MINUTES_10.map((m) => (
                    <option key={m} value={m}>
                      {m}분
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                분리 예식(식사를 따로 하는 경우)은 본식 종료 시점을 기준으로
                입력해주세요.
              </p>
            </div>
          </div>
        </section>

        {/* 디스플레이 문구 */}
        <section className="border rounded-xl p-4 space-y-4">
          <h2 className="text-lg font-semibold">디스플레이 문구 설정</h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              상단 타이틀 (title)
            </label>
            <input
              type="text"
              className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
              value={displayTitle}
              readOnly
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              상단 서브 타이틀 (subtitle)
            </label>
            <input
              type="text"
              className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
              value={displaySubtitle}
              readOnly
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              하단 문구 (lower_message)
            </label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm min-h-[60px] bg-gray-50 text-gray-600 cursor-not-allowed"
              value={lowerMessage}
              readOnly
            />
            <p className="text-[10px] text-gray-500 mt-1">
              디스플레이 하단에 고정으로 깔릴 감사 인사 문구입니다.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              디스플레이 배경 분위기
            </label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm min-h-[60px]"
              value={themePrompt}
              onChange={(e) => setThemePrompt(e.target.value)}
            />
            <p className="text-[10px] text-gray-500 mt-1">
              AI가 자동으로 디스플레이 배경을 생성합니다.
            </p>
          </div>
        </section>

        {/* 축의금 계좌 */}
        <section className="border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">축의금 계좌 설정</h2>
            <button
              type="button"
              onClick={addAccount}
              disabled={accounts.length >= MAX_ACCOUNTS}
              className="text-sm px-3 py-1 border rounded-md disabled:opacity-50"
            >
              계좌 추가 ({accounts.length}/{MAX_ACCOUNTS})
            </button>
          </div>

          <p className="text-xs text-gray-500">
            신랑 / 신부 / 양가 부모 등 최대 {MAX_ACCOUNTS}개의 계좌를 등록할 수
            있습니다. QR을 스캔하면 하객이 송금할 계좌를 선택하게 됩니다.
          </p>

          <div className="space-y-4">
            {accounts.map((acct, index) => {
              // 현재 bank_name이 목록 안에 있는지 체크
              const isKnownBank = BANK_OPTIONS.includes(acct.bank_name);
              const selectValue = isKnownBank
                ? acct.bank_name
                : "기타(직접 입력)";

              return (
                <div
                  key={index}
                  className="border rounded-lg p-3 bg-gray-50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-gray-600">
                      계좌 #{index + 1}
                    </div>
                    {accounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAccount(index)}
                        className="text-xs text-red-500"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        구분
                      </label>
                      <select
                        className="w-full border rounded-md px-2 py-1.5 text-xs"
                        value={acct.label}
                        onChange={(e) =>
                          handleAccountChange(index, "label", e.target.value)
                        }
                      >
                        <option value="신랑">신랑</option>
                        <option value="신부">신부</option>
                        <option value="신랑 아버지">신랑 아버지</option>
                        <option value="신랑 어머니">신랑 어머니</option>
                        <option value="신부 아버지">신부 아버지</option>
                        <option value="신부 어머니">신부 어머니</option>
                        <option value="기타">기타</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        예금주
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded-md px-2 py-1.5 text-xs"
                        value={acct.holder_name}
                        onChange={(e) =>
                          handleAccountChange(
                            index,
                            "holder_name",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        은행명
                      </label>
                      <select
                        className="w-full border rounded-md px-2 py-1.5 text-xs mb-1"
                        value={selectValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "기타(직접 입력)") {
                            // 기타 선택 시, 기존 커스텀 값 유지 (없으면 빈 문자열)
                            handleAccountChange(
                              index,
                              "bank_name",
                              isKnownBank ? "" : acct.bank_name
                            );
                          } else {
                            // 정해진 은행 선택 시, 해당 값으로 바로 저장
                            handleAccountChange(index, "bank_name", v);
                          }
                        }}
                      >
                        <option value="">은행 선택</option>
                        {BANK_OPTIONS.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      {/* 기타(직접 입력)일 때만 텍스트 입력 노출 */}
                      {selectValue === "기타(직접 입력)" && (
                        <input
                          type="text"
                          className="w-full border rounded-md px-2 py-1.5 text-xs"
                          placeholder="은행명을 직접 입력해주세요"
                          value={acct.bank_name}
                          onChange={(e) =>
                            handleAccountChange(
                              index,
                              "bank_name",
                              e.target.value
                            )
                          }
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        계좌번호
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded-md px-2 py-1.5 text-xs"
                        value={acct.account_number}
                        onChange={(e) =>
                          handleAccountChange(
                            index,
                            "account_number",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 상태 / 버튼 */}
        <div className="flex flex-col gap-2">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-md">
              {success}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50"
            >
              {saving ? "저장 중..." : "확정하기"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
