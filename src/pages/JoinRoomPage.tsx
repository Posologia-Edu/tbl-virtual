import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Step = 'code' | 'info';

export default function JoinRoomPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('code');
  const [roomCode, setRoomCode] = useState('');
  const [roomId, setRoomId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentRegistration, setStudentRegistration] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [joining, setJoining] = useState(false);

  const handleCodeSubmit = async () => {
    if (!roomCode.trim()) {
      toast.error('Informe o número da sala');
      return;
    }
    // Find room by numeric code
    const { data: room, error } = await supabase
      .from('rooms')
      .select('id')
      .eq('code', roomCode.trim())
      .eq('is_active', true)
      .single();

    if (error || !room) {
      toast.error('Sala não encontrada ou inativa');
      return;
    }
    setRoomId(room.id);
    setStep('info');
  };

  const handleJoin = async () => {
    if (!studentName.trim()) { toast.error('Informe seu nome'); return; }
    if (!studentEmail.trim()) { toast.error('Informe seu e-mail'); return; }

    setJoining(true);
    try {
      const email = studentEmail.trim().toLowerCase();
      const password = `student_${roomCode.trim()}_${Date.now()}`;

      // Try sign up
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: studentName.trim(), role: 'student' },
        },
      });

      if (error) {
        // If user exists, try sign in
        if (error.message.includes('already registered')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) {
            // Just create a new ephemeral account
            const ephEmail = `${roomCode}_${Date.now()}@student.tbl`;
            const { data: d2, error: e2 } = await supabase.auth.signUp({
              email: ephEmail, password,
              options: { data: { full_name: studentName.trim(), role: 'student' } },
            });
            if (e2) throw e2;
            if (d2.user) await joinRoomAsUser(d2.user.id);
          } else if (signInData.user) {
            await joinRoomAsUser(signInData.user.id);
          }
        } else {
          throw error;
        }
      } else if (data.user) {
        await joinRoomAsUser(data.user.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao entrar na sala');
    } finally {
      setJoining(false);
    }
  };

  const joinRoomAsUser = async (userId: string) => {
    // Update profile with registration info
    await supabase.from('profiles').update({
      full_name: studentName.trim(),
      cpf: studentRegistration.trim() || null,
    } as any).eq('id', userId);

    // Check if already participant
    const { data: existing } = await supabase
      .from('room_participants')
      .select('id')
      .eq('user_id', userId)
      .eq('room_id', roomId)
      .single();

    if (existing) {
      navigate(`/room/${roomId}`);
      return;
    }

    const { data: codeData } = await supabase.rpc('generate_participant_code', { p_room_id: roomId });
    await supabase.from('room_participants').insert({
      room_id: roomId,
      user_id: userId,
      participant_code: codeData as string,
    });

    toast.success('Entrou na sala!');
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary-foreground" />
        </div>
        <span className="text-2xl font-heading font-bold tracking-tight text-primary">TBL Active</span>
      </div>

      <div className="w-full max-w-md bg-card rounded-2xl border shadow-lg p-8">
        {step === 'code' ? (
          <div className="space-y-6 text-center">
            <div>
              <h1 className="text-2xl font-heading font-bold text-primary">Olá, estudante!</h1>
              <p className="text-sm text-muted-foreground mt-2">Você está prestes a iniciar seu questionário.</p>
              <p className="text-sm text-muted-foreground mt-3">
                O primeiro passo a se fazer é inserir, no campo abaixo, o número da sala informado por seu(ua) professor(a).
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Caso não deseje iniciar nenhum questionário agora,{' '}
                <button onClick={() => navigate('/')} className="text-primary hover:underline font-medium">clique aqui</button>{' '}
                para voltar a página inicial.
              </p>
            </div>
            <div className="space-y-2 text-left">
              <Label className="font-semibold">Informe o número da sala</Label>
              <Input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Nº da Sala"
                className="text-center text-lg font-mono tracking-widest"
              />
            </div>
            <Button onClick={handleCodeSubmit} className="w-full py-5 text-base">
              Entrar
            </Button>
          </div>
        ) : (
          <div className="space-y-6 text-center">
            <div>
              <p className="text-sm text-muted-foreground">
                Você acabou de entrar na sala de nº <span className="text-primary font-bold text-lg">{roomCode}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                O próximo passo é informar seu nome, número de registro (RA, CPF ou RG) e e-mail.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Caso não deseje iniciar nenhum questionário agora,{' '}
                <button onClick={() => navigate('/')} className="text-primary hover:underline font-medium">clique aqui</button>{' '}
                para voltar a página inicial.
              </p>
            </div>
            <div className="space-y-4 text-left">
              <div>
                <Label className="font-semibold">Nome</Label>
                <Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Nome" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold">Número de Registro</Label>
                  <Input value={studentRegistration} onChange={e => setStudentRegistration(e.target.value)} placeholder="Registro Acadêmico ou CPF ou RG" />
                </div>
                <div>
                  <Label className="font-semibold">E-mail</Label>
                  <Input type="email" value={studentEmail} onChange={e => setStudentEmail(e.target.value)} placeholder="E-mail" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">* Informe um e-mail válido para receber o resultado ao finalizar o questionário.</p>
            </div>
            <Button onClick={handleJoin} disabled={joining} className="w-full py-5 text-base">
              {joining ? 'Entrando...' : 'Entrar'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
