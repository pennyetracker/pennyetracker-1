import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, MapPin, Link2 } from "lucide-react";
import { toast } from "sonner";

type Direction = "north" | "south" | "east" | "west";

export type GraphConfig = {
  /** Display label e.g. "Panchayath" or "Ward" */
  label: string;
  /** Nodes table */
  nodesTable: "panchayaths" | "wards";
  /** Edges table */
  edgesTable: "panchayath_connections" | "ward_connections";
  /** Source FK column on edges table */
  srcCol: string;
  /** Target FK column on edges table */
  tgtCol: string;
  /** Required parent FK when creating a new node (e.g. district_id for panchayath) */
  parentRef: {
    key: string;
    label: string;
    table: "districts" | "panchayaths";
  };
  /** Extra display under node name */
  subtitle?: (node: any) => string | null;
  /** Optional scoping filter, e.g. only show wards belonging to a panchayath */
  filter?: { key: string; value: string } | null;
  /** Read-only mode: hides create/add/connect actions (public viewing) */
  readOnly?: boolean;
};

const DIRS: Direction[] = ["north", "south", "east", "west"];
const DIR_POS: Record<Direction, { x: number; y: number }> = {
  north: { x: 0, y: -220 },
  south: { x: 0, y: 220 },
  east: { x: 280, y: 0 },
  west: { x: -280, y: 0 },
};

function NodeCard({ data }: { data: any }) {
  return (
    <Card
      className={`min-w-[180px] cursor-pointer border-2 px-4 py-3 text-center shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl ${
        data.center
          ? "border-primary bg-gradient-to-br from-primary/15 to-primary/5"
          : "border-border bg-card"
      }`}
      onClick={data.onClick}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="flex items-center justify-center gap-1.5">
        <MapPin className={`h-3.5 w-3.5 ${data.center ? "text-primary" : "text-muted-foreground"}`} />
        <span className="font-semibold tracking-tight">{data.label}</span>
      </div>
      {data.subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{data.subtitle}</p>}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </Card>
  );
}

function PlaceholderNode({ data }: { data: any }) {
  return (
    <div className="flex min-w-[180px] flex-col gap-1.5 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-background/50 p-2">
      <p className="text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {data.direction}
      </p>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={data.onAdd}>
        <Plus className="h-3 w-3" /> Add new
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={data.onConnect}>
        <Link2 className="h-3 w-3" /> Connect existing
      </Button>
    </div>
  );
}

const nodeTypes = { card: NodeCard, placeholder: PlaceholderNode };

export function GraphCanvas({ cfg }: { cfg: GraphConfig }) {
  const qc = useQueryClient();
  const [centerId, setCenterId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ kind: "add" | "connect" | "create"; dir?: Direction } | null>(null);

  // Reset selection when scoping filter changes
  useEffect(() => {
    setCenterId(null);
    setSearch("");
  }, [cfg.filter?.value]);

  // All nodes (for search and existing selection)
  const { data: allNodes = [] } = useQuery({
    queryKey: [cfg.nodesTable, "all", cfg.filter?.key, cfg.filter?.value],
    queryFn: async () => {
      let q = supabase.from(cfg.nodesTable).select("*").order("name");
      if (cfg.filter) q = q.eq(cfg.filter.key, cfg.filter.value);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
    enabled: cfg.filter ? !!cfg.filter.value : true,
  });

  // Connections from current center
  const { data: connections = [] } = useQuery({
    queryKey: [cfg.edgesTable, centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from(cfg.edgesTable)
        .select("*")
        .eq(cfg.srcCol, centerId);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!centerId,
  });

  const nodeById = useMemo(() => Object.fromEntries(allNodes.map((n: any) => [n.id, n])), [allNodes]);
  const centerNode = centerId ? nodeById[centerId] : null;

  const occupied = useMemo(() => {
    const m: Partial<Record<Direction, any>> = {};
    for (const c of connections) {
      const target = nodeById[c[cfg.tgtCol]];
      if (target) m[c.direction as Direction] = target;
    }
    return m;
  }, [connections, nodeById, cfg.tgtCol]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allNodes.slice(0, 20);
    return allNodes.filter((n: any) => n.name.toLowerCase().includes(q)).slice(0, 20);
  }, [allNodes, search]);

  const addConnection = useMutation({
    mutationFn: async ({ targetId, direction }: { targetId: string; direction: Direction }) => {
      if (!centerId) throw new Error("No center");
      const { error } = await supabase
        .from(cfg.edgesTable)
        .insert({ [cfg.srcCol]: centerId, [cfg.tgtCol]: targetId, direction } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [cfg.edgesTable] });
      toast.success("Connected");
      setDialog(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createNode = useMutation({
    mutationFn: async (payload: { name: string; parentId: string; direction?: Direction }) => {
      const insert: any = { name: payload.name, [cfg.parentRef.key]: payload.parentId };
      const { data, error } = await supabase.from(cfg.nodesTable).insert(insert).select("*").single();
      if (error) throw error;
      if (payload.direction && centerId) {
        const { error: e2 } = await supabase
          .from(cfg.edgesTable)
          .insert({ [cfg.srcCol]: centerId, [cfg.tgtCol]: data.id, direction: payload.direction } as any);
        if (e2) throw e2;
      }
      return data;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: [cfg.nodesTable] });
      qc.invalidateQueries({ queryKey: [cfg.edgesTable] });
      toast.success("Created");
      setDialog(null);
      if (!vars.direction) setCenterId(data.id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Build flow nodes/edges
  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];
    if (!centerNode) return { nodes: ns, edges: es };

    ns.push({
      id: centerNode.id,
      type: "card",
      position: { x: 0, y: 0 },
      data: {
        label: centerNode.name,
        subtitle: cfg.subtitle?.(centerNode),
        center: true,
      },
    });

    for (const dir of DIRS) {
      const pos = DIR_POS[dir];
      const target = occupied[dir];
      if (target) {
        ns.push({
          id: target.id,
          type: "card",
          position: pos,
          data: {
            label: target.name,
            subtitle: cfg.subtitle?.(target),
            onClick: () => setCenterId(target.id),
          },
        });
        es.push({
          id: `${centerNode.id}-${target.id}-${dir}`,
          source: centerNode.id,
          target: target.id,
          label: dir,
          animated: true,
          style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          labelStyle: { fontSize: 10, textTransform: "uppercase", fontWeight: 600 },
        });
      } else if (!cfg.readOnly) {
        ns.push({
          id: `ph-${dir}`,
          type: "placeholder",
          position: pos,
          draggable: false,
          data: {
            direction: dir,
            onAdd: () => setDialog({ kind: "add", dir }),
            onConnect: () => setDialog({ kind: "connect", dir }),
          },
        });
        es.push({
          id: `${centerNode.id}-ph-${dir}`,
          source: centerNode.id,
          target: `ph-${dir}`,
          style: { stroke: "hsl(var(--muted-foreground) / 0.3)", strokeDasharray: "4 4" },
        });
      }
    }
    return { nodes: ns, edges: es };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerNode, occupied, cfg]);

  const onNodeClick = useCallback((_: any, n: Node) => {
    if (n.type === "card" && !(n.data as any).center) setCenterId(n.id);
  }, []);

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[500px] flex-col gap-3">
      {/* Top bar */}
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Search ${cfg.label.toLowerCase()}...`}
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && filtered.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover shadow-lg">
              {filtered.map((n: any) => (
                <button
                  key={n.id}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    setCenterId(n.id);
                    setSearch("");
                  }}
                >
                  {n.name}
                  {cfg.subtitle?.(n) && (
                    <span className="ml-2 text-xs text-muted-foreground">{cfg.subtitle(n)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button onClick={() => setDialog({ kind: "create" })}>
          <Plus className="h-4 w-4" /> New {cfg.label}
        </Button>
      </Card>

      {/* Canvas */}
      <Card className="relative flex-1 overflow-hidden">
        {!centerNode ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div>
              <MapPin className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Search above or create a new {cfg.label.toLowerCase()} to begin marking.
              </p>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.3}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-muted" />
          </ReactFlow>
        )}
      </Card>

      {/* Dialogs */}
      <NodeDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        kind={dialog?.kind ?? "create"}
        dir={dialog?.dir}
        cfg={cfg}
        existing={allNodes}
        excludeIds={[centerId, ...Object.values(occupied).map((n: any) => n?.id)].filter(Boolean) as string[]}
        onCreate={(payload) => createNode.mutate(payload)}
        onConnect={(targetId, direction) => addConnection.mutate({ targetId, direction })}
        pending={createNode.isPending || addConnection.isPending}
      />
    </div>
  );
}

function NodeDialog({
  open, onClose, kind, dir, cfg, existing, excludeIds, onCreate, onConnect, pending,
}: {
  open: boolean;
  onClose: () => void;
  kind: "add" | "connect" | "create";
  dir?: Direction;
  cfg: GraphConfig;
  existing: any[];
  excludeIds: string[];
  onCreate: (p: { name: string; parentId: string; direction?: Direction }) => void;
  onConnect: (targetId: string, direction: Direction) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [pickId, setPickId] = useState("");
  const [pickSearch, setPickSearch] = useState("");

  const { data: parents = [] } = useQuery({
    queryKey: [cfg.parentRef.table, "parents"],
    queryFn: async () => {
      const { data, error } = await supabase.from(cfg.parentRef.table).select("id,name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const choices = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    return existing
      .filter((n) => !excludeIds.includes(n.id))
      .filter((n) => !q || n.name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [existing, excludeIds, pickSearch]);

  const reset = () => { setName(""); setParentId(""); setPickId(""); setPickSearch(""); };

  const title =
    kind === "create"
      ? `New ${cfg.label}`
      : kind === "add"
      ? `Add ${cfg.label} (${dir})`
      : `Connect existing (${dir})`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {kind === "connect" ? (
          <div className="space-y-2">
            <Input
              placeholder="Search..."
              value={pickSearch}
              onChange={(e) => setPickSearch(e.target.value)}
            />
            <div className="max-h-60 space-y-1 overflow-auto rounded-md border p-1">
              {choices.length === 0 && (
                <p className="p-3 text-center text-sm text-muted-foreground">No matches</p>
              )}
              {choices.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setPickId(n.id)}
                  className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${pickId === n.id ? "bg-accent font-medium" : ""}`}
                >
                  {n.name}
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button disabled={!pickId || pending} onClick={() => dir && onConnect(pickId, dir)}>
                Connect
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-2">
            <Input placeholder={`${cfg.label} name`} value={name} onChange={(e) => setName(e.target.value)} />
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Select {cfg.parentRef.label}...</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <DialogFooter>
              <Button
                disabled={!name || !parentId || pending}
                onClick={() =>
                  onCreate({ name, parentId, direction: kind === "add" ? dir : undefined })
                }
              >
                Create{kind === "add" ? " & Connect" : ""}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
