import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { MapPinned, Grid3x3, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/marking/")({
  component: MarkingHub,
  head: () => ({ meta: [{ title: "Marking — Penny-eTracker" }] }),
});

const items = [
  {
    to: "/marking/panchayath" as const,
    title: "Panchayath Marking",
    desc: "Map panchayaths and their N/S/E/W neighbours",
    icon: MapPinned,
    gradient: "from-[oklch(0.55_0.2_260)] to-[oklch(0.65_0.22_290)]",
  },
  {
    to: "/marking/ward" as const,
    title: "Ward Marking",
    desc: "Map wards and their N/S/E/W neighbours",
    icon: Grid3x3,
    gradient: "from-[oklch(0.6_0.2_30)] to-[oklch(0.7_0.2_60)]",
  },
];

function MarkingHub() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Marking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualise and connect panchayaths and wards on a directional graph.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {items.map(({ to, title, desc, icon: Icon, gradient }) => (
          <Link key={to} to={to}>
            <Card
              className={`group relative h-44 overflow-hidden border-0 bg-gradient-to-br ${gradient} p-6 text-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-2xl`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,oklch(1_0_0/0.25),transparent_60%)]" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm transition-transform group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                    {title} <ChevronRight className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </h2>
                  <p className="mt-1 text-sm text-white/80">{desc}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
