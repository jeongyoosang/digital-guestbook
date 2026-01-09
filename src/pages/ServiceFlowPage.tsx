import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Footer from "@/components/Footer";

// --- Types & Data ---
type FlowNode = "reserve" | "setup" | "guest" | "report" | "couple";

interface StepData {
  id: FlowNode;
  sectionId: string;
  title: string;
  desc: string;
  dDay: string;
  icon: string;
  images: string[];
  theme: "prep" | "event" | "post";
}

const STEPS: StepData[] = [
  {
    id: "reserve",
    sectionId: "sf-reserve",
    title: "01. 예약하기",
    desc: "예식 일자와 기본 연락처만으로 간편하게 시작하세요. 카카오톡으로 예약 확정 메시지가 발송됩니다.",
    dDay: "D-30 ~ 180",
    icon: "📅",
    images: ["https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=1000"],
    theme: "prep",
  },
  {
    id: "setup",
    sectionId: "sf-setup",
    title: "02. 상세 설정",
    desc: "신랑·신부 정보, 감사 문구, 송금 계좌 등 우리만의 예식 페이지를 맞춤형으로 구성합니다.",
    dDay: "D-14 ~ 30",
    icon: "⚙️",
    images: ["https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1000"],
    theme: "prep",
  },
  {
    id: "guest",
    sectionId: "sf-guest",
    title: "03. 하객 참여 및 현장 이벤트",
    desc: "현장에서 QR을 스캔하여 방명록 작성, 축하 메시지 전송, 축의금 송금을 한 번에 해결합니다.",
    dDay: "D-Day",
    icon: "👥",
    images: [
      "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=1000",
      "https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=1000",
      "https://images.unsplash.com/photo-1519225495806-7d522f228302?q=80&w=1000",
    ],
    theme: "event",
  },
  {
    id: "report",
    sectionId: "sf-report",
    title: "04. 웨딩 리포트",
    desc: "예식 종료와 동시에 모든 하객 명단, 메시지, 축의 정산 내역이 깔끔한 리포트로 생성됩니다.",
    dDay: "D-Day (종료 직후)",
    icon: "📊",
    images: ["https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=1000"],
    theme: "post",
  },
  {
    id: "couple",
    sectionId: "sf-couple",
    title: "05. 신랑 · 신부",
    desc: "소중한 기록을 영구 보관하고, 하객들에게 보낼 감사 인사까지 간편하게 마무리하세요.",
    dDay: "D-Day +",
    icon: "💍",
    images: ["https://images.unsplash.com/photo-1583939003579-730e3918a45a?q=80&w=1000"],
    theme: "post",
  },
];

// --- Sub Components ---

function Badge({ text, theme }: { text: string; theme: string }) {
  const colors = {
    prep: "bg-indigo-50 text-indigo-600 border-indigo-100",
    event: "bg-pink-50 text-pink-600 border-pink-100",
    post: "bg-emerald-50 text-emerald-600 border-emerald-100",
  }[theme];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${colors}`}>
      {text}
    </span>
  );
}

function MobileNav({ activeId }: { activeId: FlowNode }) {
  return (
    <div className="sticky top-[65px] z-40 flex w-full justify-around bg-white/90 p-2 backdrop-blur-md border-b border-slate-100 lg:hidden">
      {STEPS.map((step) => (
        <div key={step.id} className="flex flex-col items-center gap-1">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-all ${
            activeId === step.id 
            ? (step.theme === "prep" ? "border-indigo-400 bg-white shadow-lg" : step.theme === "event" ? "border-pink-400 bg-white shadow-lg" : "border-emerald-400 bg-white shadow-lg")
            : "border-transparent opacity-30"
          }`}>
            <span className="text-lg">{step.icon}</span>
          </div>
          {activeId === step.id && (
            <motion.div layoutId="m-indicator" className={`h-1 w-4 rounded-full ${step.theme === "prep" ? "bg-indigo-400" : step.theme === "event" ? "bg-pink-400" : "bg-emerald-400"}`} />
          )}
        </div>
      ))}
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
      { rootMargin: "-30% 0px -50% 0px", threshold: 0.1 }
    );
    STEPS.forEach((s) => {
      const el = document.getElementById(s.sectionId);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <main className="relative min-h-screen bg-white">
      {/* PC & Mobile Shared Header */}
      <header className="sticky top-0 z-50 border-b border-slate-50 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button onClick={() => navigate("/")} className="text-xl font-bold tracking-tighter">Digital Guestbook</button>
          <button onClick={() => navigate("/reserve")} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white">시작하기</button>
        </div>
      </header>

      {/* Mobile Only Navigator */}
      <MobileNav activeId={activeId} />

      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="grid gap-16 lg:grid-cols-[1fr_380px]">
          
          {/* LEFT: 카드 섹션 */}
          <div className="space-y-40 lg:space-y-64">
            {STEPS.map((step) => (
              <section key={step.id} id={step.sectionId} className="scroll-mt-48">
                <div className="mb-8 space-y-3">
                  <Badge text={step.dDay} theme={step.theme} />
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 lg:text-4xl">{step.title}</h2>
                  <p className="text-lg leading-relaxed text-slate-500">{step.desc}</p>
                </div>
                
                {/* Image Gallery */}
                <div className={step.images.length >= 3 ? "grid grid-cols-2 gap-3 lg:gap-4" : "block"}>
                  {step.images.map((img, idx) => (
                    <div key={idx} className={`overflow-hidden rounded-[2rem] border border-slate-100 shadow-xl ${step.images.length >= 3 && idx === 0 ? "row-span-2" : ""}`}>
                      <img src={img} alt={step.title} className="h-full w-full object-cover aspect-[4/3]" />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* RIGHT: PC 고정 다이어그램 */}
          <div className="hidden lg:block">
            <div className="sticky top-44 flex h-[680px] flex-col items-center justify-start rounded-[3.5rem] bg-slate-50/50 p-10 backdrop-blur-xl border border-white shadow-sm">
              <DiagramFlow activeId={activeId} />
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}

// --- Desktop Diagram Sub-logic ---

function DiagramFlow({ activeId }: { activeId: FlowNode }) {
  return (
    <div className="flex flex-col items-center w-full">
      <DesktopNode active={activeId === "reserve"} icon="📅" label="예약" theme="prep" />
      <Arrow active={activeId === "setup"} theme="prep" />
      <DesktopNode active={activeId === "setup"} icon="⚙️" label="설정" theme="prep" />
      
      <div className="h-8" />
      
      <DesktopNode active={activeId === "guest"} icon="👥" label="하객" theme="event" />
      <Arrow active={activeId === "guest"} theme="event" />
      
      <div className={`relative p-5 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 ${activeId === "guest" ? "border-pink-300 bg-white shadow-xl scale-105" : "border-slate-200 opacity-20"}`}>
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pink-400 text-[9px] text-white px-3 py-1 rounded-full font-bold">QR ZONE</div>
        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-xl">✍️</div>
            <div className="text-[9px] mt-1 font-bold">방명록</div>
          </div>
          <div className="text-center border-x border-slate-100 px-4">
            <div className="text-xl">💬</div>
            <div className="text-[9px] mt-1 font-bold">메시지</div>
          </div>
          <div className="text-center">
            <div className="text-xl">💸</div>
            <div className="text-[9px] mt-1 font-bold">축의금</div>
          </div>
        </div>
      </div>

      <Arrow active={activeId === "report"} theme="event" />
      <DesktopNode active={activeId === "report"} icon="📊" label="리포트" theme="post" />
      <Arrow active={activeId === "couple"} theme="post" />
      <DesktopNode active={activeId === "couple"} icon="💍" label="정리완료" theme="post" />
    </div>
  );
}

function DesktopNode({ active, icon, label, theme }: any) {
  const colors = {
    prep: active ? "border-indigo-400 shadow-[0_10px_25px_rgba(99,102,241,0.3)]" : "border-slate-100",
    event: active ? "border-pink-400 shadow-[0_10px_25px_rgba(244,114,182,0.3)]" : "border-slate-100",
    post: active ? "border-emerald-400 shadow-[0_10px_25px_rgba(16,185,129,0.3)]" : "border-slate-100",
  }[theme as "prep" | "event" | "post"];

  return (
    <div className={`flex flex-col items-center gap-2 transition-all duration-700 ${active ? "opacity-100" : "opacity-10 scale-90"}`}>
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 bg-white ${colors}`}>
        <span className="text-2xl">{icon}</span>
      </div>
      <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-tighter">{label}</span>
    </div>
  );
}

function Arrow({ active, theme }: any) {
  const color = active ? (theme === "prep" ? "#6366f1" : theme === "event" ? "#f472b6" : "#10b981") : "#f1f5f9";
  return (
    <div className="my-1">
      <svg width="24" height="40" viewBox="0 0 24 40" fill="none">
        <path d="M12 0V38M12 38L6 32M12 38L18 32" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}