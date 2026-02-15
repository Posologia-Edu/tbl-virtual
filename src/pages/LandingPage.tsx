import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Users, BookOpen, ArrowRight, ChevronDown, Zap, Target, BarChart3, CheckCircle2, UserPlus, LogIn, Menu, X, Sparkles, Brain, Layers, ArrowUpRight } from 'lucide-react';
import heroImage from '@/assets/hero-virtual.png';
import tblFlowImage from '@/assets/tbl-flow.png';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [joining, setJoining] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleStudentJoin = async () => {
    if (!roomCode.trim() || roomCode.trim().length !== 6) {
      toast.error('Informe um código de 6 caracteres');
      return;
    }
    if (!studentName.trim()) {
      toast.error('Informe seu nome');
      return;
    }
    setJoining(true);
    try {
      const email = `${roomCode.trim().toLowerCase()}_${Date.now()}@student.tbl`;
      const password = `student_${roomCode.trim()}_${Date.now()}`;
      
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', roomCode.trim().toUpperCase())
        .eq('is_active', true)
        .single();
      
      if (roomError || !room) {
        toast.error('Sala não encontrada ou inativa');
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: studentName.trim(), role: 'student' },
        },
      });
      if (error) throw error;
      if (data.user) {
        const { data: codeData } = await supabase.rpc('generate_participant_code', { p_room_id: room.id });
        await supabase.from('room_participants').insert({
          room_id: room.id,
          user_id: data.user.id,
          participant_code: codeData as string,
        });
        
        toast.success(`Entrou na sala! Seu código: ${codeData}`);
        navigate(`/room/${room.id}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao entrar na sala');
    } finally {
      setJoining(false);
    }
  };

  const features = [
    { icon: Brain, title: 'Quizzes Inteligentes', desc: 'Crie bancos de questões com alternativas e gabarito. Reutilize em qualquer sessão.' },
    { icon: Users, title: 'Equipes em Tempo Real', desc: 'Alunos entram com um código e são organizados em equipes com sincronização instantânea.' },
    { icon: Layers, title: 'Apostas de Confiança', desc: 'Distribua 4 pontos entre as alternativas. Quanto mais você sabe, mais aposta — e mais ganha!' },
    { icon: BarChart3, title: 'Resultados Instantâneos', desc: 'Acompanhe o desempenho individual e coletivo em dashboards claros e organizados.' },
    { icon: Zap, title: 'Sem Complicação', desc: 'Professores criam salas em segundos. Alunos entram com nome e código — sem cadastro.' },
    { icon: Target, title: 'Aplicação Guiada', desc: 'Cenários complexos onde equipes decidem juntas e comparam suas respostas.' },
  ];

  const phases = [
    {
      step: '01',
      title: 'iRAT — Garantia de Preparo Individual',
      desc: 'Cada aluno distribui 4 pontos entre as alternativas de cada questão, apostando mais naquelas que acredita serem corretas.',
      icon: BookOpen,
      color: 'var(--phase-irat)',
      items: ['4 pontos para distribuir livremente entre A, B, C e D', 'Aposte mais na alternativa que tem mais certeza', 'Quanto maior a confiança, maior a aposta'],
    },
    {
      step: '02',
      title: 'tRAT — Garantia de Preparo em Equipe',
      desc: 'O gabarito é revelado em equipe. Cada aluno recebe os pontos que apostou na alternativa correta durante o iRAT.',
      icon: Users,
      color: 'var(--phase-trat)',
      items: ['Apostou 4 na correta? Ganha 4 pontos!', 'Apostou 1 na correta? Ganha 1 ponto', 'Discussão em equipe com feedback imediato', 'Raspadinha digital (IF-AT) para revelar o gabarito'],
    },
    {
      step: '03',
      title: 'Aplicação — Cenários Complexos',
      desc: 'Exercícios de aplicação onde as equipes analisam cenários e tomam decisões conjuntas.',
      icon: Target,
      color: 'var(--phase-app)',
      items: ['Problemas contextualizados', 'Decisão coletiva da equipe', 'Discussão guiada pelo professor'],
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navbar - Glassmorphic minimal */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-4 mt-3 rounded-2xl bg-card/70 backdrop-blur-2xl border border-border/40 shadow-lg shadow-foreground/[0.02]">
          <div className="px-5 py-3 flex items-center justify-between">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-base font-heading font-bold tracking-tight">TBL Virtual</span>
            </button>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-0.5">
              {[
                { label: 'Início', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
                { label: 'Como Funciona', action: () => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' }) },
                { label: 'Estudante', action: () => navigate('/join') },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent/60 transition-all duration-200"
                >
                  {item.label}
                </button>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent/60 transition-all duration-200">
                  Professor <ChevronDown className="w-3 h-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl">
                  <DropdownMenuItem onClick={() => navigate('/auth?mode=signup')}>
                    <UserPlus className="w-4 h-4 mr-2" /> Criar Conta
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/auth?mode=signin')}>
                    <LogIn className="w-4 h-4 mr-2" /> Entrar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button className="px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent/60 transition-all duration-200">Planos</button>
              <button className="px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent/60 transition-all duration-200">Sobre</button>
              <button className="px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent/60 transition-all duration-200">Contato</button>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/auth?mode=signin')} className="rounded-xl text-sm">
                Entrar
              </Button>
              <Button size="sm" onClick={() => navigate('/auth?mode=signup')} className="rounded-xl text-sm shadow-md shadow-primary/20">
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
                  <button onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium py-2.5 px-3 rounded-xl hover:bg-accent/60">Início</button>
                  <button onClick={() => { document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' }); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium py-2.5 px-3 rounded-xl hover:bg-accent/60">Como Funciona</button>
                  <button onClick={() => { navigate('/join'); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium py-2.5 px-3 rounded-xl hover:bg-accent/60">Estudante</button>
                  <button onClick={() => navigate('/auth?mode=signup')} className="block w-full text-left text-sm font-medium py-2.5 px-3 rounded-xl hover:bg-accent/60">Professor - Criar Conta</button>
                  <button onClick={() => navigate('/auth?mode=signin')} className="block w-full text-left text-sm font-medium py-2.5 px-3 rounded-xl hover:bg-accent/60">Professor - Entrar</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Hero - Editorial split layout */}
      <section className="relative pt-28 md:pt-36 pb-20 md:pb-32">
        {/* Gradient orbs */}
        <div className="absolute top-20 -left-32 w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[hsl(var(--phase-app))]/8 blur-[100px] pointer-events-none" />
        
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={stagger}
              className="space-y-8"
            >
              <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Aprendizagem Ativa Digital
              </motion.div>

              <motion.h1 variants={fadeUp} custom={1} className="text-[2.75rem] sm:text-5xl lg:text-6xl xl:text-[4.25rem] font-heading font-bold leading-[1.05] tracking-tight">
                O TBL nunca foi
                <span className="relative inline-block ml-3">
                  <span className="relative z-10">tão simples</span>
                  <span className="absolute bottom-1 left-0 right-0 h-3 bg-primary/20 rounded-sm -z-0" />
                </span>
              </motion.h1>

              <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-lg">
                O <strong className="text-foreground font-semibold">TBL Virtual</strong> digitaliza a metodologia Team-Based Learning, tornando cada sessão mais dinâmica, organizada e envolvente.
              </motion.p>

              <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" onClick={() => navigate('/auth?mode=signup')} className="text-base px-8 h-13 rounded-2xl shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-300">
                  Começar Agora <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/join')} className="text-base px-8 h-13 rounded-2xl border-border/60 hover:bg-accent/40">
                  Entrar como Estudante
                </Button>
              </motion.div>

              <motion.div variants={fadeUp} custom={4} className="flex items-center gap-8 pt-4">
                {[
                  { num: '3', label: 'Fases integradas' },
                  { num: '∞', label: 'Salas simultâneas' },
                  { num: '100%', label: 'Tempo real' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-3xl font-heading font-bold bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">{s.num}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="relative rounded-3xl overflow-hidden border border-border/30 shadow-2xl shadow-foreground/[0.06]">
                <img src={heroImage} alt="Estudantes colaborando em ambiente virtual" className="w-full" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
              </div>
              {/* Floating cards */}
              <motion.div
                initial={{ opacity: 0, x: -30, y: 10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 1, duration: 0.5 }}
                className="absolute -left-6 bottom-12 bg-card/90 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-border/40 hidden lg:flex items-center gap-3"
              >
                <div className="w-11 h-11 rounded-xl bg-[hsl(var(--phase-trat))]/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-[hsl(var(--phase-trat))]" />
                </div>
                <div>
                  <p className="text-sm font-semibold">IF-AT Digital</p>
                  <p className="text-xs text-muted-foreground">Feedback instantâneo</p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30, y: -10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 1.2, duration: 0.5 }}
                className="absolute -right-4 top-8 bg-card/90 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-border/40 hidden lg:flex items-center gap-3"
              >
                <div className="w-11 h-11 rounded-xl bg-[hsl(var(--phase-app))]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[hsl(var(--phase-app))]" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Equipes Ativas</p>
                  <p className="text-xs text-muted-foreground">Colaboração em tempo real</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features - Bento grid */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="max-w-2xl mb-16"
          >
            <motion.span variants={fadeUp} className="text-sm font-semibold text-primary tracking-wider uppercase">
              Recursos
            </motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold mt-3 mb-5 leading-tight">
              Tudo que você precisa para aplicar o TBL
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-muted-foreground text-lg">
              Uma experiência completa — do preparo individual à aplicação em equipe.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                variants={fadeUp}
                custom={i}
                className="group relative rounded-2xl p-6 bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/[0.04] transition-all duration-300 cursor-default"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/8 flex items-center justify-center mb-5 group-hover:bg-primary/12 group-hover:scale-110 transition-all duration-300">
                  <feat.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
                <ArrowUpRight className="absolute top-6 right-6 w-4 h-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-20 md:py-28 bg-card/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-20"
          >
            <motion.span variants={fadeUp} className="text-sm font-semibold text-primary tracking-wider uppercase">
              Passo a Passo
            </motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold mt-3 mb-5">
              Como funciona o TBL Virtual
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Três fases que transformam o conhecimento individual em aprendizado coletivo.
            </motion.p>
          </motion.div>

          {/* Flow image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-20 max-w-3xl mx-auto"
          >
            <img src={tblFlowImage} alt="Fluxo do processo TBL Virtual" className="w-full rounded-2xl" />
          </motion.div>

          {/* Phase cards - modern stacked cards */}
          <div className="max-w-4xl mx-auto space-y-6">
            {phases.map((phase, i) => (
              <motion.div
                key={phase.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="group relative rounded-3xl border border-border/50 bg-card p-1 hover:shadow-lg transition-all duration-300"
              >
                <div className="rounded-[1.25rem] p-6 md:p-8" style={{ background: `linear-gradient(135deg, hsl(${phase.color}) / 0.04, transparent)` }}>
                  <div className="flex items-start gap-5 md:gap-8">
                    <div
                      className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-heading font-bold text-primary-foreground"
                      style={{ backgroundColor: `hsl(${phase.color})` }}
                    >
                      {phase.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <phase.icon className="w-5 h-5 text-muted-foreground" />
                        <h3 className="font-heading font-bold text-lg md:text-xl">{phase.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-5 max-w-2xl">{phase.desc}</p>
                      <ul className="grid sm:grid-cols-2 gap-2.5">
                        {phase.items.map(item => (
                          <li key={item} className="flex items-start gap-2.5 text-sm">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground/50" />
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

      {/* CTA */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[hsl(220_70%_40%)]" />
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-white/5 blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-white/5 blur-[80px]" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center space-y-8"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-primary-foreground leading-tight">
              Pronto para transformar suas aulas?
            </h2>
            <p className="text-primary-foreground/75 text-lg max-w-lg mx-auto">
              Crie sua conta de professor gratuitamente e aplique o TBL na sua próxima sessão.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                size="lg"
                onClick={() => navigate('/auth?mode=signup')}
                className="text-base px-8 h-13 rounded-2xl bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-xl"
              >
                Criar Conta de Professor <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => navigate('/join')}
                className="text-base px-8 h-13 rounded-2xl text-primary-foreground border border-primary-foreground/20 hover:bg-primary-foreground/10"
              >
                Sou Estudante
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm font-heading font-bold">TBL Virtual</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 TBL Virtual. Aprendizagem Baseada em Equipes.</p>
          </div>
        </div>
      </footer>

      {/* Student Dialog */}
      <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" /> Entrar na Sala
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Seu Nome</label>
              <Input
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="Nome completo"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Código da Sala</label>
              <Input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Ex: ABC123"
                maxLength={6}
                className="font-mono text-xl tracking-[0.3em] text-center rounded-xl"
              />
            </div>
            <Button onClick={handleStudentJoin} disabled={joining} className="w-full rounded-xl" size="lg">
              {joining ? 'Entrando...' : 'Entrar na Sala'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
