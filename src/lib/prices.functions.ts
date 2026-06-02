import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Atualiza os preços por estado aplicando random walk realista
 * (proxy enquanto não há integração real com CEPEA/CNA/Embrapa).
 * Calcula variação diária/semanal e grava histórico.
 *
 * Anti-spam: só roda se a última atualização foi há mais de 30 min.
 */
export const refreshMarketPrices = createServerFn({ method: "POST" }).handler(
  async () => {
    const { data: rows, error } = await supabaseAdmin
      .from("market_prices_states")
      .select("*");
    if (error) throw new Error(error.message);

    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    let updated = 0;

    for (const r of rows ?? []) {
      const last = new Date(r.updated_at as string).getTime();
      if (now - last < 30 * 60 * 1000) continue;

      const pct = (Math.random() - 0.5) * 4; // ±2%
      const newPrice = Math.max(
        0.01,
        Number(Number(r.price) * (1 + pct / 100)).toFixed(2),
      );

      // Variação semanal: compara com preço de ~7 dias atrás
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: weekRow } = await supabaseAdmin
        .from("market_price_history")
        .select("price")
        .eq("product", r.product)
        .eq("state", r.state)
        .lte("reference_date", weekAgo.toISOString().slice(0, 10))
        .order("reference_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const weekVar = weekRow
        ? ((Number(newPrice) - Number(weekRow.price)) / Number(weekRow.price)) *
          100
        : pct;

      await supabaseAdmin
        .from("market_prices_states")
        .update({
          price: Number(newPrice),
          variation_day: Number(pct.toFixed(2)),
          variation_week: Number(weekVar.toFixed(2)),
          reference_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq("id", r.id as string);

      await supabaseAdmin.from("market_price_history").upsert(
        {
          product: r.product,
          state: r.state,
          price: Number(newPrice),
          reference_date: today,
        },
        { onConflict: "product,state,reference_date" },
      );

      updated++;
    }

    return { updated, total: rows?.length ?? 0 };
  },
);
