import { useState } from "react";
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
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const formSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요.").max(100),
  phone: z.string().min(1, "연락처를 입력해주세요."),
  dateStatus: z.enum(["confirmed", "tentative"]),
  weddingDate: z.date().optional(),
  weddingTime: z.string().optional(),
  tentativeDate: z.string().optional(),
  venueName: z.string().min(1, "예식장명을 입력해주세요."),
  venueLocation: z.string().min(1, "예식장 위치를 입력해주세요."),
  inquiry: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export const ReservationForm = () => {
  const [showSuccess, setShowSuccess] = useState(false);
  const [date, setDate] = useState<Date>();
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dateStatus: "confirmed"
    }
  });

  const dateStatus = watch("dateStatus");

  const onSubmit = (data: FormData) => {
    console.log("Form submitted:", data);
    setShowSuccess(true);
    toast.success("예약 신청이 접수되었습니다 💍");
  };

  if (showSuccess) {
    return (
      <section id="reservation" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-2xl text-center">
          <div className="bg-card p-12 rounded-3xl shadow-xl">
            <h2 className="text-4xl font-bold mb-6">감사합니다 💍</h2>
            <p className="text-xl mb-4">상담 신청이 접수되었습니다.</p>
            <p className="text-muted-foreground">순차적으로 연락드리겠습니다.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="reservation" className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-2xl">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">예약 문의</h2>
        <p className="text-center text-muted-foreground mb-12">
          예식 일정과 장소, 서비스 구성을 남겨주시면 순차적으로 연락드리겠습니다.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-card p-8 rounded-3xl shadow-xl space-y-6">
          <div>
            <Label htmlFor="name">이름</Label>
            <Input id="name" {...register("name")} className="mt-2" />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <Label htmlFor="phone">연락처</Label>
            <Input id="phone" type="tel" {...register("phone")} className="mt-2" />
            {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>}
          </div>

          <div>
            <Label>결혼 예정일</Label>
            <RadioGroup 
              defaultValue="confirmed" 
              onValueChange={(value) => setValue("dateStatus", value as "confirmed" | "tentative")}
              className="mt-2 space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="confirmed" id="confirmed" />
                <Label htmlFor="confirmed" className="font-normal cursor-pointer">날짜 확정</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tentative" id="tentative" />
                <Label htmlFor="tentative" className="font-normal cursor-pointer">미정</Label>
              </div>
            </RadioGroup>
          </div>

          {dateStatus === "confirmed" ? (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>날짜</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-2",
                        !date && "text-muted-foreground"
                      )}
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
                        setDate(newDate);
                        setValue("weddingDate", newDate);
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="time">시간</Label>
                <Select onValueChange={(value) => setValue("weddingTime", value)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="시간 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="11:00">오전 11:00</SelectItem>
                    <SelectItem value="12:00">오후 12:00</SelectItem>
                    <SelectItem value="13:00">오후 1:00</SelectItem>
                    <SelectItem value="14:00">오후 2:00</SelectItem>
                    <SelectItem value="15:00">오후 3:00</SelectItem>
                    <SelectItem value="16:00">오후 4:00</SelectItem>
                    <SelectItem value="17:00">오후 5:00</SelectItem>
                    <SelectItem value="18:00">오후 6:00</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="tentativeDate">예상 시기</Label>
              <Input 
                id="tentativeDate" 
                placeholder="예: 2026년 봄 / 내년 하반기 / 아직 예식장 탐색 중" 
                {...register("tentativeDate")}
                className="mt-2"
              />
            </div>
          )}

          <div>
            <Label htmlFor="venueName">예식장명</Label>
            <Input id="venueName" {...register("venueName")} className="mt-2" />
            {errors.venueName && <p className="text-sm text-destructive mt-1">{errors.venueName.message}</p>}
          </div>

          <div>
            <Label htmlFor="venueLocation">예식장 위치 또는 주소</Label>
            <Input id="venueLocation" {...register("venueLocation")} className="mt-2" />
            {errors.venueLocation && <p className="text-sm text-destructive mt-1">{errors.venueLocation.message}</p>}
          </div>

          <div>
            <Label htmlFor="inquiry">문의내용 (선택)</Label>
            <Textarea id="inquiry" {...register("inquiry")} rows={4} className="mt-2" />
          </div>

          <Button type="submit" size="lg" className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground">
            예약 신청하기 💐
          </Button>
        </form>
      </div>
    </section>
  );
};