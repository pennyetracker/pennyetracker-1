import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleMaps } from "@/components/map/useGoogleMaps";
import { loadCachedPoints, saveCachedPoints, type GeoPoint } from "@/lib/geoCache";

export const Route = createFileRoute("/map/panchayath")({
  component: PublicPanchayathMap,
  head: () => ({
    meta: [
      { title: "Panchayath Map — Penny-eTracker" },
      { name: "description", content: "Locations of all mapped panchayaths." },
    ],
  }),
});

const DEFAULT_CENTER = { lat: 10.85, lng: 76.27 };
const DEFAULT_ZOOM = 8;

function PublicPanchayathMap() {
  const { data: apiKey } = useQuery({
    queryKey: ["public_google_maps_key"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_google_maps_key");
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    staleTime: 5 * 60_000,
  });

  const mapState = useGoogleMaps(apiKey ?? null);

  const [cached, setCached] = useState<GeoPoint[]>([]);
  useEffect(() => {
    loadCachedPoints("panchayath").then((all) =>
      setCached(all.filter((p) => p.lat != null && p.lng != null)),
    );
  }, []);

  const { data: items = [] } = useQuery({
    queryKey: ["panchayaths", "public-marked"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("panchayaths")
        .select("id, name, district_id, latitude, longitude")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Mirror to cache
  useEffect(() => {
    if (!items.length) return;
    const points: GeoPoint[] = items.map((r: any) => ({
      id: r.id,
      name: r.name,
      parent_id: r.district_id ?? null,
      lat: r.latitude,
      lng: r.longitude,
    }));
    saveCachedPoints("panchayath", points);
    setCached(points);
  }, [items]);

  const visible: GeoPoint[] = items.length
    ? items.map((r: any) => ({
        id: r.id,
        name: r.name,
        parent_id: r.district_id ?? null,
        lat: r.latitude,
        lng: r.longitude,
      }))
    : cached;

  const mapRef = useRef<HTMLDivElement | null>(null);
  const gMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (mapState !== "ready" || !mapRef.current || gMapRef.current) return;
    const g = (window as any).google;
    gMapRef.current = new g.maps.Map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      mapTypeControl: false,
      streetViewControl: false,
    });
  }, [mapState]);

  useEffect(() => {
    if (mapState !== "ready" || !gMapRef.current) return;
    const g = (window as any).google;
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];
    const bounds = new g.maps.LatLngBounds();
    let count = 0;
    for (const p of visible) {
      if (p.lat == null || p.lng == null) continue;
      const info = new g.maps.InfoWindow({ content: `<div style="font:500 13px system-ui">${p.name}</div>` });
      const m = new g.maps.Marker({
        map: gMapRef.current,
        position: { lat: p.lat, lng: p.lng },
        title: p.name,
      });
      m.addListener("click", () => info.open({ map: gMapRef.current, anchor: m }));
      markersRef.current.push(m);
      bounds.extend({ lat: p.lat, lng: p.lng });
      count++;
    }
    if (count === 1) {
      gMapRef.current.setCenter(bounds.getCenter());
      gMapRef.current.setZoom(13);
    } else if (count > 1) {
      gMapRef.current.fitBounds(bounds, 48);
    }
  }, [visible, mapState]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/landing"><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Panchayath Map</h1>
          <span className="ml-auto text-sm text-muted-foreground">
            {visible.length} marked
          </span>
        </div>

        {!apiKey || mapState === "error" ? (
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                {!apiKey
                  ? "Map provider unavailable. Showing marked locations as a list with map links."
                  : "Google Maps failed to load. Showing marked locations as a list with map links."}
              </div>
              {visible.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No panchayath locations have been marked yet.
                </div>
              ) : (
                <ul className="divide-y">
                  {visible.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div>
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.lat?.toFixed(6)}, {p.lng?.toFixed(6)}
                        </div>
                      </div>
                      <div className="flex gap-3 text-xs">
                        <a className="text-primary hover:underline" target="_blank" rel="noreferrer"
                          href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}>Google Maps</a>
                        <a className="text-primary hover:underline" target="_blank" rel="noreferrer"
                          href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=15/${p.lat}/${p.lng}`}>OpenStreetMap</a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="relative overflow-hidden">
            <CardContent className="p-0">
              {mapState === "loading" && (
                <div className="flex h-[70vh] items-center justify-center text-sm text-muted-foreground">
                  Loading map…
                </div>
              )}
              <div
                ref={mapRef}
                className="h-[70vh] w-full"
                style={{ display: mapState === "ready" ? "block" : "none" }}
              />
              {mapState === "ready" && visible.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-lg border bg-background/95 px-4 py-2 text-sm text-muted-foreground shadow">
                    No panchayath locations have been marked yet.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}