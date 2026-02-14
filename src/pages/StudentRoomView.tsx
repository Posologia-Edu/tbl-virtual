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
import { ArrowLeft, CheckCircle2, XCircle, Clock, Users, Plus, Search, UserPlus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';

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
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [myTeam, setMyTeam] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [allParticipants, setAllParticipants] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  // All the data loading callbacks (same as before)
  const loadRoom = useCallback(async () => {
    const { data } = await supabase.from('rooms').select('*').eq('id', roomId!).single();
    if (data) setRoom(data as Room);
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
    if (data) setTratAttempts(data as TratAttempt[]);
  }, [membership, roomId]);

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
    if (room?.current_stage === 'trat_open') { loadMembership(); loadParticipants(); if (membership) loadTratAttempts(); }
    if (room?.current_stage === 'application_open') loadAppData();
  }, [room?.current_stage, membership]);

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
        (payload) => { setRoom(payload.new as Room); setCurrentQ(0); setTratFeedback(null); })
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
    if (isCorrect) {
      toast.success(`Correto! ${TRAT_SCORES[attemptNumber - 1]} pontos!`);
      setTimeout(() => { setTratFeedback(null); if (currentQ < questions.length - 1) setCurrentQ(p => p + 1); }, 1500);
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
    if (!newGroupName.trim()) { toast.error('Informe o nome do grupo'); return; }
    const { data: team, error: teamError } = await supabase.from('teams').insert({ room_id: roomId!, name: newGroupName.trim() }).select().single();
    if (teamError) { toast.error('Falha ao criar grupo'); return; }
    const { error: memberError } = await supabase.from('team_members').insert({ team_id: team.id, user_id: user!.id, room_id: roomId! });
    if (memberError) {
      if (memberError.code === '23505') { toast.error('Você já está em um grupo'); await supabase.from('teams').delete().eq('id', team.id); }
      else toast.error('Falha ao entrar no grupo');
      return;
    }
    setCreateGroupOpen(false); setNewGroupName(''); toast.success('Grupo criado!'); loadMembership();
  };

  const searchParticipants = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); return; }
    const { data: allTeamMembers } = await supabase.from('team_members').select('user_id').eq('room_id', roomId!);
    const groupedIds = new Set((allTeamMembers || []).map((m: any) => m.user_id));
    const results = allParticipants.filter((p: any) => {
      if (groupedIds.has(p.user_id)) return false;
      const name = (p.profiles?.full_name || '').toLowerCase();
      return name.includes(query.toLowerCase()) || (p.participant_code || '').includes(query);
    });
    setSearchResults(results);
  };

  const addMemberToTeam = async (participantUserId: string) => {
    if (!membership) return;
    const { error } = await supabase.from('team_members').insert({ team_id: membership.team_id, user_id: participantUserId, room_id: roomId! });
    if (error) { if (error.code === '23505') toast.error('Aluno já está em um grupo'); else toast.error('Falha ao adicionar'); return; }
    toast.success('Membro adicionado!'); setSearchQuery(''); setSearchResults([]); loadMembership(); loadParticipants();
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
      {/* Animated dots */}
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
          <p className="text-lg text-muted-foreground">Aplicação individual concluída com sucesso!</p>
          <p className="text-muted-foreground">Aguarde orientações do professor, permaneça na tela.</p>
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
        {/* Logo + room info */}
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

        {/* Timer */}
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

        {/* Question dots */}
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

  // ===== RENDER: Group formation =====
  const renderGroupFormation = () => (
    <div className="space-y-4">
      <Badge className="phase-trat">tRAT - Formação de Grupos</Badge>
      <p className="text-sm text-muted-foreground">Forme seu grupo antes de começar o teste em equipe.</p>
      {!membership ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-8 text-center space-y-4">
              <Users className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="font-medium">Você ainda não está em um grupo</p>
              <Button onClick={() => setCreateGroupOpen(true)}><Plus className="w-4 h-4 mr-1" /> Criar Grupo</Button>
            </CardContent>
          </Card>
          <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Grupo</DialogTitle>
                <DialogDescription>Dê um nome ao seu grupo.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div><Label>Nome do Grupo</Label><Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Ex: Equipe Alpha" /></div>
                <Button onClick={createGroup} className="w-full">Criar Grupo</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-semibold">{membership.teams.name}</h3>
                <Badge variant="outline">{teamMembers.length} membro(s)</Badge>
              </div>
              <div className="space-y-2">
                {teamMembers.map((m: any) => (
                  <div key={m.user_id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{(m.profiles?.full_name || 'A')[0].toUpperCase()}</span>
                    </div>
                    <span className="text-sm font-medium">{m.profiles?.full_name || 'Aluno'}</span>
                    {m.user_id === user!.id && <Badge variant="outline" className="text-xs ml-auto">Você</Badge>}
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => setAddMemberOpen(true)}>
                <UserPlus className="w-3 h-3 mr-1" /> Adicionar Membro
              </Button>
            </CardContent>
          </Card>
          <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Membro</DialogTitle>
                <DialogDescription>Busque pelo nome ou código.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={searchQuery} onChange={e => searchParticipants(e.target.value)} placeholder="Nome ou código" className="pl-9" />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {searchResults.length === 0 && searchQuery.trim() && <p className="text-sm text-muted-foreground text-center py-4">Nenhum participante encontrado</p>}
                  {searchResults.map((p: any) => (
                    <button key={p.user_id} onClick={() => addMemberToTeam(p.user_id)}
                      className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{p.profiles?.full_name || 'Aluno'}</p>
                        <p className="text-xs text-muted-foreground font-mono">#{p.participant_code}</p>
                      </div>
                      <UserPlus className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );

  // ===== RENDER: tRAT =====
  const renderTrat = () => {
    if (!membership) return renderGroupFormation();
    if (questions.length === 0) return <p className="text-center text-muted-foreground py-8">Nenhuma questão carregada.</p>;
    const q = questions[currentQ];
    const qAttempts = tratAttempts.filter(a => a.question_id === q.id);
    const isCorrect = qAttempts.some(a => a.is_correct);
    const disabledOpts = new Set(qAttempts.map(a => a.selected_option));

    const renderQuestion = (q: Question) => (
      <Card key={q.id} className="overflow-hidden">
        <CardContent className="pt-6 space-y-4">
          <p className="font-medium text-lg leading-relaxed">
            <span className="text-muted-foreground mr-2">Q{currentQ + 1}/{questions.length}</span>
            {q.question_text}
          </p>
          <div className="space-y-2">
            {(['A', 'B', 'C', 'D'] as const).map(opt => {
              const isSelected = false;
              const isDisabled = disabledOpts.has(opt);
              return (
                <button key={opt} onClick={() => !isDisabled && submitTrat(q.id, opt)} disabled={isDisabled}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    isDisabled ? 'border-border opacity-40 line-through' : 'border-border hover:border-primary/50 hover:bg-primary/5'
                  }`}>
                  <span className="font-semibold mr-3">{opt}.</span>
                  {q[`option_${opt.toLowerCase()}` as keyof Question] as string}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge className="phase-trat">tRAT - Equipe</Badge>
          <span className="text-sm text-muted-foreground">{membership?.teams.name}</span>
        </div>
        {isCorrect ? (
          <Card>
            <CardContent className="py-8 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-success" />
              <p className="text-lg font-heading font-bold">Correto!</p>
              <p className="text-2xl font-bold text-success">{TRAT_SCORES[qAttempts.findIndex(a => a.is_correct)]} pontos</p>
              <div className="flex gap-2 justify-center mt-4">
                {currentQ < questions.length - 1 && <Button size="sm" onClick={() => setCurrentQ(p => p + 1)}>Próxima Questão</Button>}
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
                {currentQ < questions.length - 1 && <Button size="sm" onClick={() => setCurrentQ(p => p + 1)}>Próxima Questão</Button>}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className={`flex-1 h-2 rounded-full ${n <= qAttempts.length ? 'bg-destructive' : 'bg-border'}`} />
              ))}
            </div>
            <p className="text-sm text-center text-muted-foreground">Tentativa {qAttempts.length + 1}/4 • {TRAT_SCORES[qAttempts.length]} pontos se acertar</p>
            {renderQuestion(q)}
          </>
        )}
        {tratFeedback && (
          <div className="fixed inset-0 flex items-center justify-center bg-background/80 z-50 animate-in fade-in">
            <div className={`text-center p-8 rounded-2xl ${tratFeedback.correct ? 'bg-success/10' : 'bg-destructive/10'}`}>
              {tratFeedback.correct ? <CheckCircle2 className="w-20 h-20 mx-auto text-success" /> : <XCircle className="w-20 h-20 mx-auto text-destructive" />}
              <p className="text-2xl font-heading font-bold mt-3">{tratFeedback.correct ? 'Correto!' : 'Errado!'}</p>
            </div>
          </div>
        )}
        <div className="flex justify-center gap-1.5 pt-2">
          {questions.map((q, i) => {
            const qA = tratAttempts.filter(a => a.question_id === q.id);
            const done = qA.some(a => a.is_correct) || qA.length >= 4;
            return (
              <button key={i} onClick={() => { setCurrentQ(i); setTratFeedback(null); }}
                className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentQ ? 'bg-phase-trat scale-125' : done ? 'bg-success' : 'bg-border'}`} />
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
                        isSelected ? 'border-phase-app bg-phase-app-light' : 'border-border hover:border-phase-app/50'
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
      {room.current_stage !== 'waiting' && room.current_stage !== 'irat_open' && (
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
