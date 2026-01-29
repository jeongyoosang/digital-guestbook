// src/pages/ConfirmPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  venue_address?: string | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
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

  // 테마 메모(프롬프트 전체 저장 — UI에는 사용하지 않음)
  theme_prompt: string | null;

  recipients: any | null;
  display_start_offset_minutes: number | null;
  display_end_offset_minutes: number | null;
  lower_message: string | null;

  display_style?: string | null;
  background_mode?: "photo" | "template" | null;

  // 사진/영상 URL 목록(혼합)
  media_urls?: string[] | null;

  // 모바일 초대장 링크
  mobile_invitation_link?: string | null;
};

// 계좌 입력 방식(직접 입력/선택) 분리
type BankMode = "select" | "custom";

type AccountForm = {
  id?: string;
  label: string;
  holder_name: string;
  bank_name: string;
  account_number: string;
  sort_order: number;
  is_active: boolean;

  // UI 전용(서버 전송 X)
  bank_mode?: BankMode;
};

const MAX_ACCOUNTS = 6;

// 미디어 정책
const MAX_MEDIA_TOTAL = 18; // 사진+영상 합쳐서 최대 18개
const MAX_VIDEOS = 2; // 영상은 최대 2개
const MAX_MEDIA_FILE_MB = 50; // 사진/영상 모두 파일 1개당 50MB 이하

const DEFAULT_TITLE = "WEDDING MESSAGES";
const DEFAULT_SUBTITLE = "소중한 분들의 마음을 전하는 메시지를 남겨주세요";
const DEFAULT_LOWER_MESSAGE = "축하의 메시지를 남겨주셔서 감사합니다";

const DEFAULT_START_OFFSET = -60; // 예식 시작 1시간 전
const DEFAULT_END_OFFSET = -10; // 예식 시작 10분 전

const HOURS: string[] = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0")
);
const MINUTES_10: string[] = ["00", "10", "20", "30", "40", "50"];

const DISPLAY_STYLE_OPTIONS = [
  { value: "basic", label: "기본" },
  { value: "spring", label: "봄" },
  { value: "summer", label: "여름" },
  { value: "autumn", label: "가을" },
  { value: "winter", label: "겨울" },
];

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

function isVideoUrl(url: string) {
  const u = (url || "").toLowerCase().split("?")[0]; // 쿼리 제거
  return (
    u.endsWith(".mp4") ||
    u.endsWith(".mov") ||
    u.endsWith(".m4v") ||
    u.endsWith(".webm") ||
    u.endsWith(".ogg") ||
    u.endsWith(".avi")
  );
}

function countVideosInUrls(urls: string[]) {
  return urls.reduce((acc, u) => (isVideoUrl(u) ? acc + 1 : acc), 0);
}

function bytesToMB(bytes: number) {
  return bytes / (1024 * 1024);
}

function isKnownBankName(name: string) {
  return BANK_OPTIONS.includes(name) && name !== "기타(직접 입력)";
}

function summarizeSkipped(skipped: string[], maxItems = 2) {
  if (!skipped || skipped.length === 0) return null;
  const head = skipped.slice(0, maxItems);
  const rest = skipped.length - head.length;
  return rest > 0 ? `${head.join(", ")} 외 ${rest}개` : head.join(", ");
}

export default function ConfirmPage() {
  const { eventId } = useParams<RouteParams>();
  const navigate = useNavigate();

  async function getMyMemberId(evId: string): Promise<string> {
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = userRes?.user?.id;
    const email = userRes?.user?.email;
    if (!userId && !email) throw new Error("로그인이 필요합니다.");

    let memberId: string | null = null;

    if (userId) {
      const { data, error } = await supabase
        .from("event_members")
        .select("id")
        .eq("event_id", evId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (data?.id) memberId = data.id;
    }

    if (!memberId && email) {
      const { data, error } = await supabase
        .from("event_members")
        .select("id")
        .eq("event_id", evId)
        .eq("email", email)
        .maybeSingle();
      if (error) throw error;
      if (data?.id) memberId = data.id;
    }

    if (!memberId) {
      throw new Error("event_members에 현재 사용자가 없습니다. (초대/멤버 여부 확인 필요)");
    }

    return memberId;
  }

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [event, setEvent] = useState<EventRow | null>(null);
  const [settings, setSettings] = useState<EventSettingsRow | null>(null);
  const [accounts, setAccounts] = useState<AccountForm[]>([]);

  // ✅ 토스트 (짧게, 자동 사라짐)
  const [toast, setToast] = useState<{ type: "info" | "error"; text: string } | null>(null);

  // 기본 정보
  const [groomName, setGroomName] = useState("");
  const [brideName, setBrideName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueLat, setVenueLat] = useState<number | null>(null);
  const [venueLng, setVenueLng] = useState<number | null>(null);

  const [ceremonyDate, setCeremonyDate] = useState("");
  const [ceremonyStartTime, setCeremonyStartTime] = useState("");
  const [ceremonyEndTime, setCeremonyEndTime] = useState("");
  const [displayTitle, setDisplayTitle] = useState(DEFAULT_TITLE);
  const [displaySubtitle, setDisplaySubtitle] = useState(DEFAULT_SUBTITLE);
  const [lowerMessage, setLowerMessage] = useState(DEFAULT_LOWER_MESSAGE);

  // 디스플레이 스타일(템플릿 선택만 사용)
  const [displayStyle, setDisplayStyle] = useState("basic");

  // 모바일 초대장 링크 (필수)
  const [mobileInvitationLink, setMobileInvitationLink] = useState("");

  // 배경 모드 & 업로드된 미디어 URL
  const [backgroundMode, setBackgroundMode] = useState<"template" | "photo">("photo");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // 템플릿 미리보기 로드 실패 여부
  const [templatePreviewError, setTemplatePreviewError] = useState(false);

  // 장소검색
  const [venueSearchOpen, setVenueSearchOpen] = useState(false);
  const [venueSearchKeyword, setVenueSearchKeyword] = useState("");
  const [venueSearchResults, setVenueSearchResults] = useState<any[]>([]);
  const [venueSearchLoading, setVenueSearchLoading] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    void fetchData(eventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // 템플릿 미리보기 URL
  const templatePreviewUrl = useMemo(() => {
    return `/display-templates/${displayStyle}/background.jpg`;
  }, [displayStyle]);

  // displayStyle 변경 시 에러 상태 초기화
  useEffect(() => {
    setTemplatePreviewError(false);
  }, [displayStyle]);

  // ✅ 토스트 자동 닫힘
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function fetchData(id: string) {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1) events
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (eventError) throw eventError;

      let e: EventRow;
      if (!eventData) {
        e = {
          id,
          title: null,
          groom_name: null,
          bride_name: null,
          ceremony_date: null,
          venue_name: null,
          venue_address: null,
          venue_lat: null,
          venue_lng: null,
        };
      } else {
        e = eventData as EventRow;
      }

      setEvent(e);
      setGroomName(e.groom_name ?? "");
      setBrideName(e.bride_name ?? "");
      setVenueName(e.venue_name ?? "");
      setVenueAddress(e.venue_address ?? "");
      setVenueLat(e.venue_lat ?? null);
      setVenueLng(e.venue_lng ?? null);

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
          lower_message,
          display_style,
          background_mode,
          media_urls,
          mobile_invitation_link
        `
        )
        .eq("event_id", id)
        .maybeSingle();
      if (settingsError) throw settingsError;

      if (settingsData) {
        const s = settingsData as EventSettingsRow;
        setSettings(s);

        setCeremonyDate(s.ceremony_date ?? e.ceremony_date ?? "");
        setCeremonyStartTime(s.ceremony_start_time ?? "");
        setCeremonyEndTime(s.ceremony_end_time ?? "");

        setDisplayTitle(s.title ?? DEFAULT_TITLE);
        setDisplaySubtitle(s.subtitle ?? DEFAULT_SUBTITLE);
        setLowerMessage(s.lower_message ?? DEFAULT_LOWER_MESSAGE);

        setDisplayStyle(s.display_style || "basic");

        const mode =
          s.background_mode === "photo" || s.background_mode === "template"
            ? s.background_mode
            : "template";
        setBackgroundMode(mode);

        if (Array.isArray(s.media_urls) && s.media_urls.length > 0) setMediaUrls(s.media_urls);
        else setMediaUrls([]);

        setMobileInvitationLink(s.mobile_invitation_link ?? "");
      } else {
        setCeremonyDate(e.ceremony_date ?? "");
        setCeremonyStartTime("");
        setCeremonyEndTime("");
        setDisplayTitle(DEFAULT_TITLE);
        setDisplaySubtitle(DEFAULT_SUBTITLE);
        setLowerMessage(DEFAULT_LOWER_MESSAGE);
        setDisplayStyle("basic");
        setBackgroundMode("photo");
        setMediaUrls([]);
        setMobileInvitationLink("");
      }

      // 3) event_accounts (본인 계좌만)
      const myMemberId = await getMyMemberId(id);

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
        .eq("event_id", id)
        .eq("owner_member_id", myMemberId)
        .order("sort_order", { ascending: true });

      if (accountError && accountError.code !== "42P01") throw accountError;

      if (accountData && accountData.length > 0) {
        setAccounts(
          accountData.map((row: any) => {
            const bankName = row.bank_name ?? "";
            const mode: BankMode = bankName && isKnownBankName(bankName) ? "select" : "custom";
            return {
              id: row.id,
              label: row.label,
              holder_name: row.holder_name,
              bank_name: bankName,
              account_number: row.account_number,
              sort_order: row.sort_order ?? 0,
              is_active: row.is_active ?? true,
              bank_mode: mode,
            } as AccountForm;
          })
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
            bank_mode: "select",
          },
          {
            label: "신부",
            holder_name: "",
            bank_name: "",
            account_number: "",
            sort_order: 1,
            is_active: true,
            bank_mode: "select",
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

  function handleAccountChange(index: number, field: keyof AccountForm, value: string | boolean) {
    setAccounts((prev) => prev.map((acct, i) => (i === index ? { ...acct, [field]: value } : acct)));
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
        bank_mode: "select",
      },
    ]);
  }

  function removeAccount(index: number) {
    setAccounts((prev) => prev.filter((_, i) => i !== index).map((acct, i) => ({ ...acct, sort_order: i })));
  }

  function removeMedia(index: number) {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !eventId) return;

    setSaving(true);
    setUploadStatus("업로드 중...");
    setError(null);
    setSuccess(null);

    try {
      const current = [...mediaUrls];

      let videoCount = countVideosInUrls(current);
      let totalCount = current.length;

      const skipped: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (totalCount >= MAX_MEDIA_TOTAL) {
          skipped.push(`"${file.name}" (최대 ${MAX_MEDIA_TOTAL}개)`);
          continue;
        }

        const isVideo = (file.type || "").startsWith("video/");
        const isImage = (file.type || "").startsWith("image/");

        if (!isVideo && !isImage) {
          skipped.push(`"${file.name}" (형식)`);
          continue;
        }

        if (isVideo && videoCount >= MAX_VIDEOS) {
          skipped.push(`"${file.name}" (영상 ${MAX_VIDEOS}개)`);
          continue;
        }

        // ✅ 파일 1개당 용량 제한(사진/영상 공통)
        const mb = bytesToMB(file.size);
        if (mb > MAX_MEDIA_FILE_MB) {
          skipped.push(`"${file.name}" (${MAX_MEDIA_FILE_MB}MB+)`);
          continue;
        }

        const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
        const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "") || (isVideo ? "mp4" : "jpg");
        const filename = `${Date.now()}_${i}.${safeExt}`;
        const path = `${eventId}/${filename}`;

        const { error: uploadError } = await supabase.storage.from("event-media").upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
          cacheControl: "3600",
        });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("event-media").getPublicUrl(path);
        if (data?.publicUrl) {
          current.push(data.publicUrl);
          totalCount += 1;
          if (isVideo) videoCount += 1;
        }
      }

      const limited = current.slice(0, MAX_MEDIA_TOTAL);
      setMediaUrls(limited);
      setBackgroundMode("photo");

      if (skipped.length > 0) {
        setUploadStatus("업로드 완료 (일부 제외)");
        const shortMsg = summarizeSkipped(skipped, 2);
        setToast({ type: "info", text: `일부 파일 제외: ${shortMsg}` });
      } else {
        setUploadStatus("업로드 완료");
        setToast({ type: "info", text: "업로드 완료" });
      }
    } catch (err: any) {
      console.error("[ConfirmPage] file upload error", err);
      const msg = err.message ?? "업로드 중 오류가 발생했습니다. 다시 시도해주세요.";
      setError(msg);
      setUploadStatus(null);
      setToast({ type: "error", text: msg });
    } finally {
      setSaving(false);
      e.target.value = "";
    }
  }

  // 카카오 장소 검색
  const runVenueSearch = () => {
    if (!venueSearchKeyword.trim()) return;
    const kakao = (window as any).kakao;
    if (!kakao || !kakao.maps || !kakao.maps.services) {
      alert("카카오 지도 스크립트가 아직 로드되지 않았습니다.\n잠시 후 다시 시도해주세요.");
      return;
    }

    setVenueSearchLoading(true);
    setVenueSearchResults([]);

    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(venueSearchKeyword, (data: any[], status: string) => {
      setVenueSearchLoading(false);
      if (status === kakao.maps.services.Status.OK) setVenueSearchResults(data);
      else setVenueSearchResults([]);
    });
  };

  const handleSelectVenue = (place: any) => {
    setVenueName(place.place_name || "");
    setVenueAddress(place.road_address_name || place.address_name || venueAddress);
    if (place.y && place.x) {
      setVenueLat(Number(place.y));
      setVenueLng(Number(place.x));
    }
    setVenueSearchOpen(false);
  };

  const isValidUrl = (v: string) => {
    try {
      // eslint-disable-next-line no-new
      new URL(v);
      return true;
    } catch {
      return false;
    }
  };

  // 필수값 검증
  const validateBeforeSave = () => {
    if (!mobileInvitationLink.trim()) return "모바일 초대장 링크가 필요합니다.";
    if (!isValidUrl(mobileInvitationLink.trim())) return "모바일 초대장 링크가 유효한 URL 형식이 아닙니다.";

    if (!groomName.trim()) return "신랑 이름을 입력해주세요.";
    if (!brideName.trim()) return "신부 이름을 입력해주세요.";
    if (!venueName.trim()) return "예식장 이름을 입력해주세요.";
    if (!venueAddress.trim()) return "예식장 주소가 필요합니다. (검색을 통해 선택해주세요.)";

    if (!ceremonyDate) return "예식 날짜를 입력해주세요.";
    if (!ceremonyStartTime) return "예식 시작 시간을 선택해주세요.";
    if (!ceremonyEndTime) return "예식 종료 시간을 선택해주세요.";

    if (backgroundMode === "template" && !displayStyle) return "디스플레이 테마를 선택해주세요.";

    const validAccounts = accounts
      .filter((a) => a.is_active)
      .filter((a) => a.label.trim() && a.holder_name.trim() && a.bank_name.trim() && a.account_number.trim());

    if (validAccounts.length === 0) {
      return "축의금 계좌를 최소 1개 이상 등록해주세요. (라벨/예금주/은행/계좌번호 모두 필요)";
    }

    return null;
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!eventId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const msg = validateBeforeSave();
      if (msg) throw new Error(msg);

      const link = mobileInvitationLink.trim();
      const startOffsetNum = DEFAULT_START_OFFSET;
      const endOffsetNum = DEFAULT_END_OFFSET;

      // 1) events 업데이트
      const eventPayload = {
        groom_name: groomName || null,
        bride_name: brideName || null,
        venue_name: venueName || null,
        venue_address: venueAddress || null,
        venue_lat: venueLat,
        venue_lng: venueLng,
      };

      const { error: eventUpdateError } = await supabase.from("events").update(eventPayload).eq("id", eventId);
      if (eventUpdateError) throw eventUpdateError;

      // 2) recipients (신랑/신부)
      const recipients: any[] = [];
      if (groomName.trim()) recipients.push({ name: groomName.trim(), role: "신랑", contact: null });
      if (brideName.trim()) recipients.push({ name: brideName.trim(), role: "신부", contact: null });

      // 배경모드/미디어 배열
      const cleaned = mediaUrls.map((u) => u.trim()).filter(Boolean);
      const isPhotoValid = cleaned.length > 0;

      const modeToSave: "photo" | "template" = backgroundMode === "photo" && isPhotoValid ? "photo" : "template";
      const mediaToSave = modeToSave === "photo" ? cleaned : null;

      const payload = {
        event_id: eventId,
        ceremony_date: ceremonyDate || null,
        ceremony_start_time: ceremonyStartTime || null,
        ceremony_end_time: ceremonyEndTime || null,
        title: displayTitle || null,
        subtitle: displaySubtitle || null,
        theme_prompt: null,
        lower_message: lowerMessage || null,
        display_start_offset_minutes: startOffsetNum,
        display_end_offset_minutes: endOffsetNum,
        display_style: displayStyle || "basic",
        recipients: recipients.length > 0 ? recipients : null,
        background_mode: modeToSave,
        media_urls: mediaToSave,
        mobile_invitation_link: link,
      };

      // 3) event_settings upsert
      if (settings?.id) {
        const { error: updateError } = await supabase.from("event_settings").update(payload).eq("id", settings.id);
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

      // 4) 계좌 저장 (삭제 후 재삽입)
      const myMemberId = await getMyMemberId(eventId);

      const validAccounts = accounts
        .filter((a) => a.is_active)
        .filter((a) => a.label.trim() && a.holder_name.trim() && a.bank_name.trim() && a.account_number.trim())
        .map((a, index) => ({
          event_id: eventId,
          owner_member_id: myMemberId,
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
        .eq("event_id", eventId)
        .eq("owner_member_id", myMemberId);
      if (deleteError && deleteError.code !== "42P01") throw deleteError;

      const { error: insertAccountsError } = await supabase.from("event_accounts").insert(validAccounts);
      if (insertAccountsError && insertAccountsError.code !== "42P01") throw insertAccountsError;

      setSuccess("저장이 완료되었습니다. 상세 설정은 예식 1시간 전까지 변경할 수 있습니다.");
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
        <p>이벤트 정보를 불러오지 못했습니다.</p>
        {error && <p className="mt-2 text-sm text-red-600">상세 오류: {error}</p>}
      </div>
    );
  }

  const [startHourRaw = "", startMinuteRaw = ""] = (ceremonyStartTime || "").split(":");
  const startHour = startHourRaw;
  const startMinute = MINUTES_10.includes(startMinuteRaw) ? startMinuteRaw : "";

  const [endHourRaw = "", endMinuteRaw = ""] = (ceremonyEndTime || "").split(":");
  const endHour = endHourRaw;
  const endMinute = MINUTES_10.includes(endMinuteRaw) ? endMinuteRaw : "";

  const videoCount = countVideosInUrls(mediaUrls);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      {/* ✅ 토스트 */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999]">
          <div
            className={`px-4 py-2 rounded-full text-xs shadow-lg border backdrop-blur bg-white/90 ${
              toast.type === "error" ? "border-red-200 text-red-700" : "border-gray-200 text-gray-700"
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}

      {/* 상단: 우측 링크 + 타이틀 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="text-xs md:text-sm text-gray-500 underline underline-offset-4 hover:text-gray-900 whitespace-nowrap"
          >
            뒤로가기
          </button>

          <button
            type="button"
            onClick={() => navigate(`/app/event/${eventId}/report`)}
            className="text-xs md:text-sm text-gray-500 underline underline-offset-4 hover:text-gray-900 whitespace-nowrap"
          >
            리포트
          </button>
        </div>

        <div>
          <h1 className="text-xl md:text-2xl font-bold">예식 기본 정보 설정</h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">
            예식 시간, 디스플레이(축의금/메시지/사진) 구성이 전광판에 그대로 반영됩니다.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 모바일 초대장 */}
        <section className="bg-white/70 border border-rose-200/70 ring-1 ring-rose-200/40 rounded-2xl p-4 space-y-4 shadow-2xl shadow-rose-200/30 backdrop-blur-xl transition-all hover:border-rose-300/80">
          <h2 className="text-sm md:text-lg font-semibold">모바일 초대장</h2>
          <p className="text-[11px] text-gray-500">모바일 초대장 링크가 필요합니다. (카카오톡 공유용 링크)</p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              className="flex-1 border rounded-md px-3 py-2 text-sm"
              placeholder="예) https://m-card.com/your-link"
              value={mobileInvitationLink}
              onChange={(e) => setMobileInvitationLink(e.target.value)}
            />
            <button
              type="button"
              className="sm:w-auto w-full px-3 py-2 text-sm border border-green-300 rounded-full bg-white hover:bg-green-50"
              onClick={() => {
                const v = mobileInvitationLink.trim();
                if (!v) return alert("먼저 모바일 초대장 링크를 입력해주세요.");
                if (!isValidUrl(v)) return alert("유효한 URL 형식이 아닙니다.");
                window.open(v, "_blank", "noopener,noreferrer");
              }}
            >
              링크 열기
            </button>
          </div>
        </section>

        {/* 기본 정보 */}
        <section className="bg-white/70 border border-rose-200/70 ring-1 ring-rose-200/40 rounded-2xl p-4 space-y-4 shadow-2xl shadow-rose-200/30 backdrop-blur-xl transition-all hover:border-rose-300/80">
          <h2 className="text-sm md:text-lg font-semibold">기본 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">신랑 이름</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="예) 김철수"
                value={groomName}
                onChange={(e) => setGroomName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">신부 이름</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="예) 이영희"
                value={brideName}
                onChange={(e) => setBrideName(e.target.value)}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">예식장</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  className="sm:w-auto w-full px-3 py-2 text-sm border border-green-300 rounded-full flex items-center justify-center gap-1 bg-white hover:bg-green-50"
                  onClick={() => setVenueSearchOpen(true)}
                >
                  <span>검색</span>
                  <span>예식장 검색하기</span>
                </button>
                <div className="flex-1 min-h-[40px] border rounded-md px-3 py-2 text-xs bg-white flex flex-col justify-center">
                  {venueName ? (
                    <>
                      <span className="font-medium">{venueName}</span>
                      {venueAddress && <span className="text-[11px] text-gray-500">{venueAddress}</span>}
                    </>
                  ) : (
                    <span className="text-[11px] text-gray-400">아직 선택된 예식장이 없습니다.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-gray-500 mt-1">여기서 입력한 정보는 전광판과 청첩장 화면에 그대로 반영됩니다.</p>
        </section>

        {/* 예식 시간 */}
        <section className="bg-white/70 border border-rose-200/70 ring-1 ring-rose-200/40 rounded-2xl p-4 space-y-4 shadow-2xl shadow-rose-200/30 backdrop-blur-xl transition-all hover:border-rose-300/80">
          <h2 className="text-sm md:text-lg font-semibold">예식 시간</h2>
          <p className="text-[11px] text-gray-500">
            예식 시작 <span className="font-semibold">1시간 전</span>부터 예식 <span className="font-semibold">10분 전</span>까지
            디스플레이가 활성화됩니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">예식 날짜</label>
              <input
                type="date"
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={ceremonyDate}
                onChange={(e) => setCeremonyDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">예식 시작 시간</label>
              <div className="flex gap-2">
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={startHour}
                  onChange={(e) => {
                    const newHour = e.target.value;
                    const minute = startMinute || "00";
                    setCeremonyStartTime(newHour ? `${newHour}:${minute}` : "");
                  }}
                >
                  <option value="">시간</option>
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
                    setCeremonyStartTime(newMinute ? `${hour}:${newMinute}` : "");
                  }}
                >
                  <option value="">분</option>
                  {MINUTES_10.map((m) => (
                    <option key={m} value={m}>
                      {m}분
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">예식 종료 시간</label>
              <div className="flex gap-2">
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={endHour}
                  onChange={(e) => {
                    const newHour = e.target.value;
                    const minute = endMinute || "00";
                    setCeremonyEndTime(newHour ? `${newHour}:${minute}` : "");
                  }}
                >
                  <option value="">시간</option>
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
                    setCeremonyEndTime(newMinute ? `${hour}:${newMinute}` : "");
                  }}
                >
                  <option value="">분</option>
                  {MINUTES_10.map((m) => (
                    <option key={m} value={m}>
                      {m}분
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* 디스플레이 */}
        <section className="bg-white/70 border border-rose-200/70 ring-1 ring-rose-200/40 rounded-2xl p-4 space-y-4 shadow-2xl shadow-rose-200/30 backdrop-blur-xl transition-all hover:border-rose-300/80">
          <h2 className="text-sm md:text-lg font-semibold">디스플레이 사진/영상/테마</h2>

          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-gray-600 mb-1">표시 방식</label>
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  className="h-4 w-4"
                  value="photo"
                  checked={backgroundMode === "photo"}
                  onChange={() => setBackgroundMode("photo")}
                />
                <span>신랑·신부 웨딩사진/영상 사용 (추천)</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  className="h-4 w-4"
                  value="template"
                  checked={backgroundMode === "template"}
                  onChange={() => setBackgroundMode("template")}
                />
                <span>기본 템플릿 사용</span>
              </label>
            </div>

            <p className="text-[11px] text-gray-500">사진/영상은 전광판에 자동 재생되며 메시지는 위에 오버레이로 표시됩니다.</p>
          </div>

          {backgroundMode === "photo" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">신랑/신부 사진/영상 올리기(권장)</label>

                <label className="block">
                  <div className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-white active:scale-[0.99] transition">
                    <span className="text-xl mb-1">🖼️ 사진 / 🎬 영상</span>
                    <p className="text-sm font-medium text-gray-800">컴퓨터에서 파일 선택하기</p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      사진+영상 합쳐서 최대 {MAX_MEDIA_TOTAL}개까지 업로드할 수 있어요. (영상은 최대 {MAX_VIDEOS}개)
                      <br />
                      파일 1개당 {MAX_MEDIA_FILE_MB}MB 이하만 지원합니다. (긴 영상은 용량 때문에 업로드가 제한될 수 있어요)
                    </p>
                  </div>

                  <input type="file" accept="image/*,video/*" multiple onChange={handleFilesSelected} className="hidden" />
                </label>

                {uploadStatus && <p className="text-[11px] text-gray-500">{uploadStatus}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">
                    업로드 미디어({mediaUrls.length}/{MAX_MEDIA_TOTAL}) / 영상 {videoCount}/{MAX_VIDEOS}
                  </span>
                  <span className="text-[11px] text-gray-500">업로드한 순서대로 자동 재생됩니다.</span>
                </div>

                {mediaUrls.length === 0 ? (
                  <div className="border border-dashed border-gray-300 rounded-xl py-4 text-center text-[11px] text-gray-400 bg-white">
                    아직 업로드된 미디어가 없습니다. 필요하면 위 버튼으로 추가해주세요.
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {mediaUrls.map((url, idx) => {
                      const vid = isVideoUrl(url);
                      return (
                        <div key={idx} className="relative flex-shrink-0 w-20 h-28 rounded-lg overflow-hidden border bg-gray-100">
                          {vid ? (
                            <video
                              src={url}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                              controls
                              controlsList="nodownload noplaybackrate noremoteplayback"
                            />
                          ) : (
                            <img src={url} className="w-full h-full object-cover" />
                          )}

                          <div className="absolute left-1 bottom-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px]">
                            {vid ? "VIDEO" : "PHOTO"}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeMedia(idx)}
                            className="absolute top-1 right-1 bg-black/75 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center shadow"
                          >
                            X
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="text-[11px] text-gray-500">
                  * 사진/영상이 없으면 자동으로 <span className="font-semibold">기본 템플릿</span>이 적용됩니다.
                </p>
              </div>
            </div>
          )}

          {backgroundMode === "template" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">디스플레이 테마</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={displayStyle}
                  onChange={(e) => setDisplayStyle(e.target.value)}
                >
                  {DISPLAY_STYLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <div className="md:hidden border rounded-xl overflow-hidden bg-gray-50">
                  <div className="px-3 py-2 text-[11px] text-gray-500 border-b bg-white">미리보기</div>
                  <div className="p-3 flex justify-center">
                    {!templatePreviewError ? (
                      <div className="w-[220px] aspect-[9/16] rounded-xl overflow-hidden border bg-white shadow">
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <img
                          src={templatePreviewUrl}
                          className="w-full h-full object-cover"
                          onError={() => setTemplatePreviewError(true)}
                        />
                      </div>
                    ) : (
                      <div className="w-[220px] aspect-[9/16] rounded-xl border bg-white flex items-center justify-center text-xs text-gray-500">
                        미리보기를 불러오지 못했습니다.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="hidden md:flex justify-end">
                <div className="border rounded-xl overflow-hidden bg-gray-50 w-fit">
                  <div className="px-3 py-2 text-[11px] text-gray-500 border-b bg-white">미리보기</div>
                  <div className="p-3 flex justify-center">
                    {!templatePreviewError ? (
                      <div className="w-[260px] aspect-[9/16] rounded-xl overflow-hidden border bg-white shadow">
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <img
                          src={templatePreviewUrl}
                          className="w-full h-full object-cover"
                          onError={() => setTemplatePreviewError(true)}
                        />
                      </div>
                    ) : (
                      <div className="w-[260px] aspect-[9/16] rounded-xl border bg-white flex items-center justify-center text-xs text-gray-500">
                        미리보기를 불러오지 못했습니다.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 축의금 계좌 */}
        <section className="bg-white/70 border border-rose-200/70 ring-1 ring-rose-200/40 rounded-2xl p-4 space-y-4 shadow-2xl shadow-rose-200/30 backdrop-blur-xl transition-all hover:border-rose-300/80">
          <div className="flex items-center justify-between">
            <h2 className="text-sm md:text-lg font-semibold">축의금 계좌 설정</h2>
            <button
              type="button"
              onClick={addAccount}
              disabled={accounts.length >= MAX_ACCOUNTS}
              className="text-xs md:text-sm px-3 py-1 border rounded-md disabled:opacity-50"
            >
              계좌 추가 ({accounts.length}/{MAX_ACCOUNTS})
            </button>
          </div>

          <p className="text-[11px] text-gray-500">
            신랑 / 신부 / 부모님 포함 최대 {MAX_ACCOUNTS}개의 계좌를 등록할 수 있습니다. QR을 스캔하면 하객이 송금할 계좌를
            선택하게 됩니다.
          </p>

          <div className="space-y-4">
            {accounts.map((acct, index) => {
              const bankMode: BankMode =
                acct.bank_mode ?? (acct.bank_name && isKnownBankName(acct.bank_name) ? "select" : "custom");

              const selectValue = bankMode === "custom" ? "기타(직접 입력)" : acct.bank_name ? acct.bank_name : "";

              return (
                <div key={index} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-gray-600">계좌 #{index + 1}</div>
                    {accounts.length > 1 && (
                      <button type="button" onClick={() => removeAccount(index)} className="text-[11px] text-red-500">
                        삭제
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">관계</label>
                      <select
                        className="w-full border rounded-md px-2 py-1.5 text-xs"
                        value={acct.label}
                        onChange={(e) => handleAccountChange(index, "label", e.target.value)}
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
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">예금주</label>
                      <input
                        type="text"
                        className="w-full border rounded-md px-2 py-1.5 text-xs"
                        value={acct.holder_name}
                        onChange={(e) => handleAccountChange(index, "holder_name", e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">은행</label>

                      <select
                        className="w-full border rounded-md px-2 py-1.5 text-xs mb-1"
                        value={selectValue}
                        onChange={(e) => {
                          const v = e.target.value;

                          if (v === "") {
                            handleAccountChange(index, "bank_mode", "select");
                            handleAccountChange(index, "bank_name", "");
                            return;
                          }

                          if (v === "기타(직접 입력)") {
                            handleAccountChange(index, "bank_mode", "custom");
                            return;
                          }

                          handleAccountChange(index, "bank_mode", "select");
                          handleAccountChange(index, "bank_name", v);
                        }}
                      >
                        <option value="">은행 선택</option>
                        {BANK_OPTIONS.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>

                      {bankMode === "custom" && (
                        <input
                          type="text"
                          className="w-full border rounded-md px-2 py-1.5 text-xs"
                          placeholder="예) 새마을금고 등"
                          value={acct.bank_name}
                          onChange={(e) => handleAccountChange(index, "bank_name", e.target.value)}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">계좌번호</label>
                      <input
                        type="text"
                        className="w-full border rounded-md px-2 py-1.5 text-xs"
                        value={acct.account_number}
                        onChange={(e) => handleAccountChange(index, "account_number", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 에러 / 성공 */}
        <div className="flex flex-col gap-2">
          {error && (
            <div className="text-xs md:text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="text-xs md:text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-md">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span>{success}</span>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => navigate("/app")}
                    className="px-3 py-2 rounded-md bg-white border text-xs sm:text-sm hover:bg-gray-50"
                  >
                    이벤트로 이동
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/app/event/${eventId}/report`)}
                    className="px-3 py-2 rounded-md bg-black text-white text-xs sm:text-sm hover:opacity-90"
                  >
                    리포트 보기
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50">
              {saving ? "저장 중..." : "저장하기"}
            </button>
          </div>
        </div>
      </form>

      {/* 예식장 검색 모달 */}
      {venueSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold">예식장 검색</h3>
              <button type="button" className="text-sm text-gray-500" onClick={() => setVenueSearchOpen(false)}>
                닫기
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 border rounded-md px-3 py-2 text-sm"
                placeholder="예) 삼성동웨딩홀, 삼성동컨벤션"
                value={venueSearchKeyword}
                onChange={(e) => setVenueSearchKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runVenueSearch();
                  }
                }}
              />
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md bg-black text-white"
                onClick={runVenueSearch}
                disabled={venueSearchLoading}
              >
                {venueSearchLoading ? "검색 중..." : "검색"}
              </button>
            </div>

            <div className="max-h-72 overflow-auto border rounded-lg">
              {venueSearchLoading ? (
                <div className="py-8 text-center text-sm text-gray-500">검색 중입니다.</div>
              ) : venueSearchResults.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">검색 결과가 없습니다. 이름을 조금 다르게 입력해보세요.</div>
              ) : (
                <ul className="divide-y">
                  {venueSearchResults.map((place) => (
                    <li key={place.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => handleSelectVenue(place)}
                      >
                        <div className="font-medium">{place.place_name}</div>
                        <div className="text-xs text-gray-600">{place.road_address_name || place.address_name}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-[11px] text-gray-400">
              카카오 지도 주소 검색을 이용합니다. 검색 결과는 Kakao에서 제공하는 정보를 사용합니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
