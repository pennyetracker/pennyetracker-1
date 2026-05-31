import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Package, Plus, Trash2, Save, Locate, X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleMapsKey } from "@/hooks/use-google-maps-key";
import { useGoogleMaps } from "@/components/map/useGoogleMaps";
import { LeafletMap, type LeafletMarker } from "@/components/map/LeafletMap";

export const Route = createFileRoute("/update-location/pickup-point")({
  component: UpdatePickupPointLocation,
  head: () => ({ meta: [{ title: "Update Pickup Points — Penny-eTracker" }] }),
});

type PickupPoint = {
  id: string;
  panchayath_id: string;
  name: string;
  custodian: string | null;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
};

function UpdatePickupPointLocation() {
  const apiKey = useGoogleMapsKey();
  const mapState = useGoogleMaps(apiKey);
  const qc = useQueryClient();

  const [districtId, setDistrictId] = useState<string | null>(null);
  const [panchayathId, setPanchayathId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [form, setForm] = useState({ name: "", custodian: "", address: "", phone: "" });

  const { data: districts = [] } = useQuery({
    queryKey: ["districts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("districts").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: panchayaths = [] } = useQuery({
    queryKey: ["panchayaths-by-district", districtId],
    enabled: !!districtId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("panchayaths")
        .select("id, name")
        .eq("district_id", districtId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: points = [] } = useQuery({
    queryKey: ["pickup-points", panchayathId],
    enabled: !!panchayathId,
    queryFn: async (): Promise<PickupPoint[]> => {
      const { data, error } = await (supabase as any)
        .from("pickup_points")
        .select("id, panchayath_id, name, address, phone, latitude, longitude")
        .eq("panchayath_id", panchayathId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PickupPoint[];
    },
  });

  const selected = points.find((p) => p.id === selectedId) ?? null;

  // load form when selection changes
  useEffect(() => {
    if (selected) {
      setForm({ name: selected.name, custodian: selected.custodian ?? "", address: selected.address ?? "", phone: selected.phone ?? "" });
      setDraft(null);
    } else {
      setForm({ name: "", custodian: "", address: "", phone: "" });
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Google Map =====
  const mapRef = useRef<HTMLDivElement | null>(null);
  const gMapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const draftRef = useRef<any>(null);

  useEffect(() => {
    if (mapState !== "ready" || !mapRef.current || gMapRef.current) return;
    const g = (window as any).google;
    gMapRef.current = new g.maps.Map(mapRef.current, {
      center: { lat: 10.85, lng: 76.27 },
      zoom: 8,
      mapTypeControl: false,
      streetViewControl: false,
    });
    gMapRef.current.addListener("click", (e: any) => {
      setDraft({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    });
  }, [mapState]);

  useEffect(() => {
    if (mapState !== "ready" || !gMapRef.current) return;
    const g = (window as any).google;
    for (const [, m] of markersRef.current) m.setMap(null);
    markersRef.current.clear();
    for (const p of points) {
      if (p.latitude == null || p.longitude == null) continue;
      const m = new g.maps.Marker({
        map: gMapRef.current,
        position: { lat: p.latitude, lng: p.longitude },
        title: p.name,
      });
      m.addListener("click", () => setSelectedId(p.id));
      markersRef.current.set(p.id, m);
    }
  }, [points, mapState]);

  useEffect(() => {
    if (mapState !== "ready" || !gMapRef.current) return;
    const g = (window as any).google;
    if (draftRef.current) {
      draftRef.current.setMap(null);
      draftRef.current = null;
    }
    if (draft) {
      draftRef.current = new g.maps.Marker({
        map: gMapRef.current,
        position: draft,
        draggable: true,
        animation: g.maps.Animation.DROP,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#22c55e",
          fillOpacity: 0.9,
          strokeColor: "#15803d",
          strokeWeight: 2,
        },
      });
      draftRef.current.addListener("dragend", (e: any) => {
        setDraft({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });
    }
  }, [draft, mapState]);

  useEffect(() => {
    if (!selected?.latitude || !selected?.longitude || !gMapRef.current) return;
    gMapRef.current.panTo({ lat: selected.latitude, lng: selected.longitude });
    if (gMapRef.current.getZoom() < 14) gMapRef.current.setZoom(15);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const useLeaflet = !apiKey || mapState === "error";
  const leafletMarkers: LeafletMarker[] = useLeaflet
    ? points
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p) => ({ id: p.id, name: p.name, lat: p.latitude!, lng: p.longitude!, label: null }))
    : [];

  // ===== Mutations =====
  const createPoint = useMutation({
    mutationFn: async () => {
      if (!panchayathId) throw new Error("Select a panchayath first");
      if (!form.name.trim()) throw new Error("Name is required");
      const { error } = await (supabase as any).from("pickup_points").insert({
        panchayath_id: panchayathId,
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pickup-points", panchayathId] });
      toast.success("Pickup point added");
      setForm({ name: "", address: "", phone: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePoint = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Select a pickup point");
      const patch: any = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
      };
      if (draft) {
        patch.latitude = draft.lat;
        patch.longitude = draft.lng;
        patch.location_updated_at = new Date().toISOString();
      }
      const { error } = await (supabase as any)
        .from("pickup_points")
        .update(patch)
        .eq("id", selectedId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pickup-points", panchayathId] });
      toast.success("Saved");
      setDraft(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePoint = useMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      const { error } = await (supabase as any).from("pickup_points").delete().eq("id", selectedId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pickup-points", panchayathId] });
      toast.success("Deleted");
      setSelectedId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    toast.loading("Locating…", { id: "geo" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss("geo");
        const d = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDraft(d);
        gMapRef.current?.panTo(d);
        gMapRef.current?.setZoom(16);
      },
      (err) => {
        toast.dismiss("geo");
        toast.error(err.message || "Could not get location");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/update-location">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Package className="h-5 w-5" /> Update Pickup Points
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto">
          <CardContent className="space-y-3 p-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">District</label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={districtId ?? ""}
                onChange={(e) => {
                  setDistrictId(e.target.value || null);
                  setPanchayathId(null);
                  setSelectedId(null);
                }}
              >
                <option value="">Select…</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Panchayath</label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={panchayathId ?? ""}
                onChange={(e) => {
                  setPanchayathId(e.target.value || null);
                  setSelectedId(null);
                }}
                disabled={!districtId}
              >
                <option value="">Select…</option>
                {panchayaths.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {panchayathId && (
              <>
                <div className="border-t pt-3">
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Pickup points</label>
                    <button
                      onClick={() => setSelectedId(null)}
                      className="text-xs text-primary hover:underline"
                    >
                      + New
                    </button>
                  </div>
                  <div className="max-h-[30vh] space-y-1 overflow-y-auto pr-1">
                    {points.length === 0 && (
                      <p className="text-xs text-muted-foreground">No pickup points yet.</p>
                    )}
                    {points.map((p) => {
                      const marked = p.latitude != null && p.longitude != null;
                      const active = selectedId === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSelectedId(p.id)}
                          className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                            active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                          }`}
                        >
                          <span className="truncate">{p.name}</span>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${
                              marked
                                ? active
                                  ? "bg-primary-foreground/20"
                                  : "bg-green-100 text-green-700"
                                : active
                                  ? "bg-primary-foreground/20"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {marked ? "marked" : "—"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {selectedId ? "Edit pickup point" : "Add pickup point"}
                  </p>
                  <Input
                    placeholder="Name *"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                  <Input
                    placeholder="Phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                  <Textarea
                    placeholder="Address"
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                  <div className="flex gap-2">
                    {selectedId ? (
                      <>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => updatePoint.mutate()}
                          disabled={updatePoint.isPending}
                        >
                          <Save className="h-3.5 w-3.5" /> Save
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm("Delete this pickup point?")) deletePoint.mutate();
                          }}
                          disabled={deletePoint.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => createPoint.mutate()}
                        disabled={createPoint.isPending}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-0">
            {useLeaflet ? (
              <LeafletMap
                height="60vh"
                markers={leafletMarkers}
                draft={draft}
                onPick={(lat, lng) => setDraft({ lat, lng })}
                onDraftDrag={(lat, lng) => setDraft({ lat, lng })}
                focus={
                  draft
                    ? draft
                    : selected?.latitude != null && selected?.longitude != null
                      ? { lat: selected.latitude, lng: selected.longitude }
                      : null
                }
              />
            ) : (
              <>
                {mapState === "loading" && (
                  <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
                    Loading map…
                  </div>
                )}
                <div
                  ref={mapRef}
                  className="h-[60vh] w-full"
                  style={{ display: mapState === "ready" ? "block" : "none" }}
                />
              </>
            )}

            {(useLeaflet || mapState === "ready") && (
              <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
                <div className="pointer-events-auto flex items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  {selected ? (
                    <>
                      <span className="font-medium">{selected.name}</span>
                      <span className="text-muted-foreground">
                        {draft
                          ? `· draft ${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`
                          : "· click map or use my location to update"}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {panchayathId ? "Click map to pin a location for a new point" : "Select a panchayath first"}
                    </span>
                  )}
                </div>
              </div>
            )}

            {(useLeaflet || mapState === "ready") && panchayathId && (
              <div className="absolute bottom-3 left-1/2 z-[500] flex -translate-x-1/2 gap-2">
                <Button size="sm" variant="secondary" onClick={useMyLocation}>
                  <Locate className="h-3.5 w-3.5" /> Use my location
                </Button>
                {draft && (
                  <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
                    <X className="h-3.5 w-3.5" /> Cancel pin
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
