import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarHeart,
  Plus,
  Trash2,
  X,
  Save,
  Pencil,
  Calendar as CalIcon,
  ShoppingBasket,
  CheckCircle2,
  Circle,
  Tag,
  Settings2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/eventos")({
  head: () => ({
    meta: [
      { title: "Eventos — Cakes Manager" },
      { name: "description", content: "Festivais, feiras, festas e todos os eventos da confeitaria." },
    ],
  }),
  component: EventosPage,
});

type EventType = { id: string; name: string; color: string; icon: string };
type Event = {
  id: string;
  name: string;
  date: string;
  location: string | null;
  notes: string | null;
  event_type_id: string | null;
};
type Recipe = { id: string; name: string; servings: number };
type Ingredient = { id: string; name: string; unit: string };
type RecipeIng = { recipe_id: string; ingredient_id: string; quantity: number };
type EventRecipe = { id: string; recipe_id: string; batches: number };
type EventTask = { id: string; day_key: string; task: string; done: boolean; position: number };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const defaultDays = [
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
];

function EventosPage() {
  const { currentShop } = useAuth();
  const shopId = currentShop?.shop_id;

  const [types, setTypes] = useState<EventType[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipeIngs, setRecipeIngs] = useState<RecipeIng[]>([]);
  const [eventRecipes, setEventRecipes] = useState<EventRecipe[]>([]);
  const [eventTasks, setEventTasks] = useState<EventTask[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [activeDay, setActiveDay] = useState("qua");
  const [newTask, setNewTask] = useState("");

  // Initial load
  useEffect(() => {
    if (!shopId) return;
    (async () => {
      const [tRes, eRes, rRes, iRes, riRes] = await Promise.all([
        supabase.from("event_types").select("*").eq("shop_id", shopId).order("name"),
        supabase.from("events").select("*").eq("shop_id", shopId).order("date", { ascending: false }),
        supabase.from("recipes").select("id, name, servings").eq("shop_id", shopId).order("name"),
        supabase.from("ingredients").select("id, name, unit").eq("shop_id", shopId),
        supabase.from("recipe_ingredients").select("recipe_id, ingredient_id, quantity"),
      ]);

      let tList = (tRes.data ?? []) as EventType[];
      // Seed default types if empty
      if (tList.length === 0) {
        const seeds = [
          { shop_id: shopId, name: "Festival", color: "rose", icon: "calendar-heart" },
          { shop_id: shopId, name: "Feira", color: "sage", icon: "store" },
          { shop_id: shopId, name: "Festa", color: "blush", icon: "sparkles" },
        ];
        const { data: inserted } = await supabase.from("event_types").insert(seeds).select("*");
        tList = (inserted ?? []) as EventType[];
      }
      setTypes(tList);
      setEvents((eRes.data ?? []) as Event[]);
      setRecipes((rRes.data ?? []) as Recipe[]);
      setIngredients((iRes.data ?? []) as Ingredient[]);
      setRecipeIngs((riRes.data ?? []) as RecipeIng[]);

      const first = (eRes.data ?? [])[0];
      if (first) setSelectedId(first.id);
    })();
  }, [shopId]);

  // Load event details
  useEffect(() => {
    if (!selectedId) {
      setEventRecipes([]);
      setEventTasks([]);
      return;
    }
    Promise.all([
      supabase.from("event_recipes").select("*").eq("event_id", selectedId),
      supabase.from("event_tasks").select("*").eq("event_id", selectedId).order("position"),
    ]).then(([er, et]) => {
      setEventRecipes((er.data ?? []) as EventRecipe[]);
      setEventTasks((et.data ?? []) as EventTask[]);
    });
  }, [selectedId]);

  const selected = events.find((e) => e.id === selectedId) ?? null;

  const shoppingList = useMemo(() => {
    if (!selected) return [];
    const totals = new Map<string, { name: string; unit: string; qty: number }>();
    eventRecipes.forEach((er) => {
      const ings = recipeIngs.filter((ri) => ri.recipe_id === er.recipe_id);
      ings.forEach((ri) => {
        const ing = ingredients.find((i) => i.id === ri.ingredient_id);
        if (!ing) return;
        const cur = totals.get(ing.id) ?? { name: ing.name, unit: ing.unit, qty: 0 };
        cur.qty += ri.quantity * Number(er.batches);
        totals.set(ing.id, cur);
      });
    });
    return Array.from(totals.values());
  }, [selected, eventRecipes, recipeIngs, ingredients]);

  const dayTasks = eventTasks.filter((t) => t.day_key === activeDay);
  const totalTasks = eventTasks.length;
  const doneTasks = eventTasks.filter((t) => t.done).length;
  const progress = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  // ===== mutations =====
  const setBatches = async (id: string, batches: number) => {
    const v = Math.max(0, batches);
    setEventRecipes((p) => p.map((er) => (er.id === id ? { ...er, batches: v } : er)));
    await supabase.from("event_recipes").update({ batches: v }).eq("id", id);
  };
  const removeRecipe = async (id: string) => {
    setEventRecipes((p) => p.filter((er) => er.id !== id));
    await supabase.from("event_recipes").delete().eq("id", id);
  };
  const addRecipe = async (recipeId: string) => {
    if (!selected) return;
    if (eventRecipes.some((er) => er.recipe_id === recipeId)) return;
    const { data, error } = await supabase
      .from("event_recipes")
      .insert({ event_id: selected.id, recipe_id: recipeId, batches: 1 })
      .select("*")
      .single();
    if (error) return toast.error("Erro ao adicionar");
    setEventRecipes((p) => [...p, data as EventRecipe]);
  };
  const toggleTask = async (t: EventTask) => {
    setEventTasks((p) => p.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    await supabase.from("event_tasks").update({ done: !t.done }).eq("id", t.id);
  };
  const addTask = async () => {
    if (!selected || !newTask.trim()) return;
    const pos = dayTasks.length;
    const { data, error } = await supabase
      .from("event_tasks")
      .insert({ event_id: selected.id, day_key: activeDay, task: newTask.trim(), position: pos })
      .select("*")
      .single();
    if (error) return toast.error("Erro");
    setEventTasks((p) => [...p, data as EventTask]);
    setNewTask("");
  };
  const removeTask = async (id: string) => {
    setEventTasks((p) => p.filter((t) => t.id !== id));
    await supabase.from("event_tasks").delete().eq("id", id);
  };
  const updateMeta = async (patch: Partial<Pick<Event, "name" | "date" | "location" | "notes" | "event_type_id">>) => {
    if (!selected) return;
    setEvents((p) => p.map((e) => (e.id === selected.id ? { ...e, ...patch } : e)));
    await supabase.from("events").update(patch).eq("id", selected.id);
  };
  const removeEvent = async () => {
    if (!selected) return;
    if (!confirm(`Excluir "${selected.name}"?`)) return;
    await supabase.from("events").delete().eq("id", selected.id);
    setEvents((p) => p.filter((e) => e.id !== selected.id));
    setSelectedId(events.find((e) => e.id !== selected.id)?.id ?? null);
  };

  const typeOf = (id: string | null) => types.find((t) => t.id === id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coração do negócio"
        title="Eventos"
        subtitle="Festivais, feiras, festas — tudo personalizável."
      />

      {/* Lista de eventos */}
      <div className="card-soft p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <p className="text-[11px] uppercase tracking-widest text-rose">Histórico</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTypes(true)}
              className="inline-flex items-center gap-1 rounded-xl bg-blush/50 px-3 py-1.5 text-xs font-medium text-mauve hover:bg-blush/80"
            >
              <Settings2 className="h-3.5 w-3.5" /> Tipos
            </button>
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1 rounded-xl bg-mauve px-3 py-1.5 text-xs font-medium text-cream hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Novo evento
            </button>
          </div>
        </div>
        {events.length === 0 ? (
          <div className="py-8 text-center">
            <CalendarHeart className="mx-auto h-10 w-10 text-rose" strokeWidth={1.4} />
            <p className="mt-2 text-sm text-muted-foreground">Nenhum evento ainda — crie o primeiro.</p>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {events.map((e) => {
              const t = typeOf(e.event_type_id);
              const active = e.id === selectedId;
              return (
                <button
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className={`shrink-0 rounded-2xl border px-4 py-2.5 text-left transition-colors min-w-[160px] ${
                    active ? "border-rose bg-blush/60 text-mauve" : "border-border bg-card text-muted-foreground hover:border-rose/40"
                  }`}
                >
                  {t && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-card/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-rose">
                      <Tag className="h-2.5 w-2.5" /> {t.name}
                    </span>
                  )}
                  <p className="mt-1 text-sm font-medium">{e.name}</p>
                  <p className="text-[10px] uppercase tracking-wider">{fmtDate(e.date)}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!selected && events.length > 0 && (
        <div className="card-soft p-8 text-center text-sm text-muted-foreground">Selecione um evento.</div>
      )}

      {selected && (
        <>
          {/* Meta */}
          <div className="card-soft p-5">
            {editingMeta ? (
              <EditMeta
                event={selected}
                types={types}
                onSave={async (patch) => {
                  await updateMeta(patch);
                  setEditingMeta(false);
                }}
                onCancel={() => setEditingMeta(false)}
              />
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div>
                  {typeOf(selected.event_type_id) && (
                    <p className="text-[11px] uppercase tracking-widest text-rose">{typeOf(selected.event_type_id)!.name}</p>
                  )}
                  <h2 className="font-display text-2xl italic text-mauve">{selected.name}</h2>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalIcon className="h-3.5 w-3.5" /> {fmtDate(selected.date)}
                    {selected.location && <span> · {selected.location}</span>}
                  </p>
                  {selected.notes && <p className="mt-2 text-sm text-mauve/80">{selected.notes}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => setEditingMeta(true)} className="rounded-lg bg-blush/50 p-2 text-mauve hover:bg-blush/80" aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={removeEvent} className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive/20" aria-label="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-mauve">Produção</span>
                <span className="text-muted-foreground">{doneTasks}/{totalTasks} tarefas</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-rose transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          {/* Receitas */}
          <div className="card-soft overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 bg-blush/30 px-5 py-3">
              <p className="text-sm font-medium text-mauve">Receitas e lotes</p>
              <AddRecipeBtn
                allRecipes={recipes}
                excludeIds={eventRecipes.map((er) => er.recipe_id)}
                onAdd={addRecipe}
              />
            </div>
            <ul className="divide-y divide-border/60">
              {eventRecipes.length === 0 ? (
                <li className="px-5 py-6 text-center text-sm text-muted-foreground">Nenhuma receita ainda.</li>
              ) : (
                eventRecipes.map((er) => {
                  const r = recipes.find((x) => x.id === er.recipe_id);
                  if (!r) return null;
                  return (
                    <li key={er.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="text-sm text-mauve">{r.name}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setBatches(er.id, Number(er.batches) - 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-blush/40 text-mauve hover:bg-blush/70">−</button>
                        <span className="w-10 text-center text-sm font-semibold text-mauve">{er.batches}</span>
                        <button onClick={() => setBatches(er.id, Number(er.batches) + 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-blush/40 text-mauve hover:bg-blush/70">+</button>
                        <button onClick={() => removeRecipe(er.id)} className="ml-2 rounded-lg p-1.5 text-destructive hover:bg-destructive/10" aria-label="Remover">
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
            {defaultDays.map((d) => {
              const active = activeDay === d.key;
              const dayCount = eventTasks.filter((t) => t.day_key === d.key);
              return (
                <button
                  key={d.key}
                  onClick={() => setActiveDay(d.key)}
                  className={`rounded-2xl border px-2 py-3 text-center transition-colors ${
                    active ? "border-rose bg-blush/60 text-mauve shadow-soft" : "border-border bg-card text-muted-foreground hover:border-rose/40"
                  }`}
                >
                  <p className="font-display italic text-base leading-none">{d.label}</p>
                  <p className="mt-1 text-[10px]">{dayCount.filter((t) => t.done).length}/{dayCount.length}</p>
                </button>
              );
            })}
          </div>

          {/* Tasks */}
          <div className="card-soft overflow-hidden">
            <ul className="divide-y divide-border/60">
              {dayTasks.length === 0 ? (
                <li className="px-5 py-6 text-center text-sm text-muted-foreground">Sem tarefas neste dia.</li>
              ) : (
                dayTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <button onClick={() => toggleTask(t)} className="flex flex-1 items-center gap-3 text-left">
                      {t.done ? (
                        <CheckCircle2 className="h-6 w-6 text-success shrink-0" strokeWidth={1.6} />
                      ) : (
                        <Circle className="h-6 w-6 text-rose shrink-0" strokeWidth={1.6} />
                      )}
                      <span className={`text-sm ${t.done ? "text-muted-foreground line-through" : "text-mauve"}`}>{t.task}</span>
                    </button>
                    <button onClick={() => removeTask(t.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" aria-label="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))
              )}
            </ul>
            <form
              onSubmit={(e) => { e.preventDefault(); addTask(); }}
              className="flex items-center gap-2 border-t border-border/60 bg-background/60 p-3"
            >
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Adicionar tarefa..."
                className="input-base flex-1"
              />
              <button type="submit" className="rounded-xl bg-mauve px-3 py-2 text-sm text-cream hover:opacity-90">
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
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">Sem ingredientes — adicione receitas com insumos cadastrados.</p>
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

      {showNew && shopId && (
        <NewEventSheet
          shopId={shopId}
          types={types}
          onClose={() => setShowNew(false)}
          onCreated={(e) => {
            setEvents((p) => [e, ...p]);
            setSelectedId(e.id);
            setShowNew(false);
          }}
        />
      )}

      {showTypes && shopId && (
        <TypesSheet
          shopId={shopId}
          types={types}
          onClose={() => setShowTypes(false)}
          onChange={setTypes}
        />
      )}
    </div>
  );
}

// ============ Sub-components ============

function EditMeta({
  event,
  types,
  onSave,
  onCancel,
}: {
  event: Event;
  types: EventType[];
  onSave: (patch: Partial<Event>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(event.date.slice(0, 10));
  const [location, setLocation] = useState(event.location ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");
  const [typeId, setTypeId] = useState(event.event_type_id ?? "");

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-rose">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-base mt-1" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-rose">Tipo</label>
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="input-base mt-1">
            <option value="">— Sem tipo —</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-rose">Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base mt-1" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-rose">Local</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="input-base mt-1" />
        </div>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-widest text-rose">Observações</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input-base mt-1" />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() =>
            onSave({
              name: name.trim() || event.name,
              date: new Date(date).toISOString(),
              location: location || null,
              notes: notes || null,
              event_type_id: typeId || null,
            })
          }
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

function AddRecipeBtn({
  allRecipes,
  excludeIds,
  onAdd,
}: {
  allRecipes: Recipe[];
  excludeIds: string[];
  onAdd: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const available = allRecipes.filter((r) => !excludeIds.includes(r.id));
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
        <div className="absolute right-0 top-full mt-1 z-20 max-h-64 w-56 overflow-y-auto rounded-xl border border-border bg-card shadow-petal">
          {available.map((r) => (
            <button
              key={r.id}
              onClick={() => { onAdd(r.id); setOpen(false); }}
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

function NewEventSheet({
  shopId,
  types,
  onClose,
  onCreated,
}: {
  shopId: string;
  types: EventType[];
  onClose: () => void;
  onCreated: (e: Event) => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Dê um nome ao evento");
    setSaving(true);
    const { data, error } = await supabase
      .from("events")
      .insert({
        shop_id: shopId,
        name: name.trim(),
        date: new Date(date).toISOString(),
        location: location || null,
        event_type_id: typeId || null,
      })
      .select("*")
      .single();
    setSaving(false);
    if (error) return toast.error("Erro ao criar");
    toast.success("Evento criado");
    onCreated(data as Event);
  };

  return (
    <div className="fixed inset-0 z-50 bg-mauve/40 backdrop-blur-sm" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-petal">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">Novo evento</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-rose">Nome *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Festival de Sábado" className="input-base mt-1" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-rose">Tipo</label>
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="input-base mt-1">
              <option value="">— Sem tipo —</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-rose">Data *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base mt-1" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-rose">Local</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="input-base mt-1" />
          </div>
        </div>
        <button type="submit" disabled={saving} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-mauve px-4 py-3 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Criar evento"}
        </button>
      </form>
    </div>
  );
}

function TypesSheet({
  shopId,
  types,
  onClose,
  onChange,
}: {
  shopId: string;
  types: EventType[];
  onClose: () => void;
  onChange: (t: EventType[]) => void;
}) {
  const [name, setName] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    const { data, error } = await supabase
      .from("event_types")
      .insert({ shop_id: shopId, name: name.trim(), color: "rose", icon: "sparkles" })
      .select("*")
      .single();
    if (error) return toast.error(error.message.includes("duplicate") ? "Tipo já existe" : "Erro");
    onChange([...types, data as EventType]);
    setName("");
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este tipo? Eventos associados ficarão sem tipo.")) return;
    const { error } = await supabase.from("event_types").delete().eq("id", id);
    if (error) return toast.error("Erro");
    onChange(types.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 bg-mauve/40 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-petal">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">Tipos de evento</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Personalize as categorias dos seus eventos.</p>
        <ul className="mt-4 divide-y divide-border/60 rounded-xl border border-border">
          {types.length === 0 ? (
            <li className="p-4 text-center text-sm text-muted-foreground">Nenhum tipo cadastrado.</li>
          ) : (
            types.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-mauve">{t.name}</span>
                <button onClick={() => remove(t.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))
          )}
        </ul>
        <form
          onSubmit={(e) => { e.preventDefault(); add(); }}
          className="mt-4 flex gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Casamento, Aniversário..."
            className="input-base flex-1"
          />
          <button type="submit" className="rounded-xl bg-mauve px-4 text-sm text-cream hover:opacity-90">
            <Plus className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
