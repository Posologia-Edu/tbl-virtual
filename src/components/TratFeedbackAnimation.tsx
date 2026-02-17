import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Sparkles, Flame } from 'lucide-react';

type Props = {
  show: boolean;
  correct: boolean;
  points: number;
  onClose: () => void;
};

const confettiColors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#DDA0DD'];

const ConfettiPiece = ({ delay, x }: { delay: number; x: number }) => (
  <motion.div
    className="absolute w-2 h-2 rounded-full"
    style={{ backgroundColor: confettiColors[Math.floor(Math.random() * confettiColors.length)], left: `${x}%` }}
    initial={{ y: 0, opacity: 1, scale: 1 }}
    animate={{ y: [0, -80, 200], opacity: [1, 1, 0], scale: [1, 1.2, 0.5], rotate: [0, 180, 360] }}
    transition={{ duration: 1.2, delay, ease: 'easeOut' }}
  />
);

export default function TratFeedbackAnimation({ show, correct, points, onClose }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative flex flex-col items-center"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Confetti on correct */}
            {correct && (
              <div className="absolute inset-0 pointer-events-none overflow-visible">
                {Array.from({ length: 20 }).map((_, i) => (
                  <ConfettiPiece key={i} delay={i * 0.05} x={Math.random() * 100} />
                ))}
              </div>
            )}

            {/* Pulsing ring */}
            <motion.div
              className={`w-32 h-32 rounded-full border-4 flex items-center justify-center ${
                correct ? 'border-success/40' : 'border-destructive/40'
              }`}
              animate={correct ? {
                boxShadow: ['0 0 0 0 hsl(var(--success) / 0.4)', '0 0 0 20px hsl(var(--success) / 0)', '0 0 0 0 hsl(var(--success) / 0)'],
              } : {
                x: [0, -8, 8, -8, 8, 0],
              }}
              transition={correct ? { duration: 1.5, repeat: 1 } : { duration: 0.5 }}
            >
              {correct ? (
                <motion.div
                  initial={{ rotate: -45, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                >
                  <CheckCircle2 className="w-16 h-16 text-success" />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                >
                  <XCircle className="w-16 h-16 text-destructive" />
                </motion.div>
              )}
            </motion.div>

            {/* Text */}
            <motion.div
              className="mt-6 text-center"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-3xl font-heading font-bold">
                {correct ? 'Acertou!' : 'Errou!'}
              </h3>
              {correct ? (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  <span className="text-xl font-bold text-success">+{points} pontos!</span>
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Flame className="w-5 h-5 text-destructive" />
                  <span className="text-muted-foreground">Tente outra alternativa!</span>
                </div>
              )}
            </motion.div>

            <motion.button
              className="mt-6 px-8 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              onClick={onClose}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Continuar
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
