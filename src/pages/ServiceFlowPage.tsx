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
  | "ticket"
  | "thanks";

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

/**
 * 가로 스크롤/잘림 방지:
 * - 컨테이너 너비에 맞게 캔버스를 scale down
 * - overflow-x-hidden
 * - 노드는 텍스트 길이에 맞게 inline-flex로 최소 크기
 */
function FlowDiagram({ active }: { active: FlowNode }) {
  const reduceMotion = useReducedMotion();
  const on = (n: FlowNode) => active === n;

  // 스케일 계산용
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // 캔버스 기본 크기(이 크기를 기준으로 축소)
  const CANVAS_W = 520;
  const CANVAS_H = 420;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const calc = () => {
      const w = el.clientWidth;
      // padding 고려 여유폭 약간
      const next = Math.min(1, (w - 8) / CANVAS_W);
      setScale(Number.isFinite(next) ? next : 1);
    };

    calc();

    const ro = new ResizeObserver(() => calc());
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  const card =
    "rounded-3xl border border-border/60 bg-white/65 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.10)]";

  // 노드: 텍스트에 맞춰 최소 크기 + 여백 축소
  const nodeBase =
    "inline-flex items-center rounded-2xl border px-3 py-2 text-[12.5px] font-semibold leading-none transition select-none whitespace-nowrap";
  const nodeMuted = "bg-white/80 border-border/60 text-foreground/85";
  const nodeHot = reduceMotion
    ? "ring-2 ring-foreground/10"
    : "ring-2 ring-foreground/10 shadow-[0_14px_28px_rgba(15,23,42,0.12)] -translate-y-[1px]";
  const dashed = "border-dashed border-border/70 bg-white/65 text-foreground/65";

  const nodeCls = (id: FlowNode, extra?: string) =>
    `${nodeBase} ${extra ?? nodeMuted} ${on(id) ? nodeHot : "opacity-90"}`;

  const pill =
    "inline-flex items-center rounded-full border border-border/60 bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-foreground/70";

  const line = (enabled: boolean) =>
    enabled ? "stroke-[rgba(17,24,39,0.34)]" : "stroke-[rgba(17,24,39,0.14)]";

  const reached = (target: FlowNode) => {
    const order: FlowNode[] = ["reserve", "setup", "guest", "qr", "report", "couple"];
    const a = order.indexOf(active as any);
    const t = order.indexOf(target as any);
    if (a === -1 || t === -1) return false;
    return a >= t;
  };

  const mainOn = (to: FlowNode) => reached(to);

  return (
    <div className={card}>
      {/* 헤더/요약 멘트 전부 제거. 도식만 */}
      <div className="p-4 sm:p-5">
        <div
          ref={wrapRef}
          className="rounded-2xl border border-border/60 bg-white/55 p-3 overflow-x-hidden"
        >
          {/* scale wrapper */}
          <div
            className="origin-top-left"
            style={{
              transform: `scale(${scale})`,
              width: CANVAS_W,
              height: CANVAS_H,
            }}
          >
            <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
              {/* SVG 라인 */}
              <svg
                className="absolute left-0 top-0 h-full w-full"
                viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill="rgba(17,24,39,0.28)" />
                  </marker>
                </defs>

                {/* reserve -> setup */}
                <path
                  d="M190 70 L260 70"
                  className={line(mainOn("setup"))}
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arr)"
                />

                {/* setup -> guest */}
                <path
                  d="M360 95 L360 140"
                  className={line(mainOn("guest"))}
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arr)"
                />

                {/* guest -> qr */}
                <path
                  d="M190 170 L260 170"
                  className={line(mainOn("qr"))}
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arr)"
                />

                {/* qr -> report */}
                <path
                  d="M360 195 L360 250"
                  className={line(mainOn("report"))}
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arr)"
                />

                {/* report -> couple */}
                <path
                  d="M260 305 L190 305"
                  className={line(mainOn("couple"))}
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arr)"
                />

                {/* guest leaves -> qr */}
                <path
                  d="M470 145 L470 170 L395 170"
                  className={line(reached("qr") || active === "message" || active === "guestbook" || active === "gift")}
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arr)"
                />

                {/* dashed ticket */}
                <path
                  d="M470 205 L470 232"
                  stroke="rgba(17,24,39,0.20)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  fill="none"
                  markerEnd="url(#arr)"
                />

                {/* dashed thanks */}
                <path
                  d="M120 330 C 160 330, 235 330, 305 265"
                  stroke="rgba(17,24,39,0.20)"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                  fill="none"
                />
              </svg>

              {/* Labels (작게, 공간 최소) */}
              <div className="absolute left-3 top-2 text-[10px] font-semibold text-muted-foreground">예식 전</div>
              <div className="absolute left-3 top-[112px] text-[10px] font-semibold text-muted-foreground">
                예식 당일
              </div>
              <div className="absolute left-3 top-[252px] text-[10px] font-semibold text-muted-foreground">예식 후</div>

              {/* Nodes: width 고정 제거, 내용에 맞게 */}
              <div className="absolute left-3 top-8">
                <div className={nodeCls("reserve")}>예약</div>
              </div>

              <div className="absolute left-[270px] top-8">
                <div className={nodeCls("setup")}>예식 상세 설정</div>
              </div>

              <div className="absolute left-3 top-[138px]">
                <div className={nodeCls("guest")}>하객</div>
              </div>

              {/* guest leaves */}
              <div className="absolute left-[270px] top-[120px] rounded-2xl border border-border/60 bg-white/75 px-3 py-2">
                <div className="text-[10px] font-semibold text-muted-foreground">하객이 남기는 것</div>
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

              <div className="absolute left-[270px] top-[154px]">
                <div className={nodeCls("qr")}>현장 QR</div>
              </div>

              <div className="absolute left-[270px] top-[268px]">
                <div className={nodeCls("report")}>웨딩 리포트</div>
              </div>

              <div className="absolute left-3 top-[270px]">
                <div className={nodeCls("couple")}>신랑 · 신부</div>

                <div className="mt-2 inline-flex flex-col gap-2">
                  <div className={`${nodeBase} ${dashed}`}>
                    감사인사 <span className="ml-2 text-[10px] font-semibold opacity-80">준비중</span>
                  </div>
                </div>
              </div>

              {/* dashed ticket indicator near gift */}
              <div className="absolute left-[440px] top-[240px]">
                <div className={`${nodeBase} ${dashed}`}>식권</div>
              </div>
            </div>
          </div>
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

      {/* Hero (요청 반영: 타이틀 + 서브카피 교체) */}
      <section className="relative mx-auto max-w-7xl px-6 pt-10 pb-8">
        <p className="text-sm text-muted-foreground">서비스 흐름</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
          예신 준비부터 <span className="wedding-gradient">예식후 관리</span>까지
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
              {/* 세로 스크롤만 허용, 가로는 절대 금지 */}
              <div className="max-h-[calc(100vh-7.5rem)] overflow-y-auto overflow-x-hidden pr-1">
                <FlowDiagram active={activeNode} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile: top sticky diagram */}
      <div className="lg:hidden sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          {/* 모바일도 가로 스크롤 금지 */}
          <div className="max-h-[50vh] overflow-y-auto overflow-x-hidden">
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
