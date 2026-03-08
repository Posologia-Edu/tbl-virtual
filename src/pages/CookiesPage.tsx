import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Settings } from 'lucide-react';
import AccessibilityMenu from '@/components/AccessibilityMenu';
import Footer from '@/components/Footer';
import AuthDialog from '@/components/AuthDialog';
import { useCookieConsent } from '@/hooks/useCookieConsent';

export default function CookiesPage() {
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const openAuth = (mode: 'signin' | 'signup') => { setAuthMode(mode); setAuthOpen(true); };
  const { hasConsented, resetConsent } = useCookieConsent();

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

          {/* Manage preferences button */}
          {hasConsented && (
            <div className="mb-8 p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-primary" />
                <p className="text-sm font-medium">Você já configurou suas preferências de cookies.</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={resetConsent}>
                Alterar Preferências
              </Button>
            </div>
          )}

          <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
            <p><strong className="text-foreground">Última atualização:</strong> 8 de março de 2026</p>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">1. O que são Cookies?</h2>
              <p>Cookies são pequenos arquivos de texto armazenados no seu navegador quando você visita um site. Eles são amplamente utilizados para fazer os sites funcionarem de maneira mais eficiente e fornecer informações aos proprietários do site.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">2. Cookies que Utilizamos</h2>

              <h3 className="text-lg font-heading font-semibold text-foreground">2.1. Cookies Essenciais (Sempre ativos)</h3>
              <p>Necessários para o funcionamento da Plataforma. <strong className="text-foreground">Não podem ser desativados.</strong></p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Autenticação:</strong> mantêm sua sessão ativa após o login (Supabase Auth);</li>
                <li><strong className="text-foreground">Sessão:</strong> identificação da sessão de navegação.</li>
              </ul>

              <h3 className="text-lg font-heading font-semibold text-foreground">2.2. Cookies de Funcionalidade (Desativáveis)</h3>
              <p>Melhoram a experiência do usuário:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Tema:</strong> preferência de modo claro/escuro;</li>
                <li><strong className="text-foreground">Idioma:</strong> idioma selecionado pelo usuário;</li>
                <li><strong className="text-foreground">Acessibilidade:</strong> alto contraste, tamanho de fonte;</li>
                <li><strong className="text-foreground">Cache offline:</strong> respostas salvas localmente para sincronização.</li>
              </ul>

              <h3 className="text-lg font-heading font-semibold text-foreground">2.3. Cookies Analíticos (Desativáveis)</h3>
              <p>Nos ajudam a entender como a plataforma é utilizada para melhorar o serviço:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Páginas visitadas:</strong> quais páginas são acessadas e por quanto tempo;</li>
                <li><strong className="text-foreground">Funcionalidades mais usadas:</strong> quais recursos geram mais interesse;</li>
                <li><strong className="text-foreground">Funil de conversão:</strong> caminho do visitante até a criação de conta;</li>
                <li><strong className="text-foreground">Dispositivo e idioma:</strong> tipo de dispositivo e idioma do navegador.</li>
              </ul>
              <p className="text-sm">Esses dados são anonimizados e armazenados de forma segura. <strong className="text-foreground">Não compartilhamos</strong> essas informações com terceiros.</p>

              <h3 className="text-lg font-heading font-semibold text-foreground">2.4. Cookies de Terceiros</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Stripe:</strong> processamento seguro de pagamentos;</li>
                <li><strong className="text-foreground">Supabase:</strong> gerenciamento de sessão e autenticação.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">3. Cookies que NÃO Utilizamos</h2>
              <p>O TBL Virtual <strong className="text-foreground">não utiliza</strong>:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Cookies de publicidade ou remarketing;</li>
                <li>Cookies de redes sociais;</li>
                <li>Rastreadores de terceiros (Google Analytics, Facebook Pixel, etc.).</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-heading font-bold text-foreground">4. Como Gerenciar Cookies</h2>
              <p>Ao visitar o TBL Virtual pela primeira vez, um banner de consentimento será exibido com as opções:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Aceitar Todos:</strong> ativa todos os cookies;</li>
                <li><strong className="text-foreground">Apenas Essenciais:</strong> aceita apenas os cookies necessários;</li>
                <li><strong className="text-foreground">Personalizar:</strong> escolha individualmente quais categorias ativar.</li>
              </ul>
              <p>Você pode <strong className="text-foreground">alterar suas preferências a qualquer momento</strong> visitando esta página e clicando em "Alterar Preferências" no topo.</p>
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
