import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { email: user.email });

    // Count AI usage this month
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count: aiUsedThisMonth } = await supabaseClient
      .from("ai_usage_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("used_at", firstOfMonth);
    logStep("AI usage this month", { aiUsedThisMonth });

    // Check Stripe subscription first
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    let subscribed = false;
    let productId = null;
    let subscriptionEnd = null;

    if (customers.data.length > 0) {
      const customerId = customers.data[0].id;
      logStep("Found customer", { customerId });

      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0];
        subscribed = true;
        subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
        productId = subscription.items.data[0].price.product;
        logStep("Active Stripe subscription", { productId, subscriptionEnd });
      }
    }

    // If no Stripe subscription, check manual_subscriptions
    if (!subscribed) {
      const { data: manualSub } = await supabaseClient
        .from("manual_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (manualSub && manualSub.plan !== 'free') {
        // Check expiry
        const isExpired = manualSub.expires_at && new Date(manualSub.expires_at) < now;
        if (!isExpired) {
          subscribed = true;
          // Map plan name to product_id
          const planToProduct: Record<string, string> = {
            pro: "prod_U1oaz7iVie1pFU",
            institutional: "prod_U1ob8n7iDfyGLT",
          };
          productId = planToProduct[manualSub.plan] || null;
          subscriptionEnd = manualSub.expires_at;
          logStep("Active manual subscription", { plan: manualSub.plan, productId });
        }
      }
    }

    if (!subscribed) {
      logStep("No active subscription (free plan)");
    }

    return new Response(JSON.stringify({
      subscribed,
      product_id: productId,
      subscription_end: subscriptionEnd,
      ai_used_this_month: aiUsedThisMonth || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
