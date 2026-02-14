import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Play, Users, Plus, Copy } from 'lucide-react';
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
  const [iratStats, setIratStats] = useState<{ total: number; completed: number }>({ total: 0, completed: 0 });
  const [tratStats, setTratStats] = useState<{ teamId: string; teamName: string; score: number }[]>([]);
  const [appQOpen, setAppQOpen] = useState(false);
  const [appQText, setAppQText] = useState('');
  const [appOptA, setAppOptA] = useState('');
  const [appOptB, setAppOptB] = useState('');
  const [appOptC, setAppOptC] = useState('');
  const [appOptD, setAppOptD] = useState('');
  const [appDistribution, setAppDistribution] = useState<Record<string, Record<string, number>>>({});
  const [appQuestions, setAppQuestions] = useState<any[]>([]);

  useEffect(() => { loadAll(); }, [roomId]);

  const loadAll = async () => {
    const { data: roomData } = await supabase.from('rooms').select('*').eq('id', roomId!).single();
    if (roomData) setRoom(roomData);

    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name, team_members(user_id, profiles:user_id(full_name))')
      .eq('room_id', roomId!)
      .order('name');
    setTeams(teamsData || []);

    const { data: members } = await supabase.from('team_members').select('user_id').eq('room_id', roomId!);
    const { count } = await supabase.from('irat_responses').select('id', { count: 'exact', head: true }).eq('room_id', roomId!);
    const questionsCount = roomData?.quiz_id
      ? (await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('quiz_id', roomData.quiz_id)).count || 0
      : 0;
    setIratStats({ total: (members?.length || 0) * questionsCount, completed: count || 0 });

    if (teamsData) {
      const { data: tratData } = await supabase.from('trat_attempts').select('*').eq('room_id', roomId!);
      const scores = teamsData.map(t => {
        const teamAttempts = (tratData || []).filter((a: any) => a.team_id === t.id && a.is_correct);
        const score = teamAttempts.reduce((sum: number, a: any) => sum + [4, 2, 1, 0][a.attempt_number - 1], 0);
        return { teamId: t.id, teamName: t.name, score };
      });
      setTratStats(scores);
    }

    const { data: aq } = await supabase.from('application_questions').select('*').eq('room_id', roomId!).order('sort_order');
    setAppQuestions(aq || []);
    
    if (aq && aq.length > 0) {
      const { data: ar } = await supabase.from('application_responses').select('*').eq('room_id', roomId!);
      const dist: Record<string, Record<string, number>> = {};
      (aq || []).forEach((q: any) => { dist[q.id] = { A: 0, B: 0, C: 0, D: 0 }; });
      (ar || []).forEach((r: any) => {
        if (dist[r.question_id] && r.selected_option) dist[r.question_id][r.selected_option]++;
      });
      setAppDistribution(dist);
    }
  };

  const advanceStage = async () => {
    if (!room) return;
    const currentIdx = stages.indexOf(room.current_stage);
    if (currentIdx >= stages.length - 1) return;
    const nextStage = stages[currentIdx + 1];
    await supabase.from('rooms').update({ current_stage: nextStage }).eq('id', roomId!);
    loadAll();
    toast.success(`Avançou para ${stageLabels[nextStage].label}`);
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

  if (!room) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;

  const stageInfo = stageLabels[room.current_stage] || stageLabels.waiting;

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
              <Button onClick={advanceStage} className="w-full mt-3" size="sm">
                <Play className="w-3 h-3 mr-1" /> Avançar para Próxima Fase
              </Button>
            )}
          </CardContent>
        </Card>

        <div>
          <h2 className="text-lg font-heading font-semibold mb-3 flex items-center gap-2">
            <Users className="w-5 h-5" /> Equipes
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {teams.map(t => (
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Badge className="phase-trat">tRAT</Badge> Pontuações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tratStats.filter(t => t.score > 0).sort((a, b) => b.score - a.score).map(t => (
                <div key={t.teamId} className="flex items-center justify-between">
                  <span className="text-sm">{t.teamName}</span>
                  <span className="font-mono font-bold">{t.score} pts</span>
                </div>
              ))}
              {tratStats.every(t => t.score === 0) && (
                <p className="text-sm text-muted-foreground text-center">Sem pontuações ainda</p>
              )}
            </div>
          </CardContent>
        </Card>

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
    </div>
  );
}
