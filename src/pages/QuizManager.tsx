import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, ArrowLeft, PencilLine, CheckCircle2, XCircle, CirclePlus, CirclePlay, HelpCircle, BookOpen, FileQuestion, Sparkles, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import UpgradeDialog from '@/components/UpgradeDialog';
import { ClinicalCaseQuestion, splitClinicalCase } from '@/components/ClinicalCaseQuestion';
import { QuestionMediaEditor, QuestionRichRenderer, RichTextHelp, MediaBlock, parseMedia } from '@/components/QuestionMedia';

type Question = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  sort_order: number;
  explanation?: string | null;
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
  correct_answer: string | null;
};

type Quiz = {
  id: string;
  title: string;
  created_at: string;
};

type ViewMode = 'list' | 'create' | 'quiz-detail' | 'add-question' | 'edit-question' | 'add-app-question' | 'edit-app-question';

export default function QuizManager() {
  const { user } = useAuth();
  const { maxQuizzes, maxQuestionsPerQuiz, currentPlan, showUpgradeDialog, upgradeOpen, upgradeFeature, closeUpgradeDialog } = usePlanLimits();
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

  // AI generation state
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuizTitle, setAiQuizTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [showAiImportDialog, setShowAiImportDialog] = useState(false);
  const [aiImportFiles, setAiImportFiles] = useState<File[]>([]);
  const [aiImportLoading, setAiImportLoading] = useState(false);

  // iRAT/tRAT Question form state
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correct, setCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [qMedia, setQMedia] = useState<MediaBlock[]>([]);
  const [qExplanation, setQExplanation] = useState('');

  // Application question form state
  const [appQText, setAppQText] = useState('');
  const [appOptA, setAppOptA] = useState('');
  const [appOptB, setAppOptB] = useState('');
  const [appOptC, setAppOptC] = useState('');
  const [appOptD, setAppOptD] = useState('');
  const [editingAppQuestion, setEditingAppQuestion] = useState<AppQuestion | null>(null);
  const [appCorrectAnswer, setAppCorrectAnswer] = useState<'V' | 'F'>('V');
  const [appQMedia, setAppQMedia] = useState<MediaBlock[]>([]);
  const [genExplanationsLoading, setGenExplanationsLoading] = useState(false);

  const generateExplanationsForQuiz = async () => {
    if (!selectedQuiz) return;
    const pending = questions.filter(q => !q.explanation || !q.explanation.trim()).length;
    if (pending === 0) {
      toast.info('Todas as questões já possuem explicação.');
      return;
    }
    setGenExplanationsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-explanations', {
        body: { quiz_id: selectedQuiz.id, only_missing: true },
      });
      if (error) throw error;
      toast.success(`${data?.updated ?? 0} explicação(ões) gerada(s) com IA.`);
      await loadQuestions(selectedQuiz.id);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao gerar explicações.');
    } finally {
      setGenExplanationsLoading(false);
    }
  };

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
    if (isFinite(maxQuizzes) && quizzes.length >= maxQuizzes) {
      showUpgradeDialog('Questionários ilimitados');
      return;
    }
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
    setEditingQuestion(null); setQMedia([]); setQExplanation('');
  };

  const resetAppQuestionForm = () => {
    setAppQText(''); setAppOptA(''); setAppOptB(''); setAppOptC(''); setAppOptD('');
    setEditingAppQuestion(null); setAppCorrectAnswer('V'); setAppQMedia([]);
  };

  const saveQuestion = async () => {
    if (!qText.trim() || !optA || !optB || !optC || !optD) {
      toast.error('Preencha todos os campos');
      return;
    }
    const totalQuestions = questions.length + appQuestions.length;
    if (!editingQuestion && isFinite(maxQuestionsPerQuiz) && totalQuestions >= maxQuestionsPerQuiz) {
      showUpgradeDialog('Questões ilimitadas por questionário');
      return;
    }
    if (editingQuestion) {
      const { error } = await supabase.from('questions').update({
        question_text: qText.trim(),
        option_a: optA, option_b: optB, option_c: optC, option_d: optD,
        correct_option: correct,
        media: qMedia as any,
        explanation: qExplanation.trim() || null,
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
        media: qMedia as any,
        explanation: qExplanation.trim() || null,
      });
      if (error) { toast.error('Falha ao adicionar questão'); return; }
      toast.success('Questão salva!');
    }
    resetQuestionForm();
    loadQuestions(selectedQuiz!.id);
    setViewMode('quiz-detail');
  };

  const saveAppQuestion = async () => {
    if (!appQText.trim()) {
      toast.error('Preencha o enunciado');
      return;
    }
    const totalQuestions = questions.length + appQuestions.length;
    if (!editingAppQuestion && isFinite(maxQuestionsPerQuiz) && totalQuestions >= maxQuestionsPerQuiz) {
      showUpgradeDialog('Questões ilimitadas por questionário');
      return;
    }
    if (editingAppQuestion) {
      const { error } = await supabase.from('application_questions').update({
        question_text: appQText.trim(),
        option_a: 'V', option_b: 'F', option_c: null, option_d: null,
        correct_answer: appCorrectAnswer,
        media: appQMedia as any,
      }).eq('id', editingAppQuestion.id);
      if (error) { toast.error('Falha ao atualizar questão'); return; }
      toast.success('Questão de aplicação atualizada!');
    } else {
      const { error } = await supabase.from('application_questions').insert({
        quiz_id: selectedQuiz!.id,
        question_text: appQText.trim(),
        option_a: 'V', option_b: 'F', option_c: null, option_d: null,
        correct_answer: appCorrectAnswer,
        sort_order: appQuestions.length,
        media: appQMedia as any,
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
    setQMedia(parseMedia((q as any).media));
    setQExplanation((q as any).explanation || '');
    setViewMode('edit-question');
  };

  const startEditAppQuestion = (q: AppQuestion) => {
    setEditingAppQuestion(q);
    setAppQText(q.question_text);
    setAppOptA(q.option_a || ''); setAppOptB(q.option_b || ''); setAppOptC(q.option_c || ''); setAppOptD(q.option_d || '');
    setAppCorrectAnswer((q.correct_answer?.trim() as 'V' | 'F') || 'V');
    setAppQMedia(parseMedia((q as any).media));
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
    // Delete related records first to avoid FK constraint errors
    await supabase.from('application_questions').delete().eq('quiz_id', id);
    await supabase.from('questions').delete().eq('quiz_id', id);
    const { error } = await supabase.from('quizzes').delete().eq('id', id);
    if (error) { toast.error('Falha ao excluir questionário'); return; }
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

  const getMimeType = (name: string): string => {
    if (name.endsWith('.pdf')) return 'application/pdf';
    if (name.endsWith('.doc')) return 'application/msword';
    if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (name.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
    if (name.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    return 'text/plain';
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const extractErrorMessage = (error: unknown) => {
    if (!error) return 'Falha ao gerar questões com IA';

    const message = typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: string }).message || '')
      : String(error);

    if (message.includes('Failed to fetch')) {
      return 'A geração demorou demais ou a função falhou ao processar o arquivo. Tente novamente com um PDF menor ou em texto pesquisável.';
    }

    return message || 'Falha ao gerar questões com IA';
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const buildFilesPayload = async (files: File[]) => {
    const payload: { fileContent: string; fileName: string; mimeType?: string }[] = [];
    for (const f of files) {
      const isTextFile = f.name.endsWith('.txt') || f.name.endsWith('.md') || f.name.endsWith('.csv');
      const mimeType = getMimeType(f.name);
      if (mimeType === 'application/pdf') {
        const fileContent = await readFileAsBase64(f);
        const { data, error } = await supabase.functions.invoke('generate-quiz-ai', {
          body: { mode: 'extract_text', files: [{ fileContent, fileName: f.name, mimeType }] },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (!Array.isArray(data?.files) || !data.files[0]?.fileContent) {
          throw new Error(`Não foi possível preparar o PDF "${f.name}" para a geração. Tente novamente em alguns instantes.`);
        }
        payload.push(data.files[0]);
        continue;
      }
      const fileContent = isTextFile ? await readFileAsText(f) : await readFileAsBase64(f);
      payload.push({ fileContent, fileName: f.name, mimeType: isTextFile ? undefined : mimeType });
    }
    return payload;
  };

  const generateWithAI = async () => {
    if (aiFiles.length === 0) { toast.error('Selecione ao menos um arquivo'); return; }
    if (!aiQuizTitle.trim()) { toast.error('Informe o nome do questionário'); return; }
    if (isFinite(maxQuizzes) && quizzes.length >= maxQuizzes) {
      showUpgradeDialog('Questionários ilimitados');
      return;
    }
    const oversize = aiFiles.find(f => f.size > MAX_FILE_SIZE);
    if (oversize) { toast.error(`Arquivo muito grande: ${oversize.name}. Máximo 10MB por arquivo.`); return; }

    setAiLoading(true);
    try {
      const filesPayload = await buildFilesPayload(aiFiles);

      const { data, error } = await supabase.functions.invoke('generate-quiz-ai', {
        body: { files: filesPayload },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Create the quiz
      const { data: quiz, error: quizError } = await supabase.from('quizzes')
        .insert({ title: aiQuizTitle.trim(), teacher_id: user!.id })
        .select().single();
      if (quizError || !quiz) throw new Error('Falha ao criar questionário');

      // Insert iRAT/tRAT questions
      if (data.irat_questions?.length) {
        const iratInserts = data.irat_questions.map((q: any, i: number) => ({
          quiz_id: quiz.id,
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: q.correct_option,
          explanation: q.explanation || null,
          sort_order: i,
        }));
        await supabase.from('questions').insert(iratInserts);
      }

      // Insert application questions
      if (data.application_questions?.length) {
        const appInserts = data.application_questions.map((q: any, i: number) => ({
          quiz_id: quiz.id,
          question_text: q.question_text,
          option_a: 'V',
          option_b: 'F',
          option_c: null,
          option_d: null,
          correct_answer: q.correct_answer,
          sort_order: i,
        }));
        await supabase.from('application_questions').insert(appInserts);
      }

      toast.success(`Questionário criado com ${data.irat_questions?.length || 0} questões iRAT/tRAT e ${data.application_questions?.length || 0} questões de aplicação!`);
      setShowAiDialog(false);
      setAiFiles([]);
      setAiQuizTitle('');
      loadQuizzes();

      // Open the newly created quiz
      setSelectedQuiz(quiz as Quiz);
      await loadQuestions(quiz.id);
      await loadAppQuestions(quiz.id);
      setViewMode('quiz-detail');
    } catch (err: any) {
      console.error('AI generation error:', err);
      toast.error(extractErrorMessage(err));
    } finally {
      setAiLoading(false);
    }
  };

  const generateForExistingQuiz = async () => {
    if (aiImportFiles.length === 0 || !selectedQuiz) return;
    const oversize = aiImportFiles.find(f => f.size > MAX_FILE_SIZE);
    if (oversize) { toast.error(`Arquivo muito grande: ${oversize.name}. Máximo 10MB por arquivo.`); return; }
    setAiImportLoading(true);
    try {
      const filesPayload = await buildFilesPayload(aiImportFiles);

      const { data, error } = await supabase.functions.invoke('generate-quiz-ai', {
        body: { files: filesPayload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data.irat_questions?.length) {
        const iratInserts = data.irat_questions.map((q: any, i: number) => ({
          quiz_id: selectedQuiz.id,
          question_text: q.question_text,
          option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
          correct_option: q.correct_option,
          explanation: q.explanation || null,
          sort_order: questions.length + i,
        }));
        await supabase.from('questions').insert(iratInserts);
      }
      if (data.application_questions?.length) {
        const appInserts = data.application_questions.map((q: any, i: number) => ({
          quiz_id: selectedQuiz.id,
          question_text: q.question_text,
          option_a: 'V', option_b: 'F', option_c: null, option_d: null,
          correct_answer: q.correct_answer,
          sort_order: appQuestions.length + i,
        }));
        await supabase.from('application_questions').insert(appInserts);
      }

      toast.success(`Adicionadas ${data.irat_questions?.length || 0} questões iRAT/tRAT e ${data.application_questions?.length || 0} de aplicação!`);
      setShowAiImportDialog(false);
      setAiImportFiles([]);
      await loadQuestions(selectedQuiz.id);
      await loadAppQuestions(selectedQuiz.id);
    } catch (err: any) {
      console.error('AI import error:', err);
      toast.error(extractErrorMessage(err));
    } finally {
      setAiImportLoading(false);
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
                placeholder="Informe o Enunciado. Suporta Markdown e LaTeX."
                className="min-h-[150px]"
              />
              <RichTextHelp />
            </div>

            <div className="border rounded-lg bg-card p-4 space-y-2">
              <Label className="text-center block font-semibold">Mídia (opcional)</Label>
              <QuestionMediaEditor value={qMedia} onChange={setQMedia} ownerId={user?.id} />
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

            <div className="border rounded-lg bg-card p-4 space-y-2">
              <Label className="text-center block font-semibold">Explicação da resposta (mostrada na fase de Feedback)</Label>
              <Textarea
                value={qExplanation}
                onChange={e => setQExplanation(e.target.value)}
                placeholder="Explique por que a alternativa correta é a correta e por que as demais estão erradas. Suporta Markdown e LaTeX."
                className="min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground">Este texto será exibido para todos os alunos durante a fase de Feedback pós-tRAT.</p>
            </div>
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
                placeholder="Informe o enunciado da questão de aplicação (V ou F). Suporta Markdown e LaTeX."
                className="min-h-[150px]"
              />
              <RichTextHelp />
            </div>

            <div className="border rounded-lg bg-card p-4 space-y-2">
              <Label className="text-center block font-semibold">Mídia (opcional)</Label>
              <QuestionMediaEditor value={appQMedia} onChange={setAppQMedia} ownerId={user?.id} />
            </div>

            <div className="space-y-3">
              <Label className="font-semibold">Gabarito: Resposta correta é</Label>
              <div className="grid grid-cols-2 gap-4">
                {(['V', 'F'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setAppCorrectAnswer(opt)}
                    className={`p-6 rounded-xl border-2 text-center text-2xl font-bold transition-all ${
                      appCorrectAnswer === opt
                        ? opt === 'V' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-border hover:border-orange-300'
                    }`}
                  >
                    {opt === 'V' ? 'Verdadeiro' : 'Falso'}
                  </button>
                ))}
              </div>
            </div>
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
                            <React.Fragment key={q.id}>
                              <tr className="border-t hover:bg-muted/30">
                                <td className="px-4 py-2">{i + 1}</td>
                                <td className="px-4 py-2"><QuestionRichRenderer text={q.question_text} media={(q as any).media} compact /></td>
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
                              {q.explanation && q.explanation.trim() && (
                                <tr className="bg-primary/5 border-t border-primary/10">
                                  <td></td>
                                  <td colSpan={3} className="px-4 py-2">
                                    <p className="text-xs font-semibold text-primary mb-1">Feedback (alternativa correta: {q.correct_option})</p>
                                    <p className="text-sm whitespace-pre-wrap text-foreground/90">{q.explanation}</p>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
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
                            <th className="text-center px-4 py-2 w-24">Gabarito</th>
                            <th className="text-center px-4 py-2 w-32">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const groups: Array<{ caseText: string; items: Array<{ q: AppQuestion; index: number }> }> = [];
                            appQuestions.forEach((q, i) => {
                              const { caseText } = splitClinicalCase(q.question_text || '');
                              const last = groups[groups.length - 1];
                              if (caseText && last?.caseText === caseText) {
                                last.items.push({ q, index: i });
                              } else {
                                groups.push({ caseText, items: [{ q, index: i }] });
                              }
                            });

                            return groups.flatMap((group, groupIndex) => [
                              ...(group.caseText ? [
                                <tr key={`case-${groupIndex}`} className="border-t bg-muted/20">
                                  <td className="px-4 py-3" colSpan={4}>
                                    <ClinicalCaseQuestion text={group.items[0].q.question_text} compact caseOnly />
                                  </td>
                                </tr>
                              ] : []),
                              ...group.items.map(({ q, index }) => (
                                <tr key={q.id} className="border-t hover:bg-muted/30">
                                  <td className="px-4 py-2">{index + 1}</td>
                                  <td className="px-4 py-2">
                                    {group.caseText ? (
                                      <ClinicalCaseQuestion text={q.question_text} questionNumber={index + 1} compact statementOnly media={(q as any).media} />
                                    ) : (
                                      <ClinicalCaseQuestion text={q.question_text} questionNumber={index + 1} compact media={(q as any).media} />
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <span className={`font-bold ${q.correct_answer?.trim() === 'V' ? 'text-primary' : q.correct_answer?.trim() === 'F' ? 'text-destructive' : 'text-muted-foreground'}`}>
                                      {q.correct_answer?.trim() === 'V' ? 'Verdadeiro' : q.correct_answer?.trim() === 'F' ? 'Falso' : '—'}
                                    </span>
                                  </td>
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
                              ))
                            ]);
                          })()}
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
                    onClick={() => {
                      const totalQ = questions.length + appQuestions.length;
                      if (isFinite(maxQuestionsPerQuiz) && totalQ >= maxQuestionsPerQuiz) {
                        showUpgradeDialog('Questões ilimitadas por questionário');
                        return;
                      }
                      setShowTypeDialog(true);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-blue-200/40 rounded transition-colors"
                  >
                    <CirclePlus className="w-5 h-5 text-primary" /> Adicionar Questão
                    {isFinite(maxQuestionsPerQuiz) && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {questions.length + appQuestions.length}/{maxQuestionsPerQuiz}
                      </span>
                    )}
                  </button>
                  {questions.length > 0 && (
                    <button
                      disabled={genExplanationsLoading}
                      onClick={generateExplanationsForQuiz}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-blue-200/40 rounded transition-colors disabled:opacity-60"
                    >
                      {genExplanationsLoading
                        ? <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                        : <Sparkles className="w-5 h-5 text-purple-600" />}
                      Gerar Feedback IA
                      <span className="text-xs text-muted-foreground ml-auto">
                        {questions.filter(q => !q.explanation || !q.explanation.trim()).length} pendente(s)
                      </span>
                    </button>
                  )}
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-center text-lg">Tipo de Questão</DialogTitle>
              <DialogDescription className="text-center">Selecione o tipo de questão que deseja criar</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-4 py-4">
              <button
                onClick={() => handleChooseQuestionType('irat')}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-primary/20 hover:border-primary hover:bg-primary/5 transition-all"
              >
                <BookOpen className="w-10 h-10 text-primary" />
                <span className="font-semibold text-sm">iRAT / tRAT</span>
                <span className="text-xs text-muted-foreground text-center">Questão manual com gabarito</span>
              </button>
              <button
                onClick={() => handleChooseQuestionType('application')}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-orange-300/40 hover:border-orange-400 hover:bg-orange-50 transition-all"
              >
                <FileQuestion className="w-10 h-10 text-orange-500" />
                <span className="font-semibold text-sm">Aplicação</span>
                <span className="text-xs text-muted-foreground text-center">Questão V/F para aplicação</span>
              </button>
              <button
                onClick={() => { setShowTypeDialog(false); setAiImportFiles([]); setShowAiImportDialog(true); }}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-purple-300/40 hover:border-purple-400 hover:bg-purple-50 transition-all"
              >
                <Sparkles className="w-10 h-10 text-purple-500" />
                <span className="font-semibold text-sm">Criar com IA</span>
                <span className="text-xs text-muted-foreground text-center">Gerar questões a partir de material</span>
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

        {/* AI Import Dialog (for existing quiz) */}
        <Dialog open={showAiImportDialog} onOpenChange={v => { if (!aiImportLoading) setShowAiImportDialog(v); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Gerar Questões com IA
              </DialogTitle>
              <DialogDescription>
                Envie um material de apoio (PDF, Word, PowerPoint ou TXT) e a IA criará 10 questões iRAT/tRAT e 3 casos clínicos de aplicação baseados no conteúdo.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Material(is) de Apoio</Label>
                <input
                  ref={importFileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                  className="hidden"
                  onChange={e => {
                    const picked = Array.from(e.target.files || []);
                    if (picked.length) setAiImportFiles(prev => [...prev, ...picked]);
                    e.target.value = '';
                  }}
                />
                <div
                  onClick={() => !aiImportLoading && importFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    aiImportFiles.length > 0 ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
                  } ${aiImportLoading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {aiImportFiles.length > 0 ? 'Clique para adicionar mais arquivos' : 'Clique para selecionar arquivos'}
                    </p>
                    <p className="text-xs text-muted-foreground">PDF, Word, PowerPoint ou TXT — múltiplos arquivos permitidos</p>
                  </div>
                </div>
                {aiImportFiles.length > 0 && (
                  <div className="space-y-1">
                    {aiImportFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-muted/30">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-sm truncate">{f.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAiImportFiles(prev => prev.filter((_, idx) => idx !== i))}
                          disabled={aiImportLoading}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {aiImportLoading && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analisando material e gerando questões... Isso pode levar até 1 minuto.
                  </div>
                  <Progress value={undefined} className="animate-pulse" />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAiImportDialog(false)} disabled={aiImportLoading}>
                Cancelar
              </Button>
              <Button onClick={generateForExistingQuiz} disabled={aiImportLoading || aiImportFiles.length === 0}>
                {aiImportLoading ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Gerando...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-1" /> Gerar Questões</>
                )}
              </Button>
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
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-heading font-semibold">Seus Questionários</h2>
            {isFinite(maxQuizzes) && (
              <span className="text-sm text-muted-foreground">({quizzes.length}/{maxQuizzes})</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              if (isFinite(maxQuizzes) && quizzes.length >= maxQuizzes) {
                showUpgradeDialog('Questionários ilimitados');
                return;
              }
              setAiQuizTitle(''); setAiFiles([]); setShowAiDialog(true);
            }}>
              <Sparkles className="w-4 h-4 mr-1" /> Criar com IA
            </Button>
            <Button size="sm" onClick={() => {
              if (isFinite(maxQuizzes) && quizzes.length >= maxQuizzes) {
                showUpgradeDialog('Questionários ilimitados');
                return;
              }
              setNewQuizTitle(''); setViewMode('create');
            }}>
              <Plus className="w-4 h-4 mr-1" /> Novo Questionário
            </Button>
          </div>
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

      {/* AI Generation Dialog */}
      <Dialog open={showAiDialog} onOpenChange={v => { if (!aiLoading) setShowAiDialog(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Criar Questionário com IA
            </DialogTitle>
            <DialogDescription>
              Envie um material de apoio (PDF, Word ou PowerPoint) e a IA criará automaticamente 10 questões iRAT/tRAT e 3 casos clínicos de aplicação baseados no conteúdo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Questionário</Label>
              <Input
                value={aiQuizTitle}
                onChange={e => setAiQuizTitle(e.target.value)}
                placeholder="Ex: Farmacologia - Antibióticos"
                disabled={aiLoading}
              />
            </div>

            <div className="space-y-2">
              <Label>Material(is) de Apoio</Label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                className="hidden"
                onChange={e => {
                  const picked = Array.from(e.target.files || []);
                  if (picked.length) setAiFiles(prev => [...prev, ...picked]);
                  e.target.value = '';
                }}
              />
              <div
                onClick={() => !aiLoading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  aiFiles.length > 0 ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
                } ${aiLoading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {aiFiles.length > 0 ? 'Clique para adicionar mais arquivos' : 'Clique para selecionar arquivos'}
                  </p>
                  <p className="text-xs text-muted-foreground">PDF, Word, PowerPoint ou TXT — múltiplos arquivos permitidos</p>
                </div>
              </div>
              {aiFiles.length > 0 && (
                <div className="space-y-1">
                  {aiFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-muted/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAiFiles(prev => prev.filter((_, idx) => idx !== i))}
                        disabled={aiLoading}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {aiLoading && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando material e gerando questões... Isso pode levar até 1 minuto.
                </div>
                <Progress value={undefined} className="animate-pulse" />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAiDialog(false)} disabled={aiLoading}>
              Cancelar
            </Button>
            <Button onClick={generateWithAI} disabled={aiLoading || aiFiles.length === 0 || !aiQuizTitle.trim()}>
              {aiLoading ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Gerando...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-1" /> Gerar Questões</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={closeUpgradeDialog}
        feature={upgradeFeature}
        currentPlan={currentPlan}
      />
    </div>
  );
}
