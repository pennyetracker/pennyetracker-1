import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/staff")({ component: StaffPage });

type Staff = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  status: string;
  delivery_staff_panchayaths: { panchayath_id: string; panchayaths: { name: string } | null }[];
  delivery_staff_wards: { ward_id: string; wards: { name: string; ward_number: string | null } | null }[];
};

function StaffPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_staff")
        .select("*, delivery_staff_panchayaths(panchayath_id, panchayaths(name)), delivery_staff_wards(ward_id, wards(name, ward_number))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Staff[];
    },
  });

  const { data: panchayaths = [] } = useQuery({
    queryKey: ["panchayaths-flat"],
    queryFn: async () => {
      const { data } = await supabase.from("panchayaths").select("id, name, districts(name)").order("name");
      return data ?? [];
    },
  });

  const { data: wards = [] } = useQuery({
    queryKey: ["wards-flat"],
    queryFn: async () => {
      const { data } = await supabase.from("wards").select("id, name, ward_number, panchayath_id").order("ward_number");
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your delivery team and their jurisdictions.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Add Staff</Button>
          </DialogTrigger>
          <AddStaffDialog panchayaths={panchayaths as any} wards={wards as any} onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <Card className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Allocated Panchayaths</TableHead>
              <TableHead>Allocated Wards</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && staff.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No staff yet. Add your first delivery person.</TableCell></TableRow>
            )}
            {staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.full_name}</TableCell>
                <TableCell>{s.phone}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {s.delivery_staff_panchayaths.length === 0 && <span className="text-muted-foreground">—</span>}
                    {s.delivery_staff_panchayaths.map((p) => (
                      <Badge key={p.panchayath_id} variant="outline">{p.panchayaths?.name ?? "—"}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {s.delivery_staff_wards.length === 0 && <span className="text-muted-foreground">—</span>}
                    {s.delivery_staff_wards.map((w) => (
                      <Badge key={w.ward_id} variant="secondary">
                        {w.wards?.ward_number ? `Ward ${w.wards.ward_number}` : w.wards?.name ?? "—"}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function AddStaffDialog({ panchayaths, wards, onClose }: { panchayaths: any[]; wards: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", status: "active" });
  const [selectedPanchayaths, setSelectedPanchayaths] = useState<string[]>([]);
  const [selectedWards, setSelectedWards] = useState<string[]>([]);

  const availableWards = useMemo(
    () => wards.filter((w) => selectedPanchayaths.includes(w.panchayath_id)),
    [wards, selectedPanchayaths],
  );

  const togglePanchayath = (id: string) => {
    setSelectedPanchayaths((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // drop wards whose panchayath is no longer selected
      setSelectedWards((w) => w.filter((wid) => {
        const ward = wards.find((x) => x.id === wid);
        return ward && next.includes(ward.panchayath_id);
      }));
      return next;
    });
  };

  const toggleWard = (id: string) => {
    setSelectedWards((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { data: inserted, error } = await supabase
        .from("delivery_staff")
        .insert({
          full_name: form.full_name,
          phone: form.phone,
          email: form.email || null,
          status: form.status,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (selectedPanchayaths.length > 0) {
        const { error: pErr } = await supabase
          .from("delivery_staff_panchayaths")
          .insert(selectedPanchayaths.map((pid) => ({ staff_id: inserted.id, panchayath_id: pid })));
        if (pErr) throw pErr;
      }
      if (selectedWards.length > 0) {
        const { error: wErr } = await supabase
          .from("delivery_staff_wards")
          .insert(selectedWards.map((wid) => ({ staff_id: inserted.id, ward_id: wid })));
        if (wErr) throw wErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff added");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Add delivery staff</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <Field label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
        <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field label="Email (optional)" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Allocated Panchayaths</Label>
            <ScrollArea className="h-48 rounded-md border p-2">
              {panchayaths.length === 0 && <p className="text-sm text-muted-foreground">No panchayaths yet.</p>}
              {panchayaths.map((p) => (
                <label key={p.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedPanchayaths.includes(p.id)}
                    onCheckedChange={() => togglePanchayath(p.id)}
                  />
                  <span>{p.name} {p.districts?.name ? <span className="text-muted-foreground">({p.districts.name})</span> : null}</span>
                </label>
              ))}
            </ScrollArea>
          </div>

          <div className="space-y-1.5">
            <Label>Allocated Wards</Label>
            <ScrollArea className="h-48 rounded-md border p-2">
              {selectedPanchayaths.length === 0 && (
                <p className="text-sm text-muted-foreground">Select panchayaths first.</p>
              )}
              {selectedPanchayaths.length > 0 && availableWards.length === 0 && (
                <p className="text-sm text-muted-foreground">No wards in selected panchayaths.</p>
              )}
              {availableWards.map((w) => (
                <label key={w.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedWards.includes(w.id)}
                    onCheckedChange={() => toggleWard(w.id)}
                  />
                  <span>{w.ward_number ? `Ward ${w.ward_number}` : w.name}</span>
                </label>
              ))}
            </ScrollArea>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => create.mutate()}
          disabled={!form.full_name || !form.phone || selectedPanchayaths.length === 0 || create.isPending}
        >
          {create.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
