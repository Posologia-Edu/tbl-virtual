import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: callerData, error: callerError } = await supabase.auth.getUser(token);
    if (callerError) throw new Error("Auth error");
    const callerId = callerData.user?.id;
    if (!callerId) throw new Error("Not authenticated");

    const { data: isAdminResult } = await supabase.rpc("is_admin", { _user_id: callerId });
    if (!isAdminResult) throw new Error("Only admins can invite teachers");

    const { email, fullName, plan } = await req.json();
    if (!email || !fullName) throw new Error("email and fullName are required");

    console.log(`[INVITE] Inviting ${email} with plan ${plan || 'free'}`);

    // Create user with a random password (they'll reset it)
    const tempPassword = crypto.randomUUID();
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "teacher" },
    });
    if (createError) throw new Error(`Failed to create user: ${createError.message}`);
    const userId = newUser.user.id;
    console.log(`[INVITE] User created: ${userId}`);

    // Ensure profile and role exist (trigger may handle this, but let's be safe)
    await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      email: email,
      is_approved: true,
      is_blocked: false,
    }, { onConflict: "id" });

    await supabase.from("user_roles").upsert({
      user_id: userId,
      role: "teacher",
    }, { onConflict: "user_id,role" } as any);

    // Grant plan if not free
    if (plan && plan !== "free") {
      await supabase.from("manual_subscriptions").upsert({
        user_id: userId,
        plan,
        granted_by: callerId,
      } as any, { onConflict: "user_id" });
    }

    // Send password reset email so the user can set their password
    const origin = req.headers.get("origin") || "https://ace-team-learn.lovable.app";
    const { error: resetError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${origin}/reset-password` },
    });

    // Also send a welcome email via Resend if available
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      const planName = plan === "institutional" ? "Institucional" : plan === "pro" ? "Pro" : "Gratuito";
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
              <a href="${origin}/forgot-password" 
                 style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                Cadastrar Senha
              </a>
            </div>
            <p style="font-size: 13px; color: #9ca3af; text-align: center;">
              Caso o botão não funcione, acesse ${origin}/forgot-password e informe seu e-mail (${email}) para receber o link de redefinição de senha.
            </p>
            <p style="font-size: 13px; color: #9ca3af; text-align: center; margin-top: 24px;">
              TBL Virtual — Aprendizagem Baseada em Equipes
            </p>
          </div>
        </div>
      </body>
      </html>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "TBL Virtual <onboarding@resend.dev>",
          to: [email],
          subject: "🎓 Você foi convidado para o TBL Virtual!",
          html,
        }),
      });
      console.log(`[INVITE] Welcome email sent to ${email}`);
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
