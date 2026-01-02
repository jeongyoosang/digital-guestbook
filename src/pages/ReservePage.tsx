import { ReservationForm } from "@/components/ReservationForm";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function ReservePage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#F6F4EF] text-zinc-900">
      {/* ✅ PC에서 너무 좁지 않게 */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
        {/* 상단 네비 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-zinc-600 hover:text-zinc-900 underline underline-offset-4"
          >
            ← 처음으로
          </button>

          <button
            onClick={() => navigate("/login")}
            className="text-sm text-zinc-600 hover:text-zinc-900 underline underline-offset-4"
          >
            결혼식 리포트 보기
          </button>
        </div>

        {/* 헤더 */}
        <header className="mt-8 sm:mt-10">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            결혼식 예약 신청
          </h1>

          <p className="mt-4 text-base sm:text-lg text-zinc-600 leading-relaxed">
            날짜와 기본 정보만 먼저 받아요.
            <br />
            <span className="text-zinc-700 font-medium">
              예식 설정은 예식 2주 전에 진행됩니다.
            </span>
          </p>

          {/* ✅ 여기는 ‘제출 전 안내’로만 간단하게 */}
          <div className="mt-5 rounded-2xl border border-zinc-200 bg-white/70 px-5 py-4 text-sm text-zinc-600">
            제출 후 <span className="font-medium text-zinc-800">카카오톡</span>으로
            입금 및 확정 안내를 드립니다.
            <br />
            입금 확인 후 예약이 확정됩니다.
          </div>
        </header>

        {/* 폼 */}
        <section className="mt-8">
          {/* ✅ 카드 폭/패딩도 PC에서 충분히 */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5 sm:p-7">
            <ReservationForm />
          </div>
        </section>

        {/* 하단 */}
        <section className="mt-10 flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={() => navigate("/")}>
            처음으로 돌아가기
          </Button>
          <Button variant="outline" onClick={() => navigate("/login")}>
            이미 예약했어요 (리포트 보기)
          </Button>
        </section>
      </div>
    </main>
  );
}
