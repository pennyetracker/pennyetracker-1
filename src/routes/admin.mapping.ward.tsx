import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { MapPicker } from "@/components/map/MapPicker";
import { GraphCanvas } from "@/components/marking/GraphCanvas";
import { useGoogleMapsKey } from "@/hooks/use-google-maps-key";

export const Route = createFileRoute("/admin/mapping/ward")({
  component: WardMap,
  head: () => ({ meta: [{ title: "Ward Map — Admin" }] }),
});

function WardMap() {
  const apiKey = useGoogleMapsKey();
  const [panchayathId, setPanchayathId] = useState<string | null>(null);

  const { data: panchayaths = [] } = useQuery({
    queryKey: ["panchayaths-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("panchayaths").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/mapping"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Ward Map</h1>
      </div>

      <Tabs defaultValue="pin">
        <TabsList>
          <TabsTrigger value="pin">Map pin</TabsTrigger>
          <TabsTrigger value="neighbours">Neighbours (N/S/E/W)</TabsTrigger>
        </TabsList>
        <TabsContent value="pin" className="mt-4">
          <MapPicker
            kind="ward"
            apiKey={apiKey}
            parents={panchayaths}
            parentId={panchayathId}
            onParentChange={setPanchayathId}
            parentLabel="Panchayath"
          />
        </TabsContent>
        <TabsContent value="neighbours" className="mt-4">
          <div className="mb-3 flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Panchayath:</label>
            <select
              value={panchayathId ?? ""}
              onChange={(e) => setPanchayathId(e.target.value || null)}
              className="h-9 min-w-[220px] rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Select panchayath...</option>
              {panchayaths.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {panchayathId ? (
            <GraphCanvas
              cfg={{
                label: "Ward",
                nodesTable: "wards",
                edgesTable: "ward_connections",
                srcCol: "source_ward_id",
                tgtCol: "target_ward_id",
                parentRef: { key: "panchayath_id", label: "Panchayath", table: "panchayaths" },
                subtitle: (n) => (n.ward_number ? `Ward #${n.ward_number}` : null),
                filter: { key: "panchayath_id", value: panchayathId },
              }}
            />
          ) : (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Select a panchayath above to start marking ward neighbours.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
