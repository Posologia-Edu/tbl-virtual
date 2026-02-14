import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Play, Pause, Archive, LogOut, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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
  waiting: { label: 'Waiting', className: 'bg-muted text-muted-foreground' },
  irat_open: { label: 'iRAT', className: 'phase-irat' },
  trat_open: { label: 'tRAT', className: 'phase-trat' },
  application_open: { label: 'Application', className: 'phase-app' },
  finished: { label: 'Finished', className: 'bg-muted text-muted-foreground' },
};

const stages = ['waiting', 'irat_open', 'trat_open', 'application_open', 'finished'] as const;

export default function TeacherDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomQuiz, setNewRoomQuiz] = useState('');
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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
    if (error) {
      toast.error('Failed to create room');
      return;
    }
    
    // Create default teams
    const teams = Array.from({ length: 10 }, (_, i) => ({
      room_id: undefined as any, // will be set below
      name: `Team ${i + 1}`,
    }));

    const { data: room } = await supabase.from('rooms').select('id').eq('code', code).single();
    if (room) {
      await supabase.from('teams').insert(
        teams.map(t => ({ ...t, room_id: room.id }))
      );
    }

    toast.success(`Room created! Code: ${code}`);
    setNewRoomName('');
    setNewRoomQuiz('');
    setCreateRoomOpen(false);
    loadData();
  };

  const advanceStage = async (room: Room) => {
    const currentIdx = stages.indexOf(room.current_stage as any);
    if (currentIdx >= stages.length - 1) return;
    const nextStage = stages[currentIdx + 1];
    await supabase.from('rooms').update({ current_stage: nextStage }).eq('id', room.id);
    loadData();
    toast.success(`Stage advanced to ${stageLabels[nextStage].label}`);
  };

  const toggleArchive = async (room: Room) => {
    await supabase.from('rooms').update({ is_active: !room.is_active }).eq('id', room.id);
    loadData();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-heading font-bold">TBL Manager</h1>
            <p className="text-sm text-muted-foreground">Hello, {profile?.full_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/quizzes')}>
              Question Bank
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { signOut(); navigate('/auth'); }}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-heading font-bold">Your Rooms</h2>
          <Dialog open={createRoomOpen} onOpenChange={setCreateRoomOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New Room</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">Create Room</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Room Name</Label>
                  <Input value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="e.g. Biology 101" />
                </div>
                <div className="space-y-2">
                  <Label>Quiz (optional)</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newRoomQuiz}
                    onChange={e => setNewRoomQuiz(e.target.value)}
                  >
                    <option value="">No quiz assigned</option>
                    {quizzes.map(q => (
                      <option key={q.id} value={q.id}>{q.title} ({q.questions?.length || 0} questions)</option>
                    ))}
                  </select>
                </div>
                <Button onClick={createRoom} className="w-full">Create Room</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : rooms.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No rooms yet. Create one to get started!</p>
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
                        <Play className="w-3 h-3 mr-1" />
                        Next Phase
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
      </main>
    </div>
  );
}
