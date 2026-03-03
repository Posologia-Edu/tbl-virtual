import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Play, Users, Plus, Copy, Clock, AlertTriangle, Link2, CheckCircle2, XCircle, X, BarChart3, TrendingUp, TrendingDown, MessageSquarePlus, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import TeamLeaderboard from '@/components/TeamLeaderboard';

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
  const { user, profile } = useAuth();
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
  const [tratTimeLeft, setTratTimeLeft] = useState<number | null>(null);
  const [appTimeLeft, setAppTimeLeft] = useState<number | null>(null);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [appealResponse, setAppealResponse] = useState('');
  const [reviewingAppeal, setReviewingAppeal] = useState<any>(null);
  const [timerMinutes, setTimerMinutes] = useState('15');
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
      .select('id, name, trat_started_at, team_members(user_id, profiles:user_id(full_name))')
      .eq('room_id', roomId!)
      .order('name');
    // Filter out empty teams (teams with no members)
    const nonEmptyTeams = (teamsData || []).filter((t: any) => (t.team_members || []).length > 0);
    setTeams(nonEmptyTeams);

    if (roomData?.quiz_id) {
      const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', roomData.quiz_id).order('sort_order');
      setQuestions(qs || []);

      const { data: iratData } = await supabase.from('irat_responses').select('*').eq('room_id', roomId!);
      setIratResponses(iratData || []);

      const questionsCount = qs?.length || 0;
      const { count } = await supabase.from('irat_responses').select('id', { count: 'exact', head: true }).eq('room_id', roomId!);
      setIratStats({ total: (parts?.length || 0) * questionsCount, completed: count || 0 });
    }

    if (nonEmptyTeams) {
      const { data: tratData } = await supabase.from('trat_attempts').select('*').eq('room_id', roomId!);
      setTratAttemptsAll(tratData || []);
      const scores = nonEmptyTeams.map((t: any) => {
        const teamAttempts = (tratData || []).filter((a: any) => a.team_id === t.id && a.is_correct);
        let score = teamAttempts.reduce((sum: number, a: any) => sum + [4, 2, 1, 0][a.attempt_number - 1], 0);
        // Add bonus for accepted appeals
        const accepted = (appealsData || []).filter((ap: any) => ap.team_id === t.id && ap.status === 'accepted');
        accepted.forEach((ap: any) => {
          const existing = teamAttempts.find((a: any) => a.question_id === ap.question_id);
          const existingScore = existing ? [4, 2, 1, 0][existing.attempt_number - 1] : 0;
          score += (4 - existingScore);
        });
        return { teamId: t.id, teamName: t.name, score };
      });
      setTratStats(scores);
    }

    // Auto-load application questions from quiz if none exist for this room yet
    let { data: aq } = await supabase.from('application_questions').select('*').eq('room_id', roomId!).order('sort_order');
    if ((!aq || aq.length === 0) && roomData?.quiz_id) {
      const { data: quizAppQs } = await supabase
        .from('application_questions')
        .select('question_text, option_a, option_b, option_c, option_d, sort_order, correct_answer')
        .eq('quiz_id', roomData.quiz_id)
        .order('sort_order');
      if (quizAppQs && quizAppQs.length > 0) {
        const toInsert = quizAppQs.map((q: any) => ({
          room_id: roomId!,
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          sort_order: q.sort_order,
          correct_answer: q.correct_answer,
        }));
        await supabase.from('application_questions').insert(toInsert);
        const { data: freshAq } = await supabase.from('application_questions').select('*').eq('room_id', roomId!).order('sort_order');
        aq = freshAq;
      }
    }
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

    // Load appeals
    const { data: appealsData } = await supabase
      .from('appeals')
      .select('*, teams(name)')
      .eq('room_id', roomId!)
      .order('submitted_at', { ascending: false });
    setAppeals(appealsData || []);
  }, [roomId, user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // iRAT Timer
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

  // tRAT Timer
  useEffect(() => {
    if (!room?.trat_end_time || room.current_stage !== 'trat_open') { setTratTimeLeft(null); return; }
    const updateTimer = () => {
      const end = new Date(room.trat_end_time).getTime();
      const diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setTratTimeLeft(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.trat_end_time, room?.current_stage]);

  // App Timer
  useEffect(() => {
    if (!room?.app_end_time || room.current_stage !== 'application_open') { setAppTimeLeft(null); return; }
    const updateTimer = () => {
      const end = new Date(room.app_end_time).getTime();
      const diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setAppTimeLeft(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.app_end_time, room?.current_stage]);

  // Realtime - using ref to avoid stale closure
  const loadAllRef = useRef(loadAll);
  loadAllRef.current = loadAll;

  useEffect(() => {
    const channel = supabase
      .channel(`teacher-room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => loadAllRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, () => loadAllRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `room_id=eq.${roomId}` }, () => loadAllRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members', filter: `room_id=eq.${roomId}` }, () => loadAllRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trat_attempts', filter: `room_id=eq.${roomId}` }, () => loadAllRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'irat_responses', filter: `room_id=eq.${roomId}` }, () => loadAllRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'application_responses', filter: `room_id=eq.${roomId}` }, () => loadAllRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'application_questions', filter: `room_id=eq.${roomId}` }, () => loadAllRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appeals', filter: `room_id=eq.${roomId}` }, () => loadAllRef.current())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

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
    const minutes = parseInt(timerMinutes) || 15;
    const endTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    if (nextStage === 'irat_open') {
      await supabase.from('rooms').update({ current_stage: nextStage, irat_end_time: endTime } as any).eq('id', roomId!);
    } else if (nextStage === 'trat_open') {
      await supabase.from('rooms').update({ current_stage: nextStage, irat_end_time: null, trat_end_time: endTime } as any).eq('id', roomId!);
    } else if (nextStage === 'application_open') {
      // Copy quiz app questions if needed
      if (room.quiz_id) {
        const { data: existingRoomQs } = await supabase
          .from('application_questions')
          .select('id')
          .eq('room_id', roomId!)
          .limit(1);

        if (!existingRoomQs || existingRoomQs.length === 0) {
          const { data: quizAppQs } = await supabase
            .from('application_questions')
            .select('question_text, option_a, option_b, option_c, option_d, sort_order, correct_answer')
            .eq('quiz_id', room.quiz_id)
            .order('sort_order');

          if (quizAppQs && quizAppQs.length > 0) {
            const toInsert = quizAppQs.map((q: any) => ({
              room_id: roomId!,
              question_text: q.question_text,
              option_a: q.option_a,
              option_b: q.option_b,
              option_c: q.option_c,
              option_d: q.option_d,
              sort_order: q.sort_order,
              correct_answer: q.correct_answer,
            }));
            await supabase.from('application_questions').insert(toInsert);
          }
        }
      }
      await supabase.from('rooms').update({ current_stage: nextStage, trat_end_time: null, app_end_time: endTime } as any).eq('id', roomId!);
    } else {
      await supabase.from('rooms').update({ current_stage: nextStage, app_end_time: null } as any).eq('id', roomId!);
    }
    setConfirmOpen(false);
    setTimerMinutes('15');
    loadAll();
    toast.success(`Avançou para ${stageLabels[nextStage].label}`);
  };

  const cancelRoom = async () => {
    await supabase.from('rooms').update({ 
      is_active: false, 
      current_stage: 'finished',
      cancelled_at: new Date().toISOString(),
    } as any).eq('id', roomId!);
    toast.success('Aplicação cancelada');
    navigate('/dashboard');
  };

  const extendTimer = async (minutes: number, phase: 'irat' | 'trat' | 'app') => {
    const fieldMap = { irat: 'irat_end_time', trat: 'trat_end_time', app: 'app_end_time' };
    const field = fieldMap[phase];
    const current = room?.[field];
    if (!current) return;
    const newEnd = new Date(new Date(current).getTime() + minutes * 60 * 1000).toISOString();
    await supabase.from('rooms').update({ [field]: newEnd } as any).eq('id', roomId!);
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

  const deleteAppQuestion = async (id: string) => {
    await supabase.from('application_questions').delete().eq('id', id);
    loadAll();
    toast.success('Questão removida');
  };

  const copyCode = () => {
    if (room) { navigator.clipboard.writeText(room.code); toast.success('Código copiado!'); }
  };

  const reviewAppeal = async (appealId: string, status: 'accepted' | 'rejected') => {
    // Update appeal status
    await supabase.from('appeals').update({
      status,
      teacher_response: appealResponse || null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', appealId);

    // If accepted, recalculate: grant full points (4) by inserting a correct attempt at attempt 1
    // We achieve this by updating trat_attempts - but since we can't update, we'll just mark the appeal
    // and adjust scoring in the report computation
    if (status === 'accepted') {
      toast.success('Apelação aceita! A pontuação será recalculada.');
    } else {
      toast.info('Apelação rejeitada.');
    }
    setReviewingAppeal(null);
    setAppealResponse('');
    loadAll();
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
    return null;
  };

  const joinUrl = `${window.location.origin}/join`;

  const pendingAppeals = appeals.filter((a: any) => a.status === 'pending');

  // Appeals Card (reusable)
  const renderAppealsCard = () => {
    if (appeals.length === 0) return null;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <MessageSquarePlus className="w-4 h-4 text-primary" />
            Apelações {pendingAppeals.length > 0 && (
              <Badge className="bg-warning text-warning-foreground">{pendingAppeals.length} pendente(s)</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {appeals.map((a: any) => {
            const q = questions.find((q: any) => q.id === a.question_id);
            const qIdx = q ? questions.indexOf(q) + 1 : '?';
            return (
              <div key={a.id} className={`p-3 rounded-lg border space-y-2 ${a.status === 'pending' ? 'border-warning/50 bg-warning/5' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Q{qIdx}</Badge>
                    <span className="text-sm font-medium">{a.teams?.name || 'Equipe'}</span>
                  </div>
                  <Badge variant="outline" className={
                    a.status === 'accepted' ? 'text-success border-success/30' :
                    a.status === 'rejected' ? 'text-destructive border-destructive/30' :
                    'text-warning border-warning/30'
                  }>
                    {a.status === 'pending' ? 'Pendente' : a.status === 'accepted' ? 'Aceita' : 'Rejeitada'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{a.justification}</p>
                {a.teacher_response && (
                  <p className="text-xs text-primary">Sua resposta: {a.teacher_response}</p>
                )}
                {a.status === 'pending' && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 text-success border-success/30 hover:bg-success/10"
                      onClick={() => setReviewingAppeal({ ...a, action: 'accepted' })}>
                      <ThumbsUp className="w-3 h-3 mr-1" /> Aceitar
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setReviewingAppeal({ ...a, action: 'rejected' })}>
                      <ThumbsDown className="w-3 h-3 mr-1" /> Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  // Application Questions Management Card (reusable across stages)
  const renderAppQuestionsCard = () => (
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
          <p className="text-sm text-muted-foreground text-center">Nenhuma questão de aplicação ainda. Adicione antes de iniciar a fase de aplicação.</p>
        ) : (
          <div className="space-y-2">
            {appQuestions.map((q: any, i: number) => (
              <div key={q.id} className="p-3 rounded-lg border flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Q{i + 1}. {q.question_text}</p>
                  <p className="text-xs text-muted-foreground mt-1">{q.option_a || 'V'} / {q.option_b || 'F'}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => deleteAppQuestion(q.id)}>
                  <X className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

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
        <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).max_grade ?? 10}</p><p className="text-xs text-muted-foreground">Nota Máxima</p></CardContent></Card>
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).individual_pct ?? 30}</p><p className="text-xs text-muted-foreground">% Individual</p></CardContent></Card>
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).team_pct ?? 40}</p><p className="text-xs text-muted-foreground">% Equipe</p></CardContent></Card>
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).application_pct ?? 30}</p><p className="text-xs text-muted-foreground">% Aplicação</p></CardContent></Card>
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

      {/* Quiz linking */}
      {!room.quiz_id && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-heading">Vincular Questionário (iRAT/tRAT)</CardTitle>
              <Dialog open={linkQuizOpen} onOpenChange={setLinkQuizOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Link2 className="w-3 h-3 mr-1" /> Vincular</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Vincular Questionário</DialogTitle>
                    <DialogDescription>Selecione um questionário para a fase iRAT/tRAT.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    {quizzes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum questionário disponível. Crie um no painel do professor.</p>
                    ) : (
                      <>
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedQuizId} onChange={e => setSelectedQuizId(e.target.value)}>
                          <option value="">Selecione...</option>
                          {quizzes.map((q: any) => (<option key={q.id} value={q.id}>{q.title} ({q.questions?.length || 0} questões)</option>))}
                        </select>
                        <Button onClick={linkQuiz} className="w-full" disabled={!selectedQuizId}>Vincular</Button>
                      </>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">Nenhum questionário vinculado. Vincule um para iniciar a fase iRAT/tRAT.</p>
          </CardContent>
        </Card>
      )}

      {room.quiz_id && linkedQuiz && (
        <Card className="border-primary/30">
          <CardContent className="py-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <div>
              <p className="font-medium text-sm">Questionário iRAT/tRAT: {linkedQuiz.title}</p>
              <p className="text-xs text-muted-foreground">{linkedQuiz.questions?.length || 0} questões</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Application Questions Management */}
      {renderAppQuestionsCard()}

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
              <Button size="sm" variant="outline" onClick={() => extendTimer(5, 'irat')} className="flex-1">+5 min</Button>
              <Button size="sm" variant="outline" onClick={() => extendTimer(10, 'irat')} className="flex-1">+10 min</Button>
              <Button size="sm" variant="outline" onClick={() => extendTimer(15, 'irat')} className="flex-1">+15 min</Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="text-center">
        <h2 className="text-xl font-heading font-bold mb-4">{linkedQuiz?.title || room.name}</h2>
        <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).max_grade ?? 10}</p><p className="text-xs text-muted-foreground">Nota Máxima</p></CardContent></Card>
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).individual_pct ?? 30}</p><p className="text-xs text-muted-foreground">% Individual</p></CardContent></Card>
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).team_pct ?? 40}</p><p className="text-xs text-muted-foreground">% Equipe</p></CardContent></Card>
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).application_pct ?? 30}</p><p className="text-xs text-muted-foreground">% Aplicação</p></CardContent></Card>
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
          Aguardando os estudantes formarem as equipes e iniciarem o tRAT
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
        <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
            <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).max_grade ?? 10}</p><p className="text-xs text-muted-foreground">Nota Máxima</p></CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).individual_pct ?? 30}</p><p className="text-xs text-muted-foreground">% Individual</p></CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).team_pct ?? 40}</p><p className="text-xs text-muted-foreground">% Equipe</p></CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).application_pct ?? 30}</p><p className="text-xs text-muted-foreground">% Aplicação</p></CardContent></Card>
        </div>
        </div>

        <hr className="border-primary/30" />

        <div>
          <h3 className="text-lg font-heading font-bold mb-3">
            <span className="text-primary font-bold">Aplicação em Equipes</span> : {teams.length} Equipes Formadas
          </h3>
          {teams.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código Equipe</TableHead>
                  <TableHead>Nome Equipe</TableHead>
                  <TableHead>Integrantes</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono">{t.id.slice(0, 5)}</TableCell>
                    <TableCell className="text-primary font-medium">{t.name}</TableCell>
                    <TableCell>{(t.team_members || []).map((m: any) => m.profiles?.full_name).filter(Boolean).join(', ')}</TableCell>
                    <TableCell className="text-center">
                      {t.trat_started_at ? (
                        <Badge className="bg-success/20 text-success border-success/30">Respondendo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Aguardando</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Application questions management during tRAT stage */}
        {renderAppQuestionsCard()}

        {/* No advance button here - tRAT advances automatically when teams answer, 
            or teacher can advance to application when tRAT is done */}
        <p className="text-sm text-muted-foreground text-center">
          As equipes estão respondendo o tRAT. O botão de avançar aparecerá quando as equipes começarem a responder.
        </p>
      </div>
    );
  };

  // ============ TRAT MONITORING ============
  const renderTratMonitoring = () => (
    <div className="space-y-6">
      {tratTimeLeft !== null && (
        <Card className={tratTimeLeft <= 60 ? 'border-destructive' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className={`w-5 h-5 ${tratTimeLeft <= 60 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">Tempo restante do tRAT</span>
              </div>
              <span className={`font-mono text-2xl font-bold ${tratTimeLeft <= 60 ? 'text-destructive' : ''}`}>{formatTime(tratTimeLeft)}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => extendTimer(5, 'trat')} className="flex-1">+5 min</Button>
              <Button size="sm" variant="outline" onClick={() => extendTimer(10, 'trat')} className="flex-1">+10 min</Button>
              <Button size="sm" variant="outline" onClick={() => extendTimer(15, 'trat')} className="flex-1">+15 min</Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="text-center">
        <h2 className="text-xl font-heading font-bold mb-4">{linkedQuiz?.title || room.name}</h2>
        <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).max_grade ?? 10}</p><p className="text-xs text-muted-foreground">Nota Máxima</p></CardContent></Card>
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).individual_pct ?? 30}</p><p className="text-xs text-muted-foreground">% Individual</p></CardContent></Card>
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).team_pct ?? 40}</p><p className="text-xs text-muted-foreground">% Equipe</p></CardContent></Card>
          <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).application_pct ?? 30}</p><p className="text-xs text-muted-foreground">% Aplicação</p></CardContent></Card>
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

      {/* Appeals */}
      {renderAppealsCard()}

      {/* Application questions management during tRAT monitoring */}
      {renderAppQuestionsCard()}

      {/* Real-time Team Leaderboard */}
      <TeamLeaderboard teams={tratStats} title="Ranking em Tempo Real" />

      <Button onClick={handleAdvanceClick} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg">
        Finalizar Aplicação → Avançar para {nextStageName}
      </Button>
    </div>
  );

  // ============ APPLICATION MONITORING ============
  const renderAppMonitoring = () => {
    const teamsAnsweredAll = teams.filter((t: any) => {
      return appQuestions.every(q => appResponses.some((r: any) => r.question_id === q.id && r.team_id === t.id));
    }).length;

    return (
      <div className="space-y-6">
        {appTimeLeft !== null && (
          <Card className={appTimeLeft <= 60 ? 'border-destructive' : ''}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className={`w-5 h-5 ${appTimeLeft <= 60 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">Tempo restante da Aplicação</span>
                </div>
                <span className={`font-mono text-2xl font-bold ${appTimeLeft <= 60 ? 'text-destructive' : ''}`}>{formatTime(appTimeLeft)}</span>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => extendTimer(5, 'app')} className="flex-1">+5 min</Button>
                <Button size="sm" variant="outline" onClick={() => extendTimer(10, 'app')} className="flex-1">+10 min</Button>
                <Button size="sm" variant="outline" onClick={() => extendTimer(15, 'app')} className="flex-1">+15 min</Button>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="text-center">
          <h2 className="text-xl font-heading font-bold mb-4">{linkedQuiz?.title || room.name}</h2>
          <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
            <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).max_grade ?? 10}</p><p className="text-xs text-muted-foreground">Nota Máxima</p></CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).individual_pct ?? 30}</p><p className="text-xs text-muted-foreground">% Individual</p></CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).team_pct ?? 40}</p><p className="text-xs text-muted-foreground">% Equipe</p></CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{(room as any).application_pct ?? 30}</p><p className="text-xs text-muted-foreground">% Aplicação</p></CardContent></Card>
          </div>
        </div>

        <hr className="border-primary/30" />

        {/* Team responses table with colors */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Badge className="phase-app">Aplicação de Conceitos</Badge> Respostas por Equipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">Nenhuma questão de aplicação</p>
            ) : (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Equipe</TableHead>
                      {appQuestions.map((_: any, i: number) => (
                        <TableHead key={i} className="text-center min-w-[80px]">Q{i + 1}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium text-primary">{t.name}</TableCell>
                        {appQuestions.map((q: any) => {
                          const response = appResponses.find((r: any) => r.question_id === q.id && r.team_id === t.id);
                          if (!response) return <TableCell key={q.id} className="text-center text-muted-foreground text-xs">—</TableCell>;
                          const selectedOpt = response.selected_option;
                          const correctAnswer = q.correct_answer?.trim();
                          const optLabel = selectedOpt === 'A' ? (q.option_a || 'V') : (q.option_b || 'F');
                          const isCorrect = correctAnswer && ((correctAnswer === 'V' && selectedOpt === 'A') || (correctAnswer === 'F' && selectedOpt === 'B'));
                          return (
                            <TableCell key={q.id} className="text-center">
                              <span className={`font-bold text-sm px-2 py-1 rounded ${
                                isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {optLabel}
                              </span>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
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

  // ============ FINISHED - REPORTS ============
  const IRAT_PCT = ((room as any).individual_pct ?? 30) / 100;
  const TRAT_PCT = ((room as any).team_pct ?? 40) / 100;
  const APP_PCT = ((room as any).application_pct ?? 30) / 100;

  const maxGradeVal = parseFloat((room as any).max_grade) || 10;
  const maxIratScore = questions.length * 4;
  const maxTratScore = questions.length * 4;
  const maxAppScore = appQuestions.length > 0 ? appQuestions.length : 1;

  // Compute per-student data for final report
  const computeStudentReport = () => {
    return participants.map((p: any) => {
      const studentId = p.user_id;
      const name = p.profiles?.full_name || 'Aluno';
      const ra = p.participant_code || '—';

      const studentIrat = iratResponses.filter((r: any) => r.student_id === studentId);
      const iratRawScore = studentIrat.reduce((sum: number, r: any) => sum + r.score, 0);

      const studentTeam = teams.find((t: any) =>
        (t.team_members || []).some((m: any) => m.user_id === studentId)
      );
      const teamId = studentTeam?.id;

      let tratRawScore = 0;
      if (teamId) {
        const teamAttempts = tratAttemptsAll.filter((a: any) => a.team_id === teamId && a.is_correct);
        tratRawScore = teamAttempts.reduce((sum: number, a: any) => sum + [4, 2, 1, 0][a.attempt_number - 1], 0);
        
        // Add bonus for accepted appeals: grant full points (4) minus what they already got
        const acceptedAppeals = appeals.filter((ap: any) => ap.team_id === teamId && ap.status === 'accepted');
        acceptedAppeals.forEach((ap: any) => {
          const existingAttempt = tratAttemptsAll.find((a: any) => a.team_id === teamId && a.question_id === ap.question_id && a.is_correct);
          const existingScore = existingAttempt ? [4, 2, 1, 0][existingAttempt.attempt_number - 1] : 0;
          tratRawScore += (4 - existingScore); // Grant full marks minus what was already awarded
        });
      }

      let appRawScore = 0;
      if (teamId && appQuestions.length > 0) {
        appRawScore = appQuestions.filter(q =>
          appResponses.some((r: any) => r.question_id === q.id && r.team_id === teamId)
        ).length;
      }

      const iratGrade = maxIratScore > 0 ? (iratRawScore / maxIratScore) * maxGradeVal : 0;
      const tratGrade = maxTratScore > 0 ? (tratRawScore / maxTratScore) * maxGradeVal : 0;
      const appGrade = maxAppScore > 0 ? (appRawScore / maxAppScore) * maxGradeVal : 0;
      const finalGrade = iratGrade * IRAT_PCT + tratGrade * TRAT_PCT + appGrade * APP_PCT;

      return {
        ra, name, studentId, teamName: studentTeam?.name || '—',
        iratRaw: iratRawScore, tratRaw: tratRawScore, appRaw: appRawScore,
        iratGrade: iratGrade.toFixed(2), tratGrade: tratGrade.toFixed(2),
        appGrade: appGrade.toFixed(2), finalGrade: finalGrade.toFixed(2),
      };
    });
  };

  const computeQuestionStats = () => {
    return questions.map((q: any, i: number) => {
      const qResponses = iratResponses.filter((r: any) => r.question_id === q.id);
      const totalResponses = qResponses.length;
      const correctCount = qResponses.filter((r: any) => r.score === 4).length;
      const partialCount = qResponses.filter((r: any) => r.score > 0 && r.score < 4).length;
      const wrongCount = qResponses.filter((r: any) => r.score === 0).length;
      const avgScore = totalResponses > 0 ? qResponses.reduce((s: number, r: any) => s + r.score, 0) / totalResponses : 0;
      const correctPct = totalResponses > 0 ? (correctCount / totalResponses) * 100 : 0;

      return {
        index: i + 1, id: q.id, text: q.question_text.substring(0, 80) + (q.question_text.length > 80 ? '...' : ''),
        totalResponses, correctCount, partialCount, wrongCount, avgScore, correctPct,
        difficulty: correctPct >= 70 ? 'Fácil' : correctPct >= 40 ? 'Médio' : 'Difícil',
      };
    });
  };

  const CHART_COLORS = ['hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--primary))'];

  const renderFinished = () => {
    const studentData = computeStudentReport();
    const questionStats = computeQuestionStats();

    const sortedByCorrect = [...questionStats].sort((a, b) => b.correctPct - a.correctPct);
    const easiest = sortedByCorrect.slice(0, 3);
    const hardest = [...sortedByCorrect].reverse().slice(0, 3);

    const avgIrat = studentData.length > 0 ? studentData.reduce((s, d) => s + parseFloat(d.iratGrade), 0) / studentData.length : 0;
    const avgTrat = studentData.length > 0 ? studentData.reduce((s, d) => s + parseFloat(d.tratGrade), 0) / studentData.length : 0;
    const avgApp = studentData.length > 0 ? studentData.reduce((s, d) => s + parseFloat(d.appGrade), 0) / studentData.length : 0;
    const avgFinal = studentData.length > 0 ? studentData.reduce((s, d) => s + parseFloat(d.finalGrade), 0) / studentData.length : 0;

    const performanceDistribution = [
      { name: 'Excelente (≥9)', value: studentData.filter(d => parseFloat(d.finalGrade) >= 9).length },
      { name: 'Bom (7-8.9)', value: studentData.filter(d => parseFloat(d.finalGrade) >= 7 && parseFloat(d.finalGrade) < 9).length },
      { name: 'Regular (5-6.9)', value: studentData.filter(d => parseFloat(d.finalGrade) >= 5 && parseFloat(d.finalGrade) < 7).length },
      { name: 'Insuficiente (<5)', value: studentData.filter(d => parseFloat(d.finalGrade) < 5).length },
    ].filter(d => d.value > 0);

    const barData = questionStats.map(q => ({
      name: `Q${q.index}`,
      acertos: q.correctPct,
      erros: 100 - q.correctPct,
    }));

    return (
      <div className="space-y-6">
        <Tabs defaultValue="final" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="final">Relatório Final</TabsTrigger>
            <TabsTrigger value="management">Relatório Gerencial</TabsTrigger>
          </TabsList>

          <TabsContent value="final" className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                <strong>Professor(a):</strong> {profile?.full_name || '—'}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Data aplicação:</strong> {new Date(room.created_at).toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="inline-block bg-warning/80 text-warning-foreground px-8 py-2 rounded-full text-xl font-bold">
                {maxGradeVal.toFixed(2)}
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Pontuação Máxima</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center">
                <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full font-bold">
                  {(maxGradeVal * IRAT_PCT).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Nota Máx. Individual</p>
              </div>
              <div className="text-center">
                <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full font-bold">
                  {(IRAT_PCT * 100).toFixed(0)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">% Nota Individual</p>
              </div>
              <div className="text-center">
                <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full font-bold">
                  {(maxGradeVal * TRAT_PCT).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Nota Máx. Equipe</p>
              </div>
              <div className="text-center">
                <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full font-bold">
                  {(TRAT_PCT * 100).toFixed(0)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">% Nota Equipe</p>
              </div>
            </div>

            <div className="text-center">
              <div className="inline-block bg-primary/80 text-primary-foreground px-6 py-1 rounded-full font-bold text-sm">
                Aplicação de Conceitos: {(APP_PCT * 100).toFixed(0)}% (máx {(maxGradeVal * APP_PCT).toFixed(2)})
              </div>
            </div>

            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="min-w-[120px]">RA</TableHead>
                    <TableHead className="min-w-[180px]">Nome</TableHead>
                    <TableHead className="text-center min-w-[100px]">Acertos Individuais</TableHead>
                    <TableHead className="text-center min-w-[120px]">Pontuação Individual</TableHead>
                    <TableHead className="text-center min-w-[100px]">Acertos em Equipe</TableHead>
                    <TableHead className="text-center min-w-[120px]">Pontuação da Equipe</TableHead>
                    <TableHead className="text-center min-w-[100px]">Pont. Aplicação</TableHead>
                    <TableHead className="text-center min-w-[110px]">Pontuação Final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentData.sort((a, b) => parseFloat(b.finalGrade) - parseFloat(a.finalGrade)).map((s) => (
                    <TableRow key={s.studentId}>
                      <TableCell className="font-mono font-bold">{s.ra}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-center">{s.iratRaw}</TableCell>
                      <TableCell className="text-center">{s.iratGrade}</TableCell>
                      <TableCell className="text-center">{s.tratRaw}</TableCell>
                      <TableCell className="text-center">{s.tratGrade}</TableCell>
                      <TableCell className="text-center">{s.appGrade}</TableCell>
                      <TableCell className="text-center font-bold text-primary">{s.finalGrade}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* Appeals in final report */}
            {renderAppealsCard()}

            <div className="flex gap-3">
              <Button onClick={() => navigate('/dashboard')} variant="outline" className="flex-1">Voltar ao Dashboard</Button>
              <Button
                className="flex-1"
                disabled={sendingEmails}
                onClick={async () => {
                  setSendingEmails(true);
                  try {
                    const res = await supabase.functions.invoke('send-report-email', { body: { roomId } });
                    if (res.error) throw res.error;
                    const data = res.data as any;
                    if (data.sent === 0) {
                      toast.warning('Nenhum aluno possui e-mail real cadastrado. Alunos que entraram com contas temporárias não recebem relatórios por e-mail.');
                    } else {
                      toast.success(`Relatórios enviados para ${data.sent} aluno(s)!`);
                    }
                  } catch (err: any) {
                    toast.error('Erro ao enviar relatórios: ' + (err.message || 'Erro desconhecido'));
                  } finally {
                    setSendingEmails(false);
                  }
                }}
              >
                {sendingEmails ? 'Enviando...' : '📧 Enviar Relatórios por E-mail'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="management" className="space-y-6">
            <h2 className="text-xl font-heading font-bold">Relatório Gerencial</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{avgIrat.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Média iRAT</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{avgTrat.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Média tRAT</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{avgApp.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Média Aplicação</p>
              </CardContent></Card>
              <Card className="border-primary"><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-primary">{avgFinal.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Média Final</p>
              </CardContent></Card>
            </div>

            {performanceDistribution.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Distribuição de Desempenho</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={performanceDistribution} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {performanceDistribution.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {barData.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">% de Acertos por Questão</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis fontSize={12} domain={[0, 100]} />
                        <Tooltip />
                        <Bar dataKey="acertos" name="% Acertos" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-heading flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-success" /> Questões Mais Fáceis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {easiest.map(q => (
                    <div key={q.id} className="flex items-center justify-between p-2 rounded-lg bg-success/5 border border-success/20">
                      <span className="text-sm font-medium">Q{q.index}</span>
                      <Badge variant="outline" className="text-success border-success/30">{q.correctPct.toFixed(0)}% acertos</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-heading flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-destructive" /> Questões Mais Difíceis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {hardest.map(q => (
                    <div key={q.id} className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                      <span className="text-sm font-medium">Q{q.index}</span>
                      <Badge variant="outline" className="text-destructive border-destructive/30">{q.correctPct.toFixed(0)}% acertos</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Classificação de Dificuldade por Questão</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Questão</TableHead>
                      <TableHead className="text-center">Acertos</TableHead>
                      <TableHead className="text-center">Parciais</TableHead>
                      <TableHead className="text-center">Erros</TableHead>
                      <TableHead className="text-center">% Acertos</TableHead>
                      <TableHead className="text-center">Média</TableHead>
                      <TableHead className="text-center">Dificuldade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questionStats.map(q => (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium">Q{q.index}</TableCell>
                        <TableCell className="text-center text-success font-medium">{q.correctCount}</TableCell>
                        <TableCell className="text-center text-warning font-medium">{q.partialCount}</TableCell>
                        <TableCell className="text-center text-destructive font-medium">{q.wrongCount}</TableCell>
                        <TableCell className="text-center">{q.correctPct.toFixed(0)}%</TableCell>
                        <TableCell className="text-center">{q.avgScore.toFixed(1)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={
                            q.difficulty === 'Fácil' ? 'text-success border-success/30' :
                            q.difficulty === 'Médio' ? 'text-warning border-warning/30' :
                            'text-destructive border-destructive/30'
                          }>{q.difficulty}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Button onClick={() => navigate('/dashboard')} variant="outline" className="w-full">Voltar ao Dashboard</Button>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

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
            {stages[stages.indexOf(room.current_stage) + 1] !== 'finished' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Tempo da fase (minutos)
                </Label>
                <Input
                  type="number"
                  value={timerMinutes}
                  onChange={e => setTimerMinutes(e.target.value)}
                  min="1"
                  max="120"
                  placeholder="15"
                />
                <p className="text-xs text-muted-foreground">O professor poderá estender o tempo durante a fase.</p>
              </div>
            )}
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

      {/* Appeal review dialog */}
      <Dialog open={!!reviewingAppeal} onOpenChange={(open) => { if (!open) { setReviewingAppeal(null); setAppealResponse(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {reviewingAppeal?.action === 'accepted' ? 'Aceitar' : 'Rejeitar'} Apelação
            </DialogTitle>
            <DialogDescription>
              {reviewingAppeal?.action === 'accepted'
                ? 'Ao aceitar, a equipe receberá pontuação máxima (4 pontos) nesta questão.'
                : 'Informe o motivo da rejeição (opcional).'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {reviewingAppeal && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-2">
                <p className="font-medium">Equipe: {reviewingAppeal.teams?.name}</p>
                <p>Q{questions.findIndex((q: any) => q.id === reviewingAppeal.question_id) + 1}: {questions.find((q: any) => q.id === reviewingAppeal.question_id)?.question_text?.substring(0, 100)}</p>
                <p className="text-muted-foreground italic">"{reviewingAppeal.justification}"</p>
              </div>
            )}
            <div>
              <Label>Resposta do Professor (opcional)</Label>
              <Textarea
                value={appealResponse}
                onChange={e => setAppealResponse(e.target.value)}
                placeholder="Feedback para a equipe..."
                rows={3}
              />
            </div>
            <Button
              onClick={() => reviewingAppeal && reviewAppeal(reviewingAppeal.id, reviewingAppeal.action)}
              className={`w-full ${reviewingAppeal?.action === 'accepted' ? 'bg-success hover:bg-success/90' : 'bg-destructive hover:bg-destructive/90'}`}
            >
              {reviewingAppeal?.action === 'accepted' ? 'Confirmar Aceitação' : 'Confirmar Rejeição'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
