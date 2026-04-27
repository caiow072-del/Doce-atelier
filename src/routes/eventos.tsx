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
  Users,
  Clock,
  MapPin,
  Store,
  Cake,
  PartyPopper,
  Sparkles,
  Wallet,
  Truck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { formatBRL } from "@/lib/store";
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

type EventKind = "festival" | "party" | "fair" | "wedding" | "generic";

type EventType = { id: string; name: string; color: string; icon: string; kind: EventKind };
type Event = {
  id: string;
  name: string;
  date: string;
  location: string | null;
  notes: string | null;
  event_type_id: string | null;
  start_time: string | null;
  guests: number | null;
  main_flavor: string | null;
  customer_name: string | null;
  fee: number;
  opening_cash: number;
};
type Recipe = { id: string; name: string; servings: number };
type Ingredient = { id: string; name: string; unit: string };
type RecipeIng = { recipe_id: string; ingredient_id: string; quantity: number };
type EventRecipe = { id: string; recipe_id: string; batches: number };
type EventTask = { id: string; day_key: string; task: string; done: boolean; position: number };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Templates (kinds) defining: label, default tasks, days/sections, default seed types
const KIND_META: Record<EventKind, { label: string; icon: any; description: string }> = {
  festival: {
    label: "Festival",
    icon: CalendarHeart,
    description: "Produção em lotes para vender em vários dias.",
  },
  party: {
    label: "Festa / Encomenda",
    icon: PartyPopper,
    description: "Bolo personalizado para um cliente específico.",
  },
  fair: {
    label: "Feira / Bazar",
    icon: Store,
    description: "Estande com vendas no caixa e troco inicial.",
  },
  wedding: {
    label: "Casamento",
    icon: Sparkles,
    description: "Bolo principal, doces finos e logística completa.",
  },
  generic: {
    label: "Outro",
    icon: Tag,
    description: "Evento genérico personalizado.",
  },
};

const FESTIVAL_DAYS = [
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
];

const PARTY_DAYS = [
  { key: "antevespera", label: "2 dias antes" },
  { key: "vespera", label: "Véspera" },
  { key: "dia", label: "Dia" },
];

const FAIR_DAYS = [
  { key: "preparo", label: "Preparo" },
  { key: "montagem", label: "Montagem" },
  { key: "feira", label: "Feira" },
];

const WEDDING_DAYS = [
  { key: "semana", label: "Semana" },
  { key: "vespera", label: "Véspera" },
  { key: "dia", label: "Dia" },
];

const GENERIC_DAYS = [
  { key: "antes", label: "Antes" },
  { key: "dia", label: "Dia" },
];

const daysFor = (k: EventKind) =>
  ({
    festival: FESTIVAL_DAYS,
    party: PARTY_DAYS,
    fair: FAIR_DAYS,
    wedding: WEDDING_DAYS,
    generic: GENERIC_DAYS,
  }[k]);

// Default checklist suggestions per kind
const DEFAULT_TASKS: Record<EventKind, { day_key: string; task: string }[]> = {
  festival: [
    { day_key: "qua", task: "Comprar insumos faltantes" },
    { day_key: "qua", task: "Preparar bases e massas" },
    { day_key: "qui", task: "Assar bolos e bases de torta" },
    { day_key: "qui", task: "Preparar recheios" },
    { day_key: "sex", task: "Montar e rechear" },
    { day_key: "sex", task: "Decoração final" },
    { day_key: "sab", task: "Embalar e etiquetar" },
    { day_key: "sab", task: "Carregar carro e ir ao local" },
  ],
  party: [
    { day_key: "antevespera", task: "Confirmar pedido com cliente" },
    { day_key: "antevespera", task: "Comprar insumos especiais" },
    { day_key: "vespera", task: "Assar massas" },
    { day_key: "vespera", task: "Preparar recheio" },
    { day_key: "dia", task: "Montar bolo" },
    { day_key: "dia", task: "Decorar" },
    { day_key: "dia", task: "Embalar para entrega" },
    { day_key: "dia", task: "Confirmar endereço e horário" },
  ],
  fair: [
    { day_key: "preparo", task: "Separar troco inicial" },
    { day_key: "preparo", task: "Preparar produtos para venda" },
    { day_key: "montagem", task: "Montar barraca / estande" },
    { day_key: "montagem", task: "Organizar maquininha de cartão" },
    { day_key: "feira", task: "Abrir caixa" },
    { day_key: "feira", task: "Repor mostruário" },
    { day_key: "feira", task: "Fechar caixa e contar dinheiro" },
  ],
  wedding: [
    { day_key: "semana", task: "Reunião final com noivos" },
    { day_key: "semana", task: "Comprar insumos premium" },
    { day_key: "vespera", task: "Assar todas as camadas" },
    { day_key: "vespera", task: "Preparar doces finos" },
    { day_key: "dia", task: "Montar bolo no local" },
    { day_key: "dia", task: "Decoração com flores" },
    { day_key: "dia", task: "Foto final / entrega" },
  ],
  generic: [
    { day_key: "antes", task: "Planejar produção" },
    { day_key: "dia", task: "Executar evento" },
  ],
};

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
  const [activeDay, setActiveDay] = useState<string>("");
  const [newTask, setNewTask] = useState("");
  const [filterKind, setFilterKind] = useState<EventKind | "all">("all");

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
          { shop_id: shopId, name: "Festival de Tortas", color: "rose", icon: "calendar-heart", kind: "festival" },
          { shop_id: shopId, name: "Festa de Aniversário", color: "blush", icon: "party-popper", kind: "party" },
          { shop_id: shopId, name: "Feira / Bazar", color: "sage", icon: "store", kind: "fair" },
          { shop_id: shopId, name: "Casamento", color: "rose", icon: "sparkles", kind: "wedding" },
        ];
        const { data: inserted } = await supabase.from("event_types").insert(seeds).select("*");
        tList = (inserted ?? []) as EventType[];
      } else {
        // Backfill kind if missing on existing types (kind defaults to 'generic' from DB)
        const fixes = tList.filter((t) => t.kind === "generic" || !t.kind);
        for (const t of fixes) {
          const lower = t.name.toLowerCase();
          let k: EventKind = "generic";
          if (lower.includes("festival")) k = "festival";
          else if (lower.includes("feira") || lower.includes("bazar")) k = "fair";
          else if (lower.includes("casamento")) k = "wedding";
          else if (lower.includes("festa") || lower.includes("aniversário") || lower.includes("aniversario")) k = "party";
          if (k !== t.kind) {
            await supabase.from("event_types").update({ kind: k }).eq("id", t.id);
            t.kind = k;
          }
        }
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

  const selected = events.find((e) => e.id === selectedId) ?? null;
  const selectedKind: EventKind =
    types.find((t) => t.id === selected?.event_type_id)?.kind ?? "generic";
  const days = daysFor(selectedKind);

  // Set first day of template when event changes
  useEffect(() => {
    if (selected) setActiveDay(daysFor(selectedKind)[0].key);
  }, [selectedId, selectedKind]);

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
  const seedDefaultTasks = async () => {
    if (!selected) return;
    const seeds = DEFAULT_TASKS[selectedKind].map((t, i) => ({
      event_id: selected.id,
      day_key: t.day_key,
      task: t.task,
      position: i,
    }));
    const { data, error } = await supabase.from("event_tasks").insert(seeds).select("*");
    if (error) return toast.error("Erro ao gerar checklist");
    setEventTasks((p) => [...p, ...((data ?? []) as EventTask[])]);
    toast.success("Checklist sugerido adicionado");
  };
  const updateMeta = async (patch: Partial<Event>) => {
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
  const kindOf = (id: string | null): EventKind => typeOf(id)?.kind ?? "generic";

  const filteredEvents =
    filterKind === "all" ? events : events.filter((e) => kindOf(e.event_type_id) === filterKind);

  const kindsPresent = useMemo(() => {
    const set = new Set<EventKind>();
    events.forEach((e) => set.add(kindOf(e.event_type_id)));
    return Array.from(set);
  }, [events, types]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coração do negócio"
        title="Eventos"
        subtitle="Cada tipo tem seu próprio fluxo — escolha o template ao criar."
      />

      {/* Filter chips by kind */}
      {events.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <KindChip
            label="Todos"
            icon={Tag}
            active={filterKind === "all"}
            onClick={() => setFilterKind("all")}
            count={events.length}
          />
          {(["festival", "party", "fair", "wedding", "generic"] as EventKind[])
            .filter((k) => kindsPresent.includes(k))
            .map((k) => {
              const meta = KIND_META[k];
              const count = events.filter((e) => kindOf(e.event_type_id) === k).length;
              return (
                <KindChip
                  key={k}
                  label={meta.label}
                  icon={meta.icon}
                  active={filterKind === k}
                  onClick={() => setFilterKind(k)}
                  count={count}
                />
              );
            })}
        </div>
      )}

      {/* Lista de eventos */}
      <div className="card-soft p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-[11px] uppercase tracking-widest text-rose">Histórico</p>
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
        {filteredEvents.length === 0 ? (
          <div className="py-8 text-center">
            <CalendarHeart className="mx-auto h-10 w-10 text-rose" strokeWidth={1.4} />
            <p className="mt-2 text-sm text-muted-foreground">
              {events.length === 0 ? "Nenhum evento ainda — crie o primeiro." : "Nenhum evento neste filtro."}
            </p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((e) => {
              const t = typeOf(e.event_type_id);
              const k = t?.kind ?? "generic";
              const Icon = KIND_META[k].icon;
              const active = e.id === selectedId;
              return (
                <button
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors ${
                    active
                      ? "border-rose bg-blush/60 text-mauve shadow-soft"
                      : "border-border bg-card text-mauve hover:border-rose/40"
                  }`}
                >
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active ? "bg-rose/30" : "bg-blush/40"}`}>
                    <Icon className="h-5 w-5 text-mauve" strokeWidth={1.6} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-rose">{t?.name ?? "Sem tipo"}</p>
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {fmtDate(e.date)}
                      {e.start_time ? ` · ${e.start_time}` : ""}
                    </p>
                  </div>
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
                kind={selectedKind}
                types={types}
                onSave={async (patch) => {
                  await updateMeta(patch);
                  setEditingMeta(false);
                }}
                onCancel={() => setEditingMeta(false)}
              />
            ) : (
              <EventHeader
                event={selected}
                kind={selectedKind}
                typeName={typeOf(selected.event_type_id)?.name}
                onEdit={() => setEditingMeta(true)}
                onDelete={removeEvent}
              />
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

          {/* Per-kind sections */}
          <KindSections
            kind={selectedKind}
            event={selected}
            recipes={recipes}
            eventRecipes={eventRecipes}
            shoppingList={shoppingList}
            onAddRecipe={addRecipe}
            onSetBatches={setBatches}
            onRemoveRecipe={removeRecipe}
          />

          {/* Day tabs */}
          <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((d) => {
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
            {eventTasks.length === 0 && (
              <div className="border-b border-border/60 bg-blush/20 px-5 py-3">
                <button
                  onClick={seedDefaultTasks}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-3 py-1.5 text-xs font-medium text-cream hover:opacity-90"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Gerar checklist sugerido para {KIND_META[selectedKind].label}
                </button>
              </div>
            )}
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

function KindChip({
  label,
  icon: Icon,
  active,
  onClick,
  count,
}: {
  label: string;
  icon: any;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active ? "border-rose bg-blush/70 text-mauve" : "border-border bg-card text-muted-foreground hover:border-rose/40"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className="ml-1 rounded-full bg-card/70 px-1.5 text-[10px]">{count}</span>
    </button>
  );
}

function EventHeader({
  event,
  kind,
  typeName,
  onEdit,
  onDelete,
}: {
  event: Event;
  kind: EventKind;
  typeName?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {typeName && <p className="text-[11px] uppercase tracking-widest text-rose">{typeName}</p>}
        <h2 className="font-display text-2xl italic text-mauve">{event.name}</h2>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalIcon className="h-3.5 w-3.5" /> {fmtDate(event.date)}
          </span>
          {event.start_time && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {event.start_time}
            </span>
          )}
          {event.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {event.location}
            </span>
          )}
          {(kind === "party" || kind === "wedding") && event.customer_name && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> {event.customer_name}
            </span>
          )}
          {(kind === "party" || kind === "wedding") && event.guests != null && (
            <span className="inline-flex items-center gap-1.5">
              <Cake className="h-3.5 w-3.5" /> {event.guests} convidados
            </span>
          )}
        </div>
        {event.main_flavor && (
          <p className="mt-2 text-sm text-mauve/80">
            <span className="text-[10px] uppercase tracking-widest text-rose mr-2">Sabor</span>
            {event.main_flavor}
          </p>
        )}
        {event.notes && <p className="mt-2 text-sm text-mauve/80 whitespace-pre-line">{event.notes}</p>}

        {/* Kind-specific badges */}
        <div className="mt-3 flex flex-wrap gap-2">
          {(kind === "party" || kind === "wedding") && Number(event.fee) > 0 && (
            <Badge icon={Truck} label={`Taxa: ${formatBRL(Number(event.fee))}`} />
          )}
          {kind === "fair" && Number(event.opening_cash) > 0 && (
            <Badge icon={Wallet} label={`Troco inicial: ${formatBRL(Number(event.opening_cash))}`} />
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button onClick={onEdit} className="rounded-lg bg-blush/50 p-2 text-mauve hover:bg-blush/80" aria-label="Editar">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={onDelete} className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive/20" aria-label="Excluir">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Badge({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blush/40 px-2.5 py-1 text-[11px] text-mauve">
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function KindSections({
  kind,
  event,
  recipes,
  eventRecipes,
  shoppingList,
  onAddRecipe,
  onSetBatches,
  onRemoveRecipe,
}: {
  kind: EventKind;
  event: Event;
  recipes: Recipe[];
  eventRecipes: EventRecipe[];
  shoppingList: { name: string; unit: string; qty: number }[];
  onAddRecipe: (id: string) => void;
  onSetBatches: (id: string, n: number) => void;
  onRemoveRecipe: (id: string) => void;
}) {
  // Festival/Fair: foco em volume — receitas com lotes + lista de compras
  // Party/Wedding: foco em receita única — escolher 1 receita principal
  // Generic: receitas simples
  const showBatches = kind === "festival" || kind === "fair";
  const recipeTitle =
    kind === "party" || kind === "wedding" ? "Bolo / receita escolhida" : "Receitas e lotes";

  return (
    <>
      <div className="card-soft overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 bg-blush/30 px-5 py-3">
          <p className="text-sm font-medium text-mauve">{recipeTitle}</p>
          <AddRecipeBtn
            allRecipes={recipes}
            excludeIds={eventRecipes.map((er) => er.recipe_id)}
            onAdd={onAddRecipe}
          />
        </div>
        <ul className="divide-y divide-border/60">
          {eventRecipes.length === 0 ? (
            <li className="px-5 py-6 text-center text-sm text-muted-foreground">
              {kind === "party" || kind === "wedding" ? "Escolha a receita do bolo." : "Nenhuma receita ainda."}
            </li>
          ) : (
            eventRecipes.map((er) => {
              const r = recipes.find((x) => x.id === er.recipe_id);
              if (!r) return null;
              return (
                <li key={er.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="text-sm text-mauve">{r.name}</span>
                  <div className="flex items-center gap-2">
                    {showBatches ? (
                      <>
                        <button onClick={() => onSetBatches(er.id, Number(er.batches) - 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-blush/40 text-mauve hover:bg-blush/70">−</button>
                        <span className="w-12 text-center text-sm font-semibold text-mauve">
                          {er.batches} <span className="text-[10px] text-muted-foreground">lotes</span>
                        </span>
                        <button onClick={() => onSetBatches(er.id, Number(er.batches) + 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-blush/40 text-mauve hover:bg-blush/70">+</button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">{r.servings} fatias</span>
                    )}
                    <button onClick={() => onRemoveRecipe(er.id)} className="ml-2 rounded-lg p-1.5 text-destructive hover:bg-destructive/10" aria-label="Remover">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* Shopping list — only useful when there are quantities */}
      {(showBatches || eventRecipes.length > 0) && (
        <div className="card-soft overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/60 bg-blush/30 px-5 py-3">
            <ShoppingBasket className="h-4 w-4 text-mauve" strokeWidth={1.6} />
            <p className="text-sm font-medium text-mauve">Lista de compras</p>
          </div>
          {shoppingList.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">Sem ingredientes — adicione receitas com insumos.</p>
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
      )}
    </>
  );
}

function EditMeta({
  event,
  kind,
  types,
  onSave,
  onCancel,
}: {
  event: Event;
  kind: EventKind;
  types: EventType[];
  onSave: (patch: Partial<Event>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(event.date.slice(0, 10));
  const [startTime, setStartTime] = useState(event.start_time ?? "");
  const [location, setLocation] = useState(event.location ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");
  const [typeId, setTypeId] = useState(event.event_type_id ?? "");
  const [customerName, setCustomerName] = useState(event.customer_name ?? "");
  const [guests, setGuests] = useState(event.guests?.toString() ?? "");
  const [mainFlavor, setMainFlavor] = useState(event.main_flavor ?? "");
  const [fee, setFee] = useState(event.fee?.toString() ?? "0");
  const [openingCash, setOpeningCash] = useState(event.opening_cash?.toString() ?? "0");

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
              <option key={t.id} value={t.id}>{t.name} · {KIND_META[t.kind].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-rose">Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base mt-1" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-rose">Horário</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-base mt-1" />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] uppercase tracking-widest text-rose">Local / endereço</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="input-base mt-1" />
        </div>

        {(kind === "party" || kind === "wedding") && (
          <>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Cliente / Noivos</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input-base mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Convidados</label>
              <input type="number" value={guests} onChange={(e) => setGuests(e.target.value)} className="input-base mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Sabor principal</label>
              <input value={mainFlavor} onChange={(e) => setMainFlavor(e.target.value)} placeholder="Ex: Chocolate com morango" className="input-base mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Taxa de entrega (R$)</label>
              <input type="number" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} className="input-base mt-1" />
            </div>
          </>
        )}

        {kind === "fair" && (
          <div>
            <label className="text-[10px] uppercase tracking-widest text-rose">Troco inicial (R$)</label>
            <input type="number" step="0.01" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} className="input-base mt-1" />
          </div>
        )}
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
              start_time: startTime || null,
              location: location || null,
              notes: notes || null,
              event_type_id: typeId || null,
              customer_name: customerName || null,
              guests: guests ? Number(guests) : null,
              main_flavor: mainFlavor || null,
              fee: Number(fee) || 0,
              opening_cash: Number(openingCash) || 0,
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
  const [step, setStep] = useState<"kind" | "details">("kind");
  const [typeId, setTypeId] = useState<string>("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [guests, setGuests] = useState("");
  const [mainFlavor, setMainFlavor] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedType = types.find((t) => t.id === typeId);
  const kind: EventKind = selectedType?.kind ?? "generic";

  // Group types by kind
  const byKind = useMemo(() => {
    const map = new Map<EventKind, EventType[]>();
    types.forEach((t) => {
      const arr = map.get(t.kind) ?? [];
      arr.push(t);
      map.set(t.kind, arr);
    });
    return map;
  }, [types]);

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
        start_time: startTime || null,
        location: location || null,
        event_type_id: typeId || null,
        customer_name: customerName || null,
        guests: guests ? Number(guests) : null,
        main_flavor: mainFlavor || null,
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
      <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-petal">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">
            {step === "kind" ? "Escolha o tipo" : "Detalhes do evento"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "kind" ? (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">Cada template tem seu próprio fluxo, campos e checklist.</p>
            {(["festival", "party", "fair", "wedding", "generic"] as EventKind[]).map((k) => {
              const list = byKind.get(k) ?? [];
              if (list.length === 0) return null;
              const meta = KIND_META[k];
              const Icon = meta.icon;
              return (
                <div key={k}>
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-rose" />
                    <p className="text-[10px] uppercase tracking-widest text-rose">{meta.label}</p>
                  </div>
                  <div className="space-y-2">
                    {list.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => { setTypeId(t.id); setStep("details"); }}
                        className="flex w-full items-start gap-3 rounded-2xl border border-border bg-background p-3 text-left hover:border-rose/60"
                      >
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blush/50">
                          <Icon className="h-4 w-4 text-mauve" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-mauve">{t.name}</p>
                          <p className="text-[11px] text-muted-foreground">{meta.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => { setTypeId(""); setStep("details"); }}
              className="w-full rounded-xl border border-dashed border-border py-3 text-xs text-muted-foreground hover:border-rose/40"
            >
              Pular — criar sem tipo
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            {selectedType && (
              <div className="flex items-center gap-2 rounded-xl bg-blush/40 px-3 py-2">
                <Tag className="h-3.5 w-3.5 text-rose" />
                <p className="text-xs text-mauve">{selectedType.name}</p>
                <button type="button" onClick={() => setStep("kind")} className="ml-auto text-[11px] text-rose underline">
                  Trocar
                </button>
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Nome *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  kind === "festival" ? "Ex: Festival de Sábado" :
                  kind === "party" ? "Ex: Aniversário Maria 5 anos" :
                  kind === "fair" ? "Ex: Feira do bairro" :
                  kind === "wedding" ? "Ex: Casamento Ana e João" :
                  "Nome do evento"
                }
                className="input-base mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-rose">Data *</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base mt-1" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-rose">Horário</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-base mt-1" />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Local</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="input-base mt-1" />
            </div>

            {(kind === "party" || kind === "wedding") && (
              <>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-rose">
                    {kind === "wedding" ? "Noivos" : "Cliente"}
                  </label>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input-base mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-rose">Convidados</label>
                    <input type="number" value={guests} onChange={(e) => setGuests(e.target.value)} className="input-base mt-1" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-rose">Sabor</label>
                    <input value={mainFlavor} onChange={(e) => setMainFlavor(e.target.value)} className="input-base mt-1" />
                  </div>
                </div>
              </>
            )}

            <button type="submit" disabled={saving} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-mauve px-4 py-3 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Criar evento"}
            </button>
          </form>
        )}
      </div>
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
  const [kind, setKind] = useState<EventKind>("generic");

  const add = async () => {
    if (!name.trim()) return;
    const { data, error } = await supabase
      .from("event_types")
      .insert({ shop_id: shopId, name: name.trim(), color: "rose", icon: "sparkles", kind })
      .select("*")
      .single();
    if (error) return toast.error(error.message.includes("duplicate") ? "Tipo já existe" : "Erro");
    onChange([...types, data as EventType]);
    setName("");
    setKind("generic");
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este tipo? Eventos associados ficarão sem tipo.")) return;
    const { error } = await supabase.from("event_types").delete().eq("id", id);
    if (error) return toast.error("Erro");
    onChange(types.filter((t) => t.id !== id));
  };

  const updateKind = async (id: string, k: EventKind) => {
    onChange(types.map((t) => (t.id === id ? { ...t, kind: k } : t)));
    await supabase.from("event_types").update({ kind: k }).eq("id", id);
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
        <p className="mt-2 text-xs text-muted-foreground">
          Cada tipo usa um <strong>template</strong> que define os campos extras e o checklist.
        </p>
        <ul className="mt-4 space-y-2">
          {types.length === 0 ? (
            <li className="rounded-xl border border-border p-4 text-center text-sm text-muted-foreground">Nenhum tipo cadastrado.</li>
          ) : (
            types.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                <span className="flex-1 text-sm text-mauve">{t.name}</span>
                <select
                  value={t.kind}
                  onChange={(e) => updateKind(t.id, e.target.value as EventKind)}
                  className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-mauve"
                >
                  {(Object.keys(KIND_META) as EventKind[]).map((k) => (
                    <option key={k} value={k}>{KIND_META[k].label}</option>
                  ))}
                </select>
                <button onClick={() => remove(t.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))
          )}
        </ul>
        <form
          onSubmit={(e) => { e.preventDefault(); add(); }}
          className="mt-4 space-y-2 rounded-xl bg-blush/30 p-3"
        >
          <p className="text-[10px] uppercase tracking-widest text-rose">Adicionar novo tipo</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Chá de bebê"
            className="input-base"
          />
          <select value={kind} onChange={(e) => setKind(e.target.value as EventKind)} className="input-base">
            {(Object.keys(KIND_META) as EventKind[]).map((k) => (
              <option key={k} value={k}>Template: {KIND_META[k].label}</option>
            ))}
          </select>
          <button type="submit" className="w-full rounded-xl bg-mauve px-4 py-2 text-sm text-cream hover:opacity-90">
            <Plus className="mr-1 inline h-4 w-4" /> Adicionar
          </button>
        </form>
      </div>
    </div>
  );
}
