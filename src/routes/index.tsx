import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Beef,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Line,
  LineChart,
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
  head: () => ({ meta: [{ title: "Painel — AgroGestor" }] }),
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATE_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

const PRODUCT_EMOJI: Record<string, string> = {
  "Boi Gordo": "🐂", "Vaca Gorda": "🐄", "Bezerro": "🐃", "Leite": "🥛",
  "Soja": "🌱", "Milho": "🌽", "Café": "☕", "Arroz": "🍚", "Trigo": "🌾",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function VarChip({ value, label }: { value: number; label: string }) {
  const up = value > 0.05, down = value < -0.05;
  const cls = up ? "text-success" : down ? "text-destructive" : "text-muted-foreground";
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${cls}`}>
      <Icon className="h-3 w-3" />
      {value > 0 ? "+" : ""}{value.toFixed(2)}% <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("dashboard-sales")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "sales", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["dashboard"] });
          qc.invalidateQueries({ queryKey: ["sales"] });
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "animals", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["dashboard"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", user?.id],
    enabled: !!user,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    queryFn: async () => {
      const start = new Date(); start.setDate(1);
      const startIso = start.toISOString().slice(0, 10);

      const [salesRes, animalsRes, statePricesRes, recentRes] = await Promise.all([
        supabase.from("sales").select("*").gte("sale_date", startIso),
        supabase.from("animals").select("id,status,type"),
        supabase.from("market_prices_states").select("*"),
        supabase.from("sales").select("*").order("sale_date", { ascending: false }).limit(5),
      ]);

      const monthSales = salesRes.data ?? [];
      const revenue = monthSales.reduce((s, r) => s + Number(r.total ?? 0), 0);
      const animalsSold = monthSales.filter((r) => r.category === "animal").reduce((s, r) => s + Number(r.quantity ?? 0), 0);
      const grainsSold = monthSales.filter((r) => r.category === "grao").reduce((s, r) => s + Number(r.quantity ?? 0), 0);

      const byDay = new Map<string, number>();
      monthSales.forEach((r) => byDay.set(r.sale_date, (byDay.get(r.sale_date) ?? 0) + Number(r.total)));
      const chart = Array.from(byDay.entries()).sort().map(([date, total]) => ({
        date: date.slice(8, 10) + "/" + date.slice(5, 7), total,
      }));

      // Group prices by product → reference state (highest volume = lowest variability proxy: just pick MG/SP/PR by priority)
      type Row = typeof statePricesRes.data extends (infer T)[] | null ? T : never;
      const byProduct = new Map<string, Row[]>();
      for (const r of statePricesRes.data ?? []) {
        const arr = byProduct.get(r.product) ?? [];
        arr.push(r);
        byProduct.set(r.product, arr);
      }
      const priorityStates = ["MG", "SP", "PR", "MT", "MS", "GO", "RS"];
      const products = Array.from(byProduct.entries()).map(([product, rows]) => {
        const avg = rows.reduce((a, b) => a + Number(b.price), 0) / rows.length;
        const ref = priorityStates.map((s) => rows.find((r) => r.state === s)).find(Boolean) ?? rows[0];
        const varDay = rows.reduce((a, b) => a + Number(b.variation_day), 0) / rows.length;
        const varWeek = rows.reduce((a, b) => a + Number(b.variation_week), 0) / rows.length;
        return {
          product, unit: rows[0].unit, avg, refPrice: Number(ref.price),
          refState: ref.state, varDay, varWeek,
          updatedAt: ref.updated_at as string,
        };
      });

      return {
        revenue, animalsSold, grainsSold,
        herd: animalsRes.data?.length ?? 0,
        products, chart, recent: recentRes.data ?? [],
      };
    },
  });

  const featured = useMemo(() => {
    const prods = data?.products ?? [];
    const preferred = ["Boi Gordo", "Vaca Gorda", "Bezerro", "Leite", "Soja", "Milho", "Café"];
    const ordered = preferred.map((n) => prods.find((p) => p.product === n)).filter(Boolean) as typeof prods;
    const rest = prods.filter((p) => !preferred.includes(p.product));
    return [...ordered, ...rest].slice(0, 6);
  }, [data?.products]);

  const ranking = useMemo(() => {
    const sorted = [...(data?.products ?? [])].sort((a, b) => b.varDay - a.varDay);
    return {
      altas: sorted.filter((p) => p.varDay > 0).slice(0, 5),
      quedas: sorted.filter((p) => p.varDay < 0).slice(-5).reverse(),
    };
  }, [data?.products]);

  // 7-day mini history for sparklines (all products at once)
  const { data: history7 } = useQuery({
    queryKey: ["dashboard_history7"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const from = new Date(); from.setDate(from.getDate() - 7);
      const { data } = await supabase
        .from("market_price_history")
        .select("product,price,reference_date")
        .gte("reference_date", from.toISOString().slice(0, 10))
        .order("reference_date");
      const map = new Map<string, { d: string; v: number; n: number }[]>();
      for (const r of data ?? []) {
        const arr = map.get(r.product) ?? [];
        const last = arr[arr.length - 1];
        if (last && last.d === r.reference_date) {
          last.v += Number(r.price); last.n++;
        } else {
          arr.push({ d: r.reference_date, v: Number(r.price), n: 1 });
        }
        map.set(r.product, arr);
      }
      const out: Record<string, { date: string; price: number }[]> = {};
      for (const [k, arr] of map) {
        out[k] = arr.map((p) => ({ date: p.d.slice(8, 10), price: p.v / p.n }));
      }
      return out;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bom dia, produtor 👋</h1>
        <p className="text-sm text-muted-foreground">Resumo da sua fazenda neste mês.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi to="/relatorios" search={{ tipo: "faturamento" }} icon={<DollarSign className="h-5 w-5" />} label="Faturamento do mês" value={brl(data?.revenue ?? 0)} tone="primary" />
        <Kpi to="/relatorios" search={{ tipo: "animais" }} icon={<Beef className="h-5 w-5" />} label="Animais vendidos" value={String(data?.animalsSold ?? 0)} tone="earth" />
        <Kpi to="/relatorios" search={{ tipo: "graos" }} icon={<Receipt className="h-5 w-5" />} label="Sacas vendidas" value={String(data?.grainsSold ?? 0)} tone="secondary" />
        <Kpi to="/animais" icon={<TrendingUp className="h-5 w-5" />} label="Rebanho atual" value={String(data?.herd ?? 0)} tone="success" />
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Vendas do mês</CardTitle>
          <Link to="/relatorios" className="text-sm font-medium text-primary hover:underline">Ver relatório</Link>
        </CardHeader>
        <CardContent className="h-64">
          {isLoading ? <div className="h-full animate-pulse rounded-md bg-muted" />
            : (data?.chart.length ?? 0) === 0 ? <Empty title="Nenhuma venda registrada" hint="Registre uma venda para ver gráficos." cta={{ to: "/vendas", label: "Registrar venda" }} />
            : <ResponsiveContainer width="100%" height="100%">
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
                <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="total" stroke="var(--primary)" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>}
        </CardContent>
      </Card>

      {/* Preços de mercado — cards reformulados */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Preços de mercado</CardTitle>
          <Link to="/precos" className="text-sm font-medium text-primary hover:underline">Ver todos</Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />)}
            </div>
          ) : featured.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem cotações disponíveis.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p) => {
                const spark = history7?.[p.product] ?? [];
                return (
                  <button
                    key={p.product}
                    onClick={() => navigate({ to: "/precos", search: { product: p.product } })}
                    className="group text-left"
                  >
                    <Card className="h-full rounded-xl border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-lg">
                              {PRODUCT_EMOJI[p.product] ?? "📈"}
                            </span>
                            <div>
                              <div className="font-semibold leading-tight">{p.product}</div>
                              <div className="text-[11px] text-muted-foreground">Ref: {STATE_NAMES[p.refState] ?? p.refState}</div>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </div>

                        <div className="mt-3 flex items-baseline gap-1">
                          <span className="text-2xl font-bold">{brl(p.refPrice)}</span>
                          <span className="text-xs text-muted-foreground">/{p.unit}</span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <VarChip value={p.varDay} label="hoje" />
                          <VarChip value={p.varWeek} label="7d" />
                        </div>

                        {spark.length > 1 && (
                          <div className="mt-2 h-10">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={spark}>
                                <Line
                                  type="monotone"
                                  dataKey="price"
                                  stroke={p.varWeek >= 0 ? "var(--success)" : "var(--destructive)"}
                                  strokeWidth={1.5}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Atualizado {timeAgo(p.updatedAt)}
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ranking — altas e quedas do dia */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-success" /> Top altas do dia
            </CardTitle>
            <Badge variant="secondary">{ranking.altas.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-1">
            {ranking.altas.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Sem altas hoje.</p>
            ) : ranking.altas.map((p) => (
              <button key={p.product} onClick={() => navigate({ to: "/precos", search: { product: p.product } })}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-accent">
                <span className="flex items-center gap-2">
                  <span>{PRODUCT_EMOJI[p.product] ?? "📈"}</span>{p.product}
                </span>
                <span className="font-semibold text-success">+{p.varDay.toFixed(2)}%</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-destructive" /> Maiores quedas
            </CardTitle>
            <Badge variant="secondary">{ranking.quedas.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-1">
            {ranking.quedas.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Sem quedas hoje.</p>
            ) : ranking.quedas.map((p) => (
              <button key={p.product} onClick={() => navigate({ to: "/precos", search: { product: p.product } })}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-accent">
                <span className="flex items-center gap-2">
                  <span>{PRODUCT_EMOJI[p.product] ?? "📉"}</span>{p.product}
                </span>
                <span className="font-semibold text-destructive">{p.varDay.toFixed(2)}%</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Últimas vendas */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Últimas vendas</CardTitle>
          <Link to="/vendas" className="text-sm font-medium text-primary hover:underline">Ver todas</Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.recent ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma venda ainda.</p>
          ) : (data?.recent ?? []).map((s) => (
            <Link key={s.id} to="/vendas"
              className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-accent/50">
              <div>
                <div className="font-medium">{s.item}</div>
                <div className="text-xs text-muted-foreground">
                  {Number(s.quantity)} {s.unit || "un"} • {new Date(s.sale_date).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-primary">{brl(Number(s.total))}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon, label, value, tone, to, search,
}: {
  icon: React.ReactNode; label: string; value: string;
  tone: "primary" | "earth" | "secondary" | "success";
  to: string; search?: Record<string, string>;
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

function Empty({ title, hint, cta }: { title: string; hint: string; cta: { to: string; label: string } }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <AlertCircle className="h-8 w-8 text-muted-foreground" />
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{hint}</div>
      <Link to={cta.to as never} className="mt-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
        {cta.label}
      </Link>
    </div>
  );
}
