import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  { id: "report", sectionId: "sf-report", title: "04. 웨딩 리포트", desc: "예식 종료와 동시에 명단, 메시지, 정산 내역이 깔끔한 리포트로 생성됩니다.", dDay: "D-Day (종료)", icon: "📊", label: "웨딩 리포트", images: ["/serviceflow4.jpg"], theme: "post" },
  { id: "couple", sectionId: "sf-couple", title: "05. 신랑 · 신부", desc: "소중한 기록을 영구 보관하고 하객들에게 감사 인사를 전하며 마무리하세요.", dDay: "D-Day +", icon: "💍", label: "신랑 · 신부", images: ["/serviceflow1-0.jpg"], theme: "post" },
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
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${step.theme === 'prep' ? 'bg-indigo-50 text-indigo-600' : step.theme === 'event' ? 'bg-pink-50 text-pink-600' : 'bg-emerald-50 text-emerald-600'}`}>{step.dDay}</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 lg:text-4xl">{step.title}</h2>
                  <p className="text-lg leading-relaxed text-slate-500">{step.desc}</p>
                </div>

                {step.id === "guest" ? (
                  <div className="space-y-6">
                    <div className="w-full lg:max-w-3xl overflow-hidden rounded-[1.75rem] border bg-black shadow-lg">
                      <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                        <source src={step.video} type="video/mp4" />
                      </video>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {step.images.map((img, idx) => (
                        <img key={idx} src={img} className="rounded-2xl border aspect-square object-cover shadow-sm" alt="guest" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <img src={step.images[0]} alt={step.title} className="w-full lg:max-w-3xl rounded-[1.5rem] border shadow-lg min-h-[300px] object-contain" />
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Right Diagram (Bridge Style) */}
          <div className="hidden lg:block">
            <div className="sticky top-20 flex flex-col items-center py-10 rounded-[3rem] bg-slate-50/50 border border-slate-100 backdrop-blur-sm">
              <DiagramNode active={activeId === "reserve"} icon="📅" label="예약하기" theme="prep" />
              <BridgeArrow active={activeId === "setup"} />
              <DiagramNode active={activeId === "setup"} icon="⚙️" label="상세 설정" theme="prep" />
              <BridgeArrow active={activeId === "guest"} />
              
              <div className={`relative p-5 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 ${activeId === "guest" ? "border-pink-300 bg-white shadow-xl scale-105" : "border-slate-200 opacity-40 bg-white/30"}`}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pink-400 text-[9px] text-white px-3 py-0.5 rounded-full font-black uppercase">QR Scan</div>
                <div className="flex gap-4">
                   <FlipIcon icon="✍️" label="방명록" />
                   <div className="border-x border-slate-100 px-4"><FlipIcon icon="💬" label="축하 메시지" /></div>
                   <FlipIcon icon="💸" label="축의금" />
                </div>
              </div>

              <BridgeArrow active={activeId === "report"} />
              <DiagramNode active={activeId === "report"} icon="📊" label="웨딩 리포트" theme="post" />
              <BridgeArrow active={activeId === "couple"} />
              <DiagramNode active={activeId === "couple"} icon="💍" label="신랑 · 신부" theme="post" />
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}

function DiagramNode({ active, icon, label, theme }: any) {
  const colors = { prep: "text-indigo-600 border-indigo-400 bg-indigo-50/50", event: "text-pink-600 border-pink-400 bg-pink-50/50", post: "text-emerald-600 border-emerald-400 bg-emerald-50/50" }[theme as "prep"|"event"|"post"];
  return (
    <div className={`relative group flex flex-col items-center justify-center w-24 h-16 rounded-2xl border-2 transition-all duration-500 ${active ? `${colors} scale-110 shadow-lg z-10 font-bold` : "bg-white border-slate-100 text-slate-300 opacity-60 grayscale"}`}>
      <span className="text-2xl mb-1">{icon}</span>
      <span className="text-[10px] uppercase tracking-tighter">{label}</span>
      {active && <motion.div layoutId="glow" className="absolute inset-0 rounded-2xl ring-4 ring-current opacity-20" />}
    </div>
  );
}

function BridgeArrow({ active }: { active: boolean }) {
  return (
    <div className="h-10 w-6 flex items-center justify-center">
      <svg width="2" height="40" viewBox="0 0 2 40" className="overflow-visible">
        <line x1="1" y1="0" x2="1" y2="40" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="4 4" />
        {active && (
          <motion.line x1="1" y1="0" x2="1" y2="40" stroke="currentColor" strokeWidth="2" className="text-slate-400" initial={{ strokeDashoffset: 40, strokeDasharray: 40 }} animate={{ strokeDashoffset: 0 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} />
        )}
      </svg>
    </div>
  );
}

function FlipIcon({ icon, label }: { icon: string; label: string }) {
  const [isHover, setIsHover] = useState(false);
  return (
    <div className="relative h-12 w-14 cursor-default [perspective:1000px]" onMouseEnter={() => setIsHover(true)} onMouseLeave={() => setIsHover(false)}>
      <motion.div className="relative h-full w-full transition-all duration-500 [transform-style:preserve-3d]" animate={{ rotateY: isHover ? 180 : 0 }}>
        <div className="absolute inset-0 flex items-center justify-center [backface-visibility:hidden]"><span className="text-2xl">{icon}</span></div>
        <div className="absolute inset-0 flex items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)]"><span className="text-[9px] font-bold text-slate-800 text-center leading-tight">{label}</span></div>
      </motion.div>
    </div>
  );
}