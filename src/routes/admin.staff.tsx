import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/staff")({ component: StaffPage });

type Staff = {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string;
  alt_phone: string | null;
  email: string | null;
  status: string;
  delivery_staff_panchayaths: { panchayath_id: string; panchayaths: { name: string } | null }[];
  delivery_staff_wards: { ward_id: string; wards: { name: string; ward_number: string | null; panchayath_id: string } | null }[];
  roles?: string[];
};

function StaffPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  type PendingStaff = { id: string; full_name: string; phone: string; created_at: string; panchayaths: string[]; wards: string[] };
  const callApproval = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("staff-approval", { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["staff-pending"],
    queryFn: async (): Promise<PendingStaff[]> => {
      const data = await callApproval({ action: "list" });
      return data.pending ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: (vars: { staff_id: string; role: "admin" | "delivery" }) =>
      callApproval({ action: "approve", ...vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-pending"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff approved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: (staff_id: string) => callApproval({ action: "reject", staff_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-pending"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff rejected");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: staffData, isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [{ data: staffRows, error: staffError }, { data: rolesRows }] = await Promise.all([
        supabase
          .from("delivery_staff")
          .select("*, delivery_staff_panchayaths(panchayath_id, panchayaths(name)), delivery_staff_wards(ward_id, wards(name, ward_number, panchayath_id))")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (staffError) throw staffError;
      const staffList = (staffRows ?? []) as Staff[];
      const rolesMap = new Map<string, string[]>();
      (rolesRows ?? []).forEach((r) => {
        const existing = rolesMap.get(r.user_id) ?? [];
        existing.push(r.role);
        rolesMap.set(r.user_id, existing);
      });
      return staffList.map((s) => ({
        ...s,
        roles: s.user_id ? (rolesMap.get(s.user_id) ?? []) : [],
      }));
    },
  });

  const staff = staffData ?? [];
  const deliveryStaff = staff.filter(
    (s) => !(s.roles?.includes("admin") || s.roles?.includes("super_admin")),
  );

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

  const renderStaffList = (list: typeof staff) => (
    <Card className="divide-y">
      {isLoading && <div className="p-6 text-center text-muted-foreground">Loading…</div>}
      {!isLoading && list.length === 0 && (
        <div className="p-6 text-center text-muted-foreground">No staff found.</div>
      )}
      {list.map((s) => {
        const isOpen = !!expanded[s.id];
        return (
          <Collapsible key={s.id} open={isOpen} onOpenChange={(o) => setExpanded((e) => ({ ...e, [s.id]: o }))}>
            <div className="flex items-center gap-2 p-3">
              <CollapsibleTrigger asChild>
                <Button size="icon" variant="ghost" className="shrink-0">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.full_name}</div>
                <div className="text-xs text-muted-foreground">{s.phone}{s.alt_phone ? ` · ${s.alt_phone}` : ""}</div>
              </div>
              <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
              <Button size="icon" variant="ghost" onClick={() => setEditing(s)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove this staff?")) del.mutate(s.id); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <CollapsibleContent>
              <div className="px-12 pb-4 space-y-3 text-sm">
                {s.email && <div><span className="text-muted-foreground">Email: </span>{s.email}</div>}
                <div>
                  <div className="text-muted-foreground mb-1">Allocated Panchayaths</div>
                  <div className="flex flex-wrap gap-1">
                    {s.delivery_staff_panchayaths.length === 0 && <span className="text-muted-foreground">—</span>}
                    {s.delivery_staff_panchayaths.map((p) => (
                      <Badge key={p.panchayath_id} variant="outline">{p.panchayaths?.name ?? "—"}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Allocated Wards</div>
                  <div className="flex flex-wrap gap-1">
                    {s.delivery_staff_wards.length === 0 && <span className="text-muted-foreground">—</span>}
                    {s.delivery_staff_wards.map((w) => (
                      <Badge key={w.ward_id} variant="secondary">
                        {w.wards?.ward_number ? `Ward ${w.wards.ward_number}` : w.wards?.name ?? "—"}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </Card>
  );

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
          {open && (
            <StaffDialog
              mode="create"
              panchayaths={panchayaths as any}
              wards={wards as any}
              onClose={() => setOpen(false)}
            />
          )}
        </Dialog>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          {editing && (
            <StaffDialog
              mode="edit"
              staff={editing}
              panchayaths={panchayaths as any}
              wards={wards as any}
              onClose={() => setEditing(null)}
            />
          )}
        </Dialog>
      </div>

      {(pendingLoading || pending.length > 0) && (
        <Card className="mt-6">
          <div className="border-b p-3">
            <h2 className="text-sm font-semibold">Pending Approvals</h2>
            <p className="text-xs text-muted-foreground">Staff who signed up and are waiting for super admin approval.</p>
          </div>
          <div className="divide-y">
            {pendingLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
            {!pendingLoading && pending.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No pending requests.</div>
            )}
            {pending.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.phone}
                    {p.panchayaths.length > 0 ? ` · ${p.panchayaths.join(", ")}` : ""}
                    {p.wards.length > 0 ? ` · ${p.wards.join(", ")}` : ""}
                  </div>
                </div>
                <Button size="sm" variant="outline" disabled={approve.isPending} onClick={() => approve.mutate({ staff_id: p.id, role: "delivery" })}>
                  Approve as Delivery
                </Button>
                <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate({ staff_id: p.id, role: "admin" })}>
                  Approve as Admin
                </Button>
                <Button size="sm" variant="destructive" disabled={reject.isPending} onClick={() => reject.mutate(p.id)}>
                  Reject
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-6">{renderStaffList(deliveryStaff)}</div>
    </div>
  );
}

function StaffDialog({
  mode,
  staff,
  panchayaths,
  wards,
  onClose,
}: {
  mode: "create" | "edit";
  staff?: Staff;
  panchayaths: any[];
  wards: any[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    full_name: staff?.full_name ?? "",
    phone: staff?.phone ?? "",
    alt_phone: staff?.alt_phone ?? "",
    email: staff?.email ?? "",
    status: staff?.status ?? "active",
  });
  const [selectedPanchayaths, setSelectedPanchayaths] = useState<string[]>(
    staff?.delivery_staff_panchayaths.map((p) => p.panchayath_id) ?? [],
  );
  const [selectedWards, setSelectedWards] = useState<string[]>(
    staff?.delivery_staff_wards.map((w) => w.ward_id) ?? [],
  );

  const availableWards = useMemo(
    () => wards.filter((w) => selectedPanchayaths.includes(w.panchayath_id)),
    [wards, selectedPanchayaths],
  );

  // Drop wards whose panchayath is no longer selected
  useEffect(() => {
    setSelectedWards((prev) => prev.filter((wid) => {
      const w = wards.find((x) => x.id === wid);
      return w && selectedPanchayaths.includes(w.panchayath_id);
    }));
  }, [selectedPanchayaths, wards]);

  const togglePanchayath = (id: string) => {
    setSelectedPanchayaths((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleWard = (id: string) => {
    setSelectedWards((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const allWardsSelected = availableWards.length > 0 && availableWards.every((w) => selectedWards.includes(w.id));
  const toggleAllWards = () => {
    if (allWardsSelected) {
      const ids = new Set(availableWards.map((w) => w.id));
      setSelectedWards((prev) => prev.filter((id) => !ids.has(id)));
    } else {
      const ids = new Set(selectedWards);
      availableWards.forEach((w) => ids.add(w.id));
      setSelectedWards(Array.from(ids));
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      let staffId = staff?.id;
      if (mode === "create") {
        const { data: inserted, error } = await supabase
          .from("delivery_staff")
          .insert({
            full_name: form.full_name,
            phone: form.phone,
            alt_phone: form.alt_phone || null,
            email: form.email || null,
            status: form.status,
          })
          .select("id")
          .single();
        if (error) throw error;
        staffId = inserted.id;
      } else {
        const { error } = await supabase
          .from("delivery_staff")
          .update({
            full_name: form.full_name,
            phone: form.phone,
            alt_phone: form.alt_phone || null,
            email: form.email || null,
            status: form.status,
          })
          .eq("id", staffId!);
        if (error) throw error;

        // Replace allocations
        await supabase.from("delivery_staff_panchayaths").delete().eq("staff_id", staffId!);
        await supabase.from("delivery_staff_wards").delete().eq("staff_id", staffId!);
      }

      if (selectedPanchayaths.length > 0) {
        const { error: pErr } = await supabase
          .from("delivery_staff_panchayaths")
          .insert(selectedPanchayaths.map((pid) => ({ staff_id: staffId!, panchayath_id: pid })));
        if (pErr) throw pErr;
      }
      if (selectedWards.length > 0) {
        const { error: wErr } = await supabase
          .from("delivery_staff_wards")
          .insert(selectedWards.map((wid) => ({ staff_id: staffId!, ward_id: wid })));
        if (wErr) throw wErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success(mode === "create" ? "Staff added" : "Staff updated");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "Add delivery staff" : "Edit delivery staff"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <Field label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
        <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field label="Alternate mobile (optional)" value={form.alt_phone} onChange={(v) => setForm({ ...form, alt_phone: v })} />
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
              {selectedPanchayaths.map((pid) => {
                const panchayath = panchayaths.find((x) => x.id === pid);
                const groupWards = wards.filter((w) => w.panchayath_id === pid);
                const allSelected = groupWards.length > 0 && groupWards.every((w) => selectedWards.includes(w.id));
                const toggleGroup = () => {
                  const ids = new Set(groupWards.map((w) => w.id));
                  if (allSelected) {
                    setSelectedWards((prev) => prev.filter((id) => !ids.has(id)));
                  } else {
                    setSelectedWards((prev) => Array.from(new Set([...prev, ...groupWards.map((w) => w.id)])));
                  }
                };
                return (
                  <div key={pid} className="mb-3 last:mb-0">
                    <div className="flex items-center justify-between border-b pb-1 mb-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {panchayath?.name ?? "—"}
                      </span>
                      {groupWards.length > 0 && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={toggleGroup}
                        >
                          {allSelected ? "Clear all" : "Select all"}
                        </button>
                      )}
                    </div>
                    {groupWards.length === 0 && (
                      <p className="text-xs text-muted-foreground py-1">No wards.</p>
                    )}
                    {groupWards.map((w) => (
                      <label key={w.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                        <Checkbox
                          checked={selectedWards.includes(w.id)}
                          onCheckedChange={() => toggleWard(w.id)}
                        />
                        <span>{w.ward_number ? `Ward ${w.ward_number}` : w.name}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </ScrollArea>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => save.mutate()}
          disabled={!form.full_name || !form.phone || selectedPanchayaths.length === 0 || save.isPending}
        >
          {save.isPending ? "Saving…" : mode === "create" ? "Save" : "Update"}
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
