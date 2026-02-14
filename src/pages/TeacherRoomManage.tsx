import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Play, Users, Plus, Copy, Clock, AlertTriangle, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';

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
  const [tratStats, setTratStats] = useState<{ teamId: string; teamName: string; score: number }[]>([]);
  const [tratAttemptsAll, setTratAttemptsAll] = useState<any[]>([]);
  const [appQOpen, setAppQOpen] = useState(false);
  const [appQText, setAppQText] = useState('');
  const [appOptA, setAppOptA] = useState('');
  const [appOptB, setAppOptB] = useState('');
  const [appOptC, setAppOptC] = useState('');
  const [appOptD, setAppOptD] = useState('');
  const [appDistribution, setAppDistribution] = useState<Record<string, Record<string, number>>>({});
  const [appQuestions, setAppQuestions] = useState<any[]>([]);

  // Quiz linking
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [linkQuizOpen, setLinkQuizOpen] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState('');

  // Advance confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Timer
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [extendOpen, setExtendOpen] = useState(false);

  const loadAll = useCallback(async () => {
    const { data: roomData } = await supabase.from('rooms').select('*').eq('id', roomId!).single();
    if (roomData) setRoom(roomData);

    // Load participants
    const { data: parts } = await supabase
      .from('room_participants')
      .select('id, user_id, participant_code, profiles:user_id(full_name)')
      .eq('room_id', roomId!);
    setParticipants(parts || []);

    // Load teams
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name, team_members(user_id, profiles:user_id(full_name))')
      .eq('room_id', roomId!)
      .order('name');
    setTeams(teamsData || []);

    // iRAT stats
    const { count } = await supabase.from('irat_responses').select('id', { count: 'exact', head: true }).eq('room_id', roomId!);
    const questionsCount = roomData?.quiz_id
      ? (await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('quiz_id', roomData.quiz_id)).count || 0
      : 0;
    setIratStats({ total: (parts?.length || 0) * questionsCount, completed: count || 0 });

    // tRAT stats
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

    // App questions
    const { data: aq } = await supabase.from('application_questions').select('*').eq('room_id', roomId!).order('sort_order');
    setAppQuestions(aq || []);
    if (aq && aq.length > 0) {
      const { data: ar } = await supabase.from('application_responses').select('*').eq('room_id', roomId!);
      const dist: Record<string, Record<string, number>> = {};
      aq.forEach((q: any) => { dist[q.id] = { A: 0, B: 0, C: 0, D: 0 }; });
      (ar || []).forEach((r: any) => {
        if (dist[r.question_id] && r.selected_option) dist[r.question_id][r.selected_option]++;
      });
      setAppDistribution(dist);
    }

    // Load quizzes for linking
    const { data: quizzesData } = await supabase.from('quizzes').select('*, questions(id)').eq('teacher_id', user!.id).order('created_at', { ascending: false });
    setQuizzes(quizzesData || []);
  }, [roomId, user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Timer effect
  useEffect(() => {
    if (!room?.irat_end_time || room.current_stage !== 'irat_open') {
      setTimeLeft(null);
      return;
    }
    const updateTimer = () => {
      const end = new Date(room.irat_end_time).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((end - now) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) {
        // Auto-advance to tRAT
        autoAdvanceToTrat();
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.irat_end_time, room?.current_stage]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`teacher-room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        () => { loadAll(); }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        () => { loadAll(); }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `room_id=eq.${roomId}` },
        () => { loadAll(); }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_members', filter: `room_id=eq.${roomId}` },
        () => { loadAll(); }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trat_attempts', filter: `room_id=eq.${roomId}` },
        () => { loadAll(); }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'irat_responses', filter: `room_id=eq.${roomId}` },
        () => { loadAll(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, loadAll]);

  const autoAdvanceToTrat = async () => {
    await supabase.from('rooms').update({ current_stage: 'trat_open', irat_end_time: null }).eq('id', roomId!);
    toast.info('Tempo do iRAT esgotado! Avançando para tRAT.');
    loadAll();
  };

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
      // Set timer: 15 minutes from now
      const endTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await supabase.from('rooms').update({ current_stage: nextStage, irat_end_time: endTime }).eq('id', roomId!);
    } else {
      await supabase.from('rooms').update({ current_stage: nextStage, irat_end_time: null }).eq('id', roomId!);
    }
    setConfirmOpen(false);
    loadAll();
    toast.success(`Avançou para ${stageLabels[nextStage].label}`);
  };

  const extendTimer = async (minutes: number) => {
    if (!room?.irat_end_time) return;
    const currentEnd = new Date(room.irat_end_time).getTime();
    const newEnd = new Date(currentEnd + minutes * 60 * 1000).toISOString();
    await supabase.from('rooms').update({ irat_end_time: newEnd }).eq('id', roomId!);
    setExtendOpen(false);
    toast.success(`Timer estendido em ${minutes} minutos`);
    loadAll();
  };

  const linkQuiz = async () => {
    if (!selectedQuizId) return;
    await supabase.from('rooms').update({ quiz_id: selectedQuizId }).eq('id', roomId!);
    setLinkQuizOpen(false);
    loadAll();
    toast.success('Quiz vinculado à sala!');
  };

  const addAppQuestion = async () => {
    if (!appQText.trim()) return;
    await supabase.from('application_questions').insert({
      room_id: roomId!,
      question_text: appQText.trim(),
      option_a: appOptA || null,
      option_b: appOptB || null,
      option_c: appOptC || null,
      option_d: appOptD || null,
      sort_order: appQuestions.length,
    });
    setAppQText(''); setAppOptA(''); setAppOptB(''); setAppOptC(''); setAppOptD('');
    setAppQOpen(false);
    loadAll();
    toast.success('Questão de aplicação adicionada');
  };

  const copyCode = () => {
    if (room) {
      navigator.clipboard.writeText(room.code);
      toast.success('Código copiado!');
    }
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

  // Count ungrouped participants
  const groupedUserIds = new Set(teams.flatMap((t: any) => (t.team_members || []).map((m: any) => m.user_id)));
  const ungroupedParticipants = participants.filter((p: any) => !groupedUserIds.has(p.user_id));

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

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stage progress */}
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
                    }`}>
                      {info.label}
                    </div>
                    {i < stages.length - 1 && <div className="w-4 h-0.5 bg-border" />}
                  </div>
                );
              })}
            </div>
            {room.current_stage !== 'finished' && (
              <Button onClick={handleAdvanceClick} className="w-full mt-3" size="sm">
                <Play className="w-3 h-3 mr-1" /> Avançar para {nextStageName}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* iRAT Timer */}
        {room.current_stage === 'irat_open' && timeLeft !== null && (
          <Card className={timeLeft <= 60 ? 'border-destructive' : ''}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className={`w-5 h-5 ${timeLeft <= 60 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">Tempo restante do iRAT</span>
                </div>
                <span className={`font-mono text-2xl font-bold ${timeLeft <= 60 ? 'text-destructive' : ''}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => extendTimer(5)} className="flex-1">
                  +5 min
                </Button>
                <Button size="sm" variant="outline" onClick={() => extendTimer(10)} className="flex-1">
                  +10 min
                </Button>
                <Button size="sm" variant="outline" onClick={() => extendTimer(15)} className="flex-1">
                  +15 min
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quiz linking */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Quiz Vinculado</p>
                <p className="text-sm text-muted-foreground">
                  {linkedQuiz ? `${linkedQuiz.title} (${linkedQuiz.questions?.length || 0} questões)` : 'Nenhum quiz vinculado'}
                </p>
              </div>
              <Dialog open={linkQuizOpen} onOpenChange={setLinkQuizOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Link2 className="w-3 h-3 mr-1" /> {room.quiz_id ? 'Trocar' : 'Vincular'}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-heading">Vincular Quiz</DialogTitle>
                    <DialogDescription>Selecione um quiz para vincular a esta sala.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    {quizzes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum quiz disponível. Crie um primeiro.</p>
                    ) : (
                      <div className="space-y-2">
                        {quizzes.map((q: any) => (
                          <button
                            key={q.id}
                            onClick={() => setSelectedQuizId(q.id)}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                              selectedQuizId === q.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <p className="font-medium">{q.title}</p>
                            <p className="text-xs text-muted-foreground">{q.questions?.length || 0} questões</p>
                          </button>
                        ))}
                      </div>
                    )}
                    <Button onClick={linkQuiz} className="w-full" disabled={!selectedQuizId}>Vincular Quiz</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Participants */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Users className="w-5 h-5" /> Participantes ({participants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">Nenhum aluno na sala ainda</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {participants.map((p: any) => (
                  <div key={p.id} className="text-sm p-2 rounded-lg bg-muted/50">
                    <p className="font-medium truncate">{(p as any).profiles?.full_name || 'Aluno'}</p>
                    <p className="text-xs text-muted-foreground font-mono">#{p.participant_code}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Teams (during tRAT) */}
        {(room.current_stage === 'trat_open' || room.current_stage === 'application_open' || room.current_stage === 'finished') && (
          <div>
            <h2 className="text-lg font-heading font-semibold mb-3 flex items-center gap-2">
              <Users className="w-5 h-5" /> Equipes ({teams.length})
              {ungroupedParticipants.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {ungroupedParticipants.length} sem grupo
                </Badge>
              )}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {teams.map((t: any) => (
                <Card key={t.id}>
                  <CardContent className="pt-3 pb-3 text-center">
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.team_members?.length || 0} membros</p>
                    {t.team_members?.map((m: any) => (
                      <p key={m.user_id} className="text-xs text-muted-foreground truncate">{m.profiles?.full_name}</p>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* iRAT Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Badge className="phase-irat">iRAT</Badge> Progresso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-phase-irat rounded-full transition-all"
                  style={{ width: `${iratStats.total > 0 ? (iratStats.completed / iratStats.total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground">{iratStats.completed}/{iratStats.total}</span>
            </div>
          </CardContent>
        </Card>

        {/* tRAT Progress & Scores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Badge className="phase-trat">tRAT</Badge> Progresso das Equipes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">Nenhuma equipe formada ainda</p>
            ) : (
              <div className="space-y-4">
                {tratStats.sort((a, b) => b.score - a.score).map(t => {
                  const teamAttempts = (tratAttemptsAll || []).filter((a: any) => a.team_id === t.teamId);
                  const questionsAnswered = new Set(teamAttempts.filter((a: any) => a.is_correct).map((a: any) => a.question_id)).size;
                  const questionsAttempted = new Set(teamAttempts.map((a: any) => a.question_id)).size;
                  const totalQuestions = linkedQuiz?.questions?.length || 0;
                  return (
                    <div key={t.teamId} className="p-3 rounded-lg border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{t.teamName}</span>
                        <span className="font-mono font-bold text-sm">{t.score} pts</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${totalQuestions > 0 ? (questionsAnswered / totalQuestions) * 100 : 0}%`,
                              backgroundColor: 'hsl(var(--phase-trat))',
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{questionsAnswered}/{totalQuestions}</span>
                      </div>
                      {questionsAttempted > questionsAnswered && (
                        <p className="text-xs text-muted-foreground">{questionsAttempted - questionsAnswered} questão(ões) em andamento</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Application Questions */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Badge className="phase-app">Aplicação</Badge> Questões
              </CardTitle>
              <Dialog open={appQOpen} onOpenChange={setAppQOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Plus className="w-3 h-3 mr-1" /> Adicionar</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-heading">Adicionar Questão de Aplicação</DialogTitle>
                    <DialogDescription>Crie uma questão para a fase de aplicação.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div><Label>Questão</Label><Input value={appQText} onChange={e => setAppQText(e.target.value)} /></div>
                    <div><Label>Opção A</Label><Input value={appOptA} onChange={e => setAppOptA(e.target.value)} /></div>
                    <div><Label>Opção B</Label><Input value={appOptB} onChange={e => setAppOptB(e.target.value)} /></div>
                    <div><Label>Opção C</Label><Input value={appOptC} onChange={e => setAppOptC(e.target.value)} /></div>
                    <div><Label>Opção D</Label><Input value={appOptD} onChange={e => setAppOptD(e.target.value)} /></div>
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
                  <div key={q.id}>
                    <p className="text-sm font-medium mb-2">Q{i + 1}. {q.question_text}</p>
                    {appDistribution[q.id] && (
                      <div className="flex gap-1 h-6">
                        {(['A', 'B', 'C', 'D'] as const).map(opt => {
                          const count = appDistribution[q.id]?.[opt] || 0;
                          const total = Object.values(appDistribution[q.id] || {}).reduce((s, v) => s + v, 0);
                          const pct = total > 0 ? (count / total) * 100 : 0;
                          if (pct === 0) return null;
                          return (
                            <div
                              key={opt}
                              className="bg-phase-app rounded text-phase-app-foreground text-xs flex items-center justify-center font-medium"
                              style={{ width: `${pct}%`, minWidth: pct > 0 ? '24px' : 0 }}
                            >
                              {opt}
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
      </main>

      {/* Advance confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Avançar para {nextStageName}?</DialogTitle>
            <DialogDescription>
              Confirme que todos os participantes estão prontos para avançar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{participants.length} aluno(s) na sala</p>
                {participants.length === 0 && (
                  <p className="text-xs text-warning flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Nenhum aluno na sala ainda
                  </p>
                )}
              </div>
            </div>
            {!room.quiz_id && stages[stages.indexOf(room.current_stage) + 1] === 'irat_open' && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Nenhum quiz vinculado! Vincule um quiz antes de iniciar o iRAT.
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Todos os participantes estão participando desta atividade?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button
              onClick={confirmAdvance}
              disabled={!room.quiz_id && stages[stages.indexOf(room.current_stage) + 1] === 'irat_open'}
            >
              Confirmar e Avançar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
