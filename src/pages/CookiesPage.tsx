import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import AccessibilityMenu from '@/components/AccessibilityMenu';
import Footer from '@/components/Footer';
import AuthDialog from '@/components/AuthDialog';

export default function CookiesPage() {
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
          <h1 className="text-3xl sm:text-4xl font-heading font-bold mb-8">Política de Cookies</h1>
          <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
            <p><strong className="text-foreground">Última atualização:</strong> 8 de março de 2026</p>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">1. O que são Cookies?</h2>
              <p>Cookies são pequenos arquivos de texto armazenados no seu navegador quando você visita um site. Eles são amplamente utilizados para fazer os sites funcionarem de maneira mais eficiente e fornecer informações aos proprietários do site.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">2. Cookies que Utilizamos</h2>

              <h3 className="text-lg font-heading font-semibold text-foreground">2.1. Cookies Essenciais</h3>
              <p>Necessários para o funcionamento da Plataforma. Incluem:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Autenticação:</strong> mantêm sua sessão ativa após o login (Supabase Auth);</li>
                <li><strong className="text-foreground">Preferências:</strong> idioma selecionado, modo de acessibilidade, tamanho de fonte.</li>
              </ul>

              <h3 className="text-lg font-heading font-semibold text-foreground">2.2. Cookies de Funcionalidade</h3>
              <p>Melhoram a experiência do usuário:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">LocalStorage:</strong> cache de respostas offline para sincronização;</li>
                <li><strong className="text-foreground">Tema:</strong> preferência de modo claro/escuro.</li>
              </ul>

              <h3 className="text-lg font-heading font-semibold text-foreground">2.3. Cookies de Terceiros</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Stripe:</strong> processamento seguro de pagamentos;</li>
                <li><strong className="text-foreground">Supabase:</strong> gerenciamento de sessão e autenticação.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">3. Cookies que NÃO Utilizamos</h2>
              <p>O TBL Virtual <strong className="text-foreground">não utiliza</strong>:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Cookies de rastreamento ou publicidade;</li>
                <li>Cookies de redes sociais;</li>
                <li>Cookies de análise comportamental (Google Analytics, etc.).</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">4. Como Gerenciar Cookies</h2>
              <p>Você pode controlar e/ou excluir cookies conforme desejar através das configurações do seu navegador. A maioria dos navegadores permite:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Visualizar quais cookies estão armazenados;</li>
                <li>Excluir cookies individualmente ou todos de uma vez;</li>
                <li>Bloquear cookies de terceiros;</li>
                <li>Configurar para receber notificação antes de aceitar um cookie.</li>
              </ul>
              <p><strong className="text-foreground">Atenção:</strong> bloquear cookies essenciais pode impedir o funcionamento correto da Plataforma, especialmente login e sincronização offline.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">5. Contato</h2>
              <p>Se tiver dúvidas sobre nossa política de cookies, entre em contato pelo e-mail <strong className="text-foreground">srfernandesaraujo@gmail.com</strong> ou pela página de <a href="/contact" className="text-primary hover:underline">contato</a>.</p>
            </section>
          </div>
        </div>
      </main>

      <Footer onOpenAuth={openAuth} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultMode={authMode} />
    </div>
  );
}
