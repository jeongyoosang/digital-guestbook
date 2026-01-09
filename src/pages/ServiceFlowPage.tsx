import { useEffect, useMemo, useState } from "react";
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

const placeholderChart =
  "https://placehold.co/900x600/f1f5f9/475569?text=Wedding+Report+Chart";
const placeholderCouple =
  "https://placehold.co/900x600/fdf2f8/db2777?text=Just+Married";

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
    desc: "QR 스캔으로 방명록, 축하 메시지, 축의금 송금을 한 번에. 예식장 로비의 스탠드형 디스플레이 화면과 실시간 축하메세지가 반영 됩니다.",
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
    images: [placeholderChart],
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
    images: [placeholderCouple],
    theme: "post",
  },
];

// ====== sizing knobs (웹 기준 통일) ======
const PHONE_H_DESKTOP = 520; // ✅ 1-0(웹 이미지) 높이에 맞춰 폰들도 키움
const PHONE_H_MOBILE = 420; // 모바일은 적당히
const WEB_H_DESKTOP = 520; // reserve의 1-0 높이
// =======================================

export default function ServiceFlowPage() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<FlowNode>("reserve");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const step = STEPS.find((s) => s.sectionId === entry.target.id);
          if (step) setActiveId(step.id);
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

  const activeIndex = useMemo(() => STEPS.findIndex((s) => s.id === activeId), [activeId]);
  const activeStep = STEPS[activeIndex] ?? STEPS[0];

  const themeColor =
    activeStep.theme === "prep"
      ? "border-indigo-400"
      : activeStep.theme === "event"
      ? "border-pink-400"
      : "border-emerald-400";

  return (
    <main className="relative min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-slate-50 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="text-xl font-bold tracking-tighter uppercase"
          >
            Digital Guestbook
          </button>
          <button
            onClick={() => navigate("/reserve")}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:scale-105"
          >
            시작하기
          </button>
        </div>
      </header>

      {/* 모바일 탭 */}
      <div className="sticky top-[65px] z-40 flex w-full justify-around bg-white/90 p-3 backdrop-blur-md border-b border-slate-100 lg:hidden">
        {STEPS.map((step) => (
          <div
            key={step.id}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-all duration-300 ${
              activeId === step.id
                ? `${themeColor} bg-white shadow-md scale-110`
                : "border-transparent opacity-30"
            }`}
          >
            <span className="text-lg">{step.icon}</span>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="grid gap-16 lg:grid-cols-[1fr_420px]">
          {/* 왼쪽 콘텐츠 */}
          <div className="space-y-40 lg:space-y-64">
            {STEPS.map((step) => (
              <section key={step.id} id={step.sectionId} className="scroll-mt-48">
                <div className="mb-10 space-y-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                      step.theme === "prep"
                        ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                        : step.theme === "event"
                        ? "bg-pink-50 text-pink-600 border-pink-100"
                        : "bg-emerald-50 text-emerald-600 border-emerald-100"
                    }`}
                  >
                    {step.dDay}
                  </span>

                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 lg:text-4xl">
                    {step.title}
                  </h2>

                  <p className="max-w-2xl text-lg leading-relaxed text-slate-500">
                    {step.desc}
                  </p>

                  {/* ✅ 03 섹션 작은 각주 */}
                  {step.id === "guest" && (
                    <p className="text-sm text-slate-400">
                      * 기본 스탠드형 디스플레이 1대 제공
                    </p>
                  )}
                </div>

                {/* 01. 예약하기 */}
                {step.id === "reserve" ? (
                  <div className="flex flex-col items-center gap-6 lg:items-start">
                    {/* Desktop */}
                    <div className="hidden lg:flex w-full max-w-3xl items-stretch gap-6">
                      {/* 1-0 웹 (높이 고정) */}
                      <div
                        className="flex-1 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg"
                        style={{ height: WEB_H_DESKTOP }}
                      >
                        <img
                          src="/serviceflow1-0.jpg"
                          alt="web-reserve"
                          className="h-full w-full object-cover"
                        />
                      </div>

                      {/* 1-2 폰 (같은 높이, 대신 폭은 약간 줄임) */}
                      <div style={{ height: PHONE_H_DESKTOP }}>
                        <PhoneFrame
                          src="/serviceflow1-2.jpg"
                          alt="kakao"
                          height={PHONE_H_DESKTOP}
                          // ✅ 1-2는 조금 더 줄여달라 해서 width를 살짝 타이트
                          desktopWidth={240}
                        />
                      </div>
                    </div>

                    {/* Mobile */}
                    <div className="flex w-full max-w-3xl justify-center gap-4 lg:hidden">
                      <PhoneFrame
                        src="/serviceflow1.jpg"
                        alt="mobile-reserve"
                        height={PHONE_H_MOBILE}
                      />
                      <PhoneFrame
                        src="/serviceflow1-2.jpg"
                        alt="kakao"
                        height={PHONE_H_MOBILE}
                      />
                    </div>
                  </div>
                ) : null}

                {/* 02. 상세 설정 (요청대로: 상단 2-1 + 하단 폰 2개, 가운데 정렬) */}
                {step.id === "setup" ? (
                  <div className="flex flex-col items-center gap-6">
                    {/* 상단 2-1 */}
                    <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg">
                      <img
                        src="/serviceflow2-1.jpg"
                        alt="setup-web"
                        className="w-full object-contain"
                      />
                    </div>

                    {/* 하단 폰 2개 (웹에서도 크게, 높이 통일) */}
                    <div className="hidden lg:flex w-full max-w-3xl justify-center gap-6">
                      <PhoneFrame
                        src="/serviceflow2.jpg"
                        alt="setup-phone-1"
                        height={PHONE_H_DESKTOP}
                      />
                      <PhoneFrame
                        src="/serviceflow2-2.jpg"
                        alt="setup-phone-2"
                        height={PHONE_H_DESKTOP}
                      />
                    </div>

                    {/* 모바일 */}
                    <div className="flex w-full max-w-3xl justify-center gap-4 lg:hidden">
                      <PhoneFrame
                        src="/serviceflow2.jpg"
                        alt="setup-phone-1"
                        height={PHONE_H_MOBILE}
                      />
                      <PhoneFrame
                        src="/serviceflow2-2.jpg"
                        alt="setup-phone-2"
                        height={PHONE_H_MOBILE}
                      />
                    </div>
                  </div>
                ) : null}

                {/* 03. 하객 참여: 영상은 절대 안 잘리게 (contain), 하단 3장은 적당히 crop ok */}
                {step.id === "guest" ? (
                  <div className="flex flex-col items-center gap-6 lg:items-start lg:max-w-3xl">
                    <div className="w-full overflow-hidden rounded-[2rem] border border-slate-100 bg-black shadow-xl">
                      <div className="aspect-video w-full">
                        <video
                          autoPlay
                          muted
                          loop
                          playsInline
                          className="h-full w-full object-contain"
                        >
                          <source src={step.video} type="video/mp4" />
                        </video>
                      </div>
                    </div>

                    <div className="grid w-full grid-cols-3 gap-3">
                      {step.images.map((img, idx) => (
                        <div
                          key={idx}
                          className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm"
                        >
                          <img
                            src={img}
                            alt={`guest-${idx}`}
                            className="aspect-square w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* 04/05 공통 */}
                {step.id !== "reserve" && step.id !== "setup" && step.id !== "guest" ? (
                  <div className="flex justify-center lg:justify-start lg:max-w-3xl">
                    <img
                      src={step.images[0]}
                      alt={step.title}
                      className="w-full lg:max-w-[560px] rounded-2xl border border-slate-100 shadow-lg object-contain bg-slate-50"
                    />
                  </div>
                ) : null}
              </section>
            ))}
          </div>

          {/* 오른쪽 다이어그램 */}
          <div className="hidden lg:block">
            <div className="sticky top-24 flex flex-col items-center pt-10 pb-8 px-8 rounded-[3rem] bg-slate-50/50 border border-slate-100 backdrop-blur-sm">
              {/* 예약 -> 상세설정 */}
              <div className="relative flex flex-col items-center w-full">
                <DiagramNode active={activeId === "reserve"} icon="📅" label="예약하기" theme="prep" />
                <BridgeArrow active={activeIndex >= 1} activeColor="#818cf8" />
                <DiagramNode active={activeId === "setup"} icon="⚙️" label="상세 설정" theme="prep" />
                <div className="absolute right-0 top-[20%] -translate-y-1/2 translate-x-4">
                  <span className="text-[10px] font-black text-indigo-500 tracking-widest uppercase bg-white/80 py-1 px-3 rounded-full shadow-sm border border-indigo-100">
                    예식 전
                  </span>
                </div>
              </div>

              {/* 상세설정 -> 하객참여 */}
              <div className="w-32 flex justify-center">
                <BridgeArrow active={activeIndex >= 2} activeColor="#f472b6" />
              </div>

              {/* 하객 참여 */}
              <div className="relative flex flex-col items-center w-full my-2">
                <DiagramNode active={activeId === "guest"} icon="👥" label="하객 참여" theme="event" />

                <div className="absolute right-0 top-6 translate-x-4">
                  <span className="text-[10px] font-black text-pink-500 tracking-widest uppercase bg-white/80 py-1 px-3 rounded-full shadow-sm border border-pink-100">
                    예식 중
                  </span>
                </div>

                <div
                  className={`relative mt-5 p-5 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 w-full ${
                    activeId === "guest"
                      ? "border-pink-400 bg-pink-50/30 shadow-xl"
                      : "border-slate-300 opacity-50 bg-white/50"
                  }`}
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pink-500 text-[10px] text-white px-4 py-0.5 rounded-full font-black uppercase tracking-wider">
                    QR Scan
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <SubBoxCard icon="✍️" label="방명록" active={activeId === "guest"} />
                    <SubBoxCard icon="💬" label="축하 메시지" active={activeId === "guest"} />
                    <SubBoxCard icon="💸" label="축의금" active={activeId === "guest"} />
                  </div>
                </div>

                {/* ✅ QR BOX 밖에서 출발 → 아래에서 수렴 → 단일 화살표로 리포트 */}
                <OutsideToReportArrows active={activeIndex >= 3} activeColor="#10b981" />
              </div>

              {/* 웨딩리포트 -> 신랑신부 */}
              <div className="relative flex flex-col items-center w-full mt-1">
                <DiagramNode active={activeId === "report"} icon="📊" label="웨딩 리포트" theme="post" />
                <BridgeArrow active={activeIndex >= 4} activeColor="#10b981" />
                <DiagramNode active={activeId === "couple"} icon="💍" label="신랑 · 신부" theme="post" />

                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4">
                  <span className="text-[10px] font-black text-emerald-500 tracking-widest uppercase bg-white/80 py-1 px-3 rounded-full shadow-sm border border-emerald-100">
                    예식 후
                  </span>
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

// ===== UI bits =====

function PhoneFrame({
  src,
  alt,
  height,
  desktopWidth = 260,
}: {
  src: string;
  alt: string;
  height: number;
  desktopWidth?: number;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[2.2rem] bg-black shadow-xl"
      style={{
        height,
        width: desktopWidth,
        padding: 8, // ✅ 얇은 베젤
      }}
    >
      <div className="h-full w-full overflow-hidden rounded-[1.8rem] bg-white">
        {/* ✅ 텍스트 가독성이 중요해서 contain 우선 */}
        <img src={src} alt={alt} className="h-full w-full object-contain bg-white" />
      </div>
    </div>
  );
}

function DiagramNode({ active, icon, label, theme }: any) {
  const colors =
    {
      prep: "text-indigo-600 border-indigo-400 bg-indigo-50 shadow-indigo-100",
      event: "text-pink-600 border-pink-400 bg-pink-50 shadow-pink-100",
      post: "text-emerald-600 border-emerald-400 bg-emerald-50 shadow-emerald-100",
    }[theme as "prep" | "event" | "post"] ?? "text-slate-600 border-slate-200 bg-white";

  return (
    <div
      className={`relative flex flex-col items-center justify-center w-28 h-20 rounded-2xl border-2 transition-all duration-500 ${
        active ? `${colors} scale-110 shadow-xl z-10` : "bg-white border-slate-200 text-slate-400 opacity-70"
      }`}
    >
      <span className="text-3xl mb-1">{icon}</span>
      <span className="text-[11px] font-bold">{label}</span>
    </div>
  );
}

function SubBoxCard({ icon, label, active }: { icon: string; label: string; active: boolean }) {
  return (
    <div
      className={`relative h-16 rounded-xl border-2 flex items-center justify-center bg-white transition-all ${
        active ? "border-pink-200 shadow-sm text-pink-900" : "border-slate-100 text-slate-400"
      }`}
    >
      <div className="flex flex-col items-center">
        <span className="text-2xl">{icon}</span>
        <span className="text-[9px] font-bold mt-1 text-center">{label}</span>
      </div>
    </div>
  );
}

function BridgeArrow({ active, activeColor }: { active: boolean; activeColor: string }) {
  return (
    <div className="h-12 w-6 flex items-center justify-center relative overflow-visible my-1">
      <svg width="20" height="48" viewBox="0 0 20 48" className="overflow-visible">
        <marker id={`head-${activeColor.replace("#", "")}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0 0, 6 3, 0 6" fill={active ? activeColor : "#E2E8F0"} />
        </marker>
        <line
          x1="10"
          y1="0"
          x2="10"
          y2="40"
          stroke={active ? activeColor : "#E2E8F0"}
          strokeWidth="2"
          strokeDasharray={active ? "none" : "4 4"}
          markerEnd={`url(#head-${activeColor.replace("#", "")})`}
          vectorEffect="non-scaling-stroke"
          shapeRendering="geometricPrecision"
        />
        {active && (
          <motion.line
            x1="10"
            y1="0"
            x2="10"
            y2="40"
            stroke="white"
            strokeWidth="2"
            strokeOpacity="0.6"
            vectorEffect="non-scaling-stroke"
            shapeRendering="geometricPrecision"
            initial={{ strokeDashoffset: 40, strokeDasharray: "10 30" }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          />
        )}
      </svg>
    </div>
  );
}

/**
 * ✅ QR box 밖에서 출발하는 3개 라인 → 아래에서 "수렴" → 단일 화살표로 리포트
 * - 한 점( junction )으로 모여서 뭉개짐/겹침을 줄임
 * - 리포트 상단에서 세 줄이 바로 겹치지 않게 설계
 */
function OutsideToReportArrows({ active, activeColor }: { active: boolean; activeColor: string }) {
  const base = active ? activeColor : "#E2E8F0";
  const dash = active ? "none" : "4 4";
  const headId = `merge-head-${activeColor.replace("#", "")}`;

  return (
    <div className="h-[84px] w-full flex items-center justify-center relative z-0 -mt-1 overflow-visible">
      <svg width="240" height="84" viewBox="0 0 240 84" className="overflow-visible">
        <defs>
          <marker id={headId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill={base} />
          </marker>
          <marker id={`${headId}-final`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <polygon points="0 0, 7 3.5, 0 7" fill={base} />
          </marker>
        </defs>

        {/* start points: QR 박스 밖(바로 아래) */}
        {/* junction */}
        {/* 설명: x=60/120/180 에서 내려와서 x=120,y=52로 수렴 */}
        <g
          stroke={base}
          strokeWidth="2"
          fill="none"
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
          shapeRendering="geometricPrecision"
        >
          {/* 3개가 junction으로 */}
          <path d="M60 4 V 38 H 120 V 52" markerEnd={`url(#${headId})`} />
          <path d="M120 4 V 52" markerEnd={`url(#${headId})`} />
          <path d="M180 4 V 38 H 120 V 52" markerEnd={`url(#${headId})`} />

          {/* junction -> report 로 단일 화살표 */}
          <path d="M120 52 V 80" markerEnd={`url(#${headId}-final)`} />
        </g>

        {/* active glow line */}
        {active && (
          <g stroke="white" strokeWidth="2" strokeOpacity="0.5" vectorEffect="non-scaling-stroke" shapeRendering="geometricPrecision">
            <motion.path
              d="M60 4 V 38 H 120 V 52"
              initial={{ strokeDashoffset: 120, strokeDasharray: "10 20" }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            />
            <motion.path
              d="M120 4 V 52"
              initial={{ strokeDashoffset: 80, strokeDasharray: "10 16" }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
            />
            <motion.path
              d="M180 4 V 38 H 120 V 52"
              initial={{ strokeDashoffset: 120, strokeDasharray: "10 20" }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            />
            <motion.path
              d="M120 52 V 80"
              initial={{ strokeDashoffset: 60, strokeDasharray: "10 18" }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ repeat: Infinity, duration: 1.0, ease: "linear" }}
            />
          </g>
        )}
      </svg>
    </div>
  );
}
