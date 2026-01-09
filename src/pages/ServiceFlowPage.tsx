import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Footer from "@/components/Footer";

type FlowNode = "reserve" | "setup" | "guest" | "report" | "couple";

interface StepData {
  id: FlowNode;
  sectionId: string;
  title: string;
  desc: string;
  dDay: string;
  icon: string;
  label: string;
  images: string[];
  theme: "prep" | "event" | "post";
}

const STEPS: StepData[] = [
  { 
    id: "reserve", 
    sectionId: "sf-reserve", 
    title: "01. 예약하기", 
    desc: "예식 일자와 연락처만으로 간편하게 시작하세요. 예약 양식을 제출하면 카카오톡으로 즉시 안내 메시지가 발송됩니다.", 
    dDay: "D-30 ~ 180", 
    icon: "📅", 
    label: "예약하기",
    images: ["/serviceflow1.jpg", "/serviceflow1-2.jpg"], 
    theme: "prep" 
  },
  { 
    id: "setup", 
    sectionId: "sf-setup", 
    title: "02. 상세 설정", 
    desc: "신랑·신부 정보, 감사 문구, 계좌 등 우리만의 예식 페이지를 맞춤 구성합니다.", 
    dDay: "D-14 ~ 30", 
    icon: "⚙️", 
    label: "상세 설정", 
    images: ["/serviceflow2.jpg"], // 새로 추가된 이미지
    theme: "prep" 
  },
  { id: "guest", sectionId: "sf-guest", title: "03. 하객 참여 및 현장 이벤트", desc: "QR 스캔으로 방명록, 메시지, 축의금 송금을 한 번에. 피로연장 화면과 실시간 연동됩니다.", dDay: "D-Day", icon: "👥", label: "하객 참여", images: ["https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=1000"], theme: "event" },
  { id: "report", sectionId: "sf-report", title: "04. 웨딩 리포트", desc: "예식 종료와 동시에 명단, 메시지, 정산 내역이 깔끔한 리포트로 생성됩니다.", dDay: "D-Day (종료)", icon: "📊", label: "웨딩 리포트", images: ["https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=1000"], theme: "post" },
  { id: "couple", sectionId: "sf-couple", title: "05. 신랑 · 신부", desc: "소중한 기록을 영구 보관하고 하객들에게 감사 인사를 전하며 마무리하세요.", dDay: "D-Day +", icon: "💍", label: "신랑 · 신부", images: ["https://images.unsplash.com/photo-1583939003579-730e3918a45a?q=80&w=1000"], theme: "post" },
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
          <button onClick={() => navigate("/")} className="text-xl font-bold tracking-tighter uppercase">Digital Guestbook</button>
          <button onClick={() => navigate("/reserve")} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:scale-105">시작하기</button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="grid gap-16 lg:grid-cols-[1fr_380px]">
          <div className="space-y-40 lg:space-y-64">
            {STEPS.map((step) => (
              <section key={step.id} id={step.sectionId} className="scroll-mt-48">
                <div className="mb-8 space-y-3">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${step.theme === 'prep' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : step.theme === 'event' ? 'bg-pink-50 text-pink-600 border-pink-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{step.dDay}</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 lg:text-4xl">{step.title}</h2>
                  <p className="text-lg leading-relaxed text-slate-500">{step.desc}</p>
                </div>

                {/* 중앙 정렬 & 상단 정렬 최적화된 폰 목업 */}
                <div className="flex flex-wrap gap-8 justify-center">
                  {step.images.map((img, idx) => (
                    <div 
                      key={idx} 
                      className={`overflow-hidden transition-all duration-500 bg-slate-900 shadow-2xl relative
                        ${(step.id === "reserve" || step.id === "setup")
                          ? "w-[42%] lg:w-[260px] aspect-[9/19] rounded-[3rem] border-[12px] border-slate-900" 
                          : "w-full lg:w-[500px] aspect-video rounded-[2rem] border border-slate-100"
                        }`}
                    >
                      <img 
                        src={img} 
                        alt={step.title} 
                        className={`h-full w-full bg-white ${(step.id === "reserve" || step.id === "setup") ? "object-cover object-top" : "object-cover"}`} 
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* RIGHT: Diagram (3D Flip 버전 유지) */}
          <div className="hidden lg:block">
            <div className="sticky top-44 flex flex-col items-center rounded-[4rem] bg-slate-50/40 p-12 backdrop-blur-xl border border-slate-100 shadow-sm h-auto">
              <DiagramNode active={activeId === "reserve"} icon="📅" label="예약하기" theme="prep" />
              <Arrow active={activeId === "setup"} />
              <DiagramNode active={activeId === "setup"} icon="⚙️" label="상세 설정" theme="prep" />
              <div className="h-6" />
              <DiagramNode active={activeId === "guest"} icon="👥" label="하객 참여" theme="event" />
              <Arrow active={activeId === "guest"} />
              <div className={`relative p-6 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 ${activeId === "guest" ? "border-pink-300 bg-white shadow-xl scale-105" : "border-slate-200 opacity-50 bg-white/30"}`}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pink-400 text-[9px] text-white px-3 py-1 rounded-full font-black uppercase tracking-wider">QR Zone</div>
                <div className="flex gap-6">
                   <FlipIcon icon="✍️" label="방명록" />
                   <div className="border-x border-slate-100 px-6"><FlipIcon icon="💬" label="메시지" /></div>
                   <FlipIcon icon="💸" label="축의금" />
                </div>
              </div>
              <Arrow active={activeId === "report"} />
              <DiagramNode active={activeId === "report"} icon="📊" label="웨딩 리포트" theme="post" />
              <Arrow active={activeId === "couple"} />
              <DiagramNode active={activeId === "couple"} icon="💍" label="신랑 · 신부" theme="post" />
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}

// --- Flip & Arrow Helpers (기존 동일) ---
function FlipIcon({ icon, label }: { icon: string; label: string }) {
  const [isHover, setIsHover] = useState(false);
  return (
    <div className="relative h-12 w-16 cursor-default [perspective:1000px]" onMouseEnter={() => setIsHover(true)} onMouseLeave={() => setIsHover(false)}>
      <motion.div className="relative h-full w-full transition-all duration-500 [transform-style:preserve-3d]" animate={{ rotateY: isHover ? 180 : 0 }}>
        <div className="absolute inset-0 flex items-center justify-center [backface-visibility:hidden]"><span className="text-3xl">{icon}</span></div>
        <div className="absolute inset-0 flex items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)]"><span className="text-[12px] font-bold text-slate-800">{label}</span></div>
      </motion.div>
    </div>
  );
}

function DiagramNode({ active, icon, label, theme }: any) {
  const [isHover, setIsHover] = useState(false);
  const activeStyles = {
    prep: "border-indigo-400 shadow-[0_10px_25px_rgba(99,102,241,0.2)] ring-4 ring-indigo-50",
    event: "border-pink-400 shadow-[0_10px_25px_rgba(244,114,182,0.2)] ring-4 ring-pink-50",
    post: "border-emerald-400 shadow-[0_10px_25px_rgba(16,185,129,0.2)] ring-4 ring-emerald-50",
  }[theme as "prep"|"event"|"post"];

  return (
    <div className="relative [perspective:1000px] w-28 h-16" onMouseEnter={() => setIsHover(true)} onMouseLeave={() => setIsHover(false)}>
      <motion.div 
        animate={{ rotateY: isHover ? 180 : 0, scale: active ? 1.1 : 1, opacity: active ? 1 : 0.6 }}
        className={`relative h-full w-full rounded-2xl border-2 bg-white transition-all duration-500 [transform-style:preserve-3d] ${active ? activeStyles : "border-slate-100"}`}
      >
        <div className="absolute inset-0 flex items-center justify-center [backface-visibility:hidden]"><span className="text-3xl">{icon}</span></div>
        <div className="absolute inset-0 flex items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white rounded-2xl">
          <span className="text-[14px] font-black text-slate-800 text-center">{label}</span>
        </div>
      </motion.div>
    </div>
  );
}

function Arrow({ active }: { active?: boolean }) {
  return (
    <div className="flex justify-center my-1.5">
      <svg width="24" height="40" viewBox="0 0 24 40" fill="none">
        <path d="M12 0V38M12 38L6 32M12 38L18 32" stroke={active ? "#94a3b8" : "#cbd5e1"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}