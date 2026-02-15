import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ArrowLeft, PencilLine, CheckCircle2, XCircle, CirclePlus, CirclePlay, HelpCircle, BookOpen, FileQuestion } from 'lucide-react';
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

type AppQuestion = {
  id: string;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  sort_order: number;
  quiz_id: string | null;
};

type Quiz = {
  id: string;
  title: string;
  created_at: string;
};

type ViewMode = 'list' | 'create' | 'quiz-detail' | 'add-question' | 'edit-question' | 'add-app-question' | 'edit-app-question';

export default function QuizManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [appQuestions, setAppQuestions] = useState<AppQuestion[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Create quiz state
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [numAlternatives, setNumAlternatives] = useState('4');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdQuizId, setCreatedQuizId] = useState<string | null>(null);

  // Question type choice dialog
  const [showTypeDialog, setShowTypeDialog] = useState(false);

  // iRAT/tRAT Question form state
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correct, setCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Application question form state
  const [appQText, setAppQText] = useState('');
  const [appOptA, setAppOptA] = useState('');
  const [appOptB, setAppOptB] = useState('');
  const [appOptC, setAppOptC] = useState('');
  const [appOptD, setAppOptD] = useState('');
  const [editingAppQuestion, setEditingAppQuestion] = useState<AppQuestion | null>(null);

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

  const loadAppQuestions = async (quizId: string) => {
    const { data } = await supabase.from('application_questions').select('*').eq('quiz_id', quizId).order('sort_order');
    setAppQuestions((data as AppQuestion[]) || []);
  };

  const createQuiz = async () => {
    if (!newQuizTitle.trim()) { toast.error('Informe o nome do questionário'); return; }
    const { data, error } = await supabase.from('quizzes').insert({ title: newQuizTitle.trim(), teacher_id: user!.id }).select().single();
    if (error || !data) { toast.error('Falha ao criar questionário'); return; }
    setCreatedQuizId(data.id);
    setSelectedQuiz(data as Quiz);
    setQuestions([]);
    setAppQuestions([]);
    setShowSuccessDialog(true);
    loadQuizzes();
  };

  const selectQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    loadQuestions(quiz.id);
    loadAppQuestions(quiz.id);
    setViewMode('quiz-detail');
  };

  const resetQuestionForm = () => {
    setQText(''); setOptA(''); setOptB(''); setOptC(''); setOptD(''); setCorrect('A');
    setEditingQuestion(null);
  };

  const resetAppQuestionForm = () => {
    setAppQText(''); setAppOptA(''); setAppOptB(''); setAppOptC(''); setAppOptD('');
    setEditingAppQuestion(null);
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

  const saveAppQuestion = async () => {
    if (!appQText.trim() || !appOptA || !appOptB || !appOptC || !appOptD) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (editingAppQuestion) {
      const { error } = await supabase.from('application_questions').update({
        question_text: appQText.trim(),
        option_a: appOptA, option_b: appOptB, option_c: appOptC, option_d: appOptD,
      }).eq('id', editingAppQuestion.id);
      if (error) { toast.error('Falha ao atualizar questão'); return; }
      toast.success('Questão de aplicação atualizada!');
    } else {
      const { error } = await supabase.from('application_questions').insert({
        quiz_id: selectedQuiz!.id,
        question_text: appQText.trim(),
        option_a: appOptA, option_b: appOptB, option_c: appOptC, option_d: appOptD,
        sort_order: appQuestions.length,
      });
      if (error) { toast.error('Falha ao adicionar questão'); return; }
      toast.success('Questão de aplicação salva!');
    }
    resetAppQuestionForm();
    loadAppQuestions(selectedQuiz!.id);
    setViewMode('quiz-detail');
  };

  const startEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setQText(q.question_text);
    setOptA(q.option_a); setOptB(q.option_b); setOptC(q.option_c); setOptD(q.option_d);
    setCorrect(q.correct_option as 'A' | 'B' | 'C' | 'D');
    setViewMode('edit-question');
  };

  const startEditAppQuestion = (q: AppQuestion) => {
    setEditingAppQuestion(q);
    setAppQText(q.question_text);
    setAppOptA(q.option_a || ''); setAppOptB(q.option_b || ''); setAppOptC(q.option_c || ''); setAppOptD(q.option_d || '');
    setViewMode('edit-app-question');
  };

  const deleteQuestion = async (id: string) => {
    await supabase.from('questions').delete().eq('id', id);
    loadQuestions(selectedQuiz!.id);
    toast.success('Questão excluída');
  };

  const deleteAppQuestion = async (id: string) => {
    await supabase.from('application_questions').delete().eq('id', id);
    loadAppQuestions(selectedQuiz!.id);
    toast.success('Questão de aplicação excluída');
  };

  const deleteQuiz = async (id: string) => {
    await supabase.from('quizzes').delete().eq('id', id);
    setSelectedQuiz(null);
    setQuestions([]);
    setAppQuestions([]);
    setViewMode('list');
    loadQuizzes();
    toast.success('Questionário excluído');
  };

  const handleSuccessOk = () => {
    setShowSuccessDialog(false);
    setViewMode('quiz-detail');
  };

  const handleChooseQuestionType = (type: 'irat' | 'application') => {
    setShowTypeDialog(false);
    if (type === 'irat') {
      resetQuestionForm();
      setViewMode('add-question');
    } else {
      resetAppQuestionForm();
      setViewMode('add-app-question');
    }
  };

  const optionLabels = ['A', 'B', 'C', 'D'] as const;

  // ===== ADD/EDIT iRAT/tRAT QUESTION VIEW =====
  if (viewMode === 'add-question' || viewMode === 'edit-question') {
    const questionNumber = editingQuestion
      ? questions.findIndex(q => q.id === editingQuestion.id) + 1
      : questions.length + 1;

    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-card px-6 py-3">
          <h1 className="text-xl font-bold">{editingQuestion ? 'Editar Questão iRAT/tRAT' : 'Nova Questão iRAT/tRAT'}</h1>
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

  // ===== ADD/EDIT APPLICATION QUESTION VIEW =====
  if (viewMode === 'add-app-question' || viewMode === 'edit-app-question') {
    const questionNumber = editingAppQuestion
      ? appQuestions.findIndex(q => q.id === editingAppQuestion.id) + 1
      : appQuestions.length + 1;

    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-card px-6 py-3">
          <h1 className="text-xl font-bold">{editingAppQuestion ? 'Editar Questão de Aplicação' : 'Nova Questão de Aplicação'}</h1>
          <div className="border-b-2 border-orange-400 mt-2" />
        </header>

        <div className="flex">
          <main className="flex-1 p-6 space-y-6">
            <h2 className="text-center text-xl font-semibold text-orange-600">Questão de Aplicação {questionNumber}</h2>

            <div className="border rounded-lg bg-card p-4 space-y-2">
              <Label className="text-center block font-semibold">Enunciado</Label>
              <Textarea
                value={appQText}
                onChange={e => setAppQText(e.target.value)}
                placeholder="Informe o enunciado da questão de aplicação."
                className="min-h-[150px]"
              />
            </div>

            {optionLabels.map((opt) => {
              const value = opt === 'A' ? appOptA : opt === 'B' ? appOptB : opt === 'C' ? appOptC : appOptD;
              const setter = opt === 'A' ? setAppOptA : opt === 'B' ? setAppOptB : opt === 'C' ? setAppOptC : setAppOptD;

              return (
                <div
                  key={opt}
                  className="border-l-4 border-l-orange-300 rounded-lg p-4 space-y-2 bg-card"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Alternativa {opt})</span>
                  </div>
                  <Textarea
                    value={value}
                    onChange={e => setter(e.target.value)}
                    placeholder="Digite a alternativa"
                    className="min-h-[60px]"
                  />
                </div>
              );
            })}
          </main>

          <aside className="w-56 bg-orange-100/60 border-l min-h-screen p-0">
            <div className="bg-orange-200/80 px-4 py-3 font-bold text-sm">Ações</div>
            <div className="space-y-1 p-2">
              <button
                onClick={() => { resetAppQuestionForm(); setViewMode('quiz-detail'); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-orange-200/40 rounded transition-colors"
              >
                <XCircle className="w-5 h-5 text-destructive" /> Cancelar
              </button>
              <button
                onClick={saveAppQuestion}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-orange-200/40 rounded transition-colors"
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

    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-card px-6 py-3">
          <h1 className="text-xl font-bold">{isNew ? 'Novo Questionário' : 'Questionário'}</h1>
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
                {/* iRAT/tRAT Questions Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-lg border-b pb-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    <span className="font-semibold">Questões iRAT / tRAT</span>
                    <span className="text-2xl font-bold text-primary ml-2">{questions.length}</span>
                  </div>

                  {questions.length > 0 && (
                    <div className="border rounded overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-blue-100/60">
                            <th className="text-left px-4 py-2 w-16">Nº</th>
                            <th className="text-left px-4 py-2">Questão</th>
                            <th className="text-center px-4 py-2 w-24">Gabarito</th>
                            <th className="text-center px-4 py-2 w-32">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {questions.map((q, i) => (
                            <tr key={q.id} className="border-t hover:bg-muted/30">
                              <td className="px-4 py-2">{i + 1}</td>
                              <td className="px-4 py-2">{q.question_text}</td>
                              <td className="px-4 py-2 text-center font-bold text-green-600">{q.correct_option}</td>
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
                  {questions.length === 0 && (
                    <p className="text-muted-foreground text-sm text-center py-3">Nenhuma questão iRAT/tRAT adicionada.</p>
                  )}
                </div>

                {/* Application Questions Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-lg border-b pb-2">
                    <FileQuestion className="w-5 h-5 text-orange-500" />
                    <span className="font-semibold">Questões de Aplicação</span>
                    <span className="text-2xl font-bold text-orange-500 ml-2">{appQuestions.length}</span>
                  </div>

                  {appQuestions.length > 0 && (
                    <div className="border rounded overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-orange-100/60">
                            <th className="text-left px-4 py-2 w-16">Nº</th>
                            <th className="text-left px-4 py-2">Questão</th>
                            <th className="text-center px-4 py-2 w-32">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {appQuestions.map((q, i) => (
                            <tr key={q.id} className="border-t hover:bg-muted/30">
                              <td className="px-4 py-2">{i + 1}</td>
                              <td className="px-4 py-2">{q.question_text}</td>
                              <td className="px-4 py-2 text-center">
                                <div className="flex justify-center gap-2">
                                  <button onClick={() => startEditAppQuestion(q)} className="hover:text-primary">
                                    <PencilLine className="w-5 h-5" />
                                  </button>
                                  <button onClick={() => deleteAppQuestion(q.id)} className="hover:text-destructive">
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
                  {appQuestions.length === 0 && (
                    <p className="text-muted-foreground text-sm text-center py-3">Nenhuma questão de aplicação adicionada.</p>
                  )}
                </div>
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
                    onClick={() => setShowTypeDialog(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-blue-200/40 rounded transition-colors"
                  >
                    <CirclePlus className="w-5 h-5 text-primary" /> Adicionar Questão
                  </button>
                  {(questions.length > 0 || appQuestions.length > 0) && (
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
                  resetAppQuestionForm();
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

        {/* Question Type Choice Dialog */}
        <Dialog open={showTypeDialog} onOpenChange={setShowTypeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center text-lg">Tipo de Questão</DialogTitle>
              <DialogDescription className="text-center">Selecione o tipo de questão que deseja criar</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <button
                onClick={() => handleChooseQuestionType('irat')}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-primary/20 hover:border-primary hover:bg-primary/5 transition-all"
              >
                <BookOpen className="w-10 h-10 text-primary" />
                <span className="font-semibold text-sm">iRAT / tRAT</span>
                <span className="text-xs text-muted-foreground text-center">Questão com gabarito para avaliação individual e em equipe</span>
              </button>
              <button
                onClick={() => handleChooseQuestionType('application')}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-orange-300/40 hover:border-orange-400 hover:bg-orange-50 transition-all"
              >
                <FileQuestion className="w-10 h-10 text-orange-500" />
                <span className="font-semibold text-sm">Aplicação</span>
                <span className="text-xs text-muted-foreground text-center">Questão para a fase de aplicação dos conceitos</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>

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
