
# Implementacao de Travas por Plano, Contadores de IA e Painel Administrativo Completo

## Diagnostico Atual

### Stripe - OK
Os 3 produtos e precos estao corretamente cadastrados no Stripe e coincidem com o codigo (`stripe-plans.ts`):
- Gratuito: `prod_U1oaoU5nQAqqW3` / `price_1T3kxRH6ld7NmvcD24SoXT0g` (R$0)
- Pro: `prod_U1oaz7iVie1pFU` / `price_1T3kxkH6ld7NmvcDsA2078YR` (R$49,90/mes)
- Institucional: `prod_U1ob8n7iDfyGLT` / `price_1T3ky2H6ld7NmvcDoT8qGQfk` (R$149,90/mes)

### Problemas Identificados

1. **Nenhuma trava de plano existe** - Qualquer usuario pode usar IA, criar salas ilimitadas, ver analytics, exportar CSV/PDF sem restricao
2. **Nao ha contador de uso de IA** - Nenhuma tabela rastreia quantas vezes o usuario usou IA
3. **"Meu Plano" (renderMyPlan) sempre mostra "Gratis"** - Ignora o estado real da subscription do contexto de auth
4. **Admin nao ve usuarios pagantes** - So ve professores, sem info de plano
5. **Admin nao pode escolher plano ao aprovar/convidar** - Apenas aprova/bloqueia
6. **Signup nao atribui plano gratuito automaticamente** - O plano "gratuito" e inferido pela ausencia de subscription no Stripe, o que esta correto, mas nao ha enforcements

---

## Plano de Implementacao

### 1. Tabela de rastreamento de uso de IA (Migration)

Criar tabela `ai_usage_log` para rastrear cada chamada de IA por usuario:

```sql
CREATE TABLE public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  provider TEXT,
  tokens_used INTEGER DEFAULT 0
);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai usage"
  ON public.ai_usage_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert ai usage"
  ON public.ai_usage_log FOR INSERT
  WITH CHECK (true);
```

### 2. Atualizar `stripe-plans.ts` com limites de IA por plano

Adicionar `ai_questions_per_month` aos limites:
- Gratuito: `0` (IA bloqueada)
- Pro: `50`
- Institucional: `Infinity` (ilimitado)

### 3. Atualizar `check-subscription` para retornar uso de IA do mes

A edge function `check-subscription` sera expandida para consultar `ai_usage_log` e retornar `ai_used_this_month` junto com os dados de subscription existentes.

### 4. Atualizar `useAuth` para expor uso de IA

O contexto de auth passara a armazenar e expor `aiUsedThisMonth` alem dos dados de subscription existentes.

### 5. Atualizar `generate-quiz-ai` para registrar uso e validar limites

Antes de processar, a edge function:
- Verificara o plano do usuario (via check-subscription ou query direta)
- Contara usos do mes na `ai_usage_log`
- Rejeitara se exceder o limite
- Registrara o uso apos sucesso

### 6. Criar hook `usePlanLimits` para travas no frontend

Um hook centralizado que expoe:
- `canUseAI`: boolean
- `aiUsed` / `aiLimit`: contadores
- `canCreateRoom`: boolean (baseado em salas ativas no mes)
- `canViewDetailedReports`: boolean
- `canExportCSV`: boolean
- `showUpgradeDialog()`: funcao para exibir modal de upgrade

### 7. Criar componente `UpgradeDialog`

Modal que aparece quando o usuario tenta acessar uma funcionalidade bloqueada. Mostra os planos com destaque no que desbloqueia a feature tentada.

### 8. Aplicar travas no TeacherDashboard

- **Criar com IA**: verificar `canUseAI`, mostrar contador "X/50 usados este mes" nos botoes de IA, bloquear e mostrar UpgradeDialog se exceder
- **Criar Sala**: verificar limite de salas (3/mes no gratuito), bloquear se exceder
- **Analytics**: verificar `canViewDetailedReports`, mostrar UpgradeDialog no plano gratuito
- **Exportar CSV/PDF**: verificar plano pro+, bloquear no gratuito

### 9. Corrigir `renderMyPlan` para usar dados reais

Usar `subscription.plan`, `subscription.subscriptionEnd` e os dados de `STRIPE_PLANS` para mostrar o plano real, valor, validade, etc.

### 10. Painel Admin - Usuarios pagantes e escolha de plano

- **Nova view `admin-subscribers`**: Lista todos os usuarios com seus planos (query de profiles + subscription via Stripe ou cache local)
- **Ao aprovar professor**: Permitir ao admin selecionar o acesso (Gratuito/Pro/Institucional). Se Pro ou Institucional, o admin podera conceder acesso manualmente (sem pagamento Stripe) via uma tabela `manual_subscriptions`
- **Visualizacao**: Nome, email, plano, data de inscricao, ultimo acesso, uso de IA do mes

### 11. Tabela `manual_subscriptions` (Migration)

Para o admin poder conceder planos manualmente a convidados:

```sql
CREATE TABLE public.manual_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.manual_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage manual subscriptions"
  ON public.manual_subscriptions FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Users view own subscription"
  ON public.manual_subscriptions FOR SELECT
  USING (user_id = auth.uid());
```

### 12. Atualizar `check-subscription` para verificar tambem `manual_subscriptions`

A edge function verificara primeiro o Stripe; se nao encontrar subscription ativa, verificara `manual_subscriptions` para planos concedidos pelo admin.

---

## Resumo dos Arquivos a Criar/Editar

**Novos arquivos:**
- `src/hooks/usePlanLimits.ts` - Hook de travas por plano
- `src/components/UpgradeDialog.tsx` - Modal de upgrade

**Migrations (2):**
- Tabela `ai_usage_log`
- Tabela `manual_subscriptions`

**Arquivos a editar:**
- `src/lib/stripe-plans.ts` - Adicionar `ai_questions_per_month`
- `src/hooks/useAuth.tsx` - Expor `aiUsedThisMonth` no contexto
- `supabase/functions/check-subscription/index.ts` - Retornar uso de IA + checar manual_subscriptions
- `supabase/functions/generate-quiz-ai/index.ts` - Validar limites e registrar uso
- `src/pages/TeacherDashboard.tsx` - Aplicar travas, corrigir Meu Plano, admin subscribers
- `src/components/AnalyticsDashboard.tsx` - Adicionar trava de exportacao

---

## Mapeamento de Features por Plano

| Feature | Gratuito | Pro | Institucional |
|---|---|---|---|
| Professores | 1 | 1 | Multiplos |
| Alunos | Ate 30 | Ilimitados | Ilimitados |
| Salas ativas/mes | 3 | Ilimitadas | Ilimitadas |
| iRAT + tRAT + Aplicacao | Sim | Sim | Sim |
| Relatorio basico | Sim | Sim | Sim |
| Questionarios com IA | Nao | 50/mes | Ilimitado |
| Relatorios detalhados | Nao | Sim | Sim |
| Exportar CSV/PDF | Nao | Sim | Sim |
| Painel administrativo | Nao | Nao | Sim |
| White-label | Nao | Nao | Sim |
| Integracao LMS | Nao | Nao | Sim |
