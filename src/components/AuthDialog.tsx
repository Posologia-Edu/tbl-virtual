import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: 'signin' | 'signup';
}

export default function AuthDialog({ open, onOpenChange, defaultMode = 'signin' }: AuthDialogProps) {
  const [isSignUp, setIsSignUp] = useState(defaultMode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, fullName, 'teacher');
        toast.success(t('auth.accountCreated'));
        onOpenChange(false);
        navigate('/dashboard');
        return;
      } else {
        await signIn(email, password);
        toast.success(t('auth.welcomeBack'));
      }
      onOpenChange(false);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Falha na autenticação');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || 'Falha ao conectar com Google');
      setIsGoogleLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setEmail('');
    setPassword('');
    setFullName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden rounded-2xl border-border/40">
        <div className="p-6 pb-0">
          <DialogHeader className="items-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary" aria-hidden="true">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <DialogTitle className="font-heading text-xl">
              {isSignUp ? t('auth.createAccountTitle') : t('auth.signInTitle')}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {isSignUp ? t('auth.signUpDesc') : t('auth.signInDesc')}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          {/* Google Sign-In */}
          <Button
            variant="outline"
            className="w-full h-11 rounded-xl border-border/60 hover:bg-accent/40 gap-3 text-sm font-medium"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {isGoogleLoading ? 'Conectando...' : 'Continuar com Google'}
          </Button>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
              ou
            </span>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignUp && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-name" className="text-sm">{t('auth.fullName')}</Label>
                <Input
                  id="auth-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('auth.fullName')}
                  required
                  autoComplete="name"
                  className="h-10 rounded-xl"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="auth-email" className="text-sm">{t('auth.email')}</Label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="professor@email.com"
                required
                autoComplete="email"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-password" className="text-sm">{t('auth.password')}</Label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className="h-10 rounded-xl"
              />
            </div>
            <Button type="submit" className="w-full h-10 rounded-xl" disabled={isLoading}>
              {isLoading ? t('common.loading') : isSignUp ? t('auth.createAccountTitle') : t('auth.signInTitle')}
            </Button>
          </form>

          <div className="text-center pt-1 space-y-1">
            <button
              onClick={toggleMode}
              className="text-sm text-muted-foreground hover:text-primary transition-colors block mx-auto"
            >
              {isSignUp ? t('auth.hasAccount') : t('auth.noAccount')}
            </button>
            {!isSignUp && (
              <button
                onClick={() => {
                  onOpenChange(false);
                  navigate('/forgot-password');
                }}
                className="text-xs text-muted-foreground hover:text-primary transition-colors block mx-auto"
              >
                Esqueci minha senha
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
