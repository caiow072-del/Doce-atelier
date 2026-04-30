import { useState, useMemo, useEffect } from "react";
import { Save, AlertCircle, Cake } from "lucide-react";
import type { Recipe, Ingredient, RecipeIng, EventProduct } from "./types";
import { recipeCost } from "@/lib/costs";
import { useRecipeCost, suggestedPrice } from "./hooks";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatBRL } from "@/lib/store";

export type ProductFormValues = {
  recipeId: string;
  saleMode: "unit" | "slice";
  name: string;
  unitPrice: string;
  batches: string;
  plannedQty: string;
};

export function ProductForm({
  recipes, ingredients, recipeIngs, values, setValues, submitLabel, onSubmit, lockRecipe,
}: {
  recipes: Recipe[];
  ingredients: Ingredient[];
  recipeIngs: RecipeIng[];
  values: ProductFormValues;
  setValues: (v: ProductFormValues) => void;
  submitLabel: string;
  onSubmit: () => void;
  lockRecipe?: boolean;
}) {
  const [search, setSearch] = useState("");
  const recipe = useMemo(() => recipes.find((r) => r.id === values.recipeId) ?? null, [recipes, values.recipeId]);
  const cost = useRecipeCost(recipe, recipeIngs, ingredients);

  const filtered = useMemo(
    () => (search.trim() ? recipes.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())) : recipes),
    [recipes, search],
  );

  useEffect(() => {
    if (!recipe) return;
    const b = Number(values.batches) || 0;
    const calc = values.saleMode === "slice" ? b * recipe.servings : b;
    const patch: Partial<ProductFormValues> = {};
    if (!values.plannedQty || Number(values.plannedQty) === 0) patch.plannedQty = String(calc);
    if (!values.name) patch.name = recipe.name;
    if (!values.unitPrice && cost) patch.unitPrice = suggestedPrice(recipe, values.saleMode, cost).toFixed(2);
    if (Object.keys(patch).length) setValues({ ...values, ...patch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.recipeId, values.saleMode, values.batches]);

  const sugg = suggestedPrice(recipe, values.saleMode, cost);
  const unitCost = cost ? (values.saleMode === "slice" ? cost.perSlice : cost.perWhole) : 0;
  const ingOnlyCost = useMemo(() => {
    if (!recipe || !cost) return 0;
    const packPerSlice = Number(recipe.packaging_cost ?? 0);
    const ingPerSlice = (cost.ingredients / Math.max(1, recipe.servings)) + packPerSlice;
    return values.saleMode === "slice" ? ingPerSlice : ingPerSlice * recipe.servings;
  }, [recipe, cost, values.saleMode]);

  const price = Number(values.unitPrice) || 0;
  const margin = cost && price > 0 ? ((price - unitCost) / price) * 100 : null;
  const profit = price - unitCost;
  const profitIngOnly = price - ingOnlyCost;

  const missing = useMemo(() => {
    if (!recipe) return [];
    const b = Number(values.batches) || 0;
    const need: { name: string; needed: number; stock: number; unit: string }[] = [];
    recipeIngs.filter((ri) => ri.recipe_id === recipe.id).forEach((ri) => {
      const ing = ingredients.find((x) => x.id === ri.ingredient_id);
      if (!ing) return;
      const needed = ri.quantity * b;
      if (Number(ing.stock_qty ?? 0) < needed) {
        need.push({ name: ing.name, needed, stock: Number(ing.stock_qty ?? 0), unit: ing.unit });
      }
    });
    return need;
  }, [recipe, values.batches, recipeIngs, ingredients]);

  const handleSelect = (id: string) => setValues({ ...values, recipeId: id });

  return (
    <div className="space-y-4">
      {!lockRecipe && (
        <div>
          <label className="text-[10px] uppercase tracking-widest text-rose">Receita base</label>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar receita..." className="input-base mt-1"
          />
          <div className="mt-2 sm:max-h-64 sm:overflow-y-auto rounded-xl border border-border divide-y divide-border/60">
            <button
              type="button"
              onClick={() => handleSelect("")}
              className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${!values.recipeId ? "bg-blush/50 text-mauve" : "text-mauve/70 hover:bg-blush/20"}`}
            >
              <span className="font-medium">— Sem receita (produto avulso) —</span>
              <span className="text-[10px] text-muted-foreground">manual</span>
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-center text-xs text-muted-foreground">Nenhuma receita encontrada.</p>
            ) : (
              filtered.map((r) => {
                const c = recipeCost(
                  { id: r.id, servings: r.servings, labor_cost: Number(r.labor_cost ?? 0), packaging_cost: Number(r.packaging_cost ?? 0), waste_pct: Number(r.waste_pct ?? 0) },
                  recipeIngs,
                  ingredients.map((i) => ({ id: i.id, package_qty: Number(i.package_qty ?? 1), price_paid: Number(i.price_paid ?? 0) })),
                );
                const sliceSugg = (r.slice_price && Number(r.slice_price) > 0) ? Number(r.slice_price) : c.perSlice * 1.5;
                const wholeSugg = (r.public_price && Number(r.public_price) > 0) ? Number(r.public_price) : c.perWhole * 1.5;
                const active = values.recipeId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelect(r.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${active ? "bg-blush/50" : "hover:bg-blush/20"}`}
                  >
                    {r.image_url ? (
                      <img src={r.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blush/40">
                        <Cake className="h-4 w-4 text-mauve" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-mauve">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {r.servings} fatias · custo/fatia {formatBRL(c.perSlice)}
                      </p>
                    </div>
                    <div className="text-right text-[10px]">
                      <p className="text-rose">sugerido</p>
                      <p className="font-medium text-mauve num">{formatBRL(wholeSugg)}</p>
                      <p className="text-muted-foreground num">{formatBRL(sliceSugg)}/fatia</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {recipe && (
        <div className="rounded-xl border border-border bg-blush/20 p-3">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-rose">Modo de venda</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setValues({ ...values, saleMode: "unit", unitPrice: "" })}
              className={`rounded-xl border px-3 py-2 text-xs ${values.saleMode === "unit" ? "border-rose bg-card text-mauve font-medium" : "border-border text-muted-foreground"}`}
            >
              Inteiro<br />
              <span className="text-[10px]">(rende {recipe.servings} fatias)</span>
            </button>
            <button
              type="button"
              onClick={() => setValues({ ...values, saleMode: "slice", unitPrice: "" })}
              className={`rounded-xl border px-3 py-2 text-xs ${values.saleMode === "slice" ? "border-rose bg-card text-mauve font-medium" : "border-border text-muted-foreground"}`}
            >
              Por fatia<br />
              <span className="text-[10px]">(ex: {recipe.servings} fatias por receita)</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-rose">Nome no PDV</label>
          <input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} placeholder={recipe?.name ?? "Produto"} className="input-base mt-1" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-rose">
            Preço unitário {sugg > 0 && <span className="ml-1 text-[10px] normal-case tracking-normal text-muted-foreground">(sug. {formatBRL(sugg)})</span>}
          </label>
          <input type="number" step="0.01" value={values.unitPrice} onChange={(e) => setValues({ ...values, unitPrice: e.target.value })} className="input-base mt-1" />
        </div>
        {recipe && (
          <div>
            <label className="text-[10px] uppercase tracking-widest text-rose">Lotes da receita</label>
            <input type="number" step="0.5" min="0" value={values.batches} onChange={(e) => setValues({ ...values, batches: e.target.value })} className="input-base mt-1" />
          </div>
        )}
        <div>
          <label className="text-[10px] uppercase tracking-widest text-rose">Qtd planejada</label>
          <input type="number" value={values.plannedQty} onChange={(e) => setValues({ ...values, plannedQty: e.target.value })} className="input-base mt-1" />
        </div>
      </div>

      {cost && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-3 text-xs space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-rose">Custo real (com perdas + produção)</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Custo {values.saleMode === "slice" ? "/fatia" : "/inteiro"}</span>
              <strong className="text-mauve num">{formatBRL(unitCost)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lucro previsto</span>
              <strong className={`num ${profit < 0 ? "text-destructive" : "text-success"}`}>{formatBRL(profit)}</strong>
            </div>
            {margin != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Margem</span>
                <strong className={margin >= 30 ? "text-success" : margin >= 15 ? "text-warning" : "text-destructive"}>{margin.toFixed(0)}%</strong>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-xs space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-rose">Só insumos + embalagem</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Custo {values.saleMode === "slice" ? "/fatia" : "/inteiro"}</span>
              <strong className="text-mauve num">{formatBRL(ingOnlyCost)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lucro</span>
              <strong className={`num ${profitIngOnly < 0 ? "text-destructive" : "text-success"}`}>{formatBRL(profitIngOnly)}</strong>
            </div>
            <p className="text-[10px] text-muted-foreground">Ignora perdas e produção</p>
          </div>
          {Number(values.batches) > 0 && (
            <div className="sm:col-span-2 flex justify-between rounded-xl bg-blush/20 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Custo total ({values.batches} lote{Number(values.batches) === 1 ? "" : "s"})</span>
              <strong className="text-mauve num">{formatBRL(cost.totalRecipe * Number(values.batches))}</strong>
            </div>
          )}
        </div>
      )}

      {missing.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs">
          <p className="flex items-center gap-1 font-medium text-warning"><AlertCircle className="h-3.5 w-3.5" /> Insumos insuficientes</p>
          <ul className="mt-1 space-y-0.5 text-mauve">
            {missing.map((m) => (
              <li key={m.name}>
                <strong>{m.name}</strong>: precisa {m.needed.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {m.unit}, em estoque {m.stock} {m.unit}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onSubmit}
        className="w-full rounded-xl bg-mauve px-4 py-3 text-sm font-medium text-cream hover:opacity-90"
      >
        <Save className="mr-1 inline h-4 w-4" /> {submitLabel}
      </button>
    </div>
  );
}

export function AddProductModal({
  recipes, ingredients, recipeIngs, onClose, onAdd,
}: {
  recipes: Recipe[];
  ingredients: Ingredient[];
  recipeIngs: RecipeIng[];
  onClose: () => void;
  onAdd: (data: Partial<EventProduct>) => void;
}) {
  const [values, setValues] = useState<ProductFormValues>({
    recipeId: "", saleMode: "unit", name: "", unitPrice: "", batches: "1", plannedQty: "",
  });

  const handleSave = () => {
    const recipe = recipes.find((r) => r.id === values.recipeId) ?? null;
    const finalName = values.name.trim() || recipe?.name || "";
    if (!finalName) return toast.error("Dê um nome ao produto");
    onAdd({
      name: finalName,
      recipe_id: values.recipeId || null,
      sale_mode: values.saleMode,
      batches: Number(values.batches) || 0,
      unit_price: Number(values.unitPrice) || 0,
      planned_qty: Number(values.plannedQty) || 0,
      image_url: recipe?.image_url ?? null,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-mauve">Adicionar produto ao evento</DialogTitle>
        </DialogHeader>
        <ProductForm
          recipes={recipes}
          ingredients={ingredients}
          recipeIngs={recipeIngs}
          values={values}
          setValues={setValues}
          submitLabel="Adicionar ao evento"
          onSubmit={handleSave}
        />
      </DialogContent>
    </Dialog>
  );
}

export function EditProductModal({
  product, recipes, ingredients, recipeIngs, onClose, onSave,
}: {
  product: EventProduct;
  recipes: Recipe[];
  ingredients: Ingredient[];
  recipeIngs: RecipeIng[];
  onClose: () => void;
  onSave: (patch: Partial<EventProduct>) => void;
}) {
  const [values, setValues] = useState<ProductFormValues>({
    recipeId: product.recipe_id ?? "",
    saleMode: product.sale_mode,
    name: product.name,
    unitPrice: String(product.unit_price ?? ""),
    batches: String(product.batches ?? 0),
    plannedQty: String(product.planned_qty ?? ""),
  });

  const handleSave = () => {
    const recipe = recipes.find((r) => r.id === values.recipeId) ?? null;
    const finalName = values.name.trim() || recipe?.name || "";
    if (!finalName) return toast.error("Dê um nome ao produto");
    onSave({
      name: finalName,
      recipe_id: values.recipeId || null,
      sale_mode: values.saleMode,
      batches: Number(values.batches) || 0,
      unit_price: Number(values.unitPrice) || 0,
      planned_qty: Number(values.plannedQty) || 0,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-mauve">Editar produto</DialogTitle>
        </DialogHeader>
        <ProductForm
          recipes={recipes}
          ingredients={ingredients}
          recipeIngs={recipeIngs}
          values={values}
          setValues={setValues}
          submitLabel="Salvar alterações"
          onSubmit={handleSave}
          lockRecipe={true}
        />
      </DialogContent>
    </Dialog>
  );
}
