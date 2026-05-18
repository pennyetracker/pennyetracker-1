import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Locate, MapPin, Save, Search, X, ExternalLink, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadCachedPoints, saveCachedPoints, upsertCachedPoint, type GeoPoint } from "@/lib/geoCache";

type Kind = "panchayath" | "ward";

type Props = {
  kind: Kind;
  parents: { id: string; name: string }[];
  parentId: string | null;
  onParentChange: (id: string) => void;
  parentLabel: string;
  /** reason shown in the banner */
  reason?: string;
};

export function FallbackPicker({ kind, parents, parentId, onParentChange, parentLabel, reason }: Props) {
  const qc = useQueryClient();
  const table = kind === "panchayath" ? "panchayaths" : "wards";
  const parentField = kind === "panchayath" ? "district_id" : "panchayath_id";

  const [cached, setCached] = useState<GeoPoint[]>([]);
  useEffect(() => {
    loadCachedPoints(kind).then(setCached);
  }, [kind]);

  const { data: items = [] } = useQuery({
    queryKey: [table, "geo", parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const q = supabase
        .from(table as any)
        .select(`id, name, ${parentField}, latitude, longitude${kind === "ward" ? ", ward_number" : ""}`)
        .eq(parentField, parentId!)
        .order(kind === "ward" ? "ward_number" : "name");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const visible: GeoPoint[] = items.length
    ? items.map((r: any) => ({
        id: r.id,
        name: r.name,
        parent_id: r[parentField] ?? null,
        lat: r.latitude,
        lng: r.longitude,
        ward_number: r.ward_number ?? null,
      }))
    : cached.filter((p) => p.parent_id === parentId);

  useEffect(() => {
    if (!items.length) return;
    (async () => {
      const all = await loadCachedPoints(kind);
      const map = new Map(all.map((p) => [p.id, p]));
      for (const r of items) {
        map.set(r.id, {
          id: r.id,
          name: r.name,
          parent_id: r[parentField] ?? null,
          lat: r.latitude,
          lng: r.longitude,
          ward_number: r.ward_number ?? null,
        });
      }
      const merged = Array.from(map.values());
      await saveCachedPoints(kind, merged);
      setCached(merged);
    })();
  }, [items, kind, parentField]);

  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");

  const filtered = useMemo(
    () => visible.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase())),
    [visible, filter],
  );

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported in this browser");
    if (!selectedId) return toast.error(`Select a ${kind} first`);
    toast.loading("Locating…", { id: "geo" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss("geo");
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDraft({ lat, lng });
        setLatInput(lat.toFixed(6));
        setLngInput(lng.toFixed(6));
        toast.success(`Got location (±${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        toast.dismiss("geo");
        toast.error(err.message || "Could not get location");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  const applyManual = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isFinite(lat) || lat < -90 || lat > 90) return toast.error("Latitude must be -90..90");
    if (!isFinite(lng) || lng < -180 || lng > 180) return toast.error("Longitude must be -180..180");
    setDraft({ lat, lng });
  };

  const saveLocation = useMutation({
    mutationFn: async () => {
      if (!selectedId || !draft) throw new Error("Pick an item and a location first");
      const { error } = await supabase
        .from(table as any)
        .update({
          latitude: draft.lat,
          longitude: draft.lng,
          location_updated_at: new Date().toISOString(),
        } as any)
        .eq("id", selectedId);
      if (error) throw error;
      const selected = visible.find((x) => x.id === selectedId)!;
      await upsertCachedPoint(kind, { ...selected, lat: draft.lat, lng: draft.lng });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table, "geo", parentId] });
      toast.success("Location saved");
      setDraft(null);
      setLatInput("");
      setLngInput("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selected = selectedId ? visible.find((p) => p.id === selectedId) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="font-medium">Map provider unavailable — using browser GPS fallback</div>
          <div className="text-xs opacity-80">
            {reason || "Google Maps could not be loaded. You can still mark locations using your device GPS or by entering coordinates."}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="lg:max-h-[calc(100vh-220px)] lg:overflow-hidden">
          <CardContent className="space-y-3 p-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">{parentLabel}</label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={parentId ?? ""}
                onChange={(e) => onParentChange(e.target.value)}
              >
                <option value="">Select…</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-7" placeholder="Search…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
            <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
              {!parentId && <p className="text-xs text-muted-foreground">Select a {parentLabel.toLowerCase()} to begin.</p>}
              {parentId && filtered.length === 0 && (
                <p className="text-xs text-muted-foreground">No {kind}s in this {parentLabel.toLowerCase()}.</p>
              )}
              {filtered.map((p) => {
                const marked = p.lat != null && p.lng != null;
                const active = selectedId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}
                  >
                    <span className="truncate">
                      {p.name}
                      {p.ward_number ? <span className="ml-1 opacity-70">#{p.ward_number}</span> : null}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${
                        marked
                          ? active ? "bg-primary-foreground/20" : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                          : active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {marked ? "marked" : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
            {!selected ? (
              <div className="flex h-[50vh] items-center justify-center text-center text-sm text-muted-foreground">
                <div>
                  <MapPin className="mx-auto h-8 w-8 opacity-50" />
                  <p className="mt-2">Pick a {kind} from the list to mark its location.</p>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Selected</div>
                  <div className="text-lg font-semibold">{selected.name}</div>
                  {selected.lat != null && selected.lng != null ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Current: {selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}</span>
                      <a
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`}
                        target="_blank" rel="noreferrer"
                      >
                        Google Maps <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        href={`https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lng}#map=16/${selected.lat}/${selected.lng}`}
                        target="_blank" rel="noreferrer"
                      >
                        OpenStreetMap <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-muted-foreground">Not yet marked.</div>
                  )}
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <div className="text-sm font-medium">Capture coordinates</div>
                  <Button size="sm" variant="secondary" onClick={useMyLocation}>
                    <Locate className="h-3.5 w-3.5" /> Use my device GPS
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Latitude</label>
                      <Input
                        inputMode="decimal"
                        placeholder="10.850000"
                        value={latInput}
                        onChange={(e) => setLatInput(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Longitude</label>
                      <Input
                        inputMode="decimal"
                        placeholder="76.270000"
                        value={lngInput}
                        onChange={(e) => setLngInput(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={applyManual}>
                    Apply coordinates
                  </Button>
                </div>

                {draft && (
                  <div className="rounded-md border bg-accent/30 p-3 text-sm">
                    <div className="font-medium">Draft location</div>
                    <div className="text-xs text-muted-foreground">
                      {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)}
                      {" · "}
                      <a
                        className="text-primary hover:underline"
                        href={`https://www.openstreetmap.org/?mlat=${draft.lat}&mlon=${draft.lng}#map=17/${draft.lat}/${draft.lng}`}
                        target="_blank" rel="noreferrer"
                      >
                        preview on OSM
                      </a>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => saveLocation.mutate()} disabled={saveLocation.isPending}>
                        <Save className="h-3.5 w-3.5" /> Save location
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
                        <X className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
