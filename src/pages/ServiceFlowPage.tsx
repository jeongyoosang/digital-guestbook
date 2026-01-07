// src/pages/ServiceFlowPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReducedMotion } from "framer-motion";

import Footer from "@/components/Footer";
import { FeaturesSection } from "@/components/FeaturesSection";
import { GallerySection } from "@/components/GallerySection";
import { DeliverySection } from "@/components/DeliverySection";

type FlowNode =
  | "pre_reserve"
  | "pre_settings"
  | "guest"
  | "congrats"
  | "guestbook"
  | "gift"
  | "ticket" // 준비중 (점선)
  | "qr"
  | "report"
  | "couple"
  | "thanks"; // 준비중 (점선)

function useInViewIds(ids: string[], rootMargin = "-35% 0px -55% 0px") {
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
      { root: null, threshold: [0.15, 0.25, 0.35, 0.5], rootMargin }
    );

    elements.forEach((el) => obs.observe(el));
    observerRef.current = obs;

    return () => obs.disconnect();
  }, [ids, rootMargin]);

  return activeId;
}

function FlowDiagram({ active }: { active: FlowNode }) {
  const reduceMotion = useReducedMotion();
  const isOn = (node: FlowNode) => active === node;

  const nodeBase =
    "relative rounded-2xl px-4 py-3 text-sm sm:text-[15px] font-semibold border transition";
  const activeFx = reduceMotion
    ? "ring-2 ring-foreground/25"
    : "ring-2 ring-foreground/25 shadow-[0_18px_60px_rgba(15,23,42,0.14)] scale-[1.015]";
  const mutedFx = "opacity-85";

  const cls = (node: FlowNode, base: string, dashed = false) =>
    [
      nodeBase,
      base,
      isOn(node) ? activeFx : mutedFx,
      dashed ? "border-dashed" : "",
      reduceMotion ? "" : "will-change-transform",
    ].join(" ");

  const lightBlue = "bg-[#A8D4FF]/55 text-[#0B3553] border-[#7DBEF7]/70";
  const slate = "bg-background/60 backdrop-blur text-foreground border-border/70";
  const deepBlue = "bg-[#0C5A78] text-white border-white/10";
  const orange = "bg-[#F07C3D] text-white border-white/10";
  const green = "bg-[#3FAE2A] text-white border-white/10";
  const green2 = "bg-[#2FA83E] text-white border-white/10";

  const pendingBadge = (
    <span className="ml-2 inline-flex items-center rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      준비중
    </span>
  );

  // 메인 파이프라인 느낌(항상 살아있게)
  const mainOn =
    active === "qr" || active === "report" || active === "couple" || active === "thanks"
      ? "opacity-100"
      : "opacity-80";

  // 선 색/스타일 (active에 따라 조금 진해짐)
  const lineStroke = (enabled: boolean) => (enabled ? "rgba(15,23,42,0.38)" : "rgba(15,23,42,0.22)");
  const lineWidth = (enabled: boolean) => (enabled ? 2.4 : 2);

  // 어떤 구간에서 어떤 선을 강조할지(대략적인 룰)
  const onPre = active === "pre_reserve" || active === "pre_settings";
  const onInputs =
    active === "guest" || active === "congrats" || active === "guestbook" || active === "gift" || active === "ticket";
  const onPipe = active === "qr" || active === "report" || active === "couple" || active === "thanks";

  return (
    <div className="relative">
      <div className="relative rounded-3xl border bg-background/75 backdrop-blur p-5 sm:p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] overflow-hidden">
        {/* 배경 */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(120,119,198,0.16),transparent_58%),radial-gradient(circle_at_82%_20%,rgba(244,114,182,0.14),transparent_58%),radial-gradient(circle_at_50%_88%,rgba(253,224,71,0.10),transparent_62%)]" />
        <div className="relative">
          {/* ===== 예식 전 (상단) ===== */}
          <div className="mb-4 rounded-3xl border bg-background/55 backdrop-blur p-4">
            <div className="text-xs font-semibold text-muted-foreground mb-3">예식 전</div>

            <div className="grid grid-cols-[1fr_28px_1fr] items-center gap-3">
              <div className={cls("pre_reserve", slate)}>
                예약
                <div className="mt-1 text-[11px] font-normal text-muted-foreground">예약 문의 접수</div>
              </div>

              <div className="flex items-center justify-center text-muted-foreground">→</div>

              <div className={cls("pre_settings", slate)}>
                예식 상세 설정
                <div className="mt-1 text-[11px] font-normal text-muted-foreground">시간·수령인·템플릿</div>
              </div>
            </div>

            {/* Pre 선 (SVG) */}
            <svg className="mt-3 h-6 w-full" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <marker id="arrow-pre" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto">
                  <path d="M0,0 L10,5 L0,10 Z" fill={lineStroke(onPre)} />
                </marker>
              </defs>
              <path
                d="M120 30 L880 30"
                stroke={lineStroke(onPre)}
                strokeWidth={lineWidth(onPre)}
                markerEnd="url(#arrow-pre)"
                fill="none"
              />
            </svg>
          </div>

          {/* ===== 예식 당일 (하단) ===== */}
          <div className="rounded-3xl border bg-background/55 backdrop-blur p-4">
            <div className="text-xs font-semibold text-muted-foreground mb-3">예식 당일</div>

            {/* PC 레이아웃 */}
            <div className="hidden md:grid grid-cols-[200px_330px_150px_150px_150px] gap-4 items-center">
              {/* 하객 */}
              <div className={cls("guest", lightBlue)}>
                하객
                <div className="mt-1 text-[11px] font-normal opacity-80">QR로 참여</div>
              </div>

              {/* 입력 3 + (준비중 식권) */}
              <div className="relative rounded-3xl border bg-background/55 backdrop-blur p-4">
                <div className="text-[11px] font-semibold text-muted-foreground mb-3">하객이 남기는 것</div>
                <div className="grid grid-rows-3 gap-2">
                  <div className={cls("congrats", deepBlue)}>축하메시지</div>
                  <div className={cls("guestbook", deepBlue)}>방명록</div>
                  <div className={cls("gift", deepBlue)}>
                    축의금
                    {/* 축의금 하위 준비중: 식권 */}
                    <div className="mt-2">
                      <div className={cls("ticket", slate, true)}>
                        식권 {pendingBadge}
                        <div className="mt-1 text-[11px] font-normal text-muted-foreground">
                          (축의금 연동 기반 서비스)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 그룹 → QR 연결 가이드 */}
                <div className="pointer-events-none absolute -right-5 top-1/2 -translate-y-1/2">
                  <div className="h-[2px] w-10 bg-foreground/25" />
                </div>
              </div>

              {/* QR */}
              <div className={`${cls("qr", orange)} ${mainOn}`}>
                현장 QR
                <div className="mt-1 text-[11px] font-normal opacity-85">수렴점</div>
              </div>

              {/* 리포트 */}
              <div className={`${cls("report", green)} ${mainOn}`}>
                웨딩 리포트
                <div className="mt-1 text-[11px] font-normal opacity-85">정리·다운로드</div>
              </div>

              {/* 신랑신부 */}
              <div className={`${cls("couple", green2)} ${mainOn}`}>
                신랑·신부
                <div className="mt-1 text-[11px] font-normal opacity-85">수령·보관</div>
              </div>
            </div>

            {/* PC: 연결선 + 감사루프(점선) */}
            <div className="hidden md:block pointer-events-none relative mt-2">
              <svg className="h-[110px] w-full" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto">
                    <path d="M0,0 L10,5 L0,10 Z" fill={lineStroke(onPipe)} />
                  </marker>
                  <marker id="arrow-muted" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto">
                    <path d="M0,0 L10,5 L0,10 Z" fill={lineStroke(onInputs)} />
                  </marker>
                </defs>

                {/* 입력들 → QR */}
                <path
                  d="M390 55 L520 55"
                  stroke={lineStroke(onInputs)}
                  strokeWidth={lineWidth(onInputs)}
                  markerEnd="url(#arrow-muted)"
                  fill="none"
                />

                {/* QR → 리포트 → 신랑신부 */}
                <path
                  d="M540 55 L690 55"
                  stroke={lineStroke(onPipe)}
                  strokeWidth={lineWidth(onPipe)}
                  markerEnd="url(#arrow)"
                  fill="none"
                />
                <path
                  d="M710 55 L860 55"
                  stroke={lineStroke(onPipe)}
                  strokeWidth={lineWidth(onPipe)}
                  markerEnd="url(#arrow)"
                  fill="none"
                />

                {/* 감사 인사 루프 (준비중: 점선) : 신랑신부 → 하객 */}
                <path
                  d="M860 95 C860 190, 160 190, 160 105"
                  stroke="rgba(15,23,42,0.22)"
                  strokeWidth="2"
                  strokeDasharray="6 6"
                  fill="none"
                  markerEnd="url(#arrow-muted)"
                />

                {/* loop label */}
                <text x="500" y="205" textAnchor="middle" fontSize="12" fill="rgba(15,23,42,0.55)">
                  감사 인사 (준비중)
                </text>
              </svg>
            </div>

            {/* Mobile 레이아웃 */}
            <div className="md:hidden grid gap-3">
              <div className={cls("guest", lightBlue)}>하객</div>

              <div className="rounded-3xl border bg-background/55 backdrop-blur p-4">
                <div className="text-[11px] font-semibold text-muted-foreground mb-3">하객이 남기는 것</div>
                <div className="grid gap-2">
                  <div className={cls("congrats", deepBlue)}>축하메시지</div>
                  <div className={cls("guestbook", deepBlue)}>방명록</div>
                  <div className={cls("gift", deepBlue)}>
                    축의금
                    <div className="mt-2">
                      <div className={cls("ticket", slate, true)}>
                        식권 {pendingBadge}
                        <div className="mt-1 text-[11px] font-normal text-muted-foreground">
                          (준비중)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className={`${cls("qr", orange)} ${mainOn}`}>현장 QR</div>
                <div className={`${cls("report", green)} ${mainOn}`}>웨딩 리포트</div>
                <div className={`${cls("couple", green2)} ${mainOn}`}>신랑·신부</div>
              </div>

              {/* mobile loop label only */}
              <div className={cls("thanks", slate, true)}>
                감사 인사 {pendingBadge}
                <div className="mt-1 text-[11px] font-normal text-muted-foreground">
                  (신랑·신부 → 하객)
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-muted-foreground">
              예식 당일, 하객의 <span className="text-foreground font-semibold">축하메시지·방명록·축의금</span>이
              <span className="text-foreground font-semibold"> 현장 QR</span>로 모이고,
              <span className="text-foreground font-semibold"> 웨딩 리포트</span>로 정리되어
              <span className="text-foreground font-semibold"> 신랑·신부</span>에게 전달됩니다.{" "}
              <span className="ml-1 text-muted-foreground">(식권/감사 인사는 준비중)</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ServiceFlowPage() {
  const navigate = useNavigate();

  // 스크롤 섹션 목록
  const sectionIds = useMemo(
    () => [
      "sf-pre-reserve",
      "sf-pre-settings",
      "sf-day-guest",
      "sf-day-congrats",
      "sf-day-guestbook",
      "sf-day-gift",
      "sf-day-ticket",
      "sf-day-qr",
      "sf-day-report",
      "sf-day-couple",
      "sf-post-thanks",
      "sf-features",
      "sf-gallery",
      "sf-delivery",
    ],
    []
  );
  const activeSection = useInViewIds(sectionIds);

  // 섹션 → 노드 매핑
  const activeNode: FlowNode = useMemo(() => {
    switch (activeSection) {
      case "sf-pre-reserve":
        return "pre_reserve";
      case "sf-pre-settings":
        return "pre_settings";

      case "sf-day-guest":
        return "guest";
      case "sf-day-congrats":
        return "congrats";
      case "sf-day-guestbook":
        return "guestbook";
      case "sf-day-gift":
        return "gift";
      case "sf-day-ticket":
        return "ticket";

      case "sf-day-qr":
        return "qr";
      case "sf-day-report":
        return "report";
      case "sf-day-couple":
        return "couple";
      case "sf-post-thanks":
        return "thanks";

      // 기존 섹션들(너가 이미 만든 것들)
      case "sf-features":
        return "qr"; // 기능 = 참여/수집 구간 느낌
      case "sf-gallery":
        return "guestbook"; // 현장 갤러리 = 방명록/메시지 구간 느낌
      case "sf-delivery":
        return "report"; // 전달/정리 = 리포트
      default:
        return "qr";
    }
  }, [activeSection]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* 배경 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(120,119,198,0.18),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.18),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(253,224,71,0.10),transparent_60%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />

      {/* 상단 헤더(ReservePage와 통일감) */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pt-10">
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

        {/* 타이틀 */}
        <header className="mt-10 pb-6">
          <p className="text-sm text-muted-foreground">서비스 흐름</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            예식 전 준비부터 <span className="wedding-gradient">QR → 리포트</span>까지
          </h1>
          <p className="mt-3 text-base text-muted-foreground max-w-2xl">
            “예약 → 예식 상세 설정(예식 전) → 하객(예식 당일) → 메시지/방명록/축의금 → QR → 웨딩 리포트 → 신랑·신부”
            <br />
            <span className="text-muted-foreground">
              * 식권/감사 인사는 준비중(점선)으로 표기합니다.
            </span>
          </p>
        </header>
      </div>

      {/* ===== 레이아웃: PC는 2컬럼(왼쪽 스크롤 / 오른쪽 sticky), Mobile은 상단 sticky ===== */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-10 items-start">
          {/* LEFT: 스크롤 컨텐츠 */}
          <div className="min-w-0">
            {/* Mobile sticky diagram */}
            <div className="lg:hidden sticky top-0 z-30 border-b bg-background/70 backdrop-blur">
              <div className="py-4">
                <FlowDiagram active={activeNode} />
              </div>
            </div>

            {/* 예식 전 */}
            <section id="sf-pre-reserve" className="pt-10">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">예식 전</h2>
              <div className="mt-5 rounded-3xl border bg-white/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-6">
                <h3 className="text-xl font-semibold">1) 예약</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  예식 날짜·기본 정보만 먼저 받고, 확정 안내는 카카오톡으로 진행됩니다.
                </p>
              </div>
            </section>

            <section id="sf-pre-settings" className="pt-10">
              <div className="rounded-3xl border bg-white/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-6">
                <h3 className="text-xl font-semibold">2) 예식 상세 설정</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  예식 시간, 수령인(혼주/스태프 포함), 화면 템플릿 등 실제 운영에 필요한 설정을 확정합니다.
                </p>
              </div>
            </section>

            {/* 예식 당일 */}
            <section id="sf-day-guest" className="pt-14">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">예식 당일</h2>
              <div className="mt-5 rounded-3xl border bg-white/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-6">
                <h3 className="text-xl font-semibold">3) 하객</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  하객은 별도 앱 설치 없이 QR로 바로 참여합니다. (현장 흐름이 끊기지 않는 게 핵심)
                </p>
              </div>
            </section>

            <section id="sf-day-congrats" className="pt-10">
              <div className="rounded-3xl border bg-white/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-6">
                <h3 className="text-xl font-semibold">4) 축하메시지</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  짧고 빠르게 남길 수 있도록 UX를 단순하게 유지합니다.
                </p>
              </div>
            </section>

            <section id="sf-day-guestbook" className="pt-10">
              <div className="rounded-3xl border bg-white/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-6">
                <h3 className="text-xl font-semibold">5) 방명록</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  ‘현장 참석 기록’으로 남고, 리포트에서 정리됩니다.
                </p>
              </div>
            </section>

            <section id="sf-day-gift" className="pt-10">
              <div className="rounded-3xl border bg-white/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-6">
                <h3 className="text-xl font-semibold">6) 축의금</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  축의금 내역을 리포트로 정리하는 흐름까지 연결됩니다.
                </p>
              </div>
            </section>

            <section id="sf-day-ticket" className="pt-10">
              <div className="rounded-3xl border border-dashed bg-white/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6">
                <h3 className="text-xl font-semibold">
                  6-1) 식권 <span className="ml-2 text-xs text-muted-foreground">(준비중)</span>
                </h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  축의금 흐름과 연결되는 부가 서비스로 준비중입니다. (점선으로 표시)
                </p>
              </div>
            </section>

            <section id="sf-day-qr" className="pt-10">
              <div className="rounded-3xl border bg-white/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-6">
                <h3 className="text-xl font-semibold">7) 현장 QR (수렴점)</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  축하메시지/방명록/축의금이 하나의 흐름으로 모이는 지점입니다.
                </p>
              </div>
            </section>

            <section id="sf-day-report" className="pt-10">
              <div className="rounded-3xl border bg-white/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-6">
                <h3 className="text-xl font-semibold">8) 웨딩 리포트</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  예식이 끝나면 메시지/방명록/축의금을 하나의 리포트로 정리해 전달합니다.
                </p>
              </div>
            </section>

            <section id="sf-day-couple" className="pt-10">
              <div className="rounded-3xl border bg-white/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-6">
                <h3 className="text-xl font-semibold">9) 신랑·신부</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  정산/보관/공유를 한 번에 끝내는 것이 목적입니다.
                </p>
              </div>
            </section>

            <section id="sf-post-thanks" className="pt-10">
              <div className="rounded-3xl border border-dashed bg-white/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6">
                <h3 className="text-xl font-semibold">
                  10) 감사 인사 <span className="ml-2 text-xs text-muted-foreground">(준비중)</span>
                </h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  리포트 기반으로 하객에게 감사 인사를 자동화하는 기능은 준비중입니다. (점선 루프)
                </p>
              </div>
            </section>

            {/* 기존 섹션(이미 만들어둔 컴포넌트 연결) */}
            <div id="sf-features" className="pt-16">
              <FeaturesSection />
            </div>
            <div id="sf-gallery" className="pt-10">
              <GallerySection />
            </div>
            <div id="sf-delivery" className="pt-10">
              <DeliverySection />
            </div>

            <Footer />
          </div>

          {/* RIGHT: PC sticky diagram */}
          <aside className="hidden lg:block sticky top-20">
            <FlowDiagram active={activeNode} />
          </aside>
        </div>
      </div>
    </main>
  );
}
