// Real-cost calculation helpers. All values in BRL.
// Rules:
// - Ingredient cost per recipe = sum(quantity * (price_paid / package_qty))
// - Apply waste_pct as multiplier on ingredients only (ingredients * (1 + waste_pct))
// - Recipe total = (ingredients * (1+waste_pct)) + labor_cost
// - Per slice = recipe_total / servings + packaging_cost (per slice)
// - Whole = per_slice * servings (or recipe_total + packaging*servings)

export type IngredientLite = {
  id: string;
  package_qty: number;
  price_paid: number;
};

export type RecipeIngredientLite = {
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
};

export type RecipeLite = {
  id: string;
  servings: number;
  labor_cost: number;
  packaging_cost: number;
  waste_pct: number;
};

export type RecipeCost = {
  ingredients: number;
  withWaste: number;
  labor: number;
  packagingPerSlice: number;
  totalRecipe: number;
  perSlice: number;
  perWhole: number;
};

export function recipeCost(
  recipe: RecipeLite,
  recipeIngs: RecipeIngredientLite[],
  ingredients: IngredientLite[],
): RecipeCost {
  const items = recipeIngs.filter((ri) => ri.recipe_id === recipe.id);
  let ingCost = 0;
  for (const ri of items) {
    const ing = ingredients.find((i) => i.id === ri.ingredient_id);
    if (!ing || ing.package_qty <= 0) continue;
    ingCost += (Number(ing.price_paid) / Number(ing.package_qty)) * Number(ri.quantity);
  }
  const waste = Number(recipe.waste_pct ?? 0);
  const withWaste = ingCost * (1 + waste);
  const labor = Number(recipe.labor_cost ?? 0);
  const totalRecipe = withWaste + labor;
  const servings = Math.max(1, Number(recipe.servings ?? 1));
  const packagingPerSlice = Number(recipe.packaging_cost ?? 0);
  const perSlice = totalRecipe / servings + packagingPerSlice;
  const perWhole = perSlice * servings;
  return {
    ingredients: ingCost,
    withWaste,
    labor,
    packagingPerSlice,
    totalRecipe,
    perSlice,
    perWhole,
  };
}

// Sum cost for sales of the period given product → recipe links.
// salesByItem: groups sales by product (event_product_id or pdv_product_id) with totals + qty
export type SaleAgg = {
  recipeId: string | null;
  saleMode: "unit" | "slice";
  qty: number;
  revenue: number;
};

export function aggregateCost(
  sales: SaleAgg[],
  recipes: RecipeLite[],
  recipeIngs: RecipeIngredientLite[],
  ingredients: IngredientLite[],
  fallbackRatio = 0.35, // when no recipe linked, estimate cost as ratio of revenue
): { totalCost: number; revenue: number; estimated: number } {
  let totalCost = 0;
  let revenue = 0;
  let estimated = 0;
  for (const s of sales) {
    revenue += s.revenue;
    if (!s.recipeId) {
      const est = s.revenue * fallbackRatio;
      totalCost += est;
      estimated += est;
      continue;
    }
    const r = recipes.find((x) => x.id === s.recipeId);
    if (!r) {
      const est = s.revenue * fallbackRatio;
      totalCost += est;
      estimated += est;
      continue;
    }
    const c = recipeCost(r, recipeIngs, ingredients);
    const unitCost = s.saleMode === "slice" ? c.perSlice : c.perWhole;
    totalCost += unitCost * s.qty;
  }
  return { totalCost, revenue, estimated };
}
