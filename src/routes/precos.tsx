import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { refreshMarketPrices } from "@/lib/prices.functions";

export const Route = createFileRoute("/precos")({
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

function Prices() {
  const [region, setRegion] = useState<string>("Todas");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const refresh = useServerFn(refreshMarketPrices);

  const { data = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["market_prices"],
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000, // poll a cada 5 min
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_prices")
        .select("*")
        .order("product");
      if (error) throw error;
      return data;
    },
  });

  const refreshMut = useMutation({
    mutationFn: () => refresh(),
    onSuccess: (r) => {
      if (r?.updated) {
        toast.success(`${r.updated} cotações atualizadas`);
      } else {
        toast.info("Preços já estão atualizados");
      }
      qc.invalidateQueries({ queryKey: ["market_prices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const regions = Array.from(new Set(data.map((d) => d.region)));
  const q = search.trim().toLowerCase();
  const filtered = data
    .filter((d) => region === "Todas" || d.region === region)
    .filter(
      (d) => !q || d.product.toLowerCase().includes(q),
    );

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Preços de mercado"
        subtitle={`Última verificação: ${lastUpdate}`}
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
            placeholder="Buscar produto (boi, soja, milho...)"
            className="h-11 pl-9"
          />
        </div>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="h-11 sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas as regiões</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma cotação encontrada para os filtros atuais.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((p) => {
            const v = Number(p.variation);
            const up = v >= 0;
            return (
              <Card key={p.id} className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
                        <TrendingUp className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="font-semibold">{p.product}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.region} • {p.unit}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        up
                          ? "bg-success/10 text-success"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {up ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {Math.abs(v).toFixed(2)}%
                    </div>
                  </div>
                  <div className="mt-3 text-2xl font-bold">
                    {brl(Number(p.price))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Atualizado em{" "}
                    {new Date(p.reference_date).toLocaleDateString("pt-BR")}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="rounded-2xl border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Atualização automática</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Os preços são revisados automaticamente todos os dias. Toque em
          <span className="mx-1 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
            <RefreshCw className="h-3 w-3" /> Atualizar
          </span>
          para forçar uma nova verificação.
        </CardContent>
      </Card>
    </div>
  );
}
