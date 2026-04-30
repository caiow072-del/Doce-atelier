import { createFileRoute } from "@tanstack/react-router";
import { ConfirmDialog, type ConfirmConfig } from "@/components/ConfirmDialog";
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

import type { EventKind, EventType, EventRow, Recipe, Ingredient, RecipeIng, EventProduct, EventTask, Sale, PaymentSummary } from "./-eventos/types";
import { KIND_META, FESTIVAL_DAYS, PARTY_DAYS, FAIR_DAYS, WEDDING_DAYS, GENERIC_DAYS, daysFor, DEFAULT_TASKS, fmtDate } from "./-eventos/constants";
import { SubTab, KindChip, Badge, NotesInline } from "./-eventos/components";
import { EventHeader } from "./-eventos/EventHeader";
import { ProductsTab } from "./-eventos/ProductsTab";
import { TasksTab } from "./-eventos/TasksTab";
import { CashboxTab } from "./-eventos/CashboxTab";
import { EditMeta } from "./-eventos/EditMeta";
import { NewEventSheet } from "./-eventos/NewEventSheet";
import { TypesSheet } from "./-eventos/TypesSheet";

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
  const [confirmCfg, setConfirmCfg] = useState<ConfirmConfig | null>(null);

  // ============ Initial load ============
  useEffect(() => {
    if (!shopId) return;
    (async () => {
      const [tRes, eRes, rRes, iRes, riRes] = await Promise.all([
        supabase.from("event_types").select("*").eq("shop_id", shopId).order("name"),
        supabase.from("events").select("*").eq("shop_id", shopId).order("date", { ascending: false }),
        supabase.from("recipes").select("id, name, servings, image_url, labor_cost, packaging_cost, waste_pct, slice_price, public_price").eq("shop_id", shopId).order("name"),
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

  const removeEvent = () => {
    if (!selected) return;
    setConfirmCfg({
      title: `Excluir "${selected.name}"?`,
      description: "O evento e todos os seus dados (produtos, tarefas, vendas) serão apagados.",
      confirmLabel: "Excluir",
      variant: "destructive",
      action: async () => {
        await supabase.from("events").delete().eq("id", selected.id);
        setEvents((p) => p.filter((e) => e.id !== selected.id));
        setSelectedId(events.find((e) => e.id !== selected.id)?.id ?? null);
      },
    });
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

  const closeEvent = () => {
    if (!selected) return;
    setConfirmCfg({
      title: "Fechar o caixa deste evento?",
      description: "Isso trava as vendas e gera o snapshot final. A ação não pode ser desfeita.",
      confirmLabel: "Fechar caixa",
      variant: "destructive",
      action: async () => {
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
      },
    });
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
    <PageContainer width="default" className="min-w-0 overflow-x-hidden">
      <PageHeader title="Eventos" />

      {events.length === 0 ? (
        <div className="card-soft mx-auto max-w-md px-6 py-12 text-center">
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
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-semibold text-mauve">Selecione um evento</h2>
            <button
              onClick={() => setShowListDrawer(true)}
              className="lg:hidden text-rose text-sm font-medium hover:underline"
            >
              Ver lista detalhada
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredEvents.map((e) => {
              const t = typeOf(e.event_type_id);
              const k = t?.kind ?? "generic";
              const Icon = KIND_META[k].icon;
              const closed = !!e.closed_at;
              return (
                <button
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-rose/40 hover:shadow"
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blush/40 transition group-hover:bg-rose/20">
                      <Icon className="h-5 w-5 text-mauve" strokeWidth={1.6} />
                    </div>
                    {closed && <Lock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="w-full min-w-0">
                    <p className="truncate text-base font-medium text-mauve">{e.name}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {fmtDate(e.date)}
                      {e.start_time ? ` · ${e.start_time}` : ""}
                      {e.recurrence !== "none" && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-rose">
                          <Repeat className="h-3 w-3" /> {e.recurrence === "weekly" ? "sem" : "men"}
                        </span>
                      )}
                    </p>
                    {e.location && <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.location}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
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
          <div className="flex w-full min-w-0 items-center gap-0 overflow-hidden border-b border-border/60 sm:gap-1">
            <SubTab active={activeTab === "products"} onClick={() => setActiveTab("products")} icon={Package} label="Produtos" hint={`${eventProducts.length}`} />
            <SubTab active={activeTab === "tasks"} onClick={() => setActiveTab("tasks")} icon={CheckCircle2} label="Tarefas" hint={`${doneTasks}/${totalTasks}`} />
            <SubTab active={activeTab === "cashbox"} onClick={() => setActiveTab("cashbox")} icon={Wallet} label="Caixa" closed={!!selected.closed_at} />
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

      <ConfirmDialog config={confirmCfg} onClose={() => setConfirmCfg(null)} />
    </PageContainer>
  );
}

