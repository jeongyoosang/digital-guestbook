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
  const on = (node: FlowNode) => active === node;

  const baseNode =
    "rounded-2xl px-5 py-4 text-sm sm:text-base font-semibold shadow-sm border transition";
  const lightBlue = "bg-[#A8D4FF]/80 text-[#0B3553] border-[#7DBEF7]";
  const deepBlue = "bg-[#0C5A78] text-white border-white/10";
  const orange = "bg-[#F07C3D] text-white border-white/10";
  const green = "bg-[#3FAE2A] text-white border-white/10";
  const green2 = "bg-[#2FA83E] text-white border-white/10";

  const nodeCls = (node: FlowNode, base: string) =>
    `${baseNode} ${base} ${
      on(node) ? "ring-2 ring-foreground/30 scale-[1.01]" : "opacity-80"
    } ${reduceMotion ? "" : "will-change-transform"}`;

  return (
    <div className="relative">
      <div className="relative rounded-3xl border bg-background/70 backdrop-blur p-5 sm:p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(120,119,198,0.14),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.12),transparent_55%),radial-gradient(circle_at_50%_85%,rgba(253,224,71,0.08),transparent_60%)]" />
        <div className="relative">
          {/* PC */}
          <div className="hidden md:grid grid-cols-[180px_1fr_140px_140px_140px] gap-4 items-center">
            <div className={nodeCls("guest", lightBlue)}>하객</div>

            <div className="grid grid-rows-3 gap-3">
              <div className={nodeCls("congrats", deepBlue)}>축하메시지</div>
              <div className={nodeCls("attendance", deepBlue)}>현장참석 방명록</div>
              <div className={nodeCls("gift", deepBlue)}>축의금</div>
            </div>

            <div className={nodeCls("qr", orange)}>현장 QR</div>
            <div className={nodeCls("report", green)}>웨딩 리포트</div>
            <div className={nodeCls("couple", green2)}>신랑 신부</div>
          </div>

          {/* Mobile */}
          <div className="md:hidden grid gap-3">
            <div className={nodeCls("guest", lightBlue)}>하객</div>

            <div className="grid gap-2">
              <div className={nodeCls("congrats", deepBlue)}>축하메시지</div>
              <div className={nodeCls("attendance", deepBlue)}>현장참석 방명록</div>
              <div className={nodeCls("gift", deepBlue)}>축의금</div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className={nodeCls("qr", orange)}>현장 QR</div>
              <div className={nodeCls("report", green)}>웨딩 리포트</div>
              <div className={nodeCls("couple", green2)}>신랑 신부</div>
            </div>
          </div>

          <p className="mt-4 text-xs sm:text-sm text-muted-foreground">
            하객의{" "}
            <span className="text-foreground font-semibold">
              축하메시지 · 참석 방명록 · 축의금
            </span>
            이 <span className="text-foreground font-semibold">현장 QR</span>로 모이고,
            <span className="text-foreground font-semibold"> 웨딩 리포트</span>로 정리되어
            신랑신부에게 전달됩니다.
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
