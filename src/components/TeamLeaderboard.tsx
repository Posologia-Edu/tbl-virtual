import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';

type TeamScore = {
  teamId: string;
  teamName: string;
  score: number;
};

const RANK_ICONS = [Trophy, Medal, Award];
const RANK_COLORS = [
  'text-yellow-500',
  'text-gray-400',
  'text-amber-600',
];

export default function TeamLeaderboard({ teams, title = 'Ranking das Equipes' }: { teams: TeamScore[]; title?: string }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const maxScore = sorted[0]?.score || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <AnimatePresence mode="popLayout">
          {sorted.map((team, i) => {
            const Icon = RANK_ICONS[i] || Award;
            const pct = maxScore > 0 ? (team.score / maxScore) * 100 : 0;
            return (
              <motion.div
                key={team.teamId}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-2 w-8 flex-shrink-0">
                  {i < 3 ? (
                    <Icon className={`w-5 h-5 ${RANK_COLORS[i]}`} />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">{team.teamName}</span>
                    <Badge variant="outline" className="font-mono font-bold ml-2">{team.score} pts</Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-primary/60'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma equipe pontuou ainda.</p>
        )}
      </CardContent>
    </Card>
  );
}
