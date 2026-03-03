import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { STRIPE_PLANS, PlanKey } from '@/lib/stripe-plans';
import { useNavigate } from 'react-router-dom';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  currentPlan: PlanKey;
};

const FEATURE_PLAN_MAP: Record<string, PlanKey[]> = {
  'Geração de Questões com IA': ['pro', 'institutional'],
  'Relatórios Detalhados': ['pro', 'institutional'],
  'Exportar CSV/PDF': ['pro', 'institutional'],
  'Salas ilimitadas': ['pro', 'institutional'],
  'Alunos ilimitados': ['pro', 'institutional'],
  'Questionários ilimitados': ['pro', 'institutional'],
  'Questões ilimitadas por questionário': ['pro', 'institutional'],
  'Painel Administrativo': ['institutional'],
  'White-label': ['institutional'],
  'Integração LMS': ['institutional'],
  'Múltiplos Professores': ['institutional'],
  'IA Ilimitada': ['institutional'],
};

export default function UpgradeDialog({ open, onOpenChange, feature, currentPlan }: Props) {
  const navigate = useNavigate();
  const suggestedPlans = FEATURE_PLAN_MAP[feature] || ['pro', 'institutional'];

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/pricing');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Crown className="w-5 h-5 text-amber-500" />
            Recurso Premium
          </DialogTitle>
          <DialogDescription>
            <strong>{feature}</strong> não está disponível no plano <strong>{STRIPE_PLANS[currentPlan].name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3">
          <p className="text-sm text-muted-foreground">Faça upgrade para desbloquear:</p>
          {suggestedPlans.map(planKey => {
            const plan = STRIPE_PLANS[planKey];
            return (
              <Card key={planKey} className="border-primary/20 hover:border-primary/50 transition-colors cursor-pointer" onClick={handleUpgrade}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-base">{plan.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        R${plan.price.toFixed(2).replace('.', ',')}/mês
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {plan.features.slice(0, 3).map((f, i) => (
                        <span key={i} className="text-xs flex items-center gap-1 text-muted-foreground">
                          <CheckCircle2 className="w-3 h-3 text-primary" /> {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-primary shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Depois</Button>
          <Button onClick={handleUpgrade} className="gap-1">
            <Sparkles className="w-4 h-4" /> Ver Planos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
