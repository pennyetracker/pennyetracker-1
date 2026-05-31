import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bike, MapPin, User, Phone, Home, ChevronDown, UserPlus, Building2, Navigation } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/delivery-partners")({
  component: DeliveryPartnersPage,
  head: () => ({
    meta: [
      { title: "Delivery Partners — Penny-eTracker" },
      { name: "description", content: "Browse delivery partners by panchayath with contact and assigned wards." },
    ],
  }),
});

type PartnerWard = { name: string; ward_number: string | null };
type PartnerAssignment = {
  panchayath_id: string;
  panchayath_name: string;
  wards: PartnerWard[];
};
type Partner = {
  id: string;
  full_name: string;
  phone: string;
  alt_phone: string | null;
  latitude: number | null;
  longitude: number | null;
  location_updated_at: string | null;
  wards: PartnerWard[];
  assignments: PartnerAssignment[];
};
type PanchayathGroup = {
  panchayath_id: string;
  panchayath_name: string;
  partners: Partner[];
};

const PALETTE = [
  { chip: "bg-emerald-600", card: "bg-emerald-50", icon: "text-emerald-600" },
  { chip: "bg-blue-600", card: "bg-blue-50", icon: "text-blue-600" },
  { chip: "bg-orange-500", card: "bg-orange-50", icon: "text-orange-500" },
  { chip: "bg-violet-600", card: "bg-violet-50", icon: "text-violet-600" },
  { chip: "bg-pink-600", card: "bg-pink-50", icon: "text-pink-600" },
  { chip: "bg-teal-600", card: "bg-teal-50", icon: "text-teal-600" },
  { chip: "bg-amber-700", card: "bg-amber-50", icon: "text-amber-700" },
  { chip: "bg-indigo-600", card: "bg-indigo-50", icon: "text-indigo-600" },
];

type ColorSet = { chip: string; card: string; icon: string };

function PartnerCard({ partner, colors }: { partner: Partner; colors: ColorSet }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg bg-white/80 shadow-sm ring-1 ring-black/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 min-w-0">
          <User className={`h-4 w-4 shrink-0 ${colors.icon}`} />
          <span className="font-medium truncate">{partner.full_name}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""} ${colors.icon}`} />
      </button>
      {open && (
        <div className="border-t px-3 py-2">
          <a href={`tel:${partner.phone}`} className="flex items-center gap-2 text-sm hover:underline">
            <Phone className={`h-4 w-4 ${colors.icon}`} />
            <span>{partner.phone}</span>
          </a>
          {partner.alt_phone && (
            <a href={`tel:${partner.alt_phone}`} className="mt-1 flex items-center gap-2 text-sm hover:underline">
              <Phone className={`h-4 w-4 ${colors.icon}`} />
              <span>{partner.alt_phone}</span>
            </a>
          )}
          {partner.assignments.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Building2 className={`h-3.5 w-3.5 ${colors.icon}`} />
                Allocated panchayaths
              </div>
              {partner.assignments.map((a) => (
                <div key={a.panchayath_id} className="rounded-md bg-white px-2 py-1.5 ring-1 ring-black/5">
                  <div className="text-sm font-medium">{a.panchayath_name}</div>
                  {a.wards.length > 0 && (
                    <div className="mt-0.5 flex items-start gap-1.5 text-xs">
                      <Home className={`mt-0.5 h-3 w-3 shrink-0 ${colors.icon}`} />
                      <span>
                        <span className="text-muted-foreground">Wards: </span>
                        <span className="font-medium">
                          {a.wards.map((w) => w.ward_number ?? w.name).join(", ")}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {partner.latitude != null && partner.longitude != null && (
            <a
              href={`https://www.google.com/maps?q=${partner.latitude},${partner.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center gap-2 text-sm hover:underline"
            >
              <Navigation className={`h-4 w-4 ${colors.icon}`} />
              <span className="font-medium">Pinned location</span>
              <span className="text-muted-foreground">
                ({partner.latitude.toFixed(5)}, {partner.longitude.toFixed(5)})
              </span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function DeliveryPartnersPage() {
  const { data: groups = [], isLoading, error } = useQuery({
    queryKey: ["public-delivery-partners"],
    queryFn: async (): Promise<PanchayathGroup[]> => {
      const { data, error } = await supabase.rpc("get_public_delivery_partners");
      if (error) throw error;
      return (data as PanchayathGroup[] | null) ?? [];
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 pb-12">
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[oklch(0.25_0.08_260)] px-5 py-4 text-white shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-lg bg-white/15 p-2">
              <Bike className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl truncate">Delivery Staff Directory</h1>
          </div>
          <Link
            to="/staff/signup"
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-[oklch(0.25_0.08_260)] shadow hover:bg-white/90"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Sign up</span>
          </Link>
        </div>

        {isLoading && <p className="mt-8 text-center text-muted-foreground">Loading…</p>}
        {error && (
          <p className="mt-8 text-center text-destructive">Failed to load: {(error as Error).message}</p>
        )}
        {!isLoading && !error && groups.length === 0 && (
          <p className="mt-8 text-center text-muted-foreground">No delivery partners yet.</p>
        )}

        <div className="mt-6 space-y-6">
          {groups.map((g, gi) => {
            const c = PALETTE[gi % PALETTE.length];
            return (
              <section key={g.panchayath_id}>
                <div className="flex justify-center">
                  <div className={`inline-flex items-center gap-1.5 rounded-md ${c.chip} px-4 py-1.5 text-sm font-semibold text-white shadow`}>
                    <MapPin className="h-4 w-4" />
                    {g.panchayath_name}
                  </div>
                </div>

                <div className={`mt-2 grid gap-2 rounded-xl ${c.card} p-3 sm:grid-cols-2 lg:grid-cols-3`}>
                  {g.partners.map((p) => (
                    <PartnerCard key={p.id} partner={p} colors={c} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
