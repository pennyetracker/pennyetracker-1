// Edge function: staff-signup (public)
// Creates a pending staff account via phone+password using the service role key.
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
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();
    const full_name = String(body.full_name ?? "").trim();
    const rawPhone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "");
    const repeat = String(body.repeat_password ?? "");
    const panchayath_id = String(body.panchayath_id ?? "");
    const ward_id = String(body.ward_id ?? "");

    if (!full_name || full_name.length > 120) return json({ error: "Invalid full name" }, 400);
    if (!/^\+?[0-9]{6,20}$/.test(rawPhone)) return json({ error: "Invalid phone" }, 400);
    if (password.length < 6) return json({ error: "Password too short" }, 400);
    if (password !== repeat) return json({ error: "Passwords do not match" }, 400);
    if (!panchayath_id || !ward_id) return json({ error: "Panchayath and ward required" }, 400);

    const phone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
      user_metadata: { full_name, pending: "true" },
    });
    if (cErr || !created.user) return json({ error: cErr?.message ?? "Failed to create account" }, 400);
    const userId = created.user.id;

    await admin.from("profiles").upsert({ id: userId, full_name, phone });

    const { data: staff, error: sErr } = await admin
      .from("delivery_staff")
      .insert({ user_id: userId, full_name, phone, status: "pending" })
      .select("id")
      .single();
    if (sErr || !staff) return json({ error: sErr?.message ?? "Failed to create staff record" }, 400);

    await admin.from("delivery_staff_panchayaths").insert({ staff_id: staff.id, panchayath_id });
    await admin.from("delivery_staff_wards").insert({ staff_id: staff.id, ward_id });

    return json({ ok: true });
  } catch (e: any) {
    console.error("staff-signup error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}