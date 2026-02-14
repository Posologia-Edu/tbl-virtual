import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';

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

type IratPointDistribution = {
  A: number;
  B: number;
  C: number;
  D: number;
};

const TRAT_SCORES = [4, 2, 1, 0];

const stageInfo: Record<string, { label: string; className: string; bgClass: string }> = {
  waiting: { label: 'Aguardando professor', className: 'bg-muted text-muted-foreground', bgClass: '' },
  irat_open: { label: 'Teste Individual (iRAT)', className: 'phase-irat', bgClass: 'border-t-4 border-t-phase-irat' },
  trat_open: { label: 'Teste em Equipe (tRAT)', className: 'phase-trat', bgClass: 'border-t-4 border-t-phase-trat' },
  application_open: { label: 'Exercício de Aplicação', className: 'phase-app', bgClass: 'border-t-4 border-t-phase-app' },
  finished: { label: 'Sessão Encerrada', className: 'bg-muted text-muted-foreground', bgClass: '' },
};

export default function StudentRoomView() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
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
    if (data) setMembership(data as any);
  }, [user, roomId]);

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
      .from('trat_attempts')
      .select('*')
      .eq('team_id', membership.team_id)
      .eq('room_id', roomId!);
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

  useEffect(() => {
    loadRoom();
    loadMembership();
  }, [loadRoom, loadMembership]);

  useEffect(() => {
    if (room?.quiz_id) loadQuestions(room.quiz_id);
  }, [room?.quiz_id, loadQuestions]);

  useEffect(() => {
    if (room?.current_stage === 'irat_open') loadIratResponses();
    if (room?.current_stage === 'trat_open' && membership) loadTratAttempts();
    if (room?.current_stage === 'application_open') loadAppData();
  }, [room?.current_stage, membership]);

  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => { setRoom(payload.new as Room); setCurrentQ(0); setTratFeedback(null); }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trat_attempts', filter: `room_id=eq.${roomId}` },
        () => { loadTratAttempts(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, loadTratAttempts]);

  const submitIrat = async (questionId: string, distribution: IratPointDistribution) => {
    if (iratSubmitted.has(questionId)) return;
    const total = distribution.A + distribution.B + distribution.C + distribution.D;
    if (total !== 4) { toast.error('Distribua exatamente 4 pontos'); return; }
    
    const question = questions.find(q => q.id === questionId);
    const correctOpt = question?.correct_option?.toUpperCase() as keyof IratPointDistribution;
    const score = correctOpt ? distribution[correctOpt] : 0;
    
    const { error } = await supabase.from('irat_responses').insert({
      student_id: user!.id,
      question_id: questionId,
      room_id: roomId!,
      points_a: distribution.A,
      points_b: distribution.B,
      points_c: distribution.C,
      points_d: distribution.D,
      score,
      is_correct: score > 0,
    });
    if (error) { toast.error('Falha ao enviar'); return; }
    
    setIratDistributions(prev => ({ ...prev, [questionId]: distribution }));
    setIratScores(prev => ({ ...prev, [questionId]: score }));
    setIratSubmitted(prev => new Set(prev).add(questionId));
    toast.success(`Resposta registrada!`);
    
    if (currentQ < questions.length - 1) {
      setTimeout(() => setCurrentQ(prev => prev + 1), 300);
    }
  };

  const submitTrat = async (questionId: string, option: string) => {
    if (!membership) return;
    const question = questions.find(q => q.id === questionId);
    const existingAttempts = tratAttempts.filter(a => a.question_id === questionId);
    
    if (existingAttempts.some(a => a.is_correct)) return;
    if (existingAttempts.length >= 4) return;
    
    const attemptNumber = existingAttempts.length + 1;
    const isCorrect = question?.correct_option === option;
    
    const { error } = await supabase.from('trat_attempts').insert({
      team_id: membership.team_id,
      question_id: questionId,
      room_id: roomId!,
      attempt_number: attemptNumber,
      selected_option: option,
      is_correct: isCorrect,
      submitted_by: user!.id,
    });
    if (error) { 
      if (error.code === '23505') toast.error('Esta opção já foi tentada');
      else toast.error('Falha ao enviar');
      return; 
    }
    
    setTratFeedback({ correct: isCorrect, option });
    
    if (isCorrect) {
      toast.success(`Correto! ${TRAT_SCORES[attemptNumber - 1]} pontos!`);
      setTimeout(() => {
        setTratFeedback(null);
        if (currentQ < questions.length - 1) setCurrentQ(prev => prev + 1);
      }, 1500);
    } else {
      toast.error(`Errado! ${4 - attemptNumber} tentativas restantes`);
      setTimeout(() => setTratFeedback(null), 1000);
    }
    
    loadTratAttempts();
  };

  const submitApp = async (questionId: string, option: string) => {
    if (!membership) return;
    const { error } = await supabase.from('application_responses').upsert({
      question_id: questionId,
      team_id: membership.team_id,
      room_id: roomId!,
      selected_option: option,
      submitted_by: user!.id,
    });
    if (error) { toast.error('Falha ao enviar'); return; }
    setAppResponses(prev => ({ ...prev, [questionId]: option }));
    toast.success('Resposta enviada!');
  };

  if (!room) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;

  const stage = stageInfo[room.current_stage] || stageInfo.waiting;

  const renderWaiting = () => (
    <div className="text-center py-16 space-y-4">
      <Clock className="w-16 h-16 mx-auto text-muted-foreground animate-pulse" />
      <h2 className="text-2xl font-heading font-bold">Aguardando Professor</h2>
      <p className="text-muted-foreground">A sessão ainda não começou. Aguarde!</p>
      <Badge variant="outline" className="text-lg px-4 py-1 font-mono">{room.code}</Badge>
      {membership && <p className="text-sm text-muted-foreground">{membership.teams.name}</p>}
    </div>
  );

  const renderQuestion = (q: Question, onSelect: (qId: string, opt: string) => void, disabledOpts: Set<string>, selectedOpt?: string) => (
    <Card key={q.id} className="overflow-hidden">
      <CardContent className="pt-6 space-y-4">
        <p className="font-medium text-lg leading-relaxed">
          <span className="text-muted-foreground mr-2">Q{currentQ + 1}/{questions.length}</span>
          {q.question_text}
        </p>
        <div className="space-y-2">
          {(['A', 'B', 'C', 'D'] as const).map(opt => {
            const isSelected = selectedOpt === opt;
            const isDisabled = disabledOpts.has(opt);
            return (
              <button
                key={opt}
                onClick={() => !isDisabled && !selectedOpt && onSelect(q.id, opt)}
                disabled={isDisabled || !!selectedOpt}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : isDisabled
                    ? 'border-border opacity-40 line-through'
                    : 'border-border hover:border-primary/50 hover:bg-primary/5'
                }`}
              >
                <span className="font-semibold mr-3">{opt}.</span>
                {q[`option_${opt.toLowerCase()}` as keyof Question] as string}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  const IratPointDistributor = ({ question }: { question: Question }) => {
    const [dist, setDist] = useState<IratPointDistribution>({ A: 0, B: 0, C: 0, D: 0 });
    const total = dist.A + dist.B + dist.C + dist.D;
    const remaining = 4 - total;

    const adjustPoints = (opt: keyof IratPointDistribution, delta: number) => {
      const newVal = dist[opt] + delta;
      if (newVal < 0 || newVal > 4) return;
      const newTotal = total + delta;
      if (newTotal > 4) return;
      setDist(prev => ({ ...prev, [opt]: newVal }));
    };

    return (
      <Card className="overflow-hidden">
        <CardContent className="pt-6 space-y-4">
          <p className="font-medium text-lg leading-relaxed">
            <span className="text-muted-foreground mr-2">Q{currentQ + 1}/{questions.length}</span>
            {question.question_text}
          </p>
          <div className="text-center">
            <Badge variant={remaining === 0 ? 'default' : 'outline'} className="text-sm">
              {remaining === 0 ? '✓ Todos os pontos distribuídos' : `${remaining} ponto${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}`}
            </Badge>
          </div>
          <div className="space-y-3">
            {(['A', 'B', 'C', 'D'] as const).map(opt => (
              <div key={opt} className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                dist[opt] > 0 ? 'border-primary bg-primary/5' : 'border-border'
              }`}>
                <span className="font-semibold w-6">{opt}.</span>
                <span className="flex-1 text-sm">{question[`option_${opt.toLowerCase()}` as keyof Question] as string}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustPoints(opt, -1)}
                    disabled={dist[opt] === 0}
                    className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-lg font-bold disabled:opacity-30 hover:bg-accent transition-colors"
                  >−</button>
                  <span className="w-6 text-center font-bold text-lg">{dist[opt]}</span>
                  <button
                    onClick={() => adjustPoints(opt, 1)}
                    disabled={remaining === 0 || dist[opt] === 4}
                    className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-lg font-bold disabled:opacity-30 hover:bg-accent transition-colors"
                  >+</button>
                </div>
              </div>
            ))}
          </div>
          <Button
            className="w-full"
            disabled={remaining !== 0}
            onClick={() => submitIrat(question.id, dist)}
          >
            Confirmar Distribuição
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderIrat = () => {
    if (questions.length === 0) return <p className="text-center text-muted-foreground py-8">Nenhuma questão carregada.</p>;
    const q = questions[currentQ];
    const submitted = iratSubmitted.has(q.id);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge className="phase-irat">iRAT - Individual</Badge>
          <span className="text-sm text-muted-foreground">{iratSubmitted.size}/{questions.length} respondidas</span>
        </div>
        {submitted ? (
          <Card>
            <CardContent className="py-8 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success" />
              <p className="font-medium">Distribuição enviada</p>
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
          <IratPointDistributor question={q} />
        )}
        <div className="flex justify-center gap-1.5 pt-2">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentQ(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === currentQ ? 'bg-primary scale-125' : iratSubmitted.has(questions[i].id) ? 'bg-success' : 'bg-border'
              }`}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderTrat = () => {
    if (questions.length === 0) return <p className="text-center text-muted-foreground py-8">Nenhuma questão carregada.</p>;
    const q = questions[currentQ];
    const qAttempts = tratAttempts.filter(a => a.question_id === q.id);
    const isCorrect = qAttempts.some(a => a.is_correct);
    const disabledOpts = new Set(qAttempts.map(a => a.selected_option));
    
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
              <p className="text-sm text-muted-foreground mt-1">Encontrado na tentativa {qAttempts.findIndex(a => a.is_correct) + 1}</p>
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
              <p className="text-sm text-muted-foreground">0 pontos nesta questão</p>
              <div className="flex gap-2 justify-center mt-4">
                {currentQ < questions.length - 1 && <Button size="sm" onClick={() => setCurrentQ(p => p + 1)}>Próxima Questão</Button>}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(n => (
                <div
                  key={n}
                  className={`flex-1 h-2 rounded-full ${
                    n <= qAttempts.length ? 'bg-destructive' : 'bg-border'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-center text-muted-foreground">
              Tentativa {qAttempts.length + 1}/4 • {TRAT_SCORES[qAttempts.length]} pontos se acertar
            </p>
            {renderQuestion(q, submitTrat, disabledOpts)}
          </>
        )}
        
        {tratFeedback && (
          <div className="fixed inset-0 flex items-center justify-center bg-background/80 z-50 animate-in fade-in">
            <div className={`text-center p-8 rounded-2xl ${tratFeedback.correct ? 'bg-success/10' : 'bg-destructive/10'}`}>
              {tratFeedback.correct ? (
                <CheckCircle2 className="w-20 h-20 mx-auto text-success" />
              ) : (
                <XCircle className="w-20 h-20 mx-auto text-destructive" />
              )}
              <p className="text-2xl font-heading font-bold mt-3">
                {tratFeedback.correct ? 'Correto!' : 'Errado!'}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-center gap-1.5 pt-2">
          {questions.map((q, i) => {
            const qA = tratAttempts.filter(a => a.question_id === q.id);
            const done = qA.some(a => a.is_correct) || qA.length >= 4;
            return (
              <button
                key={i}
                onClick={() => { setCurrentQ(i); setTratFeedback(null); }}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i === currentQ ? 'bg-phase-trat scale-125' : done ? 'bg-success' : 'bg-border'
                }`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const renderApplication = () => (
    <div className="space-y-4">
      <Badge className="phase-app">Exercício de Aplicação</Badge>
      {appQuestions.length === 0 ? (
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
                    <button
                      key={opt}
                      onClick={() => submitApp(q.id, opt)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        isSelected ? 'border-phase-app bg-phase-app-light' : 'border-border hover:border-phase-app/50'
                      }`}
                    >
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
      <header className={`border-b bg-card ${stage.bgClass}`}>
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-heading font-bold">{room.name}</h1>
            <p className="text-sm text-muted-foreground">{stage.label}</p>
          </div>
        </div>
      </header>

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
