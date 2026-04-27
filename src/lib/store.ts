import { create } from "zustand";

// Multi-tenant ready: every entity carries shopId
const SHOP_ID = "shop_jack_001";

export type Ingredient = {
  id: string;
  shopId: string;
  name: string;
  unit: "g" | "ml" | "un" | "kg" | "L";
  pricePaid: number; // total pago
  packageQty: number; // quantidade que vem na embalagem (na unit)
};

export type RecipeIngredient = {
  ingredientId: string;
  quantity: number; // na unit do ingrediente
};

export type Recipe = {
  id: string;
  shopId: string;
  name: string;
  servings: number; // fatias
  ingredients: RecipeIngredient[];
  laborCost: number; // mão de obra por receita
  packagingCost: number; // embalagem por fatia
  targetMargin: number; // 0.30 = 30%
};

export type Festival = {
  id: string;
  shopId: string;
  name: string;
  date: string; // ISO
  recipes: { recipeId: string; batches: number }[];
  schedule: Record<"qua" | "qui" | "sex" | "sab", { task: string; done: boolean }[]>;
};

export type Sale = {
  id: string;
  shopId: string;
  item: string;
  price: number;
  at: string;
};

type State = {
  shopId: string;
  ingredients: Ingredient[];
  recipes: Recipe[];
  festivals: Festival[];
  sales: Sale[];
  addIngredient: (i: Omit<Ingredient, "id" | "shopId">) => void;
  addRecipe: (r: Omit<Recipe, "id" | "shopId">) => void;
  addFestival: (f: Omit<Festival, "id" | "shopId" | "schedule">) => void;
  toggleScheduleItem: (festivalId: string, day: keyof Festival["schedule"], idx: number) => void;
  addSale: (item: string, price: number) => void;
};

const defaultSchedule = (): Festival["schedule"] => ({
  qua: [
    { task: "Preparar recheio Ouro Branco", done: false },
    { task: "Preparar ganache de chocolate", done: false },
    { task: "Calda de uva", done: false },
  ],
  qui: [
    { task: "Massa Red Velvet (4 bolos)", done: false },
    { task: "Massa branca (3 bolos)", done: false },
    { task: "Pão de ló para Pudim", done: false },
  ],
  sex: [
    { task: "Montagem Matilda Cake", done: false },
    { task: "Montagem Surpresa de Uva", done: false },
    { task: "Prensa Ouro Branco", done: false },
  ],
  sab: [
    { task: "Decoração final dos bolos", done: false },
    { task: "Tortas salgadas", done: false },
    { task: "Embalagem para venda", done: false },
  ],
});

export const useStore = create<State>((set) => ({
  shopId: SHOP_ID,
  ingredients: [
    { id: "i1", shopId: SHOP_ID, name: "Leite Condensado", unit: "g", pricePaid: 6, packageQty: 395 },
    { id: "i2", shopId: SHOP_ID, name: "Farinha de Trigo", unit: "kg", pricePaid: 5, packageQty: 1 },
    { id: "i3", shopId: SHOP_ID, name: "Bombom Ouro Branco", unit: "kg", pricePaid: 45, packageQty: 1 },
    { id: "i4", shopId: SHOP_ID, name: "Creme de Leite", unit: "g", pricePaid: 4.5, packageQty: 200 },
    { id: "i5", shopId: SHOP_ID, name: "Açúcar Refinado", unit: "kg", pricePaid: 4, packageQty: 1 },
    { id: "i6", shopId: SHOP_ID, name: "Uva Verde Sem Semente", unit: "kg", pricePaid: 12, packageQty: 1 },
  ],
  recipes: [
    {
      id: "r1",
      shopId: SHOP_ID,
      name: "Torta Ouro Branco",
      servings: 12,
      ingredients: [
        { ingredientId: "i1", quantity: 395 },
        { ingredientId: "i3", quantity: 0.4 },
        { ingredientId: "i4", quantity: 200 },
      ],
      laborCost: 25,
      packagingCost: 1.5,
      targetMargin: 0.3,
    },
    {
      id: "r2",
      shopId: SHOP_ID,
      name: "Matilda Cake",
      servings: 12,
      ingredients: [
        { ingredientId: "i1", quantity: 395 },
        { ingredientId: "i2", quantity: 0.3 },
        { ingredientId: "i5", quantity: 0.25 },
      ],
      laborCost: 30,
      packagingCost: 1.5,
      targetMargin: 0.3,
    },
    {
      id: "r3",
      shopId: SHOP_ID,
      name: "Surpresa de Uva",
      servings: 12,
      ingredients: [
        { ingredientId: "i6", quantity: 0.5 },
        { ingredientId: "i4", quantity: 200 },
        { ingredientId: "i1", quantity: 395 },
      ],
      laborCost: 25,
      packagingCost: 1.5,
      targetMargin: 0.3,
    },
    {
      id: "r4",
      shopId: SHOP_ID,
      name: "Bolo Pudim",
      servings: 10,
      ingredients: [
        { ingredientId: "i1", quantity: 395 },
        { ingredientId: "i2", quantity: 0.2 },
        { ingredientId: "i5", quantity: 0.2 },
      ],
      laborCost: 28,
      packagingCost: 1.5,
      targetMargin: 0.3,
    },
  ],
  festivals: [
    {
      id: "f1",
      shopId: SHOP_ID,
      name: "Festival de Sábado",
      date: new Date().toISOString(),
      recipes: [
        { recipeId: "r1", batches: 2 },
        { recipeId: "r2", batches: 1 },
        { recipeId: "r3", batches: 1 },
      ],
      schedule: defaultSchedule(),
    },
  ],
  sales: [
    { id: "s1", shopId: SHOP_ID, item: "Combo 2 Fatias", price: 32, at: new Date().toISOString() },
    { id: "s2", shopId: SHOP_ID, item: "1 Fatia Doce", price: 17, at: new Date().toISOString() },
    { id: "s3", shopId: SHOP_ID, item: "Torta Salgada", price: 15, at: new Date().toISOString() },
    { id: "s4", shopId: SHOP_ID, item: "1 Fatia Doce", price: 17, at: new Date().toISOString() },
    { id: "s5", shopId: SHOP_ID, item: "Combo 2 Fatias", price: 32, at: new Date().toISOString() },
  ],
  addIngredient: (i) =>
    set((s) => ({ ingredients: [...s.ingredients, { ...i, id: crypto.randomUUID(), shopId: s.shopId }] })),
  addRecipe: (r) =>
    set((s) => ({ recipes: [...s.recipes, { ...r, id: crypto.randomUUID(), shopId: s.shopId }] })),
  addFestival: (f) =>
    set((s) => ({
      festivals: [
        ...s.festivals,
        { ...f, id: crypto.randomUUID(), shopId: s.shopId, schedule: defaultSchedule() },
      ],
    })),
  toggleScheduleItem: (festivalId, day, idx) =>
    set((s) => ({
      festivals: s.festivals.map((f) =>
        f.id !== festivalId
          ? f
          : {
              ...f,
              schedule: {
                ...f.schedule,
                [day]: f.schedule[day].map((t, i) => (i === idx ? { ...t, done: !t.done } : t)),
              },
            }
      ),
    })),
  addSale: (item, price) =>
    set((s) => ({
      sales: [
        ...s.sales,
        { id: crypto.randomUUID(), shopId: s.shopId, item, price, at: new Date().toISOString() },
      ],
    })),
}));

// ============ Helpers de cálculo ============
export function recipeIngredientCost(recipe: Recipe, ingredients: Ingredient[]): number {
  return recipe.ingredients.reduce((sum, ri) => {
    const ing = ingredients.find((i) => i.id === ri.ingredientId);
    if (!ing) return sum;
    const unitPrice = ing.pricePaid / ing.packageQty;
    return sum + unitPrice * ri.quantity;
  }, 0);
}

export function recipeFullCost(recipe: Recipe, ingredients: Ingredient[]) {
  const ingredientsCost = recipeIngredientCost(recipe, ingredients);
  const wasteCost = ingredientsCost * 0.1;
  const totalRecipe = ingredientsCost + wasteCost + recipe.laborCost;
  const perSlice = totalRecipe / recipe.servings + recipe.packagingCost;
  const suggestedPrice = perSlice / (1 - recipe.targetMargin);
  return {
    ingredientsCost,
    wasteCost,
    laborCost: recipe.laborCost,
    packagingCost: recipe.packagingCost,
    totalRecipe,
    perSlice,
    suggestedPrice,
  };
}

export function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
