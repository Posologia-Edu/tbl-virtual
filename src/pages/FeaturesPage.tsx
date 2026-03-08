import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Brain, Users, Target, BarChart3, Zap, Shield, Clock, Star, Award,
  BookOpen, MessageSquare, Eye, WifiOff, GraduationCap, ArrowRight, Sparkles,
  FileText, Layers, Monitor, TrendingUp
} from 'lucide-react';
import AuthDialog from '@/components/AuthDialog';
import AccessibilityMenu from '@/components/AccessibilityMenu';
import Footer from '@/components/Footer';
import { useAnalytics } from '@/hooks/useAnalytics';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

export default function FeaturesPage() {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');

  const openAuth = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setAuthOpen(true);
    trackEvent('cta_click', { button: mode === 'signup' ? 'signup' : 'signin', page: 'features' });
  };

  const mainFeatures = [
    {
      icon: Brain,
      title: 'Geração de Questões com IA',
      desc: 'Envie um PDF, Word ou PowerPoint com o conteúdo da aula e a inteligência artificial gera automaticamente questões de múltipla escolha com gabarito. Suporte a múltiplos provedores de IA (OpenAI, Google, Anthropic).',
      highlights: ['Upload de PDF, DOCX e PPTX', 'Questões geradas em segundos', 'Edite e ajuste após geração', 'Múltiplos provedores de IA'],
      color: 'primary',
    },
    {
      icon: BookOpen,
      title: 'iRAT — Avaliação Individual',
      desc: 'Cada aluno distribui 4 pontos entre as alternativas, apostando mais naquelas que acredita serem corretas. Sistema único de apostas de confiança que mede não apenas o conhecimento, mas a certeza do aluno.',
      highlights: ['Sistema de apostas com 4 pontos', 'Temporizador configurável', 'Resultados em tempo real', 'Pontuação baseada na confiança'],
      color: 'phase-irat',
    },
    {
      icon: Users,
      title: 'tRAT — Avaliação em Equipe',
      desc: 'A raspadinha digital (IF-AT) revoluciona a dinâmica de grupo. A equipe discute, decide e "raspa" a alternativa para descobrir se acertou — com feedback imediato e animações de comemoração.',
      highlights: ['Raspadinha digital IF-AT', 'Até 4 tentativas por questão', 'Pontuação decrescente', 'Animações de feedback'],
      color: 'phase-trat',
    },
    {
      icon: Target,
      title: 'Exercícios de Aplicação',
      desc: 'Cenários complexos onde equipes aplicam o conhecimento em situações reais. Casos clínicos, problemas contextualizados e questões que exigem análise crítica e decisão coletiva.',
      highlights: ['Casos clínicos e cenários reais', 'Decisão coletiva da equipe', 'Questões independentes do quiz', 'Monitoramento em tempo real'],
      color: 'phase-app',
    },
    {
      icon: BarChart3,
      title: 'Relatórios Detalhados',
      desc: 'Relatório final com notas ponderadas e relatório gerencial com gráficos de desempenho, distribuição de conceitos, análise de dificuldade por questão e desempenho por assunto.',
      highlights: ['Notas ponderadas automáticas', 'Gráficos de desempenho', 'Índice de dificuldade', 'Envio por e-mail'],
      color: 'primary',
    },
    {
      icon: Award,
      title: 'Gamificação e Conquistas',
      desc: 'Sistema de badges e conquistas que motiva os alunos. Ranking de equipes em tempo real durante o tRAT, com animações e competição saudável que aumenta o engajamento.',
      highlights: ['Badges por desempenho', 'Leaderboard em tempo real', 'Conquistas desbloqueáveis', 'Histórico de pontuação'],
      color: 'primary',
    },
  ];

  const extraFeatures = [
    { icon: Zap, title: 'Tempo Real', desc: 'Sincronização instantânea entre professor e alunos via WebSocket.' },
    { icon: Shield, title: 'Sem Cadastro para Alunos', desc: 'Basta nome e código da sala. Acesso imediato pelo celular.' },
    { icon: Clock, title: 'Temporizador', desc: 'Cronômetro visível para todos durante o iRAT.' },
    { icon: GraduationCap, title: 'Gestão de Turmas', desc: 'Organize alunos por disciplina e semestre.' },
    { icon: MessageSquare, title: 'Sistema de Recursos', desc: 'Equipes podem contestar questões após o tRAT.' },
    { icon: Eye, title: 'Acessibilidade', desc: 'Alto contraste, ajuste de fonte, suporte a leitores de tela.' },
    { icon: WifiOff, title: 'Modo Offline', desc: 'Respostas salvas localmente e sincronizadas automaticamente.' },
    { icon: FileText, title: 'Questionários Compartilhados', desc: 'Compartilhe questionários com outros professores.' },
    { icon: TrendingUp, title: 'Análise de Dificuldade', desc: 'Identificação automática de questões fáceis, médias e difíceis.' },
    { icon: Layers, title: 'Pesos Configuráveis', desc: 'Defina a porcentagem de cada fase na nota final.' },
    { icon: Monitor, title: 'Multiplataforma', desc: 'Funciona em celular, tablet e computador.' },
    { icon: Star, title: 'Plano Gratuito', desc: 'Comece sem pagar nada. Upgrade quando quiser.' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-3 sm:mx-6 mt-3 rounded-2xl bg-card/80 backdrop-blur-2xl border border-border/40 shadow-lg shadow-foreground/[0.03]">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
            <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
                <Sparkles className="w-4.5 h-4.5 text-primary-foreground" />
              </div>
              <span className="text-lg font-heading font-bold tracking-tight">TBL Virtual</span>
            </button>
            <div className="flex items-center gap-2">
              <AccessibilityMenu />
              <Button variant="ghost" size="sm" onClick={() => openAuth('signin')} className="rounded-xl text-sm">Entrar</Button>
              <Button size="sm" onClick={() => openAuth('signup')} className="rounded-xl text-sm shadow-md shadow-primary/20">Começar Grátis</Button>
            </div>
          </div>
        </div>
      </nav>

      <main id="main-content" className="pt-24">
        {/* Hero */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4 text-center max-w-3xl">
            <motion.span initial="hidden" animate="visible" variants={fadeUp} custom={0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5" /> Funcionalidades Completas
            </motion.span>
            <motion.h1 initial="hidden" animate="visible" variants={fadeUp} custom={1}
              className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold leading-tight mb-6">
              Tudo que você precisa para o{' '}
              <span className="bg-gradient-to-r from-primary to-[hsl(var(--phase-app))] bg-clip-text text-transparent">TBL perfeito</span>
            </motion.h1>
            <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={2}
              className="text-lg text-muted-foreground leading-relaxed mb-8">
              Da criação automática de questões com IA ao relatório final com notas ponderadas — conheça cada recurso da plataforma mais completa para Team-Based Learning.
            </motion.p>
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" onClick={() => openAuth('signup')} className="text-base px-8 h-14 rounded-2xl shadow-xl shadow-primary/25">
                Criar Conta Grátis <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/pricing')} className="text-base px-8 h-14 rounded-2xl">
                Ver Planos
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Main Features */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">Recursos Principais</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">As funcionalidades que fazem do TBL Virtual a plataforma mais completa do mercado.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {mainFeatures.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="bg-card rounded-2xl border border-border/40 p-6 hover:shadow-lg hover:border-primary/20 transition-all duration-300 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <f.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-heading font-bold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{f.desc}</p>
                  <ul className="space-y-1.5">
                    {f.highlights.map(h => (
                      <li key={h} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Extra Features Grid */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">E muito mais...</h2>
              <p className="text-muted-foreground text-lg">Recursos adicionais que completam a experiência.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {extraFeatures.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.04 }}
                  className="bg-card rounded-xl border border-border/40 p-4 text-center hover:border-primary/20 transition-colors"
                >
                  <f.icon className="w-6 h-6 text-primary mx-auto mb-2" />
                  <h4 className="text-sm font-heading font-bold mb-1">{f.title}</h4>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 md:py-28 bg-primary relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10 text-center max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary-foreground mb-4">
              Pronto para começar?
            </h2>
            <p className="text-primary-foreground/80 text-lg mb-8">
              Crie sua conta gratuitamente e comece a transformar suas aulas com TBL Virtual.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => openAuth('signup')}
                className="text-base px-10 h-14 rounded-2xl bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-xl font-semibold">
                Criar Conta Gratuita <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button size="lg" variant="ghost" onClick={() => openAuth('signin')}
                className="text-base px-10 h-14 rounded-2xl text-primary-foreground border border-primary-foreground/25 hover:bg-primary-foreground/10">
                Já tenho conta — Entrar
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer onOpenAuth={openAuth} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultMode={authMode} />
    </div>
  );
}
