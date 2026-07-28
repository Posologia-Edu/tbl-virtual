import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, X, Send, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useCookieConsent } from '@/hooks/useCookieConsent';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const GREETING: ChatMessage = {
  role: 'assistant',
  content: 'Olá! Eu sou o **Oráculo**. Posso te ajudar a entender qualquer funcionalidade do sistema, indicar qual ferramenta usar e como usá-la. O que você gostaria de saber?',
};

export default function OracleChat() {
  const { user } = useAuth();
  const { hasConsented } = useCookieConsent();
  const navigate = useNavigate();
  // The cookie banner is a full-width fixed bar until dismissed; keep the
  // widget clear of it instead of stacking on top.
  const bubbleOffset = hasConsented ? 'bottom-4' : 'bottom-28 sm:bottom-24';
  const panelOffset = hasConsented ? 'bottom-24' : 'bottom-48 sm:bottom-44';
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    if (!user) {
      setMessages((prev) => [...prev, { role: 'user', content: text }, {
        role: 'assistant',
        content: 'Você precisa estar logado para conversar comigo. Clique em "Entrar" abaixo para acessar sua conta.',
      }]);
      setInput('');
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('oracle-chat', {
        body: { messages: nextMessages.filter((m) => m !== GREETING) },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(typeof data.error === 'string' ? data.error : 'Não foi possível falar com o Oráculo agora.');
        return;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data?.reply || '...' }]);
    } catch (e) {
      toast.error('Não foi possível falar com o Oráculo agora. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed ${panelOffset} right-4 sm:right-6 z-[70] w-[calc(100vw-2rem)] max-w-sm h-[520px] max-h-[60vh] bg-card border border-border/60 rounded-2xl shadow-2xl shadow-foreground/10 flex flex-col overflow-hidden transition-[bottom] duration-300`}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-primary/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-heading font-bold leading-none">Oráculo</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Assistente do sistema</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => setOpen(false)} aria-label="Fechar Oráculo">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted rounded-bl-sm'
                      }`}
                    >
                      <div className="[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1.5 [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_a]:text-primary [&_a]:underline">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground">
                      Pensando...
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            <div className="p-3 border-t border-border/40">
              {!user ? (
                <Button className="w-full rounded-xl" size="sm" onClick={() => navigate('/auth')}>
                  <LogIn className="w-4 h-4 mr-2" /> Entrar para conversar
                </Button>
              ) : (
                <div className="flex items-end gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pergunte algo sobre o sistema..."
                    className="min-h-[40px] max-h-24 resize-none rounded-xl text-sm"
                    rows={1}
                  />
                  <Button size="icon" className="rounded-xl shrink-0" onClick={handleSend} disabled={loading || !input.trim()} aria-label="Enviar">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.5 }}
        className={`fixed ${bubbleOffset} right-4 sm:right-6 z-[70] transition-[bottom] duration-300`}
      >
        <Button
          onClick={() => setOpen((o) => !o)}
          size="icon"
          className="w-14 h-14 rounded-full shadow-2xl shadow-primary/30 hover:scale-105 transition-transform"
          aria-label={open ? 'Fechar Oráculo' : 'Abrir Oráculo'}
        >
          {open ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        </Button>
      </motion.div>
    </>
  );
}
