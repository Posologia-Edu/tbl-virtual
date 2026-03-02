export const STRIPE_PLANS = {
  free: {
    name: 'Gratuito',
    price_id: 'price_1T3kxRH6ld7NmvcD24SoXT0g',
    product_id: 'prod_U1oaoU5nQAqqW3',
    price: 0,
    features: [
      '1 professor',
      'Até 30 alunos',
      '3 salas ativas/mês',
      'iRAT + tRAT + Aplicação',
      'Relatório básico',
    ],
    limits: {
      max_students: 30,
      max_rooms_per_month: 3,
      ai_questions: false,
      ai_questions_per_month: 0,
      detailed_reports: false,
      export_csv_pdf: false,
      admin_panel: false,
    },
  },
  pro: {
    name: 'Pro',
    price_id: 'price_1T3kxkH6ld7NmvcDsA2078YR',
    product_id: 'prod_U1oaz7iVie1pFU',
    price: 49.90,
    features: [
      'Alunos ilimitados',
      'Salas ilimitadas',
      'Questionários com IA (50/mês)',
      'Relatórios detalhados',
      'Exportar CSV/PDF',
      'Suporte prioritário',
    ],
    limits: {
      max_students: Infinity,
      max_rooms_per_month: Infinity,
      ai_questions: true,
      ai_questions_per_month: 50,
      detailed_reports: true,
      export_csv_pdf: true,
      admin_panel: false,
    },
  },
  institutional: {
    name: 'Institucional',
    price_id: 'price_1T3ky2H6ld7NmvcDoT8qGQfk',
    product_id: 'prod_U1ob8n7iDfyGLT',
    price: 149.90,
    features: [
      'Múltiplos professores',
      'Painel administrativo',
      'IA ilimitada',
      'White-label',
      'Relatórios consolidados',
      'Suporte dedicado',
      'Integração LMS',
    ],
    limits: {
      max_students: Infinity,
      max_rooms_per_month: Infinity,
      ai_questions: true,
      ai_questions_per_month: Infinity,
      detailed_reports: true,
      export_csv_pdf: true,
      admin_panel: true,
    },
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PLANS;

export function getPlanByProductId(productId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(STRIPE_PLANS)) {
    if (plan.product_id === productId) return key as PlanKey;
  }
  return null;
}
