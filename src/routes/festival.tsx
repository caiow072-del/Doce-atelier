import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { CheckCircle2, Circle, ShoppingBasket, ChefHat, Plus, X, Pencil, Trash2, Save, Calendar as CalendarIcon } from "lucide-react";
import { useStore, type Festival } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/festival")({
  head: () => ({
    meta: [
      { title: "Festival — Cakes Manager" },
      { name: "description", content: "Cronograma de produção e lista de compras dos festivais." },
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
  const {
    festivals,
    recipes,
    ingredients,
    toggleScheduleItem,
    addFestival,
    updateFestival,
    deleteFestival,
    setRecipeBatches,
    removeRecipeFromFestival,
    addRecipeToFestival,
    addScheduleTask,
    removeScheduleTask,
  } = useStore();

  const [selectedId, setSelectedId] = useState<string | null>(festivals[festivals.length - 1]?.id ?? null);
  useEffect(() => {
    if (!festivals.find((f) => f.id === selectedId)) {
      setSelectedId(festivals[festivals.length - 1]?.id ?? null);
    }
  }, [festivals, selectedId]);

  const festival = festivals.find((f) => f.id === selectedId) ?? null;
  const [activeDay, setActiveDay] = useState<keyof Festival["schedule"]>("qua");
  const [showNew, setShowNew] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [newTask, setNewTask] = useState("");

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

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coração do negócio"
        title="Festivais"
        subtitle="Planeje, edite e acompanhe cada sábado de venda."
      />

      {/* Lista de festivais (cronologia) */}
      <div className="card-soft p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-[11px] uppercase tracking-widest text-rose">Histórico</p>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1 rounded-xl bg-mauve px-3 py-1.5 text-xs font-medium text-cream hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Novo
          </button>
        </div>
        {festivals.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum festival ainda — crie o primeiro.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[...festivals]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((f) => {
                const active = f.id === selectedId;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedId(f.id)}
                    className={`shrink-0 rounded-2xl border px-4 py-2.5 text-left transition-colors ${
                      active ? "border-rose bg-blush/60 text-mauve" : "border-border bg-card text-muted-foreground hover:border-rose/40"
                    }`}
                  >
                    <p className="text-sm font-medium">{f.name}</p>
                    <p className="text-[10px] uppercase tracking-wider">{fmtDate(f.date)}</p>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {!festival && (
        <div className="card-soft p-10 text-center">
          <p className="text-sm text-muted-foreground">Selecione ou crie um festival para começar.</p>
        </div>
      )}

      {festival && (
        <>
          {/* Meta editável */}
          <div className="card-soft p-5">
            {editingMeta ? (
              <EditMeta
                festival={festival}
                onSave={(name, date) => {
                  updateFestival(festival.id, { name, date });
                  setEditingMeta(false);
                }}
                onCancel={() => setEditingMeta(false)}
              />
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-rose">Selecionado</p>
                  <h2 className="font-display text-2xl italic text-mauve">{festival.name}</h2>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarIcon className="h-3.5 w-3.5" /> {fmtDate(festival.date)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setEditingMeta(true)}
                    className="rounded-lg bg-blush/50 p-2 text-mauve hover:bg-blush/80"
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Excluir "${festival.name}"? Esta ação não pode ser desfeita.`)) {
                        deleteFestival(festival.id);
                      }
                    }}
                    className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive/20"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Progress */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-mauve">Produção da semana</span>
                <span className="text-muted-foreground">{doneTasks}/{totalTasks} tarefas</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-rose transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          {/* Receitas e lotes */}
          <div className="card-soft overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 bg-blush/30 px-5 py-3">
              <p className="text-sm font-medium text-mauve">Receitas e lotes</p>
              <AddRecipeButton
                festival={festival}
                allRecipes={recipes.map((r) => ({ id: r.id, name: r.name }))}
                onAdd={(rid) => addRecipeToFestival(festival.id, rid)}
              />
            </div>
            <ul className="divide-y divide-border/60">
              {festival.recipes.length === 0 ? (
                <li className="px-5 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma receita neste festival ainda.
                </li>
              ) : (
                festival.recipes.map((fr) => {
                  const recipe = recipes.find((r) => r.id === fr.recipeId);
                  if (!recipe) return null;
                  return (
                    <li key={fr.recipeId} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="text-sm text-mauve">{recipe.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRecipeBatches(festival.id, fr.recipeId, fr.batches - 1)}
                          className="grid h-7 w-7 place-items-center rounded-lg bg-blush/40 text-mauve hover:bg-blush/70"
                        >
                          −
                        </button>
                        <span className="w-10 text-center text-sm font-semibold text-mauve">{fr.batches}</span>
                        <button
                          onClick={() => setRecipeBatches(festival.id, fr.recipeId, fr.batches + 1)}
                          className="grid h-7 w-7 place-items-center rounded-lg bg-blush/40 text-mauve hover:bg-blush/70"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeRecipeFromFestival(festival.id, fr.recipeId)}
                          className="ml-2 rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          {/* Day tabs */}
          <div className="grid grid-cols-4 gap-2">
            {days.map((d) => {
              const active = activeDay === d.key;
              const dayDone = festival.schedule[d.key].filter((t) => t.done).length;
              const dayTotal = festival.schedule[d.key].length;
              return (
                <button
                  key={d.key}
                  onClick={() => setActiveDay(d.key)}
                  className={`rounded-2xl border px-2 py-3 text-center transition-colors ${
                    active
                      ? "border-rose bg-blush/60 text-mauve shadow-soft"
                      : "border-border bg-card text-muted-foreground hover:border-rose/40"
                  }`}
                >
                  <p className="font-display italic text-base leading-none">{d.label}</p>
                  <p className="mt-1 text-[10px]">{dayDone}/{dayTotal}</p>
                </button>
              );
            })}
          </div>

          {/* Tasks */}
          <div className="card-soft overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/60 bg-blush/30 px-5 py-3">
              <ChefHat className="h-4 w-4 text-mauve" strokeWidth={1.6} />
              <p className="text-sm font-medium text-mauve">{days.find((d) => d.key === activeDay)?.sub}</p>
            </div>
            <ul className="divide-y divide-border/60">
              {festival.schedule[activeDay].map((t, idx) => (
                <li
                  key={`${activeDay}-${idx}`}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <button
                    onClick={() => toggleScheduleItem(festival.id, activeDay, idx)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    {t.done ? (
                      <CheckCircle2 className="h-6 w-6 text-success shrink-0" strokeWidth={1.6} />
                    ) : (
                      <Circle className="h-6 w-6 text-rose shrink-0" strokeWidth={1.6} />
                    )}
                    <span className={`text-sm ${t.done ? "text-muted-foreground line-through" : "text-mauve"}`}>
                      {t.task}
                    </span>
                  </button>
                  <button
                    onClick={() => removeScheduleTask(festival.id, activeDay, idx)}
                    className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                    aria-label="Excluir tarefa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newTask.trim()) {
                  addScheduleTask(festival.id, activeDay, newTask.trim());
                  setNewTask("");
                }
              }}
              className="flex items-center gap-2 border-t border-border/60 bg-background/60 p-3"
            >
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder={`Adicionar tarefa de ${days.find((d) => d.key === activeDay)?.label.toLowerCase()}...`}
                className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-rose"
              />
              <button
                type="submit"
                className="rounded-xl bg-mauve px-3 py-2 text-sm text-cream hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Shopping list */}
          <div className="card-soft overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/60 bg-blush/30 px-5 py-3">
              <ShoppingBasket className="h-4 w-4 text-mauve" strokeWidth={1.6} />
              <p className="text-sm font-medium text-mauve">Lista de compras consolidada</p>
            </div>
            {shoppingList.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                Sem ingredientes calculados — adicione receitas com insumos cadastrados.
              </p>
            ) : (
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
            )}
          </div>
        </>
      )}

      {showNew && (
        <NewFestivalSheet
          onClose={() => setShowNew(false)}
          recipes={recipes.map((r) => ({ id: r.id, name: r.name }))}
          onCreate={(name, date, recipeIds) => {
            addFestival({
              name,
              date,
              recipes: recipeIds.map((id) => ({ recipeId: id, batches: 1 })),
            });
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}

function EditMeta({
  festival,
  onSave,
  onCancel,
}: {
  festival: Festival;
  onSave: (name: string, date: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(festival.name);
  const [date, setDate] = useState(festival.date.slice(0, 10));
  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] uppercase tracking-widest text-rose">Nome</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-mauve outline-none focus:border-rose"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-widest text-rose">Data</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-mauve outline-none focus:border-rose"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave(name.trim() || festival.name, new Date(date).toISOString())}
          className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-4 py-2 text-sm text-cream hover:opacity-90"
        >
          <Save className="h-4 w-4" /> Salvar
        </button>
        <button onClick={onCancel} className="rounded-xl bg-blush/40 px-4 py-2 text-sm text-mauve hover:bg-blush/70">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function AddRecipeButton({
  festival,
  allRecipes,
  onAdd,
}: {
  festival: Festival;
  allRecipes: { id: string; name: string }[];
  onAdd: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const available = allRecipes.filter((r) => !festival.recipes.some((fr) => fr.recipeId === r.id));
  if (available.length === 0) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-xl bg-card px-3 py-1.5 text-xs font-medium text-mauve hover:bg-blush/40"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-petal">
          {available.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                onAdd(r.id);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-mauve hover:bg-blush/40"
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
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
  onCreate: (name: string, dateISO: string, recipeIds: string[]) => void;
}) {
  // próximo sábado
  const nextSat = useMemo(() => {
    const d = new Date();
    const diff = (6 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }, []);
  const [name, setName] = useState("Festival de Sábado");
  const [date, setDate] = useState(nextSat);
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-mauve/30 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-t-3xl bg-card p-6 pb-10 sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">Novo Festival</h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-widest text-rose">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-3 text-mauve outline-none focus:border-rose"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-rose">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-3 text-mauve outline-none focus:border-rose"
            />
          </div>
        </div>
        <p className="mt-5 text-xs uppercase tracking-widest text-rose">Quais tortas?</p>
        <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
          {recipes.length === 0 && (
            <p className="text-sm text-muted-foreground">Cadastre receitas primeiro para selecioná-las aqui.</p>
          )}
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
          disabled={!name}
          onClick={() => onCreate(name.trim(), new Date(date).toISOString(), selected)}
          className="mt-6 w-full rounded-2xl bg-mauve py-4 text-sm font-semibold text-cream disabled:opacity-50"
        >
          Criar festival
        </button>
      </div>
    </div>
  );
}
