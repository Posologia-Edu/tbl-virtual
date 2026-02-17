import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import AccessibilityMenu from '@/components/AccessibilityMenu';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? true : false;
  const [isSignUp, setIsSignUp] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
        return;
      } else {
        await signIn(email, password);
        toast.success(t('auth.welcomeBack'));
      }
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Falha na autenticação');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <AccessibilityMenu />
      </div>
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-4">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" aria-label={t('auth.backToHome')}>
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> {t('auth.backToHome')}
          </button>
          <div className="flex flex-col items-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary" aria-hidden="true">
              <GraduationCap className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-heading font-bold tracking-tight">TBL Virtual</h1>
            <p className="text-muted-foreground">{t('auth.teacherArea')}</p>
          </div>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="font-heading text-xl">{isSignUp ? t('auth.createAccountTitle') : t('auth.signInTitle')}</CardTitle>
            <CardDescription>
              {isSignUp ? t('auth.signUpDesc') : t('auth.signInDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" aria-label={isSignUp ? t('auth.createAccountTitle') : t('auth.signInTitle')}>
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="name">{t('auth.fullName')}</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('auth.fullName')}
                    required
                    autoComplete="name"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="professor@email.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t('common.loading') : isSignUp ? t('auth.createAccountTitle') : t('auth.signInTitle')}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isSignUp ? t('auth.hasAccount') : t('auth.noAccount')}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
