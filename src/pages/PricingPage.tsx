import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { STRIPE_PLANS, PlanKey } from '@/lib/stripe-plans';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Check, Sparkles, ArrowLeft, Crown, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PricingPage() {
  const navigate = useNavigate();
  const { user, session, subscription } = useAuth();
  const [loading, setLoading] = useState<PlanKey | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const currentPlan = subscription.plan || 'free';

  const handleCheckout = async (planKey: PlanKey) => {
    if (!user || !session) {
      toast.error('Faça login para assinar um plano');
      navigate('/auth');
      return;
    }

    if (planKey === 'free') {
      toast.info('Você já está no plano gratuito!');
      return;
    }

    setLoading(planKey);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId: STRIPE_PLANS[planKey].price_id },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao iniciar checkout');
    } finally {
      setLoading(null);
    }
  };

  const planMeta: Record<PlanKey, { icon: typeof Sparkles; highlight: boolean; badge?: string }> = {
    free: { icon: Sparkles, highlight: false },
    pro: { icon: Crown, highlight: true, badge: 'Mais Popular' },
    institutional: { icon: Building2, highlight: false },
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-8 rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">
            Escolha o plano ideal
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comece gratuitamente e faça upgrade quando precisar. Todos os planos incluem as 3 fases completas do TBL.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {(Object.entries(STRIPE_PLANS) as [PlanKey, typeof STRIPE_PLANS[PlanKey]][]).map(([key, plan], i) => {
            const meta = planMeta[key];
            const Icon = meta.icon;
            const isLoading = loading === key;

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
               className={`relative rounded-3xl border p-8 flex flex-col ${
                  currentPlan === key
                    ? 'border-primary ring-2 ring-primary/30 bg-primary/[0.03] shadow-xl shadow-primary/10 scale-[1.02]'
                    : meta.highlight
                    ? 'border-primary/50 bg-primary/[0.02] shadow-lg shadow-primary/5'
                    : 'border-border bg-card'
                }`}
              >
                {meta.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {meta.badge}
                  </div>
                )}

                <div className="mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                    meta.highlight ? 'bg-primary/15' : 'bg-accent'
                  }`}>
                    <Icon className={`w-6 h-6 ${meta.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-heading font-bold">
                      {plan.price === 0 ? 'Grátis' : `R$${plan.price.toFixed(2).replace('.', ',')}`}
                    </span>
                    {plan.price > 0 && <span className="text-muted-foreground text-sm">/mês</span>}
                  </div>
                  {plan.price > 0 && (
                    <p className="text-sm text-primary font-semibold mt-2">
                      🎉 7 dias grátis · Cancele quando quiser
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${meta.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2">
                  <Button
                    onClick={() => handleCheckout(key)}
                    disabled={isLoading || loading !== null || currentPlan === key}
                    variant={currentPlan === key ? 'secondary' : meta.highlight ? 'default' : 'outline'}
                    className={`w-full rounded-2xl h-12 ${
                      meta.highlight && currentPlan !== key ? 'shadow-lg shadow-primary/20' : ''
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {currentPlan === key ? '✓ Plano Atual' : key === 'free' ? 'Plano Gratuito' : 'Assinar Agora'}
                  </Button>
                  {currentPlan === key && subscription.subscribed && key !== 'free' && (
                    <Button
                      onClick={async () => {
                        setCancelLoading(true);
                        try {
                          const { data, error } = await supabase.functions.invoke('customer-portal');
                          if (error) throw error;
                          if (data?.url) window.location.href = data.url;
                        } catch (err: any) {
                          toast.error(err.message || 'Erro ao abrir portal');
                        } finally { setCancelLoading(false); }
                      }}
                      disabled={cancelLoading}
                      variant="ghost"
                      className="w-full rounded-2xl h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {cancelLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Cancelar Assinatura
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
