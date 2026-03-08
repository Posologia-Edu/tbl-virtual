import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowLeft } from 'lucide-react';
import AccessibilityMenu from '@/components/AccessibilityMenu';
import Footer from '@/components/Footer';
import AuthDialog from '@/components/AuthDialog';

export default function TermsPage() {
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const openAuth = (mode: 'signin' | 'signup') => { setAuthMode(mode); setAuthOpen(true); };

  return (
    <div className="min-h-screen bg-background flex flex-col">
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

      <main id="main-content" className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-heading font-bold mb-8">Termos de Serviço</h1>
          <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
            <p><strong className="text-foreground">Última atualização:</strong> 8 de março de 2026</p>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">1. Aceitação dos Termos</h2>
              <p>Ao acessar e utilizar a plataforma TBL Virtual ("Plataforma"), operada por Posologia Produções, você concorda com estes Termos de Serviço. Caso não concorde, não utilize a Plataforma.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">2. Descrição do Serviço</h2>
              <p>O TBL Virtual é uma plataforma educacional que permite a professores e educadores aplicar a metodologia Team-Based Learning (TBL) de forma digital, incluindo criação de questionários, avaliações individuais (iRAT) e em equipe (tRAT), exercícios de aplicação, relatórios de desempenho e geração de questões por inteligência artificial.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">3. Cadastro e Conta</h2>
              <p>Para utilizar as funcionalidades completas, professores devem criar uma conta com dados verdadeiros. O acesso de professores está sujeito à aprovação do administrador. Alunos acessam as salas mediante código, sem necessidade de cadastro.</p>
              <p>Você é responsável pela segurança das credenciais de sua conta e por todas as atividades realizadas sob ela.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">4. Planos e Pagamentos</h2>
              <p>A Plataforma oferece planos gratuitos e pagos. Os planos pagos são cobrados por meio do Stripe. Os limites de funcionalidades variam conforme o plano contratado. O cancelamento pode ser feito a qualquer momento através do portal do cliente.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">5. Uso Aceitável</h2>
              <p>Você concorda em não utilizar a Plataforma para:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Violar leis ou regulamentos aplicáveis;</li>
                <li>Transmitir conteúdo ilegal, difamatório ou ofensivo;</li>
                <li>Tentar acessar áreas não autorizadas do sistema;</li>
                <li>Interferir no funcionamento da Plataforma;</li>
                <li>Coletar dados de outros usuários sem consentimento.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">6. Propriedade Intelectual</h2>
              <p>Todo o conteúdo da Plataforma (código, design, marca, textos) é propriedade de Posologia Produções. Os questionários e conteúdos criados pelos professores permanecem de propriedade dos respectivos autores.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">7. Inteligência Artificial</h2>
              <p>A funcionalidade de geração de questões por IA utiliza provedores terceirizados. O conteúdo gerado deve ser revisado pelo professor antes de uso. A Plataforma não se responsabiliza pela precisão do conteúdo gerado por IA.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">8. Limitação de Responsabilidade</h2>
              <p>A Plataforma é fornecida "como está". Não garantimos disponibilidade ininterrupta. Não nos responsabilizamos por perdas de dados decorrentes de falhas técnicas, uso indevido ou causas fora do nosso controle.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">9. Encerramento</h2>
              <p>Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos, sem aviso prévio. O usuário pode solicitar exclusão de sua conta a qualquer momento.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">10. Contato</h2>
              <p>Para dúvidas sobre estes termos, entre em contato pelo e-mail <strong className="text-foreground">srfernandesaraujo@gmail.com</strong> ou pela página de <a href="/contact" className="text-primary hover:underline">contato</a>.</p>
            </section>
          </div>
        </div>
      </main>

      <Footer onOpenAuth={openAuth} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultMode={authMode} />
    </div>
  );
}
