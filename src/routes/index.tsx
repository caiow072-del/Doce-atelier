import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  Wallet,
  Sparkles,
  CalendarHeart,
  ArrowRight,
  ShoppingBag,
  BookOpen,
  Package,
  ChefHat,
  ClipboardList,
  Lock,
  Clock,
  TrendingDown,
  Target,
  AlertTriangle,
  ChevronDown,
  Timer,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { recipeCost, type IngredientLite, type RecipeIngredientLite, type RecipeLite } from "@/lib/costs";
import { PageContainer } from "@/components/PageContainer";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import heroCake from "@/assets/hero-cake.jpg";

const formatBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Cakes Manager" },
      { name: "description", content: "Resumo do mês: faturamento, custos e lucro." },
    ],
  }),
  component: Dashboard,
});

type Recipe = { id: string; name: string; servings: number };
type ProductPerf = { name: string; revenue: number; cost: number; profit: number; qty: number; estimated: boolean };
type UpcomingOrder = { id: string; customer_name: string; description: string; delivery_at: string; total_price: number; deposit_paid: number; status: string; items: any };

function Dashboard() {
  const { user, currentShop } = useAuth();
  const shopId = currentShop?.shop_id;
  const targetMargin = Number((currentShop?.shops as any)?.target_margin ?? 0.30);

  const [revenue, setRevenue] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [realCost, setRealCost] = useState(0);
  const [estimatedPortion, setEstimatedPortion] = useState(0);
  const [perfList, setPerfList] = useState<ProductPerf[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredientsCount, setIngredientsCount] = useState(0);
  const [recipesCount, setRecipesCount] = useState(0);
  const [storefrontConfigured, setStorefrontConfigured] = useState(false);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [storefrontPending, setStorefrontPending] = useState(0);
  const [shopVisits, setShopVisits] = useState(0);
  const [nextEvent, setNextEvent] = useState<{ id: string; name: string; date: string } | null>(null);
  const [lastClosed, setLastClosed] = useState<{ id: string; name: string; closed_at: string; payment_summary: any } | null>(null);
  const [upcomingOrders, setUpcomingOrders] = useState<UpcomingOrder[]>([]);
  const [orderRevenue, setOrderRevenue] = useState(0);
  const [recipesOpen, setRecipesOpen] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const today = new Date().toISOString();
    Promise.all([
      supabase.from("sales").select("price, qty, item, product_id").eq("shop_id", shopId).gte("sold_at", startOfMonth.toISOString()),
      supabase.from("recipes").select("id, name, servings").eq("shop_id", shopId).order("name").limit(6),
      supabase.from("ingredients").select("id", { count: "exact", head: true }).eq("shop_id", shopId),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("shop_id", shopId).in("status", ["orcamento", "confirmado", "produzindo", "pronto"]),
      supabase.from("events").select("id, name, date").eq("shop_id", shopId).is("closed_at", null).gte("date", today).order("date").limit(1).maybeSingle(),
      supabase.from("events").select("id, name, closed_at, payment_summary").eq("shop_id", shopId).not("closed_at", "is", null).order("closed_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("source", "storefront").eq("status", "orcamento"),
      supabase.from("recipes").select("id, name, servings, labor_cost, packaging_cost, waste_pct").eq("shop_id", shopId),
      supabase.from("recipe_ingredients").select("recipe_id, ingredient_id, quantity"),
      supabase.from("ingredients").select("id, package_qty, price_paid").eq("shop_id", shopId),
      supabase.from("recipes").select("id", { count: "exact", head: true }).eq("shop_id", shopId),
      supabase.from("shop_storefront").select("hero_title").eq("shop_id", shopId).maybeSingle(),
      supabase.from("shop_visits").select("id", { count: "exact", head: true }).eq("shop_id", shopId).gte("visited_at", startOfMonth.toISOString()),
      supabase.from("orders").select("id, customer_name, description, delivery_at, total_price, deposit_paid, status, items").eq("shop_id", shopId).in("status", ["orcamento", "confirmado", "produzindo", "pronto"]).order("delivery_at").limit(20),
      supabase.from("orders").select("total_price").eq("shop_id", shopId).in("status", ["confirmado", "produzindo", "pronto", "entregue"]).gte("created_at", startOfMonth.toISOString()),
    ]).then(([s, r, i, o, ne, lc, sp, allRecipes, recIngs, ings, rc, sf, sv, uo, oRev]) => {
      const sales = (s.data ?? []) as { price: number; qty: number; item: string; product_id: string | null }[];
      const totalRev = sales.reduce((sum, x) => sum + Number(x.price), 0);
      const totalQty = sales.reduce((sum, x) => sum + Number(x.qty ?? 1), 0);
      setRevenue(totalRev);
      setSalesCount(totalQty);
      setRecipes((r.data ?? []) as Recipe[]);
      setIngredientsCount(i.count ?? 0);
      setRecipesCount(rc.count ?? 0);
      setStorefrontConfigured(!!sf.data?.hero_title);
      setPendingOrders(o.count ?? 0);
      setNextEvent(ne.data as any);
      setLastClosed(lc.data as any);
      setStorefrontPending(sp.count ?? 0);
      setShopVisits(sv.count ?? 0);
      setUpcomingOrders((uo.data ?? []) as UpcomingOrder[]);
      setOrderRevenue((oRev.data ?? []).reduce((sum: number, x: any) => sum + Number(x.total_price ?? 0), 0));

      // ====== Real cost calculation ======
      // Try to match each sale to a recipe by item name (case-insensitive).
      // When matched, use real cost; otherwise fall back to ratio.
      const recipesFull = (allRecipes.data ?? []) as (RecipeLite & { name: string })[];
      const recipeIngs = (recIngs.data ?? []) as RecipeIngredientLite[];
      const ingredients = (ings.data ?? []) as IngredientLite[];
      const recipeByName = new Map(recipesFull.map((rr) => [rr.name.toLowerCase().trim(), rr]));

      const perPerf = new Map<string, ProductPerf>();
      let totalCost = 0;
      let estPart = 0;
      const FALLBACK_RATIO = 0.35;
      for (const sale of sales) {
        const qty = Number(sale.qty ?? 1);
        const rev = Number(sale.price);
        const itemKey = (sale.item ?? "").toLowerCase().trim();
        const recipe = recipeByName.get(itemKey)
          ?? recipesFull.find((rr) => itemKey.includes(rr.name.toLowerCase()) || rr.name.toLowerCase().includes(itemKey));
        let cost = 0;
        let estimated = false;
        if (recipe) {
          const c = recipeCost(recipe, recipeIngs, ingredients);
          // sales.price is total for the line (qty already factored in PDV); cost per whole × qty.
          cost = c.perWhole * qty;
        } else {
          cost = rev * FALLBACK_RATIO;
          estPart += cost;
          estimated = true;
        }
        totalCost += cost;
        const key = sale.product_id || sale.item || "—";
        const cur = perPerf.get(key) ?? { name: sale.item || "Item", revenue: 0, cost: 0, profit: 0, qty: 0, estimated: false };
        cur.revenue += rev;
        cur.cost += cost;
        cur.profit = cur.revenue - cur.cost;
        cur.qty += qty;
        cur.estimated = cur.estimated || estimated;
        perPerf.set(key, cur);
      }
      setRealCost(totalCost);
      setEstimatedPortion(estPart);
      setPerfList(Array.from(perPerf.values()).sort((a, b) => b.profit - a.profit));
    });
  }, [shopId]);

  const profit = revenue - realCost;
  const costRatio = revenue > 0 ? realCost / revenue : 0;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const targetMarginPct = targetMargin * 100;
  const meetingTarget = margin >= targetMarginPct;
  const profitNegative = profit < 0;
  const costsHigh = costRatio >= 1 - targetMargin;
  const estRatio = realCost > 0 ? estimatedPortion / realCost : 0;

  const topProfit = useMemo(() => perfList.slice(0, 3), [perfList]);
  const lossMakers = useMemo(() => perfList.filter((p) => p.profit < 0).slice(0, 3), [perfList]);

  // ====== Upcoming order alerts ======
  const now = new Date();
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const in3Days = new Date(now.getTime() + 3 * 86_400_000);
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);
  const ordersToday = upcomingOrders.filter(o => new Date(o.delivery_at) <= todayEnd);
  const orders3Days = upcomingOrders.filter(o => { const d = new Date(o.delivery_at); return d > todayEnd && d <= in3Days; });
  const ordersWeek = upcomingOrders.filter(o => { const d = new Date(o.delivery_at); return d > in3Days && d <= in7Days; });
  const hasAlerts = ordersToday.length > 0 || orders3Days.length > 0 || ordersWeek.length > 0 || storefrontPending > 0;

  const rawName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0]
    ?? user?.email?.split("@")[0]
    ?? "confeiteira";
  const firstName = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();

  return (
    <PageContainer width="default">
    <div className="space-y-5 lg:space-y-6">
      {/* ============ Hero (compact) ============ */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-blush/70 via-card to-cream p-4 shadow-soft sm:p-6 lg:p-7"
      >
        <div className="pointer-events-none absolute -right-6 -top-4 h-20 w-20 opacity-25 sm:-right-8 sm:-top-6 sm:h-40 sm:w-40 sm:opacity-80 lg:h-48 lg:w-48">
          <img src={heroCake} alt="" className="h-full w-full object-contain" />
        </div>
        <div className="relative max-w-2xl pr-20 sm:pr-32">
          <div className="inline-flex items-center gap-2 rounded-full bg-card/70 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-rose">
            <Sparkles className="h-3 w-3" /> {currentShop?.shops.name ?? "Sua confeitaria"}
          </div>
          <h1 className="mt-2 text-xl font-semibold leading-tight tracking-tight text-mauve sm:text-2xl lg:text-3xl">
            Bom dia, <span className="text-rose">{firstName}</span>.
          </h1>
          <p className="mt-1 max-w-md text-xs text-mauve/80 sm:text-sm">
            Aqui está o panorama doce do seu mês.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
            <Link
              to="/eventos"
              className="inline-flex items-center gap-2 rounded-xl bg-mauve px-3.5 py-2 text-xs font-medium text-cream shadow-soft transition hover:opacity-90 sm:text-sm"
            >
              <CalendarHeart className="h-4 w-4" /> Novo evento
            </Link>
            <Link
              to="/pdv"
              className="inline-flex items-center gap-2 rounded-xl border border-mauve/20 bg-card/70 px-3.5 py-2 text-xs font-medium text-mauve backdrop-blur transition hover:bg-card sm:text-sm"
            >
              <ShoppingBag className="h-4 w-4" /> Abrir PDV
            </Link>
          </div>
        </div>
      </motion.section>
      <div className="mx-auto max-w-2xl">
        <OnboardingChecklist
          ingredientsCount={ingredientsCount}
          recipesCount={recipesCount}
          hasStorefront={storefrontConfigured}
        />
      </div>
      {/* ============ Metric grid ============ */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Metric
          icon={<TrendingUp className="h-4 w-4" />}
          label="Faturamento PDV"
          value={formatBRL(revenue)}
          hint={`${salesCount} vendas neste mês`}
          tone="rose"
        />
        <Metric
          icon={<ClipboardList className="h-4 w-4" />}
          label="Encomendas"
          value={formatBRL(orderRevenue)}
          hint={`${pendingOrders} pedidos em andamento`}
          tone="rose"
        />
        <Metric
          icon={<Sparkles className="h-4 w-4" />}
          label="Lucro líquido"
          value={formatBRL(profit)}
          hint={profitNegative ? "No vermelho" : meetingTarget ? "Acima da meta ✨" : "Abaixo da meta"}
          tone={profitNegative ? "danger" : meetingTarget ? "sage" : "warn"}
        />
        <Metric
          icon={<Target className="h-4 w-4" />}
          label="Margem"
          value={`${margin.toFixed(0)}%`}
          hint={`meta ${targetMarginPct.toFixed(0)}%`}
          tone={margin < 0 ? "danger" : meetingTarget ? "sage" : "warn"}
        />
      </section>

      <div className="flex flex-col xl:flex-row gap-5 items-start w-full">
        {/* ============ 🔥 Alerts Panel ============ */}
        <div className="w-full xl:flex-1 space-y-5">
          {hasAlerts && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-rose">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-[11px] uppercase tracking-widest font-semibold">Atenção</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ordersToday.length > 0 && (
                  <Link
                    to="/encomendas"
                    className="flex items-center gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-3 transition hover:bg-destructive/10"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-destructive/15 text-destructive">
                      <Timer className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-destructive uppercase tracking-wider">Hoje / Atrasado</p>
                      <p className="text-sm font-medium text-mauve">
                        {ordersToday.length} {ordersToday.length === 1 ? "encomenda" : "encomendas"}
                      </p>
                    </div>
                  </Link>
                )}
                {orders3Days.length > 0 && (
                  <Link
                    to="/encomendas"
                    className="flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/5 p-3 transition hover:bg-warning/10"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-warning uppercase tracking-wider">Próximos 3 dias</p>
                      <p className="text-sm font-medium text-mauve">
                        {orders3Days.length} {orders3Days.length === 1 ? "encomenda" : "encomendas"}
                      </p>
                    </div>
                  </Link>
                )}
                {ordersWeek.length > 0 && (
                  <Link
                    to="/encomendas"
                    className="flex items-center gap-3 rounded-2xl border border-rose/30 bg-blush/30 p-3 transition hover:bg-blush/50"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blush/60 text-mauve">
                      <CalendarHeart className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-rose uppercase tracking-wider">Esta semana</p>
                      <p className="text-sm font-medium text-mauve">
                        {ordersWeek.length} {ordersWeek.length === 1 ? "encomenda" : "encomendas"}
                      </p>
                    </div>
                  </Link>
                )}
                {storefrontPending > 0 && (
                  <Link
                    to="/encomendas"
                    className="flex items-center gap-3 rounded-2xl border border-rose/40 bg-gradient-to-r from-blush/60 to-rose/20 p-3 transition hover:from-blush hover:to-rose/40"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cream text-mauve">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-rose uppercase tracking-wider">Vitrine</p>
                      <p className="text-sm font-medium text-mauve">
                        {storefrontPending} {storefrontPending === 1 ? "pedido aguardando" : "pedidos aguardando"}
                      </p>
                    </div>
                  </Link>
                )}
              </div>
            </section>
          )}
        </div>

        {/* ============ Upcoming Orders (compact list) ============ */}
        <div className="w-full xl:w-[420px] shrink-0">
          {upcomingOrders.length > 0 && (
            <section className="card-soft p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-rose">
                  <ClipboardList className="h-4 w-4" />
                  <p className="text-[11px] uppercase tracking-widest font-semibold">Próximas encomendas</p>
                </div>
                <Link to="/encomendas" className="inline-flex items-center gap-1 text-xs text-mauve hover:underline">
                  Ver todas <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <ul className="space-y-2">
                {upcomingOrders.slice(0, 5).map((o) => {
                  const dt = new Date(o.delivery_at);
                  const diffMs = dt.getTime() - Date.now();
                  const diffDays = Math.ceil(diffMs / 86_400_000);
                  const isUrgent = diffDays <= 1;
                  const isSoon = diffDays <= 3;
                  const dateStr = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
                  const remaining = o.total_price - o.deposit_paid;
                  return (
                    <li key={o.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isUrgent ? "border-destructive/40 bg-destructive/5" : isSoon ? "border-warning/30 bg-warning/5" : "border-border/50 bg-background/40"}`}>
                      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold ${isUrgent ? "bg-destructive/15 text-destructive" : isSoon ? "bg-warning/15 text-warning" : "bg-blush/60 text-mauve"}`}>
                        {diffDays <= 0 ? "!" : `${diffDays}d`}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-mauve">{o.customer_name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{o.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium text-mauve">{dateStr}</p>
                        {remaining > 0 && <p className="text-[10px] text-muted-foreground">Falta {formatBRL(remaining)}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* ============ Lucratividade por produto ============ */}
      {(topProfit.length > 0 || lossMakers.length > 0) && (
        <section className="grid gap-4 md:grid-cols-2">
          {topProfit.length > 0 && (
            <div className="card-soft p-5">
              <div className="mb-3 flex items-center gap-2 text-success">
                <TrendingUp className="h-4 w-4" />
                <p className="text-[11px] uppercase tracking-widest">Mais lucrativos</p>
              </div>
              <ul className="space-y-2">
                {topProfit.map((p) => (
                  <li key={p.name} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-mauve">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.qty}× · {formatBRL(p.revenue)}{p.estimated && " · estim."}</p>
                    </div>
                    <span className="font-display text-base italic text-success">{formatBRL(p.profit)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {lossMakers.length > 0 && (
            <div className="card-soft p-5">
              <div className="mb-3 flex items-center gap-2 text-destructive">
                <TrendingDown className="h-4 w-4" />
                <p className="text-[11px] uppercase tracking-widest">Dando prejuízo</p>
              </div>
              <ul className="space-y-2">
                {lossMakers.map((p) => (
                  <li key={p.name} className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-mauve">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.qty}× · {formatBRL(p.revenue)}{p.estimated && " · estim."}</p>
                    </div>
                    <span className="font-display text-base italic text-destructive">{formatBRL(p.profit)}</span>
                  </li>
                ))}
              </ul>
              <Link to="/receitas" className="mt-3 block text-[11px] text-rose hover:underline">Revise o preço público dessas receitas →</Link>
            </div>
          )}
        </section>
      )}

      {/* ============ Vitrine: visitas ============ */}
      {storefrontConfigured && shopVisits > 0 && currentShop?.shops.slug && (
        <Link
          to={"/loja/$slug" as any}
          params={{ slug: currentShop.shops.slug } as any}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-rose/40"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blush/40 text-mauve">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-rose">Visitas no mês</p>
              <p className="text-sm font-medium text-mauve">
                <span className="text-lg font-semibold tabular-nums">{shopVisits}</span>{" "}
                {shopVisits === 1 ? "pessoa visitou sua loja" : "pessoas visitaram sua loja"}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-xs font-medium text-mauve">Abrir →</span>
        </Link>
      )}

      {/* ============ Eventos: próximo + último fechado ============ */}
      {(nextEvent || lastClosed) && (
        <section className="grid gap-4 md:grid-cols-2">
          {nextEvent && <NextEventCard ev={nextEvent} />}
          {lastClosed && <LastClosedCard ev={lastClosed} />}
        </section>
      )}

      {/* ============ Quick stats (compact) ============ */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card-soft p-4">
          <div className="flex items-center gap-2 text-rose">
            <Package className="h-4 w-4" />
            <p className="text-[10px] uppercase tracking-widest">Estoque</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-mauve num">{ingredientsCount}</p>
          <p className="text-[11px] text-muted-foreground">insumos</p>
          <Link to="/insumos" className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-blush/40 py-1.5 text-[11px] font-medium text-mauve hover:bg-blush/70">
            Gerenciar <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="card-soft p-4">
          <div className="flex items-center gap-2 text-rose">
            <Wallet className="h-4 w-4" />
            <p className="text-[10px] uppercase tracking-widest">Custos</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-mauve num">{formatBRL(realCost)}</p>
          <p className="text-[11px] text-muted-foreground">{estRatio > 0.1 ? `${(estRatio * 100).toFixed(0)}% estim.` : `${(costRatio * 100).toFixed(0)}% fat.`}</p>
        </div>
        <div className="card-soft p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-rose">
            <BookOpen className="h-4 w-4" />
            <p className="text-[10px] uppercase tracking-widest">Receitas</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-mauve num">{recipesCount}</p>
          <p className="text-[11px] text-muted-foreground">no cardápio</p>
          <Link to="/receitas" className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-blush/40 py-1.5 text-[11px] font-medium text-mauve hover:bg-blush/70">
            Gerenciar <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>

      {/* ============ Receitas ativas (collapsible) ============ */}
      {recipes.length > 0 && (
        <section className="card-soft overflow-hidden">
          <button
            onClick={() => setRecipesOpen(v => !v)}
            className="flex w-full items-center justify-between p-4 sm:p-5 text-left"
          >
            <div>
              <p className="text-[10px] uppercase tracking-widest text-rose">No seu cardápio</p>
              <h2 className="text-base font-semibold text-mauve">Receitas ativas ({recipes.length})</h2>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${recipesOpen ? "rotate-180" : ""}`} />
          </button>
          {recipesOpen && (
            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              <div className="grid-cards-sm">
                {recipes.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border bg-background/60 p-3 transition hover:border-rose/40">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blush/60">
                        <BookOpen className="h-4 w-4 text-mauve" strokeWidth={1.6} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-mauve">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground">{r.servings} fatias</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/receitas" className="mt-3 inline-flex items-center gap-1 text-xs text-mauve hover:underline">
                Gerenciar receitas <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
    </PageContainer>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: "rose" | "sage" | "warn" | "danger";
}) {
  const toneCls =
    tone === "sage"
      ? "text-success"
      : tone === "warn"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-mauve";
  return (
    <div className="card-soft p-4 sm:p-5">
      <div className="flex items-center gap-2 text-rose">
        {icon}
        <span className="text-[11px] uppercase tracking-widest">{label}</span>
      </div>
      <p className={`mt-2 font-display text-2xl italic sm:text-3xl ${toneCls}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NextEventCard({ ev }: { ev: { id: string; name: string; date: string } }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const target = new Date(ev.date).getTime();
  const diff = target - now;
  const past = diff < 0;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const mins = Math.floor((abs % 3_600_000) / 60_000);
  const label = past
    ? "acontecendo / atrasado"
    : days > 0
      ? `em ${days}d ${hours}h`
      : hours > 0
        ? `em ${hours}h ${mins}m`
        : `em ${mins} min`;
  const dateStr = new Date(ev.date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <Link
      to="/eventos"
      className="card-soft group block p-6 transition hover:border-rose/40"
    >
      <div className="flex items-center gap-2 text-rose">
        <Clock className="h-4 w-4" />
        <p className="text-[11px] uppercase tracking-widest">Próximo evento</p>
      </div>
      <p className="mt-3 truncate font-display text-2xl italic text-mauve">{ev.name}</p>
      <p className="text-xs text-muted-foreground">{dateStr}</p>
      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-blush/50 px-3 py-1 text-xs font-medium text-mauve">
        <CalendarHeart className="h-3 w-3" /> {label}
      </div>
    </Link>
  );
}

function LastClosedCard({
  ev,
}: {
  ev: { id: string; name: string; closed_at: string; payment_summary: any };
}) {
  const ps = ev.payment_summary ?? {};
  const total = Number(ps.total ?? 0);
  const profit = Number(ps.profit ?? ps.net ?? total);
  const closedStr = new Date(ev.closed_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
  const profitTone = profit < 0 ? "text-destructive" : profit > 0 ? "text-success" : "text-mauve";
  return (
    <Link
      to="/eventos"
      className="card-soft group block p-6 transition hover:border-rose/40"
    >
      <div className="flex items-center gap-2 text-rose">
        <Lock className="h-4 w-4" />
        <p className="text-[11px] uppercase tracking-widest">Último fechamento</p>
      </div>
      <p className="mt-3 truncate font-display text-2xl italic text-mauve">{ev.name}</p>
      <p className="text-xs text-muted-foreground">fechado em {closedStr}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Vendido</p>
          <p className="font-display text-lg italic text-mauve">{formatBRL(total)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Lucro</p>
          <p className={`font-display text-lg italic ${profitTone}`}>{formatBRL(profit)}</p>
        </div>
      </div>
    </Link>
  );
}
