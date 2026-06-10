import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  RefreshCw,
  Search,
  TrendingUp,
  MapPin,
  History,
  GitCompare,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { refreshMarketPrices } from "@/lib/prices.functions";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const searchSchema = z.object({
  product: z.string().optional(),
});

export const Route = createFileRoute("/precos")({
  validateSearch: zodValidator(searchSchema),
  component: () => (
    <RequireAuth>
      <AppShell>
        <Prices />
      </AppShell>
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Preços de mercado — AgroGestor" }] }),
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

type StatePrice = {
  id: string;
  product: string;
  state: string;
  region: string;
  unit: string;
  price: number;
  variation_day: number;
  variation_week: number;
  source: string;
  reference_date: string;
  updated_at: string;
};

function VariationBadge({ value }: { value: number }) {
  const up = value > 0.05;
  const down = value < -0.05;
  const cls = up
    ? "bg-success/10 text-success"
    : down
      ? "bg-destructive/10 text-destructive"
      : "bg-muted text-muted-foreground";
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

function Prices() {
  const { product: productParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [region, setRegion] = useState("Todas");
  const [search, setSearch] = useState("");
  const [openProduct, setOpenProduct] = useState<string | null>(productParam ?? null);
  const qc = useQueryClient();
  const refresh = useServerFn(refreshMarketPrices);

  // Sync URL ?product= with dialog state
  useEffect(() => {
    setOpenProduct(productParam ?? null);
  }, [productParam]);
  const closeProduct = () => {
    setOpenProduct(null);
    navigate({ search: { product: undefined } });
  };

  const { data = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["market_prices_states"],
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_prices_states")
        .select("*")
        .order("product");
      if (error) throw error;
      return data as StatePrice[];
    },
  });

  const refreshMut = useMutation({
    mutationFn: () => refresh(),
    onSuccess: (r) => {
      if (r?.updated) toast.success(`${r.updated} cotações atualizadas`);
      else toast.info("Preços já estão atualizados");
      qc.invalidateQueries({ queryKey: ["market_prices_states"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Agrega por produto (média + variação média ponderada)
  const products = useMemo(() => {
    const filtered = data.filter(
      (d) => region === "Todas" || d.region === region,
    );
    const map = new Map<
      string,
      { product: string; unit: string; prices: number[]; varDay: number[]; varWeek: number[]; states: number }
    >();
    for (const r of filtered) {
      const cur =
        map.get(r.product) ?? {
          product: r.product,
          unit: r.unit,
          prices: [],
          varDay: [],
          varWeek: [],
          states: 0,
        };
      cur.prices.push(Number(r.price));
      cur.varDay.push(Number(r.variation_day));
      cur.varWeek.push(Number(r.variation_week));
      cur.states++;
      map.set(r.product, cur);
    }
    const arr = Array.from(map.values()).map((p) => ({
      product: p.product,
      unit: p.unit,
      avg: p.prices.reduce((a, b) => a + b, 0) / p.prices.length,
      min: Math.min(...p.prices),
      max: Math.max(...p.prices),
      varDay: p.varDay.reduce((a, b) => a + b, 0) / p.varDay.length,
      varWeek: p.varWeek.reduce((a, b) => a + b, 0) / p.varWeek.length,
      states: p.states,
    }));
    const q = search.trim().toLowerCase();
    return q
      ? arr.filter((p) => p.product.toLowerCase().includes(q))
      : arr;
  }, [data, region, search]);

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Painel nacional de commodities"
        subtitle={`Última verificação: ${lastUpdate} • Fonte: CEPEA/Simulado`}
        right={
          <Button
            onClick={() => refreshMut.mutate()}
            disabled={refreshMut.isPending}
            className="h-11"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshMut.isPending ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto (boi, soja, milho, leite...)"
            className="h-11 pl-9"
          />
        </div>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="h-11 sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas as regiões</SelectItem>
            {["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"].map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma cotação encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <button
              key={p.product}
              onClick={() => navigate({ search: { product: p.product } })}
              className="group text-left"
            >
              <Card className="rounded-2xl transition-all hover:border-primary/40 hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground transition-transform group-hover:scale-105">
                        <TrendingUp className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="font-semibold">{p.product}</div>
                        <div className="text-xs text-muted-foreground">
                          Média Brasil • {p.unit}
                        </div>
                      </div>
                    </div>
                    <VariationBadge value={p.varDay} />
                  </div>
                  <div className="mt-3 text-2xl font-bold">{brl(p.avg)}</div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Min {brl(p.min)} • Máx {brl(p.max)}
                    </span>
                    <Badge variant="secondary" className="font-normal">
                      {p.states} estados
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    7 dias:{" "}
                    <span
                      className={
                        p.varWeek > 0
                          ? "text-success"
                          : p.varWeek < 0
                            ? "text-destructive"
                            : ""
                      }
                    >
                      {p.varWeek > 0 ? "+" : ""}
                      {p.varWeek.toFixed(2)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <ProductDetail
        product={openProduct}
        rows={data.filter((d) => d.product === openProduct)}
        onClose={closeProduct}
      />
    </div>
  );
}

/* -------------------- Detalhe por produto -------------------- */

function ProductDetail({
  product,
  rows,
  onClose,
}: {
  product: string | null;
  rows: StatePrice[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState("estados");
  const [compareStates, setCompareStates] = useState<string[]>([]);
  const [chartState, setChartState] = useState<string>("");
  const [period, setPeriod] = useState<"7" | "30" | "90" | "180" | "365">("30");

  const sorted = [...rows].sort((a, b) => Number(b.price) - Number(a.price));
  const unit = rows[0]?.unit ?? "";

  const toggleCompare = (uf: string) => {
    setCompareStates((s) =>
      s.includes(uf) ? s.filter((x) => x !== uf) : s.length < 5 ? [...s, uf] : s,
    );
  };

  const stateForChart = chartState || sorted[0]?.state || "";

  const { data: history = [] } = useQuery({
    queryKey: ["price_history", product, stateForChart, period],
    enabled: !!product && !!stateForChart,
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - Number(period));
      const { data, error } = await supabase
        .from("market_price_history")
        .select("price, reference_date")
        .eq("product", product!)
        .eq("state", stateForChart)
        .gte("reference_date", from.toISOString().slice(0, 10))
        .order("reference_date");
      if (error) throw error;
      return data.map((d) => ({
        date: new Date(d.reference_date).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        price: Number(d.price),
      }));
    },
  });

  const stats = useMemo(() => {
    if (!history.length) return null;
    const prices = history.map((h) => h.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const first = prices[0];
    const last = prices[prices.length - 1];
    const trend = ((last - first) / first) * 100;
    return { min, max, avg, trend };
  }, [history]);

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="h-5 w-5 text-primary" />
            {product}
          </DialogTitle>
          <DialogDescription>
            Cotações em todos os estados • Unidade: {unit}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="estados" className="gap-1">
              <MapPin className="h-3.5 w-3.5" /> Estados
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-1">
              <History className="h-3.5 w-3.5" /> Histórico
            </TabsTrigger>
            <TabsTrigger value="comparar" className="gap-1">
              <GitCompare className="h-3.5 w-3.5" /> Comparar
            </TabsTrigger>
          </TabsList>

          {/* ESTADOS */}
          <TabsContent value="estados" className="space-y-2">
            {sorted.map((r, i) => (
              <Card key={r.id} className="rounded-xl">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {STATE_NAMES[r.state] ?? r.state}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {r.region}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Atualizado{" "}
                      {new Date(r.updated_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{brl(Number(r.price))}</div>
                    <div className="flex items-center gap-1 text-xs">
                      <VariationBadge value={Number(r.variation_day)} />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setChartState(r.state);
                      setTab("historico");
                    }}
                  >
                    Ver
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* HISTÓRICO */}
          <TabsContent value="historico" className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={stateForChart} onValueChange={setChartState}>
                <SelectTrigger className="sm:w-56">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {sorted.map((r) => (
                    <SelectItem key={r.state} value={r.state}>
                      {STATE_NAMES[r.state] ?? r.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={period} onValueChange={(v) => setPeriod(v as never)}>
                <SelectTrigger className="sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                  <SelectItem value="180">6 meses</SelectItem>
                  <SelectItem value="365">12 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {stats && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Mínima" value={brl(stats.min)} />
                <Stat label="Máxima" value={brl(stats.max)} />
                <Stat label="Média" value={brl(stats.avg)} />
                <Stat
                  label="Tendência"
                  value={`${stats.trend > 0 ? "+" : ""}${stats.trend.toFixed(2)}%`}
                  trend={stats.trend}
                />
              </div>
            )}

            <Card className="rounded-2xl">
              <CardContent className="p-2">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="0%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="100%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis fontSize={11} width={70} tickFormatter={(v) => brl(v)} />
                      <Tooltip
                        formatter={(v: number) => brl(v)}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--background))",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke="hsl(var(--primary))"
                        fill="url(#g1)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMPARAR */}
          <TabsContent value="comparar" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecione até 5 estados para comparar.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sorted.map((r) => {
                const on = compareStates.includes(r.state);
                return (
                  <button
                    key={r.state}
                    onClick={() => toggleCompare(r.state)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    {r.state}
                  </button>
                );
              })}
            </div>

            {compareStates.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum estado selecionado.
              </p>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const selected = sorted.filter((r) =>
                    compareStates.includes(r.state),
                  );
                  const ref = Math.min(...selected.map((s) => Number(s.price)));
                  return selected
                    .sort((a, b) => Number(b.price) - Number(a.price))
                    .map((r, i) => {
                      const diff = ((Number(r.price) - ref) / ref) * 100;
                      return (
                        <Card key={r.id} className="rounded-xl">
                          <CardContent className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{i + 1}º</Badge>
                              <div>
                                <div className="font-medium">
                                  {STATE_NAMES[r.state]}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {r.region}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">
                                {brl(Number(r.price))}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {diff === 0
                                  ? "menor preço"
                                  : `+${diff.toFixed(2)}% vs menor`}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    });
                })()}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: number;
}) {
  const cls =
    trend === undefined
      ? ""
      : trend > 0
        ? "text-success"
        : trend < 0
          ? "text-destructive"
          : "";
  return (
    <Card className="rounded-xl">
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-bold ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
