import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ArrowLeft, Play, Users, Plus, Copy, Clock, AlertTriangle, Link2, CheckCircle2, XCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const stages = ['waiting', 'irat_open', 'trat_open', 'application_open', 'finished'] as const;
const stageLabels: Record<string, { label: string; className: string }> = {
  waiting: { label: 'Aguardando', className: 'bg-muted text-muted-foreground' },
  irat_open: { label: 'iRAT', className: 'phase-irat' },
  trat_open: { label: 'tRAT', className: 'phase-trat' },
  application_open: { label: 'Aplicação', className: 'phase-app' },
  finished: { label: 'Finalizado', className: 'bg-muted text-muted-foreground' },
};

export default function TeacherRoomManage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [iratStats, setIratStats] = useState<{ total: number; completed: number }>({ total: 0, completed: 0 });
  const [iratResponses, setIratResponses] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [tratStats, setTratStats] = useState<{ teamId: string; teamName: string; score: number }[]>([]);
  const [tratAttemptsAll, setTratAttemptsAll] = useState<any[]>([]);
  const [appQOpen, setAppQOpen] = useState(false);
  const [appQText, setAppQText] = useState('');
  const [appOptA, setAppOptA] = useState('V');
  const [appOptB, setAppOptB] = useState('F');
  const [appOptC, setAppOptC] = useState('');
  const [appOptD, setAppOptD] = useState('');
  const [appDistribution, setAppDistribution] = useState<Record<string, Record<string, number>>>({});
  const [appQuestions, setAppQuestions] = useState<any[]>([]);
  const [appResponses, setAppResponses] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [linkQuizOpen, setLinkQuizOpen] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const loadAll = useCallback(async () => {
    const { data: roomData } = await supabase.from('rooms').select('*').eq('id', roomId!).single();
    if (roomData) setRoom(roomData);

    const { data: parts } = await supabase
      .from('room_participants')
      .select('id, user_id, participant_code, profiles:user_id(full_name)')
      .eq('room_id', roomId!);
    setParticipants(parts || []);

    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name, team_members(user_id, profiles:user_id(full_name))')
      .eq('room_id', roomId!)
      .order('name');
    setTeams(teamsData || []);

    if (roomData?.quiz_id) {
      const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', roomData.quiz_id).order('sort_order');
      setQuestions(qs || []);

      const { data: iratData } = await supabase.from('irat_responses').select('*').eq('room_id', roomId!);
      setIratResponses(iratData || []);

      const questionsCount = qs?.length || 0;
      const { count } = await supabase.from('irat_responses').select('id', { count: 'exact', head: true }).eq('room_id', roomId!);
      setIratStats({ total: (parts?.length || 0) * questionsCount, completed: count || 0 });
    }

    if (teamsData) {
      const { data: tratData } = await supabase.from('trat_attempts').select('*').eq('room_id', roomId!);
      setTratAttemptsAll(tratData || []);
      const scores = teamsData.map((t: any) => {
        const teamAttempts = (tratData || []).filter((a: any) => a.team_id === t.id && a.is_correct);
        const score = teamAttempts.reduce((sum: number, a: any) => sum + [4, 2, 1, 0][a.attempt_number - 1], 0);
        return { teamId: t.id, teamName: t.name, score };
      });
      setTratStats(scores);
    }

    const { data: aq } = await supabase.from('application_questions').select('*').eq('room_id', roomId!).order('sort_order');
    setAppQuestions(aq || []);

    const { data: ar } = await supabase.from('application_responses').select('*').eq('room_id', roomId!);
    setAppResponses(ar || []);
    if (aq && aq.length > 0) {
      const dist: Record<string, Record<string, number>> = {};
      aq.forEach((q: any) => { dist[q.id] = { A: 0, B: 0, C: 0, D: 0 }; });
      (ar || []).forEach((r: any) => {
        if (dist[r.question_id] && r.selected_option) dist[r.question_id][r.selected_option]++;
      });
      setAppDistribution(dist);
    }

    const { data: quizzesData } = await supabase.from('quizzes').select('*, questions(id)').eq('teacher_id', user!.id).order('created_at', { ascending: false });
    setQuizzes(quizzesData || []);
  }, [roomId, user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Timer
  useEffect(() => {
    if (!room?.irat_end_time || room.current_stage !== 'irat_open') { setTimeLeft(null); return; }
    const updateTimer = () => {
      const end = new Date(room.irat_end_time).getTime();
      const diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setTimeLeft(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.irat_end_time, room?.current_stage]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`teacher-room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => loadAll())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `room_id=eq.${roomId}` }, () => loadAll())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_members', filter: `room_id=eq.${roomId}` }, () => loadAll())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trat_attempts', filter: `room_id=eq.${roomId}` }, () => loadAll())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'irat_responses', filter: `room_id=eq.${roomId}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'application_responses', filter: `room_id=eq.${roomId}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'application_questions', filter: `room_id=eq.${roomId}` }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, loadAll]);

  const handleAdvanceClick = () => {
    if (!room) return;
    const currentIdx = stages.indexOf(room.current_stage);
    if (currentIdx >= stages.length - 1) return;
    setConfirmOpen(true);
  };

  const confirmAdvance = async () => {
    if (!room) return;
    const currentIdx = stages.indexOf(room.current_stage);
    const nextStage = stages[currentIdx + 1];
    if (nextStage === 'irat_open') {
      const endTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await supabase.from('rooms').update({ current_stage: nextStage, irat_end_time: endTime } as any).eq('id', roomId!);
    } else {
      await supabase.from('rooms').update({ current_stage: nextStage, irat_end_time: null } as any).eq('id', roomId!);
    }
    setConfirmOpen(false);
    loadAll();
    toast.success(`Avançou para ${stageLabels[nextStage].label}`);
  };

  const cancelRoom = async () => {
    await supabase.from('rooms').update({ is_active: false, current_stage: 'finished' } as any).eq('id', roomId!);
    toast.success('Aplicação cancelada');
    navigate('/dashboard');
  };

  const extendTimer = async (minutes: number) => {
    if (!room?.irat_end_time) return;
    const newEnd = new Date(new Date(room.irat_end_time).getTime() + minutes * 60 * 1000).toISOString();
    await supabase.from('rooms').update({ irat_end_time: newEnd } as any).eq('id', roomId!);
    toast.success(`Timer estendido em ${minutes} minutos`);
    loadAll();
  };

  const linkQuiz = async () => {
    if (!selectedQuizId) return;
    await supabase.from('rooms').update({ quiz_id: selectedQuizId } as any).eq('id', roomId!);
    setLinkQuizOpen(false);
    loadAll();
    toast.success('Quiz vinculado à sala!');
  };

  const addAppQuestion = async () => {
    if (!appQText.trim()) return;
    await supabase.from('application_questions').insert({
      room_id: roomId!, question_text: appQText.trim(),
      option_a: appOptA || 'V', option_b: appOptB || 'F', option_c: appOptC || null, option_d: appOptD || null,
      sort_order: appQuestions.length,
    });
    setAppQText(''); setAppOptA('V'); setAppOptB('F'); setAppOptC(''); setAppOptD('');
    setAppQOpen(false); loadAll();
    toast.success('Questão de aplicação adicionada');
  };

  const copyCode = () => {
    if (room) { navigator.clipboard.writeText(room.code); toast.success('Código copiado!'); }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!room) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;

  const stageInfo = stageLabels[room.current_stage] || stageLabels.waiting;
  const linkedQuiz = quizzes.find((q: any) => q.id === room.quiz_id);
  const nextStageIdx = stages.indexOf(room.current_stage) + 1;
  const nextStageName = nextStageIdx < stages.length ? stageLabels[stages[nextStageIdx]]?.label : '';

  // Feedback helpers
  const getStudentQuestionFeedback = (studentId: string, questionId: string) => {
    const response = iratResponses.find((r: any) => r.student_id === studentId && r.question_id === questionId);
    if (!response) return null;
    const question = questions.find((q: any) => q.id === questionId);
    if (!question) return null;
    const correctOpt = question.correct_option?.toUpperCase();
    const pointsOnCorrect = response[`points_${correctOpt?.toLowerCase()}`] || 0;
    if (pointsOnCorrect === 4) return { type: 'correct', score: 4 };
    if (pointsOnCorrect > 0) return { type: 'partial', score: pointsOnCorrect };
    return { type: 'wrong', score: 0 };
  };

  const getStudentTotalScore = (studentId: string) => {
    return iratResponses.filter((r: any) => r.student_id === studentId).reduce((sum: number, r: any) => sum + r.score, 0);
  };

  // tRAT team question feedback
  const getTeamQuestionFeedback = (teamId: string, questionId: string) => {
    const teamAttempts = tratAttemptsAll.filter((a: any) => a.team_id === teamId && a.question_id === questionId);
    if (teamAttempts.length === 0) return null;
    const correctAttempt = teamAttempts.find((a: any) => a.is_correct);
    if (correctAttempt) {
      const score = [4, 2, 1, 0][correctAttempt.attempt_number - 1];
      if (correctAttempt.attempt_number === 1) return { type: 'correct', score };
      return { type: 'partial', score };
    }
    if (teamAttempts.length >= 4) return { type: 'wrong', score: 0 };
    return null; // still in progress
  };

  const joinUrl = `${window.location.origin}/join`;

  // ============ WAITING STAGE ============
  const renderWaitingRoom = () => (
    <div className="space-y-6">
      <div className="bg-primary/10 text-center py-2 text-sm text-primary font-medium rounded-lg">
        Os estudantes devem acessar o site e informar o código da sala
      </div>
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="bg-card p-4 rounded-xl border shadow-sm">
          <QRCodeSVG value={joinUrl} size={160} />
        </div>
        <div className="flex-1 text-center md:text-left space-y-3">
          <div>
            <span className="text-lg font-semibold text-primary">Código da Sala: </span>
            <button onClick={copyCode} className="text-2xl font-bold font-mono text-primary hover:underline">{room.code}</button>
          </div>
          <Button variant="destructive" className="bg-warning hover:bg-warning/90 text-warning-foreground" onClick={cancelRoom}>
            Cancelar Aplicação
          </Button>
        </div>
      </div>
      <div className="text-center">
        <h2 className="text-xl font-heading font-bold mb-4">{linkedQuiz?.title || room.name}</h2>
        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).max_grade ?? 10}</p><p className="text-xs text-muted-foreground">Nota Máxima</p></CardContent></Card>
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).individual_pct ?? 70}</p><p className="text-xs text-muted-foreground">% Nota Individual</p></CardContent></Card>
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).team_pct ?? 30}</p><p className="text-xs text-muted-foreground">% Nota Equipe</p></CardContent></Card>
        </div>
      </div>
      <hr className="border-primary/30" />
      <div>
        <h3 className="text-lg font-heading font-bold mb-3">
          <span className="text-primary font-bold">Aplicação Individual</span> : {participants.length} Estudantes Conectados
        </h3>
        {participants.length > 0 && (
          <Table>
            <TableHeader><TableRow><TableHead>Número de Registro</TableHead><TableHead>Nome</TableHead></TableRow></TableHeader>
            <TableBody>
              {participants.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-primary">{p.participant_code}</TableCell>
                  <TableCell>{(p as any).profiles?.full_name || 'Aluno'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <Button onClick={handleAdvanceClick} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg" disabled={!room.quiz_id}>
        Iniciar Aplicação
      </Button>
    </div>
  );

  // ============ iRAT MONITORING ============
  const renderIratMonitoring = () => (
    <div className="space-y-6">
      <div className="bg-primary/10 text-center py-2 text-sm text-primary font-medium rounded-lg">
        Os estudantes devem acessar o site e informar o código da sala
      </div>
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="bg-card p-4 rounded-xl border shadow-sm"><QRCodeSVG value={joinUrl} size={140} /></div>
        <div className="flex-1 text-center md:text-left space-y-3">
          <div>
            <span className="text-lg font-semibold text-primary">Código da Sala: </span>
            <span className="text-2xl font-bold font-mono text-primary">{room.code}</span>
          </div>
          <Button variant="destructive" className="bg-warning hover:bg-warning/90 text-warning-foreground" onClick={cancelRoom}>
            Cancelar Aplicação
          </Button>
        </div>
      </div>
      {timeLeft !== null && (
        <Card className={timeLeft <= 60 ? 'border-destructive' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className={`w-5 h-5 ${timeLeft <= 60 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">Tempo restante do iRAT</span>
              </div>
              <span className={`font-mono text-2xl font-bold ${timeLeft <= 60 ? 'text-destructive' : ''}`}>{formatTime(timeLeft)}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => extendTimer(5)} className="flex-1">+5 min</Button>
              <Button size="sm" variant="outline" onClick={() => extendTimer(10)} className="flex-1">+10 min</Button>
              <Button size="sm" variant="outline" onClick={() => extendTimer(15)} className="flex-1">+15 min</Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="text-center">
        <h2 className="text-xl font-heading font-bold mb-4">{linkedQuiz?.title || room.name}</h2>
        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).max_grade ?? 10}</p><p className="text-xs text-muted-foreground">Nota Máxima</p></CardContent></Card>
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).individual_pct ?? 70}</p><p className="text-xs text-muted-foreground">% Nota Individual</p></CardContent></Card>
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).team_pct ?? 30}</p><p className="text-xs text-muted-foreground">% Nota Equipe</p></CardContent></Card>
        </div>
      </div>
      <hr className="border-primary/30" />
      <div>
        <h3 className="text-lg font-heading font-bold mb-1">
          <span className="text-primary font-bold">Aplicação Individual</span> : {participants.length} Estudantes Conectados
        </h3>
        <p className="text-sm font-semibold mb-3">Feedback das respostas</p>
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">Nº de Registro</TableHead>
                <TableHead className="min-w-[100px]">NOME</TableHead>
                {questions.map((_, i) => (<TableHead key={i} className="text-center min-w-[70px]">Q{i + 1}</TableHead>))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">
                    <div className="flex flex-col items-center gap-1">
                      <span>{getStudentTotalScore(p.user_id)} ponto{getStudentTotalScore(p.user_id) !== 1 ? 's' : ''}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{(p as any).profiles?.full_name || 'Aluno'}</TableCell>
                  {questions.map((q: any) => {
                    const fb = getStudentQuestionFeedback(p.user_id, q.id);
                    return (
                      <TableCell key={q.id} className="text-center">
                        {fb ? (
                          <div className="flex flex-col items-center gap-0.5">
                            {fb.type === 'correct' && <CheckCircle2 className="w-6 h-6 text-success" />}
                            {fb.type === 'partial' && <CheckCircle2 className="w-6 h-6 text-warning" />}
                            {fb.type === 'wrong' && <XCircle className="w-6 h-6 text-destructive" />}
                            <span className="text-[10px] text-muted-foreground">{fb.score} pontos</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <div className="mt-4">
          <p className="font-semibold text-sm mb-2">Legenda</p>
          <div className="flex gap-6 items-center">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-8 h-8 text-success" /><span className="text-sm">Resposta Correta</span></div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-8 h-8 text-warning" /><span className="text-sm">Resposta Parcialmente Correta</span></div>
            <div className="flex items-center gap-2"><XCircle className="w-8 h-8 text-destructive" /><span className="text-sm">Resposta Errada</span></div>
          </div>
        </div>
      </div>
      <Button onClick={handleAdvanceClick} className="w-full bg-warning hover:bg-warning/90 text-warning-foreground py-6 text-lg">
        Finalizar Aplicação Individual → Avançar para {nextStageName}
      </Button>
    </div>
  );

  // ============ TRAT WAITING ROOM (teams) ============
  const renderTratWaitingRoom = () => {
    // Check if teams have started answering - if so, show monitoring
    const hasAttempts = tratAttemptsAll.length > 0;
    if (hasAttempts) return renderTratMonitoring();

    return (
      <div className="space-y-6">
        <div className="bg-primary/10 text-center py-2 text-sm text-primary font-medium rounded-lg">
          Os estudantes devem acessar o site e informar o código da sala
        </div>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="bg-card p-4 rounded-xl border shadow-sm"><QRCodeSVG value={joinUrl} size={140} /></div>
          <div className="flex-1 text-center md:text-left space-y-3">
            <div>
              <span className="text-lg font-semibold text-primary">Código da Sala: </span>
              <button onClick={copyCode} className="text-2xl font-bold font-mono text-primary hover:underline">{room.code}</button>
            </div>
            <Button variant="destructive" className="bg-warning hover:bg-warning/90 text-warning-foreground" onClick={cancelRoom}>
              Cancelar Aplicação
            </Button>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-heading font-bold mb-4">{linkedQuiz?.title || room.name}</h2>
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
            <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).max_grade ?? 10}</p><p className="text-xs text-muted-foreground">Nota Máxima</p></CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).individual_pct ?? 70}</p><p className="text-xs text-muted-foreground">% Nota Individual</p></CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).team_pct ?? 30}</p><p className="text-xs text-muted-foreground">% Nota Equipe</p></CardContent></Card>
          </div>
        </div>

        <hr className="border-primary/30" />

        <div>
          <h3 className="text-lg font-heading font-bold mb-3">
            <span className="text-primary font-bold">Aplicação em Equipes</span> : {teams.length} Equipes Conectadas
          </h3>
          {teams.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código Equipe</TableHead>
                  <TableHead>Nome Equipe</TableHead>
                  <TableHead>Integrantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono">{t.id.slice(0, 5)}</TableCell>
                    <TableCell className="text-primary font-medium">{t.name}</TableCell>
                    <TableCell>{(t.team_members || []).map((m: any) => m.profiles?.full_name).filter(Boolean).join(', ')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <Button onClick={handleAdvanceClick} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg">
          Iniciar Aplicação
        </Button>
      </div>
    );
  };

  // ============ TRAT MONITORING ============
  const renderTratMonitoring = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-heading font-bold mb-4">{linkedQuiz?.title || room.name}</h2>
        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).max_grade ?? 10}</p><p className="text-xs text-muted-foreground">Nota Máxima</p></CardContent></Card>
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).individual_pct ?? 70}</p><p className="text-xs text-muted-foreground">% Nota Individual</p></CardContent></Card>
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).team_pct ?? 30}</p><p className="text-xs text-muted-foreground">% Nota Equipe</p></CardContent></Card>
        </div>
      </div>

      <hr className="border-primary/30" />

      <div>
        <h3 className="text-lg font-heading font-bold mb-1">
          <span className="text-primary font-bold">Aplicação Equipe</span> : {teams.length} Equipes Conectados
        </h3>
        <p className="text-sm font-semibold mb-3">Feedback das respostas</p>
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[80px]">Código Equipe</TableHead>
                <TableHead className="min-w-[100px]">NOME</TableHead>
                {questions.map((_, i) => (<TableHead key={i} className="text-center min-w-[70px]">Q{i + 1}</TableHead>))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((t: any) => {
                const stat = tratStats.find(s => s.teamId === t.id);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.id.slice(0, 5)}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Membros</Badge>
                        <span>{t.name}</span>
                      </div>
                    </TableCell>
                    {questions.map((q: any) => {
                      const fb = getTeamQuestionFeedback(t.id, q.id);
                      return (
                        <TableCell key={q.id} className="text-center">
                          {fb ? (
                            <div className="flex flex-col items-center gap-0.5">
                              {fb.type === 'correct' && <CheckCircle2 className="w-6 h-6 text-success" />}
                              {fb.type === 'partial' && <CheckCircle2 className="w-6 h-6 text-warning" />}
                              {fb.type === 'wrong' && <XCircle className="w-6 h-6 text-destructive" />}
                              <span className="text-[10px] text-muted-foreground">{fb.score} pontos</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <div className="mt-4">
          <p className="font-semibold text-sm mb-2">Legenda</p>
          <div className="flex gap-6 items-center">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-8 h-8 text-success" /><span className="text-sm">Resposta Correta</span></div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-8 h-8 text-warning" /><span className="text-sm">Resposta Parcialmente Correta</span></div>
            <div className="flex items-center gap-2"><XCircle className="w-8 h-8 text-destructive" /><span className="text-sm">Resposta Errada</span></div>
          </div>
        </div>
      </div>
      <Button onClick={handleAdvanceClick} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg">
        Finalizar Aplicação → Avançar para {nextStageName}
      </Button>
    </div>
  );

  // ============ APPLICATION MONITORING ============
  const renderAppMonitoring = () => {
    // Count teams that answered each question
    const teamsAnsweredAll = teams.filter((t: any) => {
      return appQuestions.every(q => appResponses.some((r: any) => r.question_id === q.id && r.team_id === t.id));
    }).length;

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-heading font-bold mb-4">{linkedQuiz?.title || room.name}</h2>
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
            <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).max_grade ?? 10}</p><p className="text-xs text-muted-foreground">Nota Máxima</p></CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).individual_pct ?? 70}</p><p className="text-xs text-muted-foreground">% Nota Individual</p></CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).team_pct ?? 30}</p><p className="text-xs text-muted-foreground">% Nota Equipe</p></CardContent></Card>
          </div>
        </div>

        <hr className="border-primary/30" />

        {/* Add app questions */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Badge className="phase-app">Aplicação de Conceitos</Badge> Questões V/F
              </CardTitle>
              <Dialog open={appQOpen} onOpenChange={setAppQOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Plus className="w-3 h-3 mr-1" /> Adicionar</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-heading">Adicionar Questão de Aplicação (V/F)</DialogTitle>
                    <DialogDescription>Crie uma questão V ou F para a fase de aplicação.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div><Label>Questão</Label><Input value={appQText} onChange={e => setAppQText(e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Opção A (ex: V)</Label><Input value={appOptA} onChange={e => setAppOptA(e.target.value)} /></div>
                      <div><Label>Opção B (ex: F)</Label><Input value={appOptB} onChange={e => setAppOptB(e.target.value)} /></div>
                    </div>
                    <Button onClick={addAppQuestion} className="w-full">Adicionar Questão</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {appQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">Nenhuma questão de aplicação ainda</p>
            ) : (
              <div className="space-y-4">
                {appQuestions.map((q: any, i: number) => (
                  <div key={q.id} className="p-3 rounded-lg border">
                    <p className="text-sm font-medium mb-2">Q{i + 1}. {q.question_text}</p>
                    {appDistribution[q.id] && (
                      <div className="flex gap-2">
                        {(['A', 'B'] as const).map(opt => {
                          const count = appDistribution[q.id]?.[opt] || 0;
                          const label = opt === 'A' ? (q.option_a || 'V') : (q.option_b || 'F');
                          return (
                            <div key={opt} className="flex items-center gap-1">
                              <Badge variant="outline">{label}: {count} equipe(s)</Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-sm text-muted-foreground text-center">
          {teamsAnsweredAll}/{teams.length} equipes finalizaram todas as questões
        </div>

        <Button onClick={handleAdvanceClick} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg">
          Finalizar Aplicação → Encerrar Sessão
        </Button>
      </div>
    );
  };

  // ============ FINISHED ============
  const renderFinished = () => (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {stages.map((s, i) => {
              const info = stageLabels[s];
              const isCurrent = room.current_stage === s;
              const isPast = stages.indexOf(room.current_stage) > i;
              return (
                <div key={s} className="flex items-center gap-2 flex-shrink-0">
                  <div className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isCurrent ? info.className : isPast ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                  }`}>{info.label}</div>
                  {i < stages.length - 1 && <div className="w-4 h-0.5 bg-border" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <div className="text-center py-8">
        <CheckCircle2 className="w-16 h-16 mx-auto text-success mb-4" />
        <h2 className="text-2xl font-heading font-bold">Sessão Finalizada</h2>
        <p className="text-muted-foreground mt-2">Todas as etapas foram concluídas.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Composição da nota: 30% iRAT + 40% tRAT + 30% Aplicação
        </p>
        <Button onClick={() => navigate('/dashboard')} className="mt-6">Voltar ao Dashboard</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-heading font-bold">{room.name}</h1>
            <button onClick={copyCode} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <span className="font-mono tracking-widest">{room.code}</span>
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <Badge className={stageInfo.className}>{stageInfo.label}</Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {room.current_stage === 'waiting' && renderWaitingRoom()}
        {room.current_stage === 'irat_open' && renderIratMonitoring()}
        {room.current_stage === 'trat_open' && renderTratWaitingRoom()}
        {room.current_stage === 'application_open' && renderAppMonitoring()}
        {room.current_stage === 'finished' && renderFinished()}
      </main>

      {/* Advance confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Avançar para {nextStageName}?</DialogTitle>
            <DialogDescription>Confirme que todos os participantes estão prontos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{participants.length} aluno(s) na sala</p>
                {teams.length > 0 && <p className="text-sm text-muted-foreground">{teams.length} equipe(s) formadas</p>}
              </div>
            </div>
            {!room.quiz_id && stages[stages.indexOf(room.current_stage) + 1] === 'irat_open' && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Nenhum quiz vinculado!
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={confirmAdvance}
              disabled={!room.quiz_id && stages[stages.indexOf(room.current_stage) + 1] === 'irat_open'}>
              Confirmar e Avançar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
