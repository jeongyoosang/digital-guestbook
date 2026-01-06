import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { CalendarIcon, Lock, MapPin, Search } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

declare global {
  interface Window {
    kakao: any;
  }
}

const KAKAO_APP_KEY = import.meta.env.VITE_KAKAO_JS_APPKEY as string;

const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);

const baseSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요."),
  role: z.enum(["신랑", "신부", "기타"]),
  relation: z.string().optional(),
  phone: z.string().min(10, "연락처를 입력해주세요."),
  dateStatus: z.enum(["confirmed", "tentative"]),
  weddingDate: z.date().optional(),
  weddingTime: z.string().optional(),
  tentativeDate: z.string().optional(),

  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  venueLat: z.number().optional(),
  venueLng: z.number().optional(),
  venueKakaoUrl: z.string().optional(),

  mobileInvitationLink: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().url("유효한 URL을 입력해주세요.").optional()
  ),

  inquiry: z.string().optional(),
  agree: z.literal(true, {
    errorMap: () => ({ message: "개인정보·얼굴 이미지 처리 동의가 필요합니다." }),
  }),
});

const formSchema = baseSchema
  .refine((v) => (v.role !== "기타" ? true : !!v.relation?.trim()), {
    message: "관계를 입력해주세요. (예: 신랑 친구, 신부 사촌 등)",
    path: ["relation"],
  })
  .refine((v) => (v.dateStatus === "confirmed" ? !!v.weddingDate : true), {
    message: "예식일자를 선택해주세요.",
    path: ["weddingDate"],
  })
  .refine(
    (v) => {
      if (v.dateStatus === "confirmed" && v.weddingDate) {
        const d = new Date(v.weddingDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime() >= todayStart.getTime();
      }
      return true;
    },
    {
      message: "과거 날짜는 선택할 수 없습니다.",
      path: ["weddingDate"],
    }
  )
  .refine((v) => (v.dateStatus === "confirmed" ? !!v.venueName?.trim() : true), {
    message: "예식장명을 선택해주세요. (검색 버튼으로 선택)",
    path: ["venueName"],
  })
  .refine(
    (v) => (v.dateStatus === "confirmed" ? !!v.venueAddress?.trim() : true),
    {
      message: "예식장 위치를 선택해주세요. (검색 버튼으로 선택)",
      path: ["venueAddress"],
    }
  );

type FormData = z.infer<typeof formSchema>;

function useKakaoLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!KAKAO_APP_KEY) {
      console.warn("VITE_KAKAO_JS_APPKEY가 설정되지 않았습니다.");
      return;
    }
    if (window.kakao?.maps) {
      setReady(true);
      return;
    }

    const onLoaded = () => {
      try {
        window.kakao.maps.load(() => setReady(true));
      } catch {
        setReady(true);
      }
    };

    const existing = document.getElementById("kakao-jssdk") as HTMLScriptElement | null;
    if (existing) {
      if (existing.getAttribute("data-loaded") === "true") onLoaded();
      else existing.addEventListener("load", onLoaded, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "kakao-jssdk";
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false&libraries=services`;
    script.addEventListener("load", () => {
      script.setAttribute("data-loaded", "true");
      onLoaded();
    });
    document.head.appendChild(script);
  }, []);

  return ready;
}

type Place = {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  place_url: string;
};

type KakaoPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (p: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    kakaoUrl: string;
  }) => void;
};

function KakaoPlacePicker({ open, onClose, onSelect }: KakaoPickerProps) {
  const ready = useKakaoLoader();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [isComposing, setIsComposing] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const doSearch = () => {
    if (!ready || !window.kakao?.maps?.services) return;
    if (!query.trim()) return;

    setLoading(true);
    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(query, (data: Place[], status: string) => {
      setLoading(false);
      if (status !== window.kakao.maps.services.Status.OK) {
        setResults([]);
        toast.error("검색 결과가 없습니다. 다른 키워드로 시도해 주세요.");
        return;
      }
      setResults(data.slice(0, 10));
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-6">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden border border-border/60">
        <div className="p-4 sm:p-5 border-b border-border/60 bg-background/50">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <Search className="w-4 h-4" /> 예식장 장소 검색
          </h3>

          {!KAKAO_APP_KEY && (
            <p className="text-[12px] text-destructive mt-2">
              환경변수 VITE_KAKAO_JS_APPKEY가 설정되지 않아 검색이 동작하지 않습니다.
            </p>
          )}

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!isComposing) doSearch();
            }}
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예: ○○성당 / △△호텔 웨딩홀"
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isComposing) {
                  e.preventDefault();
                  doSearch();
                }
              }}
              className="bg-background border-border/60"
            />
            <Button type="submit" disabled={!ready || !KAKAO_APP_KEY}>
              검색
            </Button>
          </form>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">검색 중…</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              검색 결과가 여기에 표시됩니다.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {results.map((r) => {
                const address = r.road_address_name || r.address_name || "";
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="w-full text-left p-4 hover:bg-foreground/[0.04]"
                      onClick={() => {
                        onSelect({
                          name: r.place_name,
                          address,
                          lat: parseFloat(r.y),
                          lng: parseFloat(r.x),
                          kakaoUrl: r.place_url,
                        });
                        onClose();
                      }}
                    >
                      <div className="font-medium text-foreground">{r.place_name}</div>
                      <div className="text-sm text-muted-foreground">{address}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="p-4 sm:p-5 border-t border-border/60 bg-white/70">
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              닫기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ReservationForm = () => {
  const [date, setDate] = useState<Date>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const successRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { dateStatus: "confirmed", role: "신랑" },
  });

  const dateStatus = watch("dateStatus");
  const role = watch("role");
  const venueName = watch("venueName");
  const venueAddress = watch("venueAddress");

  const timeOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (let h = 9; h <= 20; h++) {
      for (let m of [0, 30]) {
        const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const isAm = h < 12;
        const hour12 = h === 12 ? 12 : isAm ? h : h - 12;
        const label = `${isAm ? "오전" : "오후"} ${hour12}:${String(m).padStart(2, "0")}`;
        out.push({ value, label });
        if (h === 20 && m === 30) break;
      }
    }
    return out;
  }, []);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const phone = (data.phone || "").replace(/[^0-9]/g, "");
      const inquiryOnly = data.inquiry?.trim() || null;

      const { error } = await supabase.from("reservations").insert({
        name: data.name,
        role: data.role,
        relation: data.role === "기타" ? (data.relation || null) : null,
        phone,
        event_date:
          data.dateStatus === "confirmed" && data.weddingDate
            ? format(data.weddingDate, "yyyy-MM-dd")
            : null,
        wedding_time: data.weddingTime || null,
        date_status: data.dateStatus,
        tentative_date: data.dateStatus === "tentative" ? (data.tentativeDate || null) : null,
        venue_name: data.venueName || null,
        venue_address: data.venueAddress || null,
        venue_lat: data.venueLat ?? null,
        venue_lng: data.venueLng ?? null,
        venue_kakao_url: data.venueKakaoUrl || null,
        mobile_invitation_link: data.mobileInvitationLink || null,
        message: inquiryOnly,
        status: "new",
      });

      if (error) throw error;

      toast.success("예약 문의가 접수되었습니다 💌");
      setShowSuccess(true);
      reset();
      setDate(undefined);

      setTimeout(
        () => successRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        50
      );
      (document.activeElement as HTMLElement)?.blur?.();
    } catch (e) {
      console.error(e);
      toast.error("제출 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (showSuccess && successRef.current) {
      requestAnimationFrame(() => {
        successRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [showSuccess]);

  if (showSuccess) {
    return (
      <section ref={successRef} className="py-10 px-1">
        <div className="mx-auto max-w-2xl text-center">
          <div className="bg-white/80 backdrop-blur-xl border border-border/60 shadow-sm p-8 sm:p-10 rounded-3xl">
            <h2 className="text-3xl sm:text-4xl font-semibold mb-3 text-foreground">
              감사합니다 💐
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              문의가 정상 접수되었습니다.
              <br />
              예약 확정 안내와 디지털 방명록 링크는
              <br />
              <span className="font-semibold text-foreground">
                디지털방명록 공식 카카오톡 채널
              </span>
              로 발송됩니다.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 이름 + 역할 + (기타시 관계) */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="name" className="text-foreground/80">
            이름
          </Label>
          <Input id="name" {...register("name")} className="mt-2" />
          {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
        </div>

        {/* ✅ 모바일에서 줄바꿈/깨짐 방지 */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm">
          {["신랑", "신부", "기타"].map((r) => (
            <label key={r} className="flex items-center gap-2 text-foreground/80">
              <input type="radio" value={r} {...register("role")} className="accent-[hsl(var(--accent))]" />
              {r}
            </label>
          ))}
        </div>

        {role === "기타" && (
          <div>
            <Label htmlFor="relation" className="text-foreground/80">
              관계
            </Label>
            <Input
              id="relation"
              placeholder="예: 신랑 친구 / 신부 사촌 / 웨딩플래너"
              {...register("relation")}
              className="mt-2"
            />
            {errors.relation && (
              <p className="text-sm text-destructive mt-1">{errors.relation.message}</p>
            )}
          </div>
        )}
      </div>

      {/* 연락처 */}
      <div>
        <Label htmlFor="phone" className="text-foreground/80">
          연락처
        </Label>
        <Input
          id="phone"
          type="tel"
          inputMode="numeric"
          placeholder="예: 01012345678"
          {...register("phone")}
          className="mt-2"
        />
        <p className="text-sm text-muted-foreground mt-1">하이픈(-) 없이 숫자만 입력해주세요.</p>
        {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>}
      </div>

      {/* 날짜 확정 여부 */}
      <div>
        <Label className="text-foreground/80">결혼 예정일</Label>
        <RadioGroup
          defaultValue="confirmed"
          onValueChange={(value) => {
            if (value === "tentative") {
              setValue("venueName", undefined);
              setValue("venueAddress", undefined);
              setValue("venueLat", undefined);
              setValue("venueLng", undefined);
              setValue("venueKakaoUrl", undefined);
            }
            setValue("dateStatus", value as "confirmed" | "tentative");
          }}
          className="mt-3 space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="confirmed" id="confirmed" />
            <Label htmlFor="confirmed" className="font-normal cursor-pointer text-foreground/80">
              날짜 확정
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="tentative" id="tentative" />
            <Label htmlFor="tentative" className="font-normal cursor-pointer text-foreground/80">
              미정
            </Label>
          </div>
        </RadioGroup>
      </div>

      {dateStatus === "confirmed" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 날짜 */}
            <div>
              <Label className="text-foreground/80">예식일자</Label>
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal mt-2",
                      !date && "text-muted-foreground"
                    )}
                    onClick={() => setDatePopoverOpen(true)}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: ko }) : "날짜 선택"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => {
                      setDate(newDate || undefined);
                      setValue("weddingDate", newDate ?? undefined);
                      setDatePopoverOpen(false);
                    }}
                    disabled={(d) => {
                      const dd = new Date(d);
                      dd.setHours(0, 0, 0, 0);
                      return dd.getTime() < todayStart.getTime();
                    }}
                    fromDate={todayStart}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.weddingDate && (
                <p className="text-sm text-destructive mt-1">{errors.weddingDate.message}</p>
              )}
            </div>

            {/* 시간 */}
            <div>
              <Label className="text-foreground/80">예식 시간</Label>
              <Select onValueChange={(value) => setValue("weddingTime", value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="시간 선택" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 예식장 */}
          <div>
            <Label className="text-foreground/80">예식장</Label>
            <div className="mt-2 grid gap-2">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPickerOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  예식장 검색하기
                </Button>

                {venueName && (
                  <div className="w-full sm:flex-1 sm:min-w-0 rounded-lg border border-border/60 p-3 text-sm bg-white/70 overflow-hidden">
                    <div className="font-medium text-foreground truncate">{venueName}</div>
                    <div className="text-muted-foreground text-xs truncate" title={venueAddress}>
                      {venueAddress}
                    </div>
                  </div>
                )}
              </div>

              {errors.venueName && <p className="text-sm text-destructive">{errors.venueName.message}</p>}
              {errors.venueAddress && (
                <p className="text-sm text-destructive">{errors.venueAddress.message}</p>
              )}
            </div>
          </div>

          {/* 모바일 청첩장 링크 */}
          <div>
            <Label htmlFor="mobileInvitationLink" className="text-foreground/80">
              모바일 청첩장 링크 (선택)
            </Label>
            <Input
              id="mobileInvitationLink"
              placeholder="예: https://m-card.com/your-link"
              {...register("mobileInvitationLink")}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-1">아직 없으시면 비워두셔도 됩니다.</p>
            {errors.mobileInvitationLink && (
              <p className="text-sm text-destructive mt-1">{errors.mobileInvitationLink.message}</p>
            )}
          </div>
        </>
      )}

      {dateStatus === "tentative" && (
        <div>
          <Label htmlFor="tentativeDate" className="text-foreground/80">
            예상 시기 (선택)
          </Label>
          <Input
            id="tentativeDate"
            placeholder="예: 2026년 봄 / 내년 하반기 / 미정"
            {...register("tentativeDate")}
            className="mt-2"
          />
        </div>
      )}

      {/* 문의 */}
      <div>
        <Label htmlFor="inquiry" className="text-foreground/80">
          문의내용 (선택)
        </Label>
        <Textarea
          id="inquiry"
          placeholder="간단히 궁금한 점을 남겨주세요."
          {...register("inquiry")}
          rows={4}
          className="mt-2"
        />
      </div>

      {/* 동의 */}
      <div className="rounded-2xl bg-white/70 border border-border/60 p-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" {...register("agree")} className="mt-1 h-4 w-4 accent-[hsl(var(--accent))]" />
          <span className="text-sm leading-6 text-foreground/80">
            <span className="inline-flex items-center gap-2 font-medium text-foreground">
              <Lock className="w-4 h-4" aria-hidden="true" />
              개인정보 및 얼굴 이미지 처리에 동의합니다.
            </span>
            <br />
            <span className="text-muted-foreground">
              입력하신 정보와 얼굴 이미지는 예약 상담 및 서비스 제공 목적 외에는 사용하지 않으며,
              외부 공유나 마케팅에 활용하지 않습니다. 동의 철회 요청 시 지체 없이 삭제합니다.
            </span>
          </span>
        </label>
        {errors.agree && <p className="text-sm text-destructive mt-2">{errors.agree.message}</p>}
      </div>

      {/* 제출 */}
      <Button type="submit" size="lg" disabled={submitting} className="w-full rounded-full">
        {submitting ? "전송 중..." : "예약 문의 보내기 💌"}
      </Button>

      <KakaoPlacePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(p) => {
          setValue("venueName", p.name, { shouldValidate: true });
          setValue("venueAddress", p.address, { shouldValidate: true });
          setValue("venueLat", p.lat);
          setValue("venueLng", p.lng);
          setValue("venueKakaoUrl", p.kakaoUrl);
        }}
      />
    </form>
  );
};
