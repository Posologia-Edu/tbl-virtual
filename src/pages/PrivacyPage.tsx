import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import AccessibilityMenu from '@/components/AccessibilityMenu';
import Footer from '@/components/Footer';
import AuthDialog from '@/components/AuthDialog';

export default function PrivacyPage() {
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
          <h1 className="text-3xl sm:text-4xl font-heading font-bold mb-8">Política de Privacidade</h1>
          <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
            <p><strong className="text-foreground">Última atualização:</strong> 8 de março de 2026</p>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">1. Dados Coletados</h2>
              <p>Coletamos os seguintes dados pessoais:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Professores:</strong> nome completo, e-mail, CPF, instituição, cidade da instituição, endereço (opcional), gênero (opcional);</li>
                <li><strong className="text-foreground">Alunos:</strong> nome ou apelido informado ao entrar na sala (sem cadastro permanente);</li>
                <li><strong className="text-foreground">Dados de uso:</strong> respostas a questionários, pontuações, conquistas, logs de uso de IA.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">2. Finalidade do Tratamento</h2>
              <p>Os dados são utilizados para:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Prover e manter o funcionamento da Plataforma;</li>
                <li>Autenticação e controle de acesso;</li>
                <li>Geração de relatórios educacionais;</li>
                <li>Comunicação com o usuário (aprovação de conta, suporte);</li>
                <li>Melhoria contínua dos serviços e funcionalidades.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">3. Base Legal</h2>
              <p>O tratamento de dados é realizado com base no consentimento do titular (ao criar conta), na execução de contrato (prestação do serviço) e no legítimo interesse (melhoria da plataforma), conforme a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">4. Compartilhamento de Dados</h2>
              <p>Seus dados podem ser compartilhados com:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Supabase:</strong> infraestrutura de banco de dados e autenticação;</li>
                <li><strong className="text-foreground">Stripe:</strong> processamento de pagamentos (planos pagos);</li>
                <li><strong className="text-foreground">Provedores de IA:</strong> OpenAI, Google, Anthropic — apenas o conteúdo do questionário, sem dados pessoais;</li>
                <li><strong className="text-foreground">Resend:</strong> envio de e-mails transacionais.</li>
              </ul>
              <p>Não vendemos nem compartilhamos dados pessoais com terceiros para fins de marketing.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">5. Armazenamento e Segurança</h2>
              <p>Os dados são armazenados em servidores seguros com criptografia em trânsito (TLS) e em repouso. Utilizamos Row-Level Security (RLS) para garantir que cada usuário acesse apenas seus próprios dados.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">6. Direitos do Titular</h2>
              <p>Conforme a LGPD, você tem direito a:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Acessar seus dados pessoais;</li>
                <li>Corrigir dados incompletos ou inexatos;</li>
                <li>Solicitar exclusão de dados;</li>
                <li>Revogar consentimento;</li>
                <li>Solicitar portabilidade dos dados.</li>
              </ul>
              <p>Para exercer esses direitos, entre em contato pelo e-mail <strong className="text-foreground">srfernandesaraujo@gmail.com</strong>.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">7. Retenção de Dados</h2>
              <p>Os dados são mantidos enquanto a conta estiver ativa. Ao solicitar exclusão da conta, todos os dados pessoais serão removidos em até 30 dias, exceto quando houver obrigação legal de retenção.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">8. Contato do Encarregado</h2>
              <p>Para questões relacionadas à proteção de dados, entre em contato com o encarregado (DPO) pelo e-mail <strong className="text-foreground">srfernandesaraujo@gmail.com</strong>.</p>
            </section>
          </div>
        </div>
      </main>

      <Footer onOpenAuth={openAuth} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultMode={authMode} />
    </div>
  );
}
