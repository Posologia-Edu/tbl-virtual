import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Users, BookOpen, ArrowRight, ChevronDown, Zap, Target, BarChart3, CheckCircle2, UserPlus, LogIn, Menu, X, Sparkles, Brain, Layers } from 'lucide-react';
import heroImage from '@/assets/hero-virtual.png';
import tblFlowImage from '@/assets/tbl-flow.png';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from('profiles').insert({ id: data.user.id, full_name: studentName.trim() });
        await supabase.from('user_roles').insert({ user_id: data.user.id, role: 'student' });
        
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
        
        navigate(`/room/${room.id}/join`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao entrar na sala');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-heading font-bold tracking-tight">TBL Virtual</span>
          </button>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-all"
            >
              Início
            </button>
            <button
              onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-all"
            >
              Como Funciona
            </button>
            <button
              onClick={() => setStudentDialogOpen(true)}
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-all"
            >
              Estudante
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-all">
                Professor <ChevronDown className="w-3 h-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/auth?mode=signup')}>
                  <UserPlus className="w-4 h-4 mr-2" /> Criar Conta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/auth?mode=signin')}>
                  <LogIn className="w-4 h-4 mr-2" /> Entrar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-all">
              Planos
            </button>
            <button className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-all">
              Sobre
            </button>
            <button className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-all">
              Contato
            </button>
          </div>

          <button className="md:hidden p-2 rounded-lg hover:bg-accent" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden bg-background border-t border-border/50"
            >
              <div className="px-4 py-3 space-y-1">
                <button onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium py-2.5 px-3 rounded-lg hover:bg-accent">Início</button>
                <button onClick={() => { document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' }); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium py-2.5 px-3 rounded-lg hover:bg-accent">Como Funciona</button>
                <button onClick={() => { setStudentDialogOpen(true); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium py-2.5 px-3 rounded-lg hover:bg-accent">Estudante</button>
                <button onClick={() => navigate('/auth?mode=signup')} className="block w-full text-left text-sm font-medium py-2.5 px-3 rounded-lg hover:bg-accent">Professor - Criar Conta</button>
                <button onClick={() => navigate('/auth?mode=signin')} className="block w-full text-left text-sm font-medium py-2.5 px-3 rounded-lg hover:bg-accent">Professor - Entrar</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero - Full bleed asymmetric */}
      <section className="relative pt-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10 pointer-events-none" />
        <div className="container mx-auto px-4 py-16 md:py-24 lg:py-32">
          <div className="grid lg:grid-cols-5 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="lg:col-span-3 space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                <Sparkles className="w-4 h-4" />
                Plataforma de Aprendizagem Ativa
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-heading font-bold leading-[1.1] tracking-tight">
                Transforme sua
                <span className="block bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  sala de aula
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
                O <strong className="text-foreground">TBL Virtual</strong> é a plataforma que digitaliza a metodologia Team-Based Learning, tornando cada sessão mais dinâmica, organizada e envolvente.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button size="lg" onClick={() => navigate('/auth?mode=signup')} className="text-base px-8 h-12 rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow">
                  Começar Agora <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => setStudentDialogOpen(true)} className="text-base px-8 h-12 rounded-xl">
                  Entrar como Estudante
                </Button>
              </div>
              {/* Stats */}
              <div className="flex gap-8 pt-4">
                {[
                  { num: '3', label: 'Fases integradas' },
                  { num: '∞', label: 'Salas simultâneas' },
                  { num: '100%', label: 'Tempo real' },
                ].map(s => (
                  <div key={s.label}>
                    <p className="text-2xl font-heading font-bold text-primary">{s.num}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="lg:col-span-2 relative"
            >
              <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-primary/10">
                <img src={heroImage} alt="Estudantes colaborando em ambiente virtual" className="w-full" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent" />
              </div>
              {/* Floating card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                className="absolute -left-6 bottom-8 bg-card rounded-xl p-3 shadow-lg border hidden lg:flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">IF-AT Digital</p>
                  <p className="text-xs text-muted-foreground">Feedback instantâneo</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Differentials - Horizontal scroll cards */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Tudo que você precisa para aplicar o TBL
            </h2>
            <p className="text-muted-foreground text-lg">
              Uma experiência completa — do preparo individual à aplicação em equipe.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Brain, title: 'Quizzes Inteligentes', desc: 'Crie bancos de questões com alternativas e gabarito. Reutilize em qualquer sessão.', gradient: 'from-primary/10 to-primary/5' },
              { icon: Users, title: 'Equipes em Tempo Real', desc: 'Alunos entram com um código e são organizados em equipes com sincronização instantânea.', gradient: 'from-[hsl(var(--phase-trat))]/10 to-[hsl(var(--phase-trat))]/5' },
              { icon: Layers, title: 'Apostas de Confiança', desc: 'Distribua 4 pontos entre as alternativas. Quanto mais você sabe, mais aposta — e mais ganha!', gradient: 'from-[hsl(var(--phase-app))]/10 to-[hsl(var(--phase-app))]/5' },
              { icon: BarChart3, title: 'Resultados Instantâneos', desc: 'Acompanhe o desempenho individual e coletivo em dashboards claros e organizados.', gradient: 'from-primary/10 to-primary/5' },
              { icon: Zap, title: 'Sem Complicação', desc: 'Professores criam salas em segundos. Alunos entram com nome e código — sem cadastro.', gradient: 'from-[hsl(var(--phase-trat))]/10 to-[hsl(var(--phase-trat))]/5' },
              { icon: Target, title: 'Aplicação Guiada', desc: 'Cenários complexos onde equipes decidem juntas e comparam suas respostas.', gradient: 'from-[hsl(var(--phase-app))]/10 to-[hsl(var(--phase-app))]/5' },
            ].map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`group rounded-2xl p-6 bg-gradient-to-br ${feat.gradient} border border-border/50 hover:border-border hover:shadow-md transition-all cursor-default`}
              >
                <feat.icon className="w-8 h-8 text-foreground/80 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-heading font-semibold text-lg mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works - Timeline */}
      <section id="como-funciona" className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-sm font-semibold text-primary tracking-wider uppercase">Passo a Passo</span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mt-3 mb-4">Como funciona o TBL Virtual</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Três fases que transformam o conhecimento individual em aprendizado coletivo.
            </p>
          </motion.div>

          {/* Flow illustration */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-20 max-w-3xl mx-auto"
          >
            <img src={tblFlowImage} alt="Fluxo do processo TBL Virtual" className="w-full rounded-2xl" />
          </motion.div>

          {/* Phase cards - vertical timeline style */}
          <div className="max-w-4xl mx-auto space-y-8">
            {[
              {
                step: '01',
                title: 'iRAT — Garantia de Preparo Individual',
                desc: 'Cada aluno distribui 4 pontos entre as alternativas de cada questão, apostando mais naquelas que acredita serem corretas.',
                icon: BookOpen,
                colorClass: 'phase-irat',
                lightClass: 'phase-irat-light',
                items: ['4 pontos para distribuir livremente entre A, B, C e D', 'Aposte mais na alternativa que tem mais certeza', 'Quanto maior a confiança, maior a aposta'],
              },
              {
                step: '02',
                title: 'tRAT — Garantia de Preparo em Equipe',
                desc: 'O gabarito é revelado em equipe. Cada aluno recebe os pontos que apostou na alternativa correta durante o iRAT.',
                icon: Users,
                colorClass: 'phase-trat',
                lightClass: 'phase-trat-light',
                items: ['Apostou 4 na correta? Ganha 4 pontos!', 'Apostou 1 na correta? Ganha 1 ponto', 'Discussão em equipe com feedback imediato', 'Raspadinha digital (IF-AT) para revelar o gabarito'],
              },
              {
                step: '03',
                title: 'Aplicação — Cenários Complexos',
                desc: 'Exercícios de aplicação onde as equipes analisam cenários e tomam decisões conjuntas.',
                icon: Target,
                colorClass: 'phase-app',
                lightClass: 'phase-app-light',
                items: ['Problemas contextualizados', 'Decisão coletiva da equipe', 'Discussão guiada pelo professor'],
              },
            ].map((phase, i) => (
              <motion.div
                key={phase.step}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="flex gap-6 items-start"
              >
                <div className={`flex-shrink-0 w-14 h-14 rounded-2xl ${phase.colorClass} flex items-center justify-center text-lg font-heading font-bold`}>
                  {phase.step}
                </div>
                <div className={`flex-1 rounded-2xl p-6 border ${phase.lightClass}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <phase.icon className="w-5 h-5" />
                    <h3 className="font-heading font-bold text-lg">{phase.title}</h3>
                  </div>
                  <p className="text-sm opacity-80 mb-4">{phase.desc}</p>
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {phase.items.map(item => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-60" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1)_0%,transparent_60%)]" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-6 max-w-xl mx-auto"
          >
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary-foreground">
              Pronto para transformar suas aulas?
            </h2>
            <p className="text-primary-foreground/80 text-lg">
              Crie sua conta de professor gratuitamente e aplique o TBL na sua próxima sessão.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button size="lg" variant="secondary" onClick={() => navigate('/auth?mode=signup')} className="text-base px-8 h-12 rounded-xl">
                Criar Conta de Professor
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => setStudentDialogOpen(true)}
                className="text-base px-8 h-12 rounded-xl text-primary-foreground border border-primary-foreground/20 hover:bg-primary-foreground/10"
              >
                Sou Estudante
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t bg-card">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-heading font-semibold">TBL Virtual</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 TBL Virtual. Aprendizagem Baseada em Equipes.</p>
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
