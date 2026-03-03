import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { STRIPE_PLANS } from '@/lib/stripe-plans';

export function usePlanLimits() {
  const { subscription, checkSubscription } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string>('');

  const currentPlan = subscription.plan || 'free';
  const planData = STRIPE_PLANS[currentPlan];
  const limits = planData.limits;

  const canUseAI = limits.ai_questions;
  const aiLimit = limits.ai_questions_per_month;
  const aiUsed = subscription.aiUsedThisMonth;
  const aiRemaining = isFinite(aiLimit) ? Math.max(0, aiLimit - aiUsed) : Infinity;
  const isAiLimitReached = isFinite(aiLimit) && aiUsed >= aiLimit;

  const canViewDetailedReports = limits.detailed_reports;
  const canExportCSV = limits.export_csv_pdf;
  const canUseAdminPanel = limits.admin_panel;

  const maxRoomsPerMonth = limits.max_rooms_per_month;
  const maxStudents = limits.max_students;
  const maxQuizzes = limits.max_quizzes;
  const maxQuestionsPerQuiz = limits.max_questions_per_quiz;

  const showUpgradeDialog = useCallback((feature: string) => {
    setUpgradeFeature(feature);
    setUpgradeOpen(true);
  }, []);

  const closeUpgradeDialog = useCallback(() => {
    setUpgradeOpen(false);
    setUpgradeFeature('');
  }, []);

  return {
    currentPlan,
    planData,
    canUseAI,
    aiLimit,
    aiUsed,
    aiRemaining,
    isAiLimitReached,
    canViewDetailedReports,
    canExportCSV,
    canUseAdminPanel,
    maxRoomsPerMonth,
    maxStudents,
    maxQuizzes,
    maxQuestionsPerQuiz,
    upgradeOpen,
    upgradeFeature,
    showUpgradeDialog,
    closeUpgradeDialog,
    refreshSubscription: checkSubscription,
  };
}
