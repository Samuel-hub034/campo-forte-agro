import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download, FileBarChart, CalendarIcon, TrendingUp,
  Beef, Milk, Stethoscope, DollarSign, Sparkles, RefreshCw,
  Users, Trophy, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { generateFarmInsights } from "@/lib/insights.functions";

const searchSchema = z.object({
  tipo: z.enum(["faturamento", "animais", "graos", "todos", "executivo", "rebanho", "sanitario", "leite", "ia"]).optional().default("executivo"),
});

export const Route = createFileRoute("/relatorios")({
  validateSearch: zodValidator(searchSchema),
  component: () => (
    <RequireAuth>
      <AppShell>
        <Reports />
      </AppShell>
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Relatórios — AgroGestor" }] }),
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: number) => v.toLocaleString("pt-BR");

const CATEGORY_COLORS: Record<string, string> = {
  animal: "var(--primary)",
  grao: "var(--earth)",
  leite: "#3b82f6",
  insumo: "#a855f7",
  outro: "#64748b",
};
const CATEGORY_LABELS: Record<string, string> = {
  animal: "Animais", grao: "Grãos", leite: "Leite", insumo: "Insumos", outro: "Outros",
};

function isoToDate(iso: string) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, (m ?? 1) - 1, d ?? 1); }
function dateToIso(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function fmtBr(iso: string) { if (!iso) return "Selecionar"; return isoToDate(iso).toLocaleDateString("pt-BR"); }
function firstOfMonthIso(d = new Date()) { const x = new Date(d.getFullYear(), d.getMonth(), 1); return dateToIso(x); }
function todayIso() { return dateToIso(new Date()); }

const MIN_DATE = new Date("2000-01-01");
const MAX_DATE = new Date(); MAX_DATE.setFullYear(MAX_DATE.getFullYear() + 1);

function DateField({ value, onChange, label }: { value: string; onChange: (iso: string) => void; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("h-11 w-full justify-start font-normal", !value && "text-muted-foreground")} aria-label={label}>
          <CalendarIcon className="mr-2 h-4 w-4" />{fmtBr(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value ? isoToDate(value) : undefined}
          onSelect={(d) => d && onChange(dateToIso(d))}
          disabled={(d) => d < MIN_DATE || d > MAX_DATE}
          defaultMonth={value ? isoToDate(value) : new Date()}
          initialFocus className={cn("p-3 pointer-events-auto")} />
      </PopoverContent>
    </Popover>
  );
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null || !isFinite(value)) return <span className="text-xs text-muted-foreground">—</span>;
  const up = value > 0.05, down = value < -0.05;
  const cls = up ? "text-success" : down ? "text-destructive" : "text-muted-foreground";
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />{value > 0 ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

function KpiCard({ icon, label, value, hint, delta, accent = "primary" }: {
  icon: React.ReactNode; label: string; value: string; hint?: string; delta?: number | null;
  accent?: "primary" | "earth" | "success" | "secondary" | "destructive";
}) {
  const accentCls = {
    primary: "bg-primary/10 text-primary",
    earth: "bg-earth/10 text-earth",
    success: "bg-success/10 text-success",
    secondary: "bg-secondary text-secondary-foreground",
    destructive: "bg-destructive/10 text-destructive",
  }[accent];
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={`inline-flex rounded-lg p-2 ${accentCls}`}>{icon}</div>
          {delta !== undefined && <DeltaBadge value={delta ?? null} />}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold leading-tight">{value}</div>
        {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Reports() {
  const { tipo } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(todayIso());

  // Map old tipo values to new tabs
  const initialTab = ["faturamento", "animais", "graos", "todos"].includes(tipo) ? "executivo" : tipo;
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Centro de Inteligência"
        subtitle="Visão executiva da sua propriedade rural"
        right={<FileBarChart className="h-8 w-8 text-primary" />}
      />

      {/* Date filters always visible */}
      <Card className="rounded-2xl">
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <DateField label="Data inicial" value={from} onChange={setFrom} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <DateField label="Data final" value={to} onChange={setTo} />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setFrom(firstOfMonthIso()); setTo(todayIso()); }}>Este mês</Button>
            <Button variant="outline" size="sm" onClick={() => {
              const d = new Date(); d.setDate(d.getDate() - 30);
              setFrom(dateToIso(d)); setTo(todayIso());
            }}>30 dias</Button>
            <Button variant="outline" size="sm" onClick={() => {
              const d = new Date(); d.setFullYear(d.getFullYear(), 0, 1);
              setFrom(dateToIso(d)); setTo(todayIso());
            }}>Ano</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); navigate({ search: { tipo: v as never } }); }}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5">
          <TabsTrigger value="executivo"><TrendingUp className="mr-1 h-3.5 w-3.5" />Executivo</TabsTrigger>
          <TabsTrigger value="rebanho"><Beef className="mr-1 h-3.5 w-3.5" />Rebanho</TabsTrigger>
          <TabsTrigger value="leite"><Milk className="mr-1 h-3.5 w-3.5" />Leite</TabsTrigger>
          <TabsTrigger value="sanitario"><Stethoscope className="mr-1 h-3.5 w-3.5" />Sanitário</TabsTrigger>
          <TabsTrigger value="ia"><Sparkles className="mr-1 h-3.5 w-3.5" />Análise IA</TabsTrigger>
        </TabsList>

        <TabsContent value="executivo" className="mt-4 space-y-4">
          <ExecutiveTab from={from} to={to} />
        </TabsContent>
        <TabsContent value="rebanho" className="mt-4 space-y-4">
          <HerdTab from={from} to={to} />
        </TabsContent>
        <TabsContent value="leite" className="mt-4 space-y-4">
          <MilkTab from={from} to={to} />
        </TabsContent>
        <TabsContent value="sanitario" className="mt-4 space-y-4">
          <HealthTab from={from} to={to} />
        </TabsContent>
        <TabsContent value="ia" className="mt-4 space-y-4">
          <InsightsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* =================== EXECUTIVO =================== */

function ExecutiveTab({ from, to }: { from: string; to: string }) {
  const { user } = useAuth();

  // Period sales
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["report_sales", user?.id, from, to],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*")
        .gte("sale_date", from).lte("sale_date", to).order("sale_date");
      if (error) throw error;
      return data;
    },
  });

  // Previous-period comparison (same length, immediately before)
  const { data: prevSales = [] } = useQuery({
    queryKey: ["report_sales_prev", user?.id, from, to],
    enabled: !!user,
    queryFn: async () => {
      const f = isoToDate(from), t = isoToDate(to);
      const days = Math.max(1, Math.round((t.getTime() - f.getTime()) / 86400000) + 1);
      const prevTo = new Date(f); prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - days + 1);
      const { data } = await supabase.from("sales").select("total,quantity,category,sale_date")
        .gte("sale_date", dateToIso(prevFrom)).lte("sale_date", dateToIso(prevTo));
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const revenue = sales.reduce((s, r) => s + Number(r.total ?? 0), 0);
    const count = sales.length;
    const avg = count > 0 ? revenue / count : 0;
    const prevRevenue = prevSales.reduce((s, r) => s + Number(r.total ?? 0), 0);
    const prevCount = prevSales.length;
    const growth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;
    const countDelta = prevCount > 0 ? ((count - prevCount) / prevCount) * 100 : null;
    return { revenue, count, avg, prevRevenue, growth, countDelta };
  }, [sales, prevSales]);

  // Monthly trend
  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sales) {
      const k = s.sale_date.slice(0, 7);
      map.set(k, (map.get(k) ?? 0) + Number(s.total));
    }
    return Array.from(map.entries()).sort().map(([k, v]) => ({
      mes: k.slice(5) + "/" + k.slice(2, 4), total: v,
    }));
  }, [sales]);

  // By category
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sales) map.set(s.category, (map.get(s.category) ?? 0) + Number(s.total));
    return Array.from(map.entries()).map(([k, v]) => ({
      name: CATEGORY_LABELS[k] ?? k, value: v, key: k,
    }));
  }, [sales]);

  // Top buyers
  const topBuyers = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const s of sales) {
      const b = s.buyer?.trim() || "—";
      const cur = map.get(b) ?? { count: 0, total: 0 };
      cur.count++; cur.total += Number(s.total);
      map.set(b, cur);
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total).slice(0, 5);
  }, [sales]);

  // Top products
  const topProducts = useMemo(() => {
    const map = new Map<string, { qty: number; total: number; cat: string }>();
    for (const s of sales) {
      const cur = map.get(s.item) ?? { qty: 0, total: 0, cat: s.category };
      cur.qty += Number(s.quantity); cur.total += Number(s.total);
      map.set(s.item, cur);
    }
    return Array.from(map.entries()).map(([item, v]) => ({ item, ...v }))
      .sort((a, b) => b.total - a.total).slice(0, 5);
  }, [sales]);

  const exportCsv = () => {
    const header = ["Data", "Categoria", "Item", "Quantidade", "Unidade", "Preço unit.", "Total", "Comprador"];
    const rows = sales.map((s) => [s.sale_date, s.category, s.item, String(s.quantity), s.unit ?? "", String(s.unit_price), String(s.total), s.buyer ?? ""]);
    const csv = [header, ...rows].map((row) => row.map((c) => {
      const x = String(c).replace(/"/g, '""');
      return /[",;\n]/.test(x) ? `"${x}"` : x;
    }).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio_${from}_a_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Faturamento" value={brl(stats.revenue)} delta={stats.growth} hint={`Anterior: ${brl(stats.prevRevenue)}`} accent="primary" />
        <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Vendas" value={num(stats.count)} delta={stats.countDelta} accent="success" />
        <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Ticket médio" value={brl(stats.avg)} accent="earth" />
        <KpiCard icon={<Trophy className="h-5 w-5" />} label="Top comprador" value={topBuyers[0]?.name ?? "—"} hint={topBuyers[0] ? brl(topBuyers[0].total) : ""} accent="secondary" />
      </div>

      {/* Evolução financeira */}
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Evolução do faturamento</CardTitle></CardHeader>
        <CardContent className="h-64">
          {monthly.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => "R$" + (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="total" stroke="var(--primary)" fill="url(#ge)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Por categoria */}
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Vendas por categoria</CardTitle></CardHeader>
          <CardContent className="h-64">
            {byCategory.length === 0 ? <p className="text-center text-sm text-muted-foreground">Sem dados</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {byCategory.map((e) => <Cell key={e.name} fill={CATEGORY_COLORS[e.key] ?? "#94a3b8"} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top compradores */}
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Top compradores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topBuyers.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum comprador no período.</p> :
              topBuyers.map((b, i) => (
                <div key={b.name} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{i + 1}º</Badge>
                    <div>
                      <div className="text-sm font-medium">{b.name}</div>
                      <div className="text-xs text-muted-foreground">{b.count} compra(s)</div>
                    </div>
                  </div>
                  <div className="font-semibold text-primary">{brl(b.total)}</div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* Top produtos */}
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Produtos mais vendidos</CardTitle></CardHeader>
        <CardContent>
          {topProducts.length === 0 ? <p className="text-sm text-muted-foreground">Sem produtos no período.</p> : (
            <div className="space-y-1.5">
              {topProducts.map((p, i) => {
                const max = topProducts[0].total;
                const pct = (p.total / max) * 100;
                return (
                  <div key={p.item} className="rounded-lg border p-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2"><Badge variant="outline">{i + 1}º</Badge><span className="font-medium">{p.item}</span></span>
                      <span className="font-semibold">{brl(p.total)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{num(p.qty)} unidades • {CATEGORY_LABELS[p.cat] ?? p.cat}</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={exportCsv} disabled={sales.length === 0}>
          <Download className="h-4 w-4" />Exportar Excel/CSV
        </Button>
        <Button variant="outline" onClick={() => window.print()} disabled={sales.length === 0}>
          <Download className="h-4 w-4" />Imprimir / PDF
        </Button>
      </div>
    </div>
  );
}

/* =================== REBANHO =================== */

function HerdTab({ from, to }: { from: string; to: string }) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["report_herd", user?.id, from, to],
    enabled: !!user,
    queryFn: async () => {
      const [animalsRes, eventsRes, salesRes] = await Promise.all([
        supabase.from("animals").select("*"),
        supabase.from("animal_events").select("*").gte("event_date", from).lte("event_date", to),
        supabase.from("sales").select("*").eq("category", "animal").gte("sale_date", from).lte("sale_date", to),
      ]);
      return { animals: animalsRes.data ?? [], events: eventsRes.data ?? [], sales: salesRes.data ?? [] };
    },
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const alive = data.animals.filter((a) => a.status === "ativo").length;
    const dead = data.animals.filter((a) => a.status === "morto").length;
    const sold = data.sales.reduce((s, r) => s + Number(r.quantity), 0);
    const weights = data.events
      .filter((e) => e.event_type === "pesagem" && (e.data as any)?.weight_kg)
      .map((e) => Number((e.data as any).weight_kg));
    const avgWeight = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : 0;
    const births = data.events.filter((e) => e.event_type === "reproducao").length;
    const deaths = data.events.filter((e) => e.event_type === "mortalidade").length;

    const byBreed = new Map<string, number>();
    const byType = new Map<string, number>();
    for (const a of data.animals.filter((x) => x.status === "ativo")) {
      if (a.breed) byBreed.set(a.breed, (byBreed.get(a.breed) ?? 0) + 1);
      byType.set(a.type, (byType.get(a.type) ?? 0) + 1);
    }
    return {
      alive, dead, sold, avgWeight, births, deaths,
      breeds: Array.from(byBreed.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      types: Array.from(byType.entries()).map(([name, value]) => ({ name, value })),
    };
  }, [data]);

  if (isLoading || !stats) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={<Beef className="h-5 w-5" />} label="Rebanho ativo" value={num(stats.alive)} accent="success" />
        <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Peso médio" value={`${stats.avgWeight.toFixed(0)} kg`} accent="earth" />
        <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Vendidos no período" value={num(stats.sold)} accent="primary" />
        <KpiCard icon={<Sparkles className="h-5 w-5" />} label="Nascimentos / mortes" value={`${stats.births} / ${stats.deaths}`} accent="secondary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Por raça</CardTitle></CardHeader>
          <CardContent className="h-64">
            {stats.breeds.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.breeds.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Por espécie</CardTitle></CardHeader>
          <CardContent className="h-64">
            {stats.types.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.types} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                    {stats.types.map((_, i) => <Cell key={i} fill={["var(--primary)", "var(--earth)", "#3b82f6", "#a855f7", "#f59e0b"][i % 5]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* =================== LEITE =================== */

function MilkTab({ from, to }: { from: string; to: string }) {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["report_milk", user?.id, from, to],
    enabled: !!user,
    queryFn: async () => {
      const [eventsRes, salesRes, animalsRes] = await Promise.all([
        supabase.from("animal_events").select("*").gte("event_date", from).lte("event_date", to),
        supabase.from("sales").select("*").eq("category", "leite").gte("sale_date", from).lte("sale_date", to),
        supabase.from("animals").select("id,identifier,breed"),
      ]);
      return { events: eventsRes.data ?? [], sales: salesRes.data ?? [], animals: animalsRes.data ?? [] };
    },
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const milkEvents = data.events.filter((e) => (e.data as any)?.liters);
    const total = milkEvents.reduce((s, e) => s + Number((e.data as any).liters), 0);
    const days = new Set(milkEvents.map((e) => e.event_date)).size || 1;
    const avgDaily = total / days;
    const revenue = data.sales.reduce((s, r) => s + Number(r.total), 0);

    const perCow = new Map<string, number>();
    for (const e of milkEvents) {
      const k = e.animal_id; perCow.set(k, (perCow.get(k) ?? 0) + Number((e.data as any).liters));
    }
    const ranking = Array.from(perCow.entries()).map(([id, liters]) => {
      const a = data.animals.find((x) => x.id === id);
      return { id, label: a?.identifier ?? "—", breed: a?.breed ?? "—", liters };
    }).sort((a, b) => b.liters - a.liters).slice(0, 5);

    const byDay = new Map<string, number>();
    for (const e of milkEvents) byDay.set(e.event_date, (byDay.get(e.event_date) ?? 0) + Number((e.data as any).liters));
    const chart = Array.from(byDay.entries()).sort().map(([d, v]) => ({
      date: d.slice(8, 10) + "/" + d.slice(5, 7), litros: v,
    }));

    return { total, avgDaily, revenue, ranking, chart };
  }, [data]);

  if (isLoading || !stats) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={<Milk className="h-5 w-5" />} label="Litros produzidos" value={num(Math.round(stats.total))} accent="primary" />
        <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Média diária" value={`${stats.avgDaily.toFixed(1)} L`} accent="success" />
        <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Receita do leite" value={brl(stats.revenue)} accent="earth" />
        <KpiCard icon={<Trophy className="h-5 w-5" />} label="Melhor vaca" value={stats.ranking[0]?.label ?? "—"} hint={stats.ranking[0] ? `${stats.ranking[0].liters.toFixed(0)} L` : ""} accent="secondary" />
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Produção diária</CardTitle></CardHeader>
        <CardContent className="h-64">
          {stats.chart.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Sem registros de leite. Cadastre eventos com campo "liters".</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="litros" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Top 5 vacas produtoras</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {stats.ranking.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> :
            stats.ranking.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border p-2.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{i + 1}º</Badge>
                  <div>
                    <div className="text-sm font-medium">{r.label}</div>
                    <div className="text-xs text-muted-foreground">{r.breed}</div>
                  </div>
                </div>
                <div className="font-semibold text-primary">{r.liters.toFixed(1)} L</div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* =================== SANITÁRIO =================== */

function HealthTab({ from, to }: { from: string; to: string }) {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["report_health", user?.id, from, to],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("animal_events").select("*")
        .in("event_type", ["vacina", "doenca", "medicamento", "mortalidade"])
        .gte("event_date", from).lte("event_date", to);
      const todayStr = todayIso();
      const { data: pending } = await supabase.from("animal_events").select("*")
        .eq("event_type", "vacina").not("next_due_date", "is", null).gte("next_due_date", todayStr).limit(20);
      return { events: data ?? [], pending: pending ?? [] };
    },
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const vacinas = data.events.filter((e) => e.event_type === "vacina").length;
    const doencas = data.events.filter((e) => e.event_type === "doenca").length;
    const meds = data.events.filter((e) => e.event_type === "medicamento").length;
    const mortes = data.events.filter((e) => e.event_type === "mortalidade").length;
    const cost = data.events.reduce((s, e) => s + Number(e.cost ?? 0), 0);

    const byType: Record<string, number> = { Vacinas: vacinas, Doenças: doencas, Medicamentos: meds, Mortalidade: mortes };
    const chart = Object.entries(byType).map(([name, value]) => ({ name, value }));
    return { vacinas, doencas, meds, mortes, cost, pending: data.pending, chart };
  }, [data]);

  if (isLoading || !stats) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={<Stethoscope className="h-5 w-5" />} label="Vacinas aplicadas" value={num(stats.vacinas)} accent="success" />
        <KpiCard icon={<Stethoscope className="h-5 w-5" />} label="Doenças registradas" value={num(stats.doencas)} accent="destructive" />
        <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Custo sanitário" value={brl(stats.cost)} accent="earth" />
        <KpiCard icon={<CalendarIcon className="h-5 w-5" />} label="Vacinas pendentes" value={num(stats.pending.length)} accent="secondary" />
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Eventos sanitários</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {stats.chart.map((e, i) => <Cell key={i} fill={["var(--success)", "var(--destructive)", "var(--earth)", "#64748b"][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {stats.pending.length > 0 && (
        <Card className="rounded-2xl border-secondary">
          <CardHeader><CardTitle className="text-base">Próximas vacinas pendentes</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {stats.pending.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                <span>{p.title}</span>
                <Badge variant="outline">{new Date(p.next_due_date!).toLocaleDateString("pt-BR")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* =================== IA =================== */

function InsightsTab() {
  const run = useServerFn(generateFarmInsights);
  const mut = useMutation({
    mutationFn: () => run(),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold">Análise Inteligente da Fazenda</div>
              <p className="text-sm text-muted-foreground">A IA examina seus dados de vendas, rebanho, saúde e produção e gera insights estratégicos.</p>
            </div>
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} size="lg">
            <RefreshCw className={`h-4 w-4 ${mut.isPending ? "animate-spin" : ""}`} />
            {mut.data ? "Gerar novamente" : "Gerar insights"}
          </Button>
        </CardContent>
      </Card>

      {mut.isPending && (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      )}

      {mut.data && (
        <>
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />Insights</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {mut.data.insights.length === 0 ? <p className="text-sm text-muted-foreground">Sem insights.</p> :
                mut.data.insights.map((t, i) => (
                  <div key={i} className="rounded-lg border-l-4 border-primary bg-accent/50 p-3 text-sm">{t}</div>
                ))}
            </CardContent>
          </Card>

          {mut.data.sugestoes.length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Sugestões de ação</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {mut.data.sugestoes.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                    <span className="text-primary">→</span>{t}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Gerado em {new Date(mut.data.generated_at).toLocaleString("pt-BR")}
          </p>
        </>
      )}

      {!mut.data && !mut.isPending && (
        <Card className="rounded-2xl">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Clique em <strong>Gerar insights</strong> para receber uma análise da IA sobre sua fazenda.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
