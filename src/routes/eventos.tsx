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
import { PageContainer } from "@/components/PageContainer";
import { formatBRL } from "@/lib/store";
import { toast } from "sonner";
import { nextOccurrence, WEEKDAYS, parseLocalDate } from "@/lib/recurrence";
import { recipeCost } from "@/lib/costs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

  const [showListDrawer, setShowListDrawer] = useState(false);
  const [listSearch, setListSearch] = useState("");

  const searchedEvents = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return filteredEvents;
    return filteredEvents.filter((e) => e.name.toLowerCase().includes(q));
  }, [filteredEvents, listSearch]);

  return (
    <PageContainer width="default">
      <PageHeader title="Eventos" />

      {events.length === 0 ? (
        <div className="card-soft px-6 py-12 text-center">
          <CalendarHeart className="mx-auto h-12 w-12 text-rose" strokeWidth={1.4} />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum evento ainda.</p>
          <button
            onClick={() => setShowNew(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-mauve px-4 py-2 text-xs font-medium text-cream hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Criar primeiro evento
          </button>
        </div>
      ) : !selected ? (
        <div className="card-soft p-8 text-center text-sm text-muted-foreground">Selecione um evento.</div>
      ) : (
        <div className="space-y-4">
          {/* Card do evento atual (largura total) */}
          <div className="card-soft overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 md:px-4 md:py-3">
              <button
                onClick={() => setShowListDrawer(true)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-blush/30"
              >
                {(() => {
                  const k = kindOf(selected.event_type_id);
                  const Icon = KIND_META[k].icon;
                  return (
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blush/50 md:h-12 md:w-12">
                      <Icon className="h-5 w-5 text-mauve md:h-6 md:w-6" strokeWidth={1.6} />
                    </div>
                  );
                })()}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-mauve md:text-lg">{selected.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground md:text-xs">
                    {fmtDate(selected.date)}
                    {selected.start_time ? ` · ${selected.start_time}` : ""}
                    {selected.location ? ` · ${selected.location}` : ""}
                    {selected.recurrence !== "none" ? ` · ${selected.recurrence === "weekly" ? "semanal" : "mensal"}` : ""}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
              <div className="flex shrink-0 items-center gap-0.5 border-l border-border/60 pl-2">
                <button onClick={() => setEditingMeta(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-blush/50 hover:text-mauve" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                <button onClick={removeEvent} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            {(totalTasks > 0 || ((selectedKind === "party" || selectedKind === "wedding") && Number(selected.fee) > 0) || (selectedKind === "fair" && Number(selected.opening_cash) > 0) || selected.closed_at || selected.notes) && (
              <div className="space-y-2 border-t border-border/60 bg-blush/20 px-4 py-2.5">
                {(((selectedKind === "party" || selectedKind === "wedding") && Number(selected.fee) > 0) || (selectedKind === "fair" && Number(selected.opening_cash) > 0) || selected.closed_at) && (
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedKind === "party" || selectedKind === "wedding") && Number(selected.fee) > 0 && <Badge icon={Truck} label={`Taxa: ${formatBRL(Number(selected.fee))}`} />}
                    {selectedKind === "fair" && Number(selected.opening_cash) > 0 && <Badge icon={Wallet} label={`Troco: ${formatBRL(Number(selected.opening_cash))}`} />}
                    {selected.closed_at && <Badge icon={Lock} label={`Fechado · ${fmtDate(selected.closed_at)}`} />}
                  </div>
                )}
                {selected.notes && <NotesInline notes={selected.notes} />}
                {totalTasks > 0 && (
                  <div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-card">
                      <div className="h-full rounded-full bg-rose transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-1 text-right text-[11px] text-muted-foreground num">{doneTasks}/{totalTasks} tarefas</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sub-abas discretas */}
          <div className="flex items-center gap-1 border-b border-border/60">
            <SubTab active={activeTab === "products"} onClick={() => setActiveTab("products")} icon={Package} label="Produtos" hint={`${eventProducts.length}`} />
            <SubTab active={activeTab === "tasks"} onClick={() => setActiveTab("tasks")} icon={CheckCircle2} label="Tarefas" hint={`${doneTasks}/${totalTasks}`} />
            <SubTab active={activeTab === "cashbox"} onClick={() => setActiveTab("cashbox")} icon={Wallet} label="Caixa" hint={formatBRL(cashbox.total)} closed={!!selected.closed_at} />
          </div>

          {/* Conteúdo da aba ativa */}
          <section className="min-w-0">
            {activeTab === "products" && (
              <ProductsTab
                event={selected}
                products={eventProducts}
                recipes={recipes}
                ingredients={ingredients}
                recipeIngs={recipeIngs}
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
          </section>
        </div>
      )}

      {/* Modal de edição do evento */}
      <Dialog open={editingMeta} onOpenChange={setEditingMeta}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-mauve">Editar evento</DialogTitle>
          </DialogHeader>
          {selected && (
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
          )}
        </DialogContent>
      </Dialog>

      {/* Drawer com a lista de eventos */}
      <Sheet open={showListDrawer} onOpenChange={setShowListDrawer}>
        <SheetContent side="left" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border/60 p-4">
            <SheetTitle className="text-mauve">Eventos</SheetTitle>
          </SheetHeader>

          <div className="space-y-3 border-b border-border/60 p-4">
            <input
              type="search"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Buscar evento..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-mauve placeholder:text-muted-foreground focus:border-rose focus:outline-none"
            />
            {kindsPresent.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
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
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {searchedEvents.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">Nenhum evento encontrado.</p>
            ) : (
              <ul className="space-y-2">
                {searchedEvents.map((e) => {
                  const t = typeOf(e.event_type_id);
                  const k = t?.kind ?? "generic";
                  const Icon = KIND_META[k].icon;
                  const active = e.id === selectedId;
                  const closed = !!e.closed_at;
                  return (
                    <li key={e.id}>
                      <button
                        onClick={() => {
                          setSelectedId(e.id);
                          setShowListDrawer(false);
                        }}
                        className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors ${
                          active ? "border-rose bg-blush/60 text-mauve shadow-soft" : "border-border bg-card text-mauve hover:border-rose/40"
                        }`}
                      >
                        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active ? "bg-rose/30" : "bg-blush/40"}`}>
                          <Icon className="h-5 w-5 text-mauve" strokeWidth={1.6} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{e.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {fmtDate(e.date)}
                            {e.start_time ? ` · ${e.start_time}` : ""}
                            {e.recurrence !== "none" && (
                              <span className="ml-1 inline-flex items-center gap-0.5 text-rose">
                                <Repeat className="h-3 w-3" /> {e.recurrence === "weekly" ? "sem" : "men"}
                              </span>
                            )}
                          </p>
                        </div>
                        {closed && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/60 p-3">
            <button
              onClick={() => {
                setShowListDrawer(false);
                setShowTypes(true);
              }}
              className="rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-mauve"
            >
              <Settings2 className="mr-1 inline h-3.5 w-3.5" /> Tipos
            </button>
            <button
              onClick={() => {
                setShowListDrawer(false);
                setShowNew(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-3 py-2 text-xs font-medium text-cream hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Novo evento
            </button>
          </div>
        </SheetContent>
      </Sheet>

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
    </PageContainer>
  );
}

// ============ Sub-components ============

function SubTab({
  active, onClick, icon: Icon, label, hint, closed,
}: { active: boolean; onClick: () => void; icon: any; label: string; hint?: string; closed?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`relative -mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors ${
        active
          ? "border-rose text-mauve"
          : "border-transparent text-muted-foreground hover:text-mauve"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="font-medium">{label}</span>
      {hint && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] num ${active ? "bg-blush/70 text-mauve" : "bg-muted text-muted-foreground"}`}>
          {hint}
        </span>
      )}
      {closed && <Lock className="h-3 w-3 text-muted-foreground" />}
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
  const [showNotes, setShowNotes] = useState(false);
  const metaParts: string[] = [fmtDate(event.date)];
  if (event.start_time) metaParts.push(event.start_time);
  if (event.location) metaParts.push(event.location);
  if (event.recurrence !== "none") metaParts.push(event.recurrence === "weekly" ? "semanal" : "mensal");
  if ((kind === "party" || kind === "wedding") && event.customer_name) metaParts.push(event.customer_name);
  if ((kind === "party" || kind === "wedding") && event.guests != null) metaParts.push(`${event.guests} conv.`);

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold text-mauve md:text-xl">{event.name}</h2>
        <p className="mt-1 truncate text-xs text-muted-foreground">{metaParts.join(" · ")}</p>
        {event.notes && (
          <>
            {showNotes ? (
              <p className="mt-2 whitespace-pre-line text-sm text-mauve/80">{event.notes}</p>
            ) : (
              <button onClick={() => setShowNotes(true)} className="mt-1 text-[11px] text-rose hover:underline">
                ver observações
              </button>
            )}
          </>
        )}
        {((kind === "party" || kind === "wedding") && Number(event.fee) > 0) ||
        (kind === "fair" && Number(event.opening_cash) > 0) ||
        event.closed_at ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(kind === "party" || kind === "wedding") && Number(event.fee) > 0 && <Badge icon={Truck} label={`Taxa: ${formatBRL(Number(event.fee))}`} />}
            {kind === "fair" && Number(event.opening_cash) > 0 && <Badge icon={Wallet} label={`Troco: ${formatBRL(Number(event.opening_cash))}`} />}
            {event.closed_at && <Badge icon={Lock} label={`Fechado · ${fmtDate(event.closed_at)}`} />}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-1">
        <button onClick={onEdit} className="rounded-lg p-2 text-muted-foreground hover:bg-blush/50 hover:text-mauve" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
        <button onClick={onDelete} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function Badge({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[11px] text-mauve">
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function NotesInline({ notes }: { notes: string }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <p className="whitespace-pre-line text-xs text-mauve/80">
      {notes}{" "}
      <button onClick={() => setOpen(false)} className="text-rose hover:underline">ocultar</button>
    </p>
  ) : (
    <button onClick={() => setOpen(true)} className="text-[11px] text-rose hover:underline">ver observações</button>
  );
}

// ============ Products Tab ============
function ProductsTab({
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
  const closed = !!event.closed_at;

  // Custo unitário por produto (real se tiver receita)
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
        <div className="flex items-center justify-between border-b border-border/60 bg-blush/30 px-5 py-3 md:px-4 md:py-2.5">
          <div>
            <p className="text-sm font-medium text-mauve">Produtos do evento</p>
            <p className="text-[11px] text-muted-foreground">Cada produto vira um botão no PDV deste evento.</p>
          </div>
          {!closed && (
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 rounded-xl bg-mauve px-3 py-1.5 text-xs text-cream hover:opacity-90">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          )}
        </div>
        {products.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">Nenhum produto. Toque em <strong>Adicionar</strong> para escolher uma receita.</p>
        ) : (
          <ul className="divide-y divide-border/60 md:grid md:grid-cols-2 md:gap-2 md:divide-y-0 md:p-2">
            {products.map((p) => {
              const sold = p.sold_qty;
              const left = Math.max(0, p.planned_qty - sold);
              const cost = costOf(p);
              const margin = p.unit_price > 0 ? ((p.unit_price - cost) / p.unit_price) * 100 : 0;
              const recipe = p.recipe_id ? recipes.find((r) => r.id === p.recipe_id) : null;
              return (
                <li key={p.id} className="px-4 py-3 text-sm md:rounded-xl md:border md:border-border/60 md:bg-card md:px-3 md:py-2.5">
                  <div className="flex items-start gap-3">
                    {(p.image_url || recipe?.image_url) && (
                      <img src={p.image_url || recipe?.image_url || ""} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium text-mauve">{p.name}</span>
                        {recipe && (
                          <span className="text-[10px] uppercase tracking-wider text-rose">
                            {recipe.name} · {p.sale_mode === "slice" ? "por fatia" : "inteiro"}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                        <span>Preço: <strong className="text-mauve">{formatBRL(Number(p.unit_price))}</strong></span>
                        <span>Custo: <strong className={cost > p.unit_price ? "text-destructive" : "text-mauve"}>{formatBRL(cost)}</strong></span>
                        <span>Margem: <strong className={margin >= 30 ? "text-success" : margin >= 15 ? "text-warning" : "text-destructive"}>{margin.toFixed(0)}%</strong></span>
                        <span className={left === 0 && p.planned_qty > 0 ? "text-success font-medium" : ""}>Vendas: {sold}/{p.planned_qty}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <input
                        disabled={closed}
                        type="number" placeholder="qtd"
                        value={p.planned_qty || ""}
                        onChange={(e) => onUpdate(p.id, { planned_qty: Number(e.target.value) || 0 })}
                        className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-right text-xs text-mauve disabled:opacity-60"
                      />
                      <button disabled={closed} onClick={() => onRemove(p.id)} className="rounded-lg p-1 text-destructive hover:bg-destructive/10 disabled:opacity-30">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
      {/* Insumos colapsável */}
      <div className="card-soft overflow-hidden">
        <button
          onClick={() => setShowInsumos(!showInsumos)}
          className="flex w-full items-center justify-between border-b border-border/60 bg-blush/30 px-5 py-3 md:px-4 md:py-2.5"
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
            <ul className="divide-y divide-border/60 md:grid md:grid-cols-2 md:gap-x-6 md:divide-y-0 md:px-4 md:py-2">
              {shoppingList.map((it) => (
                <li key={it.name} className="flex items-center justify-between px-5 py-2.5 text-sm md:border-b md:border-border/40 md:px-0">
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
              <p className="text-sm font-medium leading-none">{d.label}</p>
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
            <p className="mt-1 text-3xl font-semibold text-mauve">{formatBRL(display.total)}</p>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-soft overflow-hidden">
          <p className="border-b border-border/60 bg-blush/30 px-5 py-3 text-sm font-medium text-mauve md:px-4 md:py-2.5">Previsto vs vendido</p>
          {cashbox.sobras.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">Adicione produtos ao evento.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {cashbox.sobras.map((s) => {
                const sobra = s.planned - s.sold;
                return (
                  <li key={s.name} className="flex items-center justify-between px-5 py-2.5 text-sm md:px-4">
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
          <p className="border-b border-border/60 bg-blush/30 px-5 py-3 text-sm font-medium text-mauve md:px-4 md:py-2.5">Vendas registradas ({sales.length})</p>
          {sales.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">Nenhuma venda. Use o PDV com este evento selecionado.</p>
          ) : (
            <ul className="divide-y divide-border/60 max-h-64 overflow-y-auto">
              {sales.slice().reverse().map((s) => (
                <li key={s.id} className="flex items-center justify-between px-5 py-2 text-sm md:px-4">
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
              date: parseLocalDate(date).toISOString(),
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
              weekday: recurrence === "weekly" ? (weekday !== "" ? Number(weekday) : parseLocalDate(date).getDay()) : null,
              day_of_month: recurrence === "monthly" ? (dayOfMonth ? Number(dayOfMonth) : parseLocalDate(date).getDate()) : null,
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

    const anchor = parseLocalDate(date);
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

// ============ Add Product Modal (recipe-driven) ============
function AddProductModal({
  recipes, ingredients, recipeIngs, onClose, onAdd,
}: {
  recipes: Recipe[];
  ingredients: Ingredient[];
  recipeIngs: RecipeIng[];
  onClose: () => void;
  onAdd: (data: Partial<EventProduct>) => void;
}) {
  const [recipeId, setRecipeId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [saleMode, setSaleMode] = useState<"unit" | "slice">("unit");
  const [name, setName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [batches, setBatches] = useState("1");
  const [plannedQty, setPlannedQty] = useState("");

  const recipe = useMemo(() => recipes.find((r) => r.id === recipeId) ?? null, [recipes, recipeId]);
  const filteredRecipes = useMemo(
    () => (search.trim() ? recipes.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())) : recipes),
    [recipes, search],
  );

  const cost = useMemo(() => {
    if (!recipe) return null;
    return recipeCost(
      { id: recipe.id, servings: recipe.servings, labor_cost: Number(recipe.labor_cost ?? 0), packaging_cost: Number(recipe.packaging_cost ?? 0), waste_pct: Number(recipe.waste_pct ?? 0) },
      recipeIngs,
      ingredients.map((i) => ({ id: i.id, package_qty: Number(i.package_qty ?? 1), price_paid: Number(i.price_paid ?? 0) })),
    );
  }, [recipe, recipeIngs, ingredients]);

  // Auto-calc planejado: batches * servings (slice) ou batches (unit)
  useEffect(() => {
    if (!recipe) return;
    const b = Number(batches) || 0;
    const calc = saleMode === "slice" ? b * recipe.servings : b;
    if (!plannedQty || Number(plannedQty) === 0) setPlannedQty(String(calc));
    if (!name) setName(recipe.name);
    if (!unitPrice && cost) setUnitPrice((saleMode === "slice" ? cost.perSlice : cost.perWhole).toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId, saleMode, batches]);

  // Insumos faltando: precisa quantity * batches mas tem stock < isso
  const missing = useMemo(() => {
    if (!recipe) return [];
    const b = Number(batches) || 0;
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
  }, [recipe, batches, recipeIngs, ingredients]);

  const handleSave = () => {
    const finalName = name.trim() || recipe?.name || "";
    if (!finalName) return toast.error("Dê um nome ao produto");
    onAdd({
      name: finalName,
      recipe_id: recipeId || null,
      sale_mode: saleMode,
      batches: Number(batches) || 0,
      unit_price: Number(unitPrice) || 0,
      planned_qty: Number(plannedQty) || 0,
      image_url: recipe?.image_url ?? null,
    });
  };

  const margin = cost && Number(unitPrice) > 0
    ? ((Number(unitPrice) - (saleMode === "slice" ? cost.perSlice : cost.perWhole)) / Number(unitPrice)) * 100
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-mauve/40 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-petal">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">Adicionar produto</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-rose">Receita base</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar receita..." className="input-base mt-1" />
            <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-border">
              {filteredRecipes.length === 0 ? (
                <p className="px-3 py-3 text-center text-xs text-muted-foreground">Nenhuma receita.</p>
              ) : (
                <ul>
                  {filteredRecipes.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setRecipeId(r.id)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-blush/30 ${recipeId === r.id ? "bg-blush/50 text-mauve" : "text-mauve/80"}`}
                      >
                        {r.image_url && <img src={r.image_url} alt="" className="h-7 w-7 rounded object-cover" />}
                        <span className="flex-1 truncate">{r.name}</span>
                        <span className="text-[10px] text-muted-foreground">{r.servings} fatias</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => { setRecipeId(""); }}
                className={`w-full border-t border-border px-3 py-2 text-left text-xs ${!recipeId ? "bg-blush/30 text-mauve" : "text-muted-foreground hover:bg-blush/20"}`}
              >
                — sem receita (produto avulso) —
              </button>
            </div>
          </div>

          {recipe && (
            <div className="rounded-xl border border-border bg-blush/20 p-3">
              <p className="text-[10px] uppercase tracking-widest text-rose mb-2">Modo de venda</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSaleMode("unit")}
                  className={`rounded-xl border px-3 py-2 text-xs ${saleMode === "unit" ? "border-rose bg-card text-mauve font-medium" : "border-border text-muted-foreground"}`}
                >
                  Inteiro<br /><span className="text-[10px]">({recipe.servings} fatias cada)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSaleMode("slice")}
                  className={`rounded-xl border px-3 py-2 text-xs ${saleMode === "slice" ? "border-rose bg-card text-mauve font-medium" : "border-border text-muted-foreground"}`}
                >
                  Por fatia<br /><span className="text-[10px]">(1/{recipe.servings} da receita)</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Nome no PDV</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={recipe?.name ?? "Produto"} className="input-base mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Preço unitário</label>
              <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="input-base mt-1" />
            </div>
            {recipe && (
              <div>
                <label className="text-[10px] uppercase tracking-widest text-rose">Lotes da receita</label>
                <input type="number" step="0.5" min="0" value={batches} onChange={(e) => setBatches(e.target.value)} className="input-base mt-1" />
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Qtd planejada</label>
              <input type="number" value={plannedQty} onChange={(e) => setPlannedQty(e.target.value)} className="input-base mt-1" />
            </div>
          </div>

          {cost && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo {saleMode === "slice" ? "por fatia" : "por unidade"}</span>
                <strong className="text-mauve">{formatBRL(saleMode === "slice" ? cost.perSlice : cost.perWhole)}</strong>
              </div>
              {margin != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margem prevista</span>
                  <strong className={margin >= 30 ? "text-success" : margin >= 15 ? "text-warning" : "text-destructive"}>{margin.toFixed(0)}%</strong>
                </div>
              )}
              {Number(batches) > 0 && (
                <div className="flex justify-between border-t border-border/60 pt-1">
                  <span className="text-muted-foreground">Custo total ({batches} lote{Number(batches) === 1 ? "" : "s"})</span>
                  <strong className="text-mauve">{formatBRL(cost.totalRecipe * Number(batches))}</strong>
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
            onClick={handleSave}
            className="w-full rounded-xl bg-mauve px-4 py-3 text-sm font-medium text-cream hover:opacity-90"
          >
            <Plus className="mr-1 inline h-4 w-4" /> Adicionar ao evento
          </button>
        </div>
      </div>
    </div>
  );
}
