import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Beef, Trash2, Receipt, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { ANIMAL_TYPES, getBreedsForSpecies } from "@/lib/breeds";

export const Route = createFileRoute("/animais")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <Animals />
      </AppShell>
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Rebanho — AgroGestor" }] }),
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Animals() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("ativos");
  const [search, setSearch] = useState("");

  const { data: animals = [], isLoading } = useQuery({
    queryKey: ["animals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("animals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: soldSales = [], isLoading: loadingSold } = useQuery({
    queryKey: ["sales-animals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("category", "animal")
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("animals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Animal removido");
      qc.invalidateQueries({ queryKey: ["animals"] });
    },
  });

  const q = search.trim().toLowerCase();
  const filteredAnimals = animals.filter(
    (a) =>
      !q ||
      [a.identifier, a.type, a.breed, a.lote]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
  );
  const filteredSold = soldSales.filter(
    (s) =>
      !q ||
      [s.item, s.buyer, s.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
  );

  const totalSoldValue = soldSales.reduce((acc, s) => acc + Number(s.total), 0);
  const totalSoldQty = soldSales.reduce((acc, s) => acc + Number(s.quantity), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rebanho"
        subtitle={`${animals.length} ativos • ${totalSoldQty} vendidos`}
        right={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="h-12">
                <Plus className="h-4 w-4" /> Novo
              </Button>
            </DialogTrigger>
            <NewAnimalDialog onDone={() => setOpen(false)} />
          </Dialog>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por brinco, raça, comprador..."
          className="h-11 pl-9"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ativos">
            <Beef className="mr-2 h-4 w-4" /> Ativos ({animals.length})
          </TabsTrigger>
          <TabsTrigger value="vendidos">
            <Receipt className="mr-2 h-4 w-4" /> Vendidos ({soldSales.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ativos" className="mt-4">
          {isLoading ? (
            <div className="h-32 animate-pulse rounded-2xl bg-muted" />
          ) : filteredAnimals.length === 0 ? (
            <EmptyState
              icon={<Beef className="h-10 w-10 text-muted-foreground" />}
              title="Nenhum animal encontrado"
              subtitle="Cadastre o primeiro animal do seu rebanho."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredAnimals.map((a) => (
                <Card key={a.id} className="rounded-2xl">
                  <CardContent className="flex items-start justify-between p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {a.identifier || "Sem brinco"}
                        </span>
                        <Badge variant="secondary">{a.type}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {a.breed && <>Raça: {a.breed} • </>}
                        {a.weight_kg && <>{a.weight_kg} kg • </>}
                        Lote: {a.lote || "—"}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Status: <span className="font-medium">{a.status}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove.mutate(a.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="vendidos" className="mt-4 space-y-3">
          <Card className="rounded-2xl bg-gradient-to-br from-primary/90 to-primary text-primary-foreground">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-xs opacity-80">Faturamento com animais</div>
                <div className="text-2xl font-bold">{brl(totalSoldValue)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs opacity-80">Total de cabeças</div>
                <div className="text-2xl font-bold">{totalSoldQty}</div>
              </div>
            </CardContent>
          </Card>

          {loadingSold ? (
            <div className="h-32 animate-pulse rounded-2xl bg-muted" />
          ) : filteredSold.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-10 w-10 text-muted-foreground" />}
              title="Nenhuma venda de animal registrada"
              subtitle="Registre na aba Vendas para aparecer aqui."
            />
          ) : (
            <div className="space-y-2">
              {filteredSold.map((s) => (
                <Card key={s.id} className="rounded-2xl">
                  <CardContent className="flex items-start justify-between p-4">
                    <div>
                      <div className="font-semibold">{s.item}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {Number(s.quantity)} {s.unit || "cab"} ×{" "}
                        {brl(Number(s.unit_price))}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(s.sale_date).toLocaleDateString("pt-BR")}
                        {s.buyer && <> • {s.buyer}</>}
                      </div>
                    </div>
                    <div className="text-lg font-bold text-primary">
                      {brl(Number(s.total))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        {icon}
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Validação ----
const animalSchema = z.object({
  typeKey: z.string().min(1, "Selecione o tipo"),
  typeCustom: z.string().trim().max(50).optional(),
  noTag: z.boolean(),
  identifier: z.string().trim().max(30).optional(),
  breedKey: z.string().min(1, "Selecione a raça"),
  breedCustom: z.string().trim().max(50).optional(),
  weight_kg: z
    .string()
    .optional()
    .refine(
      (v) => !v || (/^\d{1,4}(\.\d{1,2})?$/.test(v) && Number(v) > 0 && Number(v) <= 9999),
      "Peso inválido (1 a 9999 kg)",
    ),
  noLote: z.boolean(),
  lote: z.string().trim().max(30).optional(),
  origin: z.enum(["compra", "nascimento"]),
});

function NewAnimalDialog({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    typeKey: "boi",
    typeCustom: "",
    noTag: false,
    identifier: "",
    breedKey: "",
    breedCustom: "",
    weight_kg: "",
    noLote: false,
    lote: "",
    origin: "compra" as "compra" | "nascimento",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const breedOptions = useMemo(
    () => getBreedsForSpecies(form.typeKey),
    [form.typeKey],
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem sessão");
      const parsed = animalSchema.safeParse(form);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.issues.forEach((i) => {
          errs[i.path[0] as string] = i.message;
        });
        setErrors(errs);
        throw new Error("Corrija os campos destacados");
      }
      if (form.typeKey === "outro" && !form.typeCustom.trim()) {
        setErrors({ typeCustom: "Informe a espécie" });
        throw new Error("Informe a espécie");
      }
      if (form.breedKey === "Outro" && !form.breedCustom.trim()) {
        setErrors({ breedCustom: "Informe a raça" });
        throw new Error("Informe a raça");
      }
      setErrors({});

      const typeLabel =
        form.typeKey === "outro"
          ? form.typeCustom.trim()
          : ANIMAL_TYPES.find((t) => t.key === form.typeKey)?.label ?? form.typeKey;
      const breedLabel =
        form.breedKey === "Outro" ? form.breedCustom.trim() : form.breedKey;

      const { error } = await supabase.from("animals").insert({
        user_id: user.id,
        identifier: form.noTag ? null : form.identifier.trim() || null,
        type: typeLabel,
        breed: breedLabel,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        lote: form.noLote ? null : form.lote.trim() || null,
        origin: form.origin,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Animal cadastrado");
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const errCls = (key: string) =>
    errors[key] ? "border-destructive focus-visible:ring-destructive" : "";

  return (
    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Novo animal</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-3"
      >
        {/* Tipo */}
        <div className="space-y-1.5">
          <Label>Espécie / Tipo *</Label>
          <Select
            value={form.typeKey}
            onValueChange={(v) =>
              setForm({ ...form, typeKey: v, breedKey: "", breedCustom: "" })
            }
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANIMAL_TYPES.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.typeKey === "outro" && (
            <Input
              className={`h-11 mt-2 ${errCls("typeCustom")}`}
              value={form.typeCustom}
              maxLength={50}
              onChange={(e) => setForm({ ...form, typeCustom: e.target.value })}
              placeholder="Ex: búfalo, mula, avestruz..."
            />
          )}
          {errors.typeCustom && (
            <p className="text-xs text-destructive">{errors.typeCustom}</p>
          )}
        </div>

        {/* Identificação */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Identificação / Brinco</Label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={form.noTag}
                onCheckedChange={(c) =>
                  setForm({ ...form, noTag: !!c, identifier: "" })
                }
              />
              Sem brinco
            </label>
          </div>
          <Input
            className="h-11"
            disabled={form.noTag}
            value={form.noTag ? "" : form.identifier}
            maxLength={30}
            onChange={(e) => setForm({ ...form, identifier: e.target.value })}
            placeholder={form.noTag ? "Sem brinco" : "Ex: BR-1234"}
          />
        </div>

        {/* Raça */}
        <div className="space-y-1.5">
          <Label>Raça *</Label>
          <Select
            value={form.breedKey}
            onValueChange={(v) => setForm({ ...form, breedKey: v, breedCustom: "" })}
          >
            <SelectTrigger className={`h-11 ${errCls("breedKey")}`}>
              <SelectValue placeholder="Selecione a raça" />
            </SelectTrigger>
            <SelectContent>
              {breedOptions.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.breedKey === "Outro" && (
            <Input
              className={`h-11 mt-2 ${errCls("breedCustom")}`}
              value={form.breedCustom}
              maxLength={50}
              onChange={(e) => setForm({ ...form, breedCustom: e.target.value })}
              placeholder="Digite a raça"
            />
          )}
          {(errors.breedKey || errors.breedCustom) && (
            <p className="text-xs text-destructive">
              {errors.breedCustom || errors.breedKey}
            </p>
          )}
        </div>

        {/* Peso + Lote */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Peso (kg)</Label>
            <Input
              className={`h-11 ${errCls("weight_kg")}`}
              type="number"
              inputMode="decimal"
              min={1}
              max={9999}
              step="0.1"
              value={form.weight_kg}
              onChange={(e) => {
                const v = e.target.value;
                // Bloqueia negativos e mais de 4 dígitos inteiros
                if (v === "" || /^\d{0,4}(\.\d{0,2})?$/.test(v)) {
                  setForm({ ...form, weight_kg: v });
                }
              }}
              placeholder="450"
            />
            {errors.weight_kg && (
              <p className="text-xs text-destructive">{errors.weight_kg}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Lote</Label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={form.noLote}
                  onCheckedChange={(c) =>
                    setForm({ ...form, noLote: !!c, lote: "" })
                  }
                />
                Sem lote
              </label>
            </div>
            <Input
              className="h-11"
              disabled={form.noLote}
              value={form.noLote ? "" : form.lote}
              maxLength={30}
              onChange={(e) => setForm({ ...form, lote: e.target.value })}
              placeholder={form.noLote ? "Sem lote" : "Lote 01"}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Origem</Label>
          <Select
            value={form.origin}
            onValueChange={(v) =>
              setForm({ ...form, origin: v as "compra" | "nascimento" })
            }
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compra">Compra</SelectItem>
              <SelectItem value="nascimento">Nascimento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="submit" className="h-11 w-full" disabled={create.isPending}>
            {create.isPending ? "Salvando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
