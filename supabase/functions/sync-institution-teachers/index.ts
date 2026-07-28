import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, CORS_HEADERS_LONG } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, CORS_HEADERS_LONG);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: callerData, error: callerError } = await supabase.auth.getUser(token);
    if (callerError) throw new Error("Auth error");

    const callerId = callerData.user?.id;
    const callerEmail = callerData.user?.email;
    if (!callerId) throw new Error("Not authenticated");

    const { data: isAdminResult } = await supabase.rpc("is_admin", { _user_id: callerId });

    let isInstitutional = false;
    if (!isAdminResult) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey && callerEmail) {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const customers = await stripe.customers.list({ email: callerEmail, limit: 1 });
        if (customers.data.length > 0) {
          const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, limit: 10 });
          const validSub = subs.data.find((s: any) => s.status === "active" || s.status === "trialing");
          if (validSub) {
            const productId = typeof validSub.items?.data?.[0]?.price?.product === "string"
              ? validSub.items.data[0].price.product
              : null;
            if (productId === "prod_U1ob8n7iDfyGLT") isInstitutional = true;
          }
        }
      }

      if (!isInstitutional) {
        const { data: manualSub } = await supabase
          .from("manual_subscriptions")
          .select("plan")
          .eq("user_id", callerId)
          .single();
        if (manualSub?.plan === "institutional") isInstitutional = true;
      }
    }

    if (!isAdminResult && !isInstitutional) {
      throw new Error("Only admins or institutional plan owners can sync institution");
    }

    const { institution, teacherId } = await req.json();
    const safeInstitution = String(institution || "").trim();
    if (!safeInstitution) throw new Error("institution is required");

    const { error: ownProfileError } = await supabase
      .from("profiles")
      .update({ institution: safeInstitution })
      .eq("id", callerId);
    if (ownProfileError) throw ownProfileError;

    const { data: linkedSubs, error: linkedSubsError } = await supabase
      .from("manual_subscriptions")
      .select("user_id")
      .eq("granted_by", callerId);
    if (linkedSubsError) throw linkedSubsError;

    const linkedTeacherIds = Array.from(new Set((linkedSubs || []).map((s: any) => s.user_id)));

    if (linkedTeacherIds.length > 0) {
      const { error: linkedUpdateError } = await supabase
        .from("profiles")
        .update({ institution: safeInstitution })
        .in("id", linkedTeacherIds);
      if (linkedUpdateError) throw linkedUpdateError;
    }

    if (teacherId) {
      // Non-admin (institutional) callers may only approve/link teachers they have
      // actually granted a subscription to — never an arbitrary account.
      if (!isAdminResult && !linkedTeacherIds.includes(teacherId)) {
        throw new Error("You can only approve teachers linked to your institution");
      }
      const { error: teacherUpdateError } = await supabase
        .from("profiles")
        .update({ is_approved: true, institution: safeInstitution })
        .eq("id", teacherId);
      if (teacherUpdateError) throw teacherUpdateError;
    }

    return new Response(
      JSON.stringify({ success: true, syncedTeachers: linkedTeacherIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("[SYNC-INSTITUTION] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
