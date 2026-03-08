import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Send, Sparkles, ArrowLeft } from 'lucide-react';
import AccessibilityMenu from '@/components/AccessibilityMenu';
import Footer from '@/components/Footer';
import AuthDialog from '@/components/AuthDialog';

export default function ContactPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');

  const openAuth = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('Informe um e-mail válido');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-contact-email', {
        body: {
          subject: subject.trim(),
          message: message.trim(),
          sender_name: name.trim(),
          sender_email: email.trim(),
          is_public: true,
        },
      });
      if (error) throw error;
      toast.success('Mensagem enviada com sucesso!');
      setName(''); setEmail(''); setSubject(''); setMessage('');
    } catch (err: any) {
      toast.error('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
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
        <div className="container mx-auto px-4 max-w-xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-heading font-bold mb-2">Fale Conosco</h1>
            <p className="text-muted-foreground">Envie sua mensagem e responderemos o mais breve possível.</p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} maxLength={100} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} maxLength={255} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Assunto</Label>
                  <Input id="subject" placeholder="Assunto da mensagem" value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem</Label>
                  <Textarea id="message" placeholder="Descreva sua dúvida ou sugestão..." value={message} onChange={e => setMessage(e.target.value)} rows={6} maxLength={2000} required />
                </div>
                <Button type="submit" className="w-full rounded-xl" disabled={sending}>
                  {sending ? 'Enviando...' : <><Send className="w-4 h-4 mr-2" /> Enviar Mensagem</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer onOpenAuth={openAuth} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultMode={authMode} />
    </div>
  );
}
