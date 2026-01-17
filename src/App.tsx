// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

/* ===== Public Pages ===== */
import Index from "./pages/Index";
import ReservePage from "./pages/ReservePage";
import ServiceFlowPage from "./pages/ServiceFlowPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

/* ===== Guest / Display ===== */
import GuestPage from "./pages/GuestPage";
import DisplayPage from "./pages/DisplayPage";
import ReplayPage from "./pages/ReplayPage";

/* ===== Legacy Redirects ===== */
import LegacyConfirmRedirect from "./pages/LegacyConfirmRedirect";
import LegacyResultRedirect from "./pages/LegacyResultRedirect";

/* ===== Link + Code Join ===== */
import InviteAcceptPage from "./pages/app/InviteAcceptPage";
import JoinByCodePage from "./pages/app/JoinByCodePage";

/* ===== IA (Logged-in App) ===== */
import AuthGuard from "@/components/AuthGuard";
import AppLayout from "./pages/app/AppLayout";
import EventHome from "./pages/app/EventHome";
import ConfirmPage from "./pages/ConfirmPage";
import ReportPage from "./pages/app/ReportPage";

/* ===== Admin ===== */
import { AdminPage } from "./pages/admin/AdminPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <BrowserRouter>
        <Routes>
          {/* ===============================
              Public / Landing
          =============================== */}
          <Route path="/" element={<Index />} />
          <Route path="/service-flow" element={<ServiceFlowPage />} />
          <Route path="/reserve" element={<ReservePage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* ===============================
              Invite / Join
              - 링크 공유: /invite/{token}
              - 코드 입력: /join
          =============================== */}
          <Route path="/invite/:token" element={<InviteAcceptPage />} />
          <Route path="/join" element={<JoinByCodePage />} />

          {/* ===============================
              IA App (Login Required)
          =============================== */}
          <Route
            path="/app"
            element={
              <AuthGuard>
                <AppLayout />
              </AuthGuard>
            }
          >
            <Route index element={<EventHome />} />
            <Route path="event/:eventId/settings" element={<ConfirmPage />} />
            <Route path="event/:eventId/report" element={<ReportPage />} />
          </Route>

          {/* ===============================
              Guest / Display (No Login)
          =============================== */}
          <Route path="/guest/:eventId" element={<GuestPage />} />
          <Route path="/display/:eventId" element={<DisplayPage />} />
          <Route path="/replay/:eventId" element={<ReplayPage />} />

          {/* ===============================
              Legacy URLs (Backward Compat)
          =============================== */}
          <Route path="/confirm/:eventId" element={<LegacyConfirmRedirect />} />
          <Route path="/result/:eventId" element={<LegacyResultRedirect />} />

          {/* ===============================
              Admin (Isolated Auth)
          =============================== */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminPage />} />

          {/* ===============================
              404
          =============================== */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
