import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, MapPin, Navigation } from "lucide-react";
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
    description:
      "Browse and manage all your trusted delivery partners in one place. Quickly assign parcels, view performance, and keep your fleet organized.",
  },
  {
    icon: MapPin,
    title: "Location Tracking",
    description:
      "Follow every parcel in real time on an interactive map. Get live ETAs, route history, and instant alerts on key delivery milestones.",
  },
  {
    icon: Navigation,
    title: "Update Location",
    description:
      "Drivers can update parcel locations on the go with one tap. Customers stay informed with accurate, up-to-the-minute delivery status.",
  },
];

function Landing() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[oklch(0.98_0.01_240)] via-background to-[oklch(0.95_0.03_250)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Penny-eTracker" className="h-10 w-10" />
          <span className="text-lg font-semibold tracking-tight">Penny-eTracker</span>
        </Link>
        <Button size="sm" asChild><Link to="/auth">Get Started</Link></Button>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-12 pt-8 text-center sm:pt-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Track. Deliver. <span className="bg-gradient-to-r from-[oklch(0.55_0.2_260)] to-[oklch(0.7_0.2_45)] bg-clip-text text-transparent">Trust.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          The complete toolkit for modern parcel tracking — manage partners, watch every move, and keep customers in the loop.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => {
          const to = title === "Delivery Partner List" ? "/delivery-partners" : null;
          const card = (
          <Card
            key={title}
            className={`group h-full border-border/60 transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_oklch(0.55_0.2_260/0.15)] ${to ? "cursor-pointer" : ""}`}
          >
            <CardHeader>
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.55_0.2_260)] to-[oklch(0.7_0.2_45)] text-white shadow-md transition-transform group-hover:scale-110">
                <Icon className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
            </CardContent>
          </Card>
          );
          return to ? (
            <Link key={title} to={to} className="block">{card}</Link>
          ) : card;
        })}
      </section>
    </main>
  );
}
