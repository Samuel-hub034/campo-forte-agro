import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Beef,
  TrendingUp,
  DollarSign,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <Dashboard />
      </AppShell>
    </RequireAuth>
  ),
  head: () => ({
    meta: [{ title: "Painel — AgroGestor" }],
  }),
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Realtime: invalidate dashboard when sales change
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("dashboard-sales")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["dashboard"] });
          qc.invalidateQueries({ queryKey: ["sales"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "animals", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["dashboard"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", user?.id],
    enabled: !!user,
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async () => {
      const start = new Date();
      start.setDate(1);
      const startIso = start.toISOString().slice(0, 10);

      const [salesRes, animalsRes, pricesRes, recentRes] = await Promise.all([
        supabase.from("sales").select("*").gte("sale_date", startIso),
        supabase.from("animals").select("id,status,type"),
        supabase
          .from("market_prices")
          .select("*")
          .order("reference_date", { ascending: false })
          .limit(5),
        supabase
          .from("sales")
          .select("*")
          .order("sale_date", { ascending: false })
          .limit(5),
      ]);

      const monthSales = salesRes.data ?? [];
      const revenue = monthSales.reduce((s, r) => s + Number(r.total ?? 0), 0);
      const animalsSold = monthSales
        .filter((r) => r.category === "animal")
        .reduce((s, r) => s + Number(r.quantity ?? 0), 0);
      const grainsSold = monthSales
        .filter((r) => r.category === "grao")
        .reduce((s, r) => s + Number(r.quantity ?? 0), 0);

      const byDay = new Map<string, number>();
      monthSales.forEach((r) => {
        byDay.set(r.sale_date, (byDay.get(r.sale_date) ?? 0) + Number(r.total));
      });
      const chart = Array.from(byDay.entries())
        .sort()
        .map(([date, total]) => ({
          date: date.slice(8, 10) + "/" + date.slice(5, 7),
          total,
        }));

      return {
        revenue,
        animalsSold,
        grainsSold,
        herd: animalsRes.data?.length ?? 0,
        prices: pricesRes.data ?? [],
        chart,
        recent: recentRes.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bom dia, produtor 👋</h1>
        <p className="text-sm text-muted-foreground">
          Resumo da sua fazenda neste mês.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          to="/relatorios"
          search={{ tipo: "faturamento" }}
          icon={<DollarSign className="h-5 w-5" />}
          label="Faturamento do mês"
          value={brl(data?.revenue ?? 0)}
          tone="primary"
        />
        <Kpi
          to="/relatorios"
          search={{ tipo: "animais" }}
          icon={<Beef className="h-5 w-5" />}
          label="Animais vendidos"
          value={String(data?.animalsSold ?? 0)}
          tone="earth"
        />
        <Kpi
          to="/relatorios"
          search={{ tipo: "graos" }}
          icon={<Receipt className="h-5 w-5" />}
          label="Sacas vendidas"
          value={String(data?.grainsSold ?? 0)}
          tone="secondary"
        />
        <Kpi
          to="/animais"
          icon={<TrendingUp className="h-5 w-5" />}
          label="Rebanho atual"
          value={String(data?.herd ?? 0)}
          tone="success"
        />
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Vendas do mês</CardTitle>
          <Link
            to="/relatorios"
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver relatório
          </Link>
        </CardHeader>
        <CardContent className="h-64">
          {isLoading ? (
            <div className="h-full animate-pulse rounded-md bg-muted" />
          ) : (data?.chart.length ?? 0) === 0 ? (
            <Empty
              title="Nenhuma venda registrada"
              hint="Registre uma venda para ver gráficos."
              cta={{ to: "/vendas", label: "Registrar venda" }}
            />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data!.chart}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v: number) => brl(v)}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--primary)"
                  fill="url(#g1)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Últimas vendas */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Últimas vendas</CardTitle>
          <Link to="/vendas" className="text-sm font-medium text-primary hover:underline">
            Ver todas
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.recent ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma venda ainda.
            </p>
          ) : (
            (data?.recent ?? []).map((s) => (
              <Link
                key={s.id}
                to="/vendas"
                className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
              >
                <div>
                  <div className="font-medium">{s.item}</div>
                  <div className="text-xs text-muted-foreground">
                    {Number(s.quantity)} {s.unit || "un"} •{" "}
                    {new Date(s.sale_date).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-primary">
                    {brl(Number(s.total))}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Preços de mercado</CardTitle>
          <Link to="/precos" className="text-sm font-medium text-primary hover:underline">
            Ver todos
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.prices ?? []).map((p) => {
            const up = Number(p.variation) >= 0;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <div className="font-medium">{p.product}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.region} • {p.unit}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{brl(Number(p.price))}</div>
                  <div
                    className={`flex items-center justify-end gap-1 text-xs ${up ? "text-success" : "text-destructive"}`}
                  >
                    {up ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(Number(p.variation)).toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
  to,
  search,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "primary" | "earth" | "secondary" | "success";
  to: string;
  search?: Record<string, string>;
}) {
  const map = {
    primary: "bg-primary/10 text-primary",
    earth: "bg-earth/10 text-earth",
    secondary: "bg-secondary text-secondary-foreground",
    success: "bg-success/10 text-success",
  } as const;
  return (
    <Link to={to as never} search={search as never}>
      <Card className="rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0">
        <CardContent className="p-4">
          <div className={`mb-2 inline-flex rounded-lg p-2 ${map[tone]}`}>{icon}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-bold leading-tight">{value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Empty({
  title,
  hint,
  cta,
}: {
  title: string;
  hint: string;
  cta: { to: string; label: string };
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <AlertCircle className="h-8 w-8 text-muted-foreground" />
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{hint}</div>
      <Link
        to={cta.to as never}
        className="mt-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
      >
        {cta.label}
      </Link>
    </div>
  );
}
