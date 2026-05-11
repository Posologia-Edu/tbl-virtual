import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ClinicalCaseQuestion } from '@/components/ClinicalCaseQuestion';
import { QuestionRichRenderer } from '@/components/QuestionMedia';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Users, Search, UserPlus, Trash2, Zap, BookOpen, UsersRound, MessageSquarePlus, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import TratFeedbackAnimation from '@/components/TratFeedbackAnimation';
import AchievementToast, { triggerAchievement } from '@/components/AchievementToast';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import ConnectionStatus, { ConnectionDot } from '@/components/ConnectionStatus';

type Question = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  sort_order: number;
  media?: any;
};

type Room = {
  id: string;
  name: string;
  code: string;
  current_stage: string;
  quiz_id: string | null;
  irat_end_time: string | null;
  trat_end_time: string | null;
  app_end_time: string | null;
  show_individual_in_team?: boolean;
  is_active: boolean;
  current_app_question_index?: number;
  app_alternatives_released?: boolean;
  current_feedback_index?: number;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { roomId } = useParams<{ roomId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { isOnline, pendingCount, syncing, resilientSubmit } = useOfflineSync();
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
  const [appPreviewIdx, setAppPreviewIdx] = useState<number | null>(null);
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

  // Achievement granting
  const grantAchievement = async (key: string, name: string, description: string, icon: string) => {
    if (!user) return;
    const { error } = await supabase.from('student_achievements').insert({
      user_id: user.id,
      achievement_key: key,
      achievement_name: name,
      achievement_description: description,
      icon,
      room_id: roomId!,
    } as any);
    if (!error) {
      triggerAchievement({ icon, name, description });
    }
  };
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
  
  // Only load questions when stage moves away from 'waiting' (teacher clicked "Iniciar TBL")
  useEffect(() => { 
    if (room?.quiz_id && room?.current_stage !== 'waiting') {
      loadQuestions(room.quiz_id); 
    } else {
      // Clear questions when in waiting stage so student doesn't see them
      setQuestions([]);
    }
  }, [room?.quiz_id, room?.current_stage, loadQuestions]);

  // Reset currentQ when stage changes to trat_open or application_open
  const prevStageRef = useRef<string | null>(null);
  useEffect(() => {
    if (!room?.current_stage) return;
    if (prevStageRef.current !== room.current_stage) {
      if (room.current_stage === 'trat_open' || room.current_stage === 'application_open') {
        setCurrentQ(0);
        setAppCurrentQ(0);
        setTratFeedback(null);
        setTratSelectedOption(null);
      }
      prevStageRef.current = room.current_stage;
    }
  }, [room?.current_stage]);
  
  // Stage-driven data loading (avoid membership-triggered loops)
  useEffect(() => {
    if (!room?.current_stage) return;

    if (room.current_stage === 'irat_open') {
      loadIratResponses();
    }

    if (room.current_stage === 'trat_open') {
      loadMembership();
      loadParticipants();
    }

    if (room.current_stage === 'application_open') {
      loadMembership();
    }
  }, [room?.current_stage, loadIratResponses, loadMembership, loadParticipants]);

  // tRAT data depends on membership
  useEffect(() => {
    if (room?.current_stage === 'trat_open' && membership) {
      loadTratAttempts();
      loadMemberIratResponses();
      loadAppeals();
    }
  }, [room?.current_stage, membership?.team_id, loadTratAttempts, loadMemberIratResponses, loadAppeals]);

  // Application data: reload on professor controls and membership availability
  useEffect(() => {
    if (room?.current_stage === 'application_open' && membership) {
      loadAppData();
    }
  }, [room?.current_stage, room?.current_app_question_index, room?.app_alternatives_released, membership?.team_id, loadAppData]);

  // Reset preview navigation when teacher releases alternatives or advances the question
  useEffect(() => {
    setAppPreviewIdx(null);
  }, [room?.current_app_question_index, room?.app_alternatives_released]);

  // Determine tRAT step based on state
  useEffect(() => {
    if (room?.current_stage !== 'trat_open') return;
    if (!membership) {
      setTratStep('team_name');
    } else {
      setTratStep('add_members');
    }
  }, [membership, room?.current_stage]);

  // tRAT Timer (from room.trat_end_time set by teacher)
  useEffect(() => {
    if (!room?.trat_end_time || room?.current_stage !== 'trat_open') { setTratTimeLeft(null); return; }
    const updateTimer = () => {
      const endTime = new Date(room.trat_end_time!).getTime();
      const diff = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTratTimeLeft(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.trat_end_time, room?.current_stage]);

  // Also keep legacy trat_started_at timer as fallback
  useEffect(() => {
    if (room?.trat_end_time || !tratStartedAt || room?.current_stage !== 'trat_open') return;
    const updateTimer = () => {
      const startTime = new Date(tratStartedAt).getTime();
      const endTime = startTime + TRAT_DURATION * 1000;
      const diff = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTratTimeLeft(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [tratStartedAt, room?.current_stage, room?.trat_end_time]);

  // App Timer
  const [appTimeLeft, setAppTimeLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!room?.app_end_time || room?.current_stage !== 'application_open') { setAppTimeLeft(null); return; }
    const updateTimer = () => {
      const endTime = new Date(room.app_end_time!).getTime();
      const diff = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setAppTimeLeft(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.app_end_time, room?.current_stage]);

  // iRAT Timer
  useEffect(() => {
    if (!room?.irat_end_time || room?.current_stage !== 'irat_open') { setTimeLeft(null); return; }
    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((new Date(room.irat_end_time!).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.irat_end_time, room?.current_stage]);

  // Audio alert when any timer hits 60 seconds
  const alertPlayed = useRef(false);
  useEffect(() => {
    const activeTimer = timeLeft ?? tratTimeLeft ?? appTimeLeft;
    if (activeTimer !== null && activeTimer === 60 && !alertPlayed.current) {
      alertPlayed.current = true;
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, 500);
      } catch (e) { /* audio not supported */ }
    }
    if (activeTimer !== null && activeTimer > 60) alertPlayed.current = false;
  }, [timeLeft, tratTimeLeft, appTimeLeft]);

  // Auto-submit iRAT when time expires
  useEffect(() => {
    if (timeLeft !== null && timeLeft <= 0 && room?.current_stage === 'irat_open') {
      // Submit all unanswered iRAT questions with current distributions
      questions.forEach(q => {
        if (!iratSubmitted.has(q.id)) {
          const dist = iratDistributions[q.id] || { A: 0, B: 0, C: 0, D: 0 };
          const total = dist.A + dist.B + dist.C + dist.D;
          if (total === 4) submitIrat(q.id, dist);
        }
      });
    }
  }, [timeLeft]);

  // Detect room cancellation and redirect students to home
  useEffect(() => {
    if (room && (!room.is_active || room.current_stage === 'finished')) {
      // Check if room was cancelled (not just finished normally)
      if (!room.is_active) {
        toast.error('A aplicação foi cancelada pelo professor.');
        navigate('/');
      }
    }
  }, [room?.is_active, room?.current_stage, navigate]);

  // Realtime + polling fallback for room stage changes
  const loadRoomRef = useRef(loadRoom);
  const roomRef = useRef<Room | null>(null);
  loadRoomRef.current = loadRoom;

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`student-room-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const newRoom = payload.new as any;
          const oldStage = roomRef.current?.current_stage;

          setRoom(newRoom);
          roomRef.current = newRoom;

          if (!newRoom.is_active) {
            toast.error('A aplicação foi cancelada pelo professor.');
            navigate('/');
            return;
          }

          // Keep application phase synced immediately after teacher controls
          if (newRoom.current_stage === 'application_open') {
            loadMembership();
            loadAppData();
          }

          // Only reset question indices on stage transitions
          if (oldStage !== newRoom.current_stage) {
            setCurrentQ(0); setTratFeedback(null); setAppCurrentQ(0);
          }
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trat_attempts', filter: `room_id=eq.${roomId}` },
        () => { loadTratAttempts(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_members', filter: `room_id=eq.${roomId}` },
        () => { loadMembership(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams', filter: `room_id=eq.${roomId}` },
        () => { loadMembership(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'application_questions', filter: `room_id=eq.${roomId}` },
        () => { loadAppData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'application_responses', filter: `room_id=eq.${roomId}` },
        () => { loadAppData(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        () => { loadParticipants(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appeals', filter: `room_id=eq.${roomId}` },
        () => { loadAppeals(); })
      .subscribe((status) => {
        console.log('[StudentRoom] Realtime status:', status);
      });

    // Polling fallback: keep room + application data synced even if realtime misses events
    const pollInterval = setInterval(async () => {
      await loadRoomRef.current();
      const latestRoom = roomRef.current;
      if (latestRoom?.current_stage === 'application_open') {
        await loadMembership();
        await loadAppData();
      }
      // Keep appeals synced during tRAT (when appeals are submitted/reviewed)
      if (latestRoom?.current_stage === 'trat_open') {
        await loadAppeals();
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [roomId, loadTratAttempts, loadMembership, loadAppData, loadParticipants, loadAppeals, navigate]);

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
    const data = {
      student_id: user!.id, question_id: questionId, room_id: roomId!,
      points_a: distribution.A, points_b: distribution.B, points_c: distribution.C, points_d: distribution.D,
      score, is_correct: score > 0,
    };
    const result = await resilientSubmit('irat_responses', 'insert', data);
    if (!result.success) { toast.error('Falha ao enviar'); return; }
    if (result.offline) { toast.info('Resposta salva localmente — será enviada quando a conexão voltar'); }
    setIratDistributions(prev => ({ ...prev, [questionId]: distribution }));
    setIratScores(prev => ({ ...prev, [questionId]: score }));
    setIratSubmitted(prev => new Set(prev).add(questionId));
    toast.success('Resposta registrada!');

    // Check if all iRAT done with perfect scores
    const allSubmitted = questions.every(q => q.id === questionId || iratSubmitted.has(q.id));
    if (allSubmitted) {
      const allScores = questions.reduce((s, q) => s + (q.id === questionId ? score : (iratScores[q.id] || 0)), 0);
      const maxPossible = questions.length * 4;
      if (allScores === maxPossible) {
        grantAchievement('perfect_irat', 'Mestre Individual', 'Acertou tudo no iRAT', '🎯');
      }
      // First activity achievement
      grantAchievement('first_activity', 'Primeira Atividade', 'Participou da primeira atividade', '🚀');
    }

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
    const result = await resilientSubmit('trat_attempts', 'insert', {
      team_id: membership.team_id, question_id: questionId, room_id: roomId!,
      attempt_number: attemptNumber, selected_option: option, is_correct: isCorrect, submitted_by: user!.id,
    });
    if (!result.success) { if (result.error?.code === '23505') toast.error('Opção já tentada'); else toast.error('Falha ao enviar'); return; }
    if (result.offline) { toast.info('Resposta salva localmente'); }
    const points = isCorrect ? TRAT_SCORES[attemptNumber - 1] : 0;
    setTratFeedback({ correct: isCorrect, option, points });
    setTratSelectedOption(null);
    loadTratAttempts();

    // Achievement: team_perfect if first attempt correct on all questions
    if (isCorrect && attemptNumber === 1) {
      const otherQs = questions.filter(oq => oq.id !== questionId);
      const allOthersFirstAttempt = otherQs.every(oq => {
        const oqA = tratAttempts.filter(a => a.question_id === oq.id);
        return oqA.some(a => a.is_correct && a.attempt_number === 1);
      });
      if (allOthersFirstAttempt && otherQs.length === questions.length - 1) {
        grantAchievement('team_perfect', 'Equipe Perfeita', 'Acertou tudo no tRAT de primeira', '💎');
      }
    }
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
    const result = await resilientSubmit('application_responses', 'upsert', {
      question_id: questionId, team_id: membership.team_id, room_id: roomId!, selected_option: option, submitted_by: user!.id,
    });
    if (!result.success) { toast.error('Falha ao enviar'); return; }
    if (result.offline) { toast.info('Resposta salva localmente'); }
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
      <div className="space-y-2">
        <p className="text-lg font-heading font-semibold text-foreground">Aguardando o professor iniciar a atividade</p>
        <p className="text-sm text-muted-foreground">
          Você está conectado à sala <span className="text-primary font-bold">{room.code}</span>. 
          As questões serão liberadas quando o professor iniciar o TBL.
        </p>
      </div>
      <WaitingAnimation />
      <Card className="w-full max-w-sm">
        <CardContent className="py-4 text-center space-y-1">
          <p className="text-sm text-muted-foreground">Estudante conectado:</p>
          <p className="font-semibold text-primary">{profile?.full_name || 'Aluno'}</p>
        </CardContent>
      </Card>
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
              <QuestionRichRenderer text={q.question_text} media={(q as any).media} />
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
              <QuestionRichRenderer text={q.question_text} media={(q as any).media} />
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

        {/* Feedback animation */}
        <TratFeedbackAnimation
          show={!!tratFeedback}
          correct={tratFeedback?.correct || false}
          points={tratFeedback?.points || 0}
          onClose={() => setTratFeedback(null)}
        />

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

  // ===== RENDER: APPLICATION (V/F) - Professor-controlled =====
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

    // Use professor-controlled question index from room
    const officialAppIdx = room?.current_app_question_index ?? 0;
    const alternativesReleased = room?.app_alternatives_released ?? false;
    // While alternatives are locked, the team can preview/navigate any question to discuss.
    // Once released, force the index controlled by the teacher.
    const currentAppIdx = alternativesReleased
      ? officialAppIdx
      : (appPreviewIdx ?? officialAppIdx);
    const q = appQuestions[currentAppIdx];
    if (!q) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <TBLVirtualLogo />
          <p className="text-lg text-primary font-semibold">Aplicação de Conceitos concluída!</p>
          <p className="text-muted-foreground">Aguarde o professor liberar os relatórios.</p>
          <WaitingAnimation />
        </div>
      );
    }

    const currentResponse = appResponses[q.id];
    const alreadyAnswered = !!currentResponse;
    const canNavigate = !alternativesReleased;
    const isPreviewing = !alternativesReleased && currentAppIdx !== officialAppIdx;

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
            <p className="font-heading font-semibold">Questão Nº {currentAppIdx + 1} de {appQuestions.length}</p>
            {canNavigate && (
              <p className="text-xs text-muted-foreground mt-1">
                Leiam e discutam em equipe. Naveguem livremente entre as questões enquanto aguardam o professor liberar as alternativas.
              </p>
            )}
          </div>
          <CardContent className="pt-6 space-y-5">
            <ClinicalCaseQuestion text={q.question_text} questionNumber={currentAppIdx + 1} media={(q as any).media} />

            {canNavigate && appQuestions.length > 1 && (
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAppPreviewIdx(Math.max(0, currentAppIdx - 1))}
                  disabled={currentAppIdx === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                {isPreviewing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAppPreviewIdx(officialAppIdx)}
                  >
                    Ir para questão atual ({officialAppIdx + 1})
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAppPreviewIdx(Math.min(appQuestions.length - 1, currentAppIdx + 1))}
                  disabled={currentAppIdx >= appQuestions.length - 1}
                >
                  Próxima <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}

            {alreadyAnswered ? (
              <div className="text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 mx-auto text-success" />
                <p className="font-medium text-success">Resposta enviada!</p>
                <p className="text-sm text-muted-foreground">Aguarde o professor avançar para a próxima questão.</p>
              </div>
            ) : !alternativesReleased ? (
              <div className="text-center space-y-3 py-4">
                <Clock className="w-10 h-10 mx-auto text-muted-foreground animate-pulse" />
                <p className="text-sm text-muted-foreground font-medium">Alternativas bloqueadas</p>
                <p className="text-xs text-muted-foreground">Aguarde o professor liberar as alternativas para responder.</p>
                <div className="grid grid-cols-2 gap-4 opacity-50">
                  {(['A', 'B'] as const).map(opt => {
                    const label = opt === 'A' ? (q.option_a || 'V') : (q.option_b || 'F');
                    return (
                      <div key={opt} className="p-6 rounded-xl border-2 border-border text-center text-xl font-bold cursor-not-allowed">
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {(['A', 'B'] as const).map(opt => {
                  const label = opt === 'A' ? (q.option_a || 'V') : (q.option_b || 'F');
                  return (
                    <button key={opt} onClick={() => submitApp(q.id, opt)}
                      className="p-6 rounded-xl border-2 text-center text-xl font-bold transition-all border-primary bg-primary/5 hover:bg-primary/15 animate-pulse">
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center gap-1.5 pt-2">
          {appQuestions.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => canNavigate && setAppPreviewIdx(i)}
              disabled={!canNavigate}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === currentAppIdx ? 'bg-primary scale-125' : i === officialAppIdx ? 'bg-primary/50' : i < officialAppIdx ? 'bg-success' : 'bg-border'
              } ${canNavigate ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
              aria-label={`Ir para questão ${i + 1}`}
            />
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

  // Feedback stage: read-only view of question the teacher is showing
  const renderFeedbackStage = () => {
    const idx = room.current_feedback_index ?? 0;
    const q = questions[idx];
    if (!q) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <TBLVirtualLogo />
          <p className="text-muted-foreground">Aguardando o professor iniciar o feedback...</p>
          <WaitingAnimation />
        </div>
      );
    }
    const correctOpt = ((q as any).correct_option || '').toUpperCase();
    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <TBLVirtualLogo />
          <p className="text-sm text-amber-700 font-semibold mt-2">Feedback — Resposta correta</p>
          <p className="text-sm text-muted-foreground">Questão {idx + 1} de {questions.length}</p>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <ClinicalCaseQuestion text={(q as any).question_text} questionNumber={idx + 1} compact media={(q as any).media} />
            <div className="space-y-2">
              {(['A', 'B', 'C', 'D'] as const).map(opt => {
                const isCorrect = opt === correctOpt;
                const value = (q as any)[`option_${opt.toLowerCase()}`];
                if (!value) return null;
                return (
                  <div key={opt} className={`p-3 rounded-lg border-2 flex items-start gap-3 ${
                    isCorrect ? 'border-success bg-success/10' : 'border-border bg-muted/30 opacity-70'
                  }`}>
                    <span className={`font-bold ${isCorrect ? 'text-success' : 'text-muted-foreground'}`}>{opt})</span>
                    <span className="flex-1 text-sm">{value}</span>
                    {isCorrect && <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
            {(q as any).explanation ? (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                <p className="text-sm font-semibold text-primary">Por que a alternativa {correctOpt} é a correta:</p>
                <p className="text-sm whitespace-pre-wrap">{(q as any).explanation}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center italic">O professor explicará oralmente esta questão.</p>
            )}
            <p className="text-xs text-center text-muted-foreground">Aguarde o professor avançar para a próxima questão.</p>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Appeals stage: reuse the existing appeal UI block from tRAT
  const renderAppealsStage = () => {
    const appealableQuestions = questions.filter(q => {
      const qA = tratAttempts.filter(a => a.question_id === q.id);
      const gotCorrectFirst = qA.some(a => a.is_correct && a.attempt_number === 1);
      const alreadyAppealed = appeals.some(a => a.question_id === q.id);
      return !gotCorrectFirst && !alreadyAppealed;
    });
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <TBLVirtualLogo />
          <p className="text-lg text-primary font-semibold">Fase de Apelação</p>
          <p className="text-sm text-muted-foreground">Sua equipe pode contestar questões do tRAT.</p>
        </div>
        {membership && appealableQuestions.length > 0 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-bold text-base">Questões disponíveis para apelação</h3>
              </div>
              <div className="space-y-3">
                {appealableQuestions.map((q) => {
                  const qIdx = questions.indexOf(q) + 1;
                  return (
                    <div key={q.id} className="p-3 rounded-lg border flex items-center justify-between gap-2">
                      <span className="text-sm font-medium flex-1">Q{qIdx}. {q.question_text.substring(0, 60)}...</span>
                      <Button size="sm" variant="outline" onClick={() => setAppealQuestion(q.id)}>
                        <MessageSquarePlus className="w-3 h-3 mr-1" /> Apelar
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
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
                    {a.teacher_response && <p className="text-xs text-primary mt-1">Resposta: {a.teacher_response}</p>}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
        {membership && appealableQuestions.length === 0 && appeals.length === 0 && (
          <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">
            Nenhuma questão disponível para apelação. Aguarde o professor avançar.
          </CardContent></Card>
        )}
        <WaitingAnimation />
        <Dialog open={!!appealQuestion} onOpenChange={(open) => { if (!open) { setAppealQuestion(null); setAppealJustification(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Recurso de Apelação</DialogTitle>
              <DialogDescription>Justifique por que sua equipe acredita que a resposta deveria ser considerada correta.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {appealQuestion && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <p className="font-medium">{questions.find(q => q.id === appealQuestion)?.question_text}</p>
                </div>
              )}
              <div>
                <Label>Justificativa</Label>
                <Textarea value={appealJustification} onChange={e => setAppealJustification(e.target.value)} placeholder="Apresente sua justificativa com base teórica ou referências..." rows={5} />
              </div>
              <Button onClick={() => appealQuestion && submitAppeal(appealQuestion)} disabled={!appealJustification.trim() || submittingAppeal} className="w-full">
                <Send className="w-4 h-4 mr-2" />
                {submittingAppeal ? 'Enviando...' : 'Enviar Apelação'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  return (
    <>
      <AchievementToast />
      <ConnectionStatus pendingCount={pendingCount} syncing={syncing} />
      <div className="min-h-screen bg-background">
        {room.current_stage !== 'waiting' && room.current_stage !== 'irat_open' && room.current_stage !== 'trat_open' && room.current_stage !== 'application_open' && room.current_stage !== 'trat_feedback' && room.current_stage !== 'appeals_open' && (
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
          {room.current_stage === 'trat_feedback' && renderAppealsStage()}
          {room.current_stage === 'appeals_open' && renderAppealsStage()}
          {room.current_stage === 'application_open' && renderApplication()}
          {room.current_stage === 'application_feedback' && (
            <div className="space-y-6 text-center py-12">
              <TBLVirtualLogo />
              <p className="text-lg text-primary font-semibold">Feedback da Aplicação</p>
              <p className="text-sm text-muted-foreground">O professor está revisando as afirmações de aplicação com a turma. Aguarde a liberação dos relatórios.</p>
              <WaitingAnimation />
            </div>
          )}
          {room.current_stage === 'finished' && renderFinished()}
        </main>
      </div>
    </>
  );
}
