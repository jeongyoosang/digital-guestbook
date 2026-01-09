import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Footer from "@/components/Footer";

// --- Types & Data ---
type FlowNode = "reserve" | "setup" | "guest" | "actions" | "report" | "couple";

interface StepData {
  id: FlowNode;
  sectionId: string;
  title: string;
  desc: string;
  images: string[];
  theme: "prep" | "event" | "post";
}

const STEPS: StepData[] = [
  {
    id: "reserve",
    sectionId: "sf-reserve",
    title: "01. 예약하기",
    desc: "예식 일자와 기본 연락처만으로 간편하게 시작하세요. 카카오톡으로 예약 확정 메시지가 발송됩니다.",
    images: ["https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=1000"],
    theme: "prep",
  },
  {
    id: "setup",
    sectionId: "sf-setup",
    title: "02. 상세 설정",
    desc: "신랑·신부 정보, 감사 문구, 송금 계좌 등 우리만의 예식 페이지를 맞춤형으로 구성합니다.",
    images: ["https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1000"],
    theme: "prep",
  },
  {
    id: "guest",
    sectionId: "sf-guest",
    title: "03. 하객 참여 및 현장 이벤트",
    desc: "현장에서 QR을 스캔하여 방명록 작성, 축하 메시지 전송, 축의금 송금을 한 번에 해결합니다. 피로연장 대형 화면과 실시간으로 연동됩니다.",
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
    images: ["https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=1000"],
    theme: "post",
  },
  {
    id: "couple",
    sectionId: "sf-couple",
    title: "05. 신랑 · 신부",
    desc: "소중한 기록을 영구 보관하고, 하객들에게 보낼 감사 인사까지 간편하게 마무리하세요.",
    images: ["https://images.unsplash.com/photo-1583939003579-730e3918a45a?q=80&w=1000"],
    theme: "post",
  },
];

// --- Internal Components ---

function DiagramArrow({ active, theme }: { active: boolean; theme: string }) {
  const color = active ? (theme === "prep" ? "#6366f1" : theme === "event" ? "#f472b6" : "#10b981") : "#e2e8f0";
  return (
    <div className="flex justify-center my-1">
      <svg width="20" height="30" viewBox="0 0 20 30" fill="none">
        <motion.path 
          d="M10 0V28M10 28L4 22M10 28L16 22" 
          stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: active ? 1 : 0 }}
        />
      </svg>
    </div>
  );
}

function NodeItem({ id, active, icon, label, theme }: { id: string; active: boolean; icon: string; label: string; theme: "prep" | "event" | "post" }) {
  const themes = {
    prep: active ? "border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.3)]" : "border-slate-100",
    event: active ? "border-pink-400 shadow-[0_0_20px_rgba(244,114,182,0.3)]" : "border-slate-100",
    post: active ? "border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "border-slate-100"
  };

  return (
    <div className={`flex flex-col items-center gap-1 transition-all duration-500 ${active ? "scale-105 opacity-100" : "scale-90 opacity-20 grayscale"}`}>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 bg-white ${themes[theme]}`}>
        <span className="text-xl">{icon}</span>
      </div>
      <span className="text-[10px] font-bold text-slate-700">{label}</span>
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
    <main className="relative min-h-screen bg-white selection:bg-pink-100">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button onClick={() => navigate("/")} className="text-xl font-bold tracking-tighter">Digital Guestbook</button>
          <button onClick={() => navigate("/reserve")} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800">시작하기</button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-16 lg:grid-cols-[1fr_400px]">
          
          {/* LEFT: 설명 & 이미지 슬롯 */}
          <div className="space-y-40">
            {STEPS.map((step) => (
              <section key={step.id} id={step.sectionId} className="scroll-mt-40">
                <div className="mb-8 space-y-4">
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">{step.title}</h2>
                  <p className="text-lg leading-relaxed text-slate-500 max-w-xl">{step.desc}</p>
                </div>
                
                <div className={step.images.length >= 3 ? "grid grid-cols-2 gap-4" : "block"}>
                  {step.images.map((img, idx) => (
                    <div key={idx} className={`overflow-hidden rounded-[2rem] border border-slate-200 shadow-xl ${step.images.length >= 3 && idx === 0 ? "row-span-2" : ""}`}>
                      <img src={img} alt={step.title} className="h-full w-full object-cover aspect-[4/3]" />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* RIGHT: 고정 다이어그램 (박스 이탈 방지형) */}
          <div className="hidden lg:block">
            <div className="sticky top-40 flex h-[700px] flex-col items-center justify-start rounded-[2.5rem] border border-slate-100 bg-slate-50/50 p-8 backdrop-blur-xl overflow-y-auto">
              
              {/* 예식 전 (Prep) */}
              <NodeItem id="reserve" active={activeId === "reserve"} icon="📅" label="예약하기" theme="prep" />
              <DiagramArrow active={activeId === "setup"} theme="prep" />
              <NodeItem id="setup" active={activeId === "setup"} icon="⚙️" label="상세 설정" theme="prep" />

              <div className="h-8" />

              {/* 예식 당일 (Event) & QR 분기 */}
              <NodeItem id="guest" active={activeId === "guest"} icon="👥" label="하객 그룹" theme="event" />
              <DiagramArrow active={activeId === "guest"} theme="event" />
              
              {/* QR 네모 박스로 묶인 병렬 액션 */}
              <div className={`relative p-4 rounded-3xl border-2 border-dashed transition-all duration-500 ${activeId === "guest" ? "border-pink-300 bg-white/80 shadow-inner" : "border-slate-200 opacity-20"}`}>
                <div className="absolute -top-3 left-4 bg-pink-400 text-[8px] text-white px-2 py-0.5 rounded-full font-bold">QR BOUNDARY</div>
                <div className="flex gap-4">
                  <NodeItem id="guest" active={activeId === "guest"} icon="✍️" label="방명록" theme="event" />
                  <NodeItem id="guest" active={activeId === "guest"} icon="💬" label="축하메시지" theme="event" />
                  <NodeItem id="guest" active={activeId === "guest"} icon="💸" label="축의금" theme="event" />
                </div>
              </div>

              <DiagramArrow active={activeId === "report"} theme="event" />

              {/* 예식 직후 (Post) 수렴 */}
              <NodeItem id="report" active={activeId === "report"} icon="📊" label="웨딩 리포트" theme="post" />
              <DiagramArrow active={activeId === "couple"} theme="post" />
              <NodeItem id="couple" active={activeId === "couple"} icon="💍" label="신랑 · 신부" theme="post" />
              
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}