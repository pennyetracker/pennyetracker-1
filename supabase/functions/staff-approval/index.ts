// Edge function: staff-approval
// Super-admin endpoints to list pending staff, approve (assign role + activate), or reject.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", userData.user.id);
    if (!roles?.some((r: any) => r.role === "super_admin")) {
      return json({ error: "Only super admins can perform this action" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "list");

    if (action === "list") {
      const { data, error } = await admin
        .from("delivery_staff")
        .select("id, full_name, phone, status, created_at, delivery_staff_panchayaths(panchayath_id, panchayaths(name)), delivery_staff_wards(ward_id, wards(name, ward_number))")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      const list = (data ?? []).map((s: any) => ({
        id: s.id,
        full_name: s.full_name,
        phone: s.phone,
        created_at: s.created_at,
        panchayaths: (s.delivery_staff_panchayaths ?? []).map((p: any) => p.panchayaths?.name).filter(Boolean),
        wards: (s.delivery_staff_wards ?? []).map((w: any) => w.wards?.ward_number ? `Ward ${w.wards.ward_number}` : w.wards?.name).filter(Boolean),
      }));
      return json({ pending: list });
    }

    if (action === "approve") {
      const staff_id = String(body.staff_id ?? "");
      const role = body.role === "admin" ? "admin" : "delivery";
      if (!staff_id) return json({ error: "staff_id required" }, 400);

      const { data: staff, error: sErr } = await admin
        .from("delivery_staff").select("user_id").eq("id", staff_id).single();
      if (sErr || !staff?.user_id) return json({ error: sErr?.message ?? "Staff not found" }, 404);

      const { error: rErr } = await admin
        .from("user_roles").insert({ user_id: staff.user_id, role });
      if (rErr && !rErr.message.includes("duplicate")) return json({ error: rErr.message }, 500);

      const { error: uErr } = await admin
        .from("delivery_staff").update({ status: "active" }).eq("id", staff_id);
      if (uErr) return json({ error: uErr.message }, 500);
      return json({ ok: true });
    }

    if (action === "reject") {
      const staff_id = String(body.staff_id ?? "");
      if (!staff_id) return json({ error: "staff_id required" }, 400);
      const { error } = await admin
        .from("delivery_staff").update({ status: "rejected" }).eq("id", staff_id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    console.error("staff-approval error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}