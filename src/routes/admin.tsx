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
import { Users, Wallet, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

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
      </Tabs>
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
