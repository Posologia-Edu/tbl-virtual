import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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

    // Check if caller is admin OR has institutional plan
    const { data: isAdminResult } = await supabase.rpc("is_admin", { _user_id: callerId });
    
    let isInstitutional = false;
    if (!isAdminResult) {
      // Check if caller has institutional plan via Stripe
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey && callerEmail) {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const customers = await stripe.customers.list({ email: callerEmail, limit: 1 });
        if (customers.data.length > 0) {
          const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, limit: 10 });
          const validSub = subs.data.find(s => s.status === "active" || s.status === "trialing");
          if (validSub) {
            const productId = typeof validSub.items?.data?.[0]?.price?.product === "string" 
              ? validSub.items.data[0].price.product 
              : null;
            if (productId === "prod_U1ob8n7iDfyGLT") isInstitutional = true;
          }
        }
      }
      // Also check manual_subscriptions
      if (!isInstitutional) {
        const { data: manualSub } = await supabase.from("manual_subscriptions").select("plan").eq("user_id", callerId).single();
        if (manualSub?.plan === "institutional") isInstitutional = true;
      }
    }

    if (!isAdminResult && !isInstitutional) {
      throw new Error("Only admins or institutional plan owners can invite teachers");
    }

    const { email, fullName, plan, institution } = await req.json();
    if (!email || !fullName) throw new Error("email and fullName are required");

    // Institutional users always grant 'pro' to their teachers
    const effectivePlan = isInstitutional && !isAdminResult ? "pro" : (plan || "free");

    console.log(`[INVITE] Inviting ${email} with plan ${effectivePlan} by ${isAdminResult ? 'admin' : 'institutional'}`);

    // Check if user already exists
    const { data: existingProfiles } = await supabase.from("profiles").select("id, email").eq("email", email);
    
    let userId: string;
    
    if (existingProfiles && existingProfiles.length > 0) {
      // User already exists - approve and link
      userId = existingProfiles[0].id;
      console.log(`[INVITE] User already exists: ${userId}, approving and linking`);
      
      const updateData: any = { is_approved: true };
      if (institution) updateData.institution = institution;
      await supabase.from("profiles").update(updateData).eq("id", userId);
    } else {
      // Create new user
      const tempPassword = crypto.randomUUID();
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: "teacher" },
      });
      if (createError) throw new Error(`Failed to create user: ${createError.message}`);
      userId = newUser.user.id;
      console.log(`[INVITE] User created: ${userId}`);

      await supabase.from("profiles").upsert({
        id: userId,
        full_name: fullName,
        email: email,
        is_approved: true,
        is_blocked: false,
        ...(institution ? { institution } : {}),
      }, { onConflict: "id" });

      await supabase.from("user_roles").upsert({
        user_id: userId,
        role: "teacher",
      }, { onConflict: "user_id,role" } as any);
    }

    // ===== ALWAYS generate recovery link and send email =====
    const origin = req.headers.get("origin") || "https://ace-team-learn.lovable.app";
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${origin}/reset-password` },
    });

    let recoveryUrl = `${origin}/forgot-password`;
    if (!linkError && linkData?.properties?.action_link) {
      recoveryUrl = linkData.properties.action_link;
      console.log(`[INVITE] Recovery link generated for ${email}`);
    } else {
      console.warn(`[INVITE] Could not generate recovery link: ${linkError?.message}, falling back to forgot-password`);
    }

    // Send invite email via Resend (ALWAYS)
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      const planName = effectivePlan === "institutional" ? "Institucional" : effectivePlan === "pro" ? "Pro" : "Gratuito";
      const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 40px 0;">
        <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
          <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 24px;">🎓 Convite TBL Virtual</h1>
          </div>
          <div style="padding: 32px;">
            <p style="font-size: 16px; color: #374151;">Olá, <strong>${fullName}</strong>!</p>
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
              Você foi convidado(a) para o <strong>TBL Virtual</strong> com o plano <strong>${planName}</strong>.
              Para começar, clique no botão abaixo e cadastre sua senha de acesso.
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${recoveryUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                Cadastrar Senha
              </a>
            </div>
            <p style="font-size: 13px; color: #9ca3af; text-align: center;">
              Caso o botão não funcione, acesse ${origin}/forgot-password e informe seu e-mail (${email}).
            </p>
          </div>
        </div>
      </body>
      </html>`;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "TBL Virtual <noreply@tbl.posologia.app>",
          to: [email],
          subject: "🎓 Você foi convidado para o TBL Virtual!",
          html,
        }),
      });

      const resendBody = await resendRes.json();
      if (!resendRes.ok) {
        console.error(`[INVITE] Resend API error (${resendRes.status}):`, JSON.stringify(resendBody));
        throw new Error(`Email sending failed: ${resendBody?.message || resendRes.statusText}`);
      } else {
        console.log(`[INVITE] Email sent successfully to ${email}:`, JSON.stringify(resendBody));
      }
    } else {
      console.warn(`[INVITE] RESEND_API_KEY not set, no email sent`);
    }

    // Grant plan via manual_subscriptions
    if (effectivePlan !== "free") {
      await supabase.from("manual_subscriptions").upsert({
        user_id: userId,
        plan: effectivePlan,
        granted_by: callerId,
      } as any, { onConflict: "user_id" });
    }

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[INVITE] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});