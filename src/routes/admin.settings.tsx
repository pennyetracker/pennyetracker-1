import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, ExternalLink, Upload, Trash2, MapIcon } from "lucide-react";
import { GOOGLE_MAPS_KEY_NAME, useGoogleMapsKey } from "@/hooks/use-google-maps-key";
import { useQuery } from "@tanstack/react-query";
import { clearCachedMbtiles } from "@/lib/mbtilesCache";

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
        </CardContent>
      </Card>
      <OfflineMbtilesCard />
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
