import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  Search,
  Calculator,
  Sparkles,
  ChevronRight,
  Minus,
  HelpCircle,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { formatBRL } from "@/lib/store";
import {
  SUGGESTED_RECIPES,
  SUGGESTED_INGREDIENTS,
  MEASURES,
  compatibleMeasures,
  convertToBaseUnit,
  type MeasureKey,
  type SuggestedRecipe,
} from "@/lib/suggestions";

export const Route = createFileRoute("/receitas")({
  head: () => ({
    meta: [
      { title: "Receitas — Cakes Manager" },
      { name: "description", content: "Ficha técnica e precificação automática das suas receitas." },
    ],
  }),
  component: RecipesPage,
});

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  package_qty: number;
  price_paid: number;
};

type RecipeIngredient = {
  id?: string;
  ingredient_id: string;
  quantity: number;
};

type Recipe = {
  id: string;
  name: string;
  description: string | null;
  servings: number;
  labor_cost: number;
  packaging_cost: number;
  waste_pct: number;
  target_margin: number;
  public_price: number | null;
  shop_id: string;
  ingredients?: RecipeIngredient[];
};

function fullCost(r: Recipe, allIng: Ingredient[]) {
  const items = r.ingredients ?? [];
  const ingredientsCost = items.reduce((sum, ri) => {
    const ing = allIng.find((i) => i.id === ri.ingredient_id);
    if (!ing || ing.package_qty <= 0) return sum;
    return sum + (ing.price_paid / ing.package_qty) * ri.quantity;
  }, 0);
  const wasteCost = ingredientsCost * (r.waste_pct ?? 0);
  const totalRecipe = ingredientsCost + wasteCost + (r.labor_cost ?? 0);
  const perSlice = (r.servings > 0 ? totalRecipe / r.servings : 0) + (r.packaging_cost ?? 0);
  const margin = r.target_margin ?? 0;
  const suggestedPrice = margin < 1 ? perSlice / (1 - margin) : perSlice;
  return { ingredientsCost, wasteCost, totalRecipe, perSlice, suggestedPrice };
}

// (Sugestões prontas agora vêm de SUGGESTED_RECIPES — receitas reais como "Bolo de Ninho".)


function RecipesPage() {
  const { currentShop } = useAuth();
  const shopId = currentShop?.shop_id;

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Recipe | null>(null);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    const [rRes, iRes] = await Promise.all([
      supabase
        .from("recipes")
        .select("*, recipe_ingredients(id, ingredient_id, quantity)")
        .eq("shop_id", shopId)
        .order("name"),
      supabase.from("ingredients").select("id, name, unit, package_qty, price_paid").eq("shop_id", shopId).order("name"),
    ]);
    if (rRes.error) toast.error("Erro ao carregar receitas: " + rRes.error.message);
    if (iRes.error) toast.error("Erro ao carregar insumos: " + iRes.error.message);
    const recs = (rRes.data ?? []).map((r: any) => ({
      ...r,
      ingredients: (r.recipe_ingredients ?? []) as RecipeIngredient[],
    }));
    setRecipes(recs as Recipe[]);
    setIngredients((iRes.data ?? []) as Ingredient[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const filtered = useMemo(
    () => recipes.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [recipes, search]
  );

  const remove = async (r: Recipe) => {
    if (!confirm(`Excluir receita "${r.name}"?`)) return;
    const { error } = await supabase.from("recipes").delete().eq("id", r.id);
    if (error) toast.error("Erro ao excluir: " + error.message);
    else {
      toast.success("Receita excluída");
      setRecipes((s) => s.filter((x) => x.id !== r.id));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ficha técnica"
        title="Receitas"
        subtitle="Cadastre receitas com seus insumos e o sistema calcula o preço sugerido."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar receita..."
            className="w-full rounded-2xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-mauve outline-none focus:border-rose"
          />
        </div>
        <button
          onClick={() => {
            if (ingredients.length === 0) {
              toast.error("Cadastre pelo menos um insumo antes de criar uma receita.");
              return;
            }
            setCreating(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-mauve px-4 py-2.5 text-sm font-medium text-cream hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nova receita
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-mauve">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : recipes.length === 0 ? (
        <EmptyState onCreate={() => ingredients.length ? setCreating(true) : toast.error("Cadastre insumos antes.")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const cost = fullCost(r, ingredients);
            const realPrice = r.public_price ?? 0;
            const hasReal = realPrice > 0;
            const realProfitSlice = hasReal ? realPrice - cost.perSlice : 0;
            const realProfitTotal = realProfitSlice * (r.servings || 0);
            const profitNegative = hasReal && realProfitSlice <= 0;
            const ingCostSlice = r.servings > 0 ? cost.ingredientsCost / r.servings : 0;
            const ingProfitSlice = hasReal ? realPrice - ingCostSlice : 0;
            const ingProfitTotal = ingProfitSlice * (r.servings || 0);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setViewing(r)}
                className="card-soft p-4 sm:p-5 flex flex-col gap-3 text-left transition hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xl italic text-mauve truncate">{r.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.servings} fatias · {(r.target_margin * 100).toFixed(0)}% lucro desejado
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setEditing(r); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setEditing(r); } }}
                      className="rounded-lg bg-blush/40 p-2 text-mauve hover:bg-blush/60 cursor-pointer"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); remove(r); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); remove(r); } }}
                      className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive/20 cursor-pointer"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-blush/30 px-3 py-2 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-rose">Preço real</p>
                    <p className="font-display text-base italic text-mauve leading-tight truncate">
                      {hasReal ? formatBRL(realPrice) : "—"}
                    </p>
                  </div>
                  <div className={`rounded-xl px-3 py-2 min-w-0 ${profitNegative ? "bg-destructive/10" : "bg-blush/30"}`}>
                    <p className="text-[10px] uppercase tracking-widest text-rose">Lucro real total</p>
                    {hasReal ? (
                      <>
                        <p className={`font-display text-base italic leading-tight truncate ${profitNegative ? "text-destructive" : "text-mauve"}`}>
                          {formatBRL(realProfitTotal)}
                        </p>
                        <p className="text-[10px] text-mauve/70 leading-tight mt-0.5 truncate">
                          Recebe: <span className="font-medium text-mauve">{formatBRL(realProfitTotal + (r.labor_cost ?? 0))}</span>
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Defina o preço real</p>
                    )}
                  </div>
                  <div className="rounded-xl bg-card/70 px-3 py-2 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Custo/fatia</p>
                    <p className="font-display text-sm italic text-mauve leading-tight truncate">
                      {formatBRL(cost.perSlice)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-card/70 px-3 py-2 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Lucro/fatia</p>
                    {hasReal ? (
                      <p className={`font-display text-sm italic leading-tight truncate ${profitNegative ? "text-destructive" : "text-mauve"}`}>
                        {formatBRL(realProfitSlice)}
                      </p>
                    ) : (
                      <p className="font-display text-sm italic text-muted-foreground leading-tight">—</p>
                    )}
                  </div>
                </div>

                {hasReal && (
                  <div className="rounded-xl bg-card/70 p-3">
                    <p className="text-center text-[10px] uppercase tracking-widest text-rose">
                      Considerando apenas os insumos
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <p className="text-[10px] leading-tight text-muted-foreground">Custo/fatia</p>
                        <p className="font-display text-xs italic text-mauve leading-tight truncate">
                          {formatBRL(ingCostSlice)}
                        </p>
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <p className="text-[10px] leading-tight text-muted-foreground">Lucro/fatia</p>
                        <p className={`font-display text-xs italic leading-tight truncate ${ingProfitSlice <= 0 ? "text-destructive" : "text-mauve"}`}>
                          {formatBRL(ingProfitSlice)}
                        </p>
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <p className="text-[10px] leading-tight text-muted-foreground">Lucro total</p>
                        <p className={`font-display text-xs italic leading-tight truncate ${ingProfitTotal <= 0 ? "text-destructive" : "text-mauve"}`}>
                          {formatBRL(ingProfitTotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-1 text-[11px] text-rose">
                  <span>Ver ficha completa</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {viewing && (
        <RecipeDetail recipe={viewing} ingredients={ingredients} onClose={() => setViewing(null)} />
      )}

      {(creating || editing) && shopId && (
        <RecipeForm
          shopId={shopId}
          ingredients={ingredients}
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid place-items-center rounded-3xl border-2 border-dashed border-border bg-card/40 p-12 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blush/60">
        <BookOpen className="h-7 w-7 text-mauve" strokeWidth={1.4} />
      </div>
      <h2 className="mt-4 font-display text-2xl italic text-mauve">Nenhuma receita ainda</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Comece criando sua primeira ficha — ou abra a Nova receita e clique em
        <span className="mx-1 inline-flex items-center gap-1 rounded-full border border-rose/40 bg-blush/30 px-2 py-0.5 text-[11px] text-mauve">
          <Sparkles className="h-3 w-3" /> Bolo de Ninho (3kg)
        </span>
        para ver um exemplo pronto.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-mauve px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Criar primeira receita
      </button>
    </div>
  );
}

function RecipeDetail({
  recipe,
  ingredients,
  onClose,
}: {
  recipe: Recipe;
  ingredients: Ingredient[];
  onClose: () => void;
}) {
  const cost = fullCost(recipe, ingredients);
  const negative = cost.suggestedPrice <= cost.perSlice;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-mauve/30 backdrop-blur-sm sm:items-center">
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-t-3xl bg-card sm:rounded-3xl"
      >
       <div className="max-h-[90vh] overflow-y-auto overscroll-contain p-6 pb-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-rose">Ficha técnica</p>
            <h2 className="font-display text-3xl italic text-mauve">{recipe.name}</h2>
            {recipe.description && <p className="mt-1 text-sm text-muted-foreground">{recipe.description}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-blush/80 to-rose/40 p-6">
          <div className="flex items-center gap-2 text-mauve/80">
            <Sparkles className="h-4 w-4" strokeWidth={1.6} />
            <p className="text-[11px] uppercase tracking-widest">Preço sugerido por fatia</p>
          </div>
          <p className={`mt-1 font-display text-5xl italic ${negative ? "text-destructive" : "text-mauve"}`}>
            {formatBRL(cost.suggestedPrice)}
          </p>
          <p className="mt-1 text-xs text-mauve/80">Lucro desejado de {(recipe.target_margin * 100).toFixed(0)}% sobre o custo</p>
        </div>

        <div className="mt-5 space-y-2">
          <Row label="Custo dos ingredientes" value={formatBRL(cost.ingredientsCost)} />
          <Row
            label={`Sobra/desperdício (${(recipe.waste_pct * 100).toFixed(0)}%)`}
            value={formatBRL(cost.wasteCost)}
            hint="Cascas, sobras de massa, erros — quanto se perde no processo."
          />
          <Row
            label="Sua produção"
            value={formatBRL(recipe.labor_cost)}
            hint="Valor do seu tempo gasto apenas para fazer esta receita."
          />
          <Row label={`Total da receita (÷ ${recipe.servings} fatias)`} value={formatBRL(cost.totalRecipe)} bold />
          <Row label="Embalagem por fatia" value={formatBRL(recipe.packaging_cost)} />
          <Row label="Custo final por fatia" value={formatBRL(cost.perSlice)} bold danger={negative} />
        </div>

        <div className="mt-6 flex items-center gap-2 text-rose">
          <Calculator className="h-4 w-4" strokeWidth={1.6} />
          <p className="text-[11px] uppercase tracking-widest">Composição</p>
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {(recipe.ingredients ?? []).map((ri) => {
            const ing = ingredients.find((i) => i.id === ri.ingredient_id);
            if (!ing) return null;
            return (
              <li
                key={ri.ingredient_id}
                className="flex justify-between border-b border-border/60 py-2 text-mauve"
              >
                <span>{ing.name}</span>
                <span className="text-muted-foreground">
                  {ri.quantity} {ing.unit}
                </span>
              </li>
            );
          })}
        </ul>
       </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, danger, hint }: { label: string; value: string; bold?: boolean; danger?: boolean; hint?: string }) {
  const color = danger ? "text-destructive" : "text-mauve";
  return (
    <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${bold ? "bg-secondary font-semibold" : ""}`}>
      <span className={`inline-flex items-center gap-1.5 ${bold ? color : "text-muted-foreground"}`} title={hint}>
        {label}
        {hint && <HelpCircle className="h-3 w-3 opacity-60" />}
      </span>
      <span className={color}>{value}</span>
    </div>
  );
}

function RecipeForm({
  shopId,
  ingredients,
  initial,
  onClose,
  onSaved,
}: {
  shopId: string;
  ingredients: Ingredient[];
  initial: Recipe | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [servings, setServings] = useState(initial?.servings?.toString() ?? "12");
  const [totalWeight, setTotalWeight] = useState(""); // gramas — informativo
  const [laborCost, setLaborCost] = useState(initial?.labor_cost?.toString() ?? "25");
  const [packagingCost, setPackagingCost] = useState(initial?.packaging_cost?.toString() ?? "1.5");
  const initialWaste = (initial?.waste_pct ?? 0.1) * 100;
  const [includeWaste, setIncludeWaste] = useState(initialWaste > 0);
  const [wastePct, setWastePct] = useState((initialWaste > 0 ? initialWaste : 10).toString());
  const [targetMargin, setTargetMargin] = useState(((initial?.target_margin ?? 0.5) * 100).toString());
  const [realPrice, setRealPrice] = useState(initial?.public_price?.toString() ?? "");
  const [items, setItems] = useState<RecipeIngredient[]>(initial?.ingredients ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  // Por item, qual unidade está sendo usada para entrada (xícara/colher/native).
  const [measureByItem, setMeasureByItem] = useState<Record<string, MeasureKey>>({});
  // Quantidade exibida no input (na unidade escolhida) — convertida para a base ao salvar.
  const [displayQty, setDisplayQty] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const applySuggestedRecipe = (s: SuggestedRecipe) => {
    if (!name) setName(s.name);
    if (!description) setDescription(s.description);
    setServings(s.servings.toString());
    setTotalWeight(s.totalWeightG.toString());
    setLaborCost(s.laborCost.toString());
    setPackagingCost(s.packagingCost.toFixed(2));
    setIncludeWaste(s.wastePct > 0);
    setWastePct((s.wastePct > 0 ? s.wastePct : 10).toString());
    setTargetMargin(s.margin.toString());

    // Casa por nome (case-insensitive) com insumos já cadastrados.
    const matched: RecipeIngredient[] = [];
    const missing: string[] = [];
    for (const it of s.items) {
      const sug = SUGGESTED_INGREDIENTS.find((x) => x.key === it.ingredientKey);
      if (!sug) continue;
      const ing = ingredients.find((i) => i.name.toLowerCase() === sug.name.toLowerCase());
      if (ing) {
        matched.push({ ingredient_id: ing.id, quantity: it.quantity });
      } else {
        missing.push(sug.name);
      }
    }
    setItems(matched);

    if (missing.length > 0) {
      toast.warning(
        `Sugestão aplicada. Cadastre estes insumos para o cálculo ficar completo: ${missing.join(", ")}`,
        { duration: 6000 }
      );
    } else {
      toast.success(`Sugestão "${s.name}" aplicada — ajuste o que precisar`);
    }
  };

  const previewRecipe: Recipe = {
    id: "preview",
    name,
    description,
    shop_id: shopId,
    servings: Number(servings) || 1,
    labor_cost: Number(laborCost) || 0,
    packaging_cost: Number(packagingCost) || 0,
    waste_pct: includeWaste ? (Number(wastePct) || 0) / 100 : 0,
    target_margin: (Number(targetMargin) || 0) / 100,
    public_price: realPrice ? Number(realPrice) : null,
    ingredients: items,
  };
  const cost = fullCost(previewRecipe, ingredients);
  const realPriceNum = Number(realPrice) || 0;
  const realProfit = realPriceNum > 0 ? realPriceNum - cost.perSlice : 0;
  const realMarginPct =
    realPriceNum > 0 && cost.perSlice > 0 ? ((realPriceNum - cost.perSlice) / realPriceNum) * 100 : 0;
  const servingsNum = previewRecipe.servings || 0;
  const ingredientCostPerSlice = servingsNum > 0 ? cost.ingredientsCost / servingsNum : 0;
  // Lucro considerando APENAS insumos (ignora produção, embalagem, perda)
  const profitPerSliceIngredients = realPriceNum > 0 ? realPriceNum - ingredientCostPerSlice : 0;
  const profitTotalIngredients = profitPerSliceIngredients * servingsNum;
  const extraCosts =
    (previewRecipe.labor_cost ?? 0) +
    (previewRecipe.packaging_cost ?? 0) * servingsNum +
    cost.wasteCost;
  const sliceWeight =
    Number(totalWeight) > 0 && Number(servings) > 0
      ? Math.round(Number(totalWeight) / Number(servings))
      : 0;

  const setQty = (ingredient_id: string, q: number) =>
    setItems((s) => s.map((it) => (it.ingredient_id === ingredient_id ? { ...it, quantity: Math.max(0, q) } : it)));
  const removeItem = (ingredient_id: string) =>
    setItems((s) => s.filter((it) => it.ingredient_id !== ingredient_id));
  const addItem = (ingredient_id: string) => {
    if (items.some((i) => i.ingredient_id === ingredient_id)) return;
    setItems((s) => [...s, { ingredient_id, quantity: 0 }]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe o nome da receita");
    if (items.length === 0) return toast.error("Adicione pelo menos um insumo");
    if (items.some((i) => !(i.quantity > 0))) return toast.error("Informe a quantidade de todos os insumos");

    setSaving(true);
    const payload = {
      shop_id: shopId,
      name: name.trim(),
      description: description.trim() || null,
      servings: Number(servings),
      labor_cost: Number(laborCost),
      packaging_cost: Number(packagingCost),
      waste_pct: includeWaste ? Number(wastePct) / 100 : 0,
      target_margin: Number(targetMargin) / 100,
      public_price: realPrice ? Number(realPrice) : null,
    };

    let recipeId = initial?.id;
    if (initial) {
      const { error } = await supabase.from("recipes").update(payload).eq("id", initial.id);
      if (error) {
        toast.error("Erro ao salvar: " + error.message);
        setSaving(false);
        return;
      }
      // Replace ingredients
      await supabase.from("recipe_ingredients").delete().eq("recipe_id", initial.id);
    } else {
      const { data, error } = await supabase.from("recipes").insert(payload).select("id").single();
      if (error || !data) {
        toast.error("Erro ao criar: " + (error?.message ?? ""));
        setSaving(false);
        return;
      }
      recipeId = data.id;
    }

    if (recipeId) {
      const rows = items.map((it) => ({
        recipe_id: recipeId!,
        ingredient_id: it.ingredient_id,
        quantity: it.quantity,
      }));
      const { error } = await supabase.from("recipe_ingredients").insert(rows);
      if (error) {
        toast.error("Erro ao salvar insumos: " + error.message);
        setSaving(false);
        return;
      }
    }

    toast.success(initial ? "Receita atualizada" : "Receita criada");
    setSaving(false);
    onSaved();
  };

  const available = ingredients.filter((i) => !items.some((it) => it.ingredient_id === i.id));

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-mauve/30 backdrop-blur-sm sm:items-center">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-t-3xl bg-card sm:rounded-3xl"
      >
       <div className="max-h-[92vh] overflow-y-auto overscroll-contain p-6 pb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">
            {initial ? "Editar receita" : "Nova receita"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* ───── SEÇÃO 1: Informações básicas ───── */}
          <section className="space-y-3">
            <SectionTitle index={1} title="Informações básicas" />
            <Field label="Nome da receita">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Torta Ouro Branco"
                className="input-base"
              />
            </Field>
            <Field label="Descrição (opcional)">
              <textarea
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="input-base resize-none"
              />
            </Field>

            <div className="rounded-2xl border border-border bg-background p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <Wand2 className="h-3.5 w-3.5 text-rose" />
                <p className="text-[10px] uppercase tracking-widest text-rose">Receitas-exemplo</p>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Toque para preencher tudo (ingredientes, rendimento, custos) com uma receita real.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_RECIPES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => applySuggestedRecipe(s)}
                    title={s.description}
                    className="inline-flex items-center gap-1 rounded-full border border-rose/40 bg-blush/40 px-3 py-1 text-[11px] text-mauve hover:bg-blush/60"
                  >
                    <Sparkles className="h-3 w-3" /> {s.name}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ───── SEÇÃO 2: Insumos (coração da receita) ───── */}
          <section className="space-y-2">
            <SectionTitle index={2} title="Insumos" subtitle="O coração da sua receita" />
            <div className="rounded-2xl border-2 border-rose/30 bg-blush/30 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-mauve/80">
                  Selecione os insumos e a quantidade usada — o custo é calculado automaticamente.
                </p>
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-mauve px-3 py-1.5 text-xs font-medium text-cream"
                >
                  <Plus className="h-3 w-3" /> {pickerOpen ? "Fechar" : "Adicionar insumo"}
                </button>
              </div>

              {pickerOpen && (
                <div className="mt-2 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      autoFocus
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="Buscar insumo..."
                      className="flex-1 bg-transparent text-sm text-mauve outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPickerOpen(false);
                        setPickerSearch("");
                      }}
                      className="rounded-md p-1 text-muted-foreground hover:bg-blush/40"
                      aria-label="Fechar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {available.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-muted-foreground">
                        Todos os insumos já foram adicionados.
                      </p>
                    ) : (
                      available
                        .filter((ing) =>
                          ing.name.toLowerCase().includes(pickerSearch.toLowerCase())
                        )
                        .map((ing) => (
                          <button
                            key={ing.id}
                            type="button"
                            onClick={() => {
                              addItem(ing.id);
                              setPickerSearch("");
                            }}
                            className="block w-full px-3 py-2 text-left text-sm text-mauve hover:bg-blush/50"
                          >
                            {ing.name}{" "}
                            <span className="text-xs text-muted-foreground">({ing.unit})</span>
                          </button>
                        ))
                    )}
                  </div>
                </div>
              )}

              {items.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Nenhum insumo adicionado ainda.
                </p>
              ) : (
                <details open className="mt-3 group">
                  <summary className="flex cursor-pointer items-center justify-between rounded-xl bg-card/70 px-3 py-2 text-xs select-none [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-1.5 text-mauve font-medium">
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                      {items.length} {items.length === 1 ? "insumo" : "insumos"} · toque para {/* */}
                      <span className="underline decoration-dotted">expandir/recolher</span>
                    </span>
                    <span className="font-display italic text-mauve">{formatBRL(cost.ingredientsCost)}</span>
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {items.map((it) => {
                      const ing = ingredients.find((i) => i.id === it.ingredient_id);
                      if (!ing) return null;
                      const lineCost =
                        ing.package_qty > 0 ? (ing.price_paid / ing.package_qty) * it.quantity : 0;
                      const measureKey: MeasureKey = measureByItem[it.ingredient_id] ?? "native";
                      const compat = compatibleMeasures(ing.unit);
                      const display =
                        displayQty[it.ingredient_id] ??
                        (measureKey === "native" ? it.quantity.toString() : "");
                      const onChangeQty = (raw: string) => {
                        setDisplayQty((d) => ({ ...d, [it.ingredient_id]: raw }));
                        const n = Number(raw);
                        if (!isFinite(n)) return;
                        const base = convertToBaseUnit(n, measureKey, ing.unit);
                        if (base !== null) setQty(it.ingredient_id, base);
                      };
                      const onChangeMeasure = (k: MeasureKey) => {
                        setMeasureByItem((m) => ({ ...m, [it.ingredient_id]: k }));
                        if (k === "native") {
                          setDisplayQty((d) => ({ ...d, [it.ingredient_id]: it.quantity.toString() }));
                        } else {
                          const m = MEASURES.find((x) => x.key === k);
                          if (m) {
                            const baseInRefUnit =
                              ing.unit.toLowerCase() === "l" || ing.unit.toLowerCase() === "kg"
                                ? it.quantity * 1000
                                : it.quantity;
                            const inMeasure = baseInRefUnit / m.factor;
                            setDisplayQty((d) => ({
                              ...d,
                              [it.ingredient_id]: inMeasure.toFixed(2),
                            }));
                          }
                        }
                      };
                      return (
                        <li key={it.ingredient_id} className="rounded-xl bg-card px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-mauve">{ing.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {it.quantity.toFixed(2)} {ing.unit} · {formatBRL(lineCost)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(it.ingredient_id)}
                              className="rounded-lg p-1 text-destructive hover:bg-destructive/10"
                              aria-label="Remover"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5">
                            <input
                              type="number"
                              step="0.01"
                              inputMode="decimal"
                              value={display}
                              onChange={(e) => onChangeQty(e.target.value)}
                              className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-center text-sm text-mauve outline-none focus:border-rose"
                            />
                            <select
                              value={measureKey}
                              onChange={(e) => onChangeMeasure(e.target.value as MeasureKey)}
                              className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-mauve outline-none focus:border-rose"
                            >
                              <option value="native">{ing.unit} (padrão)</option>
                              {compat.map((m) => (
                                <option key={m.key} value={m.key}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
            </div>
          </section>

          {/* ───── SEÇÃO 3: Rendimento ───── */}
          <section className="space-y-3">
            <SectionTitle index={3} title="Rendimento" subtitle="Quanto a receita produz" />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Peso total (g)"
                hint="Peso aproximado da receita pronta. Opcional — ajuda a calcular o tamanho da fatia."
              >
                <input
                  type="number"
                  inputMode="numeric"
                  value={totalWeight}
                  onChange={(e) => setTotalWeight(e.target.value)}
                  placeholder="Ex: 1500"
                  className="input-base"
                />
              </Field>
              <Field
                label="Rende quantas fatias / unidades?"
                hint="Em quantos pedaços você divide essa receita pronta."
              >
                <input
                  type="number"
                  inputMode="numeric"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  className="input-base"
                />
              </Field>
            </div>
            {sliceWeight > 0 && (
              <p className="text-[11px] italic text-muted-foreground">
                Tamanho médio da fatia: <span className="text-mauve">{sliceWeight} g</span>
              </p>
            )}
          </section>

          {/* ───── SEÇÃO 4: Custos extras e lucro ───── */}
          <section className="space-y-3">
            <SectionTitle index={4} title="Custos extras e lucro" />

            {/* Produção e Embalagem lado a lado */}
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Produção (R$)"
                hint="Valor do seu tempo gasto apenas para fazer esta receita. Entra no custo da fatia. (Ajudante e frete ficam no módulo de Eventos.)"
              >
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                  className="input-base"
                />
              </Field>
              <Field
                label="Embalagem / unid. (R$)"
                hint="Caixa, papel, lacre, fita por cada fatia/unidade."
              >
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={packagingCost}
                  onChange={(e) => setPackagingCost(e.target.value)}
                  className="input-base"
                />
              </Field>
            </div>

            {/* Card compacto: perda */}
            <div className="rounded-xl border border-border bg-background px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-mauve">Margem de perda</p>
                  <p className="text-[10px] text-muted-foreground">
                    Cobre cascas, sobras e erros (recomendado 10%)
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeWaste}
                  onClick={() => setIncludeWaste((v) => !v)}
                  className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${includeWaste ? "border-mauve bg-mauve" : "border-border bg-card"}`}
                >
                  <span
                    style={{ transform: `translateX(${includeWaste ? 22 : 2}px)` }}
                    className={`absolute top-1/2 -mt-2 left-0 h-4 w-4 rounded-full shadow transition-transform ${includeWaste ? "bg-cream" : "bg-mauve/50"}`}
                  />
                </button>
              </div>
              {includeWaste && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    inputMode="decimal"
                    value={wastePct}
                    onChange={(e) => setWastePct(e.target.value)}
                    className="w-16 rounded-lg border border-border bg-card px-2 py-1 text-center text-xs text-mauve outline-none focus:border-rose"
                  />
                  <span className="text-[11px] text-muted-foreground">% sobre os insumos</span>
                </div>
              )}
            </div>

            {/* Lucro desejado — slider */}
            <div className="rounded-2xl border border-border bg-background p-3">
              <div className="flex items-baseline justify-between">
                <label className="text-[10px] uppercase tracking-widest text-rose">
                  Lucro desejado
                </label>
                <span className="font-display text-2xl italic text-mauve">
                  {Math.round(Number(targetMargin) || 0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Number(targetMargin) || 0}
                onChange={(e) => setTargetMargin(e.target.value)}
                className="profit-slider mt-1 w-full accent-mauve"
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>0%</span>
                <button
                  type="button"
                  onClick={() => setTargetMargin("30")}
                  className="rounded-full px-2 py-0.5 text-mauve hover:bg-blush/40"
                >
                  30%
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMargin("50")}
                  className="rounded-full px-2 py-0.5 text-mauve hover:bg-blush/40"
                >
                  Sugestão 50%
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMargin("80")}
                  className="rounded-full px-2 py-0.5 text-mauve hover:bg-blush/40"
                >
                  80%
                </button>
                <span>100%</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Quanto você quer ganhar além do custo total.
              </p>
            </div>
          </section>

          {/* ───── SEÇÃO 5: Preço Real Praticado ───── */}
          <section className="space-y-2">
            <SectionTitle index={5} title="Preço de venda real" subtitle="O que você cobra de verdade" />
            <div className="rounded-2xl border-2 border-mauve/30 bg-card p-3">
              <Field
                label="Preço de venda real (R$ por fatia/unid.)"
                hint="O preço que você realmente cobra. O slider acima é só sugestão — o lucro abaixo é calculado com este valor."
              >
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={realPrice}
                  onChange={(e) => setRealPrice(e.target.value)}
                  placeholder="Ex: 17.00"
                  className="input-base"
                />
              </Field>
            </div>
          </section>

          {/* ───── Rodapé: resumo financeiro ───── */}
          <div className="rounded-2xl bg-gradient-to-br from-blush/60 to-rose/30 p-4">
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-rose">Custo/fatia</p>
                <p className="font-display text-lg italic text-mauve">{formatBRL(cost.perSlice)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-rose">Sugerido</p>
                <p className={`font-display text-lg italic ${cost.suggestedPrice <= cost.perSlice ? "text-destructive" : "text-mauve"}`}>
                  {formatBRL(cost.suggestedPrice)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-rose">Preço real</p>
                <p className="font-display text-lg italic text-mauve">
                  {realPriceNum > 0 ? formatBRL(realPriceNum) : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-rose">Lucro real</p>
                {realPriceNum > 0 ? (
                  <>
                    <p className={`font-display text-lg italic ${realProfit <= 0 ? "text-destructive" : "text-mauve"}`}>
                      {formatBRL(realProfit)}
                    </p>
                    <p className={`text-[10px] ${realProfit <= 0 ? "text-destructive" : "text-mauve/70"}`}>
                      {realMarginPct.toFixed(0)}%
                    </p>
                  </>
                ) : (
                  <p className="font-display text-lg italic text-muted-foreground">—</p>
                )}
              </div>
            </div>

            {realPriceNum > 0 && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-rose/40 bg-card/70 px-3 py-2">
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-widest text-rose">
                    Total para o seu bolso
                  </p>
                  <p className="text-[10px] text-mauve/60">Lucro real + Produção</p>
                </div>
                <p className={`font-display text-xl italic ${(realProfit * servingsNum) + (Number(laborCost) || 0) <= 0 ? "text-destructive" : "text-mauve"}`}>
                  {formatBRL((realProfit * servingsNum) + (Number(laborCost) || 0))}
                </p>
              </div>
            )}

            <p className="mt-2 text-center text-[11px] text-mauve/70">
              (Insumos: {formatBRL(cost.ingredientsCost)} · Extras: {formatBRL(extraCosts)}
              {realPriceNum > 0 && (
                <>
                  {" · "}
                  <span className={realProfit <= 0 ? "text-destructive font-medium" : "text-mauve font-medium"}>
                    Lucro total: {formatBRL(realProfit * servingsNum)}
                  </span>
                </>
              )}
              )
            </p>

            {realPriceNum > 0 && (
              <div className="mt-3 rounded-xl bg-card/70 p-3">
                <p className="text-center text-[10px] uppercase tracking-widest text-rose">
                  Lucro considerando apenas os insumos
                </p>
                <div className="mt-1 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Custo/fatia</p>
                    <p className="font-display text-lg italic text-mauve">
                      {formatBRL(ingredientCostPerSlice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Lucro/fatia</p>
                    <p className={`font-display text-lg italic ${profitPerSliceIngredients <= 0 ? "text-destructive" : "text-mauve"}`}>
                      {formatBRL(profitPerSliceIngredients)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Lucro total ({servingsNum}×)</p>
                    <p className={`font-display text-lg italic ${profitTotalIngredients <= 0 ? "text-destructive" : "text-mauve"}`}>
                      {formatBRL(profitTotalIngredients)}
                    </p>
                  </div>
                </div>
                <p className="mt-1 text-center text-[10px] text-muted-foreground">
                  Ignora produção, embalagem e perda
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-mauve py-3.5 text-sm font-semibold text-cream disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {initial ? "Salvar alterações" : "Criar receita"}
        </button>
       </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-rose" title={hint}>
        {label}
        {hint && <HelpCircle className="h-3 w-3 opacity-60" />}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function SectionTitle({ index, title, subtitle }: { index: number; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mauve text-[11px] font-semibold text-cream">
        {index}
      </span>
      <div>
        <p className="font-display text-base italic text-mauve leading-tight">{title}</p>
        {subtitle && <p className="text-[10px] uppercase tracking-widest text-rose">{subtitle}</p>}
      </div>
    </div>
  );
}
