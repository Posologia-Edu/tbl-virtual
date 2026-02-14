import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';

type Team = {
  id: string;
  name: string;
  members: { user_id: string; profiles: { full_name: string } }[];
};

export default function JoinRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    loadTeams();
  }, [roomId]);

  const loadTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, team_members(user_id, profiles:user_id(full_name))')
      .eq('room_id', roomId!)
      .order('name');
    
    setTeams((data as any[])?.map(t => ({
      id: t.id,
      name: t.name,
      members: t.team_members || [],
    })) || []);
  };

  const joinTeam = async (teamId: string) => {
    setJoining(true);
    try {
      const { error } = await supabase.from('team_members').insert({
        team_id: teamId,
        user_id: user!.id,
        room_id: roomId!,
      });
      if (error) {
        if (error.code === '23505') toast.error('Você já está em uma equipe nesta sala');
        else toast.error('Falha ao entrar na equipe');
        return;
      }
      toast.success('Entrou na equipe!');
      navigate(`/room/${roomId}`);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-xl font-heading font-bold">Escolha sua Equipe</h1>
          <p className="text-sm text-muted-foreground">Selecione uma equipe para participar</p>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <div className="grid grid-cols-2 gap-3">
          {teams.map(team => (
            <Card key={team.id} className="hover:shadow-md transition-all">
              <CardContent className="pt-4 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <p className="font-heading font-semibold">{team.name}</p>
                <p className="text-xs text-muted-foreground">{team.members.length} membros</p>
                <Button size="sm" className="w-full" onClick={() => joinTeam(team.id)} disabled={joining}>
                  Entrar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
