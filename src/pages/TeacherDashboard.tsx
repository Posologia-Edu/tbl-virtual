import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar';
import { Plus, Users, Play, Archive, LogOut, ChevronRight, LayoutDashboard, BookOpen, FileText, Settings, UserCircle, Menu } from 'lucide-react';
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
  const [activeView, setActiveView] = useState<'dashboard' | 'rooms' | 'quizzes'>('dashboard');

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    const [{ data: roomsData }, { data: quizzesData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('teacher_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('quizzes').select('*, questions(id)').eq('teacher_id', user!.id).order('created_at', { ascending: false }),
    ]);
    setRooms((roomsData as Room[]) || []);
    setQuizzes((quizzesData as Quiz[]) || []);

    // Count unique students across all rooms
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

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    const { data: codeData } = await supabase.rpc('generate_room_code');
    const code = codeData as string;

    const { error } = await supabase.from('rooms').insert({
      name: newRoomName.trim(),
      code,
      teacher_id: user!.id,
      quiz_id: newRoomQuiz || null,
    });
    if (error) { toast.error('Falha ao criar sala'); return; }

    toast.success(`Sala criada! Código: ${code}`);
    setNewRoomName('');
    setNewRoomQuiz('');
    setCreateRoomOpen(false);
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

  // Build monthly chart data
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

  const sidebarItems = [
    { title: 'Início', icon: LayoutDashboard, view: 'dashboard' as const },
    { title: 'Salas', icon: Users, view: 'rooms' as const },
    { title: 'Banco de Questões', icon: BookOpen, view: 'quizzes' as const },
  ];

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold">Painel <span className="font-normal text-muted-foreground">Dashboard</span></h2>
        </div>
        <div className="text-sm text-muted-foreground">
          Ano referência: <span className="font-semibold text-foreground">{currentYear}</span>
        </div>
      </div>

      {/* Stats Cards */}
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

      {/* Monthly Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading">Sessões Finalizadas por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                  activeDot={{ r: 6 }}
                  name="Sessões"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Active Rooms Quick View */}
      {activeRooms.length > 0 && (
        <div>
          <h3 className="text-lg font-heading font-semibold mb-3">Salas Ativas</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeRooms.slice(0, 6).map(room => (
              <Card key={room.id} className="transition-all hover:shadow-md cursor-pointer" onClick={() => navigate(`/room/${room.id}/manage`)}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-heading font-semibold truncate">{room.name}</p>
                    <Badge className={stageLabels[room.current_stage]?.className || ''} >
                      {stageLabels[room.current_stage]?.label}
                    </Badge>
                  </div>
                  <p className="font-mono text-sm tracking-widest text-muted-foreground">{room.code}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quizzes Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading">Questionários</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Você tem <span className="font-semibold text-foreground">{quizzes.length}</span> questionário(s) com um total de{' '}
            <span className="font-semibold text-foreground">{quizzes.reduce((s, q) => s + (q.questions?.length || 0), 0)}</span> questões.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setActiveView('quizzes')}>
            Ver Questionários
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderRooms = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold">Suas Salas</h2>
        <Dialog open={createRoomOpen} onOpenChange={setCreateRoomOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Nova Sala</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Criar Sala</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome da Sala</Label>
                <Input value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="Ex: Biologia 101" />
              </div>
              <div className="space-y-2">
                <Label>Quiz (opcional)</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newRoomQuiz}
                  onChange={e => setNewRoomQuiz(e.target.value)}
                >
                  <option value="">Nenhum quiz selecionado</option>
                  {quizzes.map(q => (
                    <option key={q.id} value={q.id}>{q.title} ({q.questions?.length || 0} questões)</option>
                  ))}
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
                  <Badge className={stageLabels[room.current_stage]?.className || ''}>
                    {stageLabels[room.current_stage]?.label || room.current_stage}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  {room.is_active && room.current_stage !== 'finished' && (
                    <Button size="sm" onClick={() => advanceStage(room)} className="flex-1">
                      <Play className="w-3 h-3 mr-1" /> Próxima Fase
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => navigate(`/room/${room.id}/manage`)}>
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleArchive(room)}>
                    <Archive className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderQuizzes = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold">Banco de Questões</h2>
        <Button onClick={() => navigate('/quizzes')}>
          <Plus className="w-4 h-4 mr-2" /> Gerenciar
        </Button>
      </div>
      {quizzes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum questionário ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map(q => (
            <Card key={q.id} className="transition-all hover:shadow-md cursor-pointer" onClick={() => navigate('/quizzes')}>
              <CardContent className="pt-5 pb-4">
                <p className="font-heading font-semibold">{q.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{q.questions?.length || 0} questões</p>
                <p className="text-xs text-muted-foreground mt-2">{new Date(q.created_at).toLocaleDateString('pt-BR')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r border-sidebar-border">
          <div className="p-4 border-b border-sidebar-border">
            <h1 className="text-xl font-heading font-bold text-sidebar-foreground">TBL Virtual</h1>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{profile?.full_name}</p>
          </div>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Área do Professor</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sidebarItems.map(item => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        onClick={() => item.view === 'quizzes' ? navigate('/quizzes') : setActiveView(item.view)}
                        isActive={activeView === item.view}
                        className="cursor-pointer"
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Conta</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => { signOut(); navigate('/'); }}
                      className="cursor-pointer text-destructive hover:text-destructive"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sair</span>
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
                {activeView === 'quizzes' && renderQuizzes()}
              </>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
