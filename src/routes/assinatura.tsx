import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useAccess } from "@/lib/use-access";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sprout,
  CheckCircle2,
  QrCode,
  CreditCard,
  Barcode,
  ShieldCheck,
  LogOut,
  Loader2,
  Copy,
  Sparkles,
  Gift,
  CalendarClock,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PLANS, type PlanId, brl, applyPromo, type Promotion } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assinatura")({
  component: () => (
    <RequireAuth allowWithoutSubscription>
      <SubscriptionPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Assinatura — AgroGestor" }] }),
});

const TRIAL_DAYS = 7;

/** Simple deterministic fingerprint for the card (demo-grade). */
async function fingerprintCard(digits: string) {
  const buf = new TextEncoder().encode(`agro:${digits}`);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function validCard(num: string, name: string, exp: string, cvv: string) {
  const d = num.replace(/\D/g, "");
  if (d.length < 13 || d.length > 19) return "Número do cartão inválido";
  if (name.trim().length < 3) return "Informe o nome impresso no cartão";
  const m = /^(\d{2})\/(\d{2})$/.exec(exp);
  if (!m) return "Validade deve estar no formato MM/AA";
  const mm = +m[1], yy = +m[2];
  if (mm < 1 || mm > 12) return "Mês de validade inválido";
  const expDate = new Date(2000 + yy, mm, 0, 23, 59, 59);
  if (expDate.getTime() < Date.now()) return "Cartão vencido";
  if (!/^\d{3,4}$/.test(cvv)) return "CVV inválido";
  return null;
}

function SubscriptionPage() {
  const { user, signOut } = useAuth();
  const { subscription, status, hasAccess, trialDaysLeft } = useAccess();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [planId, setPlanId] = useState<PlanId>("anual");
  const [method, setMethod] = useState<"pix" | "credito" | "debito" | "boleto">("pix");
  const [processing, setProcessing] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);

  const { data: promos } = useQuery({
    queryKey: ["promotions-active"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("promotions").select("*").eq("active", true);
      return (data ?? []) as Promotion[];
    },
  });

  const plan = PLANS.find((p) => p.id === planId)!;
  const promo = useMemo(() => applyPromo(planId, plan.price, promos), [planId, plan.price, promos]);
  const finalPrice = promo.final;

  const activate = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem sessão");
      const now = new Date();
      const expires = new Date(now);
      expires.setMonth(expires.getMonth() + plan.months);
      const { error } = await supabase.from("subscriptions").upsert(
        {
          user_id: user.id,
          status: "ativa",
          amount: finalPrice,
          plan: planId,
          payment_method: method,
          started_at: now.toISOString(),
          expires_at: expires.toISOString(),
          trial_ends_at: null,
          cancelled_at: null,
          auto_renew: true,
          updated_at: now.toISOString(),
        } as never,
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access"] });
      toast.success("Assinatura ativada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const simulate = async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1000));
    await activate.mutateAsync();
    setProcessing(false);
  };

  const cancel = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("subscriptions")
        .update({
          status: "cancelada",
          auto_renew: false,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as never)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access"] });
      toast.success("Assinatura cancelada. Acesso premium encerrado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Active subscription / trial view
  if (hasAccess) {
    const sub = subscription as (typeof subscription & {
      trial_ends_at?: string | null;
      auto_renew?: boolean;
      card_last4?: string | null;
    }) | null;
    const isTrial = status === "trial";
    const nextCharge = isTrial ? sub?.trial_ends_at : sub?.expires_at;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className={cn(
              "grid h-16 w-16 place-items-center rounded-full",
              isTrial ? "bg-primary/10 text-primary" : "bg-success/10 text-success",
            )}>
              {isTrial ? <Gift className="h-9 w-9" /> : <CheckCircle2 className="h-9 w-9" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {isTrial ? "Teste grátis ativo" : "Assinatura ativa"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isTrial
                  ? `Você tem ${trialDaysLeft} dia${trialDaysLeft === 1 ? "" : "s"} restante${trialDaysLeft === 1 ? "" : "s"}.`
                  : "Bem-vindo ao AgroGestor."}
              </p>
            </div>
            {nextCharge && (
              <div className="w-full rounded-lg border bg-muted/40 p-3 text-left text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                  <span>{isTrial ? "Cobrança automática em" : "Próxima renovação em"}</span>
                </div>
                <div className="font-semibold">
                  {new Date(nextCharge).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                </div>
                {sub?.card_last4 && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Cartão final •••• {sub.card_last4} • Renovação {sub.auto_renew === false ? "desativada" : "automática"}
                  </div>
                )}
              </div>
            )}
            <Button size="lg" className="h-12 w-full text-base" onClick={() => navigate({ to: "/" })}>
              Continuar para o sistema
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={cancel.isPending}
              onClick={() => {
                if (confirm("Cancelar agora encerra seu acesso premium imediatamente. Continuar?")) {
                  cancel.mutate();
                }
              }}
            >
              <XCircle className="h-4 w-4" />
              {isTrial ? "Cancelar teste grátis" : "Cancelar assinatura"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const headlineByStatus: Record<string, { title: string; sub: string }> = {
    pendente: { title: "Escolha seu plano", sub: "Selecione o melhor período para você." },
    vencida: { title: "Sua assinatura venceu", sub: "Renove para continuar usando o sistema." },
    atrasada: { title: "Pagamento em atraso", sub: "Regularize sua assinatura para liberar o acesso." },
    cancelada: { title: "Assinatura cancelada", sub: "Reative escolhendo um plano abaixo." },
    ativa: { title: "Assinatura", sub: "" },
  };
  const head = headlineByStatus[status] ?? headlineByStatus.pendente;

  // Trial only available for fully-new users (no subscription record / status pendente, never trialed)
  const trialEligible = status === "pendente" && !subscription;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl gradient-field text-primary-foreground">
              <Sprout className="h-5 w-5" />
            </span>
            <span className="text-xl font-bold">AgroGestor</span>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">{head.title}</h1>
          <p className="mt-1 text-muted-foreground">{head.sub}</p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {PLANS.map((p) => {
            const sel = p.id === planId;
            const pPromo = applyPromo(p.id, p.price, promos);
            const monthly = pPromo.final / p.months;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlanId(p.id)}
                className={cn(
                  "relative rounded-2xl border-2 p-4 text-left transition-all",
                  sel ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/40",
                )}
              >
                {p.highlight && (
                  <Badge className="absolute -top-2 right-3 gap-1">
                    <Sparkles className="h-3 w-3" /> Mais vantajoso
                  </Badge>
                )}
                <div className="text-xs uppercase text-muted-foreground">{p.label}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  {pPromo.promo && (
                    <span className="text-sm text-muted-foreground line-through">{brl(p.price)}</span>
                  )}
                  <span className="text-2xl font-bold text-primary">{brl(pPromo.final)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {brl(monthly)}/mês{p.months > 1 ? ` • ${p.months} meses` : ""}
                </div>
                {(p.savePct > 0 || pPromo.promo) && (
                  <div className="mt-2 text-xs font-semibold text-success">
                    {pPromo.promo
                      ? `${pPromo.promo.name} — economize ${brl(pPromo.off)}`
                      : `Economize ${p.savePct}%`}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <Card className="mb-6 rounded-2xl border-primary/20 bg-gradient-to-br from-primary/10 to-transparent">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Plano {plan.label}</div>
              <div className="flex items-baseline gap-2">
                {promo.promo && (
                  <span className="text-base text-muted-foreground line-through">{brl(plan.price)}</span>
                )}
                <div className="text-3xl font-bold text-primary">{brl(finalPrice)}</div>
              </div>
              {promo.promo && (
                <div className="text-xs font-semibold text-success">
                  🎉 {promo.promo.name} aplicada — economia de {brl(promo.off)}
                </div>
              )}
            </div>
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              Acesso total
            </Badge>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Escolha a forma de pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="pix">PIX</TabsTrigger>
                <TabsTrigger value="credito">Crédito</TabsTrigger>
                <TabsTrigger value="debito">Débito</TabsTrigger>
                <TabsTrigger value="boleto">Boleto</TabsTrigger>
              </TabsList>
              <TabsContent value="pix" className="pt-4"><PixView /></TabsContent>
              <TabsContent value="credito" className="pt-4"><CardView label="Cartão de Crédito" /></TabsContent>
              <TabsContent value="debito" className="pt-4"><CardView label="Cartão de Débito" /></TabsContent>
              <TabsContent value="boleto" className="pt-4"><BoletoView /></TabsContent>
            </Tabs>

            <Button onClick={simulate} disabled={processing} size="lg" className="mt-6 h-12 w-full text-base">
              {processing ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Processando pagamento...</>
              ) : (
                <>Confirmar pagamento de {brl(finalPrice)}</>
              )}
            </Button>

            {trialEligible && (
              <div className="mt-3 flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTrialOpen(true)}
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Experimentar gratuitamente por {TRIAL_DAYS} dias
                </button>
                <p className="text-[10px] text-muted-foreground">
                  Cartão obrigatório • cobrança automática após o período
                </p>
              </div>
            )}

            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Ambiente de demonstração — pagamento simulado.
            </p>
          </CardContent>
        </Card>

        {subscription && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Status atual: <span className="font-semibold">{status}</span>
          </p>
        )}
      </div>

      <TrialDialog
        open={trialOpen}
        onOpenChange={setTrialOpen}
        planId={planId}
        planLabel={plan.label}
        finalPrice={finalPrice}
        onActivated={() => {
          setTrialOpen(false);
          qc.invalidateQueries({ queryKey: ["access"] });
        }}
      />
    </div>
  );
}

function TrialDialog({
  open,
  onOpenChange,
  planId,
  planLabel,
  finalPrice,
  onActivated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  planId: PlanId;
  planLabel: string;
  finalPrice: number;
  onActivated: () => void;
}) {
  const { user } = useAuth();
  const [num, setNum] = useState("");
  const [name, setName] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleActivate = async () => {
    if (!user) return;
    const err = validCard(num, name, exp, cvv);
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      const digits = num.replace(/\D/g, "");
      const fp = await fingerprintCard(digits);
      const last4 = digits.slice(-4);

      // Anti-abuse: register email + card fingerprint. Unique constraint
      // blocks re-use across accounts.
      const { error: usageErr } = await supabase.from("trial_usage").insert({
        user_id: user.id,
        email: (user.email ?? "").toLowerCase(),
        card_fingerprint: fp,
      } as never);
      if (usageErr) {
        if (usageErr.code === "23505") {
          toast.error("Este e-mail ou cartão já usou o teste grátis.");
        } else {
          toast.error(usageErr.message);
        }
        setSubmitting(false);
        return;
      }

      const now = new Date();
      const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 86_400_000);
      const { error: subErr } = await supabase.from("subscriptions").upsert(
        {
          user_id: user.id,
          status: "trial",
          amount: finalPrice,
          plan: planId,
          payment_method: "credito",
          started_at: now.toISOString(),
          expires_at: null,
          trial_ends_at: trialEnd.toISOString(),
          auto_renew: true,
          cancelled_at: null,
          card_fingerprint: fp,
          card_last4: last4,
          updated_at: now.toISOString(),
        } as never,
        { onConflict: "user_id" },
      );
      if (subErr) {
        toast.error(subErr.message);
        setSubmitting(false);
        return;
      }
      toast.success(`Teste grátis ativado — ${TRIAL_DAYS} dias liberados!`);
      onActivated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Teste grátis por {TRIAL_DAYS} dias
          </DialogTitle>
          <DialogDescription>
            Acesso total durante {TRIAL_DAYS} dias. Sem cobrança hoje — após o período,
            renovamos automaticamente no plano <b>{planLabel}</b> por <b>{brl(finalPrice)}</b>.
            Cancele a qualquer momento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Número do cartão</Label>
            <Input
              inputMode="numeric"
              maxLength={19}
              placeholder="0000 0000 0000 0000"
              value={num}
              onChange={(e) => setNum(e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim())}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nome impresso</Label>
            <Input value={name} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="NOME COMPLETO" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Validade</Label>
              <Input
                placeholder="MM/AA"
                maxLength={5}
                value={exp}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                  setExp(v);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CVV</Label>
              <Input inputMode="numeric" maxLength={4} placeholder="123" value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Ao continuar você autoriza a cobrança automática ao final do teste. O teste é
            válido uma única vez por usuário e cartão.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleActivate} disabled={submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Ativando...</> : "Iniciar teste grátis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PixView() {
  const fakeKey = "agrogestor@pix.com.br";
  return (
    <div className="space-y-3 text-center">
      <div className="mx-auto grid h-48 w-48 place-items-center rounded-xl border-2 border-dashed border-border bg-muted/40">
        <QrCode className="h-32 w-32 text-foreground/80" />
      </div>
      <div className="rounded-lg bg-muted p-3 text-left">
        <div className="text-[11px] uppercase text-muted-foreground">Chave PIX</div>
        <div className="flex items-center justify-between gap-2">
          <code className="text-sm font-medium">{fakeKey}</code>
          <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(fakeKey); toast.success("Chave copiada"); }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CardView({ label }: { label: string }) {
  const [num, setNum] = useState("");
  const [name, setName] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary/60 p-5 text-primary-foreground">
        <CreditCard className="absolute right-4 top-4 h-8 w-8 opacity-60" />
        <div className="text-[10px] uppercase opacity-80">{label}</div>
        <div className="mt-6 font-mono text-lg tracking-widest">{num || "•••• •••• •••• ••••"}</div>
        <div className="mt-4 flex justify-between text-xs">
          <div><div className="opacity-70">Titular</div><div className="font-medium">{name || "NOME DO TITULAR"}</div></div>
          <div><div className="opacity-70">Validade</div><div className="font-medium">{exp || "MM/AA"}</div></div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Número do cartão</Label>
        <Input className="h-11" inputMode="numeric" maxLength={19} placeholder="0000 0000 0000 0000" value={num}
          onChange={(e) => setNum(e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim())} />
      </div>
      <div className="space-y-1.5">
        <Label>Nome impresso</Label>
        <Input className="h-11" value={name} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="NOME COMPLETO" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Validade</Label><Input className="h-11" placeholder="MM/AA" maxLength={5} value={exp} onChange={(e) => setExp(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>CVV</Label><Input className="h-11" inputMode="numeric" maxLength={4} placeholder="123" value={cvv} onChange={(e) => setCvv(e.target.value)} /></div>
      </div>
    </div>
  );
}

function BoletoView() {
  const line = "23793.38128 60082.512345 67890.123456 7 89540000012000";
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2"><Barcode className="h-6 w-6" /><div className="text-sm font-semibold">Boleto bancário</div></div>
        <div className="mt-3 flex h-16 items-stretch gap-0.5">
          {Array.from({ length: 60 }).map((_, i) => (
            <div key={i} className="bg-foreground" style={{ width: (i % 3) + 1 + "px" }} />
          ))}
        </div>
        <div className="mt-2 font-mono text-xs">{line}</div>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(line); toast.success("Linha digitável copiada"); }}>
          <Copy className="h-3.5 w-3.5" />Copiar linha digitável
        </Button>
      </div>
    </div>
  );
}
