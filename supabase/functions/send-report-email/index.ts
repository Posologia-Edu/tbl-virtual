import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { roomId } = await req.json();
    if (!roomId) return new Response(JSON.stringify({ error: "roomId required" }), { status: 400, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: room } = await supabase.from("rooms").select("*").eq("id", roomId).single();
    if (!room) return new Response(JSON.stringify({ error: "Room not found" }), { status: 404, headers: corsHeaders });

    const { data: participants } = await supabase.from("room_participants").select("user_id, participant_code, profiles:user_id(full_name, email)").eq("room_id", roomId);
    const { data: questions } = await supabase.from("questions").select("*").eq("quiz_id", room.quiz_id).order("sort_order");
    const { data: iratResponses } = await supabase.from("irat_responses").select("*").eq("room_id", roomId);
    const { data: teams } = await supabase.from("teams").select("id, name, team_members(user_id)").eq("room_id", roomId);
    const { data: tratAttempts } = await supabase.from("trat_attempts").select("*").eq("room_id", roomId);
    const { data: appQuestions } = await supabase.from("application_questions").select("*").eq("room_id", roomId);
    const { data: appResponses } = await supabase.from("application_responses").select("*").eq("room_id", roomId);

    const maxGrade = room.max_grade || 10;
    const iratPct = (room.individual_pct || 30) / 100;
    const tratPct = (room.team_pct || 40) / 100;
    const appPct = (room.application_pct || 30) / 100;
    const maxIrat = (questions?.length || 1) * 4;
    const maxTrat = (questions?.length || 1) * 4;
    const maxApp = (appQuestions?.length || 1);

    console.log(`Processing ${(participants || []).length} participants for room ${roomId}`);

    const emails: string[] = [];
    for (const p of (participants || [])) {
      const studentId = p.user_id;
      const profile = (p as any).profiles;
      const name = profile?.full_name || "Aluno";
      const ra = p.participant_code || "—";

      // Use email from profiles first, fall back to auth email
      let email = profile?.email;
      if (!email) {
        const { data: userData } = await supabase.auth.admin.getUserById(studentId);
        email = userData?.user?.email;
      }
      console.log(`Student ${name}: email=${email}`);
      if (!email || email.endsWith("@student.tbl")) continue;

      const studentIrat = (iratResponses || []).filter((r: any) => r.student_id === studentId);
      const iratRaw = studentIrat.reduce((s: number, r: any) => s + r.score, 0);

      const studentTeam = (teams || []).find((t: any) => (t.team_members || []).some((m: any) => m.user_id === studentId));
      let tratRaw = 0;
      if (studentTeam) {
        const tAttempts = (tratAttempts || []).filter((a: any) => a.team_id === studentTeam.id && a.is_correct);
        tratRaw = tAttempts.reduce((s: number, a: any) => s + [4, 2, 1, 0][a.attempt_number - 1], 0);
      }

      let appRaw = 0;
      if (studentTeam && appQuestions?.length) {
        appRaw = appQuestions.filter((q: any) => (appResponses || []).some((r: any) => r.question_id === q.id && r.team_id === studentTeam.id && ((q.correct_answer === 'V' && r.selected_option === 'A') || (q.correct_answer === 'F' && r.selected_option === 'B')))).length;
      }

      const iratGrade = maxIrat > 0 ? (iratRaw / maxIrat) * maxGrade : 0;
      const tratGrade = maxTrat > 0 ? (tratRaw / maxTrat) * maxGrade : 0;
      const appGrade = maxApp > 0 ? (appRaw / maxApp) * maxGrade : 0;
      const finalGrade = iratGrade * iratPct + tratGrade * tratPct + appGrade * appPct;

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h1 style="color:#2563eb;text-align:center;">TBL Virtual - Relatório Individual</h1>
          <h2 style="text-align:center;">${room.name}</h2>
          <hr/>
          <p><strong>Aluno:</strong> ${name}</p>
          <p><strong>RA:</strong> ${ra}</p>
          <p><strong>Equipe:</strong> ${studentTeam?.name || '—'}</p>
          <hr/>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#f1f5f9;">
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Etapa</th>
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:center;">Peso</th>
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:center;">Nota</th>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #e2e8f0;">iRAT (Individual)</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${(iratPct * 100).toFixed(0)}%</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${iratGrade.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #e2e8f0;">tRAT (Equipe)</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${(tratPct * 100).toFixed(0)}%</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${tratGrade.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #e2e8f0;">Aplicação de Conceitos</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${(appPct * 100).toFixed(0)}%</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${appGrade.toFixed(2)}</td>
            </tr>
            <tr style="background:#eff6ff;font-weight:bold;">
              <td style="padding:8px;border:1px solid #e2e8f0;">Nota Final</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">100%</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;color:#2563eb;">${finalGrade.toFixed(2)}</td>
            </tr>
          </table>
          <p style="text-align:center;color:#64748b;font-size:12px;">Nota máxima: ${maxGrade}</p>
        </div>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "TBL Virtual <noreply@tbl.posologia.app>", to: [email], subject: `Relatório TBL - ${room.name}`, html }),
      });
      if (res.ok) emails.push(email);
    }

    return new Response(JSON.stringify({ sent: emails.length, emails }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
