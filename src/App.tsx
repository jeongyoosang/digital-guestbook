// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import GuestPage from "./pages/GuestPage";
import DisplayPage from "./pages/DisplayPage";
import ConfirmPage from "./pages/ConfirmPage";
import ResultPage from "./pages/ResultPage";
import ReplayPage from "./pages/ReplayPage"; // ✅ 신랑·신부용 메세지 다시보기
import { AdminPage } from "./pages/AdminPage"; // ✅ 어드민 대시보드

// ✅ IA 1단계 추가
import LoginPage from "./pages/LoginPage";
import AuthGuard from "@/components/AuthGuard";
import AppLayout from "./pages/app/AppLayout";
import EventHome from "./pages/app/EventHome";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <BrowserRouter>
        <Routes>
          {/* 랜딩페이지 */}
          <Route path="/" element={<Index />} />

          {/* ✅ 로그인 */}
          <Route path="/login" element={<LoginPage />} />

          {/* ✅ /app (로그인 필수 IA) */}
          <Route
            path="/app"
            element={
              <AuthGuard>
                <AppLayout />
              </AuthGuard>
            }
          >
            {/* 임시 이벤트 홈 */}
            <Route path="event/:eventId" element={<EventHome />} />
          </Route>

          {/* 하객 입력 페이지 */}
          <Route path="/guest/:eventId" element={<GuestPage />} />

          {/* 디스플레이 페이지 (스탠바이미용) */}
          <Route path="/display/:eventId" element={<DisplayPage />} />

          {/* 예식 전날/당일 설정 확정 페이지 (기존 유지) */}
          <Route path="/confirm/:eventId" element={<ConfirmPage />} />

          {/* 예식 종료 후 결과/엑셀 다운로드 페이지 (기존 유지) */}
          <Route path="/result/:eventId" element={<ResultPage />} />

          {/* 신랑·신부용 메세지 전체화면 다시보기 페이지 (기존 유지) */}
          <Route path="/replay/:eventId" element={<ReplayPage />} />

          {/* ✅ Admin 대시보드 (일단 기존 유지. 다음에 AuthGuard 적용 가능) */}
          <Route path="/admin" element={<AdminPage />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
