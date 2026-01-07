import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReducedMotion } from "framer-motion";

import Footer from "@/components/Footer";
import { FeaturesSection } from "@/components/FeaturesSection";
import { GallerySection } from "@/components/GallerySection";
import { DeliverySection } from "@/components/DeliverySection"; // ✅ named export로 수정

type FlowNode =
  | "guest"
  | "congrats"
  | "attendance"
  | "gift"
  | "qr"
  | "report"
  | "couple";

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

  // 메인 흐름 강조(항상 느껴지게)
  const mainOn =
    active === "qr" || active === "report" || active === "couple" ? "opacity-100" : "opacity-70";

  return (
    <div className="relative">
      <div className="relative rounded-3xl border bg-background/75 backdrop-blur p-6 sm:p-7 shadow-[0_18px_60px_rgba(15,23,42,0.08)] overflow-hidden">
        {/* 배경 */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(120,119,198,0.16),transparent_58%),radial-gradient(circle_at_82%_22%,rgba(244,114,182,0.14),transparent_58%),radial-gradient(circle_at_50%_90%,rgba(253,224,71,0.10),transparent_62%)]" />
        <div className="relative">
          {/* PC */}
          <div className="hidden md:grid grid-cols-[200px_360px_160px_160px_160px] gap-4 items-center">
            {/* 하객 */}
            <div className={cls("guest", lightBlue)}>
              <div className="text-sm font-semibold opacity-90">하객</div>
              <div className="mt-1 text-xs font-normal opacity-80">QR로 참여</div>
            </div>

            {/* 하객 입력 3개 그룹 */}
            <div className="relative rounded-3xl border bg-background/55 backdrop-blur p-4">
              <div className="text-xs font-semibold text-muted-foreground mb-3">
                하객이 남기는 3가지
              </div>
              <div className="grid grid-rows-3 gap-2">
                <div className={cls("congrats", deepBlue)}>축하메시지</div>
                <div className={cls("attendance", deepBlue)}>현장참석 방명록</div>
                <div className={cls("gift", deepBlue)}>축의금</div>
              </div>

              {/* 그룹 → QR 화살표 느낌 */}
              <div className="pointer-events-none absolute -right-5 top-1/2 -translate-y-1/2">
                <div className="h-[2px] w-10 bg-foreground/25" />
              </div>
            </div>

            {/* QR */}
            <div className={`${cls("qr", orange)} ${mainOn}`}>
              <div className="text-sm font-semibold">현장 QR</div>
              <div className="mt-1 text-xs font-normal opacity-85">모든 입력이 모이는 곳</div>
            </div>

            {/* 리포트 */}
            <div className={`${cls("report", green)} ${mainOn}`}>
              <div className="text-sm font-semibold">웨딩 리포트</div>
              <div className="mt-1 text-xs font-normal opacity-85">Excel · 영상 · 링크</div>
            </div>

            {/* 신랑신부 */}
            <div className={`${cls("couple", green2)} ${mainOn}`}>
              <div className="text-sm font-semibold">신랑 신부</div>
              <div className="mt-1 text-xs font-normal opacity-85">정산·감사·보관</div>
            </div>
          </div>

          {/* 메인 흐름 라인(PC 전용) */}
          <div className="hidden md:block pointer-events-none">
            {/* QR → 리포트 */}
            <div className={`absolute left-[200px+360px+16px] top-1/2 ${mainOn}`} />
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 1000 160"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="rgba(15,23,42,0.35)" />
                </marker>
              </defs>

              {/* 대략적인 위치: 좌측 입력그룹(중앙) → QR → 리포트 → 신랑신부 */}
              <path
                d="M560 80 L700 80"
                stroke="rgba(15,23,42,0.28)"
                strokeWidth="2"
                markerEnd="url(#arrow)"
              />
              <path
                d="M720 80 L860 80"
                stroke="rgba(15,23,42,0.28)"
                strokeWidth="2"
                markerEnd="url(#arrow)"
              />
            </svg>
          </div>

          {/* Mobile: 세로로 더 깔끔하게 */}
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

          {/* 설명 */}
          <p className="mt-5 text-xs sm:text-sm text-muted-foreground">
            <span className="text-foreground font-semibold">하객의 3가지 입력</span>이{" "}
            <span className="text-foreground font-semibold">현장 QR</span>로 모이고,
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

  const sectionIds = useMemo(
    () => ["sf-qr", "sf-features", "sf-gallery", "sf-delivery"],
    []
  );
  const activeSection = useInViewIds(sectionIds);

  const activeNode: FlowNode = useMemo(() => {
    switch (activeSection) {
      case "sf-qr":
        return "qr";
      case "sf-features":
        return "congrats";
      case "sf-gallery":
        return "attendance";
      case "sf-delivery":
        return "report";
      default:
        return "qr";
    }
  }, [activeSection]);

  return (
    <main className="min-h-screen">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(120,119,198,0.18),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.18),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(253,224,71,0.10),transparent_60%)]" />

        <div className="relative mx-auto max-w-7xl px-6 pt-14 pb-6 lg:pt-18">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">서비스 흐름</p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
                하객의 마음이 <span className="wedding-gradient">QR → 리포트</span>로 정리됩니다
              </h1>
              <p className="mt-3 text-base text-muted-foreground max-w-2xl">
                “하객 → (축하메시지/참석/축의금) → 현장 QR → 웨딩 리포트 → 신랑신부”
                이 한 줄로 모든 사용자가 이해하게 만드는 게 목표입니다.
              </p>
            </div>

            <div className="hidden sm:flex gap-2">
              <button
                onClick={() => navigate("/")}
                className="h-10 px-4 rounded-full border bg-background/70 hover:bg-background transition text-sm"
              >
                홈으로
              </button>
              <button
                onClick={() => navigate("/reserve")}
                className="h-10 px-4 rounded-full bg-foreground text-background hover:opacity-90 transition text-sm font-semibold"
              >
                예약문의
              </button>
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <FlowDiagram active={activeNode} />
          </div>
        </div>
      </section>

      <section id="sf-qr" className="mx-auto max-w-7xl px-6 py-14">
        <div className="max-w-3xl">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            1) 현장 QR 하나로 시작
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            하객은 QR만 스캔하면 즉시 참여합니다. 별도 앱 설치 없이,
            축하메시지/참석 방명록/축의금 입력이{" "}
            <span className="text-foreground font-semibold">한 흐름</span>으로 연결됩니다.
          </p>
        </div>
      </section>

      <div id="sf-features">
        <FeaturesSection />
      </div>

      <div id="sf-gallery">
        <GallerySection />
      </div>

      <div id="sf-delivery">
        <DeliverySection />
      </div>

      <Footer />
    </main>
  );
}
