import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, CORS_HEADERS_LONG } from "../_shared/cors.ts";

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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Check admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    
    const { data: isAdminResult } = await supabaseClient.rpc("is_admin", { _user_id: userData.user.id });
    if (!isAdminResult) throw new Error("Not authorized");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get all trialing subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      status: "trialing",
      limit: 100,
      expand: ["data.customer"],
    });

    const trialTeachers = [];

    for (const sub of subscriptions.data) {
      const customer = sub.customer as Stripe.Customer;
      if (!customer?.email) continue;

      const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
      const now = new Date();
      const daysRemaining = trialEnd ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

      // Get product info
      const priceProduct = sub.items?.data?.[0]?.price?.product;
      let productId: string | null = null;
      if (typeof priceProduct === "string") {
        productId = priceProduct;
      } else if (priceProduct && typeof priceProduct === "object" && "id" in priceProduct) {
        productId = (priceProduct as { id: string }).id;
      }

      // Determine plan name
      let planName = "Pro";
      if (productId === "prod_U1ob8n7iDfyGLT") planName = "Institucional";

      trialTeachers.push({
        email: customer.email,
        plan: planName,
        trial_end: trialEnd?.toISOString() || null,
        days_remaining: daysRemaining,
      });
    }

    return new Response(JSON.stringify({ trialTeachers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
