import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const schema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(20).regex(/^\+?[0-9]+$/),
  password: z.string().min(6).max(128),
  role: z.enum(["admin", "delivery"]).default("admin"),
});

export const createAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    // Verify caller is super_admin
    const { data: roles, error: rErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rErr) throw new Error(rErr.message);
    if (!roles?.some((r) => r.role === "super_admin")) {
      throw new Error("Only super admins can create users");
    }

    // Supabase requires email or phone. We use phone as the login identifier.
    const phone = data.phone.startsWith("+") ? data.phone : `+${data.phone}`;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      phone,
      password: data.password,
      phone_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const newUserId = created.user!.id;

    // Ensure profile has the name + phone (trigger may not have email)
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: newUserId, full_name: data.full_name, phone });

    // Assign requested role (trigger seeds 'delivery' by default)
    if (data.role !== "delivery") {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUserId, role: data.role });
    }

    return { id: newUserId };
  });
