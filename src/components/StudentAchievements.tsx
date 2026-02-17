import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, Target, Zap, Users, BookOpen, Award } from 'lucide-react';
import { motion } from 'framer-motion';

type Achievement = {
  id: string;
  achievement_key: string;
  achievement_name: string;
  achievement_description: string;
  icon: string;
  earned_at: string;
  room_id: string | null;
};

const BADGE_DEFINITIONS = [
  { key: 'perfect_irat', name: 'Mestre Individual', desc: 'Acertou tudo no iRAT', icon: '🎯' },
  { key: 'first_activity', name: 'Primeira Atividade', desc: 'Participou da primeira atividade', icon: '🚀' },
  { key: 'activities_5', name: 'Veterano', desc: 'Participou de 5 atividades', icon: '⭐' },
  { key: 'activities_10', name: 'Dedicação Total', desc: 'Participou de 10 atividades', icon: '🏆' },
  { key: 'team_perfect', name: 'Equipe Perfeita', desc: 'Acertou tudo no tRAT de primeira', icon: '💎' },
  { key: 'speed_demon', name: 'Velocista', desc: 'Respondeu tudo em menos de 5 min', icon: '⚡' },
];

export default function StudentAchievements() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [roomCount, setRoomCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    // Load achievements
    const { data: achData } = await supabase
      .from('student_achievements')
      .select('*')
      .eq('user_id', user!.id)
      .order('earned_at', { ascending: false });
    setAchievements((achData as any[]) || []);

    // Load semester scoring from all rooms
    const { data: participations } = await supabase
      .from('room_participants')
      .select('room_id')
      .eq('user_id', user!.id);
    setRoomCount(participations?.length || 0);

    if (participations && participations.length > 0) {
      const roomIds = participations.map(p => p.room_id);
      const { data: iratData } = await supabase
        .from('irat_responses')
        .select('score')
        .eq('student_id', user!.id)
        .in('room_id', roomIds);
      const total = (iratData || []).reduce((s: number, r: any) => s + r.score, 0);
      setTotalPoints(total);
    }
  };

  const earnedKeys = new Set(achievements.map(a => a.achievement_key));

  return (
    <div className="space-y-6">
      {/* Semester Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <Trophy className="w-6 h-6 mx-auto text-yellow-500 mb-1" />
            <p className="text-2xl font-bold">{achievements.length}</p>
            <p className="text-xs text-muted-foreground">Conquistas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Star className="w-6 h-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{totalPoints}</p>
            <p className="text-xs text-muted-foreground">Pontos Acumulados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <BookOpen className="w-6 h-6 mx-auto text-success mb-1" />
            <p className="text-2xl font-bold">{roomCount}</p>
            <p className="text-xs text-muted-foreground">Atividades</p>
          </CardContent>
        </Card>
      </div>

      {/* Badges Grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Award className="w-4 h-4 text-yellow-500" /> Suas Conquistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {BADGE_DEFINITIONS.map((badge, i) => {
              const earned = earnedKeys.has(badge.key);
              return (
                <motion.div
                  key={badge.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    earned
                      ? 'border-yellow-500/30 bg-yellow-500/5'
                      : 'border-border opacity-40 grayscale'
                  }`}
                >
                  <div className="text-3xl mb-1">{badge.icon}</div>
                  <p className="text-xs font-heading font-bold">{badge.name}</p>
                  <p className="text-[10px] text-muted-foreground">{badge.desc}</p>
                  {earned && (
                    <Badge className="mt-1 bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-[10px]">
                      Desbloqueada
                    </Badge>
                  )}
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
