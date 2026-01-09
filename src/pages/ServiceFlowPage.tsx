import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Footer from "@/components/Footer";

// --- Types & Data ---
type FlowNode = "reserve" | "setup" | "guest" | "message" | "report" | "couple";

interface StepData {
  id: FlowNode;
  sectionId: string;
  title: string;
  desc: string;
  images: string[]; // 다중 이미지 대응
}

const STEPS: StepData[] = [
  {
    id: "reserve",
    sectionId: "sf-reserve",
    title: "01. 예약하기",
    desc: "예식 일자와 기본 연락처만으로 간편하게 시작하세요. 카카오톡으로 예약 확정 메시지가 발송됩니다.",
    images: ["https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=1000"],
  },
  {
    id: "setup",
    sectionId: "sf-setup",
    title: "02. 상세 설정",
    desc: "신랑·신부 정보, 감사 문구, 송금 계좌 등 우리만의 예식 페이지를 맞춤형으로 구성합니다.",
    images: ["https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1000"],
  },
  {
    id: "guest",
    sectionId: "sf-guest",
    title: "03. 하객 참여 및 현장 이벤트",
    desc: "현장에서 QR을 스캔하여 방명록 작성, 축하 메시지 전송, 축의금 송금을 한 번에 해결합니다. 피로연장 대형 화면과 실시간으로 연동됩니다.",
    images: [
      "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=1000", // QR 스캔 장면
      "https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=1000", // 축하 메시지 장면
      "https://images.unsplash.com/photo-1519225495806-7d522f228302?q=80&w=1000", // 피로연 화면 장면
    ],
  },
  {
    id: "report",
    sectionId: "sf-report",
    title: "04. 웨딩 리포트",
    desc: "예식 종료와 동시에 모든 하객 명단, 메시지, 축의 정산 내역이 깔끔한 리포트로 생성됩니다.",
    images: ["https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=1000"],
  },
  {
    id: "couple",
    sectionId: "sf-couple",
    title: "05. 신랑 · 신부",
    desc: "소중한 기록을 영구 보관하고, 하객들에게 보낼 감사 인사까지 간편하게 마무리하세요.",
    images: ["https://images.unsplash.com/photo-1583939003579-730e3918a45a?q=80&w=1000"],
  },
];

// --- Helper Components ---

function StepImage({ images }: { images: string[] }) {
  if (images.length >= 3) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-4 aspect-[4/3] w-full">
        <div className="col-span-1 row-span-2 overflow-hidden rounded-3xl border border-slate-200">
          <img src={images[0]} className="h-full w-full object-cover" alt="flow" />
        </div>
        <div className="overflow-hidden rounded-3xl border border-slate-200">
          <img src={images[1]} className="h-full w-full object-cover" alt="flow" />
        </div>
        <div className="overflow-hidden rounded-3xl border border-slate-200">
          <img src={images[2]} className="h-full w-full object-cover" alt="flow" />
        </div>
      </div>
    );
  }
  return (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-[2.5rem] border border-slate-200 shadow-xl">
      <img src={images[0]} className="h-full w-full object-cover" alt="flow" />
    </div>
  );
}

export default function ServiceFlowPage() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<FlowNode>("reserve");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const step = STEPS.find((s) => s.sectionId === entry.target.id);
            if (step) setActiveId(step.id);
          }
        });
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0.1 }
    );
    STEPS.forEach((s) => {
      const el = document.getElementById(s.sectionId);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <main className="relative min-h-screen bg-white font-sans selection:bg-pink-100">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button onClick={() => navigate("/")} className="text-xl font-bold tracking-tighter">Digital Guestbook</button>
          <div className="flex gap-4">
            <button onClick={() => navigate("/login")} className="text-sm font-medium text-slate-500">로그인</button>
            <button onClick={() => navigate("/reserve")} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800">시작하기</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-20 lg:grid-cols-[1fr_420px]">
          
          {/* LEFT: 시간 흐름 설명 섹션 */}
          <div className="space-y-48">
            {STEPS.map((step) => (
              <section key={step.id} id={step.sectionId} className="scroll-mt-48">
                <div className="mb-10 space-y-4">
                  <div className="inline-flex rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-pink-500 uppercase tracking-widest">
                    {step.id === "reserve" || step.id === "setup" ? "예식 전" : step.id === "couple" || step.id === "report" ? "예식 후" : "예식 당일"}
                  </div>
                  <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">{step.title}</h2>
                  <p className="text-xl leading-relaxed text-slate-500 max-w-xl">{step.desc}</p>
                </div>
                <StepImage images={step.images} />
              </section>
            ))}
          </div>

          {/* RIGHT: 동적 다이어그램 (Stripe/Bridge 스타일) */}
          <div className="hidden lg:block">
            <div className="sticky top-40 flex h-[650px] flex-col items-center justify-center rounded-[3rem] border border-slate-100 bg-slate-50/50 p-12 backdrop-blur-2xl">
              <div className="relative flex flex-col items-center gap-10">
                
                {/* [준비 단계] 흐름 */}
                <div className="flex flex-col items-center gap-6">
                  <DiagramNode active={activeId === "reserve"} icon="📅" label="예약" />
                  <DiagramLine active={activeId === "setup"} />
                  <DiagramNode active={activeId === "setup"} icon="⚙️" label="상세 설정" />
                </div>

                {/* 흐름 끊기 구분선 (Stripe 스타일) */}
                <div className="my-4 h-[1px] w-24 bg-slate-200" />

                {/* [실전 단계] 흐름 시작 */}
                <div className="flex flex-col items-center gap-6">
                  <DiagramNode active={activeId === "guest"} icon="📱" label="하객(QR)" />
                  <div className="relative flex h-16 w-32 items-center justify-center">
                    <DiagramLine active={activeId === "guest"} className="absolute -top-6 h-10" />
                    {/* 분기되는 선 표현 (Bridge 스타일) */}
                    <svg className="absolute inset-0 h-full w-full overflow-visible">
                      <path d="M64,0 L64,20 L20,40 M64,20 L64,40 M64,20 L108,40" fill="none" 
                            stroke={activeId === "guest" ? "#f472b6" : "#e2e8f0"} strokeWidth="2" strokeDasharray="4 4" />
                    </svg>
                  </div>
                  <DiagramNode active={activeId === "report"} icon="📊" label="리포트" />
                  <DiagramLine active={activeId === "couple"} />
                  <DiagramNode active={activeId === "couple"} icon="💍" label="신랑 · 신부" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}

// --- Internal UI Components ---

function DiagramNode({ active, icon, label }: { active: boolean; icon: string; label: string }) {
  return (
    <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${active ? "scale-110 opacity-100" : "scale-90 opacity-10 grayscale"}`}>
      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 bg-white transition-all duration-500 ${active ? "border-pink-400 shadow-[0_0_25px_rgba(244,114,182,0.4)]" : "border-slate-100 shadow-sm"}`}>
        <span className="text-2xl">{icon}</span>
      </div>
      <span className="text-[10px] font-bold text-slate-800 tracking-tighter uppercase">{label}</span>
    </div>
  );
}

function DiagramLine({ active, className }: { active: boolean; className?: string }) {
  return (
    <div className={`h-12 w-[2px] bg-slate-100 transition-all duration-700 overflow-hidden ${className}`}>
      <motion.div 
        animate={{ y: active ? "0%" : "-100%" }}
        transition={{ duration: 0.8 }}
        className="h-full w-full bg-pink-400"
      />
    </div>
  );
}