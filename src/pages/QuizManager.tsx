import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
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

export default function QuizManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correct, setCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [addQOpen, setAddQOpen] = useState(false);

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
    if (!newQuizTitle.trim()) return;
    const { error } = await supabase.from('quizzes').insert({ title: newQuizTitle.trim(), teacher_id: user!.id });
    if (error) { toast.error('Falha ao criar quiz'); return; }
    toast.success('Quiz criado!');
    setNewQuizTitle('');
    setCreateOpen(false);
    loadQuizzes();
  };

  const selectQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    loadQuestions(quiz.id);
  };

  const addQuestion = async () => {
    if (!qText.trim() || !optA || !optB || !optC || !optD) {
      toast.error('Preencha todos os campos');
      return;
    }
    const { error } = await supabase.from('questions').insert({
      quiz_id: selectedQuiz!.id,
      question_text: qText.trim(),
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      correct_option: correct,
      sort_order: questions.length,
    });
    if (error) { toast.error('Falha ao adicionar questão'); return; }
    toast.success('Questão adicionada!');
    setQText(''); setOptA(''); setOptB(''); setOptC(''); setOptD(''); setCorrect('A');
    setAddQOpen(false);
    loadQuestions(selectedQuiz!.id);
  };

  const deleteQuestion = async (id: string) => {
    await supabase.from('questions').delete().eq('id', id);
    loadQuestions(selectedQuiz!.id);
  };

  const deleteQuiz = async (id: string) => {
    await supabase.from('quizzes').delete().eq('id', id);
    setSelectedQuiz(null);
    setQuestions([]);
    loadQuizzes();
    toast.success('Quiz excluído');
  };

  if (selectedQuiz) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedQuiz(null)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl font-heading font-bold">{selectedQuiz.title}</h1>
              <p className="text-sm text-muted-foreground">{questions.length} questões</p>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-heading font-semibold">Questões</h2>
            <Dialog open={addQOpen} onOpenChange={setAddQOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Adicionar Questão</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-heading">Adicionar Questão</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label>Questão</Label>
                    <Input value={qText} onChange={e => setQText(e.target.value)} placeholder="Digite sua questão..." />
                  </div>
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                    <div key={opt} className="space-y-1">
                      <Label className="flex items-center gap-2">
                        <span>Opção {opt}</span>
                        {correct === opt && <span className="text-xs px-1.5 py-0.5 rounded bg-success text-success-foreground">Correta</span>}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          className="flex-1"
                          value={opt === 'A' ? optA : opt === 'B' ? optB : opt === 'C' ? optC : optD}
                          onChange={e => {
                            const v = e.target.value;
                            if (opt === 'A') setOptA(v);
                            else if (opt === 'B') setOptB(v);
                            else if (opt === 'C') setOptC(v);
                            else setOptD(v);
                          }}
                          placeholder={`Opção ${opt}`}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant={correct === opt ? 'default' : 'outline'}
                          onClick={() => setCorrect(opt)}
                        >
                          ✓
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button onClick={addQuestion} className="w-full">Adicionar Questão</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {questions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma questão ainda.</p>
          ) : (
            <div className="space-y-3">
              {questions.map((q, i) => (
                <Card key={q.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium mb-2">
                          <span className="text-muted-foreground mr-2">Q{i + 1}.</span>
                          {q.question_text}
                        </p>
                        <div className="grid grid-cols-2 gap-1 text-sm">
                          {(['A', 'B', 'C', 'D'] as const).map(opt => (
                            <span
                              key={opt}
                              className={`px-2 py-1 rounded ${q.correct_option === opt ? 'bg-success/10 text-success font-medium' : 'text-muted-foreground'}`}
                            >
                              {opt}. {q[`option_${opt.toLowerCase()}` as keyof Question] as string}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteQuestion(q.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

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
          <h2 className="text-lg font-heading font-semibold">Seus Quizzes</h2>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo Quiz</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">Criar Quiz</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label>Título do Quiz</Label>
                  <Input value={newQuizTitle} onChange={e => setNewQuizTitle(e.target.value)} placeholder="Ex: Revisão Capítulo 5" />
                </div>
                <Button onClick={createQuiz} className="w-full">Criar Quiz</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {quizzes.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum quiz ainda.</p>
        ) : (
          <div className="space-y-2">
            {quizzes.map(q => (
              <Card key={q.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => selectQuiz(q)}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{q.title}</p>
                    <p className="text-sm text-muted-foreground">Criado em {new Date(q.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); deleteQuiz(q.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
