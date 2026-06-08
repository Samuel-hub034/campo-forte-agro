import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Receipt,
  Trash2,
  Pencil,
  Search,
  TrendingUp,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/vendas")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <Sales />
      </AppShell>
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Vendas — AgroGestor" }] }),
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type SaleRow = {
  id: string;
  user_id: string;
  category: string;
  item: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total: number;
  sale_date: string;
  buyer: string | null;
  notes?: string | null;
  created_at?: string;
};

const CATEGORY_META: Record<
  string,
  { label: string; icon: string; cls: string }
> = {
  animal: { label: "Animal", icon: "🐄", cls: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200" },
  leite: { label: "Leite", icon: "🥛", cls: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200" },
  grao: { label: "Grãos", icon: "🌾", cls: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200" },
  insumo: { label: "Insumos", icon: "🧪", cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200" },
  outro: { label: "Outro", icon: "📦", cls: "bg-muted text-muted-foreground" },
};

function categoryMeta(c: string) {
  return CATEGORY_META[c] ?? CATEGORY_META.outro;
}

type PeriodKey = "todos" | "hoje" | "7d" | "30d" | "mes" | "ano";

function inPeriod(dateStr: string, period: PeriodKey) {
  if (period === "todos") return true;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "hoje") return d.getTime() === today.getTime();
  if (period === "7d") {
    const past = new Date(today);
    past.setDate(past.getDate() - 6);
    return d >= past && d <= today;
  }
  if (period === "30d") {
    const past = new Date(today);
    past.setDate(past.getDate() - 29);
    return d >= past && d <= today;
  }
  if (period === "mes")
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (period === "ano") return d.getFullYear() === now.getFullYear();
  return true;
}

function Sales() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SaleRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SaleRow | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("todas");
  const [period, setPeriod] = useState<PeriodKey>("todos");

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data as SaleRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (category !== "todas" && s.category !== category) return false;
      if (!inPeriod(s.sale_date, period)) return false;
      if (!q) return true;
      return (
        s.item?.toLowerCase().includes(q) ||
        s.buyer?.toLowerCase().includes(q) ||
        categoryMeta(s.category).label.toLowerCase().includes(q)
      );
    });
  }, [sales, search, category, period]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, r) => s + Number(r.total), 0);
    const count = filtered.length;
    const avg = count ? total / count : 0;

    const byBuyer = new Map<string, number>();
    const byItem = new Map<string, number>();
    for (const s of filtered) {
      if (s.buyer) byBuyer.set(s.buyer, (byBuyer.get(s.buyer) || 0) + Number(s.total));
      byItem.set(s.item, (byItem.get(s.item) || 0) + Number(s.quantity));
    }
    const topBuyer = [...byBuyer.entries()].sort((a, b) => b[1] - a[1])[0];
    const topItem = [...byItem.entries()].sort((a, b) => b[1] - a[1])[0];

    return { total, count, avg, topBuyer, topItem };
  }, [filtered]);

  const remove = useMutation({
    mutationFn: async (row: SaleRow) => {
      const { data, error } = await supabase
        .from("sales")
        .delete()
        .eq("id", row.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0)
        throw new Error("Nenhum registro foi removido. Verifique permissões.");
      return data;
    },
    onSuccess: () => {
      toast.success("Venda excluída");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setConfirmDelete(null);
    },
    onError: (e: Error) =>
      toast.error(`Não foi possível excluir a venda. Motivo: ${e.message}`),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendas"
        subtitle={`${stats.count} venda(s) • ${brl(stats.total)}`}
        right={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="h-12">
                <Plus className="h-4 w-4" /> Registrar
              </Button>
            </DialogTrigger>
            <SaleFormDialog onDone={() => setOpen(false)} />
          </Dialog>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label="Faturamento"
          value={brl(stats.total)}
        />
        <StatCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Vendas"
          value={String(stats.count)}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Ticket médio"
          value={brl(stats.avg)}
        />
        <StatCard
          icon={<Receipt className="h-4 w-4" />}
          label="Top comprador"
          value={stats.topBuyer ? stats.topBuyer[0] : "—"}
          sub={stats.topBuyer ? brl(stats.topBuyer[1]) : undefined}
        />
      </div>

      {/* Filters */}
      <Card className="rounded-2xl">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pl-9"
              placeholder="Buscar por produto, comprador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-11 md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              <SelectItem value="animal">🐄 Animal</SelectItem>
              <SelectItem value="leite">🥛 Leite</SelectItem>
              <SelectItem value="grao">🌾 Grãos</SelectItem>
              <SelectItem value="insumo">🧪 Insumos</SelectItem>
              <SelectItem value="outro">📦 Outro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="h-11 md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo período</SelectItem>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="mes">Mês atual</SelectItem>
              <SelectItem value="ano">Ano atual</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground" />
            <div>
              <div className="font-semibold">
                {sales.length === 0
                  ? "Nenhuma venda registrada"
                  : "Nenhuma venda encontrada"}
              </div>
              <div className="text-sm text-muted-foreground">
                {sales.length === 0
                  ? "Registre sua primeira venda para começar."
                  : "Ajuste os filtros para ver mais resultados."}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const meta = categoryMeta(s.category);
            return (
              <Card key={s.id} className="rounded-2xl">
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="flex min-w-0 gap-3">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${meta.cls}`}
                    >
                      {meta.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold">{s.item}</span>
                        <Badge variant="secondary" className={meta.cls}>
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {Number(s.quantity)} {s.unit || "un"} ×{" "}
                        {brl(Number(s.unit_price))}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(s.sale_date + "T00:00:00").toLocaleDateString(
                          "pt-BR",
                        )}
                        {s.buyer && <> • {s.buyer}</>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-lg font-bold text-primary">
                      {brl(Number(s.total))}
                    </div>
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(s)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete(s)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        {editing && (
          <SaleFormDialog
            initial={editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta venda?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && (
                <>
                  <strong>{confirmDelete.item}</strong> —{" "}
                  {brl(Number(confirmDelete.total))}
                  <br />
                  Esta ação não poderá ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) remove.mutate(confirmDelete);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-1 truncate text-xl font-bold">{value}</div>
        {sub && (
          <div className="text-xs text-muted-foreground truncate">{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}

function SaleFormDialog({
  onDone,
  initial,
}: {
  onDone: () => void;
  initial?: SaleRow;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    category: initial?.category ?? "animal",
    item: initial?.item ?? "",
    quantity: String(initial?.quantity ?? "1"),
    unit: initial?.unit ?? "cabeça",
    unit_price: initial?.unit_price ? String(initial.unit_price) : "",
    sale_date: initial?.sale_date ?? new Date().toISOString().slice(0, 10),
    buyer: initial?.buyer ?? "",
    notes: initial?.notes ?? "",
  });

  const total =
    (Number(form.quantity) || 0) * (Number(form.unit_price) || 0);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem sessão");
      const payload = {
        category: form.category,
        item: form.item,
        quantity: Number(form.quantity),
        unit: form.unit,
        unit_price: Number(form.unit_price),
        total,
        sale_date: form.sale_date,
        buyer: form.buyer || null,
        notes: form.notes || null,
      };
      if (initial) {
        const { data, error } = await supabase
          .from("sales")
          .update(payload)
          .eq("id", initial.id)
          .select("id");
        if (error) throw new Error(error.message);
        if (!data || data.length === 0)
          throw new Error("Venda não atualizada (sem permissão).");
      } else {
        const { error } = await supabase
          .from("sales")
          .insert({ ...payload, user_id: user.id });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success(initial ? "Venda atualizada" : "Venda registrada");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{initial ? "Editar venda" : "Registrar venda"}</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              value={form.category}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  category: v,
                  unit:
                    !initial
                      ? v === "animal"
                        ? "cabeça"
                        : v === "grao"
                          ? "saca"
                          : v === "leite"
                            ? "litro"
                            : "un"
                      : form.unit,
                })
              }
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="animal">🐄 Animal</SelectItem>
                <SelectItem value="leite">🥛 Leite</SelectItem>
                <SelectItem value="grao">🌾 Grãos</SelectItem>
                <SelectItem value="insumo">🧪 Insumos</SelectItem>
                <SelectItem value="outro">📦 Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input
              className="h-11"
              type="date"
              value={form.sale_date}
              onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Item</Label>
          <Input
            className="h-11"
            required
            value={form.item}
            onChange={(e) => setForm({ ...form, item: e.target.value })}
            placeholder="Boi gordo, Soja, ..."
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Qtd</Label>
            <Input
              className="h-11"
              type="number"
              step="0.01"
              required
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unidade</Label>
            <Input
              className="h-11"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Preço unit.</Label>
            <Input
              className="h-11"
              type="number"
              step="0.01"
              required
              value={form.unit_price}
              onChange={(e) =>
                setForm({ ...form, unit_price: e.target.value })
              }
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Comprador (opcional)</Label>
          <Input
            className="h-11"
            value={form.buyer}
            onChange={(e) => setForm({ ...form, buyer: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Observações (opcional)</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notas sobre a venda..."
          />
        </div>
        <div className="rounded-lg bg-accent p-3 text-center">
          <div className="text-xs text-accent-foreground/70">Total</div>
          <div className="text-2xl font-bold text-accent-foreground">
            {brl(total)}
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" className="h-11 w-full" disabled={save.isPending}>
            {save.isPending
              ? "Salvando..."
              : initial
                ? "Salvar alterações"
                : "Registrar venda"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
