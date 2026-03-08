import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AccessibilityProvider } from "@/hooks/useAccessibility";
import { useTranslation } from "react-i18next";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import QuizManager from "./pages/QuizManager";
import JoinRoomPage from "./pages/JoinRoomPage";
import StudentRoomView from "./pages/StudentRoomView";
import TeacherRoomManage from "./pages/TeacherRoomManage";
import NotFound from "./pages/NotFound";
import DocumentationPage from "./pages/DocumentationPage";
import PricingPage from "./pages/PricingPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import FeaturesPage from "./pages/FeaturesPage";
import ContactPage from "./pages/ContactPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import CookiesPage from "./pages/CookiesPage";

const queryClient = new QueryClient();

function DashboardRouter() {
  const { user, role, profile, loading, signOut } = useAuth();
  const { t } = useTranslation();
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite">
      <div className="space-y-4 w-full max-w-md px-4">
        <div className="h-8 w-48 mx-auto rounded-xl bg-muted animate-pulse" />
        <div className="h-4 w-64 mx-auto rounded bg-muted animate-pulse" />
        <div className="h-64 w-full rounded-2xl bg-muted animate-pulse" />
      </div>
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  if (role === 'teacher' && !profile?.is_approved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4" role="alert">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-600 mx-auto" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Cadastro em Análise</h2>
          <p className="text-muted-foreground">Sua conta está aguardando aprovação do administrador.</p>
          <p className="text-sm text-muted-foreground">Você receberá um e-mail em <strong className="text-foreground">{user?.email}</strong> quando seu acesso for liberado.</p>
          <button onClick={() => signOut()} className="text-sm text-primary hover:underline">{t('common.logout')}</button>
        </div>
      </div>
    );
  }
  if (profile?.is_blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4" role="alert">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive mx-auto" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Conta Bloqueada</h2>
          <p className="text-muted-foreground">Sua conta foi bloqueada pelo administrador. Entre em contato para mais informações.</p>
          <button onClick={() => signOut()} className="text-sm text-primary hover:underline">{t('common.logout')}</button>
        </div>
      </div>
    );
  }
  if (role === 'teacher' || role === 'admin') return <TeacherDashboard />;
  return <StudentDashboard />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground" role="status" aria-live="polite">{t('common.loading')}</div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AccessibilityProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <a href="#main-content" className="skip-to-content">Skip to content</a>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/dashboard" element={<DashboardRouter />} />
              <Route path="/quizzes" element={<ProtectedRoute><QuizManager /></ProtectedRoute>} />
              <Route path="/join" element={<JoinRoomPage />} />
              <Route path="/room/:roomId/join" element={<ProtectedRoute><JoinRoomPage /></ProtectedRoute>} />
              <Route path="/room/:roomId" element={<ProtectedRoute><StudentRoomView /></ProtectedRoute>} />
              <Route path="/room/:roomId/manage" element={<ProtectedRoute><TeacherRoomManage /></ProtectedRoute>} />
              <Route path="/docs" element={<DocumentationPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/cookies" element={<CookiesPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AccessibilityProvider>
  </QueryClientProvider>
);

export default App;
