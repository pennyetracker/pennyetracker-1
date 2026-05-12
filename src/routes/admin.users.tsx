import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({ component: UsersPage });

type Role = "super_admin" | "admin" | "delivery";
const ROLES: Role[] = ["super_admin", "admin", "delivery"];

function UsersPage() {
  const qc = useQueryClient();
  const { isSuperAdmin } = useAuth();
  

  const [form, setForm] = useState({ full_name: "", phone: "", password: "", role: "admin" as "admin" | "delivery" });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-with-roles"],
    queryFn: async () => {
      const [{ data: ps }, { data: rs }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (ps ?? []).map((p) => ({
        ...p,
        roles: (rs ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Role),
      }));
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ userId, role, has }: { userId: string; role: Role; has: boolean }) => {
      if (has) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profiles-with-roles"] }); toast.success("Role updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-admin-user", { body: form });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("User created");
      setForm({ full_name: "", phone: "", password: "", role: "admin" });
      qc.invalidateQueries({ queryKey: ["profiles-with-roles"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create user"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Roles & Permissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSuperAdmin ? "Create users and manage roles." : "Only super admins can change roles."}
        </p>
      </div>

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Create user</CardTitle>
            <CardDescription>Add an admin or delivery account with mobile number + password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-5"
              onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
            >
              <div className="space-y-1.5 md:col-span-1">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" value={form.full_name} required onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-1.5 md:col-span-1">
                <Label htmlFor="phone">Mobile (with country code)</Label>
                <Input id="phone" placeholder="+919876543210" value={form.phone} required onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5 md:col-span-1">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" minLength={6} value={form.password} required onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="space-y-1.5 md:col-span-1">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "admin" | "delivery" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end md:col-span-1">
                <Button type="submit" className="w-full" disabled={create.isPending}>
                  {create.isPending ? "Creating…" : "Create user"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Phone / Email</TableHead>
              <TableHead>Roles</TableHead>
              {isSuperAdmin && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No users yet.</TableCell></TableRow>
            )}
            {profiles.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.phone ?? p.email ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {p.roles.length === 0 && <span className="text-xs text-muted-foreground">none</span>}
                    {p.roles.map((r) => (
                      <Badge key={r} variant={r === "super_admin" ? "default" : "secondary"}>{r}</Badge>
                    ))}
                  </div>
                </TableCell>
                {isSuperAdmin && (
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {ROLES.map((r) => {
                        const has = p.roles.includes(r);
                        return (
                          <Button
                            key={r}
                            size="sm"
                            variant={has ? "default" : "outline"}
                            onClick={() => toggle.mutate({ userId: p.id, role: r, has })}
                          >
                            {has ? "−" : "+"} {r}
                          </Button>
                        );
                      })}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
