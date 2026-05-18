import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { MapPin, Locate, Save, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleMaps } from "./useGoogleMaps";
import { FallbackPicker } from "./FallbackPicker";
import { loadCachedPoints, saveCachedPoints, upsertCachedPoint, type GeoPoint } from "@/lib/geoCache";

type Kind = "panchayath" | "ward";

type Props = {
  kind: Kind;
  apiKey: string | null;
  /** Parent picker: list of {id,name}, current selection, on change */
  parents: { id: string; name: string }[];
  parentId: string | null;
  onParentChange: (id: string) => void;
  parentLabel: string;
};

const DEFAULT_CENTER = { lat: 10.85, lng: 76.27 }; // Kerala fallback
const DEFAULT_ZOOM = 8;

export function MapPicker({ kind, apiKey, parents, parentId, onParentChange, parentLabel }: Props) {
  const qc = useQueryClient();
  const mapState = useGoogleMaps(apiKey);

  const table = kind === "panchayath" ? "panchayaths" : "wards";
  const parentField = kind === "panchayath" ? "district_id" : "panchayath_id";

  // Cache-first read of all locations of this kind (for offline + instant render)
  const [cached, setCached] = useState<GeoPoint[]>([]);
  useEffect(() => {
    loadCachedPoints(kind).then(setCached);
  }, [kind]);

  // Fresh fetch from DB, filtered by parent
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

  // Mirror fresh rows into the offline cache
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

  // ===== Map setup =====
  const mapRef = useRef<HTMLDivElement | null>(null);
  const gMapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const draftRef = useRef<any>(null); // unsaved draggable marker
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [filter, setFilter] = useState("");

  // Init Google Map once
  useEffect(() => {
    if (mapState !== "ready" || !mapRef.current || gMapRef.current) return;
    const g = (window as any).google;
    const first = visible.find((p) => p.lat != null && p.lng != null);
    gMapRef.current = new g.maps.Map(mapRef.current, {
      center: first?.lat != null ? { lat: first.lat!, lng: first.lng! } : DEFAULT_CENTER,
      zoom: first?.lat != null ? 13 : DEFAULT_ZOOM,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    gMapRef.current.addListener("click", (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setDraft({ lat, lng });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapState]);

  // Render markers for visible points
  useEffect(() => {
    if (mapState !== "ready" || !gMapRef.current) return;
    const g = (window as any).google;
    // Remove old
    for (const [, m] of markersRef.current) m.setMap(null);
    markersRef.current.clear();
    for (const p of visible) {
      if (p.lat == null || p.lng == null) continue;
      const m = new g.maps.Marker({
        map: gMapRef.current,
        position: { lat: p.lat, lng: p.lng },
        title: p.name,
        label: p.ward_number ? String(p.ward_number) : undefined,
      });
      m.addListener("click", () => setSelectedId(p.id));
      markersRef.current.set(p.id, m);
    }
  }, [visible, mapState]);

  // Draft marker
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
        position: { lat: draft.lat, lng: draft.lng },
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

  // Center map on selection
  useEffect(() => {
    if (!selectedId || !gMapRef.current) return;
    const p = visible.find((x) => x.id === selectedId);
    if (p?.lat != null && p?.lng != null) {
      gMapRef.current.panTo({ lat: p.lat, lng: p.lng });
      if (gMapRef.current.getZoom() < 14) gMapRef.current.setZoom(15);
    }
  }, [selectedId, visible]);

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
    },
    onError: (e: any) => toast.error(e.message),
  });

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    if (!selectedId) return toast.error(`Select a ${kind} first`);
    toast.loading("Locating…", { id: "geo" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss("geo");
        setDraft({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        gMapRef.current?.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        gMapRef.current?.setZoom(16);
      },
      (err) => {
        toast.dismiss("geo");
        toast.error(err.message || "Could not get location");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const filtered = useMemo(
    () =>
      visible.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase())),
    [visible, filter],
  );

  if (!apiKey) {
    return (
      <FallbackPicker
        kind={kind}
        parents={parents}
        parentId={parentId}
        onParentChange={onParentChange}
        parentLabel={parentLabel}
        reason="Google Maps API key is not configured. Ask an admin to set it in Settings, or use the GPS fallback below."
      />
    );
  }

  if (mapState === "error") {
    return (
      <FallbackPicker
        kind={kind}
        parents={parents}
        parentId={parentId}
        onParentChange={onParentChange}
        parentLabel={parentLabel}
        reason="Google Maps failed to load (invalid key, API disabled, or network blocked). Falling back to browser GPS."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="lg:max-h-[calc(100vh-180px)] lg:overflow-hidden">
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
          <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
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
                        ? active
                          ? "bg-primary-foreground/20"
                          : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
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
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <CardContent className="p-0">
          {mapState === "loading" && (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">Loading map…</div>
          )}
          <div ref={mapRef} className="h-[60vh] w-full" style={{ display: mapState === "ready" ? "block" : "none" }} />

          {mapState === "ready" && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
              <div className="pointer-events-auto flex items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur">
                {selectedId ? (
                  <>
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">{visible.find((p) => p.id === selectedId)?.name}</span>
                    <span className="text-muted-foreground">
                      {draft
                        ? `· draft ${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`
                        : "· click map or use my location"}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Pick a {kind} from the list to mark its location</span>
                )}
              </div>
            </div>
          )}

          {mapState === "ready" && selectedId && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              <Button size="sm" variant="secondary" onClick={useMyLocation}>
                <Locate className="h-3.5 w-3.5" /> Use my location
              </Button>
              {draft && (
                <>
                  <Button size="sm" onClick={() => saveLocation.mutate()} disabled={saveLocation.isPending}>
                    <Save className="h-3.5 w-3.5" /> Save location
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
