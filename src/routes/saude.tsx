import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
import { VET_SPECIES, getBreedsForSpecies } from "@/lib/breeds";
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

const vetSchema = z.object({
  speciesKey: z.string().min(1),
  speciesCustom: z.string().trim().max(50).optional(),
  breedKey: z.string().optional(),
  breedCustom: z.string().trim().max(50).optional(),
  ageMonths: z
    .string()
    .optional()
    .refine(
      (v) => !v || (/^\d{1,3}$/.test(v) && Number(v) >= 0 && Number(v) <= 999),
      "Idade inválida (0–999 meses)",
    ),
  weightKg: z
    .string()
    .optional()
    .refine(
      (v) => !v || (/^\d{1,4}(\.\d{1,2})?$/.test(v) && Number(v) > 0 && Number(v) <= 9999),
      "Peso inválido (1–9999 kg)",
    ),
  symptoms: z.string().trim().min(10, "Descreva os sintomas (mín. 10 caracteres)").max(2000),
});

function SaudeAnimal() {
  const ask = useServerFn(askVetAssistant);
  const [form, setForm] = useState({
    speciesKey: "bovino",
    speciesCustom: "",
    breedKey: "",
    breedCustom: "",
    sex: "desconhecido" as "macho" | "femea" | "desconhecido",
    ageMonths: "",
    weightKg: "",
    symptoms: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const breedOptions = useMemo(
    () => getBreedsForSpecies(form.speciesKey),
    [form.speciesKey],
  );

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
    const parsed = vetSchema.safeParse(form);
    const errs: Record<string, string> = {};
    if (!parsed.success) {
      parsed.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message;
      });
    }
    if (form.speciesKey === "outro" && !form.speciesCustom.trim()) {
      errs.speciesCustom = "Informe a espécie";
    }
    if (form.breedKey === "Outro" && !form.breedCustom.trim()) {
      errs.breedCustom = "Informe a raça";
    }
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error("Corrija os campos destacados");
      return;
    }
    setErrors({});

    const speciesLabel =
      form.speciesKey === "outro"
        ? form.speciesCustom.trim()
        : VET_SPECIES.find((s) => s.key === form.speciesKey)?.label ?? form.speciesKey;
    const breedLabel =
      form.breedKey === "Outro"
        ? form.breedCustom.trim()
        : form.breedKey || undefined;

    mut.mutate({
      species: speciesLabel,
      breed: breedLabel,
      sex: form.sex,
      ageMonths: form.ageMonths ? Number(form.ageMonths) : undefined,
      weightKg: form.weightKg ? Number(form.weightKg) : undefined,
      symptoms: form.symptoms.trim(),
    });
  }

  function addSymptom(s: string) {
    setForm((f) => ({
      ...f,
      symptoms: f.symptoms ? `${f.symptoms}, ${s}` : s,
    }));
  }

  const errCls = (k: string) =>
    errors[k] ? "border-destructive focus-visible:ring-destructive" : "";

  return (
    <div className="space-y-5">
      <PageHeader title="Saúde Animal" subtitle="Assistente veterinário com IA" />

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
                <Label>Espécie *</Label>
                <Select
                  value={form.speciesKey}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      speciesKey: v,
                      breedKey: "",
                      breedCustom: "",
                    })
                  }
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VET_SPECIES.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.speciesKey === "outro" && (
                  <Input
                    className={`h-11 mt-2 ${errCls("speciesCustom")}`}
                    value={form.speciesCustom}
                    maxLength={50}
                    onChange={(e) =>
                      setForm({ ...form, speciesCustom: e.target.value })
                    }
                    placeholder="Digite a espécie"
                  />
                )}
                {errors.speciesCustom && (
                  <p className="text-xs text-destructive">{errors.speciesCustom}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Raça (opcional)</Label>
                <Select
                  value={form.breedKey}
                  onValueChange={(v) =>
                    setForm({ ...form, breedKey: v, breedCustom: "" })
                  }
                >
                  <SelectTrigger className="h-11">
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
                    onChange={(e) =>
                      setForm({ ...form, breedCustom: e.target.value })
                    }
                    placeholder="Digite a raça"
                  />
                )}
                {errors.breedCustom && (
                  <p className="text-xs text-destructive">{errors.breedCustom}</p>
                )}
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
                    className={`h-11 ${errCls("ageMonths")}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={999}
                    value={form.ageMonths}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d{0,3}$/.test(v)) {
                        setForm({ ...form, ageMonths: v });
                      }
                    }}
                    placeholder="24"
                  />
                  {errors.ageMonths && (
                    <p className="text-xs text-destructive">{errors.ageMonths}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Peso (kg)</Label>
                  <Input
                    className={`h-11 ${errCls("weightKg")}`}
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={9999}
                    step="0.1"
                    value={form.weightKg}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d{0,4}(\.\d{0,2})?$/.test(v)) {
                        setForm({ ...form, weightKg: v });
                      }
                    }}
                    placeholder="450"
                  />
                  {errors.weightKg && (
                    <p className="text-xs text-destructive">{errors.weightKg}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Sintomas observados *</Label>
              <Textarea
                rows={4}
                maxLength={2000}
                className={errCls("symptoms")}
                value={form.symptoms}
                onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                placeholder="Ex: animal com febre desde ontem, parou de comer, está apático..."
              />
              <div className="flex items-center justify-between">
                {errors.symptoms ? (
                  <p className="text-xs text-destructive">{errors.symptoms}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Mínimo 10 caracteres.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {form.symptoms.length}/2000
                </p>
              </div>
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
                      <span className="font-medium text-foreground">Dose:</span>{" "}
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
