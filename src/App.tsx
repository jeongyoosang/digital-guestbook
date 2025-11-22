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
import ReplayPage from "./pages/ReplayPage"; // ✅ 새로 추가된 풀스크린 메세지 페이지

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

          {/* 하객 입력 페이지 */}
          <Route path="/guest/:eventId" element={<GuestPage />} />

          {/* 디스플레이 페이지 (스탠바이미용) */}
          <Route path="/display/:eventId" element={<DisplayPage />} />

          {/* 예식 전날/당일 설정 확정 페이지 */}
          <Route path="/confirm/:eventId" element={<ConfirmPage />} />

          {/* ✅ 예식 종료 후 결과/엑셀 다운로드 페이지 */}
          <Route path="/result/:eventId" element={<ResultPage />} />

          {/* ✅ 신랑·신부용 메세지 전체화면 다시보기 페이지 (가로화면용) */}
          <Route path="/replay/:eventId" element={<ReplayPage />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
