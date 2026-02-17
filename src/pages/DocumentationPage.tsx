import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { motion } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Users, Brain, Target, BarChart3, Shield, Zap,
  GraduationCap, Sparkles, Clock, Star, Award, Layers, Monitor,
  Globe, Eye, Wifi, WifiOff, MessageSquare, FileText, Settings
} from 'lucide-react';
import AccessibilityMenu from '@/components/AccessibilityMenu';

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
    </div>
  );
}
