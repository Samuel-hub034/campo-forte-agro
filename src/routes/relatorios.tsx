import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

const searchSchema = z.object({
  tipo: z.enum(["faturamento", "animais", "graos", "todos"]).optional().default("todos"),
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function categoryFromTipo(tipo: string): string | "all" {
  if (tipo === "animais") return "animal";
  if (tipo === "graos") return "grao";
  return "all";
}

function Reports() {
  const { user } = useAuth();
  const { tipo } = Route.useSearch();
  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [category, setCategory] = useState<string>(categoryFromTipo(tipo));
  const [buyer, setBuyer] = useState("");

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["report", user?.id, from, to, category, buyer],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("sales")
        .select("*")
        .gte("sale_date", from)
        .lte("sale_date", to)
        .order("sale_date", { ascending: false });
      if (category !== "all") q = q.eq("category", category);
      if (buyer.trim()) q = q.ilike("buyer", `%${buyer.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const totals = useMemo(() => {
    const revenue = sales.reduce((s, r) => s + Number(r.total ?? 0), 0);
    const qty = sales.reduce((s, r) => s + Number(r.quantity ?? 0), 0);
    return { revenue, qty, count: sales.length };
  }, [sales]);

  const exportCsv = () => {
    const header = [
      "Data",
      "Categoria",
      "Item",
      "Quantidade",
      "Unidade",
      "Preço unit.",
      "Total",
      "Comprador",
    ];
    const rows = sales.map((s) => [
      s.sale_date,
      s.category,
      s.item,
      String(s.quantity),
      s.unit ?? "",
      String(s.unit_price),
      String(s.total),
      s.buyer ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const c = String(cell).replace(/"/g, '""');
            return /[",;\n]/.test(c) ? `"${c}"` : c;
          })
          .join(";")
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_vendas_${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = () => {
    window.print();
  };

  const tipoLabel: Record<string, string> = {
    faturamento: "Faturamento",
    animais: "Animais vendidos",
    graos: "Sacas vendidas",
    todos: "Vendas",
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Relatório de ${tipoLabel[tipo]}`}
        subtitle="Filtre, visualize e exporte seus dados"
        right={<FileBarChart className="h-8 w-8 text-primary" />}
      />

      {/* Filters */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>De</Label>
            <Input
              className="h-11"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Até</Label>
            <Input
              className="h-11"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="animal">Animais</SelectItem>
                <SelectItem value="grao">Grãos</SelectItem>
                <SelectItem value="outro">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Comprador</Label>
            <Input
              className="h-11"
              placeholder="Buscar por nome"
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Faturamento</div>
            <div className="text-xl font-bold text-primary">{brl(totals.revenue)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Quantidade</div>
            <div className="text-xl font-bold">{totals.qty.toLocaleString("pt-BR")}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Vendas</div>
            <div className="text-xl font-bold">{totals.count}</div>
          </CardContent>
        </Card>
      </div>

      {/* Export */}
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button onClick={exportCsv} disabled={sales.length === 0}>
          <Download className="h-4 w-4" />
          Exportar Excel/CSV
        </Button>
        <Button variant="outline" onClick={printPdf} disabled={sales.length === 0}>
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Table */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Vendas no período</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-24 animate-pulse rounded-md bg-muted" />
          ) : sales.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma venda no período selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3">Data</th>
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3">Cat.</th>
                    <th className="py-2 pr-3 text-right">Qtd</th>
                    <th className="py-2 pr-3 text-right">Preço</th>
                    <th className="py-2 pr-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {new Date(s.sale_date).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-medium">{s.item}</div>
                        {s.buyer && (
                          <div className="text-xs text-muted-foreground">{s.buyer}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant="secondary">{s.category}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {Number(s.quantity)} {s.unit || ""}
                      </td>
                      <td className="py-2 pr-3 text-right">{brl(Number(s.unit_price))}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-primary">
                        {brl(Number(s.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
