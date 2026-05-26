import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, MapPin, Navigation, MapPinned, Map as MapIcon, LogOut } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/landing")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Penny-eTracker — Smarter Parcel Tracking" },
      {
        name: "description",
        content:
          "Manage delivery partners, track locations in real time, and update parcel locations with Penny-eTracker.",
      },
    ],
  }),
});

const features = [
  {
    icon: Truck,
    title: "Delivery Partner List",
    to: "/delivery-partners" as const,
    gradient: "from-[oklch(0.6_0.22_260)] via-[oklch(0.65_0.2_290)] to-[oklch(0.7_0.2_320)]",
  },
  {
    icon: MapPin,
    title: "Location Tracking",
    to: null,
    gradient: "from-[oklch(0.65_0.2_30)] via-[oklch(0.7_0.2_50)] to-[oklch(0.75_0.18_80)]",
  },
  {
    icon: Navigation,
    title: "Update Location",
    to: "/update-location" as const,
    gradient: "from-[oklch(0.6_0.2_180)] via-[oklch(0.65_0.2_210)] to-[oklch(0.7_0.2_240)]",
  },
  {
    icon: MapPinned,
    title: "Panchayath & Ward Marking",
    to: "/marking" as const,
    gradient: "from-[oklch(0.55_0.22_150)] via-[oklch(0.6_0.22_170)] to-[oklch(0.65_0.2_200)]",
  },
  {
    icon: MapIcon,
    title: "Panchayath Map",
    to: "/map/panchayath" as const,
    gradient: "from-[oklch(0.55_0.2_300)] via-[oklch(0.6_0.22_330)] to-[oklch(0.65_0.2_10)]",
  },
];

function Landing() {
  const { user, roles, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/staff/login" });
      return;
    }
    if (isAdmin) return;
    if (roles.includes("delivery")) navigate({ to: "/delivery/dashboard" });
    else navigate({ to: "/staff/pending" });
  }, [user, roles, loading, isAdmin, navigate]);

  if (loading || !user || !isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-muted-foreground">
        Checking authentication…
      </main>
    );
  }

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/staff/login" });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[oklch(0.98_0.01_240)] via-background to-[oklch(0.95_0.03_250)]">
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Penny-eTracker" className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-tight">Penny-eTracker</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/landing">Home</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/delivery-partners">Partners</Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              <LogOut className="mr-1.5 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-4xl px-6 pb-12 pt-12 text-center sm:pt-20">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Track. Deliver.{" "}
          <span className="bg-gradient-to-r from-[oklch(0.55_0.2_260)] to-[oklch(0.7_0.2_45)] bg-clip-text text-transparent">
            Trust.
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          The complete toolkit for modern parcel tracking.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, to, gradient }) => {
          const card = (
            <Card
              className={`group relative h-40 overflow-hidden border-0 bg-gradient-to-br ${gradient} text-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-2xl ${to ? "cursor-pointer" : ""}`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,oklch(1_0_0/0.25),transparent_60%)]" />
              <div className="relative flex h-full flex-col items-start justify-between p-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm transition-transform group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
              </div>
            </Card>
          );
          return to ? (
            <Link key={title} to={to} className="block">
              {card}
            </Link>
          ) : (
            <div key={title}>{card}</div>
          );
        })}
      </section>
    </main>
  );
}
