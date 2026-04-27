import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, Sparkles, ChevronRight, X, Package } from "lucide-react";
import { useStore, recipeFullCost, formatBRL } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/receitas")({
  head: () => ({
    meta: [
      { title: "Receitas — Jack Menezes Cakes Manager" },
      { name: "description", content: "Ficha técnica e precificação automática das suas receitas." },
    ],
  }),
  component: RecipesPage,
});

function RecipesPage() {
  const { recipes, ingredients } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = recipes.find((r) => r.id === selectedId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ficha técnica"
        title="Suas receitas"
        subtitle="Toque em uma receita para ver o preço sugerido."
      />

      <div className="card-soft p-5">
        <div className="flex items-center gap-2 text-rose">
          <Package className="h-4 w-4" strokeWidth={1.6} />
          <p className="text-[11px] uppercase tracking-widest">Insumos cadastrados</p>
        </div>
        <p className="mt-2 font-display text-3xl italic text-mauve">{ingredients.length}</p>
        <p className="text-xs text-muted-foreground">
          Leite condensado, farinha, bombons e mais.
        </p>
      </div>

      <div className="space-y-3">
        {recipes.map((r) => {
          const cost = recipeFullCost(r, ingredients);
          return (
            <motion.button
              key={r.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedId(r.id)}
              className="card-soft flex w-full items-center justify-between p-5 text-left"
            >
              <div>
                <p className="font-display text-xl italic text-mauve">{r.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {r.servings} fatias · custo {formatBRL(cost.perSlice)}/fatia
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-rose">Sugerido</p>
                  <p className="font-display text-lg italic text-mauve">
                    {formatBRL(cost.suggestedPrice)}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-rose" />
              </div>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {selected && (
          <RecipeDetail
            recipeId={selected.id}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RecipeDetail({ recipeId, onClose }: { recipeId: string; onClose: () => void }) {
  const { recipes, ingredients } = useStore();
  const recipe = recipes.find((r) => r.id === recipeId)!;
  const cost = recipeFullCost(recipe, ingredients);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-mauve/30 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-card p-6 pb-10"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-rose">Ficha técnica</p>
            <h2 className="font-display text-3xl italic text-mauve">{recipe.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Preço sugerido em destaque */}
        <div className="mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-blush/80 to-rose/40 p-6">
          <div className="flex items-center gap-2 text-mauve/80">
            <Sparkles className="h-4 w-4" strokeWidth={1.6} />
            <p className="text-[11px] uppercase tracking-widest">Preço sugerido por fatia</p>
          </div>
          <p className="font-display text-5xl italic text-mauve mt-1">
            {formatBRL(cost.suggestedPrice)}
          </p>
          <p className="text-xs text-mauve/80 mt-1">Lucro de {(recipe.targetMargin * 100).toFixed(0)}%</p>
        </div>

        {/* Breakdown */}
        <div className="mt-5 space-y-2">
          <Row label="Ingredientes" value={formatBRL(cost.ingredientsCost)} />
          <Row label="Perda/desperdício (10%)" value={formatBRL(cost.wasteCost)} />
          <Row label="Mão de obra" value={formatBRL(cost.laborCost)} />
          <Row label={`Total da receita (÷ ${recipe.servings} fatias)`} value={formatBRL(cost.totalRecipe)} bold />
          <Row label="Embalagem por fatia" value={formatBRL(cost.packagingCost)} />
          <Row label="Custo final por fatia" value={formatBRL(cost.perSlice)} bold />
        </div>

        <div className="mt-6 flex items-center gap-2 text-rose">
          <Calculator className="h-4 w-4" strokeWidth={1.6} />
          <p className="text-[11px] uppercase tracking-widest">Composição</p>
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {recipe.ingredients.map((ri) => {
            const ing = ingredients.find((i) => i.id === ri.ingredientId);
            if (!ing) return null;
            return (
              <li key={ri.ingredientId} className="flex justify-between border-b border-border/60 py-2 text-mauve">
                <span>{ing.name}</span>
                <span className="text-muted-foreground">
                  {ri.quantity} {ing.unit}
                </span>
              </li>
            );
          })}
        </ul>
      </motion.div>
    </motion.div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${bold ? "bg-secondary text-mauve font-semibold" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className={bold ? "text-mauve" : "text-mauve"}>{value}</span>
    </div>
  );
}
