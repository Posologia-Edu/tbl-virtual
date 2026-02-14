import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus, Users, Play, Archive, LogOut, ChevronRight, ChevronDown, LayoutDashboard,
  BookOpen, FileText, UserCircle, Mail, Lock, CreditCard, Trash2, Pencil, PlayCircle, Search,
  BarChart3, Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Room = {
  id: string;
  name: string;
  code: string;
  current_stage: string;
  is_active: boolean;
  quiz_id: string | null;
  created_at: string;
};

type Quiz = {
  id: string;
  title: string;
  created_at: string;
  questions?: { id: string }[];
};

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

type ProfileData = {
  full_name: string;
  nickname: string;
  gender: string;
  cpf: string;
  institution: string;
  institution_city: string;
  country: string;
  neighborhood: string;
  street: string;
  street_number: string;
  zip_code: string;
};

type ActiveView =
  | 'dashboard' | 'rooms' | 'personal-data' | 'my-plan' | 'change-password'
  | 'contact' | 'create-quiz' | 'my-quizzes' | 'reports' | 'edit-quiz';

const stageLabels: Record<string, { label: string; className: string }> = {
  waiting: { label: 'Aguardando', className: 'bg-muted text-muted-foreground' },
  irat_open: { label: 'iRAT', className: 'phase-irat' },
  trat_open: { label: 'tRAT', className: 'phase-trat' },
  application_open: { label: 'Aplicação', className: 'phase-app' },
  finished: { label: 'Finalizado', className: 'bg-muted text-muted-foreground' },
};

const stages = ['waiting', 'irat_open', 'trat_open', 'application_open', 'finished'] as const;
const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function TeacherDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomQuiz, setNewRoomQuiz] = useState('');
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [quizSubOpen, setQuizSubOpen] = useState(false);

  // Profile form state
  const [profileForm, setProfileForm] = useState<ProfileData>({
    full_name: '', nickname: '', gender: '', cpf: '', institution: '',
    institution_city: '', country: '', neighborhood: '', street: '', street_number: '', zip_code: '',
  });

  // Change password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Contact state
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  // Create quiz state
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizOptions, setNewQuizOptions] = useState('4');

  // My quizzes state
  const [quizSearch, setQuizSearch] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [addQOpen, setAddQOpen] = useState(false);
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correct, setCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  useEffect(() => {
    if (user && activeView === 'personal-data') loadProfile();
  }, [user, activeView]);

  const loadData = async () => {
    const [{ data: roomsData }, { data: quizzesData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('teacher_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('quizzes').select('*, questions(id)').eq('teacher_id', user!.id).order('created_at', { ascending: false }),
    ]);
    setRooms((roomsData as Room[]) || []);
    setQuizzes((quizzesData as Quiz[]) || []);

    if (roomsData && roomsData.length > 0) {
      const roomIds = roomsData.map(r => r.id);
      const { data: parts } = await supabase
        .from('room_participants')
        .select('user_id')
        .in('room_id', roomIds);
      const uniqueStudents = new Set((parts || []).map((p: any) => p.user_id));
      setTotalStudents(uniqueStudents.size);
    }
    setLoading(false);
  };

  const loadProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user!.id).single();
    if (data) {
      setProfileForm({
        full_name: data.full_name || '',
        nickname: (data as any).nickname || '',
        gender: (data as any).gender || '',
        cpf: (data as any).cpf || '',
        institution: (data as any).institution || '',
        institution_city: (data as any).institution_city || '',
        country: (data as any).country || '',
        neighborhood: (data as any).neighborhood || '',
        street: (data as any).street || '',
        street_number: (data as any).street_number || '',
        zip_code: (data as any).zip_code || '',
      });
    }
  };

  const saveProfile = async () => {
    const { error } = await supabase.from('profiles').update(profileForm as any).eq('id', user!.id);
    if (error) { toast.error('Falha ao salvar dados'); return; }
    toast.success('Dados atualizados com sucesso!');
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) { toast.error('Senhas não conferem'); return; }
    if (newPassword.length < 6) { toast.error('A nova senha deve ter ao menos 6 caracteres'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); return; }
    toast.success('Senha alterada com sucesso!');
    setOldPassword(''); setNewPassword(''); setConfirmPassword('');
  };

  const sendContact = () => {
    if (!contactSubject.trim() || !contactMessage.trim()) { toast.error('Preencha todos os campos'); return; }
    toast.success('Mensagem enviada com sucesso!');
    setContactSubject(''); setContactMessage('');
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    const { data: codeData } = await supabase.rpc('generate_room_code');
    const code = codeData as string;
    const { error } = await supabase.from('rooms').insert({
      name: newRoomName.trim(), code, teacher_id: user!.id, quiz_id: newRoomQuiz || null,
    });
    if (error) { toast.error('Falha ao criar sala'); return; }
    toast.success(`Sala criada! Código: ${code}`);
    setNewRoomName(''); setNewRoomQuiz(''); setCreateRoomOpen(false);
    loadData();
  };

  const advanceStage = async (room: Room) => {
    const currentIdx = stages.indexOf(room.current_stage as any);
    if (currentIdx >= stages.length - 1) return;
    const nextStage = stages[currentIdx + 1];
    if (nextStage === 'irat_open') {
      const endTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await supabase.from('rooms').update({ current_stage: nextStage, irat_end_time: endTime }).eq('id', room.id);
    } else {
      await supabase.from('rooms').update({ current_stage: nextStage }).eq('id', room.id);
    }
    loadData();
    toast.success(`Avançou para ${stageLabels[nextStage].label}`);
  };

  const toggleArchive = async (room: Room) => {
    await supabase.from('rooms').update({ is_active: !room.is_active }).eq('id', room.id);
    loadData();
  };

  // Quiz management
  const createQuiz = async () => {
    if (!newQuizTitle.trim()) { toast.error('Informe o nome do questionário'); return; }
    const { error } = await supabase.from('quizzes').insert({ title: newQuizTitle.trim(), teacher_id: user!.id });
    if (error) { toast.error('Falha ao criar questionário'); return; }
    toast.success('Questionário criado!');
    setNewQuizTitle(''); setNewQuizOptions('4');
    loadData();
    setActiveView('my-quizzes');
  };

  const deleteQuiz = async (id: string) => {
    await supabase.from('quizzes').delete().eq('id', id);
    loadData();
    toast.success('Questionário excluído');
  };

  const openEditQuiz = async (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    const { data } = await supabase.from('questions').select('*').eq('quiz_id', quiz.id).order('sort_order');
    setQuestions((data as Question[]) || []);
    setActiveView('edit-quiz');
  };

  const addQuestion = async () => {
    if (!qText.trim() || !optA || !optB || !optC || !optD) { toast.error('Preencha todos os campos'); return; }
    const { error } = await supabase.from('questions').insert({
      quiz_id: selectedQuiz!.id, question_text: qText.trim(),
      option_a: optA, option_b: optB, option_c: optC, option_d: optD,
      correct_option: correct, sort_order: questions.length,
    });
    if (error) { toast.error('Falha ao adicionar questão'); return; }
    toast.success('Questão adicionada!');
    setQText(''); setOptA(''); setOptB(''); setOptC(''); setOptD(''); setCorrect('A');
    setAddQOpen(false);
    const { data } = await supabase.from('questions').select('*').eq('quiz_id', selectedQuiz!.id).order('sort_order');
    setQuestions((data as Question[]) || []);
    loadData();
  };

  const deleteQuestion = async (id: string) => {
    await supabase.from('questions').delete().eq('id', id);
    const { data } = await supabase.from('questions').select('*').eq('quiz_id', selectedQuiz!.id).order('sort_order');
    setQuestions((data as Question[]) || []);
  };

  // Chart data
  const currentYear = new Date().getFullYear();
  const chartData = months.map((m, i) => {
    const count = rooms.filter(r => {
      const d = new Date(r.created_at);
      return d.getFullYear() === currentYear && d.getMonth() === i && r.current_stage === 'finished';
    }).length;
    return { name: m, value: count };
  });

  const finishedCount = rooms.filter(r => r.current_stage === 'finished').length;
  const activeRooms = rooms.filter(r => r.is_active && r.current_stage !== 'finished');
  const finishedRooms = rooms.filter(r => r.current_stage === 'finished');

  const filteredQuizzes = quizzes.filter(q =>
    q.title.toLowerCase().includes(quizSearch.toLowerCase())
  );

  const getQuizStatus = (quiz: Quiz) => {
    const hasQuestions = (quiz.questions?.length || 0) > 0;
    const isApplied = rooms.some(r => r.quiz_id === quiz.id && r.current_stage === 'finished');
    if (isApplied) return 'Aplicação Finalizada';
    if (hasQuestions) return 'Questionário concluído';
    return 'Questionário não concluído';
  };

  // ==================== RENDER FUNCTIONS ====================

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold">Painel <span className="font-normal text-muted-foreground">Dashboard</span></h2>
        <div className="text-sm text-muted-foreground">Ano referência: <span className="font-semibold text-foreground">{currentYear}</span></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-muted-foreground mb-1">Salas Criadas</p>
            <p className="text-3xl font-heading font-bold">{rooms.length}</p>
            <p className="text-xs text-primary mt-1">{activeRooms.length} ativas</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: 'hsl(var(--phase-trat))' }}>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-muted-foreground mb-1">Finalizadas</p>
            <p className="text-3xl font-heading font-bold">{finishedCount}</p>
            <p className="text-xs mt-1" style={{ color: 'hsl(var(--phase-trat))' }}>Sessões completas</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: 'hsl(var(--success))' }}>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-muted-foreground mb-1">Alunos</p>
            <p className="text-3xl font-heading font-bold">{totalStudents}</p>
            <p className="text-xs mt-1" style={{ color: 'hsl(var(--success))' }}>Participaram das aplicações</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Sessões Finalizadas por Mês</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} name="Sessões" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      {activeRooms.length > 0 && (
        <div>
          <h3 className="text-lg font-heading font-semibold mb-3">Salas Ativas</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeRooms.slice(0, 6).map(room => (
              <Card key={room.id} className="transition-all hover:shadow-md cursor-pointer" onClick={() => navigate(`/room/${room.id}/manage`)}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-heading font-semibold truncate">{room.name}</p>
                    <Badge className={stageLabels[room.current_stage]?.className || ''}>{stageLabels[room.current_stage]?.label}</Badge>
                  </div>
                  <p className="font-mono text-sm tracking-widest text-muted-foreground">{room.code}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderRooms = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold">Suas Salas</h2>
        <Dialog open={createRoomOpen} onOpenChange={setCreateRoomOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Nova Sala</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">Criar Sala</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome da Sala</Label>
                <Input value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="Ex: Biologia 101" />
              </div>
              <div className="space-y-2">
                <Label>Quiz (opcional)</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newRoomQuiz} onChange={e => setNewRoomQuiz(e.target.value)}>
                  <option value="">Nenhum quiz selecionado</option>
                  {quizzes.map(q => (<option key={q.id} value={q.id}>{q.title} ({q.questions?.length || 0} questões)</option>))}
                </select>
              </div>
              <Button onClick={createRoom} className="w-full">Criar Sala</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {rooms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Nenhuma sala ainda. Crie uma para começar!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map(room => (
            <Card key={room.id} className={`transition-all hover:shadow-md ${!room.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="font-heading text-lg">{room.name}</CardTitle>
                    <CardDescription className="font-mono text-lg tracking-widest mt-1">{room.code}</CardDescription>
                  </div>
                  <Badge className={stageLabels[room.current_stage]?.className || ''}>{stageLabels[room.current_stage]?.label || room.current_stage}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  {room.is_active && room.current_stage !== 'finished' && (
                    <Button size="sm" onClick={() => advanceStage(room)} className="flex-1"><Play className="w-3 h-3 mr-1" /> Próxima Fase</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => navigate(`/room/${room.id}/manage`)}><ChevronRight className="w-3 h-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleArchive(room)}><Archive className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderPersonalData = () => (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-heading font-bold">Meus Dados</h2>
      <Card>
        <CardHeader><CardTitle className="text-lg">Dados Pessoais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input value={profileForm.cpf} onChange={e => setProfileForm(p => ({ ...p, cpf: e.target.value }))} placeholder="000.000.000-00" />
          </div>
          <div className="space-y-2">
            <Label>Nome Completo</Label>
            <Input value={profileForm.full_name} onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Como deseja ser chamado</Label>
              <Input value={profileForm.nickname} onChange={e => setProfileForm(p => ({ ...p, nickname: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Gênero</Label>
              <Select value={profileForm.gender} onValueChange={v => setProfileForm(p => ({ ...p, gender: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o gênero" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                  <SelectItem value="prefiro_nao_dizer">Prefiro não dizer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={user?.email || ''} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Instituição de Ensino</Label>
            <Input value={profileForm.institution} onChange={e => setProfileForm(p => ({ ...p, institution: e.target.value }))} placeholder="Nome da instituição" />
          </div>
          <div className="space-y-2">
            <Label>Cidade da Instituição</Label>
            <Input value={profileForm.institution_city} onChange={e => setProfileForm(p => ({ ...p, institution_city: e.target.value }))} placeholder="Cidade da Instituição de Ensino" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Endereço Pessoal</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>País</Label>
            <Select value={profileForm.country} onValueChange={v => setProfileForm(p => ({ ...p, country: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione um país" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="brasil">Brasil</SelectItem>
                <SelectItem value="portugal">Portugal</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input value={profileForm.neighborhood} onChange={e => setProfileForm(p => ({ ...p, neighborhood: e.target.value }))} placeholder="Informe o bairro" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
            <div className="space-y-2">
              <Label>Logradouro</Label>
              <Input value={profileForm.street} onChange={e => setProfileForm(p => ({ ...p, street: e.target.value }))} placeholder="Informe a rua" />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={profileForm.street_number} onChange={e => setProfileForm(p => ({ ...p, street_number: e.target.value }))} placeholder="Nº" className="w-24" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input value={profileForm.zip_code} onChange={e => setProfileForm(p => ({ ...p, zip_code: e.target.value }))} placeholder="Informe o CEP" className="max-w-xs" />
          </div>
          <Button onClick={saveProfile}>Alterar Dados</Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderMyPlan = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-heading font-bold">Informações Professor</h2>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <Card>
          <CardHeader className="text-center"><CardTitle>Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Badge className="bg-success text-success-foreground mx-auto block w-fit mb-3">Situação: Ativo</Badge>
            <p className="text-sm"><span className="font-semibold">CPF:</span> {profileForm.cpf || '—'}</p>
            <p className="text-sm"><span className="font-semibold">Apelido:</span> {profileForm.nickname || '—'}</p>
            <p className="text-sm"><span className="font-semibold text-primary">Nome:</span> {profileForm.full_name}</p>
            <p className="text-sm"><span className="font-semibold">E-mail:</span> {user?.email}</p>
            <p className="text-sm"><span className="font-semibold">Instituição:</span> {profileForm.institution || '—'}</p>
            <p className="text-sm"><span className="font-semibold">Cidade Instituição:</span> {profileForm.institution_city || '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-primary">
          <CardHeader className="text-center"><CardTitle className="text-primary">Meu Plano</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-muted-foreground" /><span><span className="font-semibold">Plano Atual:</span> Grátis</span></div>
            <div className="flex items-center gap-2"><span className="text-muted-foreground text-base">$</span><span><span className="font-semibold">Valor Disponível:</span> R$0,00</span></div>
            <div className="flex items-center gap-2"><Settings2 className="w-4 h-4 text-muted-foreground" /><span><span className="font-semibold">Tempo disponível:</span> Ilimitado</span></div>
            <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /><span><span className="font-semibold">Início do plano:</span> {new Date(user?.created_at || '').toLocaleString('pt-BR')}</span></div>
            <div className="flex items-center gap-2"><Settings2 className="w-4 h-4 text-muted-foreground" /><span><span className="font-semibold">Válido até:</span> Tempo Ilimitado</span></div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="text-center"><CardTitle>Histórico de Pagamentos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plano Contratado</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Vigência até</TableHead>
                <TableHead>Dias do plano</TableHead>
                <TableHead>Valor do Plano</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Grátis</TableCell>
                <TableCell>{new Date(user?.created_at || '').toLocaleString('pt-BR')}</TableCell>
                <TableCell>Tempo Ilimitado</TableCell>
                <TableCell>Ilimitado</TableCell>
                <TableCell>R$0,00</TableCell>
                <TableCell>Gratuito</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderChangePassword = () => (
    <div className="max-w-lg space-y-6">
      <h2 className="text-2xl font-heading font-bold">Alterar Senha</h2>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Senha Antiga</Label>
            <Input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="Senha Antiga" />
          </div>
          <div className="space-y-2">
            <Label>Senha Nova</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Senha Nova" />
          </div>
          <div className="space-y-2">
            <Label>Confirmação de Senha</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirmação de Senha" />
          </div>
          <Button onClick={changePassword}>Alterar</Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderContact = () => (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-heading font-bold">Mensagem de Contato</h2>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input value={profile?.full_name || ''} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={user?.email || ''} disabled className="bg-muted" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assunto da Mensagem</Label>
            <Input value={contactSubject} onChange={e => setContactSubject(e.target.value)} placeholder="Assunto" />
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea value={contactMessage} onChange={e => setContactMessage(e.target.value)} placeholder="Digite aqui a sua mensagem..." rows={6} />
          </div>
          <Button onClick={sendContact}>Enviar Mensagem</Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderCreateQuiz = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-heading font-bold">Novo Questionário</h2>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
        <Card>
          <CardHeader className="text-center"><CardTitle className="text-primary">Questionário</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Questionário</Label>
                <Input value={newQuizTitle} onChange={e => setNewQuizTitle(e.target.value)} placeholder="Nome" />
              </div>
              <div className="space-y-2">
                <Label>Quantidade de Alternativas por Questão</Label>
                <Select value={newQuizOptions} onValueChange={setNewQuizOptions}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-primary">
          <CardHeader><CardTitle className="text-sm">Ações</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-2 text-destructive" onClick={() => setActiveView('my-quizzes')}>
              <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs">✕</span> Cancelar
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 text-success" onClick={createQuiz}>
              <span className="w-5 h-5 rounded-full bg-success text-success-foreground flex items-center justify-center text-xs">✓</span> Salvar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderMyQuizzes = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold">Meus Questionários</h2>
        <Badge variant="outline" className="text-lg font-heading">{quizzes.length}</Badge>
      </div>
      <Button variant="link" className="text-primary px-0" onClick={() => setActiveView('create-quiz')}>Novo Questionário</Button>
      <div className="flex gap-2 max-w-lg">
        <Input value={quizSearch} onChange={e => setQuizSearch(e.target.value)} placeholder="Buscar Questionário" />
        <Button size="icon" variant="default"><Search className="w-4 h-4" /></Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/10">
                <TableHead>Nome</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead>Status Questionário</TableHead>
                <TableHead className="text-center">Excluir</TableHead>
                <TableHead className="text-center">Editar</TableHead>
                <TableHead className="text-center">Aplicar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuizzes.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum questionário encontrado.</TableCell></TableRow>
              ) : filteredQuizzes.map(q => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium text-primary cursor-pointer" onClick={() => openEditQuiz(q)}>{q.title}</TableCell>
                  <TableCell className="text-sm">{new Date(q.created_at).toLocaleString('pt-BR')}</TableCell>
                  <TableCell className="text-sm">{getQuizStatus(q)}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => deleteQuiz(q.id)}><Trash2 className="w-4 h-4 text-muted-foreground" /></Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => openEditQuiz(q)}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => { setNewRoomQuiz(q.id); setActiveView('rooms'); setCreateRoomOpen(true); }}>
                      <PlayCircle className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderEditQuiz = () => {
    if (!selectedQuiz) return null;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setActiveView('my-quizzes')}><ChevronRight className="w-4 h-4 rotate-180" /></Button>
          <div>
            <h2 className="text-2xl font-heading font-bold">{selectedQuiz.title}</h2>
            <p className="text-sm text-muted-foreground">{questions.length} questões</p>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-heading font-semibold">Questões</h3>
          <Dialog open={addQOpen} onOpenChange={setAddQOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Adicionar Questão</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-heading">Adicionar Questão</DialogTitle></DialogHeader>
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
                      <Input className="flex-1" value={opt === 'A' ? optA : opt === 'B' ? optB : opt === 'C' ? optC : optD}
                        onChange={e => { const v = e.target.value; if (opt === 'A') setOptA(v); else if (opt === 'B') setOptB(v); else if (opt === 'C') setOptC(v); else setOptD(v); }}
                        placeholder={`Opção ${opt}`} />
                      <Button type="button" size="sm" variant={correct === opt ? 'default' : 'outline'} onClick={() => setCorrect(opt)}>✓</Button>
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
                      <p className="font-medium mb-2"><span className="text-muted-foreground mr-2">Q{i + 1}.</span>{q.question_text}</p>
                      <div className="grid grid-cols-2 gap-1 text-sm">
                        {(['A', 'B', 'C', 'D'] as const).map(opt => (
                          <span key={opt} className={`px-2 py-1 rounded ${q.correct_option === opt ? 'bg-success/10 text-success font-medium' : 'text-muted-foreground'}`}>
                            {opt}. {q[`option_${opt.toLowerCase()}` as keyof Question] as string}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteQuestion(q.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderReports = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-heading font-bold">Aplicações Finalizadas</h2>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/10">
                <TableHead>Questionário</TableHead>
                <TableHead>Aplicado</TableHead>
                <TableHead className="text-center">Resultados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finishedRooms.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhuma aplicação finalizada ainda.</TableCell></TableRow>
              ) : finishedRooms.map(room => {
                const quiz = quizzes.find(q => q.id === room.quiz_id);
                return (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{quiz?.title || room.name}</TableCell>
                    <TableCell className="text-sm">{new Date(room.created_at).toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-4">
                        <Button variant="link" size="sm" className="gap-1" onClick={() => navigate(`/room/${room.id}/manage`)}>
                          <BarChart3 className="w-4 h-4" /> Final
                        </Button>
                        <Button variant="link" size="sm" className="gap-1" onClick={() => navigate(`/room/${room.id}/manage`)}>
                          <Settings2 className="w-4 h-4" /> Gerencial
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  // ==================== SIDEBAR & LAYOUT ====================

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r border-sidebar-border">
          <div className="p-4 border-b border-sidebar-border">
            <h1 className="text-xl font-heading font-bold text-sidebar-foreground">TBL Virtual</h1>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{profile?.full_name}</p>
          </div>
          <SidebarContent>
            {/* Início */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('dashboard')} isActive={activeView === 'dashboard'} className="cursor-pointer">
                      <LayoutDashboard className="w-4 h-4" /><span>Início</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Área do Professor */}
            <SidebarGroup>
              <SidebarGroupLabel>Área do Professor</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('personal-data')} isActive={activeView === 'personal-data'} className="cursor-pointer">
                      <UserCircle className="w-4 h-4" /><span>Dados Pessoais</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => { setActiveView('my-plan'); loadProfile(); }} isActive={activeView === 'my-plan'} className="cursor-pointer">
                      <CreditCard className="w-4 h-4" /><span>Meu Plano</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('change-password')} isActive={activeView === 'change-password'} className="cursor-pointer">
                      <Lock className="w-4 h-4" /><span>Alterar Senha</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('contact')} isActive={activeView === 'contact'} className="cursor-pointer">
                      <Mail className="w-4 h-4" /><span>Entrar em Contato</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Área de Questionários */}
            <SidebarGroup>
              <SidebarGroupLabel>Área de Questionários</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <Collapsible open={quizSubOpen} onOpenChange={setQuizSubOpen}>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="cursor-pointer w-full" isActive={activeView === 'create-quiz' || activeView === 'my-quizzes' || activeView === 'edit-quiz'}>
                          <BookOpen className="w-4 h-4" /><span className="flex-1 text-left">Questionários</span>
                          <ChevronDown className={`w-3 h-3 transition-transform ${quizSubOpen ? 'rotate-180' : ''}`} />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenu className="pl-6 mt-1 space-y-0.5">
                          <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => setActiveView('create-quiz')} isActive={activeView === 'create-quiz'} className="cursor-pointer text-sm">
                              <span>Criar Questionário</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => setActiveView('my-quizzes')} isActive={activeView === 'my-quizzes' || activeView === 'edit-quiz'} className="cursor-pointer text-sm">
                              <span>Meus Questionários</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        </SidebarMenu>
                      </CollapsibleContent>
                    </Collapsible>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('rooms')} isActive={activeView === 'rooms'} className="cursor-pointer">
                      <Users className="w-4 h-4" /><span>Salas</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('reports')} isActive={activeView === 'reports'} className="cursor-pointer">
                      <BarChart3 className="w-4 h-4" /><span>Relatórios</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Conta */}
            <SidebarGroup>
              <SidebarGroupLabel>Conta</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => { signOut(); navigate('/'); }} className="cursor-pointer text-destructive hover:text-destructive">
                      <LogOut className="w-4 h-4" /><span>Sair</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="border-b bg-card h-14 flex items-center px-4 gap-3 shrink-0">
            <SidebarTrigger />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">{profile?.full_name}</span>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-y-auto">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : (
              <>
                {activeView === 'dashboard' && renderDashboard()}
                {activeView === 'rooms' && renderRooms()}
                {activeView === 'personal-data' && renderPersonalData()}
                {activeView === 'my-plan' && renderMyPlan()}
                {activeView === 'change-password' && renderChangePassword()}
                {activeView === 'contact' && renderContact()}
                {activeView === 'create-quiz' && renderCreateQuiz()}
                {activeView === 'my-quizzes' && renderMyQuizzes()}
                {activeView === 'edit-quiz' && renderEditQuiz()}
                {activeView === 'reports' && renderReports()}
              </>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
