import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, CORS_HEADERS_LONG } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, CORS_HEADERS_LONG);
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
    let productId: string | null = null;
    let subscriptionEnd: string | null = null;

    if (customers.data.length > 0) {
      const customerId = customers.data[0].id;
      logStep("Found customer", { customerId });

      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 10,
      });

      logStep("Subscriptions found", {
        count: subscriptions.data.length,
        statuses: subscriptions.data.map((s: any) => s.status),
      });

      const validSubscription = subscriptions.data.find(
        (sub: any) => sub.status === "active" || sub.status === "trialing"
      );

      if (validSubscription) {
        subscribed = true;

        // Safely extract end date
        const endTimestamp =
          validSubscription.current_period_end ||
          validSubscription.trial_end ||
          null;

        if (endTimestamp && typeof endTimestamp === "number") {
          subscriptionEnd = new Date(endTimestamp * 1000).toISOString();
        }

        // Safely extract product ID
        const priceProduct = validSubscription.items?.data?.[0]?.price?.product;
        if (typeof priceProduct === "string") {
          productId = priceProduct;
        } else if (priceProduct && typeof priceProduct === "object" && "id" in priceProduct) {
          productId = (priceProduct as { id: string }).id;
        }

        logStep("Valid Stripe subscription", {
          status: validSubscription.status,
          productId,
          subscriptionEnd,
          current_period_end: validSubscription.current_period_end,
          trial_end: validSubscription.trial_end,
        });

        // Sync Stripe plan to manual_subscriptions so admin panel shows correct plan
        const productToPlan: Record<string, string> = {
          "prod_U1oaz7iVie1pFU": "pro",
          "prod_U1ob8n7iDfyGLT": "institutional",
        };
        const stripePlan = productId ? (productToPlan[productId] || "pro") : "pro";

        // Check if manual sub exists
        const { data: existingManualSub } = await supabaseClient
          .from("manual_subscriptions")
          .select("id, granted_by, plan")
          .eq("user_id", user.id)
          .single();

        if (existingManualSub) {
          // Only update if NOT admin-granted (don't overwrite admin decisions)
          if (!existingManualSub.granted_by || existingManualSub.granted_by === user.id) {
            await supabaseClient
              .from("manual_subscriptions")
              .update({ plan: stripePlan, expires_at: subscriptionEnd })
              .eq("id", existingManualSub.id);
            logStep("Synced Stripe plan to manual_subscriptions", { stripePlan });
          }
        } else {
          await supabaseClient
            .from("manual_subscriptions")
            .insert({ user_id: user.id, plan: stripePlan, expires_at: subscriptionEnd });
          logStep("Created manual_subscriptions from Stripe", { stripePlan });
        }
      }
    }

    // If no Stripe subscription, check manual_subscriptions
    if (!subscribed) {
      const { data: manualSub } = await supabaseClient
        .from("manual_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (manualSub && manualSub.plan !== "free") {
        const isExpired =
          manualSub.expires_at && new Date(manualSub.expires_at) < now;
        if (!isExpired) {
          subscribed = true;
          const planToProduct: Record<string, string> = {
            pro: "prod_U1oaz7iVie1pFU",
            institutional: "prod_U1ob8n7iDfyGLT",
          };
          productId = planToProduct[manualSub.plan] || null;
          subscriptionEnd = manualSub.expires_at;
          logStep("Active manual subscription", {
            plan: manualSub.plan,
            productId,
          });
        }
      }
    }

    if (!subscribed) {
      logStep("No active subscription (free plan)");

      // Check if this user is a system admin — admins can grant plans without having a subscription themselves
      const { data: isAdminResult } = await supabaseClient.rpc("is_admin", { _user_id: user.id });
      const isSystemAdmin = !!isAdminResult;
      logStep("Admin check", { isSystemAdmin });

      // Only downgrade granted teachers if this user is NOT a system admin
      // System admins grant plans manually and shouldn't trigger cascading downgrades
      // This logic is only for institutional plan owners who cancel their subscription
      if (!isSystemAdmin) {
        const { data: grantedSubs } = await supabaseClient
          .from("manual_subscriptions")
          .select("id, user_id, plan")
          .eq("granted_by", user.id)
          .neq("plan", "free");

        if (grantedSubs && grantedSubs.length > 0) {
          logStep("Downgrading teachers granted by this user", {
            count: grantedSubs.length,
          });
          for (const sub of grantedSubs) {
            await supabaseClient
              .from("manual_subscriptions")
              .update({ plan: "free" })
              .eq("id", sub.id);
          }
          logStep("All granted teachers downgraded to free");
        }
      } else {
        logStep("Skipping granted teacher downgrade (user is system admin)");
      }

      // Only downgrade this user's own manual subscription if it was NOT admin-granted
      // Admin-granted subs (granted_by IS NOT NULL) should persist until admin changes them
      await supabaseClient
        .from("manual_subscriptions")
        .update({ plan: "free" })
        .eq("user_id", user.id)
        .neq("plan", "free")
        .is("granted_by", null);
      logStep("Downgraded self-managed subscription (if any)");
    }

    return new Response(
      JSON.stringify({
        subscribed,
        product_id: productId,
        subscription_end: subscriptionEnd,
        ai_used_this_month: aiUsedThisMonth || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
