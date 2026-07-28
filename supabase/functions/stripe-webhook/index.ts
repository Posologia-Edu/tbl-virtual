// Receives Stripe webhook events so subscription cancellations and payment
// failures are reflected immediately, instead of waiting for the next
// check-subscription poll (login, or the 60s interval in useAuth.tsx).
// Called by Stripe's servers directly — no user JWT, auth is the Stripe
// signature header instead. Must NOT require Supabase JWT verification.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripePlan } from "../_shared/stripe-plan-map.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    logStep("ERROR: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook not configured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature header", { status: 400 });

  // Signature verification needs the exact raw body bytes.
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err: any) {
    logStep("Signature verification failed", { error: err.message });
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(supabase, stripe, subscription);
    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      await downgradeCustomer(supabase, stripe, subscription.customer as string);
    } else {
      logStep("Ignored event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    // Return 500 so Stripe retries delivery — a transient DB error shouldn't
    // silently drop the event.
    logStep("ERROR handling event", { type: event.type, error: err.message });
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function findUserIdByCustomer(supabase: any, stripe: Stripe, customerId: string): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || !("email" in customer) || !customer.email) return null;

  const { data: matches } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", customer.email)
    .limit(1);
  return matches && matches.length > 0 ? matches[0].id : null;
}

async function syncSubscription(supabase: any, stripe: Stripe, subscription: Stripe.Subscription) {
  const userId = await findUserIdByCustomer(supabase, stripe, subscription.customer as string);
  if (!userId) {
    logStep("No matching user for customer", { customer: subscription.customer });
    return;
  }

  const isValid = subscription.status === "active" || subscription.status === "trialing";
  if (!isValid) {
    logStep("Subscription not active/trialing, downgrading", { userId, status: subscription.status });
    await applyPlan(supabase, userId, "free", null);
    return;
  }

  const priceProduct = subscription.items.data[0]?.price?.product;
  const productId = typeof priceProduct === "string" ? priceProduct : (priceProduct?.id ?? null);
  const { plan, recognized } = resolveStripePlan(productId);
  if (!recognized) {
    logStep("WARNING: unrecognized product_id on active subscription — defaulting to free", { productId });
  }

  const endTimestamp = subscription.current_period_end || subscription.trial_end || null;
  const expiresAt = endTimestamp ? new Date(endTimestamp * 1000).toISOString() : null;

  await applyPlan(supabase, userId, plan, expiresAt);
  logStep("Synced plan from webhook", { userId, plan, status: subscription.status });
}

async function downgradeCustomer(supabase: any, stripe: Stripe, customerId: string) {
  const userId = await findUserIdByCustomer(supabase, stripe, customerId);
  if (!userId) {
    logStep("No matching user for customer", { customer: customerId });
    return;
  }
  await applyPlan(supabase, userId, "free", null);
  logStep("Downgraded to free after subscription deletion", { userId });
}

// Writes the resolved plan to manual_subscriptions, respecting admin-granted
// rows (never overwritten by Stripe sync) and cascading the downgrade to any
// teachers this user had granted institutional access to — mirrors the
// equivalent logic in check-subscription/index.ts so both paths agree.
async function applyPlan(supabase: any, userId: string, plan: string, expiresAt: string | null) {
  const { data: existing } = await supabase
    .from("manual_subscriptions")
    .select("id, granted_by")
    .eq("user_id", userId)
    .maybeSingle();

  const isAdminGranted = !!existing?.granted_by && existing.granted_by !== userId;
  if (isAdminGranted) {
    logStep("Skipping sync — subscription is admin-granted", { userId });
    return;
  }

  if (existing) {
    await supabase.from("manual_subscriptions").update({ plan, expires_at: expiresAt }).eq("id", existing.id);
  } else {
    await supabase.from("manual_subscriptions").insert({ user_id: userId, plan, expires_at: expiresAt });
  }

  if (plan === "free") {
    const { data: isAdminResult } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!isAdminResult) {
      const { data: grantedSubs } = await supabase
        .from("manual_subscriptions")
        .select("id")
        .eq("granted_by", userId)
        .neq("plan", "free");
      if (grantedSubs && grantedSubs.length > 0) {
        await supabase.from("manual_subscriptions").update({ plan: "free" }).eq("granted_by", userId).neq("plan", "free");
        logStep("Cascaded downgrade to granted teachers", { userId, count: grantedSubs.length });
      }
    }
  }
}
