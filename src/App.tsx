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
import ReplayPage from "./pages/ReplayPage";
import { AdminPage } from "./pages/AdminPage";

// ✅ IA
import LoginPage from "./pages/LoginPage";
import AuthGuard from "@/components/AuthGuard";
import AppLayout from "./pages/app/AppLayout";
import EventHome from "./pages/app/EventHome";

// ✅ Legacy redirect
import LegacyConfirmRedirect from "./pages/LegacyConfirmRedirect";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <BrowserRouter>
        <Routes>
          {/* 랜딩 */}
          <Route path="/" element={<Index />} />

          {/* 로그인 */}
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
            <Route path="event/:eventId" element={<EventHome />} />

            {/* ✅ IA 2단계: Confirm 이사 */}
            <Route path="event/:eventId/settings" element={<ConfirmPage />} />
          </Route>

          {/* 하객 입력 */}
          <Route path="/guest/:eventId" element={<GuestPage />} />

          {/* 디스플레이 */}
          <Route path="/display/:eventId" element={<DisplayPage />} />

          {/* ✅ 레거시 confirm 링크 유지: /confirm -> /app/event/:id/settings */}
          <Route path="/confirm/:eventId" element={<LegacyConfirmRedirect />} />

          {/* 결과/다시보기 (일단 기존 유지) */}
          <Route path="/result/:eventId" element={<ResultPage />} />
          <Route path="/replay/:eventId" element={<ReplayPage />} />

          {/* Admin (일단 기존 유지) */}
          <Route path="/admin" element={<AdminPage />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
