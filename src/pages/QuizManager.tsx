import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ArrowLeft, PencilLine, CheckCircle2, XCircle, CirclePlus, CirclePlay, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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

type Quiz = {
  id: string;
  title: string;
  created_at: string;
};

type ViewMode = 'list' | 'create' | 'quiz-detail' | 'add-question' | 'edit-question';

export default function QuizManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Create quiz state
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [numAlternatives, setNumAlternatives] = useState('4');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdQuizId, setCreatedQuizId] = useState<string | null>(null);

  // Question form state
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correct, setCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  useEffect(() => {
    if (user) loadQuizzes();
  }, [user]);

  const loadQuizzes = async () => {
    const { data } = await supabase.from('quizzes').select('*').eq('teacher_id', user!.id).order('created_at', { ascending: false });
    setQuizzes((data as Quiz[]) || []);
  };

  const loadQuestions = async (quizId: string) => {
    const { data } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('sort_order');
    setQuestions((data as Question[]) || []);
  };

  const createQuiz = async () => {
    if (!newQuizTitle.trim()) { toast.error('Informe o nome do questionário'); return; }
    const { data, error } = await supabase.from('quizzes').insert({ title: newQuizTitle.trim(), teacher_id: user!.id }).select().single();
    if (error || !data) { toast.error('Falha ao criar questionário'); return; }
    setCreatedQuizId(data.id);
    setSelectedQuiz(data as Quiz);
    setQuestions([]);
    setShowSuccessDialog(true);
    loadQuizzes();
  };

  const selectQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    loadQuestions(quiz.id);
    setViewMode('quiz-detail');
  };

  const resetQuestionForm = () => {
    setQText(''); setOptA(''); setOptB(''); setOptC(''); setOptD(''); setCorrect('A');
    setEditingQuestion(null);
  };

  const saveQuestion = async () => {
    if (!qText.trim() || !optA || !optB || !optC || !optD) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (editingQuestion) {
      const { error } = await supabase.from('questions').update({
        question_text: qText.trim(),
        option_a: optA, option_b: optB, option_c: optC, option_d: optD,
        correct_option: correct,
      }).eq('id', editingQuestion.id);
      if (error) { toast.error('Falha ao atualizar questão'); return; }
      toast.success('Questão atualizada!');
    } else {
      const { error } = await supabase.from('questions').insert({
        quiz_id: selectedQuiz!.id,
        question_text: qText.trim(),
        option_a: optA, option_b: optB, option_c: optC, option_d: optD,
        correct_option: correct,
        sort_order: questions.length,
      });
      if (error) { toast.error('Falha ao adicionar questão'); return; }
      toast.success('Questão salva!');
    }
    resetQuestionForm();
    loadQuestions(selectedQuiz!.id);
    setViewMode('quiz-detail');
  };

  const startEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setQText(q.question_text);
    setOptA(q.option_a); setOptB(q.option_b); setOptC(q.option_c); setOptD(q.option_d);
    setCorrect(q.correct_option as 'A' | 'B' | 'C' | 'D');
    setViewMode('edit-question');
  };

  const deleteQuestion = async (id: string) => {
    await supabase.from('questions').delete().eq('id', id);
    loadQuestions(selectedQuiz!.id);
    toast.success('Questão excluída');
  };

  const deleteQuiz = async (id: string) => {
    await supabase.from('quizzes').delete().eq('id', id);
    setSelectedQuiz(null);
    setQuestions([]);
    setViewMode('list');
    loadQuizzes();
    toast.success('Questionário excluído');
  };

  const handleSuccessOk = () => {
    setShowSuccessDialog(false);
    setViewMode('quiz-detail');
  };

  const optionLabels = ['A', 'B', 'C', 'D'] as const;

  // ===== ADD/EDIT QUESTION VIEW =====
  if (viewMode === 'add-question' || viewMode === 'edit-question') {
    const questionNumber = editingQuestion
      ? questions.findIndex(q => q.id === editingQuestion.id) + 1
      : questions.length + 1;

    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-card px-6 py-3">
          <h1 className="text-xl font-bold">{editingQuestion ? 'Editar Questão' : 'Nova Questão'}</h1>
          <div className="border-b-2 border-destructive mt-2" />
        </header>

        <div className="flex">
          <main className="flex-1 p-6 space-y-6">
            <h2 className="text-center text-xl font-semibold text-primary">Questão {questionNumber}</h2>

            <div className="border rounded-lg bg-card p-4 space-y-2">
              <Label className="text-center block font-semibold">Enunciado</Label>
              <Textarea
                value={qText}
                onChange={e => setQText(e.target.value)}
                placeholder="Informe o Enunciado da questão."
                className="min-h-[150px]"
              />
            </div>

            {optionLabels.map((opt) => {
              const isCorrect = correct === opt;
              const value = opt === 'A' ? optA : opt === 'B' ? optB : opt === 'C' ? optC : optD;
              const setter = opt === 'A' ? setOptA : opt === 'B' ? setOptB : opt === 'C' ? setOptC : setOptD;

              return (
                <div
                  key={opt}
                  className={`border-l-4 rounded-lg p-4 space-y-2 cursor-pointer transition-colors ${
                    isCorrect ? 'border-l-green-500 bg-green-50' : 'border-l-muted bg-card'
                  }`}
                  onClick={() => setCorrect(opt)}
                >
                  <div className="flex items-center gap-2">
                    {isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive" />
                    )}
                    <span className="font-semibold">Alternativa {opt})</span>
                  </div>
                  {isCorrect && (
                    <p className="text-sm text-green-700 font-medium">Selecionada como Resposta Correta</p>
                  )}
                  <Textarea
                    value={value}
                    onChange={e => setter(e.target.value)}
                    placeholder="Digite a resposta"
                    className="min-h-[60px]"
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              );
            })}
          </main>

          {/* Sidebar Ações */}
          <aside className="w-56 bg-blue-100/60 border-l min-h-screen p-0">
            <div className="bg-blue-200/80 px-4 py-3 font-bold text-sm">Ações</div>
            <div className="space-y-1 p-2">
              <button
                onClick={() => { resetQuestionForm(); setViewMode('quiz-detail'); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-blue-200/40 rounded transition-colors"
              >
                <XCircle className="w-5 h-5 text-destructive" /> Cancelar
              </button>
              <button
                onClick={saveQuestion}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-blue-200/40 rounded transition-colors"
              >
                <CheckCircle2 className="w-5 h-5 text-green-600" /> Salvar
              </button>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ===== QUIZ DETAIL / CREATE VIEW =====
  if (viewMode === 'create' || viewMode === 'quiz-detail') {
    const isNew = viewMode === 'create' && !selectedQuiz;
    const quizTitle = selectedQuiz?.title || newQuizTitle;

    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-card px-6 py-3">
          <h1 className="text-xl font-bold">{isNew ? 'Novo Questionário' : 'Novo Questionário'}</h1>
          <div className="border-b-2 border-destructive mt-2" />
        </header>

        <div className="flex">
          <main className="flex-1 p-6 space-y-6">
            <h2 className="text-center text-xl font-semibold text-primary">Questionário</h2>

            <div className="flex gap-6 items-start">
              <div className="flex-1 space-y-1">
                <Label className="text-sm text-primary">Nome do Questionário</Label>
                <Input
                  value={selectedQuiz ? selectedQuiz.title : newQuizTitle}
                  onChange={e => {
                    if (!selectedQuiz) setNewQuizTitle(e.target.value);
                  }}
                  readOnly={!!selectedQuiz}
                  placeholder="Nome do questionário"
                />
              </div>
              <div className="w-64 space-y-1">
                <Label className="text-sm text-primary">Quantidade de Alternativas por Questão</Label>
                <Select value={numAlternatives} onValueChange={setNumAlternatives}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedQuiz && (
              <>
                <div className="flex items-center gap-2 text-lg">
                  <span>Questões:</span>
                  <span className="text-2xl font-bold text-primary">{questions.length}</span>
                  <span className="text-muted-foreground">/ {numAlternatives === '2' ? '10' : '5'}</span>
                  <HelpCircle className="w-5 h-5 text-primary" />
                </div>

                {questions.length > 0 && (
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-blue-100/60">
                          <th className="text-left px-4 py-2 w-16">Nº</th>
                          <th className="text-left px-4 py-2">Questão</th>
                          <th className="text-center px-4 py-2 w-32">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {questions.map((q, i) => (
                          <tr key={q.id} className="border-t hover:bg-muted/30">
                            <td className="px-4 py-2">{i + 1}</td>
                            <td className="px-4 py-2">{q.question_text}</td>
                            <td className="px-4 py-2 text-center">
                              <div className="flex justify-center gap-2">
                                <button onClick={() => startEditQuestion(q)} className="hover:text-primary">
                                  <PencilLine className="w-5 h-5" />
                                </button>
                                <button onClick={() => deleteQuestion(q.id)} className="hover:text-destructive">
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </main>

          {/* Sidebar Ações */}
          <aside className="w-56 bg-blue-100/60 border-l min-h-screen p-0">
            <div className="bg-blue-200/80 px-4 py-3 font-bold text-sm">Ações</div>
            <div className="space-y-1 p-2">
              {selectedQuiz && (
                <>
                  <button
                    onClick={() => { resetQuestionForm(); setViewMode('add-question'); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-blue-200/40 rounded transition-colors"
                  >
                    <CirclePlus className="w-5 h-5 text-primary" /> Adicionar Questão
                  </button>
                  {questions.length > 0 && (
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-blue-200/40 rounded transition-colors"
                    >
                      <CirclePlay className="w-5 h-5 text-orange-500" /> Aplicar Questionário
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => {
                  resetQuestionForm();
                  setSelectedQuiz(null);
                  setNewQuizTitle('');
                  setViewMode('list');
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-blue-200/40 rounded transition-colors"
              >
                <XCircle className="w-5 h-5 text-destructive" /> Cancelar
              </button>
              <button
                onClick={() => {
                  if (!selectedQuiz) {
                    createQuiz();
                  } else {
                    toast.success('Questionário salvo!');
                    setViewMode('list');
                  }
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-blue-200/40 rounded transition-colors"
              >
                <CheckCircle2 className="w-5 h-5 text-green-600" /> Salvar
              </button>
            </div>
          </aside>
        </div>

        {/* Success Dialog */}
        <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <DialogContent className="text-center max-w-sm">
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-20 h-20 rounded-full border-4 border-green-200 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold">Sucesso</h2>
              <p className="text-muted-foreground">Questionário criado com sucesso!</p>
              <Button onClick={handleSuccessOk} className="bg-primary">Ok</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ===== QUIZ LIST VIEW =====
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-heading font-bold">Banco de Questões</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-heading font-semibold">Seus Questionários</h2>
          <Button size="sm" onClick={() => { setNewQuizTitle(''); setViewMode('create'); }}>
            <Plus className="w-4 h-4 mr-1" /> Novo Questionário
          </Button>
        </div>
        {quizzes.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum questionário ainda.</p>
        ) : (
          <div className="space-y-2">
            {quizzes.map(q => (
              <Card key={q.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => selectQuiz(q)}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{q.title}</p>
                    <p className="text-sm text-muted-foreground">Criado em {new Date(q.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); deleteQuiz(q.id); }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
