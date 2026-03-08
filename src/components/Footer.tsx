import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

interface FooterProps {
  onOpenAuth?: (mode: 'signin' | 'signup') => void;
}

export default function Footer({ onOpenAuth }: FooterProps) {
  return (
    <footer className="bg-card border-t border-border/50">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-primary-foreground" />
              </div>
              <span className="text-lg font-heading font-bold tracking-tight">TBL Virtual</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
              Plataforma de aprendizagem baseada em equipes para professores, educadores e pesquisadores.
            </p>
          </div>

          {/* Produto */}
          <div className="space-y-4">
            <h4 className="text-sm font-heading font-bold tracking-wide">Produto</h4>
            <ul className="space-y-2.5">
              <li>
                <button
                  onClick={() => onOpenAuth?.('signup')}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Criar Conta
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenAuth?.('signin')}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Entrar
                </button>
              </li>
              <li>
                <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Planos
                </Link>
              </li>
              <li>
                <Link to="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Funcionalidades
                </Link>
              </li>
            </ul>
          </div>

          {/* Recursos */}
          <div className="space-y-4">
            <h4 className="text-sm font-heading font-bold tracking-wide">Recursos</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Documentação
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Contato
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="text-sm font-heading font-bold tracking-wide">Legal</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Termos de Serviço
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Política de Cookies
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-border/40 text-center">
          <p className="text-sm text-muted-foreground">
            © 2026 TBL Virtual. Todos os direitos reservados. — Desenvolvido por Sérgio Araújo. Posologia Produções.
          </p>
        </div>
      </div>
    </footer>
  );
}
