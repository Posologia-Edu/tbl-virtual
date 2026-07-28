// Shared plan-based AI usage gating for edge functions that consume AI
// credits (quiz generation, explanation generation, etc.). Keeping this in
// one place avoids each function drifting out of sync on plan limits or the
// Stripe product IDs that identify each plan.

import Stripe from "https://esm.sh/stripe@18.5.0";

export const PLAN_AI_LIMITS: Record<string, number> = {
  "prod_U1oaoU5nQAqqW3": 0, // free
  "prod_U1oaz7iVie1pFU": 50, // pro
  "prod_U1ob8n7iDfyGLT": Infinity, // institutional
  admin: Infinity,
};

const FREE_PRODUCT_ID = "prod_U1oaoU5nQAqqW3";

export interface PlanLimitResult {
  limit: number;
  used: number;
  productId: string | null;
}

export async function getUserPlanLimit(
  supabaseClient: any,
  userId: string,
  userEmail: string,
): Promise<PlanLimitResult> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count: used } = await supabaseClient
    .from("ai_usage_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("used_at", firstOfMonth);

  const { data: isAdmin } = await supabaseClient.rpc("is_admin", { _user_id: userId });
  if (isAdmin) {
    return { limit: Infinity, used: used || 0, productId: "admin" };
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  let productId: string | null = null;

  if (stripeKey) {
    try {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) {
        const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 1 });
        if (subs.data.length > 0) {
          productId = subs.data[0].items.data[0].price.product as string;
        }
      }
    } catch (e) {
      console.error("[AI_PLAN_LIMITS] Stripe check failed:", e);
    }
  }

  if (!productId) {
    const { data: manualSub } = await supabaseClient
      .from("manual_subscriptions")
      .select("plan, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (manualSub && manualSub.plan !== "free") {
      const isExpired = manualSub.expires_at && new Date(manualSub.expires_at) < now;
      if (!isExpired) {
        const planToProduct: Record<string, string> = {
          pro: "prod_U1oaz7iVie1pFU",
          institutional: "prod_U1ob8n7iDfyGLT",
        };
        productId = planToProduct[manualSub.plan] || null;
      }
    }
  }

  if (!productId) productId = FREE_PRODUCT_ID;
  const limit = PLAN_AI_LIMITS[productId] ?? 0;
  return { limit, used: used || 0, productId };
}

export interface PlanLimitCheck {
  blocked: boolean;
  status?: number;
  body?: { error: string; message: string; used: number; limit: number };
}

// Checks the caller's plan limit against their AI usage so far this month.
// Callers should insert into ai_usage_log themselves after a successful AI
// call; this function only decides whether to allow the call.
export async function checkAIPlanLimit(
  supabaseClient: any,
  userId: string,
  userEmail: string,
): Promise<PlanLimitCheck> {
  const { limit, used } = await getUserPlanLimit(supabaseClient, userId, userEmail);

  if (limit === 0) {
    return {
      blocked: true,
      status: 403,
      body: {
        error: "PLAN_LIMIT",
        message: "Seu plano atual não inclui geração de conteúdo com IA. Faça upgrade para o plano Pro ou Institucional.",
        used,
        limit,
      },
    };
  }

  if (isFinite(limit) && used >= limit) {
    return {
      blocked: true,
      status: 403,
      body: {
        error: "PLAN_LIMIT",
        message: `Você atingiu o limite de ${limit} gerações de IA este mês (${used}/${limit}). Faça upgrade para continuar.`,
        used,
        limit,
      },
    };
  }

  return { blocked: false };
}
