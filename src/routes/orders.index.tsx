import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Package, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/orders/")({
  component: OrdersPage,
  head: () => ({ meta: [{ title: "Orders — External Tracking Sites" }] }),
});

type Site = {
  id: string;
  name: string;
  website_url: string;
  description: string | null;
};

function OrdersPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/landing" });
  }, [loading, isAdmin, navigate]);

  const { data: sites, isLoading } = useQuery({
    queryKey: ["external_tracking_sites", "list"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_tracking_sites")
        .select("id,name,website_url,description")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Site[];
    },
  });

  if (!isAdmin) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/landing"><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" /> Orders — External Tracking Sites
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            External services configured for order tracking and delivery support.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/settings">Manage in Settings</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !sites?.length ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No external sites configured yet. Add one in{" "}
            <Link to="/admin/settings" className="text-primary hover:underline">Admin Settings</Link>.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((s) => (
            <Card key={s.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">{s.name}</CardTitle>
                {s.description && <CardDescription>{s.description}</CardDescription>}
              </CardHeader>
              <CardContent className="mt-auto">
                <a
                  href={s.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Open site <ExternalLink className="h-3 w-3" />
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
