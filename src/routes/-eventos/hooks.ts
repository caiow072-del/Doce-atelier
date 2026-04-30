import { useMemo } from "react";
import { recipeCost } from "@/lib/costs";
import type { Recipe, RecipeIng, Ingredient } from "./types";

export function useRecipeCost(recipe: Recipe | null, recipeIngs: RecipeIng[], ingredients: Ingredient[]) {
  return useMemo(() => {
    if (!recipe) return null;
    return recipeCost(
      { 
        id: recipe.id, 
        servings: recipe.servings, 
        labor_cost: Number(recipe.labor_cost ?? 0), 
        packaging_cost: Number(recipe.packaging_cost ?? 0), 
        waste_pct: Number(recipe.waste_pct ?? 0) 
      },
      recipeIngs,
      ingredients.map((i) => ({ 
        id: i.id, 
        package_qty: Number(i.package_qty ?? 1), 
        price_paid: Number(i.price_paid ?? 0) 
      })),
    );
  }, [recipe, recipeIngs, ingredients]);
}

export function suggestedPrice(
  recipe: Recipe | null, 
  mode: "unit" | "slice", 
  cost: ReturnType<typeof recipeCost> | null
): number {
  if (!recipe || !cost) return 0;
  if (mode === "slice") {
    if (recipe.slice_price && Number(recipe.slice_price) > 0) return Number(recipe.slice_price);
    return cost.perSlice * 1.5;
  }
  if (recipe.public_price && Number(recipe.public_price) > 0) return Number(recipe.public_price);
  return cost.perWhole * 1.5;
}
