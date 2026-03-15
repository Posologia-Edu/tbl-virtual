import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { motion } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Users, Brain, Target, BarChart3, Shield, Zap,
  GraduationCap, Sparkles, Clock, Star, Award, Layers, Monitor,
  Globe, Eye, Wifi, WifiOff, MessageSquare, FileText, Settings,
  Database, Server, Code2, Lock, Workflow, Cpu, HardDrive, Key, CloudCog
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AccessibilityMenu from '@/components/AccessibilityMenu';
import Footer from '@/components/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

export default function DocumentationPage() {
  const navigate = useNavigate();

  const sections = [
    {
      id: 'getting-started',
      icon: Sparkles,
      title: 'Primeiros Passos',
      items: [
        {
          q: 'Como criar uma conta de professor?',
          a: 'Acesse a página inicial e clique em "Começar Grátis" ou "Criar Conta". Preencha seus dados (nome, e-mail, CPF, instituição) e aguarde a aprovação do administrador. Você receberá um e-mail quando sua conta for aprovada.',
        },
        {
          q: 'Como um aluno entra na sala?',
          a: 'O aluno não precisa criar conta. Basta acessar a opção "Sou Estudante" na página inicial, informar seu nome e o código de 6 caracteres da sala fornecido pelo professor. O acesso é imediato pelo celular ou computador.',
        },
        {
          q: 'Como navegar no painel do professor?',
          a: 'Após login, você verá o painel com abas: Salas (criar/gerenciar sessões TBL), Questionários (banco de questões), Turmas (gerenciar alunos), Relatórios (análises de desempenho) e Conquistas (gamificação).',
        },
      ],
    },
    {
      id: 'quizzes',
      icon: Brain,
      title: 'Questionários e IA',
      items: [
        {
          q: 'Como criar um questionário manualmente?',
          a: 'Na aba "Questionários", clique em "Novo Questionário". Defina título, disciplina e nível de dificuldade. Depois adicione questões com 4 alternativas (A, B, C, D) e marque a resposta correta.',
        },
        {
          q: 'Como gerar questões com IA?',
          a: 'Ao criar um questionário, clique em "Gerar com IA". Faça upload de um arquivo PDF, Word ou PowerPoint com o conteúdo da aula. A IA analisará o material e gerará questões de múltipla escolha automaticamente. Você pode editar, remover ou adicionar questões após a geração.',
        },
        {
          q: 'Posso compartilhar questionários?',
          a: 'Sim! Marque o questionário como "Compartilhado" e outros professores da plataforma poderão utilizá-lo em suas salas.',
        },
      ],
    },
    {
      id: 'rooms',
      icon: Monitor,
      title: 'Salas e Sessões TBL',
      items: [
        {
          q: 'Como criar uma sala?',
          a: 'Na aba "Salas", clique em "Nova Sala". Dê um nome, selecione um questionário, vincule uma turma (opcional) e configure os pesos das notas (iRAT, tRAT, Aplicação). Um código de 6 caracteres será gerado automaticamente para compartilhar com os alunos.',
        },
        {
          q: 'Como configurar os pesos das notas?',
          a: 'Ao criar a sala, defina a porcentagem de cada fase: iRAT (individual), tRAT (equipe) e Aplicação. A nota máxima também é configurável. Os pesos devem somar 100%.',
        },
        {
          q: 'Como gerenciar equipes?',
          a: 'Na sala, acesse a aba "Equipes". Você pode criar equipes manualmente, definir nomes e arrastar os alunos participantes para cada equipe. As equipes são usadas nas fases tRAT e Aplicação.',
        },
        {
          q: 'Como avançar as fases da sala?',
          a: 'O professor controla o fluxo: Sala de Espera → iRAT (individual) → tRAT (equipe) → Aplicação → Finalizado. Use os botões de controle na tela de gerenciamento da sala para avançar entre as fases.',
        },
      ],
    },
    {
      id: 'irat',
      icon: BookOpen,
      title: 'Fase 1: iRAT (Individual)',
      items: [
        {
          q: 'Como funciona o iRAT?',
          a: 'No iRAT (Individual Readiness Assurance Test), cada aluno responde individualmente às questões. O diferencial é o sistema de apostas de confiança: o aluno distribui 4 pontos entre as alternativas, apostando mais naquelas que acredita serem corretas.',
        },
        {
          q: 'Como funciona o sistema de apostas?',
          a: 'Para cada questão, o aluno tem 4 pontos para distribuir entre as alternativas A, B, C e D. Se apostar 4 pontos na alternativa correta, ganha 4 pontos. Se apostar 2 na correta e 2 na errada, ganha 2. Isso incentiva o aluno a refletir sobre seu nível de certeza.',
        },
        {
          q: 'O professor pode definir tempo limite?',
          a: 'Sim! O professor pode ativar um temporizador para o iRAT. Todos os alunos veem o cronômetro em tempo real. Quando o tempo acaba, as respostas são enviadas automaticamente.',
        },
      ],
    },
    {
      id: 'trat',
      icon: Users,
      title: 'Fase 2: tRAT (Equipe)',
      items: [
        {
          q: 'Como funciona o tRAT?',
          a: 'No tRAT (Team Readiness Assurance Test), os membros da equipe discutem e escolhem juntos a resposta. Usam a raspadinha digital (IF-AT): ao "raspar" uma alternativa, recebem feedback imediato se está correta ou não.',
        },
        {
          q: 'Quantas tentativas a equipe tem?',
          a: 'A equipe tem até 4 tentativas por questão. A pontuação é decrescente: 4 pontos na 1ª tentativa, 2 na 2ª, 1 na 3ª e 0 na 4ª. Isso incentiva a discussão antes de cada tentativa.',
        },
        {
          q: 'O que são as animações do tRAT?',
          a: 'Ao acertar uma questão, uma animação de comemoração (confete e estrelas) aparece na tela. Ao errar, uma animação de shake indica que devem tentar novamente. Isso torna a experiência mais engajante.',
        },
      ],
    },
    {
      id: 'application',
      icon: Target,
      title: 'Fase 3: Aplicação',
      items: [
        {
          q: 'Como funciona a fase de Aplicação?',
          a: 'O professor cria questões de aplicação com cenários complexos (casos clínicos, problemas reais). As equipes analisam e respondem juntas. O gabarito é definido pelo professor.',
        },
        {
          q: 'Como criar questões de aplicação?',
          a: 'Na tela de gerenciamento da sala, acesse a aba "Aplicação". Adicione questões com enunciado e alternativas. Estas questões são independentes do questionário principal e focam em cenários práticos.',
        },
      ],
    },
    {
      id: 'reports',
      icon: BarChart3,
      title: 'Relatórios e Análises',
      items: [
        {
          q: 'Quais relatórios estão disponíveis?',
          a: 'O sistema gera dois tipos: Relatório Final (notas ponderadas de cada aluno/equipe) e Relatório Gerencial (gráficos de desempenho, distribuição de conceitos, análise de dificuldade por questão).',
        },
        {
          q: 'Posso exportar os relatórios?',
          a: 'Sim! Os relatórios podem ser enviados por e-mail em formato detalhado. O professor pode configurar se as respostas corretas aparecem no relatório do aluno.',
        },
        {
          q: 'O que é a análise de dificuldade?',
          a: 'O sistema calcula automaticamente o índice de dificuldade de cada questão com base no desempenho dos alunos. Questões com muitos erros são classificadas como "difíceis" e vice-versa.',
        },
      ],
    },
    {
      id: 'classes',
      icon: GraduationCap,
      title: 'Turmas e Alunos',
      items: [
        {
          q: 'Como criar uma turma?',
          a: 'Na aba "Turmas", clique em "Nova Turma". Defina nome, semestre e descrição. Depois adicione alunos à turma pelo e-mail ou código de participante.',
        },
        {
          q: 'Para que servem as turmas?',
          a: 'As turmas organizam os alunos por disciplina/semestre. Ao criar uma sala TBL, você pode vincular uma turma para controlar quem pode participar e gerar relatórios agrupados.',
        },
      ],
    },
    {
      id: 'gamification',
      icon: Award,
      title: 'Gamificação e Conquistas',
      items: [
        {
          q: 'O que são conquistas?',
          a: 'Conquistas são badges que os alunos ganham por desempenho: "iRAT Perfeito" (100% no individual), "Equipe Perfeita" (tRAT sem erros), "Primeira Atividade" (participar da 1ª sessão), entre outros.',
        },
        {
          q: 'Como funciona o ranking de equipes?',
          a: 'Durante o tRAT, um leaderboard em tempo real mostra a posição de cada equipe. O ranking se atualiza com animações conforme as equipes acertam questões, incentivando a competição saudável.',
        },
        {
          q: 'Onde o aluno vê suas conquistas?',
          a: 'No painel do aluno, a aba "Conquistas" mostra todas as badges ganhas, pontos acumulados, total de atividades e um histórico detalhado.',
        },
      ],
    },
    {
      id: 'appeals',
      icon: MessageSquare,
      title: 'Recursos (Appeals)',
      items: [
        {
          q: 'O que são recursos?',
          a: 'Após o tRAT, as equipes podem enviar recursos contestando questões que consideram ambíguas ou incorretas. O professor analisa e aceita ou rejeita o recurso com uma justificativa.',
        },
        {
          q: 'Como enviar um recurso?',
          a: 'Na tela da sala, após o tRAT, os alunos veem a opção "Enviar Recurso" em cada questão. Devem justificar por que acreditam que a questão ou gabarito está incorreto.',
        },
      ],
    },
    {
      id: 'accessibility',
      icon: Eye,
      title: 'Acessibilidade e Idiomas',
      items: [
        {
          q: 'Quais idiomas são suportados?',
          a: 'O sistema suporta Português (BR), Inglês e Espanhol. Troque o idioma no menu de acessibilidade (ícone ⚙️) disponível em todas as páginas.',
        },
        {
          q: 'Como ativar o modo alto contraste?',
          a: 'No menu de acessibilidade, ative "Alto Contraste". As cores serão ajustadas para melhor legibilidade, com fundo escuro e textos claros de alto contraste.',
        },
        {
          q: 'Como ajustar o tamanho da fonte?',
          a: 'No menu de acessibilidade, escolha entre 4 níveis: Pequeno, Normal, Grande ou Extra Grande. A mudança é aplicada em toda a interface imediatamente.',
        },
        {
          q: 'O sistema é compatível com leitores de tela?',
          a: 'Sim! Todos os elementos possuem labels ARIA, roles semânticos e suporte a navegação por teclado. O link "Pular para conteúdo" facilita a navegação.',
        },
      ],
    },
    {
      id: 'offline',
      icon: WifiOff,
      title: 'Modo Offline e Resiliência',
      items: [
        {
          q: 'O que acontece se eu perder a conexão?',
          a: 'Um banner de aviso aparece no topo da tela indicando "Sem conexão". Suas respostas são salvas automaticamente no armazenamento local do navegador.',
        },
        {
          q: 'Minhas respostas são perdidas offline?',
          a: 'Não! O sistema mantém um cache local de todas as respostas pendentes. Quando a conexão for restabelecida, a sincronização é automática. Você verá um indicador "Sincronizando..." durante o processo.',
        },
        {
          q: 'Preciso fazer algo quando a internet voltar?',
          a: 'Não. O sistema detecta automaticamente quando a conexão retorna e sincroniza todas as respostas pendentes em segundo plano. A cada 30 segundos, ele também tenta sincronizar para garantir que nada seja perdido.',
        },
      ],
    },
  ];

  const techSections = [
    {
      id: 'tech-stack',
      icon: Code2,
      title: 'Stack Tecnológico',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Todas as tecnologias que compõem o TBL Virtual:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { category: 'Frontend', items: ['React 18 (SPA)', 'TypeScript', 'Vite (bundler)', 'Tailwind CSS', 'Shadcn/UI (componentes)', 'Framer Motion (animações)', 'React Router DOM (rotas)', 'i18next (internacionalização)', 'Recharts (gráficos)'] },
              { category: 'Backend (BaaS)', items: ['Supabase (PostgreSQL 15)', 'Supabase Auth (autenticação)', 'Supabase Realtime (WebSockets)', 'Supabase Edge Functions (Deno)', 'Row-Level Security (RLS)'] },
              { category: 'Serviços Externos', items: ['Stripe (pagamentos e assinaturas)', 'Resend (e-mails transacionais)', 'OpenAI / Google AI (geração de questões)'] },
              { category: 'Infraestrutura', items: ['Lovable (hospedagem e CI/CD)', 'Supabase Cloud (banco e auth)', 'CDN global (assets estáticos)', 'HTTPS / TLS em todas as rotas'] },
            ].map(group => (
              <Card key={group.category} className="border-border/50">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold">{group.category}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ul className="space-y-1">
                    {group.items.map(item => (
                      <li key={item} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="text-primary mt-0.5">•</span> {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'tech-architecture',
      icon: Workflow,
      title: 'Arquitetura do Sistema',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">O TBL Virtual é uma Single Page Application (SPA) que se comunica diretamente com o Supabase como Backend-as-a-Service.</p>
          <div className="bg-muted/50 rounded-xl p-4 text-xs font-mono space-y-2 overflow-x-auto">
            <pre className="text-foreground">{`┌─────────────────────────────────────────────────┐
│                   CLIENTE (Browser)              │
│  React + TypeScript + Tailwind + Shadcn/UI       │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐   │
│  │ Pages    │ │Components│ │ Hooks          │   │
│  │ (rotas)  │ │ (UI)     │ │ (lógica/state) │   │
│  └──────────┘ └──────────┘ └────────────────┘   │
└────────────────────┬────────────────────────────┘
                     │ HTTPS / WSS
┌────────────────────▼────────────────────────────┐
│              SUPABASE CLOUD                      │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐   │
│  │ Auth     │ │ Realtime │ │ Edge Functions │   │
│  │ (JWT)    │ │ (WS)     │ │ (Deno)         │   │
│  └──────────┘ └──────────┘ └────────────────┘   │
│  ┌──────────────────────────────────────────┐    │
│  │         PostgreSQL 15 + RLS              │    │
│  │  18 tabelas · 6 funções · Enums · JSONB  │    │
│  └──────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    ▼                ▼                ▼
┌────────┐    ┌──────────┐    ┌──────────┐
│ Stripe │    │  Resend  │    │ AI APIs  │
│(pagam.)│    │ (e-mail) │    │(OpenAI/  │
│        │    │          │    │ Google)  │
└────────┘    └──────────┘    └──────────┘`}</pre>
          </div>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="auth-flow">
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">Como funciona a autenticação?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                O Supabase Auth gerencia todo o ciclo de autenticação via JWT. Ao criar conta, um trigger <code className="bg-muted px-1 rounded text-xs">handle_new_user()</code> cria automaticamente o perfil do usuário na tabela <code className="bg-muted px-1 rounded text-xs">profiles</code> e atribui o role na tabela <code className="bg-muted px-1 rounded text-xs">user_roles</code>. Roles disponíveis: <Badge variant="outline" className="text-xs mx-0.5">teacher</Badge> <Badge variant="outline" className="text-xs mx-0.5">student</Badge> <Badge variant="outline" className="text-xs mx-0.5">admin</Badge>. Professores precisam de aprovação do admin (<code className="bg-muted px-1 rounded text-xs">is_approved</code>) antes de acessar o sistema.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="realtime-flow">
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">Como funciona o tempo real?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                O Supabase Realtime é usado via WebSockets para sincronizar fases da sala (waiting → irat_open → trat_open → application_open → finished), respostas de alunos e leaderboard de equipes. Um mecanismo de polling redundante (5s no gerenciamento, 2s na fase de aplicação) garante resiliência em caso de falha do WebSocket.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="rls-flow">
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">Como funciona a segurança (RLS)?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                Todas as tabelas possuem Row-Level Security (RLS) ativo. Cada linha só pode ser acessada por quem tem permissão: professores veem apenas suas salas/quizzes, alunos acessam apenas salas onde participam. Funções <code className="bg-muted px-1 rounded text-xs">SECURITY DEFINER</code> como <code className="bg-muted px-1 rounded text-xs">has_role()</code>, <code className="bg-muted px-1 rounded text-xs">is_admin()</code>, <code className="bg-muted px-1 rounded text-xs">is_room_participant()</code> e <code className="bg-muted px-1 rounded text-xs">is_team_member()</code> evitam recursão e garantem verificações seguras.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ),
    },
    {
      id: 'tech-database',
      icon: Database,
      title: 'Estrutura do Banco de Dados',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">O banco PostgreSQL possui 18 tabelas organizadas em domínios funcionais:</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Domínio</TableHead>
                  <TableHead className="text-xs">Tabela</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { domain: 'Usuários', table: 'profiles', desc: 'Dados do perfil (nome, CPF, instituição, endereço)' },
                  { domain: 'Usuários', table: 'user_roles', desc: 'Roles: teacher, student, admin (enum app_role)' },
                  { domain: 'Conteúdo', table: 'quizzes', desc: 'Questionários com disciplina, tema e nível de dificuldade' },
                  { domain: 'Conteúdo', table: 'questions', desc: 'Questões com 4 alternativas e gabarito (soft delete)' },
                  { domain: 'Salas', table: 'rooms', desc: 'Sessões TBL com código, fases, pesos e temporizadores' },
                  { domain: 'Salas', table: 'room_participants', desc: 'Alunos conectados em uma sala (código de participante)' },
                  { domain: 'Equipes', table: 'teams', desc: 'Equipes por sala' },
                  { domain: 'Equipes', table: 'team_members', desc: 'Membros de cada equipe' },
                  { domain: 'Respostas', table: 'irat_responses', desc: 'Respostas individuais com sistema de apostas (4 pontos)' },
                  { domain: 'Respostas', table: 'trat_attempts', desc: 'Tentativas da equipe no tRAT (raspadinha digital)' },
                  { domain: 'Aplicação', table: 'application_questions', desc: 'Questões de aplicação (cenários complexos)' },
                  { domain: 'Aplicação', table: 'application_responses', desc: 'Respostas das equipes na fase de aplicação' },
                  { domain: 'Recursos', table: 'appeals', desc: 'Contestações de questões pelas equipes' },
                  { domain: 'Turmas', table: 'classes', desc: 'Turmas por semestre' },
                  { domain: 'Turmas', table: 'class_students', desc: 'Vínculo aluno-turma' },
                  { domain: 'Gamificação', table: 'student_achievements', desc: 'Conquistas/badges dos alunos' },
                  { domain: 'Assinaturas', table: 'manual_subscriptions', desc: 'Planos atribuídos manualmente (free/pro/institutional)' },
                  { domain: 'Analytics', table: 'analytics_events', desc: 'Eventos de navegação e uso (cookies analíticos)' },
                  { domain: 'IA', table: 'ai_api_keys', desc: 'Chaves de API para provedores de IA' },
                  { domain: 'IA', table: 'ai_usage_log', desc: 'Log de uso de tokens e custo estimado' },
                ].map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{row.domain}</TableCell>
                    <TableCell className="text-xs"><code className="bg-muted px-1.5 py-0.5 rounded">{row.table}</code></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Enums do Banco</h4>
            <div className="flex flex-wrap gap-2">
              <div className="text-xs bg-muted/50 rounded-lg p-2">
                <span className="font-medium">app_role:</span>{' '}
                <Badge variant="secondary" className="text-xs">teacher</Badge>{' '}
                <Badge variant="secondary" className="text-xs">student</Badge>{' '}
                <Badge variant="secondary" className="text-xs">admin</Badge>
              </div>
              <div className="text-xs bg-muted/50 rounded-lg p-2">
                <span className="font-medium">room_stage:</span>{' '}
                <Badge variant="secondary" className="text-xs">waiting</Badge>{' '}
                <Badge variant="secondary" className="text-xs">irat_open</Badge>{' '}
                <Badge variant="secondary" className="text-xs">trat_open</Badge>{' '}
                <Badge variant="secondary" className="text-xs">application_open</Badge>{' '}
                <Badge variant="secondary" className="text-xs">finished</Badge>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Funções do Banco (SECURITY DEFINER)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { fn: 'has_role(user_id, role)', desc: 'Verifica se o usuário tem um role específico' },
                { fn: 'is_admin(user_id)', desc: 'Verifica se o usuário é admin' },
                { fn: 'is_room_participant(room_id, user_id)', desc: 'Verifica se o usuário participa de uma sala' },
                { fn: 'is_team_member(team_id, user_id)', desc: 'Verifica se o usuário pertence a uma equipe' },
                { fn: 'generate_room_code()', desc: 'Gera código numérico único de 11 dígitos para salas' },
                { fn: 'generate_participant_code(room_id)', desc: 'Gera código de 4 dígitos para participantes' },
              ].map(f => (
                <div key={f.fn} className="text-xs bg-muted/50 rounded-lg p-2">
                  <code className="font-medium text-primary">{f.fn}</code>
                  <p className="text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'tech-edge-functions',
      icon: Server,
      title: 'Edge Functions (API)',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">As Edge Functions rodam em Deno no Supabase e servem como API serverless para operações que exigem secrets ou lógica de servidor:</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Função</TableHead>
                  <TableHead className="text-xs">Propósito</TableHead>
                  <TableHead className="text-xs">Serviço</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { fn: 'generate-quiz-ai', desc: 'Gera questões a partir de PDF/DOCX usando IA', service: 'OpenAI / Google AI' },
                  { fn: 'create-checkout', desc: 'Cria sessão de checkout para assinatura', service: 'Stripe' },
                  { fn: 'check-subscription', desc: 'Verifica status de assinatura do usuário', service: 'Stripe' },
                  { fn: 'customer-portal', desc: 'Abre portal de gerenciamento do cliente', service: 'Stripe' },
                  { fn: 'send-report-email', desc: 'Envia relatórios por e-mail', service: 'Resend' },
                  { fn: 'send-approval-email', desc: 'Notifica aprovação de conta de professor', service: 'Resend' },
                  { fn: 'send-invite-teacher', desc: 'Envia convite para professor de instituição', service: 'Resend' },
                  { fn: 'send-contact-email', desc: 'Processa formulário de contato', service: 'Resend' },
                  { fn: 'delete-user', desc: 'Remove usuário e dados associados', service: 'Supabase Admin' },
                  { fn: 'hub-metrics', desc: 'Coleta métricas do hub institucional', service: 'Interno' },
                  { fn: 'sync-institution-teachers', desc: 'Sincroniza professores de uma instituição', service: 'Interno' },
                  { fn: 'list-trial-teachers', desc: 'Lista professores em período de teste', service: 'Interno' },
                ].map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs"><code className="bg-muted px-1.5 py-0.5 rounded">{row.fn}</code></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.desc}</TableCell>
                    <TableCell className="text-xs"><Badge variant="outline">{row.service}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ),
    },
    {
      id: 'tech-security',
      icon: Lock,
      title: 'Segurança e Permissões',
      content: (
        <div className="space-y-4">
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="rls">
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">Row-Level Security (RLS)</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
                <p>Todas as 18 tabelas possuem RLS ativo. As políticas garantem:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Professores: acessam apenas suas próprias salas, quizzes e turmas</li>
                  <li>Alunos: acessam apenas salas e equipes onde participam</li>
                  <li>Admin: acesso total via função <code className="bg-muted px-1 rounded">is_admin()</code></li>
                  <li>Inserções anônimas: apenas na tabela <code className="bg-muted px-1 rounded">analytics_events</code></li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="auth-security">
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">Autenticação e Tokens</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>JWT emitido pelo Supabase Auth com expiração configurável</li>
                  <li>Roles armazenados em tabela separada (não no JWT) para evitar escalação de privilégios</li>
                  <li>Aprovação manual de professores pelo admin antes do primeiro acesso</li>
                  <li>Sistema de bloqueio (<code className="bg-muted px-1 rounded">is_blocked</code>) para desativar contas</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="secrets">
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">Secrets e Chaves de API</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
                <p>Chaves sensíveis são armazenadas como Supabase Secrets (nunca no código-fonte):</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['STRIPE_SECRET_KEY', 'RESEND_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'HUB_SERVICE_KEY', 'HUB_METRICS_KEY'].map(s => (
                    <Badge key={s} variant="outline" className="text-xs font-mono">{s}</Badge>
                  ))}
                </div>
                <p className="mt-2">Apenas a <code className="bg-muted px-1 rounded">SUPABASE_ANON_KEY</code> (publishable) é exposta no frontend.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ),
    },
    {
      id: 'tech-features',
      icon: Cpu,
      title: 'Funcionalidades Técnicas',
      content: (
        <div className="space-y-4">
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="offline">
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">Modo Offline e Sincronização</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                O hook <code className="bg-muted px-1 rounded">useOfflineSync</code> salva respostas no <code className="bg-muted px-1 rounded">localStorage</code> quando offline e sincroniza automaticamente a cada 30 segundos ou quando a conexão retorna (evento <code className="bg-muted px-1 rounded">online</code>). Um indicador visual mostra o status de conexão.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="i18n">
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">Internacionalização (i18n)</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                Usa <code className="bg-muted px-1 rounded">i18next</code> com 3 locales: <Badge variant="secondary" className="text-xs">pt-BR</Badge> <Badge variant="secondary" className="text-xs">en</Badge> <Badge variant="secondary" className="text-xs">es</Badge>. Os arquivos de tradução ficam em <code className="bg-muted px-1 rounded">src/i18n/locales/</code>. A detecção de idioma é automática pelo navegador.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="accessibility-tech">
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">Acessibilidade (a11y)</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                O hook <code className="bg-muted px-1 rounded">useAccessibility</code> persiste preferências (alto contraste, tamanho de fonte) em <code className="bg-muted px-1 rounded">localStorage</code>. Componentes usam ARIA labels, roles semânticos e suporte a navegação por teclado. Skip links disponíveis em todas as páginas.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="analytics-tech">
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">Analytics e Cookies</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                O consentimento de cookies é gerenciado por <code className="bg-muted px-1 rounded">useCookieConsent</code> com 3 categorias (essenciais, funcionalidade, analíticos). O hook <code className="bg-muted px-1 rounded">useAnalytics</code> só coleta dados quando o usuário aceita cookies analíticos, registrando page views, cliques em CTAs e funil de conversão na tabela <code className="bg-muted px-1 rounded">analytics_events</code>.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="payments">
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">Pagamentos e Planos</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                Integração com Stripe via Edge Functions. Planos: <Badge variant="secondary" className="text-xs">Free</Badge> <Badge variant="secondary" className="text-xs">Pro</Badge> <Badge variant="secondary" className="text-xs">Institutional</Badge>. O checkout é criado server-side (<code className="bg-muted px-1 rounded">create-checkout</code>), a verificação de status é feita por <code className="bg-muted px-1 rounded">check-subscription</code>. Admins podem atribuir planos manualmente via tabela <code className="bg-muted px-1 rounded">manual_subscriptions</code>.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ai-generation">
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">Geração de Questões com IA</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                A Edge Function <code className="bg-muted px-1 rounded">generate-quiz-ai</code> recebe arquivos (PDF, DOCX, PPTX), extrai o texto e usa modelos de IA (OpenAI GPT ou Google Gemini) para gerar questões de múltipla escolha. O uso de tokens é registrado na tabela <code className="bg-muted px-1 rounded">ai_usage_log</code> com custo estimado.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ),
    },
    {
      id: 'tech-project-structure',
      icon: HardDrive,
      title: 'Estrutura de Pastas',
      content: (
        <div className="bg-muted/50 rounded-xl p-4 text-xs font-mono space-y-0.5 overflow-x-auto">
          <pre className="text-foreground">{`src/
├── assets/              # Imagens e assets estáticos
├── components/          # Componentes reutilizáveis
│   └── ui/              # Shadcn/UI (accordion, button, card, etc.)
├── hooks/               # Custom hooks (useAuth, useAnalytics, etc.)
├── i18n/                # Internacionalização
│   └── locales/         # Arquivos JSON (pt-BR, en, es)
├── integrations/
│   └── supabase/        # Cliente Supabase + types gerados
├── lib/                 # Utilitários (stripe-plans, utils)
├── pages/               # Páginas/rotas da aplicação
├── test/                # Configuração de testes
├── App.tsx              # Roteamento principal
├── main.tsx             # Entry point
└── index.css            # Design tokens (CSS variables)

supabase/
├── functions/           # Edge Functions (Deno)
│   ├── generate-quiz-ai/
│   ├── create-checkout/
│   ├── check-subscription/
│   └── ...
├── migrations/          # Migrações SQL
└── config.toml          # Configuração do projeto`}</pre>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-2xl border-b border-border/40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl" aria-label="Voltar à página inicial">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-heading font-bold">Documentação</h1>
            </div>
          </div>
          <AccessibilityMenu />
        </div>
      </header>

      <main id="main-content" className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Intro */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={0}
          className="mb-10 text-center"
        >
          <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-3">
            Guia Completo do <span className="text-primary">TBL Virtual</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Tudo o que você precisa saber para usar todas as funcionalidades da plataforma. Clique em cada seção para expandir as perguntas.
          </p>
        </motion.div>

        {/* Quick Nav */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="mb-10">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" /> Navegação Rápida
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {sections.map(s => (
                  <Button
                    key={s.id}
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs"
                    onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  >
                    <s.icon className="w-3.5 h-3.5 mr-1.5" />
                    {s.title}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section, sIdx) => (
            <motion.div
              key={section.id}
              id={section.id}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              variants={fadeUp}
              custom={sIdx * 0.3}
              className="scroll-mt-24"
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <section.icon className="w-5 h-5 text-primary" />
                    </div>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="w-full">
                    {section.items.map((item, iIdx) => (
                      <AccordionItem key={iIdx} value={`${section.id}-${iIdx}`}>
                        <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                          {item.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                          {item.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mt-12 text-center space-y-4"
        >
          <p className="text-muted-foreground">Não encontrou o que procurava?</p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" className="rounded-xl" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Início
            </Button>
            <Button className="rounded-xl" onClick={() => navigate('/auth?mode=signup')}>
              <Sparkles className="w-4 h-4 mr-2" /> Começar Agora
            </Button>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
