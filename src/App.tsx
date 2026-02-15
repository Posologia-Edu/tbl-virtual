import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import QuizManager from "./pages/QuizManager";
import JoinRoomPage from "./pages/JoinRoomPage";
import StudentRoomView from "./pages/StudentRoomView";
import TeacherRoomManage from "./pages/TeacherRoomManage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function DashboardRouter() {
  const { user, role, profile, loading, signOut } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (role === 'teacher' && !profile?.is_approved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-600 mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Cadastro em Análise</h2>
          <p className="text-muted-foreground">Sua conta está aguardando aprovação do administrador. Você receberá um e-mail quando seu acesso for liberado.</p>
          <button onClick={() => signOut()} className="text-sm text-primary hover:underline">Sair</button>
        </div>
      </div>
    );
  }
  if (profile?.is_blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Conta Bloqueada</h2>
          <p className="text-muted-foreground">Sua conta foi bloqueada pelo administrador. Entre em contato para mais informações.</p>
          <button onClick={() => signOut()} className="text-sm text-primary hover:underline">Sair</button>
        </div>
      </div>
    );
  }
  if (role === 'teacher' || role === 'admin') return <TeacherDashboard />;
  return <StudentDashboard />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dashboard" element={<DashboardRouter />} />
            <Route path="/quizzes" element={<ProtectedRoute><QuizManager /></ProtectedRoute>} />
            <Route path="/join" element={<JoinRoomPage />} />
            <Route path="/room/:roomId/join" element={<ProtectedRoute><JoinRoomPage /></ProtectedRoute>} />
            <Route path="/room/:roomId" element={<ProtectedRoute><StudentRoomView /></ProtectedRoute>} />
            <Route path="/room/:roomId/manage" element={<ProtectedRoute><TeacherRoomManage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
