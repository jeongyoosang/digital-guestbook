// src/pages/ServiceFlowPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReducedMotion } from "framer-motion";

import Footer from "@/components/Footer";

type FlowNode =
  | "reserve"
  | "setup"
  | "guest"
  | "message"
  | "guestbook"
  | "gift"
  | "qr"
  | "report"
  | "couple"
  | "ticket" // 준비중(점선)
  | "thanks"; // 준비중(점선)

function useInViewIds(ids: string[], rootMargin = "-40% 0px -55% 0px") {
  const [activeId, setActiveId] = useState<string>(ids[0] ?? "");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (!elements.length) return;

    observerRef.current?.disconnect();

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0));

        if (visible[0]?.target?.id) setActiveId(visible[0].target.id);
      },
      { root: null, threshold: [0.12, 0.2, 0.35, 0.5], rootMargin }
    );

    elements.forEach((el) => obs.observe(el));
    observerRef.current = obs;

    return () => obs.disconnect();
  }, [ids, rootMargin]);

  return activeId;
}

/** Stripe/Bridge 느낌: 미니멀 박스 + 얇은 라인 + 점선(준비중) */
function FlowDiagram({ active }: { active: FlowNode }) {
  const reduceMotion = useReducedMotion();
  const on = (n: FlowNode) => active === n;

  const card =
    "rounded-3xl border border-border/60 bg-white/65 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.10)]";

  const nodeBase =
    "relative rounded-2xl border px-4 py-3 text-[13px] font-semibold transition select-none";
  const nodeMuted = "bg-white/70 border-border/60 text-foreground/85";
  const nodeHot = reduceMotion
    ? "ring-2 ring-foreground/12"
    : "ring-2 ring-foreground/12 shadow-[0_16px_34px_rgba(15,23,42,0.14)] -translate-y-[1px]";

  const dashedNode = "bg-white/55 border-dashed border-border/70 text-foreground/65";

  const nodeCls = (id: FlowNode, extra?: string) =>
    `${nodeBase} ${extra ?? nodeMuted} ${on(id) ? nodeHot : "opacity-90"}`;

  const pill =
    "inline-flex items-center rounded-full border border-border/60 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-foreground/70";

  // 선 색상
  const line = (enabled: boolean) =>
    enabled ? "stroke-[rgba(17,24,39,0.38)]" : "stroke-[rgba(17,24,39,0.16)]";

  // active 단계가 어디까지 왔는지(간단)
  const reached = (target: FlowNode) => {
    const order: FlowNode[] = ["reserve", "setup", "guest", "qr", "report", "couple"];
    const a = order.indexOf(active as any);
    const t = order.indexOf(target as any);
    if (a === -1 || t === -1) return false;
    return a >= t;
  };

  // 메인 라인 on/off
  const mainLineOn = (to: FlowNode) => reached(to);

  return (
    <div className={card}>
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">서비스 흐름</p>
            <p className="mt-1 text-base font-semibold tracking-tight">
              예식 준비부터 <span className="wedding-gradient">예식 후 관리</span>까지
            </p>
          </div>
          <div className={pill}>도식</div>
        </div>

        <div className="mt-4 rounded-2xl border border-border/60 bg-white/55 p-4">
          <div className="relative">
            {/* SVG 라인 */}
            <svg
              className="absolute left-0 top-0 h-full w-full"
              viewBox="0 0 520 460"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="rgba(17,24,39,0.30)" />
                </marker>
              </defs>

              {/* reserve -> setup */}
              <path
                d="M210 80 L255 80"
                className={line(mainLineOn("setup"))}
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arr)"
              />

              {/* setup -> guest */}
              <path
                d="M365 110 L365 145"
                className={line(mainLineOn("guest"))}
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arr)"
              />

              {/* guest -> qr */}
              <path
                d="M210 190 L255 190"
                className={line(mainLineOn("qr"))}
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arr)"
              />

              {/* qr -> report */}
              <path
                d="M365 220 L365 285"
                className={line(mainLineOn("report"))}
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arr)"
              />

              {/* report -> couple */}
              <path
                d="M255 340 L210 340"
                className={line(mainLineOn("couple"))}
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arr)"
              />

              {/* guest leaves (3) -> qr (가벼운 느낌) */}
              <path
                d="M470 165 L470 190 L395 190"
                className={line(reached("qr") || active === "message" || active === "guestbook" || active === "gift")}
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arr)"
              />

              {/* 점선: ticket (준비중) */}
              <path
                d="M470 235 L470 260"
                stroke="rgba(17,24,39,0.22)"
                strokeWidth="2"
                strokeDasharray="4 4"
                fill="none"
                markerEnd="url(#arr)"
              />

              {/* 점선: thanks (준비중) */}
              <path
                d="M130 370 C 160 370, 240 370, 310 305"
                stroke="rgba(17,24,39,0.22)"
                strokeWidth="2"
                strokeDasharray="5 5"
                fill="none"
              />
            </svg>

            {/* 노드 배치 */}
            <div className="relative h-[460px] w-full">
              {/* 레이블 */}
              <div className="absolute left-4 top-3 text-[11px] font-semibold text-muted-foreground">예식 전</div>
              <div className="absolute left-4 top-[125px] text-[11px] font-semibold text-muted-foreground">
                예식 당일
              </div>
              <div className="absolute left-4 top-[285px] text-[11px] font-semibold text-muted-foreground">예식 후</div>

              {/* reserve */}
              <div className="absolute left-4 top-10 w-[190px]">
                <div className={nodeCls("reserve")}>예약</div>
              </div>

              {/* setup */}
              <div className="absolute left-[260px] top-10 w-[240px]">
                <div className={nodeCls("setup")}>예식 상세 설정</div>
              </div>

              {/* guest */}
              <div className="absolute left-4 top-[155px] w-[190px]">
                <div className={nodeCls("guest")}>하객</div>
              </div>

              {/* guest leaves (3) */}
              <div className="absolute left-[260px] top-[135px] w-[240px] rounded-2xl border border-border/60 bg-white/70 p-3">
                <div className="text-[11px] font-semibold text-muted-foreground">하객이 남기는 것</div>
                <div className="mt-2 grid gap-2">
                  <div className={nodeCls("message")}>축하메시지</div>
                  <div className={nodeCls("guestbook")}>방명록</div>
                  <div className={nodeCls("gift")}>축의금</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={pill}>식권</span>
                    <span className={`${pill} border-dashed`}>준비중</span>
                  </div>
                </div>
              </div>

              {/* qr */}
              <div className="absolute left-[260px] top-[175px] w-[190px]">
                <div className={nodeCls("qr", "bg-white/85 border-border/70 text-foreground")}>
                  현장 QR
                </div>
              </div>

              {/* report */}
              <div className="absolute left-[260px] top-[295px] w-[240px]">
                <div className={nodeCls("report", "bg-white/85 border-border/70 text-foreground")}>
                  웨딩 리포트
                </div>
              </div>

              {/* couple */}
              <div className="absolute left-4 top-[315px] w-[190px]">
                <div className={nodeCls("couple", "bg-white/85 border-border/70 text-foreground")}>
                  신랑 · 신부
                </div>

                <div className="mt-2 rounded-2xl border border-dashed border-border/70 bg-white/55 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13px] font-semibold text-foreground/70">감사인사</div>
                    <span className={pill}>준비중</span>
                  </div>
                </div>
              </div>

              {/* 하단 한 줄 */}
              <div className="absolute left-0 right-0 bottom-0 px-1">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  결혼식 이후에도 리포트 기반으로 정리·공유까지 이어집니다. <span className="ml-1">(식권/감사 인사 준비중)</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 한 줄 요약 */}
        <div className="mt-4 rounded-2xl border border-border/60 bg-white/55 px-4 py-3">
          <p className="text-sm text-foreground/80">
            결혼식이 끝난 뒤에도 <span className="font-semibold">메시지·방명록·자금 흐름</span>을 정리해 지속 관리합니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ServiceFlowPage() {
  const navigate = useNavigate();

  const sectionIds = useMemo(
    () => [
      "sf-reserve",
      "sf-setup",
      "sf-guest",
      "sf-message",
      "sf-guestbook",
      "sf-gift",
      "sf-qr",
      "sf-report",
      "sf-couple",
    ],
    []
  );

  const activeSection = useInViewIds(sectionIds);

  const activeNode: FlowNode = useMemo(() => {
    switch (activeSection) {
      case "sf-reserve":
        return "reserve";
      case "sf-setup":
        return "setup";
      case "sf-guest":
        return "guest";
      case "sf-message":
        return "message";
      case "sf-guestbook":
        return "guestbook";
      case "sf-gift":
        return "gift";
      case "sf-qr":
        return "qr";
      case "sf-report":
        return "report";
      case "sf-couple":
        return "couple";
      default:
        return "reserve";
    }
  }, [activeSection]);

  return (
    <main className="relative min-h-screen">
      {/* 배경 */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(120,119,198,0.18),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.18),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(253,224,71,0.10),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />

      {/* 상단 바 */}
      <div className="relative mx-auto max-w-7xl px-6 pt-10">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-baseline gap-3 hover:opacity-90 transition"
            aria-label="Go to landing"
          >
            <span className="text-[15px] sm:text-base font-semibold tracking-tight text-foreground">
              Digital Guestbook
            </span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate("/reserve")}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5">
                ✉️
              </span>
              <span className="font-medium">예약문의</span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5">
                📄
              </span>
              <span className="font-medium">리포트</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-6 pt-10 pb-8">
        <p className="text-sm text-muted-foreground">서비스 흐름</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
          예식 준비부터 <span className="wedding-gradient">예식 후 관리</span>까지
        </h1>
        <p className="mt-3 text-base text-muted-foreground max-w-3xl leading-relaxed">
          디지털 방명록은 결혼식 이벤트의 사후 자금흐름까지 지속 관리합니다.
        </p>
      </section>

      {/* Desktop: 좌(콘텐츠) / 우(Sticky Diagram) */}
      <section className="relative mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_460px]">
          {/* LEFT */}
          <div className="space-y-12">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">예식 전</h2>
              <div className="mt-4 space-y-4">
                <StepCard
                  id="sf-reserve"
                  title="1) 예약"
                  desc="예식 날짜·기본 정보만 먼저 받고, 확정 안내는 카카오톡으로 진행됩니다."
                />
                <StepCard
                  id="sf-setup"
                  title="2) 예식 상세 설정"
                  desc="예식 시간, 수령인(혼주/스태프 포함), 화면 템플릿 등 실제 운영에 필요한 설정을 확정합니다."
                />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-tight">예식 당일</h2>
              <div className="mt-4 space-y-4">
                <StepCard
                  id="sf-guest"
                  title="3) 하객"
                  desc="하객은 별도 앱 설치 없이 QR로 바로 참여합니다. (현장 흐름이 끊기지 않는 게 핵심)"
                />
                <StepCard
                  id="sf-message"
                  title="4) 축하메시지"
                  desc="짧고 빠르게 남길 수 있도록 UX를 단순하게 유지합니다."
                />
                <StepCard
                  id="sf-guestbook"
                  title="5) 방명록"
                  desc="‘현장 참석 기록’으로 남고, 리포트에서 정리됩니다."
                />
                <StepCard
                  id="sf-gift"
                  title="6) 축의금"
                  desc="축의금 내역이 리포트로 정리됩니다. (식권 연동은 준비중)"
                  badge="식권 준비중"
                  dashedBadge
                />
                <StepCard
                  id="sf-qr"
                  title="7) 현장 QR"
                  desc="메시지/방명록/축의금이 QR 한 흐름으로 모이게 설계합니다."
                />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-tight">예식 후</h2>
              <div className="mt-4 space-y-4">
                <StepCard
                  id="sf-report"
                  title="8) 웨딩 리포트"
                  desc="예식 직후 메시지·방명록·정산을 한 번에 정리해 전달합니다."
                />
                <StepCard
                  id="sf-couple"
                  title="9) 신랑·신부"
                  desc="보관·정리·공유까지 이어집니다. (감사 인사 자동화는 준비중)"
                  badge="감사인사 준비중"
                  dashedBadge
                />
              </div>
            </div>

            {/* TODO */}
            <div className="pt-6 border-t border-border/60">
              <p className="text-sm text-muted-foreground">
                아래 구간(서비스 기능/갤러리/딜리버리)은 다음 단계에서 전체 재구성.
              </p>
            </div>
          </div>

          {/* RIGHT: sticky diagram (Desktop) */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              {/* 잘림 방지: 화면 작으면 카드 내부 스크롤 */}
              <div className="max-h-[calc(100vh-7.5rem)] overflow-auto pr-1">
                <FlowDiagram active={activeNode} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile: top sticky diagram */}
      <div className="lg:hidden sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="max-h-[55vh] overflow-auto">
            <FlowDiagram active={activeNode} />
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}

function StepCard({
  id,
  title,
  desc,
  badge,
  dashedBadge,
}: {
  id: string;
  title: string;
  desc: string;
  badge?: string;
  dashedBadge?: boolean;
}) {
  return (
    <section
      id={id}
      className="rounded-3xl bg-white/65 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.08)] border border-border/60 p-5 sm:p-6 scroll-mt-28"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base sm:text-lg font-semibold tracking-tight">{title}</h3>
        {badge ? (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold
            ${
              dashedBadge
                ? "border border-dashed border-border/70 bg-white/55 text-foreground/70"
                : "border border-border/60 bg-white/70 text-foreground/70"
            }`}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed">{desc}</p>
    </section>
  );
}
