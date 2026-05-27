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

function SubscriptionPage() {
  const { user, signOut } = useAuth();
  const { subscription, status, hasAccess } = useAccess();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [planId, setPlanId] = useState<PlanId>("anual");
  const [method, setMethod] = useState<"pix" | "credito" | "debito" | "boleto">("pix");
  const [processing, setProcessing] = useState(false);
  const [approved, setApproved] = useState(hasAccess);

  const { data: promos } = useQuery({
    queryKey: ["promotions-active"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("promotions")
        .select("*")
        .eq("active", true);
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
      const { error: subErr } = await supabase
        .from("subscriptions")
        .upsert(
          {
            user_id: user.id,
            status: "ativa",
            amount: finalPrice,
            plan: planId,
            payment_method: method,
            started_at: now.toISOString(),
            expires_at: expires.toISOString(),
            updated_at: now.toISOString(),
          },
          { onConflict: "user_id" },
        );
      if (subErr) throw subErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access"] });
      setApproved(true);
      toast.success("Assinatura ativada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const simulate = async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1200));
    await activate.mutateAsync();
    setProcessing(false);
  };

  if (approved || hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Pagamento aprovado</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Assinatura ativada com sucesso. Bem-vindo ao AgroGestor!
              </p>
            </div>
            <Button size="lg" className="h-12 w-full text-base" onClick={() => navigate({ to: "/" })}>
              Continuar para o sistema
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
    ativa: { title: "Assinatura", sub: "" },
  };
  const head = headlineByStatus[status] ?? headlineByStatus.pendente;

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

        {/* Plan cards */}
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
    </div>
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
