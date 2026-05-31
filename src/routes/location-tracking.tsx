import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Navigation, Route as RouteIcon, Search, Locate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleMaps } from "@/components/map/useGoogleMaps";
import { useGoogleMapsKey } from "@/hooks/use-google-maps-key";

export const Route = createFileRoute("/location-tracking")({
  component: LocationTracking,
  head: () => ({ meta: [{ title: "Location Tracking — Penny-eTracker" }] }),
});

const DEFAULT_CENTER = { lat: 10.85, lng: 76.27 };

type AreaPoint = { id: string; name: string; lat: number; lng: number; subtitle?: string | null };

/** Fetches pickup points and active delivery staff that have a pinned location. */
function useAreaOverlays() {
  const pickups = useQuery({
    queryKey: ["overlay", "pickup_points"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickup_points")
        .select("id, name, address, latitude, longitude")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        id: p.id, name: p.name, lat: p.latitude, lng: p.longitude, subtitle: p.address,
      })) as AreaPoint[];
    },
    staleTime: 60_000,
  });
  const staff = useQuery({
    queryKey: ["overlay", "delivery_staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_staff")
        .select("id, full_name, phone, latitude, longitude, status")
        .eq("status", "active")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        id: s.id, name: s.full_name, lat: s.latitude, lng: s.longitude, subtitle: s.phone,
      })) as AreaPoint[];
    },
    staleTime: 60_000,
  });
  return { pickups: pickups.data ?? [], staff: staff.data ?? [] };
}

/** Renders pickup-point and delivery-staff markers on the supplied Google map.
 *  Optional bounds filter restricts what's shown (used by Manual Route to
 *  show only points "between" A and B). */
function useOverlayMarkers(
  mapRef: React.MutableRefObject<any>,
  ready: boolean,
  bounds?: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } } | null,
) {
  const { pickups, staff } = useAreaOverlays();
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = (window as any).google;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const inBounds = (p: AreaPoint) => {
      if (!bounds) return true;
      return p.lat >= bounds.sw.lat && p.lat <= bounds.ne.lat
        && p.lng >= bounds.sw.lng && p.lng <= bounds.ne.lng;
    };

    const mkIcon = (fill: string, stroke: string) => ({
      path: g.maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: fill,
      fillOpacity: 0.95,
      strokeColor: stroke,
      strokeWeight: 2,
    });

    const info = new g.maps.InfoWindow();
    const add = (p: AreaPoint, kind: "pickup" | "staff") => {
      const m = new g.maps.Marker({
        map: mapRef.current,
        position: { lat: p.lat, lng: p.lng },
        title: p.name,
        icon: kind === "pickup"
          ? mkIcon("#f59e0b", "#92400e")
          : mkIcon("#10b981", "#065f46"),
        zIndex: kind === "pickup" ? 50 : 60,
      });
      m.addListener("click", () => {
        info.setContent(
          `<div style="font:500 13px system-ui">${kind === "pickup" ? "📦 Pickup" : "🛵 Delivery"} · ${p.name}</div>` +
          (p.subtitle ? `<div style="font:400 11px system-ui;color:#666;margin-top:2px">${p.subtitle}</div>` : ""),
        );
        info.open({ anchor: m, map: mapRef.current });
      });
      markersRef.current.push(m);
    };

    pickups.filter(inBounds).forEach((p) => add(p, "pickup"));
    staff.filter(inBounds).forEach((p) => add(p, "staff"));
  }, [ready, pickups, staff, bounds, mapRef]);
}

function OverlayLegend({ pickupCount, staffCount }: { pickupCount: number; staffCount: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#f59e0b", boxShadow: "0 0 0 2px #92400e inset" }} />
        Pickup points ({pickupCount})
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#10b981", boxShadow: "0 0 0 2px #065f46 inset" }} />
        Delivery staff ({staffCount})
      </span>
    </div>
  );
}

function LocationTracking() {
  const apiKey = useGoogleMapsKey();
  const mapState = useGoogleMaps(apiKey);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[oklch(0.98_0.01_240)] via-background to-[oklch(0.95_0.03_250)]">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/landing"><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Location Tracking</h1>
        </div>

        {!apiKey && (
          <Card className="mb-4 border-dashed bg-muted/40">
            <CardContent className="py-3 text-sm text-muted-foreground">
              Google Maps API key not set. Add it in{" "}
              <Link to="/admin/settings" className="underline">Settings</Link>.
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="search">
          <TabsList>
            <TabsTrigger value="search"><Search className="h-3.5 w-3.5" /> Search places</TabsTrigger>
            <TabsTrigger value="navigate"><Navigation className="h-3.5 w-3.5" /> Navigation</TabsTrigger>
            <TabsTrigger value="manual"><RouteIcon className="h-3.5 w-3.5" /> Manual route</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-4">
            <SearchPlaces ready={mapState === "ready"} />
          </TabsContent>
          <TabsContent value="navigate" className="mt-4">
            <NavigatePlaces ready={mapState === "ready"} />
          </TabsContent>
          <TabsContent value="manual" className="mt-4">
            <ManualRoute ready={mapState === "ready"} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

/* ============================== Search Places ============================= */

function SearchPlaces({ ready }: { ready: boolean }) {
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!ready || !mapDiv.current || mapRef.current) return;
    const g = (window as any).google;
    mapRef.current = new g.maps.Map(mapDiv.current, {
      center: DEFAULT_CENTER, zoom: 8, mapTypeControl: false, streetViewControl: false,
    });
  }, [ready]);

  useEffect(() => {
    if (!ready || !inputRef.current) return;
    const g = (window as any).google;
    const ac = new g.maps.places.Autocomplete(inputRef.current, { fields: ["geometry", "name", "formatted_address"] });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place.geometry?.location) {
        toast.error("No location for this place");
        return;
      }
      const pos = place.geometry.location;
      mapRef.current?.panTo(pos);
      mapRef.current?.setZoom(15);
      if (markerRef.current) markerRef.current.setMap(null);
      markerRef.current = new g.maps.Marker({ map: mapRef.current, position: pos, title: place.name });
    });
    return () => g.maps.event.removeListener(listener);
  }, [ready]);

  useOverlayMarkers(mapRef, ready);
  const { pickups, staff } = useAreaOverlays();

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input ref={inputRef} placeholder="Search a place, address, landmark…" className="pl-9" disabled={!ready} />
      </div>
      <OverlayLegend pickupCount={pickups.length} staffCount={staff.length} />
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div ref={mapDiv} className="h-[65vh] w-full" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Loading map…
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ================================ Navigate ================================ */

function NavigatePlaces({ ready }: { ready: boolean }) {
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const fromRef = useRef<HTMLInputElement | null>(null);
  const toRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<any>(null);
  const dirSvcRef = useRef<any>(null);
  const dirRendererRef = useRef<any>(null);
  const fromAcRef = useRef<any>(null);
  const toAcRef = useRef<any>(null);
  const [travelMode, setTravelMode] = useState<"DRIVING" | "WALKING" | "BICYCLING" | "TWO_WHEELER">("DRIVING");
  const [summary, setSummary] = useState<{ distance?: string; duration?: string } | null>(null);

  useEffect(() => {
    if (!ready || !mapDiv.current || mapRef.current) return;
    const g = (window as any).google;
    mapRef.current = new g.maps.Map(mapDiv.current, {
      center: DEFAULT_CENTER, zoom: 8, mapTypeControl: false, streetViewControl: false,
    });
    dirSvcRef.current = new g.maps.DirectionsService();
    dirRendererRef.current = new g.maps.DirectionsRenderer({ map: mapRef.current });
    fromAcRef.current = new g.maps.places.Autocomplete(fromRef.current!, { fields: ["geometry", "formatted_address"] });
    toAcRef.current = new g.maps.places.Autocomplete(toRef.current!, { fields: ["geometry", "formatted_address"] });
  }, [ready]);

  const route = () => {
    const g = (window as any).google;
    const origin = fromAcRef.current?.getPlace()?.geometry?.location ?? fromRef.current?.value;
    const destination = toAcRef.current?.getPlace()?.geometry?.location ?? toRef.current?.value;
    if (!origin || !destination) {
      toast.error("Enter both origin and destination");
      return;
    }
    dirSvcRef.current.route(
      { origin, destination, travelMode: g.maps.TravelMode[travelMode] },
      (res: any, status: string) => {
        if (status !== "OK") {
          toast.error(`Route failed: ${status}`);
          return;
        }
        dirRendererRef.current.setDirections(res);
        const leg = res.routes[0]?.legs[0];
        setSummary({ distance: leg?.distance?.text, duration: leg?.duration?.text });
      },
    );
  };

  const useMyLoc = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (fromRef.current) fromRef.current.value = `${pos.coords.latitude},${pos.coords.longitude}`;
        // Clear autocomplete cached place so origin uses the typed text.
        if (fromAcRef.current?.set) fromAcRef.current.set("place", null);
        toast.success("Using current location as origin");
      },
      (err) => toast.error(err.message),
    );
  };

  useOverlayMarkers(mapRef, ready);
  const { pickups, staff } = useAreaOverlays();

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input ref={fromRef} placeholder="From" className="pl-9" disabled={!ready} />
        </div>
        <div className="relative">
          <Navigation className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input ref={toRef} placeholder="To" className="pl-9" disabled={!ready} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={useMyLoc} disabled={!ready}>
            <Locate className="h-3.5 w-3.5" /> My location
          </Button>
          <Button onClick={route} disabled={!ready}>Get route</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Mode:</span>
        {(["DRIVING", "TWO_WHEELER", "BICYCLING", "WALKING"] as const).map((m) => (
          <Button
            key={m}
            size="sm"
            variant={travelMode === m ? "default" : "outline"}
            className="h-7"
            onClick={() => setTravelMode(m)}
          >
            {m.replace("_", " ").toLowerCase()}
          </Button>
        ))}
        {summary && (
          <span className="ml-auto rounded-md bg-muted px-2 py-1 text-muted-foreground">
            {summary.distance} · {summary.duration}
          </span>
        )}
      </div>
      <OverlayLegend pickupCount={pickups.length} staffCount={staff.length} />
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div ref={mapDiv} className="h-[60vh] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================== Manual Route ============================== */

type GeoRow = { id: string; name: string; lat: number; lng: number; label?: string | null };

function ManualRoute({ ready }: { ready: boolean }) {
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const polyRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [fromPanchayath, setFromPanchayath] = useState<string>("");
  const [toPanchayath, setToPanchayath] = useState<string>("");
  const [fromWard, setFromWard] = useState<string>("");
  const [toWard, setToWard] = useState<string>("");

  const { data: panchayaths = [] } = useQuery({
    queryKey: ["panchayaths", "geo-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("panchayaths")
        .select("id, name, latitude, longitude")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        id: p.id, name: p.name, lat: p.latitude, lng: p.longitude,
      })) as GeoRow[];
    },
  });

  const { data: fromWards = [] } = useQuery({
    queryKey: ["wards", "geo", fromPanchayath],
    enabled: !!fromPanchayath,
    queryFn: () => fetchWards(fromPanchayath),
  });
  const { data: toWards = [] } = useQuery({
    queryKey: ["wards", "geo", toPanchayath],
    enabled: !!toPanchayath,
    queryFn: () => fetchWards(toPanchayath),
  });

  const from = useMemo(() => resolvePoint(panchayaths, fromWards, fromPanchayath, fromWard), [panchayaths, fromWards, fromPanchayath, fromWard]);
  const to = useMemo(() => resolvePoint(panchayaths, toWards, toPanchayath, toWard), [panchayaths, toWards, toPanchayath, toWard]);

  useEffect(() => {
    if (!ready || !mapDiv.current || mapRef.current) return;
    const g = (window as any).google;
    mapRef.current = new g.maps.Map(mapDiv.current, {
      center: DEFAULT_CENTER, zoom: 8, mapTypeControl: false, streetViewControl: false,
    });
  }, [ready]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = (window as any).google;
    // Clear
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (polyRef.current) { polyRef.current.setMap(null); polyRef.current = null; }

    const pts: { lat: number; lng: number }[] = [];
    if (from) pts.push({ lat: from.lat, lng: from.lng });
    if (to) pts.push({ lat: to.lat, lng: to.lng });

    pts.forEach((p, i) => {
      markersRef.current.push(new g.maps.Marker({
        map: mapRef.current, position: p, label: i === 0 ? "A" : "B",
      }));
    });

    if (pts.length === 2) {
      polyRef.current = new g.maps.Polyline({
        path: pts, map: mapRef.current, strokeColor: "#2563eb", strokeWeight: 4, strokeOpacity: 0.85,
      });
      const bounds = new g.maps.LatLngBounds();
      pts.forEach((p) => bounds.extend(p));
      mapRef.current.fitBounds(bounds, 80);
    } else if (pts.length === 1) {
      mapRef.current.panTo(pts[0]);
      mapRef.current.setZoom(13);
    }
  }, [ready, from, to]);

  const distanceKm = useMemo(() => {
    if (!from || !to || !ready) return null;
    const g = (window as any).google;
    if (!g?.maps?.geometry) return null;
    const m = g.maps.geometry.spherical.computeDistanceBetween(
      new g.maps.LatLng(from.lat, from.lng),
      new g.maps.LatLng(to.lat, to.lng),
    );
    return (m / 1000).toFixed(2);
  }, [from, to, ready]);

  // When both endpoints are set, only show overlay points within their bounding
  // box (plus padding) so the user sees only what's "between" A and B.
  const overlayBounds = useMemo(() => {
    if (!from || !to) return null;
    const pad = 0.02;
    return {
      sw: { lat: Math.min(from.lat, to.lat) - pad, lng: Math.min(from.lng, to.lng) - pad },
      ne: { lat: Math.max(from.lat, to.lat) + pad, lng: Math.max(from.lng, to.lng) + pad },
    };
  }, [from, to]);

  useOverlayMarkers(mapRef, ready, overlayBounds);
  const { pickups, staff } = useAreaOverlays();
  const visiblePickups = overlayBounds
    ? pickups.filter((p) => p.lat >= overlayBounds.sw.lat && p.lat <= overlayBounds.ne.lat && p.lng >= overlayBounds.sw.lng && p.lng <= overlayBounds.ne.lng)
    : pickups;
  const visibleStaff = overlayBounds
    ? staff.filter((s) => s.lat >= overlayBounds.sw.lat && s.lat <= overlayBounds.ne.lat && s.lng >= overlayBounds.sw.lng && s.lng <= overlayBounds.ne.lng)
    : staff;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="text-xs font-semibold text-muted-foreground">From</div>
            <PanchayathWardSelect
              panchayaths={panchayaths}
              wards={fromWards}
              panchayathId={fromPanchayath}
              wardId={fromWard}
              onPanchayath={(id) => { setFromPanchayath(id); setFromWard(""); }}
              onWard={setFromWard}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="text-xs font-semibold text-muted-foreground">To</div>
            <PanchayathWardSelect
              panchayaths={panchayaths}
              wards={toWards}
              panchayathId={toPanchayath}
              wardId={toWard}
              onPanchayath={(id) => { setToPanchayath(id); setToWard(""); }}
              onWard={setToWard}
            />
          </CardContent>
        </Card>
      </div>

      {(from || to) && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {from ? `A: ${from.name} (${from.lat.toFixed(4)}, ${from.lng.toFixed(4)})` : "A: not set"}
          {" · "}
          {to ? `B: ${to.name} (${to.lat.toFixed(4)}, ${to.lng.toFixed(4)})` : "B: not set"}
          {distanceKm && <span className="ml-2 font-medium text-foreground">· straight-line {distanceKm} km</span>}
        </div>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div ref={mapDiv} className="h-[55vh] w-full" />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Tip: Pin missing panchayaths/wards in <Link to="/admin/locations" className="underline">Admin → Locations</Link>.
      </p>
    </div>
  );
}

function PanchayathWardSelect({
  panchayaths, wards, panchayathId, wardId, onPanchayath, onWard,
}: {
  panchayaths: GeoRow[];
  wards: GeoRow[];
  panchayathId: string;
  wardId: string;
  onPanchayath: (id: string) => void;
  onWard: (id: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <select
        className="rounded-md border bg-background px-2 py-1.5 text-sm"
        value={panchayathId}
        onChange={(e) => onPanchayath(e.target.value)}
      >
        <option value="">Panchayath…</option>
        {panchayaths.map((p) => (
          <option key={p.id} value={p.id} disabled={p.lat == null || p.lng == null}>
            {p.name}{p.lat == null ? " (unpinned)" : ""}
          </option>
        ))}
      </select>
      <select
        className="rounded-md border bg-background px-2 py-1.5 text-sm"
        value={wardId}
        onChange={(e) => onWard(e.target.value)}
        disabled={!panchayathId}
      >
        <option value="">Ward (optional)…</option>
        {wards.map((w) => (
          <option key={w.id} value={w.id} disabled={w.lat == null || w.lng == null}>
            {w.label ? `#${w.label} ` : ""}{w.name}{w.lat == null ? " (unpinned)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

async function fetchWards(panchayathId: string): Promise<GeoRow[]> {
  const { data, error } = await supabase
    .from("wards")
    .select("id, name, ward_number, latitude, longitude")
    .eq("panchayath_id", panchayathId)
    .order("ward_number", { nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((w: any) => ({
    id: w.id, name: w.name, lat: w.latitude, lng: w.longitude, label: w.ward_number,
  }));
}

function resolvePoint(
  panchayaths: GeoRow[], wards: GeoRow[], panchayathId: string, wardId: string,
): GeoRow | null {
  if (wardId) {
    const w = wards.find((x) => x.id === wardId);
    if (w?.lat != null && w?.lng != null) return w;
  }
  if (panchayathId) {
    const p = panchayaths.find((x) => x.id === panchayathId);
    if (p?.lat != null && p?.lng != null) return p;
  }
  return null;
}
