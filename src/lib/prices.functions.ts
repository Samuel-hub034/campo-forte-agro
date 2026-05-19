import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Atualiza os preços de mercado aplicando uma pequena variação
 * pseudo-aleatória e bumpa reference_date para o dia atual.
 * Usado tanto pelo botão "Atualizar agora" na UI quanto por um
 * cron diário (pg_cron via /api/public/hooks/refresh-prices).
 *
 * Limite anti-spam: só atualiza se a última atualização foi há
 * mais de 1 hora — evita variação a cada clique do usuário.
 */
export const refreshMarketPrices = createServerFn({ method: "POST" }).handler(
  async () => {
    const { data: rows, error } = await supabaseAdmin
      .from("market_prices")
      .select("*");
    if (error) throw new Error(error.message);

    const now = Date.now();
    const updates: Array<{
      id: string;
      price: number;
      variation: number;
      reference_date: string;
    }> = [];

    for (const r of rows ?? []) {
      // Pula se atualizado há menos de 1h
      const last = new Date(r.reference_date as string).getTime();
      if (now - last < 60 * 60 * 1000) continue;

      // Variação entre -2.5% e +2.5%
      const pct = (Math.random() - 0.5) * 5;
      const newPrice = Math.max(0.01, Number(r.price) * (1 + pct / 100));
      updates.push({
        id: r.id as string,
        price: Number(newPrice.toFixed(2)),
        variation: Number(pct.toFixed(2)),
        reference_date: new Date().toISOString().slice(0, 10),
      });
    }

    for (const u of updates) {
      await supabaseAdmin
        .from("market_prices")
        .update({
          price: u.price,
          variation: u.variation,
          reference_date: u.reference_date,
        })
        .eq("id", u.id);
    }

    return { updated: updates.length, total: rows?.length ?? 0 };
  },
);
