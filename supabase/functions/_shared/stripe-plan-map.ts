// Single source of truth (within edge functions) for mapping a Stripe
// product_id to this app's plan key. Mirrors src/lib/stripe-plans.ts.
export const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_U1oaz7iVie1pFU": "pro",
  "prod_U1ob8n7iDfyGLT": "institutional",
};

export interface ResolvedPlan {
  plan: string;
  // false when productId was non-null but didn't match a known plan —
  // callers should log this, since it usually means a Stripe product was
  // renamed/recreated without updating PRODUCT_TO_PLAN.
  recognized: boolean;
}

// Fails closed: an unrecognized product_id resolves to "free", never to a
// paid plan. Silently defaulting an unknown product to "pro" would grant
// access on any Stripe product misconfiguration or renamed/legacy product.
export function resolveStripePlan(productId: string | null): ResolvedPlan {
  if (!productId) return { plan: "free", recognized: true };
  const plan = PRODUCT_TO_PLAN[productId];
  return plan ? { plan, recognized: true } : { plan: "free", recognized: false };
}
