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
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Users, Search, UserPlus, Trash2, Zap, BookOpen, UsersRound, MessageSquarePlus, Send } from 'lucide-react';
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
  show_individual_in_team?: boolean;
};

type TeamMember = {
  team_id: string;
  teams: { name: string; trat_started_at?: string | null };
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

// ===== Creative Waiting Animation =====
const WaitingAnimation = () => (
  <div className="flex flex-col items-center gap-6">
    <div className="relative w-28 h-28">
      {/* Orbiting rings */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={`ring-${i}`}
          className="absolute rounded-full border-2"
          style={{
            width: `${50 + i * 26}px`,
            height: `${50 + i * 26}px`,
            left: `${14 - i * 13}px`,
            top: `${14 - i * 13}px`,
            borderColor: `hsl(var(--primary) / ${0.15 + i * 0.1})`,
          }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 4 + i * 2, repeat: Infinity, ease: 'linear' }}
        />
      ))}
      {/* Orbiting dots */}
      {[0, 1, 2, 3, 4, 5].map(i => {
        const angle = (i * 60 * Math.PI) / 180;
        const radius = 42;
        return (
          <motion.div
            key={`dot-${i}`}
            className="absolute w-2.5 h-2.5 rounded-full bg-primary"
            style={{ left: 'calc(50% - 5px)', top: 'calc(50% - 5px)' }}
            animate={{
              x: [Math.cos(angle) * radius, Math.cos(angle + Math.PI) * radius, Math.cos(angle + Math.PI * 2) * radius],
              y: [Math.sin(angle) * radius, Math.sin(angle + Math.PI) * radius, Math.sin(angle + Math.PI * 2) * radius],
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{ duration: 4, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
          />
        );
      })}
      {/* Central pulse */}
      <motion.div
        className="absolute w-6 h-6 rounded-full bg-primary/40"
        style={{ left: 'calc(50% - 12px)', top: 'calc(50% - 12px)' }}
        animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
    {/* Wave bars */}
    <div className="flex items-center gap-1">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={`bar-${i}`}
          className="w-1 rounded-full bg-primary/60"
          animate={{ height: ['6px', '24px', '6px'] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.06, ease: 'easeInOut' }}
        />
      ))}
    </div>
  </div>
);

const TBLVirtualLogo = () => (
  <div className="flex items-center gap-2.5">
    <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
      <Zap className="w-6 h-6 text-primary-foreground" />
    </div>
    <span className="text-2xl font-heading font-bold tracking-tight text-primary">TBL Virtual</span>
  </div>
);

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
  const [tratFeedback, setTratFeedback] = useState<{ correct: boolean; option: string; points: number } | null>(null);
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
  const [tratReady, setTratReady] = useState(false); // Whether student clicked "Iniciar aplicação em equipe"

  // tRAT score
  const [tratTotalScore, setTratTotalScore] = useState(0);

  // tRAT timer (20 min)
  const [tratStartedAt, setTratStartedAt] = useState<string | null>(null);
  const [tratTimeLeft, setTratTimeLeft] = useState<number | null>(null);
  const TRAT_DURATION = 20 * 60; // 20 minutes in seconds

  // iRAT individual responses for team members (show_individual_in_team)
  const [memberIratResponses, setMemberIratResponses] = useState<any[]>([]);

  // Appeals
  const [appeals, setAppeals] = useState<any[]>([]);
  const [appealQuestion, setAppealQuestion] = useState<string | null>(null);
  const [appealJustification, setAppealJustification] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  // Application phase
  const [appCurrentQ, setAppCurrentQ] = useState(0);
  const [appWaiting, setAppWaiting] = useState(true);
  const [isTeamLeader, setIsTeamLeader] = useState(false);

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
      .select('team_id, teams(name, trat_started_at)')
      .eq('user_id', user!.id)
      .eq('room_id', roomId!)
      .single();
    if (data) {
      setMembership(data as any);
      const teamData = (data as any).teams;
      if (teamData?.trat_started_at) {
        setTratStartedAt(teamData.trat_started_at);
      }
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id, joined_at, profiles:user_id(full_name)')
        .eq('team_id', (data as any).team_id)
        .order('joined_at', { ascending: true });
      setTeamMembers(members || []);
      setMyTeam(data);
      // Leader is the first member (earliest joined_at)
      if (members && members.length > 0) {
        setIsTeamLeader(members[0].user_id === user!.id);
      }
    } else {
      setMembership(null);
      setMyTeam(null);
      setTeamMembers([]);
      setIsTeamLeader(false);
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
    if (rs && rs.length > 0) setAppWaiting(false);
  }, [roomId, membership]);

  const loadAppeals = useCallback(async () => {
    if (!membership) return;
    const { data } = await supabase
      .from('appeals')
      .select('*')
      .eq('team_id', membership.team_id)
      .eq('room_id', roomId!);
    setAppeals(data || []);
  }, [membership, roomId]);

  useEffect(() => { loadRoom(); loadMembership(); loadParticipants(); }, [loadRoom, loadMembership, loadParticipants]);
  useEffect(() => { if (room?.quiz_id && room?.current_stage !== 'waiting') loadQuestions(room.quiz_id); }, [room?.quiz_id, room?.current_stage, loadQuestions]);
  useEffect(() => {
    if (room?.current_stage === 'irat_open') loadIratResponses();
    if (room?.current_stage === 'trat_open') { loadMembership(); loadParticipants(); if (membership) { loadTratAttempts(); loadMemberIratResponses(); loadAppeals(); } }
    if (room?.current_stage === 'application_open') { loadMembership(); loadAppData(); }
  }, [room?.current_stage, membership]);

  // Determine tRAT step based on state
  useEffect(() => {
    if (room?.current_stage !== 'trat_open') return;
    if (!membership) {
      setTratStep('team_name');
    } else {
      setTratStep('add_members');
    }
  }, [membership, room?.current_stage]);

  // tRAT Timer (20 minutes from trat_started_at)
  useEffect(() => {
    if (!tratStartedAt || room?.current_stage !== 'trat_open') { setTratTimeLeft(null); return; }
    const updateTimer = () => {
      const startTime = new Date(tratStartedAt).getTime();
      const endTime = startTime + TRAT_DURATION * 1000;
      const diff = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTratTimeLeft(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [tratStartedAt, room?.current_stage]);

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
        (payload) => { setRoom(payload.new as any); setCurrentQ(0); setTratFeedback(null); setAppCurrentQ(0); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trat_attempts', filter: `room_id=eq.${roomId}` },
        () => { loadTratAttempts(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_members', filter: `room_id=eq.${roomId}` },
        () => { loadMembership(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams', filter: `room_id=eq.${roomId}` },
        () => { loadMembership(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'application_questions', filter: `room_id=eq.${roomId}` },
        () => { loadAppData(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        () => { loadParticipants(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appeals', filter: `room_id=eq.${roomId}` },
        () => { loadAppeals(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, loadTratAttempts, loadMembership, loadAppData, loadParticipants]);

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
    const points = isCorrect ? TRAT_SCORES[attemptNumber - 1] : 0;
    setTratFeedback({ correct: isCorrect, option, points });
    setTratSelectedOption(null);
    loadTratAttempts();
  };

  const submitAppeal = async (questionId: string) => {
    if (!membership || !appealJustification.trim()) return;
    setSubmittingAppeal(true);
    const { error } = await supabase.from('appeals').insert({
      room_id: roomId!, team_id: membership.team_id, question_id: questionId,
      justification: appealJustification.trim(), submitted_by: user!.id,
    });
    setSubmittingAppeal(false);
    if (error) {
      if (error.code === '23505') toast.error('Apelação já enviada para esta questão');
      else toast.error('Falha ao enviar apelação');
      return;
    }
    toast.success('Apelação enviada com sucesso!');
    setAppealJustification('');
    setAppealQuestion(null);
    loadAppeals();
  };

  const submitApp = async (questionId: string, option: string) => {
    if (!membership) return;
    const { error } = await supabase.from('application_responses').upsert({
      question_id: questionId, team_id: membership.team_id, room_id: roomId!, selected_option: option, submitted_by: user!.id,
    });
    if (error) { toast.error('Falha ao enviar'); return; }
    setAppResponses(prev => ({ ...prev, [questionId]: option }));
    toast.success('Resposta enviada!');
    if (appCurrentQ < appQuestions.length - 1) {
      setTimeout(() => setAppCurrentQ(prev => prev + 1), 500);
    }
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
      <TBLVirtualLogo />
      <p className="text-lg text-muted-foreground">Aguarde a liberação do professor para início da Aplicação.</p>
      <WaitingAnimation />
    </div>
  );

  // ===== RENDER: iRAT with dropdowns =====
  const renderIrat = () => {
    if (allIratAnswered) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <TBLVirtualLogo />
          <p className="text-lg text-primary font-semibold">Aplicação individual concluída com sucesso!</p>
          <p className="text-muted-foreground">Aguarde orientações do professor, permaneça na tela.</p>
          <WaitingAnimation />
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
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-lg font-heading font-bold text-primary">TBL Virtual</span>
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
    // If student was added to a team by someone else (via realtime), check if tRAT started
    if (membership) {
      // If trat_started_at is set (leader started), all members see questions
      const hasStarted = !!tratStartedAt || tratAttempts.length > 0 || tratStep === 'answering';
      
      // Check if timer expired
      if (hasStarted && tratTimeLeft !== null && tratTimeLeft <= 0) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
            <TBLVirtualLogo />
            <Card className="w-full max-w-md">
              <CardContent className="pt-6 pb-6 space-y-4 text-center">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground" />
                <h3 className="text-lg font-heading font-bold">Tempo Esgotado!</h3>
                <p className="text-sm text-muted-foreground">
                  O tempo para o tRAT foi encerrado. Aguarde o professor iniciar a próxima etapa.
                </p>
                <WaitingAnimation />
              </CardContent>
            </Card>
          </div>
        );
      }
      
      if (hasStarted) return renderTratAnswering();

      // Show add members UI only if this student created the team (tratReady)
      if (tratReady) {
        return renderTratAddMembers();
      }

      // Student was added by someone else - show waiting for team leader
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <TBLVirtualLogo />
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 pb-6 space-y-4 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <UsersRound className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-heading font-bold">Você está na equipe: {membership.teams.name}</h3>
              <p className="text-sm text-muted-foreground">Aguarde o líder da equipe finalizar a formação do grupo para iniciar.</p>
              <WaitingAnimation />
            </CardContent>
          </Card>
        </div>
      );
    }

    // No membership - show "Iniciar aplicação em equipe" screen
    if (!tratReady) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 space-y-6">
          <TBLVirtualLogo />
          <Card className="w-full max-w-md">
            <CardContent className="pt-8 pb-8 space-y-6">
              <div className="text-center space-y-3">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <UsersRound className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-xl font-heading font-bold">Fase em Equipe</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A fase individual foi concluída! Agora é hora de trabalhar em equipe.
                  Clique abaixo para criar sua equipe e adicionar os membros.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">1</div>
                  <span>Defina o nome da equipe</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">2</div>
                  <span>Adicione os membros</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">3</div>
                  <span>Responda em equipe</span>
                </div>
              </div>
              <Button onClick={() => setTratReady(true)} className="w-full py-5 text-base">
                <UsersRound className="w-5 h-5 mr-2" /> Iniciar Aplicação em Equipe
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // tratReady but no membership - show team name creation
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <TBLVirtualLogo />
        <div className="w-full max-w-md bg-card rounded-2xl border shadow-lg p-8 space-y-5 mt-6">
          <p className="text-center text-muted-foreground">
            Você está na sala de nº <span className="text-primary font-bold text-lg">{room.code}</span>
          </p>
          <div className="space-y-2 text-left">
            <Label className="font-semibold">Nome da equipe</Label>
            <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Nome Equipe" />
          </div>
          <Button onClick={createGroup} className="w-full py-5 text-base">Criar Equipe</Button>
        </div>
      </div>
    );
  };

  // ===== tRAT: Add Members Step =====
  const renderTratAddMembers = () => {
    const hasStarted = !!tratStartedAt || tratAttempts.length > 0 || tratStep === 'answering';
    if (hasStarted) return renderTratAnswering();

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <TBLVirtualLogo />
        <div className="w-full max-w-md bg-card rounded-2xl border shadow-lg p-8 space-y-5 mt-6">
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

          <Button onClick={async () => {
            // Set trat_started_at on the team to sync timer across all members
            await supabase.from('teams').update({ trat_started_at: new Date().toISOString() } as any).eq('id', membership!.team_id);
            setTratStartedAt(new Date().toISOString());
            setTratStep('answering');
          }} className="w-full py-5 text-base" disabled={teamMembers.length === 0}>
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
  };

  // ===== RENDER: tRAT ANSWERING (IF-AT) =====
  const renderTratAnswering = () => {
    if (questions.length === 0) return <p className="text-center text-muted-foreground py-8">Nenhuma questão carregada.</p>;

    const allTratDone = questions.every(q => {
      const qA = tratAttempts.filter(a => a.question_id === q.id);
      return qA.some(a => a.is_correct) || qA.length >= 4;
    });

    if (allTratDone) {
      // Questions where the team didn't get full marks and no appeal submitted yet
      const appealableQuestions = questions.filter(q => {
        const qA = tratAttempts.filter(a => a.question_id === q.id);
        const gotCorrectFirst = qA.some(a => a.is_correct && a.attempt_number === 1);
        const alreadyAppealed = appeals.some(a => a.question_id === q.id);
        return !gotCorrectFirst && !alreadyAppealed;
      });

      return (
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <TBLVirtualLogo />
            <p className="text-lg text-primary font-semibold">Aplicação em Equipe concluída com sucesso!</p>
            <p className="text-muted-foreground">
              Aguarde o professor finalizar a aplicação, permanecendo na tela.
            </p>
          </div>

          {/* Appeals Section */}
          {appealableQuestions.length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquarePlus className="w-5 h-5 text-primary" />
                  <h3 className="font-heading font-bold text-base">Recurso de Apelação</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Sua equipe pode contestar questões com justificativa fundamentada.
                </p>
                <div className="space-y-3">
                  {appealableQuestions.map((q, i) => {
                    const qIdx = questions.indexOf(q) + 1;
                    return (
                      <div key={q.id} className="p-3 rounded-lg border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Q{qIdx}. {q.question_text.substring(0, 60)}...</span>
                          <Button size="sm" variant="outline" onClick={() => setAppealQuestion(q.id)}>
                            <MessageSquarePlus className="w-3 h-3 mr-1" /> Apelar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submitted appeals */}
          {appeals.length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-heading font-bold text-base">Apelações Enviadas</h3>
                {appeals.map(a => {
                  const q = questions.find(q => q.id === a.question_id);
                  const qIdx = q ? questions.indexOf(q) + 1 : '?';
                  return (
                    <div key={a.id} className="p-3 rounded-lg border space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Q{qIdx}</span>
                        <Badge variant="outline" className={
                          a.status === 'accepted' ? 'text-success border-success/30' :
                          a.status === 'rejected' ? 'text-destructive border-destructive/30' :
                          'text-warning border-warning/30'
                        }>
                          {a.status === 'pending' ? 'Pendente' : a.status === 'accepted' ? 'Aceita' : 'Rejeitada'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{a.justification}</p>
                      {a.teacher_response && (
                        <p className="text-xs text-primary mt-1">Resposta: {a.teacher_response}</p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <WaitingAnimation />

          {/* Appeal dialog */}
          <Dialog open={!!appealQuestion} onOpenChange={(open) => { if (!open) { setAppealQuestion(null); setAppealJustification(''); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">Recurso de Apelação</DialogTitle>
                <DialogDescription>
                  Justifique por que sua equipe acredita que a resposta deveria ser considerada correta.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {appealQuestion && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <p className="font-medium">{questions.find(q => q.id === appealQuestion)?.question_text}</p>
                  </div>
                )}
                <div>
                  <Label>Justificativa</Label>
                  <Textarea
                    value={appealJustification}
                    onChange={e => setAppealJustification(e.target.value)}
                    placeholder="Apresente sua justificativa com base teórica ou referências..."
                    rows={5}
                  />
                </div>
                <Button
                  onClick={() => appealQuestion && submitAppeal(appealQuestion)}
                  disabled={!appealJustification.trim() || submittingAppeal}
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {submittingAppeal ? 'Enviando...' : 'Enviar Apelação'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-lg font-heading font-bold text-primary">TBL Virtual</span>
          </div>
          <p className="text-lg">
            Você está na sala de número <span className="text-primary font-bold">{room.code}</span>
          </p>
          <p className="text-sm text-muted-foreground">Equipe Conectada: {membership?.teams.name}</p>
        </div>

        {/* tRAT Timer */}
        {tratTimeLeft !== null && (
          <Card className={tratTimeLeft <= 60 ? 'border-destructive' : ''}>
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${tratTimeLeft <= 60 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
                <span className="text-sm">Tempo restante</span>
              </div>
              <span className={`font-mono text-xl font-bold ${tratTimeLeft <= 60 ? 'text-destructive' : ''}`}>{formatTime(tratTimeLeft)}</span>
            </CardContent>
          </Card>
        )}

        {/* Score + members bar */}
        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Pontuação:</span>
            <Badge variant="outline" className="text-lg font-bold px-4 py-1">{tratTotalScore}</Badge>
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
              <p className="text-muted-foreground">
                Resposta Correta! Sua equipe ganhou {TRAT_SCORES[qAttempts.findIndex(a => a.is_correct)]} pontos! Clique em Avançar!
              </p>
              <div className="flex gap-2 justify-center mt-4">
                {currentQ < questions.length - 1 && (
                  <Button onClick={() => { setCurrentQ(p => p + 1); setTratSelectedOption(null); setTratFeedback(null); }} className="w-full py-5 text-base">
                    Avançar
                  </Button>
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
                  <Button onClick={() => { setCurrentQ(p => p + 1); setTratSelectedOption(null); setTratFeedback(null); }} className="w-full py-5 text-base">
                    Avançar
                  </Button>
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
                  const wasWrong = qAttempts.some(a => a.selected_option === opt && !a.is_correct);
                  return (
                    <button key={opt} onClick={() => !isDisabled && setTratSelectedOption(opt)} disabled={isDisabled}
                      className={`w-full text-left p-4 rounded-lg border-2 flex items-center gap-3 transition-all ${
                        wasWrong ? 'border-destructive/50 bg-destructive/10 opacity-60 cursor-not-allowed' :
                        isDisabled ? 'border-border opacity-40 cursor-not-allowed' :
                        isSelected ? 'border-primary bg-primary/5' :
                        'border-border hover:border-primary/50 hover:bg-primary/5'
                      }`}>
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        wasWrong ? 'border-destructive bg-destructive/20' :
                        isSelected ? 'border-primary bg-primary/10' : 'border-muted-foreground/30'
                      }`}>
                        {wasWrong && <XCircle className="w-5 h-5 text-destructive" />}
                        {isSelected && !wasWrong && <div className="w-4 h-4 rounded-full bg-primary" />}
                      </div>
                      <span className={`font-semibold mr-2 ${wasWrong ? 'text-destructive' : ''}`}>{opt})</span>
                      <span className={`text-sm flex-1 ${wasWrong ? 'text-destructive' : ''}`}>
                        {q[`option_${opt.toLowerCase()}` as keyof Question] as string}
                      </span>
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

        {/* Feedback dialog */}
        {tratFeedback && (
          <Dialog open={!!tratFeedback} onOpenChange={() => setTratFeedback(null)}>
            <DialogContent className="text-center max-w-sm">
              <div className="flex flex-col items-center py-4">
                {tratFeedback.correct ? (
                  <>
                    <div className="w-20 h-20 rounded-full border-4 border-success/30 flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-12 h-12 text-success" />
                    </div>
                    <h3 className="text-2xl font-heading font-bold">Correto</h3>
                    <p className="text-muted-foreground mt-2">
                      Resposta Correta! Sua equipe ganhou {tratFeedback.points} pontos! Clique em Avançar!
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full border-4 border-destructive/30 flex items-center justify-center mb-4">
                      <XCircle className="w-12 h-12 text-destructive" />
                    </div>
                    <h3 className="text-2xl font-heading font-bold">Errado</h3>
                    <p className="text-muted-foreground mt-2">
                      Resposta Incorreta! Tente novamente.
                    </p>
                  </>
                )}
                <Button onClick={() => setTratFeedback(null)} className="mt-4 px-8">Ok</Button>
              </div>
            </DialogContent>
          </Dialog>
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

  // ===== RENDER: APPLICATION (V/F) =====
  const renderApplication = () => {
    if (!membership) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <TBLVirtualLogo />
          <p className="text-lg text-muted-foreground">Aguardando liberação da atividade pelo professor...</p>
          <WaitingAnimation />
        </div>
      );
    }

    // Only the team leader sees and answers application questions
    if (!isTeamLeader) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <TBLVirtualLogo />
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 pb-6 space-y-4 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <UsersRound className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-heading font-bold">Equipe: {membership.teams.name}</h3>
              <p className="text-sm text-muted-foreground">
                O líder da equipe está respondendo as questões de aplicação. Aguarde a conclusão.
              </p>
              <WaitingAnimation />
            </CardContent>
          </Card>
        </div>
      );
    }

    if (appQuestions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <TBLVirtualLogo />
          <p className="text-muted-foreground">Aguardando o professor liberar as questões de aplicação...</p>
          <WaitingAnimation />
        </div>
      );
    }

    // Check if all app questions answered
    const allAppDone = appQuestions.every(q => appResponses[q.id]);

    if (allAppDone) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <TBLVirtualLogo />
          <p className="text-lg text-primary font-semibold">Aplicação de Conceitos concluída com sucesso!</p>
          <p className="text-muted-foreground">
            Aguarde o professor finalizar a aplicação, permanecendo na tela.
          </p>
          <WaitingAnimation />
        </div>
      );
    }

    const q = appQuestions[appCurrentQ];
    if (!q) return null;
    const currentResponse = appResponses[q.id];

    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-lg font-heading font-bold text-primary">TBL Virtual</span>
          </div>
          <p className="text-lg">
            Você está na sala de número <span className="text-primary font-bold">{room.code}</span>
          </p>
          <p className="text-sm text-muted-foreground">Equipe: {membership?.teams.name}</p>
        </div>

        <Card className="overflow-hidden">
          <div className="bg-muted py-3 text-center border-b">
            <p className="font-heading font-semibold">Questão Nº {appCurrentQ + 1}</p>
          </div>
          <CardContent className="pt-6 space-y-5">
            <p className="text-base leading-relaxed">{q.question_text}</p>
            <div className="grid grid-cols-2 gap-4">
              {(['A', 'B'] as const).map(opt => {
                const label = opt === 'A' ? (q.option_a || 'V') : (q.option_b || 'F');
                const isSelected = currentResponse === opt;
                return (
                  <button key={opt} onClick={() => submitApp(q.id, opt)}
                    className={`p-6 rounded-xl border-2 text-center text-xl font-bold transition-all ${
                      isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50 hover:bg-primary/5'
                    }`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center gap-1.5 pt-2">
          {appQuestions.map((_, i) => (
            <button key={i} onClick={() => setAppCurrentQ(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === appCurrentQ ? 'bg-primary scale-125' : appResponses[appQuestions[i]?.id] ? 'bg-success' : 'bg-border'
              }`} />
          ))}
        </div>
      </div>
    );
  };

  const renderFinished = () => (
    <div className="text-center py-16 space-y-4">
      <CheckCircle2 className="w-16 h-16 mx-auto text-success" />
      <h2 className="text-2xl font-heading font-bold">Sessão Encerrada!</h2>
      <p className="text-muted-foreground">Obrigado por participar.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {room.current_stage !== 'waiting' && room.current_stage !== 'irat_open' && room.current_stage !== 'trat_open' && room.current_stage !== 'application_open' && (
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
