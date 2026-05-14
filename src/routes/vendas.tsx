import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Receipt, Trash2 } from "lucide-react";
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

function Sales() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const total = sales.reduce((s, r) => s + Number(r.total), 0);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda removida");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendas"
        subtitle={`Total acumulado: ${brl(total)}`}
        right={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="h-12">
                <Plus className="h-4 w-4" /> Registrar
              </Button>
            </DialogTrigger>
            <NewSaleDialog onDone={() => setOpen(false)} />
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      ) : sales.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground" />
            <div>
              <div className="font-semibold">Nenhuma venda registrada</div>
              <div className="text-sm text-muted-foreground">
                Registre sua primeira venda para começar.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sales.map((s) => (
            <Card key={s.id} className="rounded-2xl">
              <CardContent className="flex items-start justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{s.item}</span>
                    <Badge variant="secondary">{labelFor(s.category)}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {Number(s.quantity)} {s.unit || "un"} ×{" "}
                    {brl(Number(s.unit_price))}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(s.sale_date).toLocaleDateString("pt-BR")}
                    {s.buyer && <> • {s.buyer}</>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">
                    {brl(Number(s.total))}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove.mutate(s.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function labelFor(c: string) {
  if (c === "animal") return "Animal";
  if (c === "grao") return "Grão";
  return "Outro";
}

function NewSaleDialog({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    category: "animal",
    item: "",
    quantity: "1",
    unit: "cabeça",
    unit_price: "",
    sale_date: new Date().toISOString().slice(0, 10),
    buyer: "",
  });

  const total =
    (Number(form.quantity) || 0) * (Number(form.unit_price) || 0);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem sessão");
      const { error } = await supabase.from("sales").insert({
        user_id: user.id,
        category: form.category,
        item: form.item,
        quantity: Number(form.quantity),
        unit: form.unit,
        unit_price: Number(form.unit_price),
        total,
        sale_date: form.sale_date,
        buyer: form.buyer || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda registrada");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Registrar venda</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select
              value={form.category}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  category: v,
                  unit:
                    v === "animal" ? "cabeça" : v === "grao" ? "saca" : "un",
                })
              }
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="animal">Animal</SelectItem>
                <SelectItem value="grao">Grão</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
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
        <div className="rounded-lg bg-accent p-3 text-center">
          <div className="text-xs text-accent-foreground/70">Total</div>
          <div className="text-2xl font-bold text-accent-foreground">
            {brl(total)}
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" className="h-11 w-full" disabled={create.isPending}>
            {create.isPending ? "Salvando..." : "Registrar venda"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
