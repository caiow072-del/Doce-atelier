import { useState } from "react";
import { Plus, Pencil, Trash2, ShoppingBasket, ChevronDown, ChevronRight, Package } from "lucide-react";
import type { EventRow, EventProduct, Recipe, Ingredient, RecipeIng } from "./types";
import { recipeCost } from "@/lib/costs";
import { AddProductModal, EditProductModal } from "./ProductForms";

export function ProductsTab({
  event, products, recipes, ingredients, recipeIngs, shoppingList, showInsumos, setShowInsumos, onAdd, onUpdate, onRemove,
}: {
  event: EventRow;
  products: EventProduct[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  recipeIngs: RecipeIng[];
  shoppingList: { name: string; unit: string; qty: number }[];
  showInsumos: boolean;
  setShowInsumos: (v: boolean) => void;
  onAdd: (data: Partial<EventProduct>) => void;
  onUpdate: (id: string, patch: Partial<EventProduct>) => void;
  onRemove: (id: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingProduct = products.find((p) => p.id === editingId) ?? null;
  const closed = !!event.closed_at;

  const costOf = (p: EventProduct): number => {
    if (!p.recipe_id) return Number(p.unit_price) * 0.35;
    const r = recipes.find((x) => x.id === p.recipe_id);
    if (!r) return Number(p.unit_price) * 0.35;
    const c = recipeCost(
      { id: r.id, servings: r.servings, labor_cost: Number(r.labor_cost ?? 0), packaging_cost: Number(r.packaging_cost ?? 0), waste_pct: Number(r.waste_pct ?? 0) },
      recipeIngs,
      ingredients.map((i) => ({ id: i.id, package_qty: Number(i.package_qty ?? 1), price_paid: Number(i.price_paid ?? 0) })),
    );
    return p.sale_mode === "slice" ? c.perSlice : c.perWhole;
  };

  return (
    <div className="space-y-4">
      <div className="card-soft overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-blush/30 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-mauve">Produtos do evento</p>
            <p className="hidden text-[11px] text-muted-foreground sm:block">Cada produto vira um botão no PDV deste evento.</p>
          </div>
          {!closed && (
            <button onClick={() => setShowAdd(true)} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-mauve px-3 py-1.5 text-xs text-cream hover:opacity-90">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          )}
        </div>
        {products.length === 0 ? (
          <div className="mx-auto max-w-md border-dashed border-2 border-border/60 bg-card/40 py-12 px-6 flex flex-col items-center justify-center text-center rounded-3xl m-6">
            <Package className="mb-4 h-8 w-8 text-muted-foreground" strokeWidth={1.4} />
            <p className="text-sm text-muted-foreground">
              Nenhum produto neste evento.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Toque em <strong>Adicionar</strong> para escolher receitas do seu catálogo.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60 md:grid md:grid-cols-2 md:gap-2 md:divide-y-0 md:p-2">
            {products.map((p) => {
              const sold = p.sold_qty;
              const left = Math.max(0, p.planned_qty - sold);
              const cost = costOf(p);
              const margin = p.unit_price > 0 ? ((p.unit_price - cost) / p.unit_price) * 100 : 0;
              const recipe = p.recipe_id ? recipes.find((r) => r.id === p.recipe_id) : null;
              return (
                <li key={p.id} className="px-3 py-3 text-sm sm:px-4 md:rounded-xl md:border md:border-border/60 md:bg-card md:px-3 md:py-2.5">
                  <div className="flex items-start gap-2 sm:gap-3">
                    {(p.image_url || recipe?.image_url) && (
                      <img src={p.image_url || recipe?.image_url || ""} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="min-w-0 truncate font-medium text-mauve">{p.name}</span>
                        {recipe && (
                          <span className="truncate text-[10px] uppercase tracking-wider text-rose">
                            {recipe.name} · {p.sale_mode === "slice" ? "fatia" : "inteiro"}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>Preço <strong className="text-mauve">{Number(p.unit_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></span>
                        <span>Custo <strong className={cost > p.unit_price ? "text-destructive" : "text-mauve"}>{cost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></span>
                        <span>Margem <strong className={margin >= 30 ? "text-success" : margin >= 15 ? "text-warning" : "text-destructive"}>{margin.toFixed(0)}%</strong></span>
                        <span className={left === 0 && p.planned_qty > 0 ? "font-medium text-success" : ""}>Vendas {sold}/{p.planned_qty}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <input
                        disabled={closed}
                        type="number" placeholder="qtd"
                        value={p.planned_qty || ""}
                        onChange={(e) => onUpdate(p.id, { planned_qty: Number(e.target.value) || 0 })}
                        className="w-14 rounded-lg border border-border bg-background px-1.5 py-1 text-right text-xs text-mauve disabled:opacity-60 sm:w-16 sm:px-2"
                      />
                      <div className="flex gap-0.5">
                        <button disabled={closed} onClick={() => setEditingId(p.id)} className="rounded-lg p-1 text-muted-foreground hover:bg-blush/50 hover:text-mauve disabled:opacity-30" aria-label="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button disabled={closed} onClick={() => onRemove(p.id)} className="rounded-lg p-1 text-destructive hover:bg-destructive/10 disabled:opacity-30" aria-label="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showAdd && (
        <AddProductModal
          recipes={recipes}
          ingredients={ingredients}
          recipeIngs={recipeIngs}
          onClose={() => setShowAdd(false)}
          onAdd={(data: Partial<EventProduct>) => { onAdd(data); setShowAdd(false); }}
        />
      )}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          recipes={recipes}
          ingredients={ingredients}
          recipeIngs={recipeIngs}
          onClose={() => setEditingId(null)}
          onSave={(patch) => { onUpdate(editingProduct.id, patch); setEditingId(null); }}
        />
      )}
      <div className="card-soft overflow-hidden">
        <button
          onClick={() => setShowInsumos(!showInsumos)}
          className="flex w-full items-center justify-between border-b border-border/60 bg-blush/30 px-3 py-2.5 sm:px-4 sm:py-3"
        >
          <div className="flex items-center gap-2">
            <ShoppingBasket className="h-4 w-4 text-mauve" strokeWidth={1.6} />
            <p className="text-sm font-medium text-mauve">Lista de compras</p>
            <span className="rounded-full bg-card px-2 py-0.5 text-[10px] text-muted-foreground">{shoppingList.length} itens</span>
          </div>
          {showInsumos ? <ChevronDown className="h-4 w-4 text-mauve" /> : <ChevronRight className="h-4 w-4 text-mauve" />}
        </button>
        {showInsumos && (
          shoppingList.length === 0 ? (
            <div className="mx-auto max-w-md border-dashed border-2 border-border/60 bg-card/40 py-12 px-6 flex flex-col items-center justify-center text-center rounded-3xl m-6">
              <ShoppingBasket className="mb-4 h-8 w-8 text-muted-foreground" strokeWidth={1.4} />
              <p className="text-sm text-muted-foreground">Sua lista de compras está vazia.</p>
              <p className="mt-1 text-xs text-muted-foreground/70">Adicione produtos com receita vinculada e quantidade planejada para gerar os insumos necessários.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60 md:grid md:grid-cols-2 md:gap-x-6 md:divide-y-0 md:px-4 md:py-2">
              {shoppingList.map((it) => (
                <li key={it.name} className="flex items-center justify-between px-3 py-2.5 sm:px-4 text-sm md:border-b md:border-border/40 md:px-0">
                  <span className="text-mauve">{it.name}</span>
                  <span className="text-muted-foreground">{it.qty.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {it.unit}</span>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
}
