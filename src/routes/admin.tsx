import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Users, Wallet, ShieldAlert, CheckCircle2, Sparkles, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge as Pill } from "@/components/ui/badge";

export const Route = createFileRoute("/admin")({
  component: () => (
    <RequireAuth requireAdmin allowWithoutSubscription>
      <AppShell>
        <AdminPage />
      </AppShell>
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Administração — AgroGestor" }] }),
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function AdminPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [subs, payments, profiles, roles] = await Promise.all([
        supabase.from("subscriptions").select("*").order("updated_at", { ascending: false }),
        supabase.from("payments").select("*").order("paid_at", { ascending: false }).limit(50),
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
      ]);
      return {
        subs: subs.data ?? [],
        payments: payments.data ?? [],
        profiles: profiles.data ?? [],
        roles: roles.data ?? [],
      };
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Assinatura atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    const subs = data?.subs ?? [];
    const active = subs.filter((s) => s.status === "ativa").length;
    const overdue = subs.filter((s) =>
      ["vencida", "atrasada"].includes(s.status)
    ).length;
    const pending = subs.filter((s) => s.status === "pendente").length;
    const revenue = (data?.payments ?? []).reduce(
      (sum, p) => sum + Number(p.amount ?? 0),
      0
    );
    return { total: subs.length, active, overdue, pending, revenue };
  }, [data]);

  const profileMap = useMemo(() => {
    const m = new Map<string, { full_name: string | null }>();
    (data?.profiles ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [data]);

  const filteredSubs = (data?.subs ?? []).filter((s) => {
    if (!search.trim()) return true;
    const name = profileMap.get(s.user_id)?.full_name ?? "";
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      s.user_id.includes(search)
    );
  });

  return (
    <div>
      <PageHeader
        title="Painel administrativo"
        subtitle="Gerencie usuários, assinaturas e pagamentos"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<Users className="h-4 w-4" />} label="Usuários" value={String(stats.total)} />
        <Stat
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Assinaturas ativas"
          value={String(stats.active)}
          tone="success"
        />
        <Stat
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Inadimplentes"
          value={String(stats.overdue + stats.pending)}
          tone="destructive"
        />
        <Stat
          icon={<Wallet className="h-4 w-4" />}
          label="Recebido"
          value={brl(stats.revenue)}
          tone="primary"
        />
      </div>

      <Tabs defaultValue="subs" className="mt-6">
        <TabsList>
          <TabsTrigger value="subs">Assinaturas</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          <TabsTrigger value="promos">Promoções</TabsTrigger>
        </TabsList>

        <TabsContent value="subs" className="space-y-3 pt-4">
          <Input
            placeholder="Buscar por nome ou ID..."
            className="h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isLoading ? (
            <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          ) : filteredSubs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum usuário encontrado.
            </p>
          ) : (
            filteredSubs.map((s) => {
              const profile = profileMap.get(s.user_id);
              const expired =
                s.expires_at && new Date(s.expires_at).getTime() < Date.now();
              const displayStatus = expired && s.status === "ativa" ? "vencida" : s.status;
              return (
                <Card key={s.id} className="rounded-2xl">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold">
                        {profile?.full_name || "Sem nome"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: {s.user_id.slice(0, 8)}…
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <Badge
                          variant={
                            displayStatus === "ativa"
                              ? "default"
                              : displayStatus === "pendente"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {displayStatus}
                        </Badge>
                        <span className="text-muted-foreground">
                          {brl(Number(s.amount))} / mês
                        </span>
                        {s.expires_at && (
                          <span className="text-muted-foreground">
                            • vence {new Date(s.expires_at).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setStatus.mutate({ id: s.id, status: "ativa" })
                        }
                      >
                        Ativar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setStatus.mutate({ id: s.id, status: "vencida" })
                        }
                      >
                        Vencer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="payments" className="space-y-3 pt-4">
          {(data?.payments ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum pagamento registrado.
            </p>
          ) : (
            (data?.payments ?? []).map((p) => (
              <Card key={p.id} className="rounded-2xl">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-semibold">
                      {profileMap.get(p.user_id)?.full_name || p.user_id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.paid_at).toLocaleString("pt-BR")} • {p.method}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary">
                      {brl(Number(p.amount))}
                    </div>
                    <Badge variant="secondary">{p.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="promos" className="space-y-3 pt-4">
          <PromotionsAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type PromoRow = {
  id: string;
  name: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  plans: string[];
  starts_at: string;
  ends_at: string;
  active: boolean;
};

function PromotionsAdmin() {
  const qc = useQueryClient();
  const { data: promos, isLoading } = useQuery({
    queryKey: ["promotions-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PromoRow[];
    },
  });

  const [name, setName] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [plans, setPlans] = useState<string[]>(["mensal", "trimestral", "anual"]);

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome");
      const v = Number(value);
      if (!v || v <= 0) throw new Error("Desconto inválido");
      if (type === "percent" && v > 100) throw new Error("Percentual máx. 100%");
      if (!endsAt) throw new Error("Defina a data de término");
      if (plans.length === 0) throw new Error("Escolha ao menos um plano");
      const { error } = await supabase.from("promotions").insert({
        name: name.trim(),
        discount_type: type,
        discount_value: v,
        plans,
        ends_at: new Date(endsAt).toISOString(),
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions-admin"] });
      qc.invalidateQueries({ queryKey: ["promotions-active"] });
      setName(""); setValue(""); setEndsAt("");
      toast.success("Promoção criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("promotions").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions-admin"] });
      qc.invalidateQueries({ queryKey: ["promotions-active"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions-admin"] });
      qc.invalidateQueries({ queryKey: ["promotions-active"] });
      toast.success("Promoção removida");
    },
  });

  const togglePlan = (p: string) =>
    setPlans((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-primary/30">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Nova promoção
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Black Friday" maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as "percent" | "fixed")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{type === "percent" ? "Desconto (%)" : "Desconto (R$)"}</Label>
              <Input type="number" min="1" max={type === "percent" ? "100" : undefined} value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Válido até</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Planos participantes</Label>
            <div className="flex flex-wrap gap-3">
              {["mensal", "trimestral", "anual"].map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm capitalize">
                  <Checkbox checked={plans.includes(p)} onCheckedChange={() => togglePlan(p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Criar promoção
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      ) : (promos ?? []).length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma promoção cadastrada.</p>
      ) : (
        (promos ?? []).map((p) => {
          const expired = new Date(p.ends_at).getTime() < Date.now();
          return (
            <Card key={p.id} className="rounded-2xl">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    {expired && <Pill variant="destructive">Expirada</Pill>}
                    {!p.active && !expired && <Pill variant="secondary">Inativa</Pill>}
                    {p.active && !expired && <Pill>Ativa</Pill>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {p.discount_type === "percent" ? `${p.discount_value}% OFF` : `${brl(Number(p.discount_value))} OFF`}
                    {" • "}até {new Date(p.ends_at).toLocaleString("pt-BR")}
                    {" • "}planos: {p.plans.join(", ")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={p.active} onCheckedChange={(v) => toggle.mutate({ id: p.id, active: v })} />
                    <span className="text-xs text-muted-foreground">Ativa</span>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "success" | "destructive" | "primary";
}) {
  const map = {
    default: "bg-muted text-foreground",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    primary: "bg-primary/10 text-primary",
  } as const;
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className={`mb-2 inline-flex rounded-lg p-2 ${map[tone]}`}>{icon}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
