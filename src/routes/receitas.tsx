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
        <div className="space-y-3">
          {filtered.map((r) => {
            const cost = fullCost(r, ingredients);
            const negativeProfit = cost.suggestedPrice <= cost.perSlice;
            return (
              <div key={r.id} className="card-soft p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => setViewing(r)} className="min-w-0 flex-1 text-left">
                    <p className="font-display text-xl italic text-mauve">{r.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.servings} fatias · custo {formatBRL(cost.perSlice)}/fatia
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-widest text-rose">Sugerido</p>
                      <p className={`font-display text-lg italic ${negativeProfit ? "text-destructive" : "text-mauve"}`}>
                        {formatBRL(cost.suggestedPrice)}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditing(r)}
                      className="rounded-lg bg-blush/40 p-2 text-mauve hover:bg-blush/60"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(r)}
                      className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive/20"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewing(r)}
                      className="hidden rounded-lg p-2 text-rose sm:block"
                      aria-label="Detalhes"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
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
    <div className="grid place-items-center rounded-3xl border-2 border-dashed border-border bg-card/40 p-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blush/60">
        <BookOpen className="h-7 w-7 text-mauve" strokeWidth={1.4} />
      </div>
      <h2 className="mt-4 font-display text-2xl italic text-mauve">Nenhuma receita ainda</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Crie sua primeira ficha técnica escolhendo os insumos cadastrados.
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
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-card p-6 pb-10 sm:rounded-3xl"
      >
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
          <p className="mt-1 text-xs text-mauve/80">Margem alvo de {(recipe.target_margin * 100).toFixed(0)}%</p>
        </div>

        <div className="mt-5 space-y-2">
          <Row label="Custo dos ingredientes" value={formatBRL(cost.ingredientsCost)} />
          <Row
            label={`Sobra/desperdício (${(recipe.waste_pct * 100).toFixed(0)}%)`}
            value={formatBRL(cost.wasteCost)}
            hint="Cascas, sobras de massa, erros — quanto se perde no processo."
          />
          <Row
            label="Seu trabalho"
            value={formatBRL(recipe.labor_cost)}
            hint="Quanto você quer ganhar pelo tempo gasto fazendo essa receita."
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
  );
}

function Row({ label, value, bold, danger }: { label: string; value: string; bold?: boolean; danger?: boolean }) {
  const color = danger ? "text-destructive" : "text-mauve";
  return (
    <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${bold ? "bg-secondary font-semibold" : ""}`}>
      <span className={bold ? color : "text-muted-foreground"}>{label}</span>
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
  const [laborCost, setLaborCost] = useState(initial?.labor_cost?.toString() ?? "25");
  const [packagingCost, setPackagingCost] = useState(initial?.packaging_cost?.toString() ?? "1.5");
  const [wastePct, setWastePct] = useState(((initial?.waste_pct ?? 0.1) * 100).toString());
  const [targetMargin, setTargetMargin] = useState(((initial?.target_margin ?? 0.3) * 100).toString());
  const [items, setItems] = useState<RecipeIngredient[]>(initial?.ingredients ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const previewRecipe: Recipe = {
    id: "preview",
    name,
    description,
    shop_id: shopId,
    servings: Number(servings) || 1,
    labor_cost: Number(laborCost) || 0,
    packaging_cost: Number(packagingCost) || 0,
    waste_pct: (Number(wastePct) || 0) / 100,
    target_margin: (Number(targetMargin) || 0) / 100,
    ingredients: items,
  };
  const cost = fullCost(previewRecipe, ingredients);

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
      waste_pct: Number(wastePct) / 100,
      target_margin: Number(targetMargin) / 100,
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
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-card p-6 pb-10 sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">
            {initial ? "Editar receita" : "Nova receita"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Nome">
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Fatias">
              <input type="number" inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value)} className="input-base" />
            </Field>
            <Field label="Mão obra (R$)">
              <input type="number" step="0.01" inputMode="decimal" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} className="input-base" />
            </Field>
            <Field label="Embalagem/fatia">
              <input type="number" step="0.01" inputMode="decimal" value={packagingCost} onChange={(e) => setPackagingCost(e.target.value)} className="input-base" />
            </Field>
            <Field label="Perda (%)">
              <input type="number" step="0.1" inputMode="decimal" value={wastePct} onChange={(e) => setWastePct(e.target.value)} className="input-base" />
            </Field>
          </div>

          <Field label="Margem alvo (%)">
            <input type="number" step="0.1" inputMode="decimal" value={targetMargin} onChange={(e) => setTargetMargin(e.target.value)} className="input-base" />
          </Field>

          <div className="rounded-2xl bg-blush/30 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-widest text-rose">Insumos</p>
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                disabled={available.length === 0}
                className="inline-flex items-center gap-1 rounded-lg bg-mauve px-2.5 py-1 text-xs text-cream disabled:opacity-50"
              >
                <Plus className="h-3 w-3" /> Adicionar
              </button>
            </div>

            {pickerOpen && available.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border bg-card">
                {available.map((ing) => (
                  <button
                    key={ing.id}
                    type="button"
                    onClick={() => {
                      addItem(ing.id);
                      setPickerOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-mauve hover:bg-blush/50"
                  >
                    {ing.name} <span className="text-xs text-muted-foreground">({ing.unit})</span>
                  </button>
                ))}
              </div>
            )}

            {items.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Nenhum insumo adicionado ainda.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {items.map((it) => {
                  const ing = ingredients.find((i) => i.id === it.ingredient_id);
                  if (!ing) return null;
                  const lineCost = ing.package_qty > 0 ? (ing.price_paid / ing.package_qty) * it.quantity : 0;
                  return (
                    <li key={it.ingredient_id} className="flex items-center gap-2 rounded-xl bg-card px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-mauve">{ing.name}</p>
                        <p className="text-[11px] text-muted-foreground">{formatBRL(lineCost)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQty(it.ingredient_id, it.quantity - 1)}
                        className="rounded-lg bg-blush/50 p-1 text-mauve"
                        aria-label="Diminuir"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={it.quantity}
                        onChange={(e) => setQty(it.ingredient_id, Number(e.target.value))}
                        className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-center text-sm text-mauve outline-none focus:border-rose"
                      />
                      <span className="w-8 text-xs text-muted-foreground">{ing.unit}</span>
                      <button
                        type="button"
                        onClick={() => setQty(it.ingredient_id, it.quantity + 1)}
                        className="rounded-lg bg-blush/50 p-1 text-mauve"
                        aria-label="Aumentar"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(it.ingredient_id)}
                        className="rounded-lg p-1 text-destructive"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-gradient-to-br from-blush/60 to-rose/30 p-3 text-center">
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
              <p className="text-[10px] uppercase tracking-widest text-rose">Lucro/fatia</p>
              <p className={`font-display text-lg italic ${cost.suggestedPrice - cost.perSlice <= 0 ? "text-destructive" : "text-mauve"}`}>
                {formatBRL(cost.suggestedPrice - cost.perSlice)}
              </p>
            </div>
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
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-rose">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
