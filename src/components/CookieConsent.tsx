import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, Settings, Shield, BarChart3, Cog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useCookieConsent } from '@/hooks/useCookieConsent';

export default function CookieConsent() {
  const { hasConsented, acceptAll, acceptEssentialOnly, updateConsent } = useCookieConsent();
  const [showCustomize, setShowCustomize] = useState(false);
  const [functional, setFunctional] = useState(true);
  const [analytics, setAnalytics] = useState(true);

  if (hasConsented) return null;

  const handleSaveCustom = () => {
    updateConsent({ functional, analytics });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[60] p-3 sm:p-4"
      >
        <div className="max-w-2xl mx-auto bg-card border border-border/60 rounded-2xl shadow-2xl shadow-foreground/10 overflow-hidden">
          {!showCustomize ? (
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Cookie className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm sm:text-base">Utilizamos cookies</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                    Usamos cookies para melhorar sua experiência, lembrar preferências e entender como a plataforma é utilizada.{' '}
                    <Link to="/cookies" className="text-primary hover:underline font-medium">Saiba mais</Link>
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={acceptAll} size="sm" className="rounded-xl flex-1 shadow-md shadow-primary/20">
                  Aceitar Todos
                </Button>
                <Button onClick={acceptEssentialOnly} variant="outline" size="sm" className="rounded-xl flex-1">
                  Apenas Essenciais
                </Button>
                <Button onClick={() => setShowCustomize(true)} variant="ghost" size="sm" className="rounded-xl">
                  <Settings className="w-4 h-4 mr-1.5" /> Personalizar
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-5">
                <Cog className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-bold">Preferências de Cookies</h3>
              </div>
              <div className="space-y-4 mb-5">
                {/* Essential */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">Essenciais</p>
                      <p className="text-xs text-muted-foreground">Autenticação e sessão. Sempre ativos.</p>
                    </div>
                  </div>
                  <Switch checked disabled className="opacity-60" />
                </div>
                {/* Functional */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Settings className="w-4 h-4 text-[hsl(var(--phase-trat))]" />
                    <div>
                      <p className="text-sm font-semibold">Funcionalidade</p>
                      <p className="text-xs text-muted-foreground">Tema, idioma, cache offline.</p>
                    </div>
                  </div>
                  <Switch checked={functional} onCheckedChange={setFunctional} />
                </div>
                {/* Analytics */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4 text-[hsl(var(--phase-app))]" />
                    <div>
                      <p className="text-sm font-semibold">Analíticos</p>
                      <p className="text-xs text-muted-foreground">Páginas visitadas, uso de features, funil de conversão.</p>
                    </div>
                  </div>
                  <Switch checked={analytics} onCheckedChange={setAnalytics} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveCustom} size="sm" className="rounded-xl flex-1">
                  Salvar Preferências
                </Button>
                <Button onClick={() => setShowCustomize(false)} variant="ghost" size="sm" className="rounded-xl">
                  Voltar
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
