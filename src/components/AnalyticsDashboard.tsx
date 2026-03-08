import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell,
} from 'recharts';
import { BarChart3, TrendingUp, Download, FileSpreadsheet, Printer, Loader2, AlertTriangle, Globe } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  userId: string;
  canExport?: boolean;
  onUpgradeNeeded?: (feature: string) => void;
};

type RoomData = {
  id: string;
  name: string;
  code: string;
  created_at: string;
  quiz_id: string | null;
  current_stage: string;
  max_grade: number;
  individual_pct: number;
  team_pct: number;
  application_pct: number;
};

type QuestionAnalysis = {
  index: number;
  id: string;
  text: string;
  correctOption: string;
  totalResponses: number;
  correctCount: number;
  difficultyIndex: number;
  discriminationIndex: number;
  difficulty: string;
  optionDistribution: { A: number; B: number; C: number; D: number };
};

export default function AnalyticsDashboard({ userId, canExport = true, onUpgradeNeeded }: Props) {
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [iratResponses, setIratResponses] = useState<any[]>([]);
  const [tratAttempts, setTratAttempts] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [appQuestions, setAppQuestions] = useState<any[]>([]);
  const [appResponses, setAppResponses] = useState<any[]>([]);

  // Load all finished rooms
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('teacher_id', userId)
        .eq('current_stage', 'finished')
        .order('created_at', { ascending: false });
      setRooms((data as any[]) || []);
      if (data && data.length > 0) setSelectedRoomId(data[0].id);
      setLoading(false);
    };
    load();
  }, [userId]);

  // Load room-specific data when selection changes
  useEffect(() => {
    if (!selectedRoomId) return;
    const loadRoom = async () => {
      const room = rooms.find(r => r.id === selectedRoomId);
      if (!room?.quiz_id) return;

      const [
        { data: qs }, { data: irat }, { data: trat },
        { data: parts }, { data: teamsData },
        { data: aq }, { data: ar },
      ] = await Promise.all([
        supabase.from('questions').select('*').eq('quiz_id', room.quiz_id).order('sort_order'),
        supabase.from('irat_responses').select('*').eq('room_id', selectedRoomId),
        supabase.from('trat_attempts').select('*').eq('room_id', selectedRoomId),
        supabase.from('room_participants').select('id, user_id, participant_code, profiles:user_id(full_name)').eq('room_id', selectedRoomId),
        supabase.from('teams').select('id, name, team_members(user_id, profiles:user_id(full_name))').eq('room_id', selectedRoomId),
        supabase.from('application_questions').select('*').eq('room_id', selectedRoomId).order('sort_order'),
        supabase.from('application_responses').select('*').eq('room_id', selectedRoomId),
      ]);
      setQuestions(qs || []);
      setIratResponses(irat || []);
      setTratAttempts(trat || []);
      setParticipants(parts || []);
      setTeams((teamsData || []).filter((t: any) => (t.team_members || []).length > 0));
      setAppQuestions(aq || []);
      setAppResponses(ar || []);
    };
    loadRoom();
  }, [selectedRoomId, rooms]);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  // ============ QUESTION ANALYSIS (Psychometrics) ============
  const questionAnalysis: QuestionAnalysis[] = useMemo(() => {
    if (!questions.length || !iratResponses.length || !participants.length) return [];

    // Compute total scores for each student
    const studentScores: Record<string, number> = {};
    participants.forEach((p: any) => {
      const score = iratResponses
        .filter((r: any) => r.student_id === p.user_id)
        .reduce((sum: number, r: any) => sum + r.score, 0);
      studentScores[p.user_id] = score;
    });

    // Sort students by total score for discrimination
    const sortedStudents = Object.entries(studentScores)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    const n = sortedStudents.length;
    const topCount = Math.max(1, Math.ceil(n * 0.27));
    const topGroup = new Set(sortedStudents.slice(0, topCount));
    const bottomGroup = new Set(sortedStudents.slice(-topCount));

    return questions.map((q: any, i: number) => {
      const qResponses = iratResponses.filter((r: any) => r.question_id === q.id);
      const totalResponses = qResponses.length;
      const correctCount = qResponses.filter((r: any) => r.score === 4).length;
      const difficultyIndex = totalResponses > 0 ? correctCount / totalResponses : 0;

      // Discrimination index: proportion correct in top 27% minus bottom 27%
      const topCorrect = qResponses.filter((r: any) => topGroup.has(r.student_id) && r.score === 4).length;
      const bottomCorrect = qResponses.filter((r: any) => bottomGroup.has(r.student_id) && r.score === 4).length;
      const discriminationIndex = topCount > 0 ? (topCorrect - bottomCorrect) / topCount : 0;

      // Option distribution - use points columns to determine which option was "most bet on"
      const dist = { A: 0, B: 0, C: 0, D: 0 };
      qResponses.forEach((r: any) => {
        // Determine selected option based on which had highest points
        const points = { A: r.points_a || 0, B: r.points_b || 0, C: r.points_c || 0, D: r.points_d || 0 };
        const maxPoints = Math.max(points.A, points.B, points.C, points.D);
        if (maxPoints > 0) {
          const selected = (Object.keys(points) as Array<'A'|'B'|'C'|'D'>).find(k => points[k] === maxPoints);
          if (selected) dist[selected]++;
        }
      });

      const difficulty = difficultyIndex >= 0.7 ? 'Fácil' : difficultyIndex >= 0.4 ? 'Médio' : 'Difícil';

      return {
        index: i + 1,
        id: q.id,
        text: q.question_text.substring(0, 100) + (q.question_text.length > 100 ? '...' : ''),
        correctOption: q.correct_option,
        totalResponses,
        correctCount,
        difficultyIndex,
        discriminationIndex,
        difficulty,
        optionDistribution: dist,
      };
    });
  }, [questions, iratResponses, participants]);

  // ============ INDIVIDUAL VS TEAM COMPARISON ============
  const iratVsTrat = useMemo(() => {
    if (!questions.length || !participants.length) return [];

    return participants.map((p: any) => {
      const studentIrat = iratResponses.filter((r: any) => r.student_id === p.user_id);
      const iratScore = studentIrat.reduce((sum: number, r: any) => sum + r.score, 0);
      const maxScore = questions.length * 4;
      const iratPct = maxScore > 0 ? (iratScore / maxScore) * 100 : 0;

      const team = teams.find((t: any) =>
        (t.team_members || []).some((m: any) => m.user_id === p.user_id)
      );
      let tratPct = 0;
      if (team) {
        const teamCorrect = tratAttempts.filter((a: any) => a.team_id === team.id && a.is_correct);
        const tratScore = teamCorrect.reduce((sum: number, a: any) => sum + [4, 2, 1, 0][a.attempt_number - 1], 0);
        tratPct = maxScore > 0 ? (tratScore / maxScore) * 100 : 0;
      }

      return {
        name: (p.profiles?.full_name || 'Aluno').split(' ')[0],
        fullName: p.profiles?.full_name || 'Aluno',
        iRAT: Math.round(iratPct),
        tRAT: Math.round(tratPct),
        gain: Math.round(tratPct - iratPct),
        teamName: team?.name || '—',
      };
    }).sort((a, b) => b.gain - a.gain);
  }, [participants, iratResponses, tratAttempts, questions, teams]);

  // ============ HISTORICAL EVOLUTION ============
  const historicalData = useMemo(() => {
    return rooms.map(r => {
      const date = new Date(r.created_at);
      return {
        name: `${date.getDate()}/${date.getMonth() + 1}`,
        room: r.name.substring(0, 20),
        fullName: r.name,
        id: r.id,
      };
    }).reverse();
  }, [rooms]);

  // ============ HEATMAP DATA ============
  const heatmapData = useMemo(() => {
    if (!questionAnalysis.length) return [];
    return questionAnalysis.map(q => ({
      question: `Q${q.index}`,
      ...q.optionDistribution,
      correct: q.correctOption,
    }));
  }, [questionAnalysis]);

  // ============ EXPORT FUNCTIONS ============
  const exportCSV = () => {
    if (!canExport) { onUpgradeNeeded?.('Exportar CSV/PDF'); return; }
    if (!questionAnalysis.length) { toast.error('Sem dados para exportar'); return; }

    // Student report CSV
    const maxScore = questions.length * 4;
    const headers = ['Nome', 'Equipe', 'iRAT (%)', 'tRAT (%)', 'Ganho (pp)', 'iRAT Raw', 'tRAT Raw'];
    const rows = iratVsTrat.map(s => [
      s.fullName, s.teamName, s.iRAT, s.tRAT, s.gain,
      Math.round(s.iRAT * maxScore / 100), Math.round(s.tRAT * maxScore / 100),
    ]);

    let csv = '\uFEFF'; // BOM for Excel
    csv += 'ANÁLISE DE DESEMPENHO - ' + (selectedRoom?.name || '') + '\n';
    csv += 'Data: ' + new Date().toLocaleDateString('pt-BR') + '\n\n';

    // Comparativo Individual vs Equipe
    csv += 'COMPARATIVO INDIVIDUAL VS EQUIPE\n';
    csv += headers.join(';') + '\n';
    rows.forEach(r => { csv += r.join(';') + '\n'; });

    csv += '\n\nANÁLISE PSICOMÉTRICA DAS QUESTÕES\n';
    csv += 'Questão;Índice Dificuldade;Índice Discriminação;Classificação;Opt A;Opt B;Opt C;Opt D;Gabarito\n';
    questionAnalysis.forEach(q => {
      csv += `Q${q.index};${q.difficultyIndex.toFixed(2)};${q.discriminationIndex.toFixed(2)};${q.difficulty};${q.optionDistribution.A};${q.optionDistribution.B};${q.optionDistribution.C};${q.optionDistribution.D};${q.correctOption}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${selectedRoom?.name || 'report'}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório CSV exportado!');
  };

  const exportPDF = () => {
    if (!canExport) { onUpgradeNeeded?.('Exportar CSV/PDF'); return; }
    window.print();
  };

  // ============ RENDER ============
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" /> Análise de Desempenho
        </h2>
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Nenhuma sessão finalizada encontrada.</p>
            <p className="text-sm">Os analytics estarão disponíveis após finalizar pelo menos uma sessão TBL.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const avgGain = iratVsTrat.length > 0
    ? (iratVsTrat.reduce((s, d) => s + d.gain, 0) / iratVsTrat.length).toFixed(1)
    : '0';
  const avgDifficulty = questionAnalysis.length > 0
    ? (questionAnalysis.reduce((s, q) => s + q.difficultyIndex, 0) / questionAnalysis.length).toFixed(2)
    : '0';
  const avgDiscrimination = questionAnalysis.length > 0
    ? (questionAnalysis.reduce((s, q) => s + q.discriminationIndex, 0) / questionAnalysis.length).toFixed(2)
    : '0';

  const getHeatColor = (count: number, isCorrect: boolean, total: number) => {
    if (total === 0) return 'bg-muted';
    const pct = count / total;
    if (isCorrect) {
      if (pct >= 0.6) return 'bg-success/30 text-success';
      if (pct >= 0.3) return 'bg-success/15 text-success';
      return 'bg-success/5 text-success';
    }
    if (pct >= 0.4) return 'bg-destructive/30 text-destructive';
    if (pct >= 0.2) return 'bg-destructive/15 text-destructive';
    return 'bg-muted/50 text-muted-foreground';
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" /> Análise de Desempenho
        </h2>
        <div className="flex items-center gap-2">
          <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Selecione uma sessão" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map(r => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} — {new Date(r.created_at).toLocaleDateString('pt-BR')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-heading font-bold">Análise de Desempenho Avançada</h1>
        <p className="text-sm">{selectedRoom?.name} — {new Date(selectedRoom?.created_at || '').toLocaleDateString('pt-BR')}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-heading font-bold">{participants.length}</p>
            <p className="text-xs text-muted-foreground">Alunos</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: 'hsl(var(--success))' }}>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-heading font-bold text-success">+{avgGain}pp</p>
            <p className="text-xs text-muted-foreground">Ganho Médio iRAT→tRAT</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: 'hsl(var(--warning))' }}>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-heading font-bold">{avgDifficulty}</p>
            <p className="text-xs text-muted-foreground">Dificuldade Média</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: 'hsl(var(--phase-trat))' }}>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-heading font-bold">{avgDiscrimination}</p>
            <p className="text-xs text-muted-foreground">Discriminação Média</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="psychometrics" className="w-full">
        <TabsList className="grid w-full grid-cols-5 print:hidden">
          <TabsTrigger value="psychometrics">Psicometria</TabsTrigger>
          <TabsTrigger value="heatmap">Mapa de Calor</TabsTrigger>
          <TabsTrigger value="comparison">Individual vs Equipe</TabsTrigger>
          <TabsTrigger value="history">Evolução</TabsTrigger>
          <TabsTrigger value="visitors" className="flex items-center gap-1"><Globe className="w-3 h-3" /> Visitantes</TabsTrigger>
        </TabsList>

        {/* ===== PSYCHOMETRICS TAB ===== */}
        <TabsContent value="psychometrics" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading">Índices Psicométricos por Questão</CardTitle>
              <CardDescription>
                Índice de Dificuldade (0-1, ideal: 0.3-0.7) · Índice de Discriminação (-1 a 1, bom: ≥0.3)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {questionAnalysis.length > 0 ? (
                <>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={questionAnalysis.map(q => ({
                        name: `Q${q.index}`,
                        Dificuldade: parseFloat(q.difficultyIndex.toFixed(2)),
                        Discriminação: parseFloat(q.discriminationIndex.toFixed(2)),
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis fontSize={12} domain={[-0.5, 1]} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                        <Legend />
                        <Bar dataKey="Dificuldade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Discriminação" fill="hsl(var(--phase-trat))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ScrollArea className="w-full mt-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="min-w-[60px]">Questão</TableHead>
                          <TableHead className="min-w-[120px]">Índ. Dificuldade</TableHead>
                          <TableHead className="min-w-[130px]">Índ. Discriminação</TableHead>
                          <TableHead className="min-w-[80px]">Classificação</TableHead>
                          <TableHead className="min-w-[80px] text-center">Respostas</TableHead>
                          <TableHead className="min-w-[80px] text-center">Acertos</TableHead>
                          <TableHead className="min-w-[100px]">Qualidade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {questionAnalysis.map(q => (
                          <TableRow key={q.id}>
                            <TableCell className="font-medium">Q{q.index}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${q.difficultyIndex * 100}%` }} />
                                </div>
                                <span className="text-sm">{q.difficultyIndex.toFixed(2)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${q.discriminationIndex >= 0.3 ? 'bg-success' : q.discriminationIndex >= 0.1 ? 'bg-warning' : 'bg-destructive'}`}
                                    style={{ width: `${Math.max(0, q.discriminationIndex) * 100}%` }}
                                  />
                                </div>
                                <span className="text-sm">{q.discriminationIndex.toFixed(2)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                q.difficulty === 'Fácil' ? 'text-success border-success/30' :
                                q.difficulty === 'Médio' ? 'text-warning border-warning/30' :
                                'text-destructive border-destructive/30'
                              }>{q.difficulty}</Badge>
                            </TableCell>
                            <TableCell className="text-center">{q.totalResponses}</TableCell>
                            <TableCell className="text-center">{q.correctCount}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                q.discriminationIndex >= 0.3 ? 'text-success border-success/30' :
                                q.discriminationIndex >= 0.1 ? 'text-warning border-warning/30' :
                                'text-destructive border-destructive/30'
                              }>
                                {q.discriminationIndex >= 0.3 ? 'Boa' : q.discriminationIndex >= 0.1 ? 'Regular' : 'Revisar'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8 text-sm">Sem dados de resposta para análise.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== HEATMAP TAB ===== */}
        <TabsContent value="heatmap" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading">Mapa de Calor — Alternativas Escolhidas</CardTitle>
              <CardDescription>
                Distribuição de respostas por alternativa. Verde = gabarito, Vermelho = distrator popular.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {heatmapData.length > 0 ? (
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="min-w-[80px]">Questão</TableHead>
                        <TableHead className="text-center min-w-[100px]">Opção A</TableHead>
                        <TableHead className="text-center min-w-[100px]">Opção B</TableHead>
                        <TableHead className="text-center min-w-[100px]">Opção C</TableHead>
                        <TableHead className="text-center min-w-[100px]">Opção D</TableHead>
                        <TableHead className="text-center min-w-[80px]">Gabarito</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {heatmapData.map((row, i) => {
                        const total = row.A + row.B + row.C + row.D;
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{row.question}</TableCell>
                            {(['A', 'B', 'C', 'D'] as const).map(opt => {
                              const count = row[opt];
                              const isCorrect = row.correct?.toUpperCase() === opt;
                              const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
                              return (
                                <TableCell key={opt} className="text-center">
                                  <div className={`inline-flex flex-col items-center px-3 py-1.5 rounded-lg ${getHeatColor(count, isCorrect, total)} ${isCorrect ? 'ring-1 ring-success/40' : ''}`}>
                                    <span className="font-bold text-sm">{count}</span>
                                    <span className="text-[10px] opacity-70">{pct}%</span>
                                  </div>
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center">
                              <Badge className="bg-success/20 text-success border-success/30">{row.correct}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              ) : (
                <p className="text-center text-muted-foreground py-8 text-sm">Sem dados para gerar o mapa de calor.</p>
              )}
            </CardContent>
          </Card>

          {/* Visual bar chart of option distribution */}
          {heatmapData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading">Distribuição Visual por Questão</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={heatmapData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="question" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Legend />
                      <Bar dataKey="A" name="Opção A" fill="hsl(var(--primary))" stackId="stack" />
                      <Bar dataKey="B" name="Opção B" fill="hsl(var(--phase-trat))" stackId="stack" />
                      <Bar dataKey="C" name="Opção C" fill="hsl(var(--success))" stackId="stack" />
                      <Bar dataKey="D" name="Opção D" fill="hsl(var(--destructive))" stackId="stack" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== INDIVIDUAL VS TEAM TAB ===== */}
        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" />
                Comparativo iRAT vs tRAT — Ganho Individual→Equipe
              </CardTitle>
              <CardDescription>
                Mostra o percentual de acerto no iRAT (individual) vs tRAT (equipe) de cada aluno.
                Ganho positivo indica benefício do trabalho em equipe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {iratVsTrat.length > 0 ? (
                <>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={iratVsTrat} layout="vertical" margin={{ left: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" domain={[0, 100]} fontSize={12} unit="%" />
                        <YAxis type="category" dataKey="name" fontSize={11} width={55} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(value: any, name: string) => [`${value}%`, name]}
                        />
                        <Legend />
                        <Bar dataKey="iRAT" name="iRAT (Individual)" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={12} />
                        <Bar dataKey="tRAT" name="tRAT (Equipe)" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} barSize={12} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <ScrollArea className="w-full mt-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="min-w-[160px]">Aluno</TableHead>
                          <TableHead className="min-w-[100px]">Equipe</TableHead>
                          <TableHead className="text-center min-w-[80px]">iRAT (%)</TableHead>
                          <TableHead className="text-center min-w-[80px]">tRAT (%)</TableHead>
                          <TableHead className="text-center min-w-[100px]">Ganho (pp)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {iratVsTrat.map((s, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{s.fullName}</TableCell>
                            <TableCell className="text-sm">{s.teamName}</TableCell>
                            <TableCell className="text-center">{s.iRAT}%</TableCell>
                            <TableCell className="text-center">{s.tRAT}%</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={
                                s.gain > 0 ? 'text-success border-success/30' :
                                s.gain < 0 ? 'text-destructive border-destructive/30' :
                                'text-muted-foreground'
                              }>
                                {s.gain > 0 ? '+' : ''}{s.gain}pp
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8 text-sm">Sem dados de comparação disponíveis.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== HISTORY TAB ===== */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading">Evolução Histórica de Sessões</CardTitle>
              <CardDescription>
                Todas as sessões TBL finalizadas do professor em ordem cronológica.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="min-w-[200px]">Sessão</TableHead>
                      <TableHead className="min-w-[100px]">Data</TableHead>
                      <TableHead className="text-center min-w-[80px]">Alunos</TableHead>
                      <TableHead className="text-center min-w-[80px]">Nota Máx.</TableHead>
                      <TableHead className="text-center min-w-[80px]">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rooms.map(r => (
                      <TableRow key={r.id} className={r.id === selectedRoomId ? 'bg-primary/5' : ''}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-center">—</TableCell>
                        <TableCell className="text-center">{r.max_grade || 10}</TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" variant={r.id === selectedRoomId ? 'default' : 'outline'} onClick={() => setSelectedRoomId(r.id)}>
                            {r.id === selectedRoomId ? 'Selecionada' : 'Analisar'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== VISITORS TAB ===== */}
        <TabsContent value="visitors" className="space-y-4">
          <VisitorAnalytics />
        </TabsContent>
      </Tabs>

      {/* Export buttons */}
      <div className="flex gap-3 print:hidden">
        <Button variant="outline" onClick={exportCSV} className="flex-1">
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar CSV/Excel
        </Button>
        <Button variant="outline" onClick={exportPDF} className="flex-1">
          <Printer className="w-4 h-4 mr-2" /> Imprimir / PDF
        </Button>
      </div>
    </div>
  );
}

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--phase-trat))', 'hsl(var(--phase-app))', 'hsl(var(--success))', 'hsl(var(--destructive))'];

function VisitorAnalytics() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [period, setPeriod] = useState('7');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - parseInt(period));
      const { data } = await supabase
        .from('analytics_events' as any)
        .select('*')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000) as any;
      setEvents(data || []);
      setLoading(false);
    };
    load();
  }, [period]);

  const uniqueSessions = useMemo(() => new Set(events.map((e: any) => e.session_id)).size, [events]);
  const pageViews = useMemo(() => events.filter((e: any) => e.event_type === 'page_view').length, [events]);
  const ctaClicks = useMemo(() => events.filter((e: any) => e.event_type === 'cta_click').length, [events]);

  const topPages = useMemo(() => {
    const counts: Record<string, number> = {};
    events.filter((e: any) => e.event_type === 'page_view').forEach((e: any) => {
      const path = e.event_data?.path || e.page_url || '/';
      counts[path] = (counts[path] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([page, views]) => ({ page, views }));
  }, [events]);

  const deviceData = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e: any) => {
      const d = e.device_type || 'unknown';
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [events]);

  const dailyViews = useMemo(() => {
    const counts: Record<string, number> = {};
    events.filter((e: any) => e.event_type === 'page_view').forEach((e: any) => {
      const day = new Date(e.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      counts[day] = (counts[day] || 0) + 1;
    });
    return Object.entries(counts).reverse().map(([day, views]) => ({ day, views }));
  }, [events]);

  const conversionFunnel = useMemo(() => {
    const landing = events.filter((e: any) => e.event_type === 'page_view' && (e.event_data?.path === '/' || e.page_url === '/')).length;
    const pricing = events.filter((e: any) => e.event_type === 'page_view' && (e.event_data?.path === '/pricing' || e.page_url === '/pricing')).length;
    const signupClicks = events.filter((e: any) => e.event_type === 'cta_click' && e.event_data?.button === 'signup').length;
    return [
      { step: 'Landing', value: landing },
      { step: 'Preços', value: pricing },
      { step: 'Clique Criar Conta', value: signupClicks },
    ];
  }, [events]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Dados de visitantes do site público</p>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-heading font-bold">{uniqueSessions}</p>
            <p className="text-xs text-muted-foreground">Visitantes Únicos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-heading font-bold">{pageViews}</p>
            <p className="text-xs text-muted-foreground">Page Views</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-heading font-bold">{ctaClicks}</p>
            <p className="text-xs text-muted-foreground">Cliques em CTAs</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Daily views */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading">Visualizações por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyViews.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyViews}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-center text-muted-foreground text-sm py-8">Sem dados</p>}
          </CardContent>
        </Card>

        {/* Devices */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading">Dispositivos</CardTitle>
          </CardHeader>
          <CardContent>
            {deviceData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={deviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
                      {deviceData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-center text-muted-foreground text-sm py-8">Sem dados</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top pages */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading">Páginas Mais Visitadas</CardTitle>
          </CardHeader>
          <CardContent>
            {topPages.length > 0 ? (
              <div className="space-y-2">
                {topPages.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs truncate max-w-[200px]">{p.page}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(p.views / (topPages[0]?.views || 1)) * 100}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{p.views}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-muted-foreground text-sm py-8">Sem dados</p>}
          </CardContent>
        </Card>

        {/* Conversion funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading">Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            {conversionFunnel.some(s => s.value > 0) ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={conversionFunnel}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="step" fontSize={11} />
                    <YAxis fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Bar dataKey="value" name="Eventos" radius={[4, 4, 0, 0]}>
                      <Cell fill="hsl(var(--primary))" />
                      <Cell fill="hsl(var(--phase-trat))" />
                      <Cell fill="hsl(var(--success))" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-center text-muted-foreground text-sm py-8">Sem dados de conversão</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
