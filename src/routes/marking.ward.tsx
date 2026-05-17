import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { GraphCanvas } from "@/components/marking/GraphCanvas";
import { ArrowLeft, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/marking/ward")({
  component: WardMarking,
  head: () => ({ meta: [{ title: "Ward Marking" }] }),
});

function WardMarking() {
  const [panchayathId, setPanchayathId] = useState<string>("");

  const { data: panchayaths = [] } = useQuery({
    queryKey: ["panchayaths", "picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("panchayaths")
        .select("id,name")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const selected = panchayaths.find((p) => p.id === panchayathId);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/marking">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Ward Marking</h1>
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <label className="text-sm font-medium text-muted-foreground">
          Panchayath
        </label>
        <div className="min-w-[240px] flex-1 sm:max-w-sm">
          <Select value={panchayathId} onValueChange={setPanchayathId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a panchayath to mark its wards..." />
            </SelectTrigger>
            <SelectContent>
              {panchayaths.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selected && (
          <p className="text-sm text-muted-foreground">
            Marking wards within{" "}
            <span className="font-semibold text-foreground">{selected.name}</span>
          </p>
        )}
      </Card>

      {panchayathId ? (
        <GraphCanvas
          key={panchayathId}
          cfg={{
            label: "Ward",
            nodesTable: "wards",
            edgesTable: "ward_connections",
            srcCol: "source_ward_id",
            tgtCol: "target_ward_id",
            parentRef: {
              key: "panchayath_id",
              label: "Panchayath",
              table: "panchayaths",
            },
            subtitle: (n) => (n.ward_number ? `Ward #${n.ward_number}` : null),
            parentFilter: { column: "panchayath_id", value: panchayathId },
          }}
        />
      ) : (
        <Card className="flex min-h-[400px] items-center justify-center p-10 text-center">
          <div>
            <MapPinned className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Pick a panchayath above to start connecting its wards.
            </p>
          </div>
        </Card>
      )}
    </main>
  );
}
