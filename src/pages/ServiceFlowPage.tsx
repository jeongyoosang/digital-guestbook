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
  video?: string;
  theme: "prep" | "event" | "post";
}

const STEPS: StepData[] = [
  { id: "reserve", sectionId: "sf-reserve", title: "01. 예약하기", desc: "예식 일자와 연락처만으로 간편하게 시작하세요. 예약 양식을 제출하면 카카오톡으로 즉시 안내 메시지가 발송됩니다.", dDay: "D-30 ~ 180", icon: "📅", label: "예약하기", images: ["/serviceflow1-0.jpg", "/serviceflow1.jpg", "/serviceflow1-2.jpg"], theme: "prep" },
  { id: "setup", sectionId: "sf-setup", title: "02. 상세 설정", desc: "신랑·신부 정보, 감사 문구, 계좌 등 우리만의 예식 페이지를 맞춤 구성합니다.", dDay: "D-14 ~ 30", icon: "⚙️", label: "상세 설정", images: ["/serviceflow2-1.jpg", "/serviceflow2.jpg", "/serviceflow2-2.jpg"], theme: "prep" },
  { id: "guest", sectionId: "sf-guest", title: "03. 하객 참여 및 현장 이벤트", desc: "QR 스캔으로 방명록, 축하 메시지, 축의금 송금을 한 번에. 피로연장 화면과 실시간 연동됩니다.", dDay: "D-Day", icon: "👥", label: "하객 참여", images: ["/serviceflow3.jpg", "/serviceflow3-1.jpg", "/serviceflow3-2.jpg"], video: "/serviceflow3-3.mp4", theme: "event" },
  { id: "report", sectionId: "sf-report", title: "04. 웨딩 리포트", desc: "예식 종료와 동시에 명단, 메시지, 정산 내역이 깔끔한 리포트로 생성됩니다.", dDay: "D-Day (종료)", icon: "📊", label: "웨딩 리포트", images: ["/serviceflow2.jpg"], theme: "post" }, // 이미지 경로 수정 필요 시 반영
  { id: "couple", sectionId: "sf-couple", title: "05. 신랑 · 신부", desc: "소중한 기록을 영구 보관하고 하객들에게 감사 인사를 전하며 마무리하세요.", dDay: "D-Day +", icon: "💍", label: "신랑 · 신부", images: ["/serviceflow1.jpg"], theme: "post" },
];

export default function ServiceFlowPage() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<FlowNode>("reserve");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const step = STEPS.find((s) => s.sectionId === entry.target.id);
            if (step) setActiveId(step.id as FlowNode);
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

  const activeIdx = STEPS.findIndex(s => s.id === activeId);

  return (
    <main className="relative min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-slate-50 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button onClick={() => navigate("/")} className="text-xl font-bold tracking-tighter uppercase">Digital Guestbook</button>
          <button onClick={() => navigate("/reserve")} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:scale-105">시작하기</button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
        <div className="grid gap-16 lg:grid-cols-[1fr_420px]">
          {/* Left Content */}
          <div className="space-y-40 lg:space-y-64">
            {STEPS.map((step) => (
              <section key={step.id} id={step.sectionId} className="scroll-mt-48">
                <div className="mb-8 space-y-3">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${step.theme === 'prep' ? 'bg-indigo-50 text-indigo-600' : step.theme === 'event' ? 'bg-pink-50 text-pink-600' : 'bg-emerald-50 text-emerald-600'}`}>{step.dDay}</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 lg:text-4xl">{step.title}</h2>
                  <p className="text-lg leading-relaxed text-slate-500 whitespace-pre-line">
                    {step.desc}
                    {step.id === "guest" && (
                      <span className="block mt-2 text-sm text-slate-400 font-medium">*기본 스탠드형 디스플레이 1대 제공</span>
                    )}
                  </p>
                </div>
                {/* Image/Video Area */}
                <div className="flex justify-center">
                    {step.id === "guest" ? (
                        <div className="w-full lg:max-w-3xl space-y-4">
                            <video autoPlay muted loop playsInline className="w-full rounded-[1.5rem] border shadow-lg bg-black"><source src={step.video} type="video/mp4" /></video>
                        </div>
                    ) : (
                        <img src={step.images[0]} alt={step.title} className="w-full lg:max-w-3xl rounded-[1.5rem] border shadow-lg object-contain bg-slate-50" />
                    )}
                </div>
              </section>
            ))}
          </div>

          {/* Right Diagram */}
          <div className="hidden lg:block">
            <div className="sticky top-24 flex flex-col items-center pt-4 pb-8 px-8 rounded-[3rem] bg-slate-50/50 border border-slate-100 backdrop-blur-sm">
              
              {/* Group: 예식 전 */}
              <div className="relative flex flex-col items-center w-full">
                <DiagramNode active={activeIdx >= 0} icon="📅" label="예약하기" theme="prep" />
                <BridgeArrow active={activeIdx >= 1} label="D-30" />
                <DiagramNode active={activeIdx >= 1} icon="⚙️" label="상세 설정" theme="prep" />
                <div className="absolute right-0 top-[20%] translate-x-4">
                  <span className="text-[10px] font-black text-indigo-500 tracking-widest uppercase bg-white/80 py-1 px-3 rounded-full border border-indigo-100">예식 전</span>
                </div>
              </div>

              <BridgeArrow active={activeIdx >= 2} label="Wedding Day" isLong />

              {/* Group: 예식 중 */}
              <div className="relative flex flex-col items-center w-full">
                <DiagramNode active={activeIdx >= 2} icon="👥" label="하객 참여" theme="event" />
                <div className="absolute right-0 top-6 translate-x-4">
                  <span className="text-[10px] font-black text-pink-500 tracking-widest uppercase bg-white/80 py-1 px-3 rounded-full border border-pink-100">예식 중</span>
                </div>
                
                {/* QR Box (Compact) */}
                <div className={`relative mt-4 p-4 rounded-[2rem] border-2 border-dashed transition-all duration-500 w-full ${activeIdx >= 2 ? "border-pink-400 bg-pink-50/30 shadow-md" : "border-slate-300 opacity-50"}`}>
                  <div className="grid grid-cols-3 gap-2">
                    <SubBoxCard icon="✍️" label="방명록" active={activeIdx >= 2} />
                    <SubBoxCard icon="💬" label="메시지" active={activeIdx >= 2} />
                    <SubBoxCard icon="💸" label="축의금" active={activeIdx >= 2} />
                  </div>
                </div>
                <OrthogonalArrows active={activeIdx >= 3} />
              </div>

              {/* Group: 예식 후 */}
              <div className="relative flex flex-col items-center w-full">
                <DiagramNode active={activeIdx >= 3} icon="📊" label="웨딩 리포트" theme="post" />
                <BridgeArrow active={activeIdx >= 4} label="Final" />
                <DiagramNode active={activeIdx >= 4} icon="💍" label="신랑 · 신부" theme="post" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4">
                  <span className="text-[10px] font-black text-emerald-500 tracking-widest uppercase bg-white/80 py-1 px-3 rounded-full border border-emerald-100">예식 후</span>
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

// --- UI Components ---

function DiagramNode({ active, icon, label, theme }: any) {
  const colors = { prep: "text-indigo-600 border-indigo-400 bg-indigo-50", event: "text-pink-600 border-pink-400 bg-pink-50", post: "text-emerald-600 border-emerald-400 bg-emerald-50" }[theme as "prep"|"event"|"post"];
  return (
    <div className={`relative flex flex-col items-center justify-center w-28 h-16 rounded-2xl border-2 transition-all duration-500 ${active ? `${colors} shadow-md` : "bg-white border-slate-200 text-slate-300 opacity-60"}`}>
      <span className="text-2xl mb-0.5">{icon}</span>
      <span className="text-[10px] font-bold">{label}</span>
    </div>
  );
}

function SubBoxCard({ icon, label, active }: { icon: string; label: string; active: boolean }) {
  return (
    <div className={`h-14 rounded-xl border flex flex-col items-center justify-center bg-white transition-all ${active ? "border-pink-200 text-pink-900" : "border-slate-100 text-slate-300"}`}>
       <span className="text-xl">{icon}</span>
       <span className="text-[8px] font-bold">{label}</span>
    </div>
  )
}

function BridgeArrow({ active, label, isLong }: { active: boolean, label?: string, isLong?: boolean }) {
  return (
    <div className={`${isLong ? 'h-10' : 'h-8'} w-full flex flex-col items-center justify-center relative my-0.5`}>
      {label && <span className="absolute left-[65%] text-[8px] font-bold text-slate-400 whitespace-nowrap">{label}</span>}
      <svg width="12" height="100%" viewBox="0 0 12 40" preserveAspectRatio="none" className="overflow-visible">
        <marker id="h-sm" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><polygon points="0 0, 6 3, 0 6" fill={active ? "#94a3b8" : "#E2E8F0"} /></marker>
        <line x1="6" y1="0" x2="6" y2="32" stroke={active ? "#94a3b8" : "#E2E8F0"} strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#h-sm)" />
        {active && <motion.line x1="6" y1="0" x2="6" y2="32" stroke="#94a3b8" strokeWidth="1.5" initial={{ strokeDashoffset: 40, strokeDasharray: 40 }} animate={{ strokeDashoffset: 0 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} markerEnd="url(#h-sm)" />}
      </svg>
    </div>
  );
}

function OrthogonalArrows({ active }: { active: boolean }) {
  return (
    <div className="h-10 w-full flex items-center justify-center relative overflow-visible mt-1">
      <svg width="140" height="40" viewBox="0 0 140 40" className="overflow-visible">
        <marker id="o-h" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto"><polygon points="0 0, 5 2.5, 0 5" fill={active ? "#94a3b8" : "#E2E8F0"} /></marker>
        <g stroke={active ? "#94a3b8" : "#E2E8F0"} strokeWidth="1.5" strokeDasharray="3 3" fill="none" markerEnd="url(#o-h)">
          <path d="M25 0 V 15 H 70 V 35" /><path d="M70 0 V 35" /><path d="M115 0 V 15 H 70 V 35" />
        </g>
      </svg>
    </div>
  );
}