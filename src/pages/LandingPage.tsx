import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import AuthDialog from '@/components/AuthDialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Users, BookOpen, ArrowRight, Zap, Target, BarChart3,
  CheckCircle2, Menu, X, Sparkles, Brain, Layers,
  Shield, Clock, Star, TrendingUp, Award, MessageSquare
} from 'lucide-react';
import heroImage from '@/assets/hero-landing.jpg';
import featureAi from '@/assets/feature-ai.jpg';
import featureReports from '@/assets/feature-reports.jpg';
import featureTeams from '@/assets/feature-teams.jpg';
import tblFlowImage from '@/assets/tbl-flow.png';
import AccessibilityMenu from '@/components/AccessibilityMenu';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  const openAuth = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setAuthDialogOpen(true);
  };

  const highlights = [
    {
      icon: Brain,
      img: featureAi,
      title: 'Questionários com IA',
      desc: 'Envie um PDF, Word ou PPT e a inteligência artificial gera automaticamente questões de múltipla escolha e casos clínicos de aplicação com gabarito — em segundos.',
      badge: 'Inteligência Artificial',
    },
    {
      icon: Layers,
      img: featureTeams,
      title: 'As 3 Fases Completas do TBL',
      desc: 'iRAT individual com apostas de confiança, tRAT em equipe com raspadinha digital (IF-AT) e Exercícios de Aplicação com cenários complexos — tudo integrado.',
      badge: 'Metodologia Completa',
    },
    {
      icon: BarChart3,
      img: featureReports,
      title: 'Relatórios Detalhados',
      desc: 'Relatório final com notas ponderadas e gerencial com gráficos de desempenho, distribuição de conceitos, análise de dificuldade por questão e desempenho por assunto.',
      badge: 'Análise de Dados',
    },
  ];

  const features = [
    { icon: Zap, title: 'Tempo Real', desc: 'Sincronização instantânea entre professor e alunos. Sem recarregar a página.' },
    { icon: Shield, title: 'Sem Cadastro para Alunos', desc: 'Basta nome e código da sala. Acesso imediato pelo celular.' },
    { icon: Clock, title: 'Temporizador Inteligente', desc: 'Controle o tempo do iRAT com cronômetro visível para todos.' },
    { icon: Star, title: 'Apostas de Confiança', desc: 'Distribua 4 pontos entre as alternativas. Quanto mais certeza, mais aposta.' },
    { icon: TrendingUp, title: 'Nível de Dificuldade', desc: 'Identifique questões fáceis, médias e difíceis automaticamente.' },
    { icon: Award, title: 'Nota Ponderada', desc: 'Pesos configuráveis para iRAT, tRAT e Aplicação. Nota final automática.' },
  ];

  const phases = [
    {
      step: '01',
      title: 'iRAT — Garantia de Preparo Individual',
      desc: 'Cada aluno distribui 4 pontos entre as alternativas, apostando mais naquelas que acredita serem corretas. Uma avaliação individual que mede preparo e confiança.',
      icon: BookOpen,
      colorVar: '--phase-irat',
      items: ['4 pontos para distribuir livremente entre A, B, C e D', 'Apostas refletem o nível de confiança do aluno', 'Temporizador configurável pelo professor', 'Resultados individuais em tempo real'],
    },
    {
      step: '02',
      title: 'tRAT — Garantia de Preparo em Equipe',
      desc: 'Em equipe, os alunos discutem e revelam as respostas com a raspadinha digital (IF-AT). Feedback imediato a cada tentativa.',
      icon: Users,
      colorVar: '--phase-trat',
      items: ['Raspadinha digital (IF-AT) para revelar o gabarito', 'Até 4 tentativas com pontuação decrescente', 'Discussão em equipe com feedback imediato', 'Pontuação baseada nas apostas individuais'],
    },
    {
      step: '03',
      title: 'Aplicação — Cenários Complexos',
      desc: 'Exercícios de aplicação onde equipes analisam cenários reais e respondem questões de verdadeiro ou falso com discussão guiada.',
      icon: Target,
      colorVar: '--phase-app',
      items: ['Casos clínicos e problemas contextualizados', 'Questões V/F com gabarito do professor', 'Decisão coletiva da equipe', 'Monitoramento visual de acerto/erro em tempo real'],
    },
  ];

  const stats = [
    { value: '3', label: 'Fases completas do TBL' },
    { value: '100%', label: 'Sincronização em tempo real' },
    { value: 'IA', label: 'Geração automática de questões' },
    { value: '∞', label: 'Salas simultâneas' },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-3 sm:mx-6 mt-3 rounded-2xl bg-card/80 backdrop-blur-2xl border border-border/40 shadow-lg shadow-foreground/[0.03]">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
                <Sparkles className="w-4.5 h-4.5 text-primary-foreground" />
              </div>
              <span className="text-lg font-heading font-bold tracking-tight">TBL Virtual</span>
            </button>

            <div className="hidden md:flex items-center gap-1">
              {[
                { label: 'Recursos', action: () => document.getElementById('recursos')?.scrollIntoView({ behavior: 'smooth' }) },
                { label: 'Como Funciona', action: () => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' }) },
                { label: 'Diferenciais', action: () => document.getElementById('diferenciais')?.scrollIntoView({ behavior: 'smooth' }) },
                { label: 'Preços', action: () => navigate('/pricing') },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent/60 transition-all duration-200"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-2">
              <AccessibilityMenu />
              <Button variant="ghost" size="sm" onClick={() => openAuth('signin')} className="rounded-xl text-sm">
                Entrar
              </Button>
              <Button size="sm" onClick={() => openAuth('signup')} className="rounded-xl text-sm shadow-md shadow-primary/20">
                Começar Grátis
              </Button>
            </div>

            <button className="md:hidden p-2 rounded-xl hover:bg-accent/60 transition-colors" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden border-t border-border/30"
              >
                <div className="px-4 py-3 space-y-1">
                  <button onClick={() => { document.getElementById('recursos')?.scrollIntoView({ behavior: 'smooth' }); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium py-2.5 px-3 rounded-xl hover:bg-accent/60">Recursos</button>
                  <button onClick={() => { document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' }); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium py-2.5 px-3 rounded-xl hover:bg-accent/60">Como Funciona</button>
                  <button onClick={() => { navigate('/join'); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium py-2.5 px-3 rounded-xl hover:bg-accent/60 flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Sou Estudante</button>
                  <button onClick={() => { openAuth('signup'); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium py-2.5 px-3 rounded-xl hover:bg-accent/60">Professor - Criar Conta</button>
                  <button onClick={() => { openAuth('signin'); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium py-2.5 px-3 rounded-xl hover:bg-accent/60">Professor - Entrar</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section className="relative pt-28 md:pt-36 pb-0 overflow-hidden">
        {/* Decorative organic shapes inspired by reference */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-40 w-[700px] h-[700px] rounded-full bg-primary/6 blur-[80px]" />
          <div className="absolute top-40 -left-60 w-[500px] h-[500px] rounded-full bg-[hsl(var(--phase-trat))]/8 blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-[hsl(var(--phase-app))]/6 blur-[90px]" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={stagger}
              className="space-y-7"
            >
              <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                Plataforma de Aprendizagem Baseada em Equipes
              </motion.div>

              <motion.h1 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl lg:text-6xl xl:text-[4.5rem] font-heading font-bold leading-[1.05] tracking-tight">
                Transforme suas aulas com o{' '}
                <span className="relative inline-block">
                   <span className="relative z-10 bg-gradient-to-r from-primary to-[hsl(var(--phase-app))] bg-clip-text text-transparent">TBL Virtual</span>
                  <span className="absolute bottom-1 left-0 right-0 h-3 bg-[hsl(var(--phase-trat))]/25 rounded-sm -z-0" />
                </span>
              </motion.h1>

              <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
                O <strong className="text-foreground font-semibold">TBL Virtual</strong> é a plataforma mais completa para aplicar a metodologia Team-Based Learning. Crie questionários com IA, aplique as 3 fases em tempo real e gere relatórios detalhados — tudo em um só lugar.
              </motion.p>

              <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" onClick={() => openAuth('signup')} className="text-base px-8 h-14 rounded-2xl shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-300 text-base">
                  Começar Agora — É Grátis <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/join')} className="text-base px-8 h-14 rounded-2xl border-border/60 hover:bg-accent/40">
                  <GraduationCap className="w-5 h-5 mr-2" /> Sou Estudante
                </Button>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="relative rounded-3xl overflow-hidden border border-border/30 shadow-2xl shadow-foreground/[0.08]">
                <img src={heroImage} alt="Estudantes colaborando com TBL Virtual" className="w-full object-cover aspect-[16/10]" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
              </div>
              {/* Floating cards */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.1, duration: 0.5 }}
                className="absolute -left-4 lg:-left-8 bottom-16 bg-card/95 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-border/40 hidden md:flex items-center gap-3"
              >
                <div className="w-12 h-12 rounded-xl bg-[hsl(var(--phase-trat))]/15 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-[hsl(var(--phase-trat))]" />
                </div>
                <div>
                  <p className="text-sm font-bold">Gerado por IA</p>
                  <p className="text-xs text-muted-foreground">10 questões em segundos</p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.3, duration: 0.5 }}
                className="absolute -right-4 lg:-right-6 top-10 bg-card/95 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-border/40 hidden md:flex items-center gap-3"
              >
                <div className="w-12 h-12 rounded-xl bg-[hsl(var(--phase-app))]/15 flex items-center justify-center">
                  <Users className="w-6 h-6 text-[hsl(var(--phase-app))]" />
                </div>
                <div>
                  <p className="text-sm font-bold">100% Tempo Real</p>
                  <p className="text-xs text-muted-foreground">Sem recarregar a página</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-16 md:mt-24"
        >
          <div className="bg-primary py-6 md:py-8">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                {stats.map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-3xl md:text-4xl font-heading font-bold text-primary-foreground">{s.value}</p>
                    <p className="text-sm text-primary-foreground/70 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ============ HIGHLIGHTS - Big feature cards with images ============ */}
      <section id="recursos" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="text-center max-w-3xl mx-auto mb-16 md:mb-20"
          >
            <motion.span variants={fadeUp} className="text-sm font-semibold text-primary tracking-wider uppercase">
              Por que escolher o TBL Virtual
            </motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold mt-4 mb-6 leading-tight">
              Tudo que o professor precisa, em uma única plataforma
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-muted-foreground text-lg">
              Da criação do questionário ao relatório final — automatizado, inteligente e em tempo real.
            </motion.p>
          </motion.div>

          <div className="space-y-8 md:space-y-12">
            {highlights.map((h, i) => (
              <motion.div
                key={h.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className={`grid md:grid-cols-2 gap-8 md:gap-12 items-center ${i % 2 === 1 ? 'md:direction-rtl' : ''}`}
              >
                <div className={`space-y-5 ${i % 2 === 1 ? 'md:order-2' : ''}`}>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-primary/8 text-primary">
                    <h.icon className="w-3.5 h-3.5" />
                    {h.badge}
                  </span>
                  <h3 className="text-2xl md:text-3xl font-heading font-bold leading-snug">{h.title}</h3>
                  <p className="text-muted-foreground text-base md:text-lg leading-relaxed">{h.desc}</p>
                  <Button variant="ghost" className="group text-primary px-0 hover:bg-transparent" onClick={() => openAuth('signup')}>
                    Comece agora <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
                <div className={`relative ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                  <div className="rounded-3xl overflow-hidden border border-border/40 shadow-xl bg-card">
                    <img src={h.img} alt={h.title} className="w-full aspect-square object-cover" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES GRID ============ */}
      <section id="diferenciais" className="py-20 md:py-28 bg-card/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <motion.span variants={fadeUp} className="text-sm font-semibold text-primary tracking-wider uppercase">
              Diferenciais
            </motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold mt-4 mb-6">
              Projetado para simplificar o TBL
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-muted-foreground text-lg">
              Funcionalidades pensadas para professores e otimizadas para alunos no celular.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                variants={fadeUp}
                custom={i}
                className="group relative rounded-2xl p-7 bg-card border border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/[0.06] transition-all duration-300 cursor-default"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mb-5 group-hover:bg-primary/12 group-hover:scale-110 transition-all duration-300">
                  <feat.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-heading font-bold text-lg mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ HOW IT WORKS - 3 phases ============ */}
      <section id="como-funciona" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-16 md:mb-20"
          >
            <motion.span variants={fadeUp} className="text-sm font-semibold text-primary tracking-wider uppercase">
              Passo a Passo
            </motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold mt-4 mb-6">
              As 3 fases do TBL, totalmente digitais
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Cada fase foi cuidadosamente adaptada para o ambiente digital, mantendo a essência da metodologia com o poder da tecnologia.
            </motion.p>
          </motion.div>

          {/* Flow image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-16 max-w-3xl mx-auto"
          >
            <img src={tblFlowImage} alt="Fluxo do processo TBL Virtual" className="w-full rounded-2xl" />
          </motion.div>

          {/* Phase cards */}
          <div className="max-w-4xl mx-auto space-y-6">
            {phases.map((phase, i) => (
              <motion.div
                key={phase.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="group relative rounded-3xl border border-border/50 bg-card p-1 hover:shadow-xl transition-all duration-300"
              >
                <div className="rounded-[1.25rem] p-6 md:p-8" style={{ background: `linear-gradient(135deg, hsl(${phase.colorVar}) / 0.05, transparent)` }}>
                  <div className="flex items-start gap-5 md:gap-8">
                    <div
                      className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-heading font-bold text-primary-foreground shadow-lg"
                      style={{ backgroundColor: `hsl(var(${phase.colorVar}))` }}
                    >
                      {phase.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-3">
                        <phase.icon className="w-5 h-5 text-muted-foreground" />
                        <h3 className="font-heading font-bold text-xl md:text-2xl">{phase.title}</h3>
                      </div>
                      <p className="text-muted-foreground mb-5 max-w-2xl">{phase.desc}</p>
                      <ul className="grid sm:grid-cols-2 gap-3">
                        {phase.items.map(item => (
                          <li key={item} className="flex items-start gap-2.5 text-sm">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: `hsl(var(${phase.colorVar}))` }} />
                            <span className="text-muted-foreground">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIAL / SOCIAL PROOF ============ */}
      <section className="py-20 md:py-28 bg-card/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center space-y-8"
          >
            <MessageSquare className="w-12 h-12 text-primary/30 mx-auto" />
            <blockquote className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold leading-snug text-foreground/90">
              "Com o TBL Virtual, consigo aplicar a metodologia completa em uma aula de 2 horas — algo que antes levava uma semana inteira para organizar."
            </blockquote>
            <div>
              <p className="font-semibold text-foreground">Profa. Dra. Maria Silva</p>
              <p className="text-sm text-muted-foreground">Universidade Federal — Departamento de Saúde</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[hsl(220_70%_40%)]" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-white/5 blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-white/5 blur-[80px]" />
          {/* Organic leaf shapes like the reference */}
          <svg className="absolute top-10 right-10 w-64 h-64 opacity-10" viewBox="0 0 200 200" fill="none">
            <path d="M100 0C130 40 180 60 200 100C180 140 130 160 100 200C70 160 20 140 0 100C20 60 70 40 100 0Z" fill="white" />
          </svg>
          <svg className="absolute bottom-10 left-10 w-48 h-48 opacity-10" viewBox="0 0 200 200" fill="none">
            <path d="M100 0C130 40 180 60 200 100C180 140 130 160 100 200C70 160 20 140 0 100C20 60 70 40 100 0Z" fill="white" />
          </svg>
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center space-y-8"
          >
            <h2 className="text-3xl md:text-4xl lg:text-[3.5rem] font-heading font-bold text-primary-foreground leading-tight">
              Pronto para revolucionar suas sessões de TBL?
            </h2>
            <p className="text-primary-foreground/80 text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
              Junte-se a professores que já estão transformando a aprendizagem com tecnologia, IA e colaboração em tempo real.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                onClick={() => openAuth('signup')}
                className="text-base px-10 h-14 rounded-2xl bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-xl font-semibold"
              >
                Criar Conta Gratuita <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => navigate('/join')}
                className="text-base px-10 h-14 rounded-2xl text-primary-foreground border border-primary-foreground/25 hover:bg-primary-foreground/10"
              >
                Entrar como Estudante
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer onOpenAuth={openAuth} />

      {/* Auth Dialog */}
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} defaultMode={authMode} />
    </div>
  );
}
