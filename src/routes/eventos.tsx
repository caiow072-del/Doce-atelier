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
  ChevronDown,
  ChevronRight,
  Repeat,
  Package,
  Lock,
  Unlock,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { formatBRL } from "@/lib/store";
import { toast } from "sonner";
import { nextOccurrence, WEEKDAYS } from "@/lib/recurrence";

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
type EventRow = {
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
  recurrence: string;
  recurrence_until: string | null;
  parent_event_id: string | null;
  weekday: number | null;
  day_of_month: number | null;
  closed_at: string | null;
  payment_summary: PaymentSummary | null;
};
type Recipe = { id: string; name: string; servings: number; image_url?: string | null; labor_cost?: number; packaging_cost?: number; waste_pct?: number };
type Ingredient = { id: string; name: string; unit: string; package_qty?: number; price_paid?: number; stock_qty?: number };
type RecipeIng = { recipe_id: string; ingredient_id: string; quantity: number };
type EventProduct = {
  id: string;
  event_id: string;
  recipe_id: string | null;
  name: string;
  unit_price: number;
  planned_qty: number;
  sold_qty: number;
  image_url: string | null;
  position: number;
  sale_mode: "unit" | "slice";
  batches: number;
};
type EventTask = { id: string; day_key: string; task: string; done: boolean; position: number };
type Sale = {
  id: string;
  price: number;
  qty: number;
  payment_method: string;
  product_id: string | null;
  item: string;
  sold_at: string;
};
type PaymentSummary = {
  total: number;
  by_method: Record<string, number>;
  items_sold: number;
  cost_estimated: number;
  profit: number;
  closed_at: string;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const KIND_META: Record<EventKind, { label: string; icon: any; description: string }> = {
  festival: { label: "Festival", icon: CalendarHeart, description: "Produção em lotes para vender em vários dias." },
  party: { label: "Festa / Encomenda", icon: PartyPopper, description: "Bolo personalizado para um cliente." },
  fair: { label: "Feira / Bazar", icon: Store, description: "Estande com vendas no caixa e troco inicial." },
  wedding: { label: "Casamento", icon: Sparkles, description: "Bolo principal e logística completa." },
  generic: { label: "Outro", icon: Tag, description: "Evento genérico personalizado." },
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
  ({ festival: FESTIVAL_DAYS, party: PARTY_DAYS, fair: FAIR_DAYS, wedding: WEDDING_DAYS, generic: GENERIC_DAYS }[k]);

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
    { day_key: "vespera", task: "Assar massas" },
    { day_key: "vespera", task: "Preparar recheio" },
    { day_key: "dia", task: "Montar e decorar" },
    { day_key: "dia", task: "Embalar para entrega" },
  ],
  fair: [
    { day_key: "preparo", task: "Separar troco inicial" },
    { day_key: "preparo", task: "Preparar produtos" },
    { day_key: "montagem", task: "Montar barraca" },
    { day_key: "feira", task: "Abrir caixa" },
    { day_key: "feira", task: "Fechar caixa e contar" },
  ],
  wedding: [
    { day_key: "semana", task: "Reunião final com noivos" },
    { day_key: "vespera", task: "Assar todas as camadas" },
    { day_key: "dia", task: "Montar bolo no local" },
    { day_key: "dia", task: "Decoração e entrega" },
  ],
  generic: [
    { day_key: "antes", task: "Planejar produção" },
    { day_key: "dia", task: "Executar evento" },
  ],
};

type TabKey = "products" | "tasks" | "cashbox";

function EventosPage() {
  const { currentShop } = useAuth();
  const shopId = currentShop?.shop_id;

  const [types, setTypes] = useState<EventType[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipeIngs, setRecipeIngs] = useState<RecipeIng[]>([]);
  const [eventProducts, setEventProducts] = useState<EventProduct[]>([]);
  const [eventTasks, setEventTasks] = useState<EventTask[]>([]);
  const [eventSales, setEventSales] = useState<Sale[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("products");
  const [activeDay, setActiveDay] = useState<string>("");
  const [newTask, setNewTask] = useState("");
  const [filterKind, setFilterKind] = useState<EventKind | "all">("all");
  const [showInsumos, setShowInsumos] = useState(false);

  // ============ Initial load ============
  useEffect(() => {
    if (!shopId) return;
    (async () => {
      const [tRes, eRes, rRes, iRes, riRes] = await Promise.all([
        supabase.from("event_types").select("*").eq("shop_id", shopId).order("name"),
        supabase.from("events").select("*").eq("shop_id", shopId).order("date", { ascending: false }),
        supabase.from("recipes").select("id, name, servings, image_url, labor_cost, packaging_cost, waste_pct").eq("shop_id", shopId).order("name"),
        supabase.from("ingredients").select("id, name, unit, package_qty, price_paid, stock_qty").eq("shop_id", shopId),
        supabase.from("recipe_ingredients").select("recipe_id, ingredient_id, quantity"),
      ]);

      let tList = (tRes.data ?? []) as EventType[];
      if (tList.length === 0) {
        const seeds = [
          { shop_id: shopId, name: "Festival de Tortas", color: "rose", icon: "calendar-heart", kind: "festival" },
          { shop_id: shopId, name: "Festa de Aniversário", color: "blush", icon: "party-popper", kind: "party" },
          { shop_id: shopId, name: "Feira / Bazar", color: "sage", icon: "store", kind: "fair" },
          { shop_id: shopId, name: "Casamento", color: "rose", icon: "sparkles", kind: "wedding" },
        ];
        const { data: inserted } = await supabase.from("event_types").insert(seeds).select("*");
        tList = (inserted ?? []) as EventType[];
      }
      setTypes(tList);
      setEvents((eRes.data ?? []) as EventRow[]);
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

  useEffect(() => {
    if (selected) setActiveDay(daysFor(selectedKind)[0].key);
  }, [selectedId, selectedKind]);

  // ============ Load event details ============
  useEffect(() => {
    if (!selectedId) {
      setEventProducts([]);
      setEventTasks([]);
      setEventSales([]);
      return;
    }
    Promise.all([
      supabase.from("event_products").select("*").eq("event_id", selectedId).order("position"),
      supabase.from("event_tasks").select("*").eq("event_id", selectedId).order("position"),
      supabase
        .from("sales")
        .select("id, price, qty, payment_method, product_id, item, sold_at")
        .eq("event_id", selectedId),
    ]).then(([ep, et, es]) => {
      setEventProducts((ep.data ?? []) as EventProduct[]);
      setEventTasks((et.data ?? []) as EventTask[]);
      setEventSales((es.data ?? []) as Sale[]);
    });
  }, [selectedId]);

  // ============ Computed ============

  const shoppingList = useMemo(() => {
    if (!selected) return [];
    const totals = new Map<string, { name: string; unit: string; qty: number }>();
    eventProducts.forEach((ep) => {
      if (!ep.recipe_id || !ep.planned_qty) return;
      const r = recipes.find((x) => x.id === ep.recipe_id);
      if (!r) return;
      // Quantos lotes da receita = planned_qty / servings
      const batches = ep.planned_qty / Math.max(1, r.servings);
      const ings = recipeIngs.filter((ri) => ri.recipe_id === ep.recipe_id);
      ings.forEach((ri) => {
        const ing = ingredients.find((i) => i.id === ri.ingredient_id);
        if (!ing) return;
        const cur = totals.get(ing.id) ?? { name: ing.name, unit: ing.unit, qty: 0 };
        cur.qty += ri.quantity * batches;
        totals.set(ing.id, cur);
      });
    });
    return Array.from(totals.values());
  }, [selected, eventProducts, recipeIngs, ingredients, recipes]);

  const dayTasks = eventTasks.filter((t) => t.day_key === activeDay);
  const totalTasks = eventTasks.length;
  const doneTasks = eventTasks.filter((t) => t.done).length;
  const progress = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  // ============ Cashbox ============
  const cashbox = useMemo(() => {
    const total = eventSales.reduce((s, x) => s + Number(x.price), 0);
    const itemsSold = eventSales.reduce((s, x) => s + Number(x.qty), 0);
    const byMethod: Record<string, number> = {};
    eventSales.forEach((s) => {
      byMethod[s.payment_method] = (byMethod[s.payment_method] ?? 0) + Number(s.price);
    });
    // estimar custo: somar (sold_qty de cada produto * custo unitário simplificado)
    // como custo real depende de ingredientes/labor, usamos fallback de 30% do preço se não houver dado
    let cost = 0;
    eventProducts.forEach((ep) => {
      const sold = eventSales.filter((s) => s.product_id === ep.id).reduce((sum, s) => sum + s.qty, 0);
      // custo aproximado: preço × 0.3 (proxy). melhor estimativa exigiria join com receita+insumos
      cost += sold * Number(ep.unit_price) * 0.3;
    });
    const profit = total - cost - Number(selected?.fee ?? 0);
    const sobras = eventProducts.map((ep) => ({
      name: ep.name,
      planned: ep.planned_qty,
      sold: eventSales.filter((s) => s.product_id === ep.id).reduce((sum, s) => sum + s.qty, 0),
    }));
    return { total, itemsSold, byMethod, cost, profit, sobras };
  }, [eventSales, eventProducts, selected]);

  // ============ Mutations ============

  const updateMeta = async (patch: Partial<EventRow>) => {
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

  const addProduct = async (data: Partial<EventProduct>) => {
    if (!selected) return;
    const { data: row, error } = await supabase
      .from("event_products")
      .insert({
        event_id: selected.id,
        name: data.name ?? "Produto",
        recipe_id: data.recipe_id ?? null,
        unit_price: data.unit_price ?? 0,
        planned_qty: data.planned_qty ?? 0,
        sale_mode: data.sale_mode ?? "unit",
        batches: data.batches ?? 0,
        image_url: data.image_url ?? null,
        position: eventProducts.length,
      })
      .select("*")
      .single();
    if (error) return toast.error("Erro ao adicionar produto");
    setEventProducts((p) => [...p, row as EventProduct]);
  };

  const updateProduct = async (id: string, patch: Partial<EventProduct>) => {
    setEventProducts((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await supabase.from("event_products").update(patch).eq("id", id);
  };

  const removeProduct = async (id: string) => {
    setEventProducts((p) => p.filter((x) => x.id !== id));
    await supabase.from("event_products").delete().eq("id", id);
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

  const closeEvent = async () => {
    if (!selected) return;
    if (!confirm("Fechar o caixa deste evento? Isso trava as vendas e gera o snapshot final.")) return;
    const summary: PaymentSummary = {
      total: cashbox.total,
      by_method: cashbox.byMethod,
      items_sold: cashbox.itemsSold,
      cost_estimated: cashbox.cost,
      profit: cashbox.profit,
      closed_at: new Date().toISOString(),
    };
    await supabase
      .from("events")
      .update({ closed_at: summary.closed_at, payment_summary: summary as any })
      .eq("id", selected.id);
    setEvents((p) =>
      p.map((e) => (e.id === selected.id ? { ...e, closed_at: summary.closed_at, payment_summary: summary } : e))
    );
    toast.success("Caixa fechado!");
  };

  const reopenEvent = async () => {
    if (!selected) return;
    await supabase.from("events").update({ closed_at: null }).eq("id", selected.id);
    setEvents((p) => p.map((e) => (e.id === selected.id ? { ...e, closed_at: null } : e)));
    toast.success("Caixa reaberto");
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
        subtitle="Festivais, feiras e festas — produtos, produção e caixa em um só lugar."
      />

      {events.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <KindChip label="Todos" icon={Tag} active={filterKind === "all"} onClick={() => setFilterKind("all")} count={events.length} />
          {(["festival", "party", "fair", "wedding", "generic"] as EventKind[])
            .filter((k) => kindsPresent.includes(k))
            .map((k) => {
              const meta = KIND_META[k];
              const count = events.filter((e) => kindOf(e.event_type_id) === k).length;
              return (
                <KindChip key={k} label={meta.label} icon={meta.icon} active={filterKind === k} onClick={() => setFilterKind(k)} count={count} />
              );
            })}
        </div>
      )}

      <div className="card-soft p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-[11px] uppercase tracking-widest text-rose">Histórico</p>
          <div className="flex gap-2">
            <button onClick={() => setShowTypes(true)} className="inline-flex items-center gap-1 rounded-xl bg-blush/50 px-3 py-1.5 text-xs font-medium text-mauve hover:bg-blush/80">
              <Settings2 className="h-3.5 w-3.5" /> Tipos
            </button>
            <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1 rounded-xl bg-mauve px-3 py-1.5 text-xs font-medium text-cream hover:opacity-90">
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
              const closed = !!e.closed_at;
              return (
                <button
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors ${
                    active ? "border-rose bg-blush/60 text-mauve shadow-soft" : "border-border bg-card text-mauve hover:border-rose/40"
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
                      {e.recurrence !== "none" && (() => {
                        const next = nextOccurrence({
                          date: e.date,
                          recurrence: e.recurrence,
                          recurrence_until: e.recurrence_until,
                          weekday: e.weekday,
                          day_of_month: e.day_of_month,
                        });
                        return (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-rose">
                            <Repeat className="h-3 w-3" /> {e.recurrence === "weekly" ? "semanal" : "mensal"}
                            {next && <span className="ml-1 text-muted-foreground">· próx: {fmtDate(next.toISOString())}</span>}
                          </span>
                        );
                      })()}
                    </p>
                  </div>
                  {closed && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
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
              <EventHeader event={selected} kind={selectedKind} typeName={typeOf(selected.event_type_id)?.name} onEdit={() => setEditingMeta(true)} onDelete={removeEvent} />
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

          {/* Tabs */}
          <div className="grid grid-cols-3 gap-2">
            <TabBtn active={activeTab === "products"} onClick={() => setActiveTab("products")} icon={Package} label="Produtos" hint={`${eventProducts.length}`} />
            <TabBtn active={activeTab === "tasks"} onClick={() => setActiveTab("tasks")} icon={CheckCircle2} label="Tarefas" hint={`${doneTasks}/${totalTasks}`} />
            <TabBtn active={activeTab === "cashbox"} onClick={() => setActiveTab("cashbox")} icon={Wallet} label="Caixa" hint={formatBRL(cashbox.total)} closed={!!selected.closed_at} />
          </div>

          {activeTab === "products" && (
            <ProductsTab
              event={selected}
              products={eventProducts}
              recipes={recipes}
              shoppingList={shoppingList}
              showInsumos={showInsumos}
              setShowInsumos={setShowInsumos}
              onAdd={addProduct}
              onUpdate={updateProduct}
              onRemove={removeProduct}
            />
          )}

          {activeTab === "tasks" && (
            <TasksTab
              days={days}
              activeDay={activeDay}
              setActiveDay={setActiveDay}
              eventTasks={eventTasks}
              dayTasks={dayTasks}
              kind={selectedKind}
              newTask={newTask}
              setNewTask={setNewTask}
              onSeed={seedDefaultTasks}
              onToggle={toggleTask}
              onRemove={removeTask}
              onAdd={addTask}
            />
          )}

          {activeTab === "cashbox" && (
            <CashboxTab
              event={selected}
              products={eventProducts}
              sales={eventSales}
              cashbox={cashbox}
              onClose={closeEvent}
              onReopen={reopenEvent}
              onUpdateOpening={(v) => updateMeta({ opening_cash: v })}
            />
          )}
        </>
      )}

      {showNew && shopId && (
        <NewEventSheet
          shopId={shopId}
          types={types}
          onClose={() => setShowNew(false)}
          onCreated={(list) => {
            setEvents((p) => [...list, ...p]);
            setSelectedId(list[0].id);
            setShowNew(false);
          }}
        />
      )}

      {showTypes && shopId && (
        <TypesSheet shopId={shopId} types={types} onClose={() => setShowTypes(false)} onChange={setTypes} />
      )}
    </div>
  );
}

// ============ Sub-components ============

function TabBtn({
  active, onClick, icon: Icon, label, hint, closed,
}: { active: boolean; onClick: () => void; icon: any; label: string; hint?: string; closed?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
        active ? "border-rose bg-blush/60 shadow-soft" : "border-border bg-card hover:border-rose/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-mauve" />
        <span className="text-sm font-medium text-mauve">{label}</span>
        {closed && <Lock className="ml-auto h-3 w-3 text-muted-foreground" />}
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </button>
  );
}

function KindChip({ label, icon: Icon, active, onClick, count }: { label: string; icon: any; active: boolean; onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active ? "border-rose bg-blush/70 text-mauve" : "border-border bg-card text-muted-foreground hover:border-rose/40"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
      <span className="ml-1 rounded-full bg-card/70 px-1.5 text-[10px]">{count}</span>
    </button>
  );
}

function EventHeader({ event, kind, typeName, onEdit, onDelete }: { event: EventRow; kind: EventKind; typeName?: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {typeName && <p className="text-[11px] uppercase tracking-widest text-rose">{typeName}</p>}
        <h2 className="font-display text-2xl italic text-mauve">{event.name}</h2>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CalIcon className="h-3.5 w-3.5" /> {fmtDate(event.date)}</span>
          {event.start_time && <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {event.start_time}</span>}
          {event.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {event.location}</span>}
          {event.recurrence !== "none" && (
            <span className="inline-flex items-center gap-1.5 text-rose"><Repeat className="h-3.5 w-3.5" /> Recorrente {event.recurrence === "weekly" ? "semanal" : "mensal"}</span>
          )}
          {(kind === "party" || kind === "wedding") && event.customer_name && (
            <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {event.customer_name}</span>
          )}
          {(kind === "party" || kind === "wedding") && event.guests != null && (
            <span className="inline-flex items-center gap-1.5"><Cake className="h-3.5 w-3.5" /> {event.guests} convidados</span>
          )}
        </div>
        {event.notes && <p className="mt-2 text-sm text-mauve/80 whitespace-pre-line">{event.notes}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {(kind === "party" || kind === "wedding") && Number(event.fee) > 0 && <Badge icon={Truck} label={`Taxa: ${formatBRL(Number(event.fee))}`} />}
          {kind === "fair" && Number(event.opening_cash) > 0 && <Badge icon={Wallet} label={`Troco: ${formatBRL(Number(event.opening_cash))}`} />}
          {event.closed_at && <Badge icon={Lock} label={`Caixa fechado · ${fmtDate(event.closed_at)}`} />}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button onClick={onEdit} className="rounded-lg bg-blush/50 p-2 text-mauve hover:bg-blush/80" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
        <button onClick={onDelete} className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive/20" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
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

// ============ Products Tab ============
function ProductsTab({
  event, products, recipes, shoppingList, showInsumos, setShowInsumos, onAdd, onUpdate, onRemove,
}: {
  event: EventRow;
  products: EventProduct[];
  recipes: Recipe[];
  shoppingList: { name: string; unit: string; qty: number }[];
  showInsumos: boolean;
  setShowInsumos: (v: boolean) => void;
  onAdd: (data: Partial<EventProduct>) => void;
  onUpdate: (id: string, patch: Partial<EventProduct>) => void;
  onRemove: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newRecipe, setNewRecipe] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newQty, setNewQty] = useState("");

  const handleAdd = () => {
    const fromRecipe = recipes.find((r) => r.id === newRecipe);
    const name = newName.trim() || fromRecipe?.name || "";
    if (!name) return toast.error("Dê um nome ao produto");
    onAdd({
      name,
      recipe_id: newRecipe || null,
      unit_price: Number(newPrice) || 0,
      planned_qty: Number(newQty) || 0,
    });
    setNewName(""); setNewRecipe(""); setNewPrice(""); setNewQty("");
  };

  const closed = !!event.closed_at;

  return (
    <div className="space-y-4">
      <div className="card-soft overflow-hidden">
        <div className="border-b border-border/60 bg-blush/30 px-5 py-3">
          <p className="text-sm font-medium text-mauve">Produtos do evento</p>
          <p className="text-[11px] text-muted-foreground">Cada produto aparece como botão no PDV quando este evento estiver selecionado.</p>
        </div>
        {products.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">Nenhum produto. Adicione abaixo.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {products.map((p) => {
              const sold = p.sold_qty;
              const left = Math.max(0, p.planned_qty - sold);
              return (
                <li key={p.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                  <input
                    disabled={closed}
                    value={p.name}
                    onChange={(e) => onUpdate(p.id, { name: e.target.value })}
                    className="col-span-12 sm:col-span-4 rounded-lg border border-border bg-background px-2 py-1.5 text-mauve disabled:opacity-60"
                  />
                  <select
                    disabled={closed}
                    value={p.recipe_id ?? ""}
                    onChange={(e) => onUpdate(p.id, { recipe_id: e.target.value || null })}
                    className="col-span-7 sm:col-span-3 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-mauve disabled:opacity-60"
                  >
                    <option value="">— sem receita —</option>
                    {recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <input
                    disabled={closed}
                    type="number" step="0.01" placeholder="R$"
                    value={p.unit_price || ""}
                    onChange={(e) => onUpdate(p.id, { unit_price: Number(e.target.value) || 0 })}
                    className="col-span-3 sm:col-span-2 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-mauve disabled:opacity-60"
                  />
                  <input
                    disabled={closed}
                    type="number" placeholder="qtd"
                    value={p.planned_qty || ""}
                    onChange={(e) => onUpdate(p.id, { planned_qty: Number(e.target.value) || 0 })}
                    className="col-span-2 sm:col-span-1 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-mauve disabled:opacity-60"
                  />
                  <div className="col-span-9 sm:col-span-1 text-[11px] text-muted-foreground text-center">
                    <span className={left === 0 && p.planned_qty > 0 ? "text-success font-medium" : ""}>{sold}/{p.planned_qty}</span>
                  </div>
                  <button disabled={closed} onClick={() => onRemove(p.id)} className="col-span-1 justify-self-end rounded-lg p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-30">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!closed && (
          <div className="border-t border-border/60 bg-background/60 p-3">
            <p className="mb-2 text-[10px] uppercase tracking-widest text-rose">Adicionar produto</p>
            <div className="grid grid-cols-12 gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome (ou puxa da receita)"
                className="col-span-12 sm:col-span-4 input-base"
              />
              <select value={newRecipe} onChange={(e) => setNewRecipe(e.target.value)} className="col-span-12 sm:col-span-3 input-base">
                <option value="">— receita opcional —</option>
                {recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} type="number" step="0.01" placeholder="R$ unitário" className="col-span-6 sm:col-span-2 input-base" />
              <input value={newQty} onChange={(e) => setNewQty(e.target.value)} type="number" placeholder="qtd planejada" className="col-span-6 sm:col-span-2 input-base" />
              <button onClick={handleAdd} className="col-span-12 sm:col-span-1 rounded-xl bg-mauve px-2 py-2 text-cream hover:opacity-90">
                <Plus className="mx-auto h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Insumos colapsável */}
      <div className="card-soft overflow-hidden">
        <button
          onClick={() => setShowInsumos(!showInsumos)}
          className="flex w-full items-center justify-between border-b border-border/60 bg-blush/30 px-5 py-3"
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
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">Adicione produtos com receita vinculada e quantidade planejada.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {shoppingList.map((it) => (
                <li key={it.name} className="flex items-center justify-between px-5 py-2.5 text-sm">
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

// ============ Tasks Tab ============
function TasksTab({
  days, activeDay, setActiveDay, eventTasks, dayTasks, kind, newTask, setNewTask, onSeed, onToggle, onRemove, onAdd,
}: {
  days: { key: string; label: string }[];
  activeDay: string;
  setActiveDay: (d: string) => void;
  eventTasks: EventTask[];
  dayTasks: EventTask[];
  kind: EventKind;
  newTask: string;
  setNewTask: (s: string) => void;
  onSeed: () => void;
  onToggle: (t: EventTask) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <>
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
      <div className="card-soft overflow-hidden">
        {eventTasks.length === 0 && (
          <div className="border-b border-border/60 bg-blush/20 px-5 py-3">
            <button onClick={onSeed} className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-3 py-1.5 text-xs font-medium text-cream hover:opacity-90">
              <Sparkles className="h-3.5 w-3.5" /> Gerar checklist sugerido para {KIND_META[kind].label}
            </button>
          </div>
        )}
        <ul className="divide-y divide-border/60">
          {dayTasks.length === 0 ? (
            <li className="px-5 py-6 text-center text-sm text-muted-foreground">Sem tarefas neste dia.</li>
          ) : dayTasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-3">
              <button onClick={() => onToggle(t)} className="flex flex-1 items-center gap-3 text-left">
                {t.done ? <CheckCircle2 className="h-6 w-6 text-success shrink-0" strokeWidth={1.6} /> : <Circle className="h-6 w-6 text-rose shrink-0" strokeWidth={1.6} />}
                <span className={`text-sm ${t.done ? "text-muted-foreground line-through" : "text-mauve"}`}>{t.task}</span>
              </button>
              <button onClick={() => onRemove(t.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); onAdd(); }} className="flex items-center gap-2 border-t border-border/60 bg-background/60 p-3">
          <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Adicionar tarefa..." className="input-base flex-1" />
          <button type="submit" className="rounded-xl bg-mauve px-3 py-2 text-sm text-cream hover:opacity-90"><Plus className="h-4 w-4" /></button>
        </form>
      </div>
    </>
  );
}

// ============ Cashbox Tab ============
function CashboxTab({
  event, products, sales, cashbox, onClose, onReopen, onUpdateOpening,
}: {
  event: EventRow;
  products: EventProduct[];
  sales: Sale[];
  cashbox: { total: number; itemsSold: number; byMethod: Record<string, number>; cost: number; profit: number; sobras: { name: string; planned: number; sold: number }[] };
  onClose: () => void;
  onReopen: () => void;
  onUpdateOpening: (v: number) => void;
}) {
  const closed = !!event.closed_at;
  const summary = event.payment_summary;
  const display = closed && summary ? summary : { total: cashbox.total, by_method: cashbox.byMethod, items_sold: cashbox.itemsSold, cost_estimated: cashbox.cost, profit: cashbox.profit };

  const methodLabel: Record<string, string> = { cash: "Dinheiro", pix: "Pix", credit: "Crédito", debit: "Débito", other: "Outro" };

  return (
    <div className="space-y-4">
      <div className="card-soft p-5 bg-gradient-to-br from-blush/60 to-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-rose">Caixa do evento {closed && "(fechado)"}</p>
            <p className="font-display text-4xl italic text-mauve mt-1">{formatBRL(display.total)}</p>
            <p className="text-xs text-muted-foreground">{display.items_sold} itens vendidos</p>
          </div>
          {closed ? (
            <button onClick={onReopen} className="inline-flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-xs text-mauve hover:bg-blush/40">
              <Unlock className="h-3.5 w-3.5" /> Reabrir
            </button>
          ) : (
            <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-3 py-2 text-xs font-medium text-cream hover:opacity-90">
              <Lock className="h-3.5 w-3.5" /> Fechar caixa
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card-soft p-4">
          <p className="text-[11px] uppercase tracking-widest text-rose mb-2">Por forma de pagamento</p>
          {Object.keys(display.by_method).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {Object.entries(display.by_method).map(([m, v]) => (
                <li key={m} className="flex justify-between text-sm">
                  <span className="text-mauve">{methodLabel[m] ?? m}</span>
                  <span className="font-medium text-mauve">{formatBRL(Number(v))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-soft p-4">
          <p className="text-[11px] uppercase tracking-widest text-rose mb-2">Resultado estimado</p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex justify-between"><span className="text-mauve">Vendas</span><span className="text-mauve">{formatBRL(display.total)}</span></li>
            <li className="flex justify-between"><span className="text-muted-foreground">Custo dos insumos (~)</span><span className="text-destructive">−{formatBRL(display.cost_estimated)}</span></li>
            {Number(event.fee) > 0 && (
              <li className="flex justify-between"><span className="text-muted-foreground">Taxa do evento</span><span className="text-destructive">−{formatBRL(Number(event.fee))}</span></li>
            )}
            <li className="flex justify-between border-t border-border pt-1.5 mt-1.5">
              <span className="font-medium text-mauve">Lucro estimado</span>
              <span className={`font-bold ${display.profit < 0 ? "text-destructive" : "text-success"}`}>{formatBRL(display.profit)}</span>
            </li>
          </ul>
          <p className="mt-2 text-[10px] text-muted-foreground flex items-start gap-1"><AlertCircle className="h-3 w-3 mt-0.5" /> Custo estimado em 30% do preço. Cálculo refinado virá com a receita ligada a cada produto.</p>
        </div>
      </div>

      {!closed && (
        <div className="card-soft p-4">
          <label className="text-[11px] uppercase tracking-widest text-rose">Troco inicial</label>
          <input
            type="number" step="0.01"
            defaultValue={event.opening_cash ?? 0}
            onBlur={(e) => onUpdateOpening(Number(e.target.value) || 0)}
            className="input-base mt-1 max-w-[180px]"
          />
        </div>
      )}

      <div className="card-soft overflow-hidden">
        <p className="border-b border-border/60 bg-blush/30 px-5 py-3 text-sm font-medium text-mauve">Previsto vs vendido</p>
        {cashbox.sobras.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">Adicione produtos ao evento.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {cashbox.sobras.map((s) => {
              const sobra = s.planned - s.sold;
              return (
                <li key={s.name} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="text-mauve">{s.name}</span>
                  <span className="text-xs">
                    <span className="text-success font-medium">{s.sold}</span>
                    <span className="text-muted-foreground"> / {s.planned} planejados</span>
                    {sobra > 0 && <span className="ml-2 text-warning">{sobra} sobra</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card-soft overflow-hidden">
        <p className="border-b border-border/60 bg-blush/30 px-5 py-3 text-sm font-medium text-mauve">Vendas registradas ({sales.length})</p>
        {sales.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">Nenhuma venda. Use o PDV com este evento selecionado.</p>
        ) : (
          <ul className="divide-y divide-border/60 max-h-64 overflow-y-auto">
            {sales.slice().reverse().map((s) => (
              <li key={s.id} className="flex items-center justify-between px-5 py-2 text-sm">
                <div>
                  <span className="text-mauve">{s.item}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">{methodLabel[s.payment_method] ?? s.payment_method}</span>
                </div>
                <span className="font-medium text-mauve">{formatBRL(Number(s.price))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============ Edit Meta ============
function EditMeta({
  event, kind, types, onSave, onCancel,
}: { event: EventRow; kind: EventKind; types: EventType[]; onSave: (patch: Partial<EventRow>) => void | Promise<void>; onCancel: () => void }) {
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
  const [recurrence, setRecurrence] = useState(event.recurrence ?? "none");
  const [weekday, setWeekday] = useState<string>(event.weekday != null ? String(event.weekday) : "");
  const [dayOfMonth, setDayOfMonth] = useState<string>(event.day_of_month != null ? String(event.day_of_month) : "");
  const [recurrenceUntil, setRecurrenceUntil] = useState<string>(event.recurrence_until ?? "");

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
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-rose">Data {recurrence !== "none" ? "inicial" : ""}</label>
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
        <div className="md:col-span-2 rounded-xl border border-border bg-blush/20 p-3">
          <p className="text-[10px] uppercase tracking-widest text-rose mb-2 flex items-center gap-1"><Repeat className="h-3 w-3" /> Recorrência</p>
          <div className="grid grid-cols-2 gap-2">
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className="input-base">
              <option value="none">Não se repete</option>
              <option value="weekly">Toda semana</option>
              <option value="monthly">Todo mês</option>
            </select>
            {recurrence === "weekly" && (
              <select value={weekday} onChange={(e) => setWeekday(e.target.value)} className="input-base">
                <option value="">Mesmo dia da semana da data</option>
                {WEEKDAYS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
              </select>
            )}
            {recurrence === "monthly" && (
              <input type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} placeholder="Dia do mês (ex: 15)" className="input-base" />
            )}
          </div>
          {recurrence !== "none" && (
            <div className="mt-2">
              <label className="text-[10px] uppercase tracking-widest text-rose">Até quando (opcional)</label>
              <input type="date" value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} className="input-base mt-1" />
            </div>
          )}
        </div>
        {(kind === "party" || kind === "wedding") && (
          <>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Cliente</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input-base mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Convidados</label>
              <input type="number" value={guests} onChange={(e) => setGuests(e.target.value)} className="input-base mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Sabor principal</label>
              <input value={mainFlavor} onChange={(e) => setMainFlavor(e.target.value)} className="input-base mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Taxa (R$)</label>
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
              recurrence,
              weekday: recurrence === "weekly" ? (weekday !== "" ? Number(weekday) : new Date(date).getDay()) : null,
              day_of_month: recurrence === "monthly" ? (dayOfMonth ? Number(dayOfMonth) : new Date(date).getDate()) : null,
              recurrence_until: recurrence !== "none" && recurrenceUntil ? recurrenceUntil : null,
            })
          }
          className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-4 py-2 text-sm text-cream hover:opacity-90"
        >
          <Save className="h-4 w-4" /> Salvar
        </button>
        <button onClick={onCancel} className="rounded-xl bg-blush/40 px-4 py-2 text-sm text-mauve hover:bg-blush/70">Cancelar</button>
      </div>
    </div>
  );
}

// ============ New event sheet (with recurrence) ============
function NewEventSheet({
  shopId, types, onClose, onCreated,
}: { shopId: string; types: EventType[]; onClose: () => void; onCreated: (rows: EventRow[]) => void }) {
  const [step, setStep] = useState<"kind" | "details">("kind");
  const [typeId, setTypeId] = useState<string>("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [guests, setGuests] = useState("");
  const [recurrence, setRecurrence] = useState<"none" | "weekly" | "monthly">("none");
  const [weekday, setWeekday] = useState<string>("");
  const [dayOfMonth, setDayOfMonth] = useState<string>("");
  const [recurrenceUntil, setRecurrenceUntil] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const selectedType = types.find((t) => t.id === typeId);
  const kind: EventKind = selectedType?.kind ?? "generic";

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
    if (!name.trim()) return toast.error("Dê um nome");
    setSaving(true);

    const anchor = new Date(date);
    const { data: row, error } = await supabase
      .from("events")
      .insert({
        shop_id: shopId,
        name: name.trim(),
        date: anchor.toISOString(),
        start_time: startTime || null,
        location: location || null,
        event_type_id: typeId || null,
        customer_name: customerName || null,
        guests: guests ? Number(guests) : null,
        recurrence,
        weekday: recurrence === "weekly" ? (weekday !== "" ? Number(weekday) : anchor.getDay()) : null,
        day_of_month: recurrence === "monthly" ? (dayOfMonth ? Number(dayOfMonth) : anchor.getDate()) : null,
        recurrence_until: recurrence !== "none" && recurrenceUntil ? recurrenceUntil : null,
      })
      .select("*")
      .single();

    setSaving(false);
    if (error || !row) return toast.error("Erro ao criar evento");

    toast.success(recurrence !== "none" ? "Evento recorrente criado" : "Evento criado");
    onCreated([row as EventRow]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-mauve/40 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-petal">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">{step === "kind" ? "Escolha o tipo" : "Detalhes"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        {step === "kind" ? (
          <div className="mt-4 space-y-4">
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
                      <button key={t.id} onClick={() => { setTypeId(t.id); setStep("details"); }}
                        className="flex w-full items-start gap-3 rounded-2xl border border-border bg-background p-3 text-left hover:border-rose/60">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blush/50"><Icon className="h-4 w-4 text-mauve" /></div>
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
            <button onClick={() => { setTypeId(""); setStep("details"); }} className="w-full rounded-xl border border-dashed border-border py-3 text-xs text-muted-foreground hover:border-rose/40">
              Pular — criar sem tipo
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            {selectedType && (
              <div className="flex items-center gap-2 rounded-xl bg-blush/40 px-3 py-2">
                <Tag className="h-3.5 w-3.5 text-rose" />
                <p className="text-xs text-mauve">{selectedType.name}</p>
                <button type="button" onClick={() => setStep("kind")} className="ml-auto text-[11px] text-rose underline">Trocar</button>
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Nome *</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder={kind === "festival" ? "Ex: Festival de Sábado" : kind === "party" ? "Ex: Aniversário Maria 5 anos" : "Nome do evento"}
                className="input-base mt-1" />
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

            {/* Recorrência (festival, fair, generic) */}
            {(kind === "festival" || kind === "fair" || kind === "generic") && (
              <div className="rounded-xl border border-border bg-blush/20 p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-rose flex items-center gap-1"><Repeat className="h-3 w-3" /> Repetir</p>
                <div className="grid grid-cols-2 gap-2">
                  <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as any)} className="input-base">
                    <option value="none">Não repetir</option>
                    <option value="weekly">Toda semana</option>
                    <option value="monthly">Todo mês</option>
                  </select>
                  {recurrence === "weekly" && (
                    <select value={weekday} onChange={(e) => setWeekday(e.target.value)} className="input-base">
                      <option value="">Mesmo dia da data</option>
                      {WEEKDAYS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
                    </select>
                  )}
                  {recurrence === "monthly" && (
                    <input type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} placeholder="Dia do mês" className="input-base" />
                  )}
                </div>
                {recurrence !== "none" && (
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-rose">Até quando (opcional)</label>
                    <input type="date" value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} className="input-base mt-1" />
                    <p className="mt-1 text-[10px] text-muted-foreground">Um único evento que se repete {recurrence === "weekly" ? "toda semana" : "todo mês"} — sem duplicar no banco.</p>
                  </div>
                )}
              </div>
            )}

            {(kind === "party" || kind === "wedding") && (
              <>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-rose">{kind === "wedding" ? "Noivos" : "Cliente"}</label>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input-base mt-1" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-rose">Convidados</label>
                  <input type="number" value={guests} onChange={(e) => setGuests(e.target.value)} className="input-base mt-1" />
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

// ============ Types Sheet (mantido) ============
function TypesSheet({
  shopId, types, onClose, onChange,
}: { shopId: string; types: EventType[]; onClose: () => void; onChange: (t: EventType[]) => void }) {
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
    setName(""); setKind("generic");
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este tipo?")) return;
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
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        <ul className="mt-4 space-y-2">
          {types.length === 0 ? (
            <li className="rounded-xl border border-border p-4 text-center text-sm text-muted-foreground">Nenhum tipo cadastrado.</li>
          ) : types.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <span className="flex-1 text-sm text-mauve">{t.name}</span>
              <select value={t.kind} onChange={(e) => updateKind(t.id, e.target.value as EventKind)} className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-mauve">
                {(Object.keys(KIND_META) as EventKind[]).map((k) => <option key={k} value={k}>{KIND_META[k].label}</option>)}
              </select>
              <button onClick={() => remove(t.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="mt-4 space-y-2 rounded-xl bg-blush/30 p-3">
          <p className="text-[10px] uppercase tracking-widest text-rose">Adicionar tipo</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Chá de bebê" className="input-base" />
          <select value={kind} onChange={(e) => setKind(e.target.value as EventKind)} className="input-base">
            {(Object.keys(KIND_META) as EventKind[]).map((k) => <option key={k} value={k}>Template: {KIND_META[k].label}</option>)}
          </select>
          <button type="submit" className="w-full rounded-xl bg-mauve px-4 py-2 text-sm text-cream hover:opacity-90">
            <Plus className="mr-1 inline h-4 w-4" /> Adicionar
          </button>
        </form>
      </div>
    </div>
  );
}
