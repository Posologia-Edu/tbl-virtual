

## Plano: Sistema de Consentimento de Cookies + Coleta Estratégica

### Contexto Atual
- Já existe uma página de Política de Cookies (`/cookies`) com informações estáticas
- Não existe banner de consentimento nem coleta real de cookies
- O sistema usa localStorage para auth (Supabase), tema, idioma e cache offline

---

### O Que Será Implementado

#### 1. Banner de Consentimento de Cookies
Um componente `CookieConsent` que aparece na parte inferior da tela para todos os visitantes que ainda não deram consentimento. Terá:
- Texto resumido explicando o uso de cookies
- Link para a página `/cookies`
- Botões: **Aceitar Todos**, **Apenas Essenciais**, **Personalizar**
- Modal de personalização com toggles por categoria (Essenciais, Funcionalidade, Analíticos)
- Cookies essenciais ficam sempre ativados (sem toggle)
- A escolha é salva em `localStorage` com chave `cookie_consent`

#### 2. Categorias de Cookies

| Categoria | Tipo | Desativável? | O que coleta |
|-----------|------|-------------|-------------|
| **Essenciais** | Auth, sessão Supabase | Não | Login, sessão |
| **Funcionalidade** | Tema, idioma, acessibilidade, cache offline | Sim | Preferências do usuário |
| **Analíticos** | Navegação, uso de features | Sim | Páginas visitadas, features usadas, tempo de sessão |

#### 3. Coleta de Cookies Analíticos (novo)
Se o usuário aceitar cookies analíticos, o sistema passará a rastrear eventos úteis para você como dono do produto:

- **Páginas visitadas**: qual página o visitante acessou e por quanto tempo
- **Features mais clicadas**: quais seções da landing page e features page geram mais interesse
- **Funil de conversão**: visitante → página de planos → clique em "Começar" → criação de conta
- **Dispositivo e idioma**: para entender seu público

Esses dados serão salvos em uma tabela `analytics_events` no Supabase com colunas: `id`, `session_id`, `event_type`, `event_data` (jsonb), `page_url`, `referrer`, `device_type`, `language`, `created_at`, `user_id` (nullable).

#### 4. Hook `useCookieConsent`
Um hook React que:
- Lê o consentimento salvo no localStorage
- Expõe `hasConsent(category)` para checar se uma categoria foi aceita
- Expõe `updateConsent(preferences)` para atualizar escolhas
- Usado por outros hooks/componentes para decidir se devem coletar dados

#### 5. Hook `useAnalytics`
Ativado apenas quando `hasConsent('analytics')` retorna true:
- Registra `page_view` a cada navegação
- Expõe `trackEvent(type, data)` para rastrear cliques em CTAs, abertura de modais, etc.
- Envia dados para a tabela `analytics_events` via Supabase (usando service role em edge function ou insert direto com RLS)

#### 6. Dashboard de Analytics (Admin)
Expandir o `AnalyticsDashboard` existente para incluir:
- Visitantes únicos por dia/semana
- Páginas mais visitadas
- Funil de conversão (visita → signup)
- Dispositivos e idiomas mais comuns

#### 7. Atualizar Página de Cookies
Atualizar a página `/cookies` para refletir os novos cookies analíticos e mencionar que o usuário pode alterar suas preferências a qualquer momento (com botão para reabrir o banner).

---

### Como Usar os Dados a Seu Favor

1. **Otimização de conversão**: saber quais páginas levam mais pessoas a criar conta
2. **Priorização de features**: ver quais funcionalidades geram mais interesse na FeaturesPage
3. **Decisões de pricing**: entender em qual plano os visitantes mais clicam
4. **Segmentação**: idioma e dispositivo ajudam a decidir onde investir (mobile vs desktop, PT vs EN vs ES)
5. **Retenção**: comparar visitantes recorrentes vs novos

---

### Arquivos a Criar/Editar

- **Criar**: `src/components/CookieConsent.tsx` — banner + modal de personalização
- **Criar**: `src/hooks/useCookieConsent.ts` — gerenciamento de consentimento
- **Criar**: `src/hooks/useAnalytics.ts` — coleta de eventos condicionada ao consentimento
- **Criar**: migração SQL para tabela `analytics_events`
- **Editar**: `src/App.tsx` — adicionar `<CookieConsent />` no layout raiz
- **Editar**: `src/pages/CookiesPage.tsx` — atualizar com novas categorias e botão "Alterar preferências"
- **Editar**: `src/pages/LandingPage.tsx`, `FeaturesPage.tsx`, `PricingPage.tsx` — adicionar tracking de eventos em CTAs
- **Editar**: `src/components/AnalyticsDashboard.tsx` — incluir dados de visitantes/conversão

