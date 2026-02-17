import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

type Achievement = {
  icon: string;
  name: string;
  description: string;
};

let showAchievementFn: ((achievement: Achievement) => void) | null = null;

export function triggerAchievement(achievement: Achievement) {
  showAchievementFn?.(achievement);
}

export default function AchievementToast() {
  const [achievement, setAchievement] = useState<Achievement | null>(null);

  useEffect(() => {
    showAchievementFn = (a) => {
      setAchievement(a);
      setTimeout(() => setAchievement(null), 4000);
    };
    return () => { showAchievementFn = null; };
  }, []);

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          className="fixed top-4 left-1/2 z-[100] pointer-events-none"
          initial={{ x: '-50%', y: -100, opacity: 0 }}
          animate={{ x: '-50%', y: 0, opacity: 1 }}
          exit={{ x: '-50%', y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="bg-card border-2 border-yellow-500/50 rounded-2xl shadow-xl px-6 py-4 flex items-center gap-4 min-w-[280px]">
            <motion.div
              className="text-4xl"
              animate={{ rotate: [0, -15, 15, -15, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {achievement.icon}
            </motion.div>
            <div>
              <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wider">Conquista Desbloqueada!</p>
              <p className="font-heading font-bold text-sm">{achievement.name}</p>
              <p className="text-xs text-muted-foreground">{achievement.description}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
