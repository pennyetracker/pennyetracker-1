import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PartnerWard = { name: string; ward_number: string | null };
export type Partner = {
  id: string;
  full_name: string;
  phone: string;
  alt_phone: string | null;
  wards: PartnerWard[];
};
export type PanchayathGroup = {
  panchayath_id: string;
  panchayath_name: string;
  partners: Partner[];
};

export const getPublicDeliveryPartners = createServerFn({ method: "GET" }).handler(
  async (): Promise<PanchayathGroup[]> => {
    const { data: panchayaths, error: pErr } = await supabaseAdmin
      .from("panchayaths")
      .select("id, name")
      .order("name");
    if (pErr) throw pErr;

    const { data: staff, error: sErr } = await supabaseAdmin
      .from("delivery_staff")
      .select(
        "id, full_name, phone, alt_phone, status, delivery_staff_panchayaths(panchayath_id), delivery_staff_wards(ward_id, wards(name, ward_number, panchayath_id))",
      )
      .eq("status", "active");
    if (sErr) throw sErr;

    const groups: PanchayathGroup[] = (panchayaths ?? []).map((p) => ({
      panchayath_id: p.id,
      panchayath_name: p.name,
      partners: [],
    }));
    const byId = new Map(groups.map((g) => [g.panchayath_id, g]));

    for (const s of staff ?? []) {
      const allocPids = (s.delivery_staff_panchayaths ?? []).map((x: any) => x.panchayath_id);
      for (const pid of allocPids) {
        const g = byId.get(pid);
        if (!g) continue;
        const wards = (s.delivery_staff_wards ?? [])
          .map((w: any) => w.wards)
          .filter((w: any) => w && w.panchayath_id === pid)
          .map((w: any) => ({ name: w.name, ward_number: w.ward_number }));
        g.partners.push({
          id: s.id,
          full_name: s.full_name,
          phone: s.phone,
          alt_phone: s.alt_phone,
          wards,
        });
      }
    }

    return groups.filter((g) => g.partners.length > 0);
  },
);
