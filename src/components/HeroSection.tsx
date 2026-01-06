import { motion } from "framer-motion";
import { FileText, QrCode, Sparkles } from "lucide-react";

type Props = {
  onPrimaryClick?: () => void;
};

function FlowDiagramMini() {
  // ✅ 노란색 친 영역만 “작고 깔끔하게” 유지
  // - 라인 애니메이션/화려함 제거
  // - 카드 크기/여백 최소화
  // - 모바일에서도 안 깨지게
  return (
    <div className="mt-6 w-full max-w-xl">
      <div className="rounded-2xl border border-border/50 bg-background/70 p-4 backdrop-blur">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center md:gap-4">
          {/* left stack */}
          <div className="grid gap-2">
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/80 px-3 py-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-foreground/5">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">축하 메시지</p>
                <p className="text-xs text-muted-foreground">QR로 한 번에 수집</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/80 px-3 py-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-foreground/5">
                <QrCode className="h-4.5 w-4.5" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">현장 참석 방명록</p>
                <p className="text-xs text-muted-foreground">누가 왔는지 깔끔하게</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/80 px-3 py-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-foreground/5">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">축의금</p>
                <p className="text-xs text-muted-foreground">장부 형태로 정리</p>
              </div>
            </div>
          </div>

          {/* right report */}
          <div className="md:pl-2">
            <div className="rounded-2xl border border-border/60 bg-foreground/5 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-background">
                  <FileText className="h-4.5 w-4.5" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">웨딩 리포트</p>
                  <p className="text-xs text-muted-foreground">
                    메시지 · 방명록 · 축의금
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                예식이 끝나는 순간<br />
                자동으로 한 번에 정리돼요.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeroSection({ onPrimaryClick }: Props) {
  return (
    <section className="relative overflow-hidden">
      {/* ✅ 배경은 과해 보이면 지금처럼 “부드럽게”만 유지 */}
      <div className="absolute inset-0 dg-animated-gradient opacity-[0.22]" />
      <div className="absolute inset-0 dg-grain opacity-[0.08]" />
      <div className="absolute bottom-0 left-0 right-0 h-24 dg-fade-bottom" />

      <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-10 md:pt-20 md:pb-14">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
          {/* LEFT (✅ 이전처럼 심플) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            {/* ✅ 로고처럼: pill 제거 유지 */}
            <div className="mb-5 flex items-baseline gap-3">
              <span className="text-[18px] md:text-[20px] font-extrabold tracking-tight">
                Digital Guestbook
              </span>
              <span className="text-sm text-muted-foreground">디지털 방명록</span>
            </div>

            {/* ✅ 헤드라인 (지금 버전 유지하되, 줄바꿈/크기만 안정적으로) */}
            <h1 className="text-[42px] leading-[1.06] tracking-tight md:text-[54px]">
              예식 끝나는 순간,
              <br />
              <span className="wedding-gradient font-extrabold">
                리포트가 완성됩니다.
              </span>
            </h1>

            {/* ✅ 상세설명은 짧고 강하게 */}
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground md:text-[16px]">
              하객은 QR로 축하 메시지를 남기고,
              <br />
              예식이 끝나면{" "}
              <span className="font-semibold text-foreground">
                방명록·축의금까지 한 번에
              </span>{" "}
              <span className="font-semibold text-foreground">즉시</span>{" "}
              정리된 리포트를 받아보세요.
            </p>

            {/* ✅ 노란색 친 부분만 “남겨두기” */}
            <FlowDiagramMini />

            {/* ✅ CTA (이전처럼 1개만) */}
            <div className="mt-7 flex items-center gap-3">
              <button
                onClick={onPrimaryClick}
                className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-sm font-semibold text-background shadow-sm transition hover:opacity-90"
              >
                예약문의 하기
              </button>

              {/* 이 링크는 유지해도 되고 빼도 됨. 일단 “텍스트 링크” 정도만 */}
              <a
                href="#details"
                className="text-sm font-semibold text-foreground/80 underline underline-offset-4 hover:text-foreground"
              >
                자세히 알아보기
              </a>
            </div>
          </motion.div>

          {/* RIGHT (✅ 이미지 카드/배지 전부 제거, 원형만) */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="relative mx-auto w-full max-w-[640px]"
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-full border border-border/50 bg-background/30 shadow-[0_30px_80px_rgba(15,23,42,0.16)]">
              <img
                src="/landing-poster.jpg"
                alt="Wedding report preview"
                className="h-full w-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/20" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
