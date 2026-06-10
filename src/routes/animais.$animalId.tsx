import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Plus,
  Scale,
  Syringe,
  AlertTriangle,
  Pill,
  Heart,
  Skull,
  StickyNote,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/animais/$animalId")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <AnimalDetail />
      </AppShell>
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Perfil do animal — AgroGestor" }] }),
});

type EventType =
  | "pesagem"
  | "vacina"
  | "doenca"
  | "medicamento"
  | "reproducao"
  | "mortalidade"
  | "observacao"
  | "venda"
  | "cadastro";

const EVENT_META: Record<
  EventType,
  { label: string; icon: typeof Scale; color: string }
> = {
  pesagem: { label: "Pesagem", icon: Scale, color: "text-blue-600" },
  vacina: { label: "Vacina", icon: Syringe, color: "text-emerald-600" },
  doenca: { label: "Doença", icon: AlertTriangle, color: "text-amber-600" },
  medicamento: { label: "Medicamento", icon: Pill, color: "text-purple-600" },
  reproducao: { label: "Reprodução", icon: Heart, color: "text-pink-600" },
  mortalidade: { label: "Mortalidade", icon: Skull, color: "text-destructive" },
  observacao: { label: "Observação", icon: StickyNote, color: "text-muted-foreground" },
  venda: { label: "Venda", icon: TrendingUp, color: "text-primary" },
  cadastro: { label: "Cadastro", icon: StickyNote, color: "text-muted-foreground" },
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function AnimalDetail() {
  const { animalId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [openEvent, setOpenEvent] = useState(false);

  const { data: animal, isLoading } = useQuery({
    queryKey: ["animal", animalId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("animals")
        .select("*")
        .eq("id", animalId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["animal-events", animalId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("animal_events")
        .select("*")
        .eq("animal_id", animalId)
        .order("event_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const removeEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("animal_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento removido");
      qc.invalidateQueries({ queryKey: ["animal-events", animalId] });
      qc.invalidateQueries({ queryKey: ["animal", animalId] });
    },
  });

  // Weight history derived from events
  const weightHistory = useMemo(() => {
    return events
      .filter((e) => e.event_type === "pesagem")
      .map((e) => ({
        date: e.event_date,
        weight: Number((e.data as { weight_kg?: number })?.weight_kg ?? 0),
      }))
      .filter((p) => p.weight > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  const gmd = useMemo(() => {
    if (weightHistory.length < 2) return null;
    const first = weightHistory[0];
    const last = weightHistory[weightHistory.length - 1];
    const days =
      (new Date(last.date).getTime() - new Date(first.date).getTime()) /
      86400000;
    if (days <= 0) return null;
    return (last.weight - first.weight) / days;
  }, [weightHistory]);

  const totalCost = events.reduce((acc, e) => acc + Number(e.cost || 0), 0);

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  }
  if (!animal) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="space-y-3 p-8 text-center">
          <p className="text-muted-foreground">Animal não encontrado.</p>
          <Button onClick={() => navigate({ to: "/animais" })}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const age = animal.birth_date
    ? Math.floor(
        (Date.now() - new Date(animal.birth_date).getTime()) /
          (1000 * 60 * 60 * 24 * 30),
      )
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={animal.identifier || "Sem brinco"}
        subtitle={`${animal.type}${animal.breed ? ` • ${animal.breed}` : ""}`}
        right={
          <Link to="/animais">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          </Link>
        }
      />

      {/* Profile cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Peso atual" value={animal.weight_kg ? `${animal.weight_kg} kg` : "—"} />
        <InfoCard
          label="GMD"
          value={gmd !== null ? `${gmd.toFixed(2)} kg/dia` : "—"}
          hint={gmd !== null ? `${weightHistory.length} pesagens` : "Sem dados"}
        />
        <InfoCard
          label="Idade"
          value={age !== null ? `${age} meses` : "—"}
          hint={animal.sex === "macho" ? "Macho ♂" : animal.sex === "femea" ? "Fêmea ♀" : "Sexo n/i"}
        />
        <InfoCard label="Custo acumulado" value={brl(totalCost)} hint={`${events.length} eventos`} />
      </div>

      <Card className="rounded-2xl">
        <CardContent className="grid gap-2 p-4 text-sm sm:grid-cols-2">
          <Field label="Status" value={<Badge variant={animal.status === "ativo" ? "default" : "secondary"}>{animal.status}</Badge>} />
          <Field label="Lote" value={animal.lote || "—"} />
          <Field label="Origem" value={animal.origin || "—"} />
          <Field
            label="Nascimento"
            value={
              animal.birth_date
                ? format(new Date(animal.birth_date), "dd/MM/yyyy")
                : "—"
            }
          />
          {animal.death_date && (
            <>
              <Field
                label="Data da morte"
                value={format(new Date(animal.death_date), "dd/MM/yyyy")}
              />
              <Field label="Motivo" value={animal.death_reason || "—"} />
            </>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="timeline">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
          <TabsTrigger value="pesos">Histórico de peso</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4 space-y-3">
          <Dialog open={openEvent} onOpenChange={setOpenEvent}>
            <DialogTrigger asChild>
              <Button size="lg" className="h-12 w-full">
                <Plus className="h-4 w-4" /> Registrar evento
              </Button>
            </DialogTrigger>
            <NewEventDialog animalId={animalId} onDone={() => setOpenEvent(false)} />
          </Dialog>

          {events.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhum evento registrado ainda.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {events.map((e) => {
                const meta = EVENT_META[e.event_type as EventType];
                const Icon = meta?.icon ?? StickyNote;
                return (
                  <Card key={e.id} className="rounded-2xl">
                    <CardContent className="flex items-start gap-3 p-4">
                      <div className={`mt-0.5 rounded-lg bg-muted p-2 ${meta?.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{e.title}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {meta?.label ?? e.event_type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(e.event_date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        {e.description && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {e.description}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {Number(e.cost) > 0 && <span>Custo: {brl(Number(e.cost))}</span>}
                          {e.next_due_date && (
                            <span>
                              Próxima: {format(new Date(e.next_due_date), "dd/MM/yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm("Remover este evento?")) removeEvent.mutate(e.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pesos" className="mt-4">
          {weightHistory.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma pesagem registrada. Use "Registrar evento" → Pesagem.
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  {weightHistory.length} pesagens •{" "}
                  {gmd !== null && `GMD ${gmd.toFixed(2)} kg/dia`}
                </div>
                <div className="space-y-1.5">
                  {[...weightHistory].reverse().map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {format(new Date(p.date), "dd/MM/yyyy")}
                      </span>
                      <span className="font-semibold">{p.weight} kg</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-xl font-bold">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

// ============= New Event Dialog =============

const eventSchema = z.object({
  event_type: z.enum([
    "pesagem",
    "vacina",
    "doenca",
    "medicamento",
    "reproducao",
    "mortalidade",
    "observacao",
  ]),
  event_date: z.string().min(1, "Data obrigatória"),
  title: z.string().trim().min(2, "Título muito curto").max(120),
  description: z.string().trim().max(500).optional(),
  weight_kg: z.string().optional(),
  cost: z.string().optional(),
  next_due_date: z.string().optional(),
});

function NewEventDialog({
  animalId,
  onDone,
}: {
  animalId: string;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    event_type: "pesagem" as EventType,
    event_date: today,
    title: "",
    description: "",
    weight_kg: "",
    cost: "",
    next_due_date: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem sessão");
      const parsed = eventSchema.safeParse(form);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.issues.forEach((i) => {
          errs[i.path[0] as string] = i.message;
        });
        setErrors(errs);
        throw new Error("Corrija os campos destacados");
      }
      // Pesagem requires valid weight
      if (form.event_type === "pesagem") {
        const w = Number(form.weight_kg);
        if (!w || w <= 0 || w > 9999) {
          setErrors({ weight_kg: "Peso inválido (1 a 9999 kg)" });
          throw new Error("Peso inválido");
        }
      }
      // Date sanity
      if (new Date(form.event_date) > new Date()) {
        setErrors({ event_date: "Data no futuro não permitida" });
        throw new Error("Data inválida");
      }
      const cost = Number(form.cost || 0);
      if (cost < 0 || cost > 999999) {
        setErrors({ cost: "Custo inválido" });
        throw new Error("Custo inválido");
      }
      setErrors({});

      const data: Record<string, number | string> = {};
      if (form.event_type === "pesagem" && form.weight_kg) {
        data.weight_kg = Number(form.weight_kg);
      }

      const { error } = await supabase.from("animal_events").insert({
        user_id: user.id,
        animal_id: animalId,
        event_type: form.event_type,
        event_date: form.event_date,
        title: form.title.trim(),
        description: form.description.trim() || null,
        data,
        cost,
        next_due_date: form.next_due_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento registrado");
      qc.invalidateQueries({ queryKey: ["animal-events", animalId] });
      qc.invalidateQueries({ queryKey: ["animal", animalId] });
      qc.invalidateQueries({ queryKey: ["animals"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const errCls = (k: string) =>
    errors[k] ? "border-destructive focus-visible:ring-destructive" : "";

  const showWeight = form.event_type === "pesagem";
  const showNextDue =
    form.event_type === "vacina" || form.event_type === "medicamento";

  return (
    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Novo evento</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-3"
      >
        <div className="space-y-1.5">
          <Label>Tipo *</Label>
          <Select
            value={form.event_type}
            onValueChange={(v) =>
              setForm({ ...form, event_type: v as EventType })
            }
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EVENT_META).map(([key, meta]) => (
                <SelectItem key={key} value={key}>
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Data *</Label>
            <Input
              type="date"
              max={today}
              className={`h-11 ${errCls("event_date")}`}
              value={form.event_date}
              onChange={(e) => setForm({ ...form, event_date: e.target.value })}
            />
            {errors.event_date && (
              <p className="text-xs text-destructive">{errors.event_date}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Custo (R$)</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={999999}
              step="0.01"
              className={`h-11 ${errCls("cost")}`}
              value={form.cost}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d{0,6}(\.\d{0,2})?$/.test(v)) {
                  setForm({ ...form, cost: v });
                }
              }}
              placeholder="0,00"
            />
            {errors.cost && (
              <p className="text-xs text-destructive">{errors.cost}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Título *</Label>
          <Input
            className={`h-11 ${errCls("title")}`}
            maxLength={120}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={
              form.event_type === "vacina"
                ? "Ex: Aftosa - 1ª dose"
                : form.event_type === "pesagem"
                ? "Ex: Pesagem mensal"
                : "Resumo do evento"
            }
          />
          {errors.title && (
            <p className="text-xs text-destructive">{errors.title}</p>
          )}
        </div>

        {showWeight && (
          <div className="space-y-1.5">
            <Label>Peso (kg) *</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={1}
              max={9999}
              step="0.1"
              className={`h-11 ${errCls("weight_kg")}`}
              value={form.weight_kg}
              onChange={(e) => {
                const v = e.target.value;
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
        )}

        {showNextDue && (
          <div className="space-y-1.5">
            <Label>Próxima dose / retorno</Label>
            <Input
              type="date"
              className="h-11"
              value={form.next_due_date}
              onChange={(e) =>
                setForm({ ...form, next_due_date: e.target.value })
              }
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Observações</Label>
          <Textarea
            maxLength={500}
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Detalhes, lote da vacina, responsável..."
          />
        </div>

        <DialogFooter>
          <Button
            type="submit"
            className="h-11 w-full"
            disabled={create.isPending}
          >
            {create.isPending ? "Salvando..." : "Registrar evento"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
