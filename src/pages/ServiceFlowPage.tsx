import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import Footer from "@/components/Footer";

// --- Types ---
type FlowNode = "reserve" | "setup" | "guest" | "message" | "report" | "couple";

interface StepData {
  id: FlowNode;
  sectionId: string;
  title: string;
  desc: string;
  icon: string;
  imgSrc?: string; // 여기에 실제 촬영하신 이미지 경로를 넣으세요
}

const STEPS: StepData[] = [
  {
    id: "reserve",
    sectionId: "sf-reserve",
    title: "01. 간편한 예약",
    desc: "예식 날짜와 기본 정보만으로 1분 만에 예약을 완료하세요. 확정 안내는 카카오톡 알림톡으로 즉시 발송됩니다.",
    icon: "📅",
    imgSrc: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=1000&auto=format&fit=crop", // 예시 이미지
  },
  {
    id: "setup",
    sectionId: "sf-setup",
    title: "02. 우리만의 맞춤 설정",
    desc: "신랑·신부님의 사진, 감사 문구, 계좌 정보까지 예식 분위기에 맞춰 자유롭게 커스텀할 수 있습니다.",
    icon: "⚙️",
    imgSrc: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "message",
    sectionId: "sf-message",
    title: "03. 현장 QR 참여",
    desc: "하객들은 앱 설치 없이 QR 스캔만으로 축하 메시지와 사진을 남깁니다. 현장의 감동을 실시간으로 기록하세요.",
    icon: "✍️",
    imgSrc: "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "report",
    sectionId: "sf-report",
    title: "04. 스마트한 웨딩 리포트",
    desc: "예식이 끝나면 하객 명단, 메시지, 축의금 내역이 정돈된 리포트로 자동 생성되어 전달됩니다.",
    icon: "📊",
    imgSrc: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "couple",
    sectionId: "sf-couple",
    title: "05. 영원한 보관",
    desc: "정리된 데이터는 언제든 다시 꺼내 볼 수 있으며, 하객들에게 보낼 감사 인사 카드까지 한 번에 관리하세요.",
    icon: "💍",
    imgSrc: "https://images.unsplash.com/photo-1519225495806-7d522f228302?q=80&w=1000&auto=format&fit=crop",
  },
];

// --- Components ---

function IconNode({ active, icon, label }: { active: boolean; icon: string; label: string }) {
  return (
    <div className={`flex flex-col items-center gap-3 transition-all duration-500 ${active ? "scale-110 opacity-100" : "scale-90 opacity-20 grayscale"}`}>
      <div className={`flex h-20 w-20 items-center justify-center rounded-[2rem] border-2 transition-all duration-500 ${active ? "border-pink-400 bg-white shadow-[0_0_30px_rgba(244,114,182,0.3)]" : "border-slate-200 bg-slate-50"}`}>
        <span className="text-3xl">{icon}</span>
      </div>
      <span className={`text-xs font-bold tracking-tight ${active ? "text-slate-900" : "text-slate-400"}`}>{label}</span>
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
      { rootMargin: "-30% 0px -60% 0px", threshold: 0.1 }
    );

    STEPS.forEach((step) => {
      const el = document.getElementById(step.sectionId);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <main className="relative min-h-screen bg-[#fafafa]">
      {/* Header */}
      <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <button onClick={() => navigate("/")} className="text-lg font-bold tracking-tighter text-slate-900">Digital Guestbook</button>
          <button onClick={() => navigate("/reserve")} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 transition">시작하기</button>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-16 lg:grid-cols-[1fr_420px]">
          
          {/* LEFT: 이미지 + 상세 설명 */}
          <div className="space-y-32">
            {STEPS.map((step) => (
              <section key={step.id} id={step.sectionId} className="scroll-mt-40">
                <div className="mb-8 space-y-4">
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900">{step.title}</h2>
                  <p className="text-lg leading-relaxed text-slate-500 max-w-xl">{step.desc}</p>
                </div>
                
                {/* 실제 사진 영역 */}
                <div className="aspect-[4/3] w-full overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl transition-transform duration-700 hover:scale-[1.02]">
                  {step.imgSrc ? (
                    <img src={step.imgSrc} alt={step.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">사진 준비 중</div>
                  )}
                </div>
              </section>
            ))}
          </div>

          {/* RIGHT: 고정 다이어그램 (Stripe Style) */}
          <div className="hidden lg:block">
            <div className="sticky top-40 flex h-[600px] flex-col items-center justify-center rounded-[3rem] border border-slate-100 bg-white/50 p-12 backdrop-blur-xl">
              <div className="relative grid grid-cols-1 gap-12">
                {/* SVG 선 (배경) */}
                <div className="absolute inset-0 -z-10 flex flex-col items-center justify-between py-10">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 w-[2px] bg-gradient-to-b from-slate-100 to-slate-200" />
                  ))}
                </div>

                {STEPS.map((step) => (
                  <IconNode 
                    key={step.id}
                    active={activeId === step.id}
                    icon={step.icon}
                    label={step.title.split(". ")[1]}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}