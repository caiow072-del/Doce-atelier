import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, ShoppingBasket, ChefHat, Plus, X } from "lucide-react";
import { useStore, type Festival } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/festival")({
  head: () => ({
    meta: [
      { title: "Festival — Jack Menezes Cakes Manager" },
      { name: "description", content: "Cronograma de produção e lista de compras do festival." },
    ],
  }),
  component: FestivalPage,
});

const days: { key: keyof Festival["schedule"]; label: string; sub: string }[] = [
  { key: "qua", label: "Quarta", sub: "Recheios e bases" },
  { key: "qui", label: "Quinta", sub: "Massas e forno" },
  { key: "sex", label: "Sexta", sub: "Montagem e prensa" },
  { key: "sab", label: "Sábado", sub: "Decoração e salgadas" },
];

function FestivalPage() {
  const { festivals, recipes, ingredients, toggleScheduleItem, addFestival } = useStore();
  const festival = festivals[festivals.length - 1];
  const [activeDay, setActiveDay] = useState<keyof Festival["schedule"]>("qua");
  const [showNew, setShowNew] = useState(false);

  // Lista de compras consolidada
  const shoppingList = useMemo(() => {
    if (!festival) return [];
    const totals = new Map<string, { name: string; unit: string; qty: number }>();
    festival.recipes.forEach(({ recipeId, batches }) => {
      const r = recipes.find((x) => x.id === recipeId);
      if (!r) return;
      r.ingredients.forEach((ri) => {
        const ing = ingredients.find((i) => i.id === ri.ingredientId);
        if (!ing) return;
        const cur = totals.get(ing.id) ?? { name: ing.name, unit: ing.unit, qty: 0 };
        cur.qty += ri.quantity * batches;
        totals.set(ing.id, cur);
      });
    });
    return Array.from(totals.values());
  }, [festival, recipes, ingredients]);

  const totalTasks = festival ? Object.values(festival.schedule).flat().length : 0;
  const doneTasks = festival ? Object.values(festival.schedule).flat().filter((t) => t.done).length : 0;
  const progress = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coração do negócio"
        title="Festival de Sábado"
        subtitle={festival ? festival.name : "Crie seu primeiro festival"}
      />

      {/* Progress */}
      {festival && (
        <div className="card-soft p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-mauve">Produção da semana</p>
            <span className="text-xs text-muted-foreground">
              {doneTasks}/{totalTasks} tarefas
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full bg-rose"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
        </div>
      )}

      {/* Day tabs */}
      {festival && (
        <div className="grid grid-cols-4 gap-2">
          {days.map((d) => {
            const active = activeDay === d.key;
            const dayDone = festival.schedule[d.key].filter((t) => t.done).length;
            const dayTotal = festival.schedule[d.key].length;
            return (
              <button
                key={d.key}
                onClick={() => setActiveDay(d.key)}
                className={`rounded-2xl border px-2 py-3 text-center transition-all ${
                  active
                    ? "border-rose bg-blush/60 text-mauve shadow-soft"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                <p className="font-display italic text-base leading-none">{d.label}</p>
                <p className="mt-1 text-[10px]">
                  {dayDone}/{dayTotal}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Tasks */}
      {festival && (
        <div className="card-soft overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/60 bg-blush/30 px-5 py-3">
            <ChefHat className="h-4 w-4 text-mauve" strokeWidth={1.6} />
            <p className="text-sm font-medium text-mauve">{days.find((d) => d.key === activeDay)?.sub}</p>
          </div>
          <ul className="divide-y divide-border/60">
            <AnimatePresence mode="popLayout">
              {festival.schedule[activeDay].map((t, idx) => (
                <motion.li
                  layout
                  key={`${activeDay}-${idx}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex cursor-pointer items-center gap-3 px-5 py-4 active:bg-blush/30"
                  onClick={() => toggleScheduleItem(festival.id, activeDay, idx)}
                >
                  {t.done ? (
                    <CheckCircle2 className="h-6 w-6 text-success shrink-0" strokeWidth={1.6} />
                  ) : (
                    <Circle className="h-6 w-6 text-rose shrink-0" strokeWidth={1.6} />
                  )}
                  <span className={`text-sm ${t.done ? "text-muted-foreground line-through" : "text-mauve"}`}>
                    {t.task}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      {/* Shopping list */}
      {festival && (
        <div className="card-soft overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/60 bg-blush/30 px-5 py-3">
            <ShoppingBasket className="h-4 w-4 text-mauve" strokeWidth={1.6} />
            <p className="text-sm font-medium text-mauve">Lista de compras consolidada</p>
          </div>
          <ul className="divide-y divide-border/60">
            {shoppingList.map((it) => (
              <li key={it.name} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-mauve">{it.name}</span>
                <span className="text-muted-foreground">
                  {it.qty.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {it.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() => setShowNew(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose/60 bg-card py-4 text-sm font-medium text-mauve transition-colors hover:bg-blush/40"
      >
        <Plus className="h-4 w-4" /> Criar novo festival
      </button>

      <AnimatePresence>
        {showNew && (
          <NewFestivalSheet
            onClose={() => setShowNew(false)}
            recipes={recipes.map((r) => ({ id: r.id, name: r.name }))}
            onCreate={(name, recipeIds) => {
              addFestival({
                name,
                date: new Date().toISOString(),
                recipes: recipeIds.map((id) => ({ recipeId: id, batches: 1 })),
              });
              setShowNew(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NewFestivalSheet({
  onClose,
  recipes,
  onCreate,
}: {
  onClose: () => void;
  recipes: { id: string; name: string }[];
  onCreate: (name: string, recipeIds: string[]) => void;
}) {
  const [name, setName] = useState("Festival de Sábado");
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-mauve/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-t-3xl bg-card p-6 pb-10"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">Novo Festival</h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="text-xs uppercase tracking-widest text-rose">Nome do festival</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-3 text-mauve outline-none focus:border-rose"
        />
        <p className="mt-5 text-xs uppercase tracking-widest text-rose">Quais tortas?</p>
        <div className="mt-2 space-y-2">
          {recipes.map((r) => {
            const on = selected.includes(r.id);
            return (
              <button
                key={r.id}
                onClick={() => setSelected((s) => (on ? s.filter((x) => x !== r.id) : [...s, r.id]))}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                  on ? "border-rose bg-blush/50 text-mauve" : "border-border bg-card text-muted-foreground"
                }`}
              >
                {r.name}
                {on && <CheckCircle2 className="h-5 w-5 text-rose" strokeWidth={1.6} />}
              </button>
            );
          })}
        </div>
        <button
          disabled={!name || selected.length === 0}
          onClick={() => onCreate(name, selected)}
          className="mt-6 w-full rounded-2xl bg-rose py-4 text-sm font-semibold text-mauve disabled:opacity-50"
        >
          Criar festival
        </button>
      </motion.div>
    </motion.div>
  );
}
