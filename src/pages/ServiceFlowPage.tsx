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

  const activeIndex = STEPS.findIndex(s => s.id === activeId);

  return (
    <main className="relative min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-slate-50 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button onClick={() => navigate("/")} className="text-xl font-bold tracking-tighter uppercase">Digital Guestbook</button>
          <button onClick={() => navigate("/reserve")} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:scale-105">시작하기</button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="grid gap-16 lg:grid-cols-[1fr_420px]">
          {/* 왼쪽 콘텐츠 섹션 */}
          <div className="space-y-40 lg:space-y-64">
            {STEPS.map((step) => (
              <section key={step.id} id={step.sectionId} className="scroll-mt-48">
                <div className="mb-10 space-y-3">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${step.theme === 'prep' ? 'bg-indigo-50 text-indigo-600' : step.theme === 'event' ? 'bg-pink-50 text-pink-600' : 'bg-emerald-50 text-emerald-600'}`}>{step.dDay}</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 lg:text-4xl">{step.title}</h2>
                  <p className="max-w-2xl text-lg leading-relaxed text-slate-500">{step.desc}</p>
                  {step.id === "guest" && (
                    <p className="mt-2 text-sm font-bold text-indigo-600 animate-pulse">* 기본 스탠드형 디스플레이 1대가 무상 제공됩니다</p>
                  )}
                </div>

                {/* 이미지 배치 최적화 */}
                {step.id === "reserve" ? (
                  <div className="flex flex-col lg:flex-row items-stretch gap-4 lg:max-w-4xl">
                    <img src="/serviceflow1-0.jpg" className="flex-[2] rounded-2xl border shadow-lg object-cover bg-slate-50" alt="web-1" />
                    <img src="/serviceflow1-2.jpg" className="flex-1 max-w-[200px] mx-auto lg:mx-0 rounded-[2rem] border-4 border-slate-900 aspect-[9/19] object-cover shadow-2xl" alt="mobile-1" />
                  </div>
                ) : step.id === "setup" ? (
                  <div className="flex flex-col lg:flex-row items-end gap-4 lg:max-w-4xl">
                    <img src="/serviceflow2-1.jpg" className="flex-[1.5] rounded-2xl border shadow-lg object-contain bg-slate-50" alt="setup-main" />
                    <div className="flex flex-row gap-4 w-full lg:w-auto">
                      <img src="/serviceflow2.jpg" className="flex-1 lg:w-[160px] rounded-[1.8rem] border-4 border-slate-900 aspect-[9/19] object-cover shadow-xl" alt="setup-sub-1" />
                      <img src="/serviceflow2-2.jpg" className="flex-1 lg:w-[160px] rounded-[1.8rem] border-4 border-slate-900 aspect-[9/19] object-cover shadow-xl" alt="setup-sub-2" />
                    </div>
                  </div>
                ) : step.id === "guest" ? (
                  <div className="space-y-4 lg:max-w-4xl">
                    <div className="w-full overflow-hidden rounded-2xl border bg-black shadow-xl">
                      <video autoPlay muted loop playsInline className="w-full aspect-video object-cover"><source src={step.video} type="video/mp4" /></video>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {step.images.map((img, idx) => (
                        <img key={idx} src={img} className="rounded-xl border aspect-square object-cover shadow-md bg-slate-50" alt="guest-detail" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center lg:justify-start lg:max-w-4xl">
                    <img src={step.images[0]} alt={step.title} className="w-full lg:max-w-[600px] rounded-2xl border shadow-xl object-contain bg-slate-50" />
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* 오른쪽 고정 다이어그램 */}
          <div className="hidden lg:block">
            <div className="sticky top-24 flex flex-col items-center pt-10 pb-8 px-8 rounded-[3rem] bg-slate-50/50 border border-slate-100 backdrop-blur-sm">
              <div className="flex flex-col items-center w-32 z-10">
                <DiagramNode active={activeId === "reserve"} icon="📅" label="예약하기" theme="prep" />
                <BridgeArrow active={activeIndex >= 1} activeColor="#818cf8" />
                <DiagramNode active={activeId === "setup"} icon="⚙️" label="상세 설정" theme="prep" />
                <BridgeArrow active={activeIndex >= 2} activeColor="#f472b6" />
                <DiagramNode active={activeId === "guest"} icon="👥" label="하객 참여" theme="event" />
                
                {/* 하객 참여 하단 서브 박스 */}
                <div className={`relative mt-4 p-4 rounded-[2rem] border-2 border-dashed transition-all w-full ${activeId === "guest" ? "border-pink-400 bg-pink-50/30 shadow-lg" : "border-slate-200 opacity-40"}`}>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center text-[10px] font-bold">✍️</div>
                    <div className="text-center text-[10px] font-bold">💬</div>
                    <div className="text-center text-[10px] font-bold">💸</div>
                  </div>
                </div>

                {/* 복구된 수렴 화살표 영역 */}
                <div className="py-4">
                   <BridgeArrow active={activeIndex >= 3} activeColor="#10b981" />
                </div>

                <DiagramNode active={activeId === "report"} icon="📊" label="웨딩 리포트" theme="post" />
                <BridgeArrow active={activeIndex >= 4} activeColor="#10b981" />
                <DiagramNode active={activeId === "couple"} icon="💍" label="신랑 · 신부" theme="post" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}

// --- UI 컴포넌트 ---
function DiagramNode({ active, icon, label, theme }: any) {
  const colors = { 
    prep: "text-indigo-600 border-indigo-400 bg-indigo-50 shadow-indigo-100", 
    event: "text-pink-600 border-pink-400 bg-pink-50 shadow-pink-100", 
    post: "text-emerald-600 border-emerald-400 bg-emerald-50 shadow-emerald-100" 
  }[theme as "prep"|"event"|"post"];
  
  return (
    <div className={`flex flex-col items-center justify-center w-28 h-20 rounded-2xl border-2 transition-all duration-500 ${active ? `${colors} scale-110 shadow-xl z-10` : "bg-white border-slate-200 text-slate-400 opacity-60"}`}>
      <span className="text-2xl mb-1">{icon}</span>
      <span className="text-[10px] font-bold">{label}</span>
    </div>
  );
}

function BridgeArrow({ active, activeColor }: { active: boolean; activeColor: string }) {
  return (
    <div className="h-10 w-6 flex items-center justify-center overflow-visible">
      <svg width="20" height="40" viewBox="0 0 20 40" className="overflow-visible">
        <marker id={`head-${activeColor}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0 0, 6 3, 0 6" fill={active ? activeColor : "#E2E8F0"} />
        </marker>
        <line x1="10" y1="0" x2="10" y2="34" stroke={active ? activeColor : "#E2E8F0"} strokeWidth="2" strokeDasharray={active ? "none" : "4 4"} markerEnd={`url(#head-${activeColor})`} />
        {active && (
          <motion.line 
            x1="10" y1="0" x2="10" y2="34" 
            stroke="white" strokeWidth="2" strokeOpacity="0.6"
            initial={{ strokeDashoffset: 40, strokeDasharray: "8 20" }} 
            animate={{ strokeDashoffset: 0 }} 
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }} 
          />
        )}
      </svg>
    </div>
  );
}