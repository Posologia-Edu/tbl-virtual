import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Search, Copy, Download, Upload, BookOpen, Filter, Share2, Eye,
  ChevronDown, ChevronUp, FileText, Tag, BarChart3, Globe, Lock,
} from 'lucide-react';
import { toast } from 'sonner';

type SharedQuiz = {
  id: string;
  title: string;
  discipline: string | null;
  theme: string | null;
  difficulty_level: string | null;
  is_shared: boolean;
  teacher_id: string;
  created_at: string;
  question_count?: number;
  app_question_count?: number;
  teacher_name?: string;
  institution?: string;
};

type QuestionDetail = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
};

type AppQuestionDetail = {
  id: string;
  question_text: string;
  correct_answer: string | null;
};

interface QuestionBankProps {
  userId: string;
}

const difficultyLabels: Record<string, { label: string; color: string }> = {
  easy: { label: 'Fácil', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  medium: { label: 'Médio', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  hard: { label: 'Difícil', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
};

export default function QuestionBank({ userId }: QuestionBankProps) {
  const [sharedQuizzes, setSharedQuizzes] = useState<SharedQuiz[]>([]);
  const [myQuizzes, setMyQuizzes] = useState<SharedQuiz[]>([]);
  const [search, setSearch] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<QuestionDetail[]>([]);
  const [previewAppQuestions, setPreviewAppQuestions] = useState<AppQuestionDetail[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Edit metadata dialog
  const [editDialog, setEditDialog] = useState(false);
  const [editQuiz, setEditQuiz] = useState<SharedQuiz | null>(null);
  const [editDiscipline, setEditDiscipline] = useState('');
  const [editTheme, setEditTheme] = useState('');
  const [editDifficulty, setEditDifficulty] = useState('medium');
  const [editShared, setEditShared] = useState(false);

  // CSV import
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Tab: 'shared' or 'mine'
  const [tab, setTab] = useState<'shared' | 'mine'>('shared');

  useEffect(() => {
    loadQuizzes();
  }, [userId]);

  const loadQuizzes = async () => {
    setLoading(true);
    // Load shared quizzes (not mine)
    const { data: shared } = await supabase
      .from('quizzes')
      .select('*')
      .eq('is_shared', true)
      .neq('teacher_id', userId)
      .order('created_at', { ascending: false });

    // Load my quizzes
    const { data: mine } = await supabase
      .from('quizzes')
      .select('*')
      .eq('teacher_id', userId)
      .order('created_at', { ascending: false });

    // Get question counts
    const enrichQuizzes = async (quizzes: any[]): Promise<SharedQuiz[]> => {
      if (!quizzes?.length) return [];
      const ids = quizzes.map(q => q.id);
      const [{ data: qCounts }, { data: aqCounts }] = await Promise.all([
        supabase.from('questions').select('quiz_id').in('quiz_id', ids),
        supabase.from('application_questions').select('quiz_id').in('quiz_id', ids),
      ]);

      // Get teacher profiles for shared quizzes
      const teacherIds = [...new Set(quizzes.map(q => q.teacher_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, institution')
        .in('id', teacherIds);

      return quizzes.map(q => {
        const profile = profiles?.find(p => p.id === q.teacher_id);
        return {
          ...q,
          question_count: qCounts?.filter(qc => qc.quiz_id === q.id).length || 0,
          app_question_count: aqCounts?.filter(ac => ac.quiz_id === q.id).length || 0,
          teacher_name: profile?.full_name || 'Desconhecido',
          institution: profile?.institution || '',
        };
      });
    };

    const [enrichedShared, enrichedMine] = await Promise.all([
      enrichQuizzes(shared || []),
      enrichQuizzes(mine || []),
    ]);

    setSharedQuizzes(enrichedShared);
    setMyQuizzes(enrichedMine);
    setLoading(false);
  };

  const togglePreview = async (quizId: string) => {
    if (expandedQuiz === quizId) {
      setExpandedQuiz(null);
      return;
    }
    setExpandedQuiz(quizId);
    setPreviewLoading(true);
    const [{ data: qs }, { data: aqs }] = await Promise.all([
      supabase.from('questions').select('id, question_text, option_a, option_b, option_c, option_d, correct_option').eq('quiz_id', quizId).order('sort_order'),
      supabase.from('application_questions').select('id, question_text, correct_answer').eq('quiz_id', quizId).order('sort_order'),
    ]);
    setPreviewQuestions((qs as QuestionDetail[]) || []);
    setPreviewAppQuestions((aqs as AppQuestionDetail[]) || []);
    setPreviewLoading(false);
  };

  const duplicateQuiz = async (quiz: SharedQuiz) => {
    try {
      // Create new quiz
      const { data: newQuiz, error } = await supabase.from('quizzes').insert({
        title: `${quiz.title} (Cópia)`,
        teacher_id: userId,
        discipline: quiz.discipline,
        theme: quiz.theme,
        difficulty_level: quiz.difficulty_level,
        is_shared: false,
      } as any).select().single();
      if (error || !newQuiz) throw error;

      // Copy iRAT/tRAT questions
      const { data: origQs } = await supabase.from('questions').select('*').eq('quiz_id', quiz.id).order('sort_order');
      if (origQs?.length) {
        await supabase.from('questions').insert(origQs.map((q: any) => ({
          quiz_id: newQuiz.id,
          question_text: q.question_text,
          option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
          correct_option: q.correct_option,
          sort_order: q.sort_order,
        })));
      }

      // Copy application questions
      const { data: origAqs } = await supabase.from('application_questions').select('*').eq('quiz_id', quiz.id).order('sort_order');
      if (origAqs?.length) {
        await supabase.from('application_questions').insert(origAqs.map((q: any) => ({
          quiz_id: newQuiz.id,
          question_text: q.question_text,
          option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
          correct_answer: q.correct_answer,
          sort_order: q.sort_order,
        })));
      }

      toast.success('Questionário duplicado com sucesso!');
      loadQuizzes();
    } catch (err: any) {
      toast.error('Falha ao duplicar: ' + (err?.message || ''));
    }
  };

  const openEditDialog = (quiz: SharedQuiz) => {
    setEditQuiz(quiz);
    setEditDiscipline(quiz.discipline || '');
    setEditTheme(quiz.theme || '');
    setEditDifficulty(quiz.difficulty_level || 'medium');
    setEditShared(quiz.is_shared);
    setEditDialog(true);
  };

  const saveMetadata = async () => {
    if (!editQuiz) return;
    const { error } = await supabase.from('quizzes').update({
      discipline: editDiscipline.trim() || null,
      theme: editTheme.trim() || null,
      difficulty_level: editDifficulty,
      is_shared: editShared,
    } as any).eq('id', editQuiz.id);
    if (error) { toast.error('Falha ao salvar'); return; }
    toast.success('Metadados atualizados!');
    setEditDialog(false);
    loadQuizzes();
  };

  // CSV Export
  const exportCSV = async (quiz: SharedQuiz) => {
    const [{ data: qs }, { data: aqs }] = await Promise.all([
      supabase.from('questions').select('*').eq('quiz_id', quiz.id).order('sort_order'),
      supabase.from('application_questions').select('*').eq('quiz_id', quiz.id).order('sort_order'),
    ]);

    let csv = 'tipo;enunciado;opcao_a;opcao_b;opcao_c;opcao_d;resposta_correta\n';
    (qs || []).forEach((q: any) => {
      csv += `iRAT;"${q.question_text}";"${q.option_a}";"${q.option_b}";"${q.option_c}";"${q.option_d}";${q.correct_option}\n`;
    });
    (aqs || []).forEach((q: any) => {
      csv += `Aplicação;"${q.question_text}";"V";"F";"";"";"${q.correct_answer || ''}"\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quiz.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  // CSV Import
  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { toast.error('Arquivo CSV vazio ou inválido'); return; }

    const iratQuestions: any[] = [];
    const appQuestions: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Parse CSV with semicolon separator and quoted fields
      const parts = lines[i].split(';').map(p => p.replace(/^"|"$/g, '').trim());
      if (parts.length < 7) continue;
      const [tipo, enunciado, a, b, c, d, correta] = parts;

      if (tipo.toLowerCase().includes('irat') || tipo.toLowerCase().includes('trat')) {
        iratQuestions.push({
          question_text: enunciado, option_a: a, option_b: b, option_c: c, option_d: d,
          correct_option: correta.toUpperCase(),
          sort_order: iratQuestions.length,
        });
      } else {
        appQuestions.push({
          question_text: enunciado, option_a: 'V', option_b: 'F', option_c: null, option_d: null,
          correct_answer: correta.toUpperCase() === 'V' ? 'V' : 'F',
          sort_order: appQuestions.length,
        });
      }
    }

    if (iratQuestions.length === 0 && appQuestions.length === 0) {
      toast.error('Nenhuma questão encontrada no CSV');
      return;
    }

    // Create quiz from filename
    const title = file.name.replace(/\.csv$/i, '').replace(/_/g, ' ');
    const { data: quiz, error } = await supabase.from('quizzes')
      .insert({ title, teacher_id: userId } as any).select().single();
    if (error || !quiz) { toast.error('Falha ao criar questionário'); return; }

    if (iratQuestions.length) {
      await supabase.from('questions').insert(iratQuestions.map(q => ({ ...q, quiz_id: quiz.id })));
    }
    if (appQuestions.length) {
      await supabase.from('application_questions').insert(appQuestions.map(q => ({ ...q, quiz_id: quiz.id })));
    }

    toast.success(`Importado: ${iratQuestions.length} iRAT + ${appQuestions.length} aplicação`);
    loadQuizzes();
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  // Filter logic
  const disciplines = [...new Set([...sharedQuizzes, ...myQuizzes].map(q => q.discipline).filter(Boolean))] as string[];

  const filterQuizzes = (list: SharedQuiz[]) => {
    return list.filter(q => {
      const matchSearch = !search || q.title.toLowerCase().includes(search.toLowerCase()) ||
        (q.discipline || '').toLowerCase().includes(search.toLowerCase()) ||
        (q.theme || '').toLowerCase().includes(search.toLowerCase()) ||
        (q.teacher_name || '').toLowerCase().includes(search.toLowerCase());
      const matchDiscipline = filterDiscipline === 'all' || q.discipline === filterDiscipline;
      const matchDifficulty = filterDifficulty === 'all' || q.difficulty_level === filterDifficulty;
      return matchSearch && matchDiscipline && matchDifficulty;
    });
  };

  const displayList = tab === 'shared' ? filterQuizzes(sharedQuizzes) : filterQuizzes(myQuizzes);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando banco de questões...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" /> Banco de Questões
          </h2>
          <p className="text-sm text-muted-foreground">Compartilhe, duplique e importe questionários</p>
        </div>
        <div className="flex gap-2">
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
          <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" /> Importar CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab('shared')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'shared' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Globe className="w-4 h-4 inline mr-1" /> Compartilhados ({sharedQuizzes.length})
        </button>
        <button
          onClick={() => setTab('mine')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'mine' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Lock className="w-4 h-4 inline mr-1" /> Meus Questionários ({myQuizzes.length})
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, disciplina, tema ou autor..." className="pl-9" />
          </div>
        </div>
        <Select value={filterDiscipline} onValueChange={setFilterDiscipline}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Disciplina" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas disciplinas</SelectItem>
            {disciplines.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Dificuldade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos níveis</SelectItem>
            <SelectItem value="easy">Fácil</SelectItem>
            <SelectItem value="medium">Médio</SelectItem>
            <SelectItem value="hard">Difícil</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quiz list */}
      {displayList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tab === 'shared'
              ? 'Nenhum questionário compartilhado encontrado. Professores podem compartilhar seus questionários na aba "Meus Questionários".'
              : 'Nenhum questionário encontrado com os filtros aplicados.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayList.map(quiz => (
            <Card key={quiz.id} className="overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{quiz.title}</h3>
                      {quiz.is_shared && <Badge variant="secondary" className="text-xs"><Share2 className="w-3 h-3 mr-1" />Compartilhado</Badge>}
                      {quiz.difficulty_level && difficultyLabels[quiz.difficulty_level] && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${difficultyLabels[quiz.difficulty_level].color}`}>
                          {difficultyLabels[quiz.difficulty_level].label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                      {quiz.discipline && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{quiz.discipline}</span>}
                      {quiz.theme && <span>• {quiz.theme}</span>}
                      <span>• {quiz.question_count} iRAT + {quiz.app_question_count} aplicação</span>
                      {tab === 'shared' && <span>• Por: {quiz.teacher_name}{quiz.institution ? ` (${quiz.institution})` : ''}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => togglePreview(quiz.id)} title="Visualizar questões">
                      <Eye className="w-4 h-4" />
                      {expandedQuiz === quiz.id ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => duplicateQuiz(quiz)} title="Duplicar para meus questionários">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => exportCSV(quiz)} title="Exportar CSV">
                      <Download className="w-4 h-4" />
                    </Button>
                    {quiz.teacher_id === userId && (
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(quiz)} title="Editar metadados e compartilhamento">
                        <Filter className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview */}
              {expandedQuiz === quiz.id && (
                <div className="border-t bg-muted/30 p-4">
                  {previewLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando questões...</p>
                  ) : (
                    <div className="space-y-4">
                      {previewQuestions.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Questões iRAT/tRAT</h4>
                          <div className="space-y-2">
                            {previewQuestions.map((q, i) => (
                              <div key={q.id} className="bg-card rounded p-3 text-sm">
                                <p className="font-medium">{i + 1}. {q.question_text}</p>
                                <div className="grid grid-cols-2 gap-1 mt-1 text-muted-foreground">
                                  {['A', 'B', 'C', 'D'].map(opt => {
                                    const val = q[`option_${opt.toLowerCase()}` as keyof QuestionDetail];
                                    const isCorrect = q.correct_option === opt;
                                    return (
                                      <span key={opt} className={isCorrect ? 'text-primary font-semibold' : ''}>
                                        {opt}) {val}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {previewAppQuestions.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Questões de Aplicação</h4>
                          <div className="space-y-2">
                            {previewAppQuestions.map((q, i) => (
                              <div key={q.id} className="bg-card rounded p-3 text-sm">
                                <p className="font-medium">{i + 1}. {q.question_text}</p>
                                <p className="text-xs text-muted-foreground mt-1">Gabarito: {q.correct_answer?.trim() || '—'}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {previewQuestions.length === 0 && previewAppQuestions.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhuma questão cadastrada neste questionário.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Edit metadata dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Metadados</DialogTitle>
            <DialogDescription>Configure a categorização e compartilhamento do questionário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Disciplina</Label>
              <Input value={editDiscipline} onChange={e => setEditDiscipline(e.target.value)} placeholder="Ex: Farmacologia, Anatomia" />
            </div>
            <div className="space-y-2">
              <Label>Tema</Label>
              <Input value={editTheme} onChange={e => setEditTheme(e.target.value)} placeholder="Ex: Antibióticos, Sistema Nervoso" />
            </div>
            <div className="space-y-2">
              <Label>Nível de Dificuldade</Label>
              <Select value={editDifficulty} onValueChange={setEditDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Fácil</SelectItem>
                  <SelectItem value="medium">Médio</SelectItem>
                  <SelectItem value="hard">Difícil</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold">Compartilhar com outros professores</Label>
                <p className="text-xs text-muted-foreground">Professores poderão visualizar e duplicar este questionário</p>
              </div>
              <Switch checked={editShared} onCheckedChange={setEditShared} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancelar</Button>
            <Button onClick={saveMetadata}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
