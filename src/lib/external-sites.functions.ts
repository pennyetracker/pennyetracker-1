import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const testExternalSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { siteId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify caller is admin via RLS-protected fetch
    const { data: site, error } = await supabase
      .from("external_tracking_sites")
      .select("*")
      .eq("id", data.siteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!site) throw new Error("Site not found or not authorized");

    const url = site.test_endpoint_url || site.website_url;
    const headerName = site.auth_header_name || "Authorization";
    const headerValue = (site.auth_header_prefix || "") + site.api_key;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { [headerName]: headerValue },
      });
      return { ok: res.ok, status: res.status, statusText: res.statusText, userId };
    } catch (e: any) {
      return { ok: false, status: 0, statusText: e?.message ?? "Network error", userId };
    }
  });
