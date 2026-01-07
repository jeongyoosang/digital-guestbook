// src/pages/ServiceFlowPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReducedMotion } from "framer-motion";

import Footer from "@/components/Footer";
import { FeaturesSection } from "@/components/FeaturesSection";
import { GallerySection } from "@/components/GallerySection";
import { DeliverySection } from "@/components/DeliverySection"; // ✅ named export 기준

type FlowNode =
  | "guest"
  | "congrats"
  | "attendance"
  | "gift"
  | "qr"
  | "report"
  | "couple";

function useInViewIds(ids: string[], rootMargin = "-35% 0px -55% 0px") {
  const [activeId, setActiveId] = useState<string>(ids[0] ?? "");
  const obsRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (!elements.length) return;

    obsRef.current?.disconnect();

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0));

        if (visible[0]?.target?.id) setActiveId(visible[0].target.id);
      },
      {
        root: null,
        threshold: [0.12, 0.2, 0.35, 0.5],
        rootMargin,
      }
    );

    elements.forEach((el) => obs.observe(el));
    obsRef.current = obs;

    return () => obs.disconnect();
  }, [ids, rootMargin]);

  return activeId;
}

function FlowDiagram({ active }: { active: FlowNode }) {
  const reduceMotion = useReducedMotion();
  const on = (node: FlowNode) => active === node;

  const nodeBase =
    "relative rounded-2xl px-5 py-4 text-sm sm:text-base font-semibold border transition";
  const activeFx = reduceMotion
    ? "ring-2 ring-foreground/25"
    : "ring-2 ring-foreground/25 shadow-[0_18px_60px_rgba(15,23,42,0.14)] scale-[1.015]";
  const mutedFx = "opacity-85";

  const cls = (node: FlowNode, base: string) =>
    `${nodeBase} ${base} ${on(node) ? activeFx : mutedFx}`;

  const lightBlue = "bg-[#A8D4FF]/55 text-[#0B3553] border-[#7DBEF7]/70";
  const deepBlue = "bg-[#0C5A78] text-white border-white/10";
  const orange = "bg-[#F07C3D] text-white border-white/10";
  const green = "bg-[#3FAE2A] text-white border-white/10";
  const green2 = "bg-[#2FA83E] text-white border-white/10";

  // 메인 파이프라인(하객→QR→리포트→신랑신부)은 항상 “느낌” 있게
  const mainOn =
    active === "qr" || active === "report" || active === "couple"
      ? "opacity-100"
      : "opacity-75";

  return (
    <div className="relative">
      <div className="relative rounded-3xl border bg-background/75 backdrop-blur p-6 sm:p-7 shadow-[0_18px_60px_rgba(15,23,42,0.08)] overflow-hidden">
        {/* 은은한 배경 */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(120,119,198,0.16),transparent_58%),radial-gradient(circle_at_82%_22%,rgba(244,114,182,0.14),transparent_58%),radial-gradient(circle_at_50%_90%,rgba(253,224,71,0.10),transparent_62%)]" />

        <div className="relative">
          {/* Desktop(가로) */}
          <div className="hidden md:grid grid-cols-[200px_360px_160px_160px_160px] gap-4 items-center">
            <div className={cls("guest", lightBlue)}>
              <div className="text-sm font-semibold opacity-90">하객</div>
              <div className="mt-1 text-xs font-normal opacity-80">QR로 참여</div>
            </div>

            <div className="relative rounded-3xl border bg-background/55 backdrop-blur p-4">
              <div className="text-xs font-semibold text-muted-foreground mb-3">
                하객이 남기는 3가지
              </div>
              <div className="grid grid-rows-3 gap-2">
                <div className={cls("congrats", deepBlue)}>축하메시지</div>
                <div className={cls("attendance", deepBlue)}>현장참석 방명록</div>
                <div className={cls("gift", deepBlue)}>축의금</div>
              </div>

              <div className="pointer-events-none absolute -right-5 top-1/2 -translate-y-1/2">
                <div className="h-[2px] w-10 bg-foreground/25" />
              </div>
            </div>

            <div className={`${cls("qr", orange)} ${mainOn}`}>
              <div className="text-sm font-semibold">현장 QR</div>
              <div className="mt-1 text-xs font-normal opacity-85">
                모든 입력이 모이는 곳
              </div>
            </div>

            <div className={`${cls("report", green)} ${mainOn}`}>
              <div className="text-sm font-semibold">웨딩 리포트</div>
              <div className="mt-1 text-xs font-normal opacity-85">
                Excel · 영상 · 링크
              </div>
            </div>

            <div className={`${cls("couple", green2)} ${mainOn}`}>
              <div className="text-sm font-semibold">신랑 신부</div>
              <div className="mt-1 text-xs font-normal opacity-85">
                정산·감사·보관
              </div>
            </div>
          </div>

          {/* Mobile(세로) */}
          <div className="md:hidden grid gap-3">
            <div className={cls("guest", lightBlue)}>하객</div>

            <div className="rounded-3xl border bg-background/55 backdrop-blur p-4">
              <div className="text-xs font-semibold text-muted-foreground mb-3">
                하객이 남기는 3가지
              </div>
              <div className="grid gap-2">
                <div className={cls("congrats", deepBlue)}>축하메시지</div>
                <div className={cls("attendance", deepBlue)}>현장참석 방명록</div>
                <div className={cls("gift", deepBlue)}>축의금</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className={`${cls("qr", orange)} ${mainOn}`}>현장 QR</div>
              <div className={`${cls("report", green)} ${mainOn}`}>웨딩 리포트</div>
              <div className={`${cls("couple", green2)} ${mainOn}`}>신랑 신부</div>
            </div>
          </div>

          <p className="mt-5 text-xs sm:text-sm text-muted-foreground">
            <span className="text-foreground font-semibold">하객의 3가지 입력</span>
            이 <span className="text-foreground font-semibold">현장 QR</span>로 모이고,
            <span className="text-foreground font-semibold"> 웨딩 리포트</span>로 정리되어{" "}
            <span className="text-foreground font-semibold">신랑신부에게 전달</span>됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ServiceFlowPage() {
  const navigate = useNavigate();

  // 왼쪽(설명) 스텝들: 이 id를 기준으로 스크롤스파이 → 다이어그램 highlight
  const steps = useMemo(
    () => [
      {
        id: "sf-step-qr",
        title: "1) 현장 QR 하나로 시작",
        desc:
          "하객은 QR만 스캔하면 즉시 참여합니다. 별도 앱 설치 없이, 축하메시지/참석 방명록/축의금 입력이 한 흐름으로 연결됩니다.",
        node: "qr" as FlowNode,
      },
      {
        id: "sf-step-features",
        title: "2) 하객의 입력이 자연스럽게 모입니다",
        desc:
          "하객은 ‘뭘 해야 하는지’ 고민할 필요 없이, 안내된 흐름대로 입력합니다. (축하메시지 · 참석 · 축의금)",
        node: "congrats" as FlowNode,
      },
      {
        id: "sf-step-gallery",
        title: "3) 현장 공간에서 ‘장면’이 됩니다",
        desc:
          "로비·홀·가든 등 어디서든 메시지가 실시간 콘텐츠가 됩니다. ‘현장에 있는 사람만 의미’가 남도록 설계합니다.",
        node: "attendance" as FlowNode,
      },
      {
        id: "sf-step-delivery",
        title: "4) 예식 직후 리포트로 정리되어 전달",
        desc:
          "예식이 끝나면 메시지와 축의금 내역이 하나의 리포트로 정리됩니다. 신랑신부는 정산/감사/보관까지 한 번에 끝냅니다.",
        node: "report" as FlowNode,
      },
    ],
    []
  );

  const sectionIds = useMemo(() => steps.map((s) => s.id), [steps]);
  const activeSection = useInViewIds(sectionIds);
  const activeNode: FlowNode = useMemo(() => {
    const found = steps.find((s) => s.id === activeSection);
    return found?.node ?? "qr";
  }, [activeSection, steps]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Landing과 같은 은은한 배경 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(120,119,198,0.18),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.18),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(253,224,71,0.10),transparent_60%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
        {/* ✅ 상단 바: ReservePage랑 동일한 패턴 */}
        <div className="flex items-center justify-between">
          {/* 왼쪽 로고: 홈으로 */}
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

          {/* 오른쪽: 예약문의(메인) + 리포트(보조) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate("/reserve")}
              className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-4 text-sm font-semibold text-background shadow-sm transition hover:opacity-90"
            >
              예약문의
            </button>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition"
              aria-label="Go to report"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5">
                📄
              </span>
              <span className="font-medium">리포트</span>
            </button>
          </div>
        </div>

        {/* ✅ 페이지 헤드(타이틀/설명) */}
        <header className="mt-10 sm:mt-12">
          <p className="text-sm text-muted-foreground">서비스 흐름</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            하객의 마음이 <span className="wedding-gradient">QR → 리포트</span>로 정리됩니다
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-3xl">
            “하객 → (축하메시지/참석/축의금) → 현장 QR → 웨딩 리포트 → 신랑신부”
            <br />
            이 한 줄로 모든 사용자가 이해하게 만드는 게 목표입니다.
          </p>
        </header>

        {/* ✅ Stripe 스타일: Desktop은 오른쪽 sticky / Mobile은 상단 sticky */}
        <section className="mt-10">
          <div className="grid gap-10 lg:grid-cols-[1fr_520px] lg:items-start">
            {/* LEFT: 설명(스크롤) */}
            <div className="space-y-10">
              {steps.map((s) => (
                <section
                  key={s.id}
                  id={s.id}
                  className="scroll-mt-28 rounded-3xl bg-background/60 backdrop-blur border border-border/60 p-6 sm:p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
                >
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {s.title}
                  </h2>
                  <p className="mt-3 text-muted-foreground leading-relaxed">
                    {s.desc}
                  </p>

                  {/* ✅ 여기서 “실제 섹션 컴포넌트”를 연결 */}
                  {s.id === "sf-step-features" && (
                    <div className="mt-8">
                      <FeaturesSection />
                    </div>
                  )}

                  {s.id === "sf-step-gallery" && (
                    <div className="mt-8">
                      <GallerySection />
                    </div>
                  )}

                  {s.id === "sf-step-delivery" && (
                    <div className="mt-8">
                      <DeliverySection />
                    </div>
                  )}
                </section>
              ))}

              <div className="hidden lg:block">
                <Footer />
              </div>
            </div>

            {/* RIGHT: 다이어그램(Desktop sticky) */}
            <aside className="hidden lg:block">
              <div className="sticky top-10">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    서비스 흐름 다이어그램
                  </p>
                  <span className="text-xs text-muted-foreground">
                    스크롤에 따라 강조됩니다
                  </span>
                </div>
                <FlowDiagram active={activeNode} />
              </div>
            </aside>
          </div>
        </section>

        {/* Mobile: 상단 sticky diagram */}
        <div className="lg:hidden sticky top-0 z-30 mt-10 border-y bg-background/70 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-3">
            <FlowDiagram active={activeNode} />
          </div>
        </div>

        {/* Mobile Footer */}
        <div className="lg:hidden mt-12">
          <Footer />
        </div>
      </div>
    </main>
  );
}
