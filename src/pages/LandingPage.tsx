import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
import { GraduationCap, Users, BookOpen, ArrowRight, ChevronDown, Zap, Target, BarChart3, Clock, CheckCircle2, UserPlus, LogIn, Menu, X } from 'lucide-react';
import heroImage from '@/assets/hero-team.png';
import tblProcessImage from '@/assets/tbl-process.png';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function LandingPage() {
  const navigate = useNavigate();
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [joining, setJoining] = useState(false);
  const [tblSectionVisible, setTblSectionVisible] = useState(false);
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
      // Sign up anonymously or sign in as student
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
        
        // Find room
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

  const scrollToTbl = () => {
    document.getElementById('tbl-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-card">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-heading font-bold">TBL Active</span>
          </button>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Home
            </button>
            <button
              onClick={scrollToTbl}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              TBL Active
            </button>
            <button
              onClick={() => setStudentDialogOpen(true)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Estudante
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Professor <ChevronDown className="w-3 h-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate('/auth?mode=signup')}>
                  <UserPlus className="w-4 h-4 mr-2" /> Criar Conta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/auth?mode=signin')}>
                  <LogIn className="w-4 h-4 mr-2" /> Entrar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Planos
            </button>
            <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Sobre
            </button>
            <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Contato
            </button>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-card border-t px-4 py-4 space-y-3"
          >
            <button onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium py-2">Home</button>
            <button onClick={() => { scrollToTbl(); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium py-2">TBL Active</button>
            <button onClick={() => { setStudentDialogOpen(true); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium py-2">Estudante</button>
            <button onClick={() => { navigate('/auth?mode=signup'); }} className="block w-full text-left text-sm font-medium py-2">Professor - Criar Conta</button>
            <button onClick={() => { navigate('/auth?mode=signin'); }} className="block w-full text-left text-sm font-medium py-2">Professor - Entrar</button>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <span className="text-sm font-semibold text-primary tracking-wider uppercase">Metodologia Ativa</span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold leading-tight">
                Team Based<br />Learning
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
                Aprendizagem Baseada em Equipes que visa uma aprendizagem mais colaborativa, por meio de uma sequência de práticas de ensino e aprendizagem.
              </p>
              <p className="text-muted-foreground">
                Promove o desenvolvimento de equipes e fornece oportunidades de aprendizagem mais significativa.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" onClick={() => navigate('/auth?mode=signup')} className="text-base px-8">
                  Quero Me Cadastrar! <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => setStudentDialogOpen(true)} className="text-base px-8">
                  Sou Estudante
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <img src={heroImage} alt="Equipe colaborando em TBL" className="w-full max-w-lg mx-auto" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Cards */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-heading font-bold mb-3">Por que usar TBL Active?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Facilite a aplicação da metodologia TBL com tecnologia moderna e intuitiva.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Zap, title: 'Rápido e Fácil', desc: 'Configure uma sessão TBL em minutos com interface intuitiva.' },
              { icon: Users, title: 'Colaborativo', desc: 'Alunos trabalham em equipe com sincronização em tempo real.' },
              { icon: Target, title: 'IF-AT Integrado', desc: 'Sistema de raspadinha digital com pontuação automática.' },
              { icon: BarChart3, title: 'Resultados', desc: 'Visualize o desempenho individual e em equipe instantaneamente.' },
            ].map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feat.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TBL Process Section */}
      <section id="tbl-section" className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-sm font-semibold text-primary tracking-wider uppercase">Como Funciona</span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2 mb-4">O Processo TBL</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A dinâmica do TBL segue três fases essenciais que garantem uma aprendizagem profunda e colaborativa.
            </p>
          </motion.div>

          {/* Process Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <img src={tblProcessImage} alt="Processo TBL" className="w-full max-w-4xl mx-auto rounded-2xl shadow-lg" />
          </motion.div>

          {/* Phase Details */}
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                phase: 'Fase 1',
                title: 'iRAT - Teste Individual',
                desc: 'Cada aluno responde individualmente às questões de múltipla escolha. É a Garantia de Preparo Individual.',
                icon: BookOpen,
                color: 'phase-irat',
                lightColor: 'phase-irat-light',
                details: ['Questões de múltipla escolha (A, B, C, D)', 'Uma tentativa por questão', '1 ponto por resposta correta', 'Resultado liberado após o fechamento'],
              },
              {
                phase: 'Fase 2',
                title: 'tRAT - Teste em Equipe',
                desc: 'As mesmas questões são respondidas em equipe usando a lógica IF-AT (raspadinha).',
                icon: Users,
                color: 'phase-trat',
                lightColor: 'phase-trat-light',
                details: ['Mesmas questões do iRAT', '1ª tentativa correta = 4 pontos', '2ª tentativa = 2 pontos', '3ª tentativa = 1 ponto', 'Feedback imediato (certo/errado)'],
              },
              {
                phase: 'Fase 3',
                title: 'Aplicação',
                desc: 'Exercícios de aplicação com cenários complexos onde as equipes decidem juntas.',
                icon: Target,
                color: 'phase-app',
                lightColor: 'phase-app-light',
                details: ['Cenários complexos', 'Decisão em equipe', 'Histograma de respostas', 'Discussão guiada pelo professor'],
              },
            ].map((phase, i) => (
              <motion.div
                key={phase.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className={`rounded-2xl p-6 border ${phase.lightColor}`}
              >
                <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${phase.color}`}>
                  {phase.phase}
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <phase.icon className="w-6 h-6" />
                  <h3 className="font-heading font-bold text-lg">{phase.title}</h3>
                </div>
                <p className="text-sm mb-4 opacity-80">{phase.desc}</p>
                <ul className="space-y-2">
                  {phase.details.map(d => (
                    <li key={d} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-70" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <h2 className="text-3xl font-heading font-bold text-primary-foreground">Comece Agora!</h2>
            <p className="text-primary-foreground/80 max-w-md mx-auto">
              Crie sua conta de professor e aplique o TBL na sua próxima aula.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" variant="secondary" onClick={() => navigate('/auth?mode=signup')} className="text-base px-8">
                Cadastrar como Professor
              </Button>
              <Button size="lg" variant="outline" onClick={() => setStudentDialogOpen(true)} className="text-base px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                Entrar como Estudante
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-card">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 TBL Active. Aprendizagem Baseada em Equipes.</p>
        </div>
      </footer>

      {/* Student Dialog */}
      <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
        <DialogContent className="max-w-sm">
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
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Código da Sala</label>
              <Input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Ex: ABC123"
                maxLength={6}
                className="font-mono text-xl tracking-[0.3em] text-center"
              />
            </div>
            <Button onClick={handleStudentJoin} disabled={joining} className="w-full" size="lg">
              {joining ? 'Entrando...' : 'Entrar na Sala'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
