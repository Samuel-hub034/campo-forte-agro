import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Gera insights inteligentes sobre a fazenda usando Lovable AI.
 * Agrega dados de vendas, rebanho, saúde e leite, envia ao modelo
 * e retorna insights + sugestões em texto curto.
 */
export const generateFarmInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .slice(0, 10);
    const endPrev = new Date(now.getFullYear(), now.getMonth(), 0)
      .toISOString()
      .slice(0, 10);

    const [salesMonth, salesPrev, animals, events, milk] = await Promise.all([
      supabase.from("sales").select("category,total,quantity,sale_date,item,buyer").gte("sale_date", startMonth),
      supabase.from("sales").select("category,total,quantity").gte("sale_date", startPrev).lte("sale_date", endPrev),
      supabase.from("animals").select("id,type,breed,status,weight_kg,lote"),
      supabase.from("animal_events").select("event_type,event_date,data,cost").gte("event_date", startMonth),
      supabase.from("animal_events").select("event_date,data").eq("event_type", "pesagem").gte("event_date", startMonth),
    ]);

    const sum = (arr: any[], k: string) =>
      (arr ?? []).reduce((a, b) => a + Number(b?.[k] ?? 0), 0);

    const rev = sum(salesMonth.data ?? [], "total");
    const revPrev = sum(salesPrev.data ?? [], "total");
    const cnt = (salesMonth.data ?? []).length;
    const animalsAlive = (animals.data ?? []).filter((a) => a.status === "ativo").length;
    const animalsDead = (animals.data ?? []).filter((a) => a.status === "morto").length;
    const byBreed: Record<string, number> = {};
    for (const a of animals.data ?? []) {
      if (a.breed) byBreed[a.breed] = (byBreed[a.breed] ?? 0) + 1;
    }
    const events30 = events.data ?? [];
    const vacinas = events30.filter((e) => e.event_type === "vacina").length;
    const doencas = events30.filter((e) => e.event_type === "doenca").length;
    const nascimentos = events30.filter((e) => e.event_type === "reproducao").length;
    const milkLiters = (milk.data ?? []).reduce(
      (a, b: any) => a + Number(b?.data?.liters ?? 0),
      0,
    );

    const summary = {
      faturamento_mes: rev,
      faturamento_mes_anterior: revPrev,
      crescimento_pct:
        revPrev > 0 ? ((rev - revPrev) / revPrev) * 100 : null,
      vendas_count: cnt,
      ticket_medio: cnt > 0 ? rev / cnt : 0,
      animais_ativos: animalsAlive,
      animais_mortos: animalsDead,
      racas: byBreed,
      vacinas_mes: vacinas,
      doencas_mes: doencas,
      nascimentos_mes: nascimentos,
      litros_leite_mes: milkLiters,
    };

    const prompt = `Você é um consultor agropecuário. Analise os dados abaixo da fazenda e gere:
1) 3 a 5 insights curtos e objetivos (1 frase cada), começando com emoji apropriado.
2) 2 a 3 sugestões práticas de ação.

Use português do Brasil, tom amigável e direto. Cite números quando relevante. Não invente dados ausentes.

DADOS:
${JSON.stringify(summary, null, 2)}

Responda em JSON estrito:
{"insights":["..."],"sugestoes":["..."]}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429)
      throw new Error("Limite de uso da IA atingido. Tente novamente em alguns instantes.");
    if (resp.status === 402)
      throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
    if (!resp.ok) throw new Error(`Erro IA (${resp.status})`);

    const json = await resp.json();
    let content = json?.choices?.[0]?.message?.content ?? "{}";
    if (typeof content !== "string") content = JSON.stringify(content);
    let parsed: { insights?: string[]; sugestoes?: string[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { insights: [content], sugestoes: [] };
    }

    return {
      summary,
      insights: parsed.insights ?? [],
      sugestoes: parsed.sugestoes ?? [],
      generated_at: new Date().toISOString(),
    };
  });
