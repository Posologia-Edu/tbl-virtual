import { Component, ErrorInfo, ReactNode } from "react";

interface Props { children: ReactNode; resetKey?: string }
interface State { error: Error | null; retries: number }

const isChunkError = (e: Error) =>
  /dynamically imported module|Loading chunk|Importing a module script failed/i.test(e.message);

/**
 * Evita a "tela branca": se algo quebrar na renderização, tenta remontar a tela
 * automaticamente (uma vez) e, se persistir, mostra um botão de recarregar.
 * Erros de chunk (deploy novo durante a aula) recarregam a página.
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retries: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
    if (isChunkError(error)) {
      window.location.reload();
      return;
    }
    if (this.state.retries < 1) {
      setTimeout(() => this.setState(s => ({ error: null, retries: s.retries + 1 })), 300);
    }
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, retries: 0 });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.state.retries < 1 && !isChunkError(this.state.error)) return null;
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm text-center space-y-3" role="alert">
          <p className="font-semibold">Algo deu errado ao exibir esta tela.</p>
          <p className="text-sm text-muted-foreground">Suas respostas já enviadas estão salvas.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
