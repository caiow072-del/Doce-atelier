// Sugestões iniciais e utilidades de conversão de unidades para receitas/insumos.
// Tudo é apenas client-side: a confeiteira escolhe quais sugestões adotar.

export type SuggestedIngredient = {
  key: string;
  name: string;
  unit: "g" | "kg" | "ml" | "L" | "un";
  package_qty: number;
  price_paid: number;
  hint?: string;
};

// Nomes limpos (sem "(395g)" etc) — a quantidade já aparece no campo abaixo.
export const SUGGESTED_INGREDIENTS: SuggestedIngredient[] = [
  {
    key: "massa-pronta",
    name: "Massa Pronta para Bolo",
    unit: "g",
    package_qty: 450,
    price_paid: 7,
    hint: "Pacote padrão ~450g",
  },
  {
    key: "ovos",
    name: "Ovos",
    unit: "un",
    package_qty: 30,
    price_paid: 20,
    hint: "Bandeja de 30 unidades",
  },
  {
    key: "oleo",
    name: "Óleo de Soja",
    unit: "ml",
    package_qty: 900,
    price_paid: 6,
    hint: "Garrafa 900ml",
  },
  {
    key: "leite-integral",
    name: "Leite Integral",
    unit: "ml",
    package_qty: 1000,
    price_paid: 5,
    hint: "Caixa 1L",
  },
  {
    key: "leite-condensado",
    name: "Leite Condensado",
    unit: "g",
    package_qty: 395,
    price_paid: 5.9,
    hint: "1 lata = 395g",
  },
  {
    key: "creme-de-leite",
    name: "Creme de Leite",
    unit: "g",
    package_qty: 200,
    price_paid: 3,
    hint: "1 caixinha = 200g",
  },
  {
    key: "leite-em-po",
    name: "Leite em Pó",
    unit: "g",
    package_qty: 800,
    price_paid: 32,
    hint: "Pacote 800g",
  },
  {
    key: "cakeboard",
    name: "Cakeboard (prato de bolo)",
    unit: "un",
    package_qty: 1,
    price_paid: 5,
    hint: "Embalagem / acessório",
  },
  {
    key: "caixa-transporte",
    name: "Caixa de Transporte Alta",
    unit: "un",
    package_qty: 1,
    price_paid: 8,
    hint: "Embalagem / acessório",
  },
];

export type SuggestedRecipe = {
  key: string;
  name: string;
  description: string;
  servings: number;
  totalWeightG: number;
  laborCost: number;
  packagingCost: number;
  wastePct: number; // %
  margin: number;   // %
  // ingredientes referenciados pela key + quantidade na unidade do insumo
  items: { ingredientKey: string; quantity: number; note?: string }[];
};

// Bolo de Ninho 3kg, vendido em 12 fatias grandes. Preço-alvo R$ 17/fatia
// (conforme prática real da confeitaria) — a margem é ajustada para que o
// "preço sugerido" caia perto disso, mas a confeiteira pode editar.
export const SUGGESTED_RECIPES: SuggestedRecipe[] = [
  {
    key: "bolo-de-ninho-3kg",
    name: "Bolo de Ninho (3kg)",
    description:
      "Bolo decorado de ninho — receita-base de exemplo com custos detalhados. Fatias grandes (~250g).",
    servings: 12,
    totalWeightG: 3000,
    laborCost: 25, // valor do tempo da confeiteira nesta receita (editável)
    packagingCost: 13 / 12, // cakeboard + caixa rateado por fatia (~R$1,08)
    wastePct: 10,
    margin: 50, // sugestão padrão de lucro
    items: [
      { ingredientKey: "massa-pronta", quantity: 900, note: "2 pacotes (≈900g)" },
      { ingredientKey: "ovos", quantity: 6, note: "6 ovos" },
      { ingredientKey: "oleo", quantity: 360, note: "≈ 2 xícaras" },
      { ingredientKey: "leite-integral", quantity: 360, note: "≈ 2 xícaras" },
      { ingredientKey: "leite-condensado", quantity: 790, note: "2 latas (≈790g)" },
      { ingredientKey: "creme-de-leite", quantity: 800, note: "4 caixinhas (≈800g)" },
      { ingredientKey: "leite-em-po", quantity: 100, note: "100g" },
      { ingredientKey: "cakeboard", quantity: 1 },
      { ingredientKey: "caixa-transporte", quantity: 1 },
    ],
  },
];

// ───────────────── Conversões de unidades ─────────────────
// Permite a usuária digitar em "xícara", "colher de sopa", etc.
// Cada entrada converte para a unidade base do insumo.

export type MeasureKey =
  | "native"      // mesma unidade do insumo
  | "xicara"      // 240 ml
  | "colher_sopa" // 15 ml
  | "colher_cha"  // 5 ml
  | "copo"        // 200 ml
  | "ovo"         // 50 g (médio)
  | "pitada";     // 0.3 g

export type Measure = {
  key: MeasureKey;
  label: string;
  // multiplicador para converter em ml ou g
  factor: number;
  // unidade compatível ('volume' = ml/L, 'mass' = g/kg, 'unit' = un)
  base: "volume" | "mass" | "unit";
};

export const MEASURES: Measure[] = [
  { key: "xicara", label: "xícara (240ml)", factor: 240, base: "volume" },
  { key: "copo", label: "copo (200ml)", factor: 200, base: "volume" },
  { key: "colher_sopa", label: "colher sopa (15ml)", factor: 15, base: "volume" },
  { key: "colher_cha", label: "colher chá (5ml)", factor: 5, base: "volume" },
  { key: "ovo", label: "ovo (50g)", factor: 50, base: "mass" },
  { key: "pitada", label: "pitada (0,3g)", factor: 0.3, base: "mass" },
];

// Converte qty + measure para a unidade nativa do insumo.
// Retorna null se incompatível.
export function convertToBaseUnit(
  qty: number,
  measure: MeasureKey,
  ingredientUnit: string
): number | null {
  if (measure === "native") return qty;
  const m = MEASURES.find((x) => x.key === measure);
  if (!m) return null;
  const u = ingredientUnit.toLowerCase();

  if (m.base === "volume") {
    if (u === "ml") return qty * m.factor;
    if (u === "l") return (qty * m.factor) / 1000;
    return null;
  }
  if (m.base === "mass") {
    if (u === "g") return qty * m.factor;
    if (u === "kg") return (qty * m.factor) / 1000;
    return null;
  }
  if (m.base === "unit") {
    if (u === "un") return qty;
    return null;
  }
  return null;
}

// Lista de medidas compatíveis com a unidade do insumo.
export function compatibleMeasures(ingredientUnit: string): Measure[] {
  const u = ingredientUnit.toLowerCase();
  if (u === "ml" || u === "l")
    return MEASURES.filter((m) => m.base === "volume");
  if (u === "g" || u === "kg")
    return MEASURES.filter((m) => m.base === "mass");
  return [];
}
