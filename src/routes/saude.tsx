import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Stethoscope,
  AlertTriangle,
  Pill,
  HeartPulse,
  Phone,
  Sparkles,
} from "lucide-react";
import { askVetAssistant, type VetAdvice } from "@/lib/vet.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/saude")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <SaudeAnimal />
      </AppShell>
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Saúde Animal — AgroGestor" }] }),
});

const species = [
  "Bovino (boi/vaca)",
  "Bezerro",
  "Cavalo",
  "Cabra",
  "Ovelha",
  "Porco",
  "Aves (galinha/frango)",
  "Outro",
];

const commonSymptoms = [
  "febre",
  "tristeza",
  "não come",
  "tosse",
  "diarreia",
  "feridas",
  "dificuldade respiratória",
  "mancando",
  "comportamento estranho",
];

const urgencyMap = {
  baixa: { label: "Baixa", className: "bg-success/10 text-success" },
  media: { label: "Média", className: "bg-amber-500/10 text-amber-600" },
  alta: { label: "Alta", className: "bg-orange-500/10 text-orange-600" },
  emergencia: {
    label: "EMERGÊNCIA",
    className: "bg-destructive/10 text-destructive",
  },
};

function SaudeAnimal() {
  const ask = useServerFn(askVetAssistant);
  const [form, setForm] = useState({
    species: species[0],
    breed: "",
    sex: "desconhecido" as "macho" | "femea" | "desconhecido",
    ageMonths: "",
    weightKg: "",
    symptoms: "",
  });

  type VetInput = {
    species: string;
    breed?: string;
    sex: "macho" | "femea" | "desconhecido";
    ageMonths?: number;
    weightKg?: number;
    symptoms: string;
  };
  const mut = useMutation({
    mutationFn: (input: VetInput) => ask({ data: input }),
    onError: (e: Error) => toast.error(e.message),
  });

  const advice: VetAdvice | undefined = mut.data;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.symptoms.trim()) {
      toast.error("Descreva os sintomas");
      return;
    }
    mut.mutate({
      species: form.species,
      breed: form.breed,
      sex: form.sex,
      ageMonths: form.ageMonths ? Number(form.ageMonths) : undefined,
      weightKg: form.weightKg ? Number(form.weightKg) : undefined,
      symptoms: form.symptoms,
    });
  }

  function addSymptom(s: string) {
    setForm((f) => ({
      ...f,
      symptoms: f.symptoms ? `${f.symptoms}, ${s}` : s,
    }));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Saúde Animal"
        subtitle="Assistente veterinário com IA"
      />

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          As recomendações são geradas por IA e <strong>não substituem</strong> a
          avaliação de um veterinário. Em emergências, procure um profissional
          imediatamente.
        </AlertDescription>
      </Alert>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="h-5 w-5 text-primary" />
            Descreva o caso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Espécie</Label>
                <Select
                  value={form.species}
                  onValueChange={(v) => setForm({ ...form, species: v })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {species.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Raça (opcional)</Label>
                <Input
                  className="h-11"
                  value={form.breed}
                  onChange={(e) => setForm({ ...form, breed: e.target.value })}
                  placeholder="Nelore, Holandesa..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sexo</Label>
                <Select
                  value={form.sex}
                  onValueChange={(v) =>
                    setForm({ ...form, sex: v as typeof form.sex })
                  }
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="macho">Macho</SelectItem>
                    <SelectItem value="femea">Fêmea</SelectItem>
                    <SelectItem value="desconhecido">Não informar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Idade (meses)</Label>
                  <Input
                    className="h-11"
                    type="number"
                    min={0}
                    value={form.ageMonths}
                    onChange={(e) =>
                      setForm({ ...form, ageMonths: e.target.value })
                    }
                    placeholder="24"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Peso (kg)</Label>
                  <Input
                    className="h-11"
                    type="number"
                    min={0}
                    step="0.1"
                    value={form.weightKg}
                    onChange={(e) =>
                      setForm({ ...form, weightKg: e.target.value })
                    }
                    placeholder="450"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Sintomas observados</Label>
              <Textarea
                rows={4}
                value={form.symptoms}
                onChange={(e) =>
                  setForm({ ...form, symptoms: e.target.value })
                }
                placeholder="Ex: animal com febre desde ontem, parou de comer, está apático..."
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {commonSymptoms.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addSymptom(s)}
                    className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              disabled={mut.isPending}
              className="h-11 w-full sm:w-auto"
            >
              <Sparkles className="h-4 w-4" />
              {mut.isPending ? "Analisando..." : "Consultar assistente"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {advice && (
        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Nível de urgência
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {urgencyMap[advice.urgency]?.label ?? advice.urgency}
                </div>
              </div>
              <Badge
                className={`px-3 py-1.5 text-xs ${
                  urgencyMap[advice.urgency]?.className ?? ""
                }`}
              >
                {advice.urgency === "emergencia" ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  <HeartPulse className="h-3.5 w-3.5" />
                )}
              </Badge>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Possíveis causas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {advice.possibleCauses?.map((c, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {c.description}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Cuidados imediatos</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {advice.immediateCare?.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {advice.medications?.length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Pill className="h-4 w-4 text-primary" /> Medicamentos sugeridos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {advice.medications.map((m, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.frequency}
                      </div>
                    </div>
                    <div className="mt-1 text-sm">
                      <span className="font-medium text-foreground">
                        Dose:
                      </span>{" "}
                      {m.dosage}
                    </div>
                    {m.notes && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        ⚠️ {m.notes}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl border-primary/30">
            <CardContent className="flex gap-3 p-4">
              <Phone className="h-5 w-5 shrink-0 text-primary" />
              <div className="text-sm">
                <div className="font-semibold">Quando chamar o veterinário</div>
                <div className="mt-1 text-muted-foreground">
                  {advice.whenToCallVet}
                </div>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {advice.disclaimer}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
