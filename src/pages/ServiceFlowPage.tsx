import { useEffect, useState } from "react";
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
  { id: "reserve", sectionId: "sf-reserve", title: "01. 예약하기", desc: "예식 일자와 연락처만으로 간편하게 시작하세요. 예약 확정 알림이 즉시 발송됩니다.", dDay: "D-30 ~ 180", icon: "📅", images: ["https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=1000"], theme: "prep" },
  { id: "setup", sectionId: "sf-setup", title: "02. 상세 설정", desc: "신랑·신부 정보, 감사 문구, 계좌 등 우리만의 예식 페이지를 맞춤 구성합니다.", dDay: "D-14 ~ 30", icon: "⚙️", images: ["https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1000"], theme: "prep" },
  { id: "guest", sectionId: "sf-guest", title: "03. 하객 참여 및 현장 이벤트", desc: "QR 스캔으로 방명록, 메시지, 축의금 송금을 한 번에. 피로연장 화면과 실시간 연동됩니다.", dDay: "D-Day", icon: "👥", images: ["https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=1000", "https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=1000", "https://images.unsplash.com/photo-1519225495806-7d522f228302?q=80&w=1000"], theme: "event" },
  { id: "report", sectionId: "sf-report", title: "04. 웨딩 리포트", desc: "예식 종료와 동시에 명단, 메시지, 정산 내역이 깔끔한 리포트로 생성됩니다.", dDay: "D-Day (종료)", icon: "📊", images: ["https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=1000"], theme: "post" },
  { id: "couple", sectionId: "sf-couple", title: "05. 신랑 · 신부", desc: "소중한 기록을 영구 보관하고 하객들에게 감사 인사를 전하며 마무리하세요.", dDay: "D-Day +", icon: "💍", images: ["https://images.unsplash.com/photo-1583939003579-730e3918a45a?q=80&w=1000"], theme: "post" },
];

export default function ServiceFlowPage() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<FlowNode>("reserve");

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const step = STEPS.find((s) => s.sectionId === entry.target.id);
          if (step) setActiveId(step.id);
        }
      });
    }, { rootMargin: "-30% 0px -50% 0px", threshold: 0.1 });
    STEPS.forEach((s) => { const el = document.getElementById(s.sectionId); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  return (
    <main className="relative min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-slate-50 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button onClick={() => navigate("/")} className="text-xl font-bold tracking-tighter">Digital Guestbook</button>
          <button onClick={() => navigate("/reserve")} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:scale-105">시작하기</button>
        </div>
      </header>

      {/* Mobile Top Nav (유지) */}
      <div className="sticky top-[65px] z-40 flex w-full justify-around bg-white/90 p-3 backdrop-blur-md border-b border-slate-100 lg:hidden">
        {STEPS.map((step) => {
          const isActive = activeId === step.id;
          const themeColor = step.theme === 'prep' ? 'border-indigo-400' : step.theme === 'event' ? 'border-pink-400' : 'border-emerald-400';
          return (
            <div key={step.id} className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 transition-all duration-300 ${isActive ? `${themeColor} bg-white shadow-md scale-110` : "border-transparent opacity-20"}`}>
              <span className="text-xl">{step.icon}</span>
            </div>
          );
        })}
      </div>

      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="grid gap-16 lg:grid-cols-[1fr_380px]">
          {/* LEFT: Cards */}
          <div className="space-y-40 lg:space-y-64">
            {STEPS.map((step) => (
              <section key={step.id} id={step.sectionId} className="scroll-mt-48">
                <div className="mb-8 space-y-3">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${step.theme === 'prep' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : step.theme === 'event' ? 'bg-pink-50 text-pink-600 border-pink-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{step.dDay}</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 lg:text-4xl">{step.title}</h2>
                  <p className="text-lg leading-relaxed text-slate-500">{step.desc}</p>
                </div>
                <div className={step.images.length >= 3 ? "grid grid-cols-2 gap-3" : "block"}>
                  {step.images.map((img, idx) => (
                    <div key={idx} className={`overflow-hidden rounded-[2.5rem] border border-slate-100 shadow-xl ${step.images.length >= 3 && idx === 0 ? "row-span-2" : ""}`}>
                      <img src={img} alt={step.title} className="h-full w-full object-cover aspect-[4/3]" />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* RIGHT: Fixed Diagram (Icon Only + Tooltip) */}
          <div className="hidden lg:block">
            <div className="sticky top-44 flex flex-col items-center rounded-[4rem] bg-slate-50/40 p-12 backdrop-blur-xl border border-slate-100 shadow-sm h-auto">
              
              <DiagramNode active={activeId === "reserve"} icon="📅" label="예약하기" theme="prep" />
              <Arrow active={activeId === "setup"} theme="prep" />
              <DiagramNode active={activeId === "setup"} icon="⚙️" label="상세 설정" theme="prep" />
              
              <div className="h-6" />
              <DiagramNode active={activeId === "guest"} icon="👥" label="하객 참여" theme="event" />
              <Arrow active={activeId === "guest"} theme="event" />
              
              <div className={`relative p-6 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 ${activeId === "guest" ? "border-pink-300 bg-white shadow-xl scale-105" : "border-slate-200 opacity-5"}`}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pink-400 text-[9px] text-white px-3 py-1 rounded-full font-black uppercase tracking-wider">QR Zone</div>
                <div className="flex gap-6">
                   <TooltipWrapper label="방명록"><span className="text-3xl hover:scale-125 transition-transform">✍️</span></TooltipWrapper>
                   <TooltipWrapper label="메시지"><span className="text-3xl hover:scale-125 transition-transform px-6 border-x border-slate-50">💬</span></TooltipWrapper>
                   <TooltipWrapper label="축의금"><span className="text-3xl hover:scale-125 transition-transform">💸</span></TooltipWrapper>
                </div>
              </div>

              <Arrow active={activeId === "report"} theme="event" />
              <DiagramNode active={activeId === "report"} icon="📊" label="웨딩 리포트" theme="post" />
              <Arrow active={activeId === "couple"} theme="post" />
              <DiagramNode active={activeId === "couple"} icon="💍" label="신랑 · 신부" theme="post" />
              
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}

// --- Tooltip & UI Helpers ---

function TooltipWrapper({ children, label }: { children: React.ReactNode; label: string }) {
  const [isHover, setIsHover] = useState(false);
  return (
    <div className="relative flex items-center justify-center" onMouseEnter={() => setIsHover(true)} onMouseLeave={() => setIsHover(false)}>
      {children}
      <AnimatePresence>
        {isHover && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute -bottom-10 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white shadow-xl z-50">
            {label}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-bottom-4 border-slate-900" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DiagramNode({ active, icon, label, theme }: any) {
  const [isHover, setIsHover] = useState(false);
  const colors = {
    prep: active ? "border-indigo-400 shadow-[0_10px_25px_rgba(99,102,241,0.25)]" : "border-slate-100",
    event: active ? "border-pink-400 shadow-[0_10px_25px_rgba(244,114,182,0.25)]" : "border-slate-100",
    post: active ? "border-emerald-400 shadow-[0_10px_25px_rgba(16,185,129,0.25)]" : "border-slate-100",
  }[theme as "prep"|"event"|"post"];

  return (
    <div className="relative flex justify-center" onMouseEnter={() => setIsHover(true)} onMouseLeave={() => setIsHover(false)}>
      <div className={`flex h-16 w-16 items-center justify-center rounded-[1.5rem] border-2 bg-white transition-all duration-500 ${active ? `scale-110 opacity-100 ${colors}` : "opacity-10 scale-90"}`}>
        <span className="text-3xl">{icon}</span>
      </div>
      
      {/* Tooltip on Hover */}
      <AnimatePresence>
        {isHover && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 10 }} exit={{ opacity: 0, x: 20 }}
            className="absolute left-full ml-4 whitespace-nowrap rounded-xl bg-white border border-slate-100 px-4 py-2 text-xs font-bold text-slate-800 shadow-2xl z-50">
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Arrow({ active, theme }: any) {
  const color = active ? (theme === "prep" ? "#6366f1" : theme === "event" ? "#f472b6" : "#10b981") : "#f1f5f9";
  return (
    <div className="flex justify-center my-1.5">
      <svg width="24" height="40" viewBox="0 0 24 40" fill="none">
        <path d="M12 0V38M12 38L6 32M12 38L18 32" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}