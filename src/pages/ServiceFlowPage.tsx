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

const STEPS: StepData[] = [
  {
    id: "reserve",
    sectionId: "sf-reserve",
    title: "01. 예약하기",
    desc: "예식 일자와 연락처만으로 간편하게 시작하세요. 예약 양식을 제출하면 카카오톡으로 즉시 안내 메시지가 발송됩니다.",
    dDay: "D-30 ~ 180",
    icon: "📅",
    label: "예약하기",
    images: ["/serviceflow1-0.jpg", "/serviceflow1.jpg", "/serviceflow1-2.jpg"],
    theme: "prep",
  },
  {
    id: "setup",
    sectionId: "sf-setup",
    title: "02. 상세 설정",
    desc: "신랑·신부 정보, 감사 문구, 계좌 등 우리만의 예식 페이지를 맞춤 구성합니다.",
    dDay: "D-14 ~ 30",
    icon: "⚙️",
    label: "상세 설정",
    images: ["/serviceflow2-1.jpg", "/serviceflow2.jpg", "/serviceflow2-2.jpg"],
    theme: "prep",
  },
  {
    id: "guest",
    sectionId: "sf-guest",
    title: "03. 하객 참여 및 현장 이벤트",
    desc: "QR 스캔으로 방명록, 축하 메시지, 축의금 송금을 한 번에. 피로연장 화면과 실시간 연동됩니다.",
    dDay: "D-Day",
    icon: "👥",
    label: "하객 참여",
    images: ["/serviceflow3.jpg", "/serviceflow3-1.jpg", "/serviceflow3-2.jpg"],
    video: "/serviceflow3-3.mp4",
    theme: "event",
  },
  {
    id: "report",
    sectionId: "sf-report",
    title: "04. 웨딩 리포트",
    desc: "예식 종료와 동시에 명단, 메시지, 정산 내역이 깔끔한 리포트로 생성됩니다.",
    dDay: "D-Day (종료)",
    icon: "📊",
    label: "웨딩 리포트",
    images: ["/serviceflow4.jpg"],
    theme: "post",
  },
  {
    id: "couple",
    sectionId: "sf-couple",
    title: "05. 신랑 · 신부",
    desc: "소중한 기록을 영구 보관하고 하객들에게 감사 인사를 전하며 마무리하세요.",
    dDay: "D-Day +",
    icon: "💍",
    label: "신랑 · 신부",
    images: ["/serviceflow1-0.jpg"],
    theme: "post",
  },
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

  const themeColor = activeId === "guest" ? "border-pink-400" : (STEPS.find(s => s.id === activeId)?.theme === "prep" ? "border-indigo-400" : "border-emerald-400");

  return (
    <main className="relative min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-slate-50 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button onClick={() => navigate("/")} className="text-xl font-bold tracking-tighter uppercase">Digital Guestbook</button>
          <button onClick={() => navigate("/reserve")} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:scale-105">시작하기</button>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="sticky top-[65px] z-40 flex w-full justify-around bg-white/90 p-3 backdrop-blur-md border-b border-slate-100 lg:hidden">
        {STEPS.map((step) => (
          <div key={step.id} className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-all duration-300 ${activeId === step.id ? `${themeColor} bg-white shadow-md scale-110` : "border-transparent opacity-30"}`}>
            <span className="text-lg">{step.icon}</span>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="grid gap-16 lg:grid-cols-[1fr_380px]">
          <div className="space-y-40 lg:space-y-64">
            {STEPS.map((step) => (
              <section key={step.id} id={step.sectionId} className="scroll-mt-48">
                <div className="mb-8 space-y-3">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${step.theme === 'prep' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : step.theme === 'event' ? 'bg-pink-50 text-pink-600 border-pink-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{step.dDay}</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 lg:text-4xl">{step.title}</h2>
                  <div className="space-y-2">
                    <p className="text-lg leading-relaxed text-slate-500">{step.desc}</p>
                    {step.id === "guest" && <p className="text-xs text-slate-400 font-medium">*기본 스탠드형 디스플레이 1대 제공</p>}
                  </div>
                </div>

                {/* 01. 예약하기 */}
                {step.id === "reserve" && (
                  <div className="flex flex-wrap gap-4 lg:gap-8 justify-center items-center">
                    <div className="hidden lg:flex w-full items-center justify-center gap-8">
                      <div className="w-[500px] aspect-square overflow-hidden rounded-[2rem] border border-slate-100 shadow-lg"><img src={step.images[0]} alt="웹" className="w-full h-full object-cover" /></div>
                      <div className="w-[240px] aspect-[9/19] overflow-hidden rounded-[2.5rem] border-[6px] border-slate-900 bg-slate-900 shadow-xl"><img src={step.images[2]} alt="카톡" className="w-full h-full object-cover object-top bg-white" /></div>
                    </div>
                    <div className="flex lg:hidden w-full justify-center gap-4">
                      <div className="w-[45%] aspect-[9/19] overflow-hidden rounded-[2.5rem] border-[6px] border-slate-900 bg-slate-900 shadow-xl"><img src={step.images[1]} alt="폰1" className="w-full h-full object-cover object-top bg-white" /></div>
                      <div className="w-[45%] aspect-[9/19] overflow-hidden rounded-[2.5rem] border-[6px] border-slate-900 bg-slate-900 shadow-xl"><img src={step.images[2]} alt="폰2" className="w-full h-full object-cover object-top bg-white" /></div>
                    </div>
                  </div>
                )}

                {/* 02. 상세 설정 */}
                {step.id === "setup" && (
                  <div className="flex flex-col gap-6 lg:gap-8 items-center">
                    <div className="w-full lg:max-w-3xl overflow-hidden rounded-[1.5rem] border border-slate-100 shadow-lg"><img src={step.images[0]} alt="웹" className="w-full object-contain" /></div>
                    <div className="flex justify-center gap-4 lg:gap-8 w-full">
                      <div className="w-[45%] lg:w-[240px] aspect-[9/19] overflow-hidden rounded-[2.5rem] border-[6px] border-slate-900 bg-slate-900 shadow-xl"><img src={step.images[1]} alt="폰1" className="w-full h-full object-cover object-top bg-white" /></div>
                      <div className="w-[45%] lg:w-[240px] aspect-[9/19] overflow-hidden rounded-[2.5rem] border-[6px] border-slate-900 bg-slate-900 shadow-xl"><img src={step.images[2]} alt="폰2" className="w-full h-full object-cover object-top bg-white" /></div>
                    </div>
                  </div>
                )}

                {/* 03. 하객 참여 */}
                {step.id === "guest" && (
                  <div className="space-y-6 lg:space-y-8">
                    <div className="w-full lg:max-w-3xl mx-auto overflow-hidden rounded-[1.75rem] border border-slate-100 bg-black shadow-lg">
                      <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                        <source src={step.video} type="video/mp4" />
                      </video>
                    </div>
                    <div className="grid grid-cols-3 gap-3 lg:gap-6">
                      {step.images.map((img, idx) => (
                        <div key={idx} className="overflow-hidden rounded-[1rem] border border-slate-100 bg-white shadow-sm">
                          <img src={img} alt={`이미지${idx}`} className="w-full h-full object-cover aspect-square lg:aspect-video" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 04, 05 섹션 (이미지 경로 수정 완료) */}
                {(step.id === "report" || step.id === "couple") && (
                  <div className="flex justify-center">
                    <div className="w-full lg:max-w-3xl overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white shadow-lg">
                      <img src={step.images[0]} alt={step.title} className="w-full h-full object-contain min-h-[300px]" />
                    </div>
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Right Diagram (디자인 롤백 및 축하 메시지 반영) */}
          <div className="hidden lg:block">
            <div className="sticky top-44 flex flex-col items-center rounded-[4rem] bg-slate-50/40 p-12 backdrop-blur-xl border border-slate-100 shadow-sm">
              <DiagramNode active={activeId === "reserve"} icon="📅" label="예약하기" theme="prep" />
              <Arrow active={activeId === "setup"} />
              <DiagramNode active={activeId === "setup"} icon="⚙️" label="상세 설정" theme="prep" />
              <div className="h-6" />
              
              <DiagramNode active={activeId === "guest"} icon="👥" label="하객 참여" theme="event" />
              <Arrow active={activeId === "guest"} />
              
              <div className={`relative p-6 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 ${activeId === "guest" ? "border-pink-300 bg-white shadow-xl scale-105" : "border-slate-200 opacity-50 bg-white/30"}`}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pink-400 text-[9px] text-white px-3 py-1 rounded-full font-black uppercase tracking-wider">QR Scan</div>
                <div className="flex gap-6">
                   <FlipIcon icon="✍️" label="방명록" />
                   <div className="border-x border-slate-100 px-6"><FlipIcon icon="💬" label="축하 메시지" /></div>
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

// 다이어그램 노드 (활성화 시에만 텍스트 표시)
function DiagramNode({ active, icon, label, theme }: any) {
  const activeStyles = { 
    prep: "border-indigo-400 shadow-md ring-4 ring-indigo-50 text-indigo-600", 
    event: "border-pink-400 shadow-md ring-4 ring-pink-50 text-pink-600", 
    post: "border-emerald-400 shadow-md ring-4 ring-emerald-50 text-emerald-600" 
  }[theme as "prep"|"event"|"post"];

  return (
    <div className={`relative w-20 h-20 rounded-2xl border-2 bg-white flex flex-col items-center justify-center transition-all duration-500 ${active ? `${activeStyles} scale-110 opacity-100` : "border-slate-100 opacity-30 text-slate-400"}`}>
      <span className="text-3xl">{icon}</span>
      <AnimatePresence>
        {active && (
          <motion.span 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-black"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

// FlipIcon (축하 메시지 반영 및 회전 기능)
function FlipIcon({ icon, label }: { icon: string; label: string }) {
  const [isHover, setIsHover] = useState(false);
  return (
    <div className="relative h-12 w-16 cursor-default [perspective:1000px]" onMouseEnter={() => setIsHover(true)} onMouseLeave={() => setIsHover(false)}>
      <motion.div className="relative h-full w-full transition-all duration-500 [transform-style:preserve-3d]" animate={{ rotateY: isHover ? 180 : 0 }}>
        <div className="absolute inset-0 flex items-center justify-center [backface-visibility:hidden]"><span className="text-3xl">{icon}</span></div>
        <div className="absolute inset-0 flex items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)]"><span className="text-[10px] font-bold text-slate-800 text-center leading-tight">{label}</span></div>
      </motion.div>
    </div>
  );
}

function Arrow({ active }: { active?: boolean }) {
  return (
    <div className="flex justify-center my-3">
      <svg width="20" height="30" viewBox="0 0 24 40" fill="none">
        <path d="M12 0V38M12 38L6 32M12 38L18 32" stroke={active ? "#94a3b8" : "#f1f5f9"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}