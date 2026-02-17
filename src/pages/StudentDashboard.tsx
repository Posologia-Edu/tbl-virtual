import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, DoorOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StudentAchievements from '@/components/StudentAchievements';
import AccessibilityMenu from '@/components/AccessibilityMenu';

type JoinedRoom = {
  room_id: string;
  room_name: string;
  room_code: string;
  current_stage: string;
  participant_code: string;
};

const stageKeys: Record<string, string> = {
  waiting: 'stages.waiting',
  irat_open: 'stages.irat',
  trat_open: 'stages.trat',
  application_open: 'stages.application',
  finished: 'stages.finished',
};

const stageClasses: Record<string, string> = {
  waiting: 'bg-muted text-muted-foreground',
  irat_open: 'phase-irat',
  trat_open: 'phase-trat',
  application_open: 'phase-app',
  finished: 'bg-muted text-muted-foreground',
};

export default function StudentDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [roomCode, setRoomCode] = useState('');
  const [joinedRooms, setJoinedRooms] = useState<JoinedRoom[]>([]);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (user) loadRooms();
  }, [user]);

  const loadRooms = async () => {
    const { data: participations } = await supabase
      .from('room_participants')
      .select('room_id, participant_code, rooms:room_id(name, code, current_stage)')
      .eq('user_id', user!.id);

    if (participations) {
      const rooms = participations.map((p: any) => ({
        room_id: p.room_id,
        room_name: p.rooms?.name || '',
        room_code: p.rooms?.code || '',
        current_stage: p.rooms?.current_stage || 'waiting',
        participant_code: p.participant_code,
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
        .from('room_participants')
        .select('id')
        .eq('user_id', user!.id)
        .eq('room_id', room.id)
        .single();

      if (existing) {
        navigate(`/room/${room.id}`);
        return;
      }

      const { data: codeData } = await supabase.rpc('generate_participant_code', { p_room_id: room.id });
      const participantCode = codeData as string;

      const { error } = await supabase.from('room_participants').insert({
        room_id: room.id,
        user_id: user!.id,
        participant_code: participantCode,
      });

      if (error) {
        if (error.code === '23505') {
          navigate(`/room/${room.id}`);
        } else {
          toast.error('Falha ao entrar na sala');
        }
        return;
      }

      toast.success(`Entrou na sala! Seu código: ${participantCode}`);
      navigate(`/room/${room.id}`);
    } catch {
      toast.error('Falha ao entrar na sala');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card" role="banner">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-heading font-bold">TBL Virtual</h1>
            <p className="text-sm text-muted-foreground">{t('student.hello')}, {profile?.full_name}</p>
          </div>
          <div className="flex items-center gap-1">
            <AccessibilityMenu />
            <Button variant="ghost" size="icon" onClick={() => { signOut(); navigate('/'); }} aria-label={t('common.logout')}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="container mx-auto px-4 py-6 space-y-6 max-w-lg" role="main" aria-label={t('a11y.mainContent')}>
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-heading font-semibold mb-3">{t('student.joinRoom')}</h2>
            <div className="flex gap-2">
              <Input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder={t('student.roomCode')}
                maxLength={6}
                className="font-mono text-lg tracking-widest text-center"
                aria-label={t('student.roomCode')}
              />
              <Button onClick={joinRoom} disabled={joining}>
                <DoorOpen className="w-4 h-4 mr-1" aria-hidden="true" /> {t('common.enter')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="rooms">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="rooms">{t('student.yourRooms')}</TabsTrigger>
            <TabsTrigger value="achievements">{t('student.achievements')}</TabsTrigger>
          </TabsList>

          <TabsContent value="rooms">
            {joinedRooms.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{t('student.noRooms')}</p>
            ) : (
              <div className="space-y-2" role="list" aria-label={t('student.yourRooms')}>
                {joinedRooms.map(room => (
                  <Card
                    key={room.room_id}
                    className="cursor-pointer hover:shadow-md transition-all"
                    onClick={() => navigate(`/room/${room.room_id}`)}
                    role="listitem"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate(`/room/${room.room_id}`)}
                    aria-label={`${room.room_name} — ${t(stageKeys[room.current_stage] || 'stages.waiting')}`}
                  >
                    <CardContent className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{room.room_name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{t('student.code')}: #{room.participant_code}</p>
                      </div>
                      <Badge className={stageClasses[room.current_stage] || ''} aria-label={t('a11y.roomStatus')}>
                        {t(stageKeys[room.current_stage] || 'stages.waiting')}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="achievements">
            <StudentAchievements />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
