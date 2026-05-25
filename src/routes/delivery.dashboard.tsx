import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Home, LogOut, Package, CheckCircle2, Wallet, Banknote, Navigation } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/delivery/dashboard")({
  component: DeliveryDashboard,
  head: () => ({ meta: [{ title: "My Dashboard — Delivery Partner" }] }),
});

function DeliveryDashboard() {
  const { user, roles, loading, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/staff/login" }); return; }
    if (isAdmin) { navigate({ to: "/landing" }); return; }
    if (!roles.includes("delivery")) { navigate({ to: "/staff/pending" }); }
  }, [loading, user, isAdmin, roles, navigate]);

  const { data: staff, isLoading: staffLoading } = useQuery({
    enabled: !!user,
    queryKey: ["my-staff", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_staff").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const staffId = staff?.id;

  const { data: panchayaths = [] } = useQuery({
    enabled: !!staffId,
    queryKey: ["my-panchayaths", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_staff_panchayaths")
        .select("panchayath_id, panchayaths(name)")
        .eq("staff_id", staffId!);
      if (error) throw error;
      return (data ?? []) as Array<{ panchayath_id: string; panchayaths: { name: string } | null }>;
    },
  });

  const { data: wards = [] } = useQuery({
    enabled: !!staffId,
    queryKey: ["my-wards", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_staff_wards")
        .select("ward_id, wards(name, ward_number)")
        .eq("staff_id", staffId!);
      if (error) throw error;
      return (data ?? []) as Array<{ ward_id: string; wards: { name: string; ward_number: string | null } | null }>;
    },
  });

  const { data: orders = [] } = useQuery({
    enabled: !!staffId,
    queryKey: ["my-orders", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_orders")
        .select("*")
        .eq("staff_id", staffId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: wallet = [] } = useQuery({
    enabled: !!staffId,
    queryKey: ["my-wallet", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("staff_id", staffId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: submissions = [] } = useQuery({
    enabled: !!staffId,
    queryKey: ["my-submissions", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_submissions")
        .select("*")
        .eq("staff_id", staffId!)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const pending = orders.filter((o: any) => o.status === "pending");
    const delivered = orders.filter((o: any) => o.status === "delivered");
    const collected = delivered
      .filter((o: any) => !o.cash_submission_id)
      .reduce((s: number, o: any) => s + Number(o.amount ?? 0), 0);
    const walletBalance = wallet.reduce((s: number, t: any) => {
      const amt = Number(t.amount ?? 0);
      return s + (t.type === "debit" ? -amt : amt);
    }, 0);
    const submitted = submissions.reduce((s: number, x: any) => s + Number(x.amount ?? 0), 0);
    return {
      pendingCount: pending.length,
      deliveredCount: delivered.length,
      collected,
      walletBalance,
      submitted,
      pending,
      delivered,
    };
  }, [orders, wallet, submissions]);

  const [locating, setLocating] = useState(false);
  const updateLocation = () => {
    if (!staffId) return;
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { error } = await supabase
          .from("delivery_staff")
          .update({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            location_updated_at: new Date().toISOString(),
          })
          .eq("id", staffId);
        setLocating(false);
        if (error) { toast.error(error.message); return; }
        toast.success("Location updated");
        qc.invalidateQueries({ queryKey: ["my-staff", user?.id] });
      },
      (err) => { setLocating(false); toast.error(err.message); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const markDelivered = async (orderId: string) => {
    const { error } = await supabase
      .from("delivery_orders")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked delivered");
    qc.invalidateQueries({ queryKey: ["my-orders", staffId] });
  };

  if (loading || staffLoading) {
    return <main className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</main>;
  }

  if (!staff) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold">No delivery profile found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Your account ({user?.email ?? user?.phone}) has the delivery role but is not linked to a delivery_staff record yet.
          Please ask an admin to create your staff profile, or sign up again via the staff signup form.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={async () => { await signOut(); navigate({ to: "/staff/login" }); }}>
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
          <Button onClick={() => navigate({ to: "/staff/signup" })}>Go to signup</Button>
        </div>
      </main>
    );
  }

  const mapsUrl = staff.latitude && staff.longitude
    ? `https://www.google.com/maps?q=${staff.latitude},${staff.longitude}`
    : null;

  return (
    <main className="min-h-screen bg-muted/30 pb-12">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">Hi, {staff.full_name}</h1>
            <p className="text-xs text-muted-foreground">Delivery Partner Dashboard</p>
          </div>
          <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/staff/login" }); }}>
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 pt-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<Package className="h-5 w-5" />} label="Pending orders" value={stats.pendingCount} />
          <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Delivered orders" value={stats.deliveredCount} />
          <StatCard icon={<Banknote className="h-5 w-5" />} label="Collected cash" value={`₹${stats.collected.toFixed(2)}`} />
          <StatCard icon={<Wallet className="h-5 w-5" />} label="Wallet balance" value={`₹${stats.walletBalance.toFixed(2)}`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile */}
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle>My Profile</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row icon={<Phone className="h-4 w-4" />} label="Phone" value={staff.phone} />
              {staff.alt_phone && <Row icon={<Phone className="h-4 w-4" />} label="Alt" value={staff.alt_phone} />}
              {staff.address && <Row icon={<Home className="h-4 w-4" />} label="Address" value={staff.address} />}
              <div>
                <p className="text-muted-foreground">Panchayath</p>
                <p className="font-medium">{panchayaths.map(p => p.panchayaths?.name).filter(Boolean).join(", ") || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Wards</p>
                <p className="font-medium">{wards.map(w => w.wards?.ward_number ?? w.wards?.name).filter(Boolean).join(", ") || "—"}</p>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" />Location</div>
                  <Button size="sm" variant="outline" onClick={updateLocation} disabled={locating}>
                    <Navigation className="mr-1 h-3 w-3" />{locating ? "…" : "Update"}
                  </Button>
                </div>
                {staff.latitude && staff.longitude ? (
                  <>
                    <p className="text-xs text-muted-foreground">{staff.latitude.toFixed(5)}, {staff.longitude.toFixed(5)}</p>
                    <a href={mapsUrl!} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={`https://staticmap.openstreetmap.de/staticmap.php?center=${staff.latitude},${staff.longitude}&zoom=15&size=400x180&markers=${staff.latitude},${staff.longitude},red-pushpin`}
                        alt="My location"
                        className="w-full rounded border"
                      />
                    </a>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Not set. Tap Update to share GPS.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending orders */}
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Pending Orders ({stats.pending.length})</CardTitle></CardHeader>
            <CardContent>
              {stats.pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending orders.</p>
              ) : (
                <div className="space-y-2">
                  {stats.pending.map((o: any) => (
                    <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">#{o.order_number} — {o.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{o.customer_phone} · {o.address}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">₹{Number(o.amount).toFixed(2)}</span>
                        <Button size="sm" onClick={() => markDelivered(o.id)}>Mark delivered</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Submitted cash */}
          <Card>
            <CardHeader>
              <CardTitle>Submitted Cash</CardTitle>
              <p className="text-sm text-muted-foreground">Total: ₹{stats.submitted.toFixed(2)}</p>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No submissions yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {submissions.slice(0, 5).map((s: any) => (
                    <li key={s.id} className="flex items-center justify-between rounded-md border p-2">
                      <div>
                        <p className="font-medium">₹{Number(s.amount).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{new Date(s.submitted_at).toLocaleString()}</p>
                      </div>
                      <Badge variant={s.verified_at ? "default" : "secondary"}>
                        {s.verified_at ? "Verified" : "Pending"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent delivered */}
          <Card>
            <CardHeader><CardTitle>Recent Deliveries</CardTitle></CardHeader>
            <CardContent>
              {stats.delivered.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deliveries yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {stats.delivered.slice(0, 10).map((o: any) => (
                    <li key={o.id} className="flex items-center justify-between rounded-md border p-2">
                      <div className="min-w-0">
                        <p className="font-medium">#{o.order_number} — {o.customer_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.delivered_at ? new Date(o.delivered_at).toLocaleString() : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">₹{Number(o.amount).toFixed(2)}</span>
                        <Badge variant={o.cash_submission_id ? "default" : "secondary"}>
                          {o.cash_submission_id ? "Submitted" : "Held"}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="rounded-md bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium break-words">{value}</p>
      </div>
    </div>
  );
}
