import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const { data = [], isLoading } = useQuery({
    queryKey: ["market_prices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_prices")
        .select("*")
        .order("product");
      if (error) throw error;
      return data;
    },
  });

  const regions = Array.from(new Set(data.map((d) => d.region)));
  const filtered =
    region === "Todas" ? data : data.filter((d) => d.region === region);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Preços de mercado"
        subtitle="Cotações por região para apoiar suas decisões de venda"
        right={
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="h-11 w-44">
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
        }
      />

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((p) => {
            const v = Number(p.variation);
            const up = v >= 0;
            return (
              <Card key={p.id} className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
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
          <CardTitle className="text-base">Alertas inteligentes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Em breve: alertas automáticos quando o preço estiver em momento ideal
          para venda ou quando cair significativamente na sua região.
        </CardContent>
      </Card>
    </div>
  );
}
