import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bike, MapPin, User, Phone, Home } from "lucide-react";
import { getPublicDeliveryPartners } from "@/lib/delivery-partners.functions";

export const Route = createFileRoute("/delivery-partners")({
  component: DeliveryPartnersPage,
  head: () => ({
    meta: [
      { title: "Delivery Partners — Penny-eTracker" },
      { name: "description", content: "Browse delivery partners by panchayath with contact and assigned wards." },
    ],
  }),
});

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

function DeliveryPartnersPage() {
  const fetchPartners = useServerFn(getPublicDeliveryPartners);
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["public-delivery-partners"],
    queryFn: () => fetchPartners(),
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 pb-12">
      <div className="mx-auto max-w-3xl px-4 pt-6">
        {/* Banner */}
        <div className="flex items-center gap-3 rounded-xl bg-[oklch(0.25_0.08_260)] px-5 py-4 text-white shadow-md">
          <div className="rounded-lg bg-white/15 p-2">
            <Bike className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Delivery Staff Directory</h1>
        </div>

        {isLoading && <p className="mt-8 text-center text-muted-foreground">Loading…</p>}
        {!isLoading && groups.length === 0 && (
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

                <div className={`mt-2 grid gap-3 rounded-xl ${c.card} p-3 sm:grid-cols-2 lg:grid-cols-3`}>
                  {g.partners.map((p) => (
                    <div key={p.id} className="rounded-lg bg-white/80 p-3 shadow-sm ring-1 ring-black/5">
                      <div className="flex items-center gap-2">
                        <User className={`h-4 w-4 ${c.icon}`} />
                        <span className="font-medium truncate">{p.full_name}</span>
                      </div>
                      <a href={`tel:${p.phone}`} className="mt-1.5 flex items-center gap-2 text-sm hover:underline">
                        <Phone className={`h-4 w-4 ${c.icon}`} />
                        <span>{p.phone}</span>
                      </a>
                      {p.alt_phone && (
                        <a href={`tel:${p.alt_phone}`} className="mt-1 flex items-center gap-2 text-sm hover:underline">
                          <Phone className={`h-4 w-4 ${c.icon}`} />
                          <span>{p.alt_phone}</span>
                        </a>
                      )}
                      {p.wards.length > 0 && (
                        <div className="mt-1.5 flex items-start gap-2 text-sm">
                          <Home className={`mt-0.5 h-4 w-4 shrink-0 ${c.icon}`} />
                          <div>
                            <span className="text-muted-foreground">Wards: </span>
                            <span className="font-medium">
                              {p.wards
                                .map((w) => w.ward_number ?? w.name)
                                .join(", ")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
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
