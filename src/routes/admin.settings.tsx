import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { testExternalSite } from "@/lib/external-sites.functions";
import { Save, ExternalLink, Upload, Trash2, MapIcon, Plus, Globe, Pencil, Check, X } from "lucide-react";
import { GOOGLE_MAPS_KEY_NAME, useGoogleMapsKey } from "@/hooks/use-google-maps-key";
import { useQuery } from "@tanstack/react-query";
import { clearCachedMbtiles } from "@/lib/mbtilesCache";
import { useGoogleMaps } from "@/components/map/useGoogleMaps";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Admin" }] }),
});

function SettingsPage() {
  const qc = useQueryClient();
  const existingKey = useGoogleMapsKey();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (existingKey != null) setValue(existingKey);
  }, [existingKey]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        key: GOOGLE_MAPS_KEY_NAME,
        value: value.trim() || null,
        updated_at: new Date().toISOString(),
        updated_by: u.user?.id ?? null,
      };
      const { error } = await supabase.from("app_settings").upsert(payload, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Settings saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">App-wide configuration available to admins.</p>

      <Card className="mt-6 max-w-2xl">
        <CardHeader>
          <CardTitle>Google Maps API key</CardTitle>
          <CardDescription>
            Used by the Mapping pages to render Google Maps. The key is exposed to logged-in admins in
            the browser, so you must restrict it in Google Cloud Console.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="key">API key</Label>
            <Input
              id="key"
              placeholder="AIza…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How to get a key</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>Open Google Cloud Console → APIs &amp; Services → Credentials.</li>
              <li>Create an API key and enable the <b>Maps JavaScript API</b>.</li>
              <li>
                Restrict it: <b>Application restrictions</b> → HTTP referrers → add your app URLs
                (e.g. <code>*.lovable.app/*</code> and your custom domain).
              </li>
            </ol>
            <a
              href="https://console.cloud.google.com/google/maps-apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open Google Cloud Console <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save"}
          </Button>
          <EmbeddedMapPreview apiKey={value.trim() || existingKey || ""} />
        </CardContent>
      </Card>
      <OfflineMbtilesCard />
      <ExternalSitesCard />
    </div>
  );
}

function EmbeddedMapPreview({ apiKey }: { apiKey: string }) {
  const state = useGoogleMaps(apiKey || null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state !== "ready" || !ref.current) return;
    const g = (window as any).google;
    if (!g?.maps) return;
    const map = new g.maps.Map(ref.current, {
      center: { lat: 10.8505, lng: 76.2711 }, // Kerala
      zoom: 8,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });
    new g.maps.Marker({ position: { lat: 10.8505, lng: 76.2711 }, map, title: "Kerala" });
  }, [state]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Live map preview</Label>
        <span className="text-xs text-muted-foreground">
          {!apiKey
            ? "Enter a key to preview"
            : state === "loading"
              ? "Loading…"
              : state === "ready"
                ? "Key works ✓"
                : state === "error"
                  ? "Key failed — check restrictions/billing"
                  : ""}
        </span>
      </div>
      <div className="relative h-72 w-full overflow-hidden rounded-md border bg-muted">
        {apiKey && state !== "error" ? (
          <div ref={ref} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
            {state === "error"
              ? "Google Maps failed to load with this key."
              : "Save a Google Maps API key to see the embedded preview."}
          </div>
        )}
      </div>
    </div>
  );
}

const OFFLINE_MBTILES_KEY = "offline_mbtiles";

type OfflineMbtilesMeta = {
  path: string;
  size: number;
  uploaded_at: string;
  filename?: string | null;
};

function OfflineMbtilesCard() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: meta } = useQuery({
    queryKey: ["app_settings", OFFLINE_MBTILES_KEY],
    queryFn: async (): Promise<OfflineMbtilesMeta | null> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", OFFLINE_MBTILES_KEY)
        .maybeSingle();
      if (error) throw error;
      const raw = (data?.value as string | null) ?? null;
      if (!raw) return null;
      try { return JSON.parse(raw) as OfflineMbtilesMeta; } catch { return null; }
    },
  });

  const upload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".mbtiles")) {
      toast.error("Please choose a .mbtiles file");
      return;
    }
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      // Remove old file first
      if (meta?.path) {
        await supabase.storage.from("offline-maps").remove([meta.path]).catch(() => {});
      }
      const path = `map-${Date.now()}.mbtiles`;
      const { error: upErr } = await supabase.storage
        .from("offline-maps")
        .upload(path, file, { contentType: "application/octet-stream", upsert: true });
      if (upErr) throw upErr;

      const newMeta: OfflineMbtilesMeta = {
        path,
        size: file.size,
        uploaded_at: new Date().toISOString(),
        filename: file.name,
      };
      const { error: sErr } = await supabase.from("app_settings").upsert(
        {
          key: OFFLINE_MBTILES_KEY,
          value: JSON.stringify(newMeta),
          updated_at: new Date().toISOString(),
          updated_by: u.user?.id ?? null,
        },
        { onConflict: "key" },
      );
      if (sErr) throw sErr;
      await clearCachedMbtiles();
      qc.invalidateQueries({ queryKey: ["app_settings", OFFLINE_MBTILES_KEY] });
      qc.invalidateQueries({ queryKey: ["offline_mbtiles_meta"] });
      toast.success("Offline map uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!meta) return;
    if (!confirm("Remove the uploaded offline map?")) return;
    try {
      await supabase.storage.from("offline-maps").remove([meta.path]).catch(() => {});
      const { error } = await supabase
        .from("app_settings")
        .delete()
        .eq("key", OFFLINE_MBTILES_KEY);
      if (error) throw error;
      await clearCachedMbtiles();
      qc.invalidateQueries({ queryKey: ["app_settings", OFFLINE_MBTILES_KEY] });
      qc.invalidateQueries({ queryKey: ["offline_mbtiles_meta"] });
      toast.success("Offline map removed");
    } catch (e: any) {
      toast.error(e.message ?? "Remove failed");
    }
  };

  return (
    <Card className="mt-6 max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapIcon className="h-5 w-5" /> Offline map (MBTiles)
        </CardTitle>
        <CardDescription>
          Upload a <code>.mbtiles</code> raster tile package. Used automatically when the
          Google Maps API key is missing or the device is offline, so tracking works without
          internet. Each device caches the file in IndexedDB after first download.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {meta ? (
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">{meta.filename ?? meta.path}</div>
            <div className="text-xs text-muted-foreground">
              {(meta.size / 1024 / 1024).toFixed(1)} MB · uploaded{" "}
              {new Date(meta.uploaded_at).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            No offline map uploaded yet.
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".mbtiles,application/octet-stream"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <div className="flex gap-2">
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : meta ? "Replace file" : "Upload .mbtiles"}
          </Button>
          {meta && (
            <Button variant="outline" onClick={remove} disabled={uploading}>
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          )}
        </div>
        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Tip</p>
          MBTiles files can be 50–500 MB. Generate one from your region with tools like{" "}
          <a className="text-primary hover:underline" target="_blank" rel="noreferrer"
            href="https://github.com/mapbox/mbutil">mb-util</a>{" "}
          or{" "}
          <a className="text-primary hover:underline" target="_blank" rel="noreferrer"
            href="https://www.maptiler.com/engine/">MapTiler Engine</a>.
        </div>
      </CardContent>
    </Card>
  );
}

// ============= External Tracking Sites =============

type ExternalSite = {
  id: string;
  name: string;
  website_url: string;
  api_key: string;
  test_endpoint_url: string | null;
  auth_header_name: string;
  auth_header_prefix: string;
  description: string | null;
};

type SiteForm = {
  name: string;
  website_url: string;
  api_key: string;
  test_endpoint_url: string;
  auth_header_name: string;
  auth_header_prefix: string;
  description: string;
};

const emptyForm: SiteForm = {
  name: "",
  website_url: "",
  api_key: "",
  test_endpoint_url: "",
  auth_header_name: "Authorization",
  auth_header_prefix: "Bearer ",
  description: "",
};

function maskKey(key: string) {
  if (!key) return "";
  if (key.length <= 4) return "••••";
  return "••••" + key.slice(-4);
}

function ExternalSitesCard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalSite | null>(null);
  const [form, setForm] = useState<SiteForm>(emptyForm);
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: sites, isLoading } = useQuery({
    queryKey: ["external_tracking_sites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_tracking_sites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExternalSite[];
    },
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (s: ExternalSite) => {
    setEditing(s);
    setForm({
      name: s.name,
      website_url: s.website_url,
      api_key: s.api_key,
      test_endpoint_url: s.test_endpoint_url ?? "",
      auth_header_name: s.auth_header_name,
      auth_header_prefix: s.auth_header_prefix,
      description: s.description ?? "",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      const website_url = form.website_url.trim();
      const api_key = form.api_key.trim();
      if (!name || !website_url || !api_key) throw new Error("Name, URL and API key are required");
      try { new URL(website_url); } catch { throw new Error("Invalid website URL"); }
      if (form.test_endpoint_url.trim()) {
        try { new URL(form.test_endpoint_url.trim()); } catch { throw new Error("Invalid test endpoint URL"); }
      }
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        name,
        website_url,
        api_key,
        test_endpoint_url: form.test_endpoint_url.trim() || null,
        auth_header_name: form.auth_header_name.trim() || "Authorization",
        auth_header_prefix: form.auth_header_prefix,
        description: form.description.trim() || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("external_tracking_sites")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("external_tracking_sites")
          .insert({ ...payload, created_by: u.user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["external_tracking_sites"] });
      qc.invalidateQueries({ queryKey: ["external_tracking_sites", "list"] });
      toast.success(editing ? "Site updated" : "Site added");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("external_tracking_sites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["external_tracking_sites"] });
      qc.invalidateQueries({ queryKey: ["external_tracking_sites", "list"] });
      toast.success("Site removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const runTest = useServerFn(testExternalSite);
  const testKey = async (s: ExternalSite) => {
    setTestingId(s.id);
    try {
      const r = await runTest({ data: { siteId: s.id } });
      if (r.ok) toast.success(`OK — ${r.status} ${r.statusText}`);
      else toast.error(`Failed — ${r.status} ${r.statusText}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Test failed");
    } finally {
      setTestingId(null);
    }
  };

  return (
    <Card className="mt-6 max-w-2xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" /> External tracking sites
            </CardTitle>
            <CardDescription>
              Add external order-tracking / delivery websites with their API keys. Keys are stored
              in the database and only visible to admins.
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAdd} size="sm">
                <Plus className="h-4 w-4" /> Add site
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit site" : "Add external site"}</DialogTitle>
                <DialogDescription>
                  Configure how to call the external API. The Test button sends a GET request to
                  the test endpoint with your API key in the auth header.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label htmlFor="es-name">Name</Label>
                  <Input id="es-name" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="es-url">Website URL</Label>
                  <Input id="es-url" placeholder="https://example.com" value={form.website_url}
                    onChange={(e) => setForm({ ...form, website_url: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="es-key">API key</Label>
                  <Input id="es-key" autoComplete="off" spellCheck={false} value={form.api_key}
                    onChange={(e) => setForm({ ...form, api_key: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="es-test">Test endpoint URL (optional)</Label>
                  <Input id="es-test" placeholder="defaults to website URL" value={form.test_endpoint_url}
                    onChange={(e) => setForm({ ...form, test_endpoint_url: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="es-hname">Auth header name</Label>
                    <Input id="es-hname" value={form.auth_header_name}
                      onChange={(e) => setForm({ ...form, auth_header_name: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="es-hpre">Auth header prefix</Label>
                    <Input id="es-hpre" value={form.auth_header_prefix}
                      onChange={(e) => setForm({ ...form, auth_header_prefix: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="es-desc">Description (optional)</Label>
                  <Textarea id="es-desc" rows={2} value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" /> Cancel
                </Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  <Check className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !sites?.length ? (
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            No external sites yet. Click <b>Add site</b> to configure one.
          </div>
        ) : (
          <ul className="divide-y rounded-md border">
            {sites.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{s.name}</div>
                  <a href={s.website_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    {s.website_url} <ExternalLink className="h-3 w-3" />
                  </a>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Key: <code>{maskKey(s.api_key)}</code> · {s.auth_header_name}: {s.auth_header_prefix}…
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => testKey(s)} disabled={testingId === s.id}>
                    {testingId === s.id ? "Testing…" : "Test"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => { if (confirm(`Remove ${s.name}?`)) remove.mutate(s.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
