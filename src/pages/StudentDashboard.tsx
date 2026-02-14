import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, DoorOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type JoinedRoom = {
  room_id: string;
  room_name: string;
  room_code: string;
  current_stage: string;
  team_name: string | null;
};

const stageLabels: Record<string, { label: string; className: string }> = {
  waiting: { label: 'Aguardando', className: 'bg-muted text-muted-foreground' },
  irat_open: { label: 'iRAT', className: 'phase-irat' },
  trat_open: { label: 'tRAT', className: 'phase-trat' },
  application_open: { label: 'Aplicação', className: 'phase-app' },
  finished: { label: 'Finalizado', className: 'bg-muted text-muted-foreground' },
};

export default function StudentDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [joinedRooms, setJoinedRooms] = useState<JoinedRoom[]>([]);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (user) loadRooms();
  }, [user]);

  const loadRooms = async () => {
    const { data: memberships } = await supabase
      .from('team_members')
      .select('room_id, teams(name, room_id, rooms(name, code, current_stage))')
      .eq('user_id', user!.id);

    if (memberships) {
      const rooms = memberships.map((m: any) => ({
        room_id: m.room_id,
        room_name: m.teams?.rooms?.name || '',
        room_code: m.teams?.rooms?.code || '',
        current_stage: m.teams?.rooms?.current_stage || 'waiting',
        team_name: m.teams?.name || null,
      }));
      setJoinedRooms(rooms);
    }
  };

  const joinRoom = async () => {
    if (!roomCode.trim() || roomCode.trim().length !== 6) {
      toast.error('Informe um código de 6 caracteres');
      return;
    }
    setJoining(true);
    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('id, name, code')
        .eq('code', roomCode.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (roomError || !room) {
        toast.error('Sala não encontrada ou inativa');
        return;
      }

      const { data: existing } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', user!.id)
        .eq('room_id', room.id)
        .single();

      if (existing) {
        navigate(`/room/${room.id}`);
        return;
      }

      navigate(`/room/${room.id}/join`);
    } catch {
      toast.error('Falha ao entrar na sala');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-heading font-bold">TBL Active</h1>
            <p className="text-sm text-muted-foreground">Olá, {profile?.full_name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { signOut(); navigate('/'); }}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-lg">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-heading font-semibold mb-3">Entrar na Sala</h2>
            <div className="flex gap-2">
              <Input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Código da sala"
                maxLength={6}
                className="font-mono text-lg tracking-widest text-center"
              />
              <Button onClick={joinRoom} disabled={joining}>
                <DoorOpen className="w-4 h-4 mr-1" /> Entrar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-lg font-heading font-semibold mb-3">Suas Salas</h2>
          {joinedRooms.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma sala ainda. Informe o código para entrar!</p>
          ) : (
            <div className="space-y-2">
              {joinedRooms.map(room => (
                <Card
                  key={room.room_id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => navigate(`/room/${room.room_id}`)}
                >
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{room.room_name}</p>
                      <p className="text-sm text-muted-foreground">{room.team_name || 'Sem equipe'}</p>
                    </div>
                    <Badge className={stageLabels[room.current_stage]?.className || ''}>
                      {stageLabels[room.current_stage]?.label || room.current_stage}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
