// src/pages/ConfirmPage.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface RouteParams {
  eventId: string;
}

type EventRow = {
  id: string;
  groom_name?: string | null;
  bride_name?: string | null;
  ceremony_date?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
};

type EventSettingsRow = {
  id: string;
  event_id: string;
  ceremony_date: string | null;
  ceremony_start_time: string | null;
  ceremony_end_time: string | null;
  title: string | null;
  subtitle: string | null;
  recipients: any | null;
  display_start_offset_minutes: number | null;
  display_end_offset_minutes: number | null;
  lower_message: string | null;
  display_style?: string | null;
  background_mode?: "photo" | "template" | null;
  media_urls?: string[] | null;
  mobile_invitation_link?: string | null;
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
const HOURS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0")
);
const MINUTES_10 = ["00", "10", "20", "30", "40", "50"];

const DISPLAY_STYLE_OPTIONS = [
  { value: "basic", label: "베이직" },
  { value: "christmas", label: "크리스마스 에디션" },
  { value: "garden", label: "야외 가든 웨딩" },
  { value: "luxury", label: "럭셔리 호텔" },
];

const BANK_OPTIONS = [
  "국민은행",
  "신한은행",
  "우리은행",
  "하나은행",
  "NH농협은행",
  "카카오뱅크",
  "토스뱅크",
  "기타(직접 입력)",
];

export default function ConfirmPage() {
  const { eventId } = useParams<RouteParams>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [event, setEvent] = useState<EventRow | null>(null);
  const [settings, setSettings] = useState<EventSettingsRow | null>(null);
  const [accounts, setAccounts] = useState<AccountForm[]>([]);

  const [groomName, setGroomName] = useState("");
  const [brideName, setBrideName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [ceremonyDate, setCeremonyDate] = useState("");
  const [ceremonyStartTime, setCeremonyStartTime] = useState("");
  const [ceremonyEndTime, setCeremonyEndTime] = useState("");

  const [backgroundMode, setBackgroundMode] =
    useState<"photo" | "template">("photo");
  const [displayStyle, setDisplayStyle] = useState("basic");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [mobileInvitationLink, setMobileInvitationLink] = useState("");

  useEffect(() => {
    if (!eventId) return;
    fetchData();
  }, [eventId]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: e } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .maybeSingle();

      if (e) {
        setEvent(e);
        setGroomName(e.groom_name ?? "");
        setBrideName(e.bride_name ?? "");
        setVenueName(e.venue_name ?? "");
        setVenueAddress(e.venue_address ?? "");
        setCeremonyDate(e.ceremony_date ?? "");
      }

      const { data: s } = await supabase
        .from("event_settings")
        .select("*")
        .eq("event_id", eventId)
        .maybeSingle();

      if (s) {
        setSettings(s);
        setCeremonyStartTime(s.ceremony_start_time ?? "");
        setCeremonyEndTime(s.ceremony_end_time ?? "");
        setBackgroundMode(s.background_mode ?? "photo");
        setDisplayStyle(s.display_style ?? "basic");
        setPhotoUrls(s.media_urls ?? []);
        setMobileInvitationLink(s.mobile_invitation_link ?? "");
      }

      const { data: acc } = await supabase
        .from("event_accounts")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order");

      setAccounts(
        acc?.length
          ? acc
          : [
              {
                label: "신랑",
                holder_name: "",
                bank_name: "",
                account_number: "",
                sort_order: 0,
                is_active: true,
              },
            ]
      );
    } catch (e: any) {
      setError("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function isValid() {
    if (
      !groomName ||
      !brideName ||
      !ceremonyDate ||
      !ceremonyStartTime ||
      !ceremonyEndTime
    )
      return false;

    const validAccounts = accounts.filter(
      (a) =>
        a.label && a.holder_name && a.bank_name && a.account_number
    );
    return validAccounts.length > 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid()) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await supabase.from("events").update({
        groom_name: groomName,
        bride_name: brideName,
        venue_name: venueName,
        venue_address: venueAddress,
        ceremony_date: ceremonyDate,
      }).eq("id", eventId);

      await supabase.from("event_settings").upsert({
        event_id: eventId,
        ceremony_start_time: ceremonyStartTime,
        ceremony_end_time: ceremonyEndTime,
        background_mode: backgroundMode,
        display_style: displayStyle,
        media_urls: backgroundMode === "photo" ? photoUrls : null,
        mobile_invitation_link: mobileInvitationLink,
      });

      await supabase.from("event_accounts").delete().eq("event_id", eventId);
      await supabase.from("event_accounts").insert(
        accounts
          .filter(
            (a) =>
              a.label &&
              a.holder_name &&
              a.bank_name &&
              a.account_number
          )
          .map((a, i) => ({ ...a, event_id: eventId, sort_order: i }))
      );

      setSuccess("저장되었습니다.");
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">로딩 중…</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <button
        className="text-sm underline"
        onClick={() => navigate(`/app/event/${eventId}`)}
      >
        ← 이벤트 홈
      </button>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 기본 정보 */}
        <section className="border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold">기본 정보</h2>
          <input
            placeholder="신랑 이름"
            className="w-full border p-2"
            value={groomName}
            onChange={(e) => setGroomName(e.target.value)}
          />
          <input
            placeholder="신부 이름"
            className="w-full border p-2"
            value={brideName}
            onChange={(e) => setBrideName(e.target.value)}
          />
        </section>

        {/* 예식 시간 */}
        <section className="border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold">예식 시간</h2>
          <input
            type="date"
            className="border p-2"
            value={ceremonyDate}
            onChange={(e) => setCeremonyDate(e.target.value)}
          />
        </section>

        {/* 디스플레이 */}
        <section className="border rounded-xl p-4 space-y-4">
          <h2 className="font-semibold">디스플레이</h2>

          <label>
            <input
              type="radio"
              checked={backgroundMode === "photo"}
              onChange={() => setBackgroundMode("photo")}
            />{" "}
            신랑·신부 웨딩사진 사용 (추천)
          </label>

          <label>
            <input
              type="radio"
              checked={backgroundMode === "template"}
              onChange={() => setBackgroundMode("template")}
            />{" "}
            기본 템플릿 사용
          </label>

          {backgroundMode === "template" && (
            <select
              className="border p-2"
              value={displayStyle}
              onChange={(e) => setDisplayStyle(e.target.value)}
            >
              {DISPLAY_STYLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </section>

        {/* 계좌 */}
        <section className="border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold">축의금 계좌 (최소 1개 필수)</h2>
          {accounts.map((a, i) => (
            <input
              key={i}
              placeholder="계좌번호"
              className="w-full border p-2"
              value={a.account_number}
              onChange={(e) =>
                setAccounts((prev) =>
                  prev.map((x, idx) =>
                    idx === i
                      ? { ...x, account_number: e.target.value }
                      : x
                  )
                )
              }
            />
          ))}
        </section>

        {error && <div className="text-red-500 text-sm">{error}</div>}
        {success && <div className="text-green-600 text-sm">{success}</div>}

        <button
          disabled={saving}
          className="bg-black text-white px-4 py-2 rounded"
        >
          {saving ? "저장 중…" : "확정하기"}
        </button>
      </form>
    </div>
  );
}
