import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { teacherId } = await req.json();
    if (!teacherId) {
      return new Response(JSON.stringify({ error: "teacherId is required" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get teacher profile
    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", teacherId).single();
    
    // Get auth email as fallback
    const { data: userData } = await supabase.auth.admin.getUserById(teacherId);
    const email = profile?.email || userData?.user?.email;
    const name = profile?.full_name || "Professor(a)";

    if (!email) {
      return new Response(JSON.stringify({ error: "No email found for teacher" }), { status: 400, headers: corsHeaders });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500, headers: corsHeaders });
    }

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 40px 0;">
      <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">🎉 Cadastro Aprovado!</h1>
        </div>
        <div style="padding: 32px;">
          <p style="font-size: 16px; color: #374151;">Olá, <strong>${name}</strong>!</p>
          <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
            Seu cadastro no <strong>TBL Virtual</strong> foi aprovado pelo administrador. 
            Agora você pode acessar a plataforma e começar a criar suas atividades de Team-Based Learning.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="https://ace-team-learn.lovable.app/auth" 
               style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Acessar TBL Virtual
            </a>
          </div>
          <p style="font-size: 13px; color: #9ca3af; text-align: center; margin-top: 24px;">
            TBL Virtual — Aprendizagem Baseada em Equipes
          </p>
        </div>
      </div>
    </body>
    </html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "TBL Virtual <noreply@tbl.posologia.app>",
        to: [email],
        subject: "✅ Seu cadastro no TBL Virtual foi aprovado!",
        html,
      }),
    });

    const result = await res.json();
    console.log("Approval email result:", JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, email }), { headers: corsHeaders });
  } catch (err) {
    console.error("Error sending approval email:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
