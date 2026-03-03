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
    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: callerData, error: callerError } = await supabase.auth.getUser(token);
    if (callerError || !callerData.user) throw new Error("Not authenticated");

    const senderName = callerData.user.user_metadata?.full_name || callerData.user.email || "Usuário";
    const senderEmail = callerData.user.email || "desconhecido";

    const { subject, message } = await req.json();
    if (!subject?.trim() || !message?.trim()) {
      throw new Error("subject and message are required");
    }

    const adminEmails = ["srfernandesaraujo@gmail.com"];

    console.log(`[CONTACT] From: ${senderEmail}, To: ${adminEmails.join(", ")}, Subject: ${subject}`);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 40px 0;">
      <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px 32px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 20px;">📬 Nova Mensagem de Contato</h1>
        </div>
        <div style="padding: 32px;">
          <p style="font-size: 14px; color: #6b7280; margin: 0 0 4px;"><strong>De:</strong> ${senderName} (${senderEmail})</p>
          <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px;"><strong>Assunto:</strong> ${subject}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
          <div style="font-size: 15px; color: #374151; line-height: 1.7; white-space: pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px;" />
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            Enviado via TBL Virtual — Formulário de Contato
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
        to: adminEmails,
        reply_to: senderEmail,
        subject: `[TBL Contato] ${subject}`,
        html,
      }),
    });

    const resendBody = await resendRes.json();
    if (!resendRes.ok) {
      console.error(`[CONTACT] Resend error (${resendRes.status}):`, JSON.stringify(resendBody));
      throw new Error(`Email sending failed: ${resendBody?.message || resendRes.statusText}`);
    }

    console.log(`[CONTACT] Email sent successfully:`, JSON.stringify(resendBody));

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[CONTACT] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
