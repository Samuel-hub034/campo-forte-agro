export const MONTHLY_PRICE = 120;

export type PlanId = "mensal" | "trimestral" | "anual";

export const PLANS: {
  id: PlanId;
  label: string;
  months: number;
  price: number;
  savePct: number;
  highlight?: boolean;
}[] = [
  { id: "mensal", label: "Mensal", months: 1, price: MONTHLY_PRICE, savePct: 0 },
  { id: "trimestral", label: "Trimestral", months: 3, price: MONTHLY_PRICE * 3, savePct: 0 },
  { id: "anual", label: "Anual", months: 12, price: MONTHLY_PRICE * 12, savePct: 20, highlight: true },
];

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type Promotion = {
  id: string;
  name: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  plans: string[];
  starts_at: string;
  ends_at: string;
  active: boolean;
};

/** Returns final price and the best applicable promo for a plan. */
export function applyPromo(planId: PlanId, basePrice: number, promos: Promotion[] | undefined) {
  const now = Date.now();
  const eligible = (promos ?? []).filter(
    (p) =>
      p.active &&
      p.plans.includes(planId) &&
      new Date(p.starts_at).getTime() <= now &&
      new Date(p.ends_at).getTime() >= now,
  );
  let best: { promo: Promotion; final: number; off: number } | null = null;
  for (const p of eligible) {
    const off = p.discount_type === "percent"
      ? basePrice * (Number(p.discount_value) / 100)
      : Number(p.discount_value);
    const final = Math.max(0, basePrice - off);
    if (!best || final < best.final) best = { promo: p, final, off };
  }
  return best ?? { promo: null as Promotion | null, final: basePrice, off: 0 };
}
