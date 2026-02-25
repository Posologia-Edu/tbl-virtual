import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const log = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-METRICS] ${step}${d}`);
};

serve(async () => {
  try {
    log("Starting metrics collection");

    const hubServiceKey = Deno.env.get("HUB_SERVICE_KEY");
    const hubServiceId = Deno.env.get("HUB_SERVICE_ID");
    if (!hubServiceKey || !hubServiceId) throw new Error("Missing HUB_SERVICE_KEY or HUB_SERVICE_ID");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Total users
    const { count: totalUsers, error: e1 } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    if (e1) throw new Error(`profiles count: ${e1.message}`);

    // Active users (last 30 days) — users who joined a room recently
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: activeUsers, error: e2 } = await supabase
      .from("room_participants")
      .select("user_id", { count: "exact", head: true })
      .gte("joined_at", thirtyDaysAgo);
    if (e2) throw new Error(`active users: ${e2.message}`);

    // Subscribers (teachers with active subscription — approximated by approved teachers)
    const { count: subscribers, error: e3 } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "teacher");
    if (e3) throw new Error(`subscribers: ${e3.message}`);

    const metrics = {
      service_id: hubServiceId,
      total_users: totalUsers ?? 0,
      active_users: activeUsers ?? 0,
      subscribers: subscribers ?? 0,
      ai_requests: 0,
      ai_tokens_used: 0,
      ai_cost_usd: 0,
      revenue_usd: 0,
      mrr_usd: 0,
    };

    log("Metrics collected", metrics);

    const res = await fetch(
      "https://slmnpcabhjsqithkmkxn.supabase.co/functions/v1/report-metrics",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-service-key": hubServiceKey,
        },
        body: JSON.stringify(metrics),
      }
    );

    const body = await res.text();
    if (!res.ok) throw new Error(`Hub responded ${res.status}: ${body}`);

    log("Metrics sent successfully", { status: res.status });

    return new Response(JSON.stringify({ success: true, metrics }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    log("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
