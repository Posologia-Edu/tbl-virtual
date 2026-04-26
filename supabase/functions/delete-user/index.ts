import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
    if (!isAdminResult) throw new Error("Only admins can delete users");

    const { userId } = await req.json();
    if (!userId) throw new Error("userId is required");

    // Prevent self-deletion
    if (userId === callerId) throw new Error("Cannot delete yourself");

    console.log(`[DELETE-USER] Deleting user ${userId}`);

    // Delete all user data from every table (order matters for FK constraints)
    await supabase.from("student_achievements").delete().eq("user_id", userId);
    await supabase.from("irat_responses").delete().eq("student_id", userId);
    await supabase.from("trat_attempts").delete().eq("submitted_by", userId);
    await supabase.from("application_responses").delete().eq("submitted_by", userId);
    await supabase.from("appeals").delete().eq("submitted_by", userId);
    await supabase.from("team_members").delete().eq("user_id", userId);
    await supabase.from("room_participants").delete().eq("user_id", userId);
    await supabase.from("class_students").delete().eq("student_id", userId);
    await supabase.from("ai_usage_log").delete().eq("user_id", userId);
    await supabase.from("manual_subscriptions").delete().eq("user_id", userId);

    // Delete rooms owned by user (and their dependent data)
    const { data: userRooms } = await supabase.from("rooms").select("id").eq("teacher_id", userId);
    if (userRooms && userRooms.length > 0) {
      const roomIds = userRooms.map((r: any) => r.id);
      await supabase.from("appeals").delete().in("room_id", roomIds);
      await supabase.from("application_responses").delete().in("room_id", roomIds);
      await supabase.from("application_questions").delete().in("room_id", roomIds);
      await supabase.from("trat_attempts").delete().in("room_id", roomIds);
      await supabase.from("irat_responses").delete().in("room_id", roomIds);
      await supabase.from("student_achievements").delete().in("room_id", roomIds);
      // Delete teams and team_members for these rooms
      const { data: teams } = await supabase.from("teams").select("id").in("room_id", roomIds);
      if (teams && teams.length > 0) {
        const teamIds = teams.map((t: any) => t.id);
        await supabase.from("team_members").delete().in("team_id", teamIds);
        await supabase.from("teams").delete().in("id", teamIds);
      }
      await supabase.from("room_participants").delete().in("room_id", roomIds);
      await supabase.from("rooms").delete().in("id", roomIds);
    }

    // Delete quizzes owned by user
    const { data: userQuizzes } = await supabase.from("quizzes").select("id").eq("teacher_id", userId);
    if (userQuizzes && userQuizzes.length > 0) {
      const quizIds = userQuizzes.map((q: any) => q.id);
      await supabase.from("questions").delete().in("quiz_id", quizIds);
      await supabase.from("application_questions").delete().in("quiz_id", quizIds);
      await supabase.from("quizzes").delete().in("id", quizIds);
    }

    // Delete classes owned by user
    const { data: userClasses } = await supabase.from("classes").select("id").eq("teacher_id", userId);
    if (userClasses && userClasses.length > 0) {
      const classIds = userClasses.map((c: any) => c.id);
      await supabase.from("class_students").delete().in("class_id", classIds);
      await supabase.from("classes").delete().in("id", classIds);
    }

    // Delete user role and profile
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("profiles").delete().eq("id", userId);

    // Finally delete from auth
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error("[DELETE-USER] Auth delete error:", authDeleteError.message);
      throw new Error(`Failed to delete auth user: ${authDeleteError.message}`);
    }

    console.log(`[DELETE-USER] User ${userId} fully deleted`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[DELETE-USER] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
