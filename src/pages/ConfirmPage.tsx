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

  // ??硫붾え ??젣(?꾨뱶 ?먯껜???좎??????덉뼱??UI?먯꽑 ?ъ슜 ????
  theme_prompt: string | null;

  recipients: any | null;
  display_start_offset_minutes: number | null;
  display_end_offset_minutes: number | null;
  lower_message: string | null;

  display_style?: string | null;
  background_mode?: "photo" | "template" | null;

  // ???ъ쭊/?곸긽 URL??(?쇳빀)
  media_urls?: string[] | null;

  // ??紐⑤컮??泥?꺽??留곹겕
  mobile_invitation_link?: string | null;
};

// ??A?? ????쒓린?(吏곸젒 ?낅젰)???좏깮 ?곹깭瑜?bank_name怨?遺꾨━
type BankMode = "select" | "custom";

type AccountForm = {
  id?: string;
  label: string;
  holder_name: string;
  bank_name: string;
  account_number: string;
  sort_order: number;
  is_active: boolean;

  // ??UI ?꾩슜(?쒕쾭 ???X)
  bank_mode?: BankMode;
};

const MAX_ACCOUNTS = 6;

// ??誘몃뵒???뺤콉
const MAX_MEDIA_TOTAL = 10;
const MAX_VIDEOS = 2;
const MAX_VIDEO_MB = 50;

const DEFAULT_TITLE = "WEDDING MESSAGES";
const DEFAULT_SUBTITLE = "?섍컼 遺꾨뱾??留덉쓬???꾪빐吏怨??덉뼱???뮁";
const DEFAULT_LOWER_MESSAGE = "移쒗엳 ?ㅼ뀛??異뺣났?댁＜?쒖뼱 媛먯궗?⑸땲??";

const DEFAULT_START_OFFSET = -60; // ?덉떇 ?쒖옉 1?쒓컙 ??
const DEFAULT_END_OFFSET = -10; // ?덉떇 醫낅즺 10遺???

const HOURS: string[] = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0")
);
const MINUTES_10: string[] = ["00", "10", "20", "30", "40", "50"];

const DISPLAY_STYLE_OPTIONS = [
  { value: "basic", label: "湲곕낯" },
  { value: "spring", label: "遊? },
  { value: "summer", label: "?щ쫫" },
  { value: "autumn", label: "媛?? },
  { value: "winter", label: "寃⑥슱" },
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
  const u = (url || "").toLowerCase().split("?")[0]; // ??荑쇰━ ?쒓굅
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
  return BANK_OPTIONS.includes(name) && name !== "湲고?(吏곸젒 ?낅젰)";
}

export default function ConfirmPage() {
  const { eventId } = useParams<RouteParams>();
  const navigate = useNavigate();

  async function getMyMemberId(evId: string): Promise<string> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userRes?.user?.id;
  const email = userRes?.user?.email;
  if (!userId && !email) throw new Error("濡쒓렇?몄씠 ?꾩슂?⑸땲??");

  // user_id ?곗꽑, ?놁쑝硫?email濡?fallback
  let q = supabase.from("event_members").select("id").eq("event_id", evId).limit(1);

  if (userId) q = q.eq("user_id", userId);
  else q = q.eq("email", email);

  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("event_members??蹂몄씤 硫ㅻ쾭媛 ?놁뒿?덈떎. (珥덈?/媛???먮쫫 ?뺤씤 ?꾩슂)");
  return data.id as string;
}

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [event, setEvent] = useState<EventRow | null>(null);
  const [settings, setSettings] = useState<EventSettingsRow | null>(null);
  const [accounts, setAccounts] = useState<AccountForm[]>([]);

  // 湲곕낯 ?뺣낫
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

  // ???붿뒪?뚮젅??諛곌꼍?ъ쭊(?쒗뵆由??좏깮 ?쒕쭔 ?ъ슜)
  const [displayStyle, setDisplayStyle] = useState("basic");

  // ??紐⑤컮??泥?꺽??留곹겕 (?꾩닔)
  const [mobileInvitationLink, setMobileInvitationLink] = useState("");

  // 諛곌꼍 紐⑤뱶 & ?낅줈?쒕맂 誘몃뵒??URL ??
  const [backgroundMode, setBackgroundMode] = useState<"template" | "photo">(
    "photo"
  );
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // ?쒗뵆由?誘몃━蹂닿린 濡쒕뱶 ?ㅽ뙣 ?щ?
  const [templatePreviewError, setTemplatePreviewError] = useState(false);

  // ?덉떇??寃??
  const [venueSearchOpen, setVenueSearchOpen] = useState(false);
  const [venueSearchKeyword, setVenueSearchKeyword] = useState("");
  const [venueSearchResults, setVenueSearchResults] = useState<any[]>([]);
  const [venueSearchLoading, setVenueSearchLoading] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    void fetchData(eventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // ???쒗뵆由?誘몃━蹂닿린 URL
  const templatePreviewUrl = useMemo(() => {
    return `/display-templates/${displayStyle}/background.jpg`;
  }, [displayStyle]);

  // displayStyle 諛붾??뚮쭏???먮윭 ?곹깭 珥덇린??
  useEffect(() => {
    setTemplatePreviewError(false);
  }, [displayStyle]);

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

        if (Array.isArray(s.media_urls) && s.media_urls.length > 0)
          setMediaUrls(s.media_urls);
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

     // 3) event_accounts (??蹂몄씤 怨꾩쥖留?
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
            const mode: BankMode =
              bankName && isKnownBankName(bankName) ? "select" : "custom";
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
            label: "?좊옉",
            holder_name: "",
            bank_name: "",
            account_number: "",
            sort_order: 0,
            is_active: true,
            bank_mode: "select",
          },
          {
            label: "?좊?",
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
      setError(e.message ?? "?곗씠?곕? 遺덈윭?ㅻ뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.");
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
        label: "湲고?",
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
    setAccounts((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((acct, i) => ({ ...acct, sort_order: i }))
    );
  }

  function removeMedia(index: number) {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !eventId) return;

    setSaving(true);
    setUploadStatus("?낅줈??以?..");
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
          skipped.push(`"${file.name}" (理쒕? ${MAX_MEDIA_TOTAL}媛?珥덇낵)`);
          continue;
        }

        const isVideo = (file.type || "").startsWith("video/");
        const isImage = (file.type || "").startsWith("image/");

        if (!isVideo && !isImage) {
          skipped.push(`"${file.name}" (吏?먰븯吏 ?딅뒗 ?뚯씪 ?뺤떇)`);
          continue;
        }

        if (isVideo && videoCount >= MAX_VIDEOS) {
          skipped.push(`"${file.name}" (?곸긽? 理쒕? ${MAX_VIDEOS}媛?`);
          continue;
        }

        if (isVideo) {
          const mb = bytesToMB(file.size);
          if (mb > MAX_VIDEO_MB) {
            skipped.push(`"${file.name}" (?곸긽? ?뚯씪??${MAX_VIDEO_MB}MB ?댄븯)`);
            continue;
          }
        }

        const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
        const safeExt =
          ext.replace(/[^a-zA-Z0-9]/g, "") || (isVideo ? "mp4" : "jpg");
        const filename = `${Date.now()}_${i}.${safeExt}`;
        const path = `${eventId}/${filename}`;

        const { error: uploadError } = await supabase.storage
        .from("event-media")
        .upload(path, file, {
          upsert: false,
          contentType: file.type || undefined, // ??以묒슂: video/mp4, image/jpeg ??紐낆떆
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
        setUploadStatus(
          `?낅줈???꾨즺. ?쇰? ?뚯씪? ?쒖쇅?섏뿀?듬땲?? ${skipped.join(", ")}`
        );
      } else {
        setUploadStatus("?낅줈?쒓? ?꾨즺?섏뿀?듬땲?? ?섎떒?먯꽌 誘몃뵒?대? ?뺤씤?댁＜?몄슂.");
      }
    } catch (err: any) {
      console.error("[ConfirmPage] file upload error", err);
      setError(err.message ?? "?낅줈??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?ㅼ떆 ?쒕룄?댁＜?몄슂.");
      setUploadStatus(null);
    } finally {
      setSaving(false);
      e.target.value = "";
    }
  }

  // 移댁뭅???덉떇??寃??
  const runVenueSearch = () => {
    if (!venueSearchKeyword.trim()) return;
    const kakao = (window as any).kakao;
    if (!kakao || !kakao.maps || !kakao.maps.services) {
      alert(
        "移댁뭅??吏???ㅽ겕由쏀듃媛 ?꾩쭅 濡쒕뱶?섏? ?딆븯?듬땲??\n?좎떆 ???덈줈怨좎묠 ???ㅼ떆 ?쒕룄?댁＜?몄슂."
      );
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

  // ???꾩닔媛?寃利?
  const validateBeforeSave = () => {
    if (!mobileInvitationLink.trim()) return "紐⑤컮??泥?꺽??留곹겕???꾩닔?낅땲??";
    if (!isValidUrl(mobileInvitationLink.trim()))
      return "紐⑤컮??泥?꺽??留곹겕媛 ?좏슚??URL ?뺤떇???꾨떃?덈떎.";

    if (!groomName.trim()) return "?좊옉 ?대쫫???낅젰?댁＜?몄슂.";
    if (!brideName.trim()) return "?좊? ?대쫫???낅젰?댁＜?몄슂.";
    if (!venueName.trim()) return "?덉떇?μ쓣 ?좏깮?댁＜?몄슂.";
    if (!venueAddress.trim())
      return "?덉떇??二쇱냼媛 ?꾩슂?⑸땲?? (寃?됱쑝濡??좏깮?댁＜?몄슂.)";

    if (!ceremonyDate) return "?덉떇 ?좎쭨瑜??낅젰?댁＜?몄슂.";
    if (!ceremonyStartTime) return "?덉떇 ?쒖옉 ?쒓컙???좏깮?댁＜?몄슂.";
    if (!ceremonyEndTime) return "?덉떇 醫낅즺 ?쒓컙???좏깮?댁＜?몄슂.";

    if (backgroundMode === "template" && !displayStyle)
      return "?붿뒪?뚮젅??諛곌꼍?ъ쭊???좏깮?댁＜?몄슂.";

    const validAccounts = accounts
      .filter((a) => a.is_active)
      .filter(
        (a) =>
          a.label.trim() &&
          a.holder_name.trim() &&
          a.bank_name.trim() &&
          a.account_number.trim()
      );

    if (validAccounts.length === 0) {
      return "異뺤쓽湲?怨꾩쥖瑜?理쒖냼 1媛??댁긽 ?깅줉?댁＜?몄슂. (援щ텇/?덇툑二????怨꾩쥖踰덊샇 紐⑤몢 ?꾩슂)";
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

      // 1) events ?낅뜲?댄듃
      const eventPayload = {
        groom_name: groomName || null,
        bride_name: brideName || null,
        venue_name: venueName || null,
        venue_address: venueAddress || null,
        venue_lat: venueLat,
        venue_lng: venueLng,
      };

      const { error: eventUpdateError } = await supabase
        .from("events")
        .update(eventPayload)
        .eq("id", eventId);
      if (eventUpdateError) throw eventUpdateError;

      // 2) recipients (?좊옉/?좊?)
      const recipients: any[] = [];
      if (groomName.trim())
        recipients.push({ name: groomName.trim(), role: "?좊옉", contact: null });
      if (brideName.trim())
        recipients.push({ name: brideName.trim(), role: "?좊?", contact: null });

      // 諛곌꼍紐⑤뱶/誘몃뵒??諛곗뿴
      const cleaned = mediaUrls.map((u) => u.trim()).filter(Boolean);
      const isPhotoValid = cleaned.length > 0;

      const modeToSave: "photo" | "template" =
        backgroundMode === "photo" && isPhotoValid ? "photo" : "template";
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

     // 4) 怨꾩쥖 ????꾨? ??젣 ??insert)
        const myMemberId = await getMyMemberId(eventId);

        const validAccounts = accounts
          .filter((a) => a.is_active)
          .filter(
            (a) =>
              a.label.trim() &&
              a.holder_name.trim() &&
              a.bank_name.trim() &&
              a.account_number.trim()
          )
          .map((a, index) => ({
            event_id: eventId,
            owner_member_id: myMemberId, // ???깅줉/?섏젙???щ엺??owner
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
          .eq("owner_member_id", myMemberId); // ????怨꾩쥖留???젣
        if (deleteError && deleteError.code !== "42P01") throw deleteError;

        const { error: insertAccountsError } = await supabase
          .from("event_accounts")
          .insert(validAccounts);
        if (insertAccountsError && insertAccountsError.code !== "42P01")
          throw insertAccountsError;


      // ??????깃났 UX: 臾멸뎄 援먯껜 + ?깃났 諛뺤뒪?먮쭔 CTA ?몄텧
      setSuccess("?ㅼ젙???꾨즺?섏뿀?듬땲?? ?곸꽭?ㅼ젙? ?덉떇 ?쒖옉 1?쒓컙 ?꾧퉴吏 ?섏젙?????덉뼱??");
    } catch (e: any) {
      console.error("[ConfirmPage] handleSave error:", e);
      setError(e.message ?? "???以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p>濡쒕뵫 以?..</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6">
        <p>?대깽???뺣낫瑜?遺덈윭?????놁뒿?덈떎.</p>
        {error && <p className="mt-2 text-sm text-red-600">?곸꽭 ?ㅻ쪟: {error}</p>}
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
      {/* ???곷떒: ?곗륫 留곹겕 + ??댄? */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="text-xs md:text-sm text-gray-500 underline underline-offset-4 hover:text-gray-900 whitespace-nowrap"
          >
            ?대깽????
          </button>

          <button
            type="button"
            onClick={() => navigate(`/app/event/${eventId}/report`)}
            className="text-xs md:text-sm text-gray-500 underline underline-offset-4 hover:text-gray-900 whitespace-nowrap"
          >
            由ы룷??
          </button>
        </div>

        <div>
          <h1 className="text-xl md:text-2xl font-bold">?붿??몃갑紐낅줉 ?몃??ы빆 ?뺤젙</h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">
            ?덉떇 ?쒓컙, ?붿뒪?뚮젅?? 異뺤쓽湲?怨꾩쥖, ?ъ쭊/?곸긽????踰덉뿉 ?ㅼ젙?섎㈃ 寃고샎???뱀씪 ?붿뒪?뚮젅?댁뿉 洹몃?濡??곸슜?⑸땲??
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 紐⑤컮??泥?꺽??*/}
        <section className="bg-white/70 border border-rose-200/70 ring-1 ring-rose-200/40 rounded-2xl p-4 space-y-4 shadow-2xl shadow-rose-200/30 backdrop-blur-xl transition-all hover:border-rose-300/80">
          <h2 className="text-sm md:text-lg font-semibold">紐⑤컮??泥?꺽??/h2>
          <p className="text-[11px] text-gray-500">
            紐⑤컮??泥?꺽??留곹겕???꾩닔?낅땲?? (?덇툑二??ъ쭊 ?깆쓣 理쒖쥌 ?붾툝泥댄겕?섍린 ?꾪븳 ?⑸룄)
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              className="flex-1 border rounded-md px-3 py-2 text-sm"
              placeholder="?? https://m-card.com/your-link"
              value={mobileInvitationLink}
              onChange={(e) => setMobileInvitationLink(e.target.value)}
            />
            <button
              type="button"
              className="sm:w-auto w-full px-3 py-2 text-sm border border-green-300 rounded-full bg-white hover:bg-green-50"
              onClick={() => {
                const v = mobileInvitationLink.trim();
                if (!v) return alert("癒쇱? 紐⑤컮??泥?꺽??留곹겕瑜??낅젰?댁＜?몄슂.");
                if (!isValidUrl(v)) return alert("?좏슚??URL ?뺤떇???꾨떃?덈떎.");
                window.open(v, "_blank", "noopener,noreferrer");
              }}
            >
              留곹겕 ?닿린
            </button>
          </div>
        </section>

        {/* 湲곕낯 ?뺣낫 */}
        <section className="bg-white/70 border border-rose-200/70 ring-1 ring-rose-200/40 rounded-2xl p-4 space-y-4 shadow-2xl shadow-rose-200/30 backdrop-blur-xl transition-all hover:border-rose-300/80">
          <h2 className="text-sm md:text-lg font-semibold">湲곕낯 ?뺣낫</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">?좊옉 ?대쫫</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="?? 源?곕퉰"
                value={groomName}
                onChange={(e) => setGroomName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">?좊? ?대쫫</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="?? ?좊???
                value={brideName}
                onChange={(e) => setBrideName(e.target.value)}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">?덉떇??/label>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  className="sm:w-auto w-full px-3 py-2 text-sm border border-green-300 rounded-full flex items-center justify-center gap-1 bg-white hover:bg-green-50"
                  onClick={() => setVenueSearchOpen(true)}
                >
                  <span>?뱧</span>
                  <span>?덉떇??寃?됲븯湲?/span>
                </button>
                <div className="flex-1 min-h-[40px] border rounded-md px-3 py-2 text-xs bg-white flex flex-col justify-center">
                  {venueName ? (
                    <>
                      <span className="font-medium">{venueName}</span>
                      {venueAddress && <span className="text-[11px] text-gray-500">{venueAddress}</span>}
                    </>
                  ) : (
                    <span className="text-[11px] text-gray-400">?꾩쭅 ?좏깮???덉떇?μ씠 ?놁뒿?덈떎.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-gray-500 mt-1">
            ?ш린?먯꽌 ?낅젰???뺣낫???붿???諛⑸챸濡??붾㈃怨?理쒖쥌 由ы룷?몄뿉 洹몃?濡??ъ슜?⑸땲??
          </p>
        </section>

        {/* ?덉떇 ?쒓컙 */}
        <section className="bg-white/70 border border-rose-200/70 ring-1 ring-rose-200/40 rounded-2xl p-4 space-y-4 shadow-2xl shadow-rose-200/30 backdrop-blur-xl transition-all hover:border-rose-300/80">
          <h2 className="text-sm md:text-lg font-semibold">?덉떇 ?쒓컙</h2>
          <p className="text-[11px] text-gray-500">
            ?덉떇 ?쒖옉 <span className="font-semibold">1?쒓컙 ??/span>遺??醫낅즺{" "}
            <span className="font-semibold">10遺???/span>源뚯? ?붿???諛⑸챸濡??붿뒪?뚮젅?닿? ?ъ깮?⑸땲??
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">?덉떇 ?좎쭨</label>
              <input
                type="date"
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={ceremonyDate}
                onChange={(e) => setCeremonyDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">?쒖옉 ?쒓컙</label>
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
                  <option value="">??/option>
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}??
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
                  <option value="">遺?/option>
                  {MINUTES_10.map((m) => (
                    <option key={m} value={m}>
                      {m}遺?
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">醫낅즺 ?쒓컙</label>
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
                  <option value="">??/option>
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}??
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
                  <option value="">遺?/option>
                  {MINUTES_10.map((m) => (
                    <option key={m} value={m}>
                      {m}遺?
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* ?붿뒪?뚮젅??*/}
        <section className="bg-white/70 border border-rose-200/70 ring-1 ring-rose-200/40 rounded-2xl p-4 space-y-4 shadow-2xl shadow-rose-200/30 backdrop-blur-xl transition-all hover:border-rose-300/80">
          <h2 className="text-sm md:text-lg font-semibold">?붿뒪?뚮젅???붿옄??& ?ъ쭊/?곸긽</h2>

          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-gray-600 mb-1">諛곌꼍 諛⑹떇</label>
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  className="h-4 w-4"
                  value="photo"
                  checked={backgroundMode === "photo"}
                  onChange={() => setBackgroundMode("photo")}
                />
                <span>?좊옉쨌?좊? ?⑤뵫?ъ쭊/?곸긽 ?ъ슜 (異붿쿇)</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  className="h-4 w-4"
                  value="template"
                  checked={backgroundMode === "template"}
                  onChange={() => setBackgroundMode("template")}
                />
                <span>湲곕낯 怨꾩젅?쒗뵆由??ъ슜</span>
              </label>
            </div>

            <p className="text-[11px] text-gray-500">
              ?ъ쭊/?곸긽???щ━硫??좊옉쨌?좊? ?붾㈃ ?꾨줈 異뺥븯 硫붿떆吏媛 ?먯뿰?ㅻ읇寃??쒖떆?⑸땲??
            </p>
          </div>

          {backgroundMode === "photo" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  ?좊옉쨌?좊? ?ъ쭊/?곸긽 ?щ━湲?(?좏깮)
                </label>

                <label className="block">
                  <div className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-white active:scale-[0.99] transition">
                    <span className="text-3xl mb-1">?렄截?/span>
                    <p className="text-sm font-medium text-gray-800">
                      ?몃뱶???⑤쾾?먯꽌 ?ъ쭊/?곸긽 ?좏깮?섍린
                    </p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      ?ъ쭊+?곸긽 ?⑹퀜??理쒕? {MAX_MEDIA_TOTAL}媛쒓퉴吏 ?낅줈?쒗븷 ???덉뼱?? (?곸긽? 理쒕?{" "}
                      {MAX_VIDEOS}媛? ?곸긽 ?뚯씪??{MAX_VIDEO_MB}MB ?댄븯)
                    </p>
                  </div>

                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleFilesSelected}
                    className="hidden"
                  />
                </label>

                {uploadStatus && <p className="text-[11px] text-gray-500">{uploadStatus}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">
                    ?낅줈?쒕맂 誘몃뵒??({mediaUrls.length}/{MAX_MEDIA_TOTAL}) 쨌 ?곸긽 {videoCount}/{MAX_VIDEOS}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    ?쇱そ遺???쒖꽌?濡??ъ깮?⑸땲?? (????젣)
                  </span>
                </div>

                {mediaUrls.length === 0 ? (
                  <div className="border border-dashed border-gray-300 rounded-xl py-4 text-center text-[11px] text-gray-400 bg-white">
                    ?꾩쭅 ?낅줈?쒕맂 誘몃뵒?닿? ?놁뒿?덈떎. ?먰븯?쒕㈃ ??踰꾪듉?쇰줈 異붽??댁＜?몄슂.
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {mediaUrls.map((url, idx) => {
                      const vid = isVideoUrl(url);
                      return (
                        <div
                          key={idx}
                          className="relative flex-shrink-0 w-20 h-28 rounded-lg overflow-hidden border bg-gray-100"
                        >
                          {vid ? (
                            <video
                              src={url}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                              controls                    // ???쒖쁺?곸씠 留욌떎?앸? ?덉쑝濡??뺤씤
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
                            ??
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="text-[11px] text-gray-500">
                  * ?ъ쭊/?곸긽???낅줈?쒗븯吏 ?딆쑝硫? ??????먮룞?쇰줈{" "}
                  <span className="font-semibold">湲곕낯 怨꾩젅 ?쒗뵆由?/span>?쇰줈 ?곸슜?⑸땲??
                </p>
              </div>
            </div>
          )}

          {backgroundMode === "template" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  ?붿뒪?뚮젅??諛곌꼍?ъ쭊
                </label>
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
                  <div className="px-3 py-2 text-[11px] text-gray-500 border-b bg-white">
                    誘몃━蹂닿린
                  </div>
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
                        誘몃━蹂닿린瑜?遺덈윭?????놁뒿?덈떎.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="hidden md:flex justify-end">
                <div className="border rounded-xl overflow-hidden bg-gray-50 w-fit">
                  <div className="px-3 py-2 text-[11px] text-gray-500 border-b bg-white">
                    誘몃━蹂닿린
                  </div>
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
                        誘몃━蹂닿린瑜?遺덈윭?????놁뒿?덈떎.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 異뺤쓽湲?怨꾩쥖 */}
        <section className="bg-white/70 border border-rose-200/70 ring-1 ring-rose-200/40 rounded-2xl p-4 space-y-4 shadow-2xl shadow-rose-200/30 backdrop-blur-xl transition-all hover:border-rose-300/80">
          <div className="flex items-center justify-between">
            <h2 className="text-sm md:text-lg font-semibold">異뺤쓽湲?怨꾩쥖 ?ㅼ젙</h2>
            <button
              type="button"
              onClick={addAccount}
              disabled={accounts.length >= MAX_ACCOUNTS}
              className="text-xs md:text-sm px-3 py-1 border rounded-md disabled:opacity-50"
            >
              怨꾩쥖 異붽? ({accounts.length}/{MAX_ACCOUNTS})
            </button>
          </div>

          <p className="text-[11px] text-gray-500">
            ?좊옉 / ?좊? / ?묎? 遺紐???理쒕? {MAX_ACCOUNTS}媛쒖쓽 怨꾩쥖瑜??깅줉?????덉뒿?덈떎. QR???ㅼ틪?섎㈃ ?섍컼???↔툑??怨꾩쥖瑜?
            ?좏깮?섍쾶 ?⑸땲??
          </p>

          <div className="space-y-4">
            {accounts.map((acct, index) => {
              const bankMode: BankMode =
                acct.bank_mode ??
                (acct.bank_name && isKnownBankName(acct.bank_name) ? "select" : "custom");

              const selectValue =
                bankMode === "custom"
                  ? "湲고?(吏곸젒 ?낅젰)"
                  : acct.bank_name
                  ? acct.bank_name
                  : "";

              return (
                <div key={index} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-gray-600">怨꾩쥖 #{index + 1}</div>
                    {accounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAccount(index)}
                        className="text-[11px] text-red-500"
                      >
                        ??젣
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">援щ텇</label>
                      <select
                        className="w-full border rounded-md px-2 py-1.5 text-xs"
                        value={acct.label}
                        onChange={(e) => handleAccountChange(index, "label", e.target.value)}
                      >
                        <option value="?좊옉">?좊옉</option>
                        <option value="?좊?">?좊?</option>
                        <option value="?좊옉 ?꾨쾭吏">?좊옉 ?꾨쾭吏</option>
                        <option value="?좊옉 ?대㉧??>?좊옉 ?대㉧??/option>
                        <option value="?좊? ?꾨쾭吏">?좊? ?꾨쾭吏</option>
                        <option value="?좊? ?대㉧??>?좊? ?대㉧??/option>
                        <option value="湲고?">湲고?</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">?덇툑二?/label>
                      <input
                        type="text"
                        className="w-full border rounded-md px-2 py-1.5 text-xs"
                        value={acct.holder_name}
                        onChange={(e) => handleAccountChange(index, "holder_name", e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">??됰챸</label>

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

                          if (v === "湲고?(吏곸젒 ?낅젰)") {
                            handleAccountChange(index, "bank_mode", "custom");
                            // bank_name? 吏곸젒 ?낅젰移몄뿉???낅젰
                            return;
                          }

                          // ?쇰컲 ????좏깮
                          handleAccountChange(index, "bank_mode", "select");
                          handleAccountChange(index, "bank_name", v);
                        }}
                      >
                        <option value="">????좏깮</option>
                        {BANK_OPTIONS.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>

                      {/* ??bank_mode === custom?대㈃ 臾댁“嫄?吏곸젒 ?낅젰 移??몄텧 */}
                      {bankMode === "custom" && (
                        <input
                          type="text"
                          className="w-full border rounded-md px-2 py-1.5 text-xs"
                          placeholder="?? ?덈쭏?꾧툑怨? ?좏삊, ?⑥쐞?랁삊 ??
                          value={acct.bank_name}
                          onChange={(e) => handleAccountChange(index, "bank_name", e.target.value)}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">怨꾩쥖踰덊샇</label>
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

        {/* ?곹깭 / 踰꾪듉 */}
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
                    ?대깽???덉쑝濡?
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/app/event/${eventId}/report`)}
                    className="px-3 py-2 rounded-md bg-black text-white text-xs sm:text-sm hover:opacity-90"
                  >
                    由ы룷??蹂닿린
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ???섎떒 ?≪뀡諛? ?뺤젙 ?꾩뿉???쒗솗?뺥븯湲겸앸쭔 */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50"
            >
              {saving ? "???以?.." : "?뺤젙?섍린"}
            </button>
          </div>
        </div>
      </form>

      {/* ?덉떇??寃??紐⑤떖 */}
      {venueSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold">?덉떇??寃??/h3>
              <button
                type="button"
                className="text-sm text-gray-500"
                onClick={() => setVenueSearchOpen(false)}
              >
                ?リ린
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 border rounded-md px-3 py-2 text-sm"
                placeholder="?? ?뗢뿃?⑤뵫?, ?뗢뿃?깅떦"
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
                {venueSearchLoading ? "寃??以?.." : "寃??}
              </button>
            </div>

            <div className="max-h-72 overflow-auto border rounded-lg">
              {venueSearchLoading ? (
                <div className="py-8 text-center text-sm text-gray-500">寃??以묒엯?덈떎??/div>
              ) : venueSearchResults.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  寃??寃곌낵媛 ?놁뒿?덈떎. ?대쫫??議곌툑 ?ㅻⅤ寃??낅젰??蹂댁꽭??
                </div>
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
                        <div className="text-xs text-gray-600">
                          {place.road_address_name || place.address_name}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-[11px] text-gray-400">
              移댁뭅??吏???μ냼 寃?됱쓣 ?댁슜?⑸땲?? 寃??寃곌낵??Kakao?먯꽌 ?쒓났?섎뒗 ?뺣낫???곕씪 ?щ씪吏????덉뒿?덈떎.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


