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

const placeholderChart =
  "https://placehold.co/800x600/f1f5f9/475569?text=Wedding+Report+Chart";
const placeholderCouple =
  "https://placehold.co/800x600/fdf2f8/db2777?text=Just+Married";

const STEPS: StepData[] = [
  {
    id: "reserve",
    sectionId: "sf-reserve",
    title: "01. 예약하기",
    desc: "예식 일자와 연락처만으로 간편하게 시작하세요. 예약 양식을 제출하면 카카오톡으로 안내 메시지가 발송됩니다.",
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
    desc: "신랑·신부 정보, 디스플레이 배경, 축의금 수취인 별 계좌 등 우리만의 예식 페이지를 맞춤 구성합니다.",
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
    desc: "QR 스캔으로 방명록, 축하 메시지, 축의금 송금을 한 번에.\n예식장 로비의 스탠드형 디스플레이 화면과 실시간 축하메세지가 반영 됩니다.",
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
    desc: "예식 종료와 동시에 방명록 명단, 축하 메시지, 축의금 내역이 깔끔한 리포트로 생성됩니다.",
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

  const activeIndex = STEPS.findIndex((s) => s.id === activeId);
  const activeStep = STEPS[activeIndex];
  const themeColor =
    activeStep?.theme === "prep"
      ? "border-indigo-400"
      : activeStep?.theme === "event"
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

                  <p className="max-w-2xl text-lg leading-relaxed text-slate-500 whitespace-pre-line">
                    {step.desc}
                  </p>


                  {/* 03 섹션 각주 */}
                  {step.id === "guest" && (
                    <p className="text-sm text-slate-400">
                      * 기본 스탠드형 디스플레이 1대 제공
                    </p>
                  )}

                  {/* 04 섹션 각주 */}
                  {step.id === "report" && (
                    <p className="text-sm text-slate-400">
                      * 예식 종료 후 본인 인증 절차를 거쳐 리포트가 생성되며, 지정된 수령인에게 제공됩니다.

                    </p>
                  )}

                </div>

                {/* 01 예약하기 */}
                {step.id === "reserve" && (
                  <>
                    {/* 모바일: 02 폰 이미지와 동일 사이즈(한 화면) */}
                    <div className="flex lg:hidden w-full justify-center gap-4">
                      <PhoneFrame src="/serviceflow1.jpg" alt="예약폼" />
                      <PhoneFrame src="/serviceflow1-2.jpg" alt="카톡" />
                    </div>

                    {/* 웹: 1-0 공백 제거 + 1-2 높이 맞춰 가로 덩어리 */}
                    <div className="hidden lg:flex w-full items-stretch justify-center gap-6 lg:max-w-4xl">
                      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg">
                        {/* 핵심: 공백 제거용 object-cover + object-top */}
                        <img
                          src="/serviceflow1-0.jpg"
                          alt="웹 예약 화면"
                          className="h-[420px] w-full object-cover object-top"
                        />
                      </div>

                      <div className="shrink-0">
                        <PhoneFrameDesktop
                          src="/serviceflow1-2.jpg"
                          alt="카톡 안내"
                          heightPx={460}
                        />
                      </div>
                    </div>
                  </>
                )}

              {/* 02 상세 설정 */}
              {step.id === "setup" && (
                <div className="flex flex-col items-center gap-6 lg:gap-8">
                  <div className="w-full lg:max-w-3xl overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg">
                    <img
                      src="/serviceflow2-1.jpg"
                      alt="상세설정 웹"
                      className="w-full object-contain"
                    />
                  </div>

                  {/* 모바일: 기존 PhoneFrame 유지 (지금 딱 좋다고 했으니 그대로) */}
                  <div className="flex w-full justify-center gap-4 lg:hidden">
                    <PhoneFrame src="/serviceflow2.jpg" alt="상세설정 폰1" />
                    <PhoneFrame src="/serviceflow2-2.jpg" alt="상세설정 폰2" />
                  </div>

                  {/* 웹(lg+): 01과 동일한 높이(420px)로 강제 */}
                  <div className="hidden lg:flex w-full justify-center gap-6">
                    <PhoneFrameDesktop
                      src="/serviceflow2.jpg"
                      alt="상세설정 폰1"
                      heightPx={460}
                    />
                    <PhoneFrameDesktop
                      src="/serviceflow2-2.jpg"
                      alt="상세설정 폰2"
                      heightPx={460}
                    />
                  </div>
                </div>
              )}


                {/* 03 하객 참여: 영상은 절대 안 잘리게 (contain), 아래 3장은 알아서 crop */}
                {step.id === "guest" && (
                  <div className="space-y-6 lg:max-w-3xl">
                    <div className="w-full overflow-hidden rounded-[2rem] border border-slate-100 bg-black shadow-xl">
                      <video
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-full h-auto object-contain"
                      >
                        <source src={step.video} type="video/mp4" />
                      </video>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {step.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          className="rounded-xl border border-slate-100 aspect-square object-cover shadow-sm bg-slate-50"
                          alt="guest-detail"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 04,05 기타 */}
                {step.id !== "reserve" && step.id !== "setup" && step.id !== "guest" && (
                  <div className="flex justify-center lg:justify-start lg:max-w-3xl">
                    <img
                      src={step.images[0]}
                      alt={step.title}
                      className="w-full lg:max-w-[560px] rounded-2xl border border-slate-100 shadow-lg object-contain bg-slate-50"
                    />
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* 오른쪽 다이어그램 */}
          <div className="hidden lg:block">
            <div className="sticky top-24 flex flex-col items-center pt-10 pb-8 px-8 rounded-[3rem] bg-slate-50/50 border border-slate-100 backdrop-blur-sm">
              {/* 예약하기 -> 상세설정 */}
              <div className="relative flex flex-col items-center w-full">
                <DiagramNode active={activeId === "reserve"} icon="📅" label="예약하기" theme="prep" />
                <FlowArrow active={activeIndex >= 1} color="#818cf8" />
                <DiagramNode active={activeId === "setup"} icon="⚙️" label="상세 설정" theme="prep" />

                <div className="absolute right-0 top-[20%] -translate-y-1/2 translate-x-4">
                  <span className="text-[10px] font-black text-indigo-500 tracking-widest uppercase bg-white/80 py-1 px-3 rounded-full shadow-sm border border-indigo-100">
                    예식 전
                  </span>
                </div>
              </div>

              {/* 상세설정 -> 하객참여 */}
              <div className="w-32 flex justify-center">
                <FlowArrow active={activeIndex >= 2} color="#f472b6" />
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
                    QR SCAN
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <SubBoxCard icon="✍️" label="방명록" active={activeId === "guest"} />
                    <SubBoxCard icon="💬" label="축하 메시지" active={activeId === "guest"} />
                    <SubBoxCard icon="💸" label="축의금" active={activeId === "guest"} />
                  </div>
                </div>

                {/* 흐르는 수렴 화살표 */}
                <ConvergeToReportFlow active={activeIndex >= 3} color="#10b981" />
              </div>

              {/* 웨딩리포트 -> 신랑신부 */}
              <div className="relative flex flex-col items-center w-full mt-1">
                <DiagramNode active={activeId === "report"} icon="📊" label="웨딩 리포트" theme="post" />
                <FlowArrow active={activeIndex >= 4} color="#10b981" />
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

/* -----------------------------
   공통 UI: 폰 프레임 (모바일/웹 통일)
------------------------------ */

// ✅ 모바일에서 01의 폰 2장 == 02의 폰 2장 사이즈 동일하게 고정
function PhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="w-[44%] max-w-[170px]">
      {/* 베젤 얇게: border-[4px] */}
      <div className="aspect-[9/19] overflow-hidden rounded-[2.2rem] border-[4px] border-slate-900 bg-slate-900 shadow-xl">
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover object-top bg-white"
        />
      </div>
    </div>
  );
}

// ✅ 데스크톱 폰 프레임: 높이 맞추기용 (01에서 1-0과 덩어리)
function PhoneFrameDesktop({
  src,
  alt,
  heightPx,
}: {
  src: string;
  alt: string;
  heightPx: number;
}) {
  // aspect 9/19 => width ≈ height * (9/19)
  const width = Math.round(heightPx * (9 / 19));

  return (
    <div style={{ height: `${heightPx}px`, width: `${width}px` }}>
      <div className="h-full w-full overflow-hidden rounded-[2.4rem] border-[5px] border-slate-900 bg-slate-900 shadow-xl">
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover object-top bg-white"
        />
      </div>
    </div>
  );
}

/* -----------------------------
   다이어그램 컴포넌트
------------------------------ */

function DiagramNode({
  active,
  icon,
  label,
  theme,
}: {
  active: boolean;
  icon: string;
  label: string;
  theme: "prep" | "event" | "post";
}) {
  const colors =
    {
      prep: "text-indigo-600 border-indigo-400 bg-indigo-50 shadow-indigo-100",
      event: "text-pink-600 border-pink-400 bg-pink-50 shadow-pink-100",
      post: "text-emerald-600 border-emerald-400 bg-emerald-50 shadow-emerald-100",
    }[theme];

  return (
    <div
      className={`relative flex flex-col items-center justify-center w-28 h-20 rounded-2xl border-2 transition-all duration-500 ${
        active ? `${colors} shadow-xl z-10` : "bg-white border-slate-200 text-slate-400 opacity-70"
      }`}
    >
      <span className="text-3xl mb-1">{icon}</span>
      <span className="text-[11px] font-bold">{label}</span>
    </div>
  );
}

function SubBoxCard({
  icon,
  label,
  active,
}: {
  icon: string;
  label: string;
  active: boolean;
}) {
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

/* -----------------------------
   흐르는 화살표(세로)
------------------------------ */

function FlowArrow({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="h-12 w-8 flex items-center justify-center my-1">
      <svg width="24" height="48" viewBox="0 0 24 48" fill="none">
        {/* base */}
        <path
          d="M12 2 V 40"
          stroke={active ? color : "#E2E8F0"}
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* arrow head */}
        <path
          d="M12 44 L6 36 M12 44 L18 36"
          stroke={active ? color : "#E2E8F0"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* flow overlay */}
        {active && (
          <motion.path
            d="M12 2 V 40"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeOpacity="0.55"
            vectorEffect="non-scaling-stroke"
            strokeDasharray="10 14"
            initial={{ strokeDashoffset: 24 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ repeat: Infinity, duration: 1.0, ease: "linear" }}
          />
        )}
      </svg>
    </div>
  );
}

/* -----------------------------
   3개 병렬 → 리포트 수렴(흐름 포함, 스크롤 깨짐 방지)
------------------------------ */

function ConvergeToReportFlow({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="h-16 w-full flex items-center justify-center relative -mt-1 overflow-visible">
      <svg
        width="220"
        height="70"
        viewBox="0 0 220 70"
        fill="none"
        className="overflow-visible"
        shapeRendering="geometricPrecision"
      >
        {/* base paths (3개) */}
        <g
          stroke={active ? color : "#E2E8F0"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          vectorEffect="non-scaling-stroke"
        >
          {/* left from box area */}
          <path d="M60 4 V 30 H 110 V 58" />
          {/* center */}
          <path d="M110 4 V 58" />
          {/* right */}
          <path d="M160 4 V 30 H 110 V 58" />
          {/* arrow head */}
          <path d="M110 62 L102 54 M110 62 L118 54" />
        </g>

        {/* flow overlay (3개) */}
        {active && (
          <g
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeOpacity="0.55"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
          >
            <motion.path
              d="M60 4 V 30 H 110 V 58"
              strokeDasharray="12 16"
              initial={{ strokeDashoffset: 28 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
            />
            <motion.path
              d="M110 4 V 58"
              strokeDasharray="12 16"
              initial={{ strokeDashoffset: 28 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
            />
            <motion.path
              d="M160 4 V 30 H 110 V 58"
              strokeDasharray="12 16"
              initial={{ strokeDashoffset: 28 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
            />
          </g>
        )}
      </svg>
    </div>
  );
}
