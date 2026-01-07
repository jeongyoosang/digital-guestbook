// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Index from "./pages/Index";
import ReservePage from "./pages/ReservePage";
import NotFound from "./pages/NotFound";
import GuestPage from "./pages/GuestPage";
import DisplayPage from "./pages/DisplayPage";
import ConfirmPage from "./pages/ConfirmPage";
import ReplayPage from "./pages/ReplayPage";
import { AdminPage } from "./pages/AdminPage";

// ✅ IA
import LoginPage from "./pages/LoginPage";
import AuthGuard from "@/components/AuthGuard";
import AppLayout from "./pages/app/AppLayout";
import EventHome from "./pages/app/EventHome";
import ReportPage from "./pages/app/ReportPage";

// ✅ Legacy redirect
import LegacyConfirmRedirect from "./pages/LegacyConfirmRedirect";
import LegacyResultRedirect from "./pages/LegacyResultRedirect";

// ✅ Service Flow
import ServiceFlowPage from "./pages/ServiceFlowPage";

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

          {/* ✅ 서비스 흐름 */}
          <Route path="/service-flow" element={<ServiceFlowPage />} />

          {/* 예약 */}
          <Route path="/reserve" element={<ReservePage />} />

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
            <Route path="event/:eventId/settings" element={<ConfirmPage />} />
            <Route path="event/:eventId/report" element={<ReportPage />} />
          </Route>

          {/* 하객 입력 */}
          <Route path="/guest/:eventId" element={<GuestPage />} />

          {/* 디스플레이 */}
          <Route path="/display/:eventId" element={<DisplayPage />} />

          {/* 레거시 링크 유지 */}
          <Route path="/confirm/:eventId" element={<LegacyConfirmRedirect />} />
          <Route path="/result/:eventId" element={<LegacyResultRedirect />} />

          {/* 다시보기 */}
          <Route path="/replay/:eventId" element={<ReplayPage />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminPage />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
