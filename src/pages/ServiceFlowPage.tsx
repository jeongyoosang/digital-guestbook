import { useEffect, useState } from "react";
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

const placeholderChart = "https://placehold.co/800x600/f1f5f9/475569?text=Wedding+Report+Chart";
const placeholderCouple = "https://placehold.co/800x600/fdf2f8/db2777?text=Just+Married";

const STEPS: StepData[] = [
  { id: "reserve", sectionId: "sf-reserve", title: "01. 예약하기", desc: "예식 일자와 연락처만으로 간편하게 시작하세요. 예약 양식을 제출하면 카카오톡으로 즉시 안내 메시지가 발송됩니다.", dDay: "D-30 ~ 180", icon: "📅", label: "예약하기", images: ["/serviceflow1-0.jpg", "/serviceflow1.jpg", "/serviceflow1-2.jpg"], theme: "prep" },
  { id: "setup", sectionId: "sf-setup", title: "02. 상세 설정", desc: "신랑·신부 정보, 감사 문구, 계좌 등 우리만의 예식 페이지를 맞춤 구성합니다.", dDay: "D-14 ~ 30", icon: "⚙️", label: "상세 설정", images: ["/serviceflow2-1.jpg", "/serviceflow2.jpg", "/serviceflow2-2.jpg"], theme: "prep" },
  { id: "guest", sectionId: "sf-guest", title: "03. 하객 참여 및 현장 이벤트", desc: "QR 스캔으로 방명록, 축하 메시지, 축의금 송금을 한 번에. 피로연장 화면과 실시간 연동됩니다.", dDay: "D-Day", icon: "👥", label: "하객 참여", images: ["/serviceflow3.jpg", "/serviceflow3-1.jpg", "/serviceflow3-2.jpg"], video: "/serviceflow3-3.mp4", theme: "event" },
  { id: "report", sectionId: "sf-report", title: "04. 웨딩 리포트", desc: "예식 종료와 동시에 명단, 메시지, 정산 내역이 깔끔한 리포트로 생성됩니다.", dDay: "D-Day (종료)", icon: "📊", label: "웨딩 리포트", images: [placeholderChart], theme: "post" },
  { id: "couple", sectionId: "sf-couple", title: "05. 신랑 · 신부", desc: "소중한 기록을 영구 보관하고 하객들에게 감사 인사를 전하며 마무리하세요.", dDay: "D-Day +", icon: "💍", label: "신랑 · 신부", images: [placeholderCouple], theme: "post" },
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

  const activeStep = STEPS.find(s => s.id === activeId);
  const themeColor = activeStep?.theme === 'prep' ? "border-indigo-400" : activeStep?.theme === 'event' ? "border-pink-400" : "border-emerald-400";

  return (
    <main className="relative min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-slate-50 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button onClick={() => navigate("/")} className="text-xl font-bold tracking-tighter uppercase">Digital Guestbook</button>
          <button onClick={() => navigate("/reserve")} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:scale-105">시작하기</button>
        </div>
      </header>

      {/* 모바일 탭 */}
      <div className="sticky top-[65px] z-40 flex w-full justify-around bg-white/90 p-3 backdrop-blur-md border-b border-slate-100 lg:hidden">
        {STEPS.map((step) => (
          <div key={step.id} className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-all duration-300 ${activeId === step.id ? `${themeColor} bg-white shadow-md scale-110` : "border-transparent opacity-30"}`}>
            <span className="text-lg">{step.icon}</span>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="grid gap-16 lg:grid-cols-[1fr_420px]">
          {/* 왼쪽 콘텐츠 섹션 */}
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
                      <video autoPlay muted loop playsInline className="w-full h-full object-cover"><source src={step.video} type="video/mp4" /></video>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {step.images.map((img, idx) => (
                        <img key={idx} src={img} className="rounded-2xl border aspect-square object-cover shadow-sm bg-slate-50" alt="guest" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <img src={step.images[0]} alt={step.title} className="w-full lg:max-w-3xl rounded-[1.5rem] border shadow-lg min-h-[300px] object-contain bg-slate-50" />
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* 오른쪽 다이어그램 (가운데 정렬 및 라벨 위치 수정) */}
          <div className="hidden lg:block">
            <div className="sticky top-24 flex flex-col items-center p-8 rounded-[3rem] bg-slate-50/50 border border-slate-100 backdrop-blur-sm overflow-hidden">
              
              {/* 예식 전 (가운데 정렬) */}
              <div className="relative flex items-center justify-center w-full">
                <div className="flex flex-col items-center w-32 z-10">
                  <DiagramNode active={activeId === "reserve"} icon="📅" label="예약하기" theme="prep" />
                  <BridgeArrow active={activeId === "setup" || activeId === "guest"} smallHead />
                  <DiagramNode active={activeId === "setup"} icon="⚙️" label="상세 설정" theme="prep" />
                </div>
                {/* 라벨: 1~2단계 사이 중간 우측 */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4">
                  <span className="text-[10px] font-black text-indigo-500 tracking-widest uppercase bg-white/80 py-1 px-3 rounded-full shadow-sm border border-indigo-100 whitespace-nowrap">예식 전</span>
                </div>
              </div>

              <div className="w-32 flex justify-center relative z-0"><BridgeArrow active={activeId === "guest" || activeId === "report"} smallHead /></div>

              {/* 예식 중 */}
              <div className="relative flex items-center justify-center w-full my-2">
                 <div className="flex flex-col items-center w-full relative z-10">
                    <DiagramNode active={activeId === "guest"} icon="👥" label="하객 참여" theme="event" />
                    {/* 라벨: 하객참여 아이콘 바로 오른쪽으로 이동하여 박스 겹침 방지 */}
                    <div className="absolute top-6 right-0 translate-x-4">
                       <span className="text-[10px] font-black text-pink-500 tracking-widest uppercase bg-white/80 py-1 px-3 rounded-full shadow-sm border border-pink-100 whitespace-nowrap">예식 중</span>
                    </div>
                    
                    <div className={`relative mt-5 p-5 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 w-full ${activeId === "guest" ? "border-pink-400 bg-pink-50/30 shadow-xl scale-105 z-20" : "border-slate-300 opacity-50 bg-white/50"}`}>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pink-500 text-[10px] text-white px-4 py-0.5 rounded-full font-black uppercase tracking-wider shadow-sm">QR Scan</div>
                      <div className="grid grid-cols-3 gap-3 mt-2">
                        <SubBoxCard icon="✍️" label="방명록" active={activeId === "guest"} />
                        <SubBoxCard icon="💬" label="축하 메시지" active={activeId === "guest"} />
                        <SubBoxCard icon="💸" label="축의금" active={activeId === "guest"} />
                      </div>
                    </div>
                    <OrthogonalConvergingArrows active={activeId === "report" || activeId === "couple"} smallHead />
                 </div>
              </div>

              {/* 예식 후 */}
              <div className="relative flex items-center justify-center w-full mt-1">
                 <div className="flex flex-col items-center w-32 z-10">
                     <DiagramNode active={activeId === "report"} icon="📊" label="웨딩 리포트" theme="post" />
                     <BridgeArrow active={activeId === "couple"} smallHead />
                     <DiagramNode active={activeId === "couple"} icon="💍" label="신랑 · 신부" theme="post" />
                 </div>
                 {/* 라벨: 4~5단계 사이 중간 우측 */}
                 <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4">
                     <span className="text-[10px] font-black text-emerald-500 tracking-widest uppercase bg-white/80 py-1 px-3 rounded-full shadow-sm border border-emerald-100 whitespace-nowrap">예식 후</span>
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

// --- 하위 컴포넌트 ---

function DiagramNode({ active, icon, label, theme }: any) {
  const colors = { prep: "text-indigo-600 border-indigo-400 bg-indigo-50", event: "text-pink-600 border-pink-400 bg-pink-50", post: "text-emerald-600 border-emerald-400 bg-emerald-50" }[theme as "prep"|"event"|"post"];
  return (
    <div className={`relative flex flex-col items-center justify-center w-28 h-20 rounded-2xl border-2 transition-all duration-500 ${active ? `${colors} scale-110 shadow-lg z-10` : "bg-white border-slate-200 text-slate-400 opacity-70"}`}>
      <span className="text-3xl mb-1">{icon}</span>
      <span className="text-[11px] font-bold">{label}</span>
      {active && <motion.div layoutId="active-glow" className="absolute inset-0 rounded-2xl ring-4 ring-current opacity-10" />}
    </div>
  );
}

function SubBoxCard({ icon, label, active }: { icon: string; label: string; active: boolean }) {
  return (
    <div className={`relative h-16 rounded-xl border-2 flex items-center justify-center bg-white transition-all ${active ? "border-pink-200 shadow-sm text-pink-900" : "border-slate-100 text-slate-400"}`}>
       <div className="flex flex-col items-center">
         <span className="text-2xl">{icon}</span>
         <span className="text-[9px] font-bold mt-1">{label}</span>
       </div>
    </div>
  )
}

function BridgeArrow({ active, smallHead }: { active: boolean, smallHead?: boolean }) {
  const headSize = "6";
  return (
    <div className="h-12 w-6 flex items-center justify-center z-0 relative overflow-visible my-1">
      <svg width="20" height="48" viewBox="0 0 20 48" className="overflow-visible">
        <defs>
          <marker id="head-sm" markerWidth={headSize} markerHeight={headSize} refX="5" refY="3" orient="auto"><polygon points="0 0, 6 3, 0 6" fill="#E2E8F0" /></marker>
          <marker id="head-active-sm" markerWidth={headSize} markerHeight={headSize} refX="5" refY="3" orient="auto"><polygon points="0 0, 6 3, 0 6" fill="currentColor" className="text-slate-400"/></marker>
        </defs>
        <line x1="10" y1="0" x2="10" y2="40" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="4 4" markerEnd="url(#head-sm)" />
        {active && <motion.line x1="10" y1="0" x2="10" y2="40" stroke="currentColor" strokeWidth="2" className="text-slate-400" initial={{ strokeDashoffset: 40, strokeDasharray: 40 }} animate={{ strokeDashoffset: 0 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} markerEnd="url(#head-active-sm)" />}
      </svg>
    </div>
  );
}

function OrthogonalConvergingArrows({ active, smallHead }: { active: boolean, smallHead?: boolean }) {
  const headSize = "5";
  return (
    <div className="h-12 w-full flex items-center justify-center relative z-0 -mt-1 overflow-visible">
      <svg width="140" height="50" viewBox="0 0 140 50" className="overflow-visible">
        <defs>
           <marker id="ortho-head" markerWidth={headSize} markerHeight={headSize} refX="4" refY="2.5" orient="auto"><polygon points="0 0, 5 2.5, 0 5" fill="#E2E8F0" /></marker>
           <marker id="ortho-head-active" markerWidth={headSize} markerHeight={headSize} refX="4" refY="2.5" orient="auto"><polygon points="0 0, 5 2.5, 0 5" fill="currentColor" className="text-slate-400"/></marker>
        </defs>
        <g stroke="#E2E8F0" strokeWidth="2" strokeDasharray="4 4" fill="none" markerEnd="url(#ortho-head)">
          <path d="M20 0 V 25 H 70 V 45" /><path d="M70 0 V 45" /><path d="M120 0 V 25 H 70 V 45" />
        </g>
        {active && (
          <g stroke="currentColor" strokeWidth="2" fill="none" className="text-pink-400" markerEnd="url(#ortho-head-active)">
            <motion.path d="M20 0 V 25 H 70 V 45" initial={{ strokeDashoffset: 100, strokeDasharray: 100 }} animate={{ strokeDashoffset: 0 }} transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }} />
            <motion.path d="M70 0 V 45" initial={{ strokeDashoffset: 100, strokeDasharray: 100 }} animate={{ strokeDashoffset: 0 }} transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }} />
            <motion.path d="M120 0 V 25 H 70 V 45" initial={{ strokeDashoffset: 100, strokeDasharray: 100 }} animate={{ strokeDashoffset: 0 }} transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }} />
          </g>
        )}
      </svg>
    </div>
  );
}