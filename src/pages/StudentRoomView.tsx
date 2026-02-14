import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Users, Search, UserPlus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import heroTeam from '@/assets/hero-team.png';

type Question = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  sort_order: number;
};

type Room = {
  id: string;
  name: string;
  code: string;
  current_stage: string;
  quiz_id: string | null;
  irat_end_time: string | null;
  show_individual_in_team?: boolean;
};

type TeamMember = {
  team_id: string;
  teams: { name: string };
};

type TratAttempt = {
  id: string;
  question_id: string;
  attempt_number: number;
  selected_option: string;
  is_correct: boolean;
};

type IratPointDistribution = { A: number; B: number; C: number; D: number };

const TRAT_SCORES = [4, 2, 1, 0];

type TratStep = 'team_name' | 'add_members' | 'waiting' | 'answering';

export default function StudentRoomView() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [membership, setMembership] = useState<TeamMember | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [iratDistributions, setIratDistributions] = useState<Record<string, IratPointDistribution>>({});
  const [iratSubmitted, setIratSubmitted] = useState<Set<string>>(new Set());
  const [iratScores, setIratScores] = useState<Record<string, number>>({});
  const [tratAttempts, setTratAttempts] = useState<TratAttempt[]>([]);
  const [tratFeedback, setTratFeedback] = useState<{ correct: boolean; option: string } | null>(null);
  const [appQuestions, setAppQuestions] = useState<any[]>([]);
  const [appResponses, setAppResponses] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [myTeam, setMyTeam] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [allParticipants, setAllParticipants] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  // tRAT step flow
  const [tratStep, setTratStep] = useState<TratStep>('team_name');
  const [newGroupName, setNewGroupName] = useState('');
  const [tratSelectedOption, setTratSelectedOption] = useState<string | null>(null);

  // tRAT score
  const [tratTotalScore, setTratTotalScore] = useState(0);

  // iRAT individual responses for team members (show_individual_in_team)
  const [memberIratResponses, setMemberIratResponses] = useState<any[]>([]);

  const loadRoom = useCallback(async () => {
    const { data } = await supabase.from('rooms').select('*').eq('id', roomId!).single();
    if (data) setRoom(data as any);
  }, [roomId]);

  const loadQuestions = useCallback(async (quizId: string) => {
    const { data } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('sort_order');
    if (data) setQuestions(data as Question[]);
  }, []);

  const loadMembership = useCallback(async () => {
    const { data } = await supabase
      .from('team_members')
      .select('team_id, teams(name)')
      .eq('user_id', user!.id)
      .eq('room_id', roomId!)
      .single();
    if (data) {
      setMembership(data as any);
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id, profiles:user_id(full_name)')
        .eq('team_id', (data as any).team_id);
      setTeamMembers(members || []);
      setMyTeam(data);
    } else {
      setMembership(null);
      setMyTeam(null);
      setTeamMembers([]);
    }
  }, [user, roomId]);

  const loadParticipants = useCallback(async () => {
    const { data } = await supabase
      .from('room_participants')
      .select('user_id, participant_code, profiles:user_id(full_name)')
      .eq('room_id', roomId!);
    setAllParticipants(data || []);
  }, [roomId]);

  const loadIratResponses = useCallback(async () => {
    const { data } = await supabase
      .from('irat_responses')
      .select('question_id, points_a, points_b, points_c, points_d, score')
      .eq('student_id', user!.id)
      .eq('room_id', roomId!);
    if (data) {
      const distMap: Record<string, IratPointDistribution> = {};
      const scoreMap: Record<string, number> = {};
      const submitted = new Set<string>();
      data.forEach((r: any) => {
        distMap[r.question_id] = { A: r.points_a, B: r.points_b, C: r.points_c, D: r.points_d };
        scoreMap[r.question_id] = r.score;
        submitted.add(r.question_id);
      });
      setIratDistributions(distMap);
      setIratScores(scoreMap);
      setIratSubmitted(submitted);
    }
  }, [user, roomId]);

  const loadTratAttempts = useCallback(async () => {
    if (!membership) return;
    const { data } = await supabase
      .from('trat_attempts').select('*')
      .eq('team_id', membership.team_id).eq('room_id', roomId!);
    if (data) {
      setTratAttempts(data as TratAttempt[]);
      const score = data.filter((a: any) => a.is_correct).reduce((sum: number, a: any) => sum + TRAT_SCORES[a.attempt_number - 1], 0);
      setTratTotalScore(score);
    }
  }, [membership, roomId]);

  const loadMemberIratResponses = useCallback(async () => {
    if (!membership || !room?.show_individual_in_team) return;
    const { data: members } = await supabase.from('team_members').select('user_id').eq('team_id', membership.team_id);
    if (!members) return;
    const userIds = members.map((m: any) => m.user_id);
    const { data } = await supabase.from('irat_responses').select('student_id, question_id, selected_option, points_a, points_b, points_c, points_d').eq('room_id', roomId!).in('student_id', userIds);
    setMemberIratResponses(data || []);
  }, [membership, roomId, room?.show_individual_in_team]);

  const loadAppData = useCallback(async () => {
    const [{ data: qs }, { data: rs }] = await Promise.all([
      supabase.from('application_questions').select('*').eq('room_id', roomId!).order('sort_order'),
      membership
        ? supabase.from('application_responses').select('*').eq('team_id', membership.team_id).eq('room_id', roomId!)
        : Promise.resolve({ data: [] }),
    ]);
    setAppQuestions(qs || []);
    const rMap: Record<string, string> = {};
    (rs || []).forEach((r: any) => { rMap[r.question_id] = r.selected_option; });
    setAppResponses(rMap);
  }, [roomId, membership]);

  useEffect(() => { loadRoom(); loadMembership(); loadParticipants(); }, [loadRoom, loadMembership, loadParticipants]);
  useEffect(() => { if (room?.quiz_id && room?.current_stage !== 'waiting') loadQuestions(room.quiz_id); }, [room?.quiz_id, room?.current_stage, loadQuestions]);
  useEffect(() => {
    if (room?.current_stage === 'irat_open') loadIratResponses();
    if (room?.current_stage === 'trat_open') { loadMembership(); loadParticipants(); if (membership) { loadTratAttempts(); loadMemberIratResponses(); } }
    if (room?.current_stage === 'application_open') loadAppData();
  }, [room?.current_stage, membership]);

  // Determine tRAT step based on state
  useEffect(() => {
    if (room?.current_stage !== 'trat_open') return;
    if (!membership) {
      setTratStep('team_name');
    } else {
      // Check if tRAT is actually started (room is trat_open and team exists)
      // If team has attempts, they're answering. Otherwise waiting for teacher.
      setTratStep('add_members');
    }
  }, [membership, room?.current_stage]);

  // Timer
  useEffect(() => {
    if (!room?.irat_end_time || room.current_stage !== 'irat_open') { setTimeLeft(null); return; }
    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((new Date(room.irat_end_time!).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.irat_end_time, room?.current_stage]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => { setRoom(payload.new as any); setCurrentQ(0); setTratFeedback(null); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trat_attempts', filter: `room_id=eq.${roomId}` },
        () => { loadTratAttempts(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_members', filter: `room_id=eq.${roomId}` },
        () => { loadMembership(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, loadTratAttempts, loadMembership]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ===== iRAT =====
  const getIratDist = (qId: string): IratPointDistribution => iratDistributions[qId] || { A: 0, B: 0, C: 0, D: 0 };

  const setIratOptValue = (qId: string, opt: keyof IratPointDistribution, val: number) => {
    const dist = getIratDist(qId);
    const othersTotal = Object.entries(dist).filter(([k]) => k !== opt).reduce((s, [, v]) => s + v, 0);
    if (val + othersTotal > 4) return;
    setIratDistributions(prev => ({ ...prev, [qId]: { ...dist, [opt]: val } }));
  };

  const submitIrat = async (questionId: string, distribution: IratPointDistribution) => {
    if (iratSubmitted.has(questionId)) return;
    const total = distribution.A + distribution.B + distribution.C + distribution.D;
    if (total !== 4) { toast.error('Distribua exatamente 4 pontos'); return; }
    const question = questions.find(q => q.id === questionId);
    const correctOpt = question?.correct_option?.toUpperCase() as keyof IratPointDistribution;
    const score = correctOpt ? distribution[correctOpt] : 0;
    const { error } = await supabase.from('irat_responses').insert({
      student_id: user!.id, question_id: questionId, room_id: roomId!,
      points_a: distribution.A, points_b: distribution.B, points_c: distribution.C, points_d: distribution.D,
      score, is_correct: score > 0,
    });
    if (error) { toast.error('Falha ao enviar'); return; }
    setIratDistributions(prev => ({ ...prev, [questionId]: distribution }));
    setIratScores(prev => ({ ...prev, [questionId]: score }));
    setIratSubmitted(prev => new Set(prev).add(questionId));
    toast.success('Resposta registrada!');
    if (currentQ < questions.length - 1) setTimeout(() => setCurrentQ(prev => prev + 1), 300);
  };

  // ===== tRAT =====
  const submitTrat = async (questionId: string, option: string) => {
    if (!membership) return;
    const question = questions.find(q => q.id === questionId);
    const existingAttempts = tratAttempts.filter(a => a.question_id === questionId);
    if (existingAttempts.some(a => a.is_correct)) return;
    if (existingAttempts.length >= 4) return;
    const attemptNumber = existingAttempts.length + 1;
    const isCorrect = question?.correct_option === option;
    const { error } = await supabase.from('trat_attempts').insert({
      team_id: membership.team_id, question_id: questionId, room_id: roomId!,
      attempt_number: attemptNumber, selected_option: option, is_correct: isCorrect, submitted_by: user!.id,
    });
    if (error) { if (error.code === '23505') toast.error('Opção já tentada'); else toast.error('Falha ao enviar'); return; }
    setTratFeedback({ correct: isCorrect, option });
    setTratSelectedOption(null);
    if (isCorrect) {
      toast.success(`Correto! ${TRAT_SCORES[attemptNumber - 1]} pontos!`);
      setTimeout(() => { setTratFeedback(null); }, 1500);
    } else {
      toast.error(`Errado! ${4 - attemptNumber} tentativas restantes`);
      setTimeout(() => setTratFeedback(null), 1000);
    }
    loadTratAttempts();
  };

  const submitApp = async (questionId: string, option: string) => {
    if (!membership) return;
    const { error } = await supabase.from('application_responses').upsert({
      question_id: questionId, team_id: membership.team_id, room_id: roomId!, selected_option: option, submitted_by: user!.id,
    });
    if (error) { toast.error('Falha ao enviar'); return; }
    setAppResponses(prev => ({ ...prev, [questionId]: option }));
    toast.success('Resposta enviada!');
  };

  // Group formation
  const createGroup = async () => {
    if (!newGroupName.trim()) { toast.error('Informe o nome da equipe'); return; }
    const { data: team, error: teamError } = await supabase.from('teams').insert({ room_id: roomId!, name: newGroupName.trim() }).select().single();
    if (teamError) { toast.error('Falha ao criar equipe'); return; }
    const { error: memberError } = await supabase.from('team_members').insert({ team_id: team.id, user_id: user!.id, room_id: roomId! });
    if (memberError) {
      if (memberError.code === '23505') { toast.error('Você já está em uma equipe'); await supabase.from('teams').delete().eq('id', team.id); }
      else toast.error('Falha ao entrar na equipe');
      return;
    }
    setNewGroupName('');
    toast.success('Equipe criada!');
    loadMembership();
  };

  const searchParticipants = async () => {
    const { data: allTeamMembers } = await supabase.from('team_members').select('user_id').eq('room_id', roomId!);
    const groupedIds = new Set((allTeamMembers || []).map((m: any) => m.user_id));
    const results = allParticipants.filter((p: any) => {
      if (groupedIds.has(p.user_id)) return false;
      if (!searchQuery.trim()) return true;
      const name = (p.profiles?.full_name || '').toLowerCase();
      return name.includes(searchQuery.toLowerCase()) || (p.participant_code || '').includes(searchQuery);
    });
    setSearchResults(results);
  };

  const addMemberToTeam = async (participantUserId: string) => {
    if (!membership) return;
    const { error } = await supabase.from('team_members').insert({ team_id: membership.team_id, user_id: participantUserId, room_id: roomId! });
    if (error) { if (error.code === '23505') toast.error('Aluno já está em uma equipe'); else toast.error('Falha ao adicionar'); return; }
    toast.success('Membro adicionado!');
    setSearchQuery('');
    setSearchResults([]);
    loadMembership();
    loadParticipants();
  };

  const removeMember = async (userId: string) => {
    if (!membership || userId === user!.id) return;
    await supabase.from('team_members').delete().eq('team_id', membership.team_id).eq('user_id', userId);
    toast.success('Membro removido');
    loadMembership();
  };

  if (!room) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;

  const allIratAnswered = questions.length > 0 && iratSubmitted.size >= questions.length;

  // ===== RENDER: WAITING =====
  const renderWaiting = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary-foreground" />
        </div>
        <span className="text-2xl font-heading font-bold tracking-tight text-primary">TBL Active</span>
      </div>
      <p className="text-lg text-muted-foreground">Aguarde a liberação do professor para início da Aplicação.</p>
      <div className="flex gap-3 mt-8">
        {[0, 1, 2, 3, 4].map(i => (
          <motion.div
            key={i}
            className="w-8 h-8 rounded-full"
            style={{ backgroundColor: `hsl(${30 + i * 15}, ${80 - i * 5}%, ${60 + i * 5}%)` }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );

  // ===== RENDER: iRAT with dropdowns =====
  const renderIrat = () => {
    if (allIratAnswered) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-heading font-bold tracking-tight text-primary">TBL Active</span>
          </div>
          <p className="text-lg text-primary font-semibold">Aplicação individual concluída com sucesso!</p>
          <p className="text-muted-foreground">Aguarde orientações do professor, permaneça na tela.</p>
          <div className="border rounded-xl p-6 mt-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
            // When tRAT is open, this would navigate. For now it's just visual.
          }}>
            <img src={heroTeam} alt="Equipe" className="w-48 h-auto mx-auto" />
            <p className="text-primary font-medium mt-2">Iniciar aplicação em equipe</p>
          </div>
        </div>
      );
    }

    if (questions.length === 0) return <p className="text-center text-muted-foreground py-8">Nenhuma questão carregada.</p>;
    const q = questions[currentQ];
    const submitted = iratSubmitted.has(q.id);
    const dist = getIratDist(q.id);
    const total = dist.A + dist.B + dist.C + dist.D;

    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-lg font-heading font-bold text-primary">TBL Active</span>
          </div>
          <p className="text-lg">
            Você está na sala de número <Badge variant="outline" className="text-primary font-bold text-base ml-1">{room.code}</Badge>
          </p>
          <p className="text-sm text-muted-foreground">Estudante Conectado: {profile?.full_name}</p>
        </div>

        {timeLeft !== null && (
          <Card className={timeLeft <= 60 ? 'border-destructive' : ''}>
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${timeLeft <= 60 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
                <span className="text-sm">Tempo restante</span>
              </div>
              <span className={`font-mono text-xl font-bold ${timeLeft <= 60 ? 'text-destructive' : ''}`}>{formatTime(timeLeft)}</span>
            </CardContent>
          </Card>
        )}

        {submitted ? (
          <Card>
            <CardContent className="py-8 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success" />
              <p className="font-medium">Resposta salva!</p>
              <div className="flex justify-center gap-3">
                {(['A', 'B', 'C', 'D'] as const).map(opt => (
                  <div key={opt} className="text-center">
                    <span className="text-xs text-muted-foreground">{opt}</span>
                    <p className="font-bold">{iratDistributions[q.id]?.[opt] ?? 0}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-center mt-4">
                {currentQ > 0 && <Button variant="outline" size="sm" onClick={() => setCurrentQ(p => p - 1)}>Anterior</Button>}
                {currentQ < questions.length - 1 && <Button size="sm" onClick={() => setCurrentQ(p => p + 1)}>Próxima</Button>}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="bg-muted py-3 text-center border-b">
              <p className="font-heading font-semibold">Questão Nº {currentQ + 1}</p>
            </div>
            <CardContent className="pt-6 space-y-5">
              <p className="text-base leading-relaxed">{q.question_text}</p>
              <div className="space-y-4">
                {(['A', 'B', 'C', 'D'] as const).map(opt => (
                  <div key={opt} className="flex items-center gap-3">
                    <Select
                      value={String(dist[opt])}
                      onValueChange={(val) => setIratOptValue(q.id, opt, parseInt(val))}
                    >
                      <SelectTrigger className="w-16 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4].map(v => (
                          <SelectItem key={v} value={String(v)}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="font-semibold text-sm">{opt})</span>
                    <span className="text-sm flex-1">{q[`option_${opt.toLowerCase()}` as keyof Question] as string}</span>
                  </div>
                ))}
              </div>
              <Button
                className="w-full py-5 text-base"
                disabled={total !== 4}
                onClick={() => submitIrat(q.id, dist)}
              >
                Salvar
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center gap-1.5 pt-2">
          {questions.map((_, i) => (
            <button key={i} onClick={() => setCurrentQ(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === currentQ ? 'bg-primary scale-125' : iratSubmitted.has(questions[i].id) ? 'bg-success' : 'bg-border'
              }`} />
          ))}
        </div>
      </div>
    );
  };

  // ===== RENDER: tRAT =====
  const renderTrat = () => {
    // Step 1: Create team (enter team name)
    if (!membership) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-heading font-bold tracking-tight text-primary">TBL Active</span>
          </div>
          <div className="w-full max-w-md bg-card rounded-2xl border shadow-lg p-8 space-y-5">
            <p className="text-center text-muted-foreground">
              Você está na sala de nº <span className="text-primary font-bold text-lg">{room.code}</span>
            </p>
            <div className="space-y-2 text-left">
              <Label className="font-semibold">Nome da equipe</Label>
              <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Nome Equipe" />
            </div>
            <Button onClick={createGroup} className="w-full py-5 text-base">Entrar</Button>
          </div>
        </div>
      );
    }

    // Step 2: Add members
    if (tratStep === 'add_members' || tratStep === 'team_name') {
      // Check if team has started answering (has tRAT attempts)
      const hasStarted = tratAttempts.length > 0;
      if (hasStarted) {
        // Go to answering
        return renderTratAnswering();
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-heading font-bold tracking-tight text-primary">TBL Active</span>
          </div>
          <div className="w-full max-w-md bg-card rounded-2xl border shadow-lg p-8 space-y-5">
            <p className="text-center text-muted-foreground">
              Você está na sala de nº <span className="text-primary font-bold text-lg">{room.code}</span>
            </p>
            <div className="space-y-2 text-left">
              <Label className="font-semibold">Informe os membros da equipe:</Label>
              <div className="flex gap-2">
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Registro Acadêmico ou CPF ou RG" className="flex-1" />
                <Button size="icon" variant="outline" onClick={() => setAddMemberOpen(true)}>
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Button onClick={() => { searchParticipants(); setAddMemberOpen(true); }} className="w-full py-4">
              <Search className="w-4 h-4 mr-2" /> Localizar Estudante
            </Button>

            {/* Team members table */}
            {teamMembers.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número de Registro</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Excluir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((m: any) => {
                    const participant = allParticipants.find((p: any) => p.user_id === m.user_id);
                    return (
                      <TableRow key={m.user_id}>
                        <TableCell className="font-mono">{participant?.participant_code || '—'}</TableCell>
                        <TableCell>{m.profiles?.full_name || 'Aluno'}</TableCell>
                        <TableCell className="text-right">
                          {m.user_id !== user!.id && (
                            <Button size="icon" variant="ghost" onClick={() => removeMember(m.user_id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            <Button onClick={() => setTratStep('waiting')} className="w-full py-5 text-base" disabled={teamMembers.length === 0}>
              Iniciar Aplicação Em Equipe
            </Button>
          </div>

          {/* Search dialog */}
          <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Localizar Estudantes na sala</DialogTitle>
                <DialogDescription>Selecione os alunos para adicionar à equipe.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº de Registro</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-destructive/70">Registro de Aluno não encontrado!</TableCell>
                      </TableRow>
                    ) : (
                      searchResults.map((p: any) => (
                        <TableRow key={p.user_id}>
                          <TableCell className="font-mono">{p.participant_code}</TableCell>
                          <TableCell>{p.profiles?.full_name || 'Aluno'}</TableCell>
                          <TableCell>
                            <Button size="sm" onClick={() => { addMemberToTeam(p.user_id); searchParticipants(); }}>
                              Selecionar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Fechar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    // Step 3: Waiting for teacher
    if (tratStep === 'waiting') {
      // Check if tRAT has started via room stage (it's already trat_open, so the waiting is for the "team ready" state)
      // Actually the teacher just clicks "Iniciar Aplicação" again to start. We wait until teacher starts.
      // For now, go straight to answering since trat_open means it's already started.
      return renderTratAnswering();
    }

    return renderTratAnswering();
  };

  // ===== RENDER: tRAT ANSWERING (IF-AT) =====
  const renderTratAnswering = () => {
    if (questions.length === 0) return <p className="text-center text-muted-foreground py-8">Nenhuma questão carregada.</p>;

    const allTratDone = questions.every(q => {
      const qA = tratAttempts.filter(a => a.question_id === q.id);
      return qA.some(a => a.is_correct) || qA.length >= 4;
    });

    if (allTratDone) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-success" />
          <h2 className="text-2xl font-heading font-bold">Aplicação em equipe concluída!</h2>
          <p className="text-muted-foreground">Pontuação da equipe: <span className="font-bold text-2xl text-primary">{tratTotalScore}</span></p>
          <p className="text-sm text-muted-foreground">Aguarde orientações do professor.</p>
        </div>
      );
    }

    const q = questions[currentQ];
    const qAttempts = tratAttempts.filter(a => a.question_id === q.id);
    const isCorrect = qAttempts.some(a => a.is_correct);
    const disabledOpts = new Set(qAttempts.map(a => a.selected_option));
    const attemptsLeft = 4 - qAttempts.length;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-lg">
            Você está na sala de número <span className="text-primary font-bold">{room.code}</span>
          </p>
          <p className="text-sm text-muted-foreground">Equipe Conectada: {membership?.teams.name}</p>
        </div>

        {/* Score + members + responses bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Pontuação:</span>
            <Badge variant="outline" className="text-lg font-bold">{tratTotalScore}</Badge>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <Users className="w-4 h-4" /> membros
            </button>
            {room.show_individual_in_team && (
              <span className="text-xs text-muted-foreground">respostas + marcadas pelos membros</span>
            )}
          </div>
        </div>

        {isCorrect ? (
          <Card>
            <CardContent className="py-8 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-success" />
              <p className="text-lg font-heading font-bold">Correto!</p>
              <p className="text-2xl font-bold text-success">{TRAT_SCORES[qAttempts.findIndex(a => a.is_correct)]} pontos</p>
              <div className="flex gap-2 justify-center mt-4">
                {currentQ < questions.length - 1 && (
                  <Button onClick={() => { setCurrentQ(p => p + 1); setTratSelectedOption(null); }}>Avançar</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : qAttempts.length >= 4 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <XCircle className="w-12 h-12 mx-auto mb-2 text-destructive" />
              <p className="text-lg font-heading font-bold">Sem mais tentativas</p>
              <p className="text-sm text-muted-foreground">0 pontos</p>
              <div className="flex gap-2 justify-center mt-4">
                {currentQ < questions.length - 1 && (
                  <Button onClick={() => { setCurrentQ(p => p + 1); setTratSelectedOption(null); }}>Avançar</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="bg-muted py-3 text-center border-b">
              <p className="font-heading font-semibold">Questão Nº {currentQ + 1}</p>
            </div>
            <CardContent className="pt-6 space-y-5">
              <p className="text-base leading-relaxed">{q.question_text}</p>
              <div className="space-y-3">
                {(['A', 'B', 'C', 'D'] as const).map(opt => {
                  const isDisabled = disabledOpts.has(opt);
                  const isSelected = tratSelectedOption === opt;
                  return (
                    <button key={opt} onClick={() => !isDisabled && setTratSelectedOption(opt)} disabled={isDisabled}
                      className={`w-full text-left p-4 rounded-lg border-2 flex items-center gap-3 transition-all ${
                        isDisabled ? 'border-border opacity-40 cursor-not-allowed' :
                        isSelected ? 'border-primary bg-primary/5' :
                        'border-border hover:border-primary/50 hover:bg-primary/5'
                      }`}>
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-primary bg-primary/10' : 'border-muted-foreground/30'
                      }`}>
                        {isSelected && <div className="w-4 h-4 rounded-full bg-primary" />}
                      </div>
                      <span className="font-semibold mr-2">{opt})</span>
                      <span className="text-sm flex-1">{q[`option_${opt.toLowerCase()}` as keyof Question] as string}</span>
                    </button>
                  );
                })}
              </div>
              <Button
                className="w-full py-5 text-base"
                disabled={!tratSelectedOption}
                onClick={() => tratSelectedOption && submitTrat(q.id, tratSelectedOption)}
              >
                Salvar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Feedback overlay */}
        {tratFeedback && (
          <div className="fixed inset-0 flex items-center justify-center bg-background/80 z-50 animate-in fade-in">
            <div className={`text-center p-8 rounded-2xl ${tratFeedback.correct ? 'bg-success/10' : 'bg-destructive/10'}`}>
              {tratFeedback.correct ? <CheckCircle2 className="w-20 h-20 mx-auto text-success" /> : <XCircle className="w-20 h-20 mx-auto text-destructive" />}
              <p className="text-2xl font-heading font-bold mt-3">{tratFeedback.correct ? 'Correto!' : 'Errado!'}</p>
            </div>
          </div>
        )}

        {/* Question dots */}
        <div className="flex justify-center gap-1.5 pt-2">
          {questions.map((q, i) => {
            const qA = tratAttempts.filter(a => a.question_id === q.id);
            const done = qA.some(a => a.is_correct) || qA.length >= 4;
            return (
              <button key={i} onClick={() => { setCurrentQ(i); setTratFeedback(null); setTratSelectedOption(null); }}
                className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentQ ? 'bg-primary scale-125' : done ? 'bg-success' : 'bg-border'}`} />
            );
          })}
        </div>
      </div>
    );
  };

  const renderApplication = () => (
    <div className="space-y-4">
      <Badge className="phase-app">Exercício de Aplicação</Badge>
      {!membership ? (
        <p className="text-center text-muted-foreground py-8">Você precisa estar em um grupo.</p>
      ) : appQuestions.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhuma questão de aplicação ainda.</p>
      ) : (
        appQuestions.map((q, i) => (
          <Card key={q.id}>
            <CardContent className="pt-4 space-y-3">
              <p className="font-medium">Q{i + 1}. {q.question_text}</p>
              <div className="space-y-2">
                {(['A', 'B', 'C', 'D'] as const).map(opt => {
                  const text = q[`option_${opt.toLowerCase()}`];
                  if (!text) return null;
                  const isSelected = appResponses[q.id] === opt;
                  return (
                    <button key={opt} onClick={() => submitApp(q.id, opt)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}>
                      <span className="font-semibold mr-2">{opt}.</span>{text}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const renderFinished = () => (
    <div className="text-center py-16 space-y-4">
      <CheckCircle2 className="w-16 h-16 mx-auto text-success" />
      <h2 className="text-2xl font-heading font-bold">Sessão Encerrada!</h2>
      <p className="text-muted-foreground">Obrigado por participar.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {room.current_stage !== 'waiting' && room.current_stage !== 'irat_open' && room.current_stage !== 'trat_open' && (
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-heading font-bold">{room.name}</h1>
            </div>
          </div>
        </header>
      )}
      <main className="container mx-auto px-4 py-6 max-w-lg">
        {room.current_stage === 'waiting' && renderWaiting()}
        {room.current_stage === 'irat_open' && renderIrat()}
        {room.current_stage === 'trat_open' && renderTrat()}
        {room.current_stage === 'application_open' && renderApplication()}
        {room.current_stage === 'finished' && renderFinished()}
      </main>
    </div>
  );
}
