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
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { recipeCost, type IngredientLite, type RecipeIngredientLite, type RecipeLite } from "@/lib/costs";
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
  const [pendingOrders, setPendingOrders] = useState(0);
  const [storefrontPending, setStorefrontPending] = useState(0);
  const [nextEvent, setNextEvent] = useState<{ id: string; name: string; date: string } | null>(null);
  const [lastClosed, setLastClosed] = useState<{ id: string; name: string; closed_at: string; payment_summary: any } | null>(null);

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
    ]).then(([s, r, i, o, ne, lc, sp, allRecipes, recIngs, ings]) => {
      const sales = (s.data ?? []) as { price: number; qty: number; item: string; product_id: string | null }[];
      const totalRev = sales.reduce((sum, x) => sum + Number(x.price), 0);
      const totalQty = sales.reduce((sum, x) => sum + Number(x.qty ?? 1), 0);
      setRevenue(totalRev);
      setSalesCount(totalQty);
      setRecipes((r.data ?? []) as Recipe[]);
      setIngredientsCount(i.count ?? 0);
      setPendingOrders(o.count ?? 0);
      setNextEvent(ne.data as any);
      setLastClosed(lc.data as any);
      setStorefrontPending(sp.count ?? 0);

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

  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0]
    ?? user?.email?.split("@")[0]
    ?? "confeiteira";

  return (
    <div className="space-y-8">
      {/* ============ Hero ============ */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-blush/70 via-card to-cream p-6 shadow-soft sm:p-10"
      >
        <div className="pointer-events-none absolute -right-8 -top-6 h-28 w-28 opacity-30 sm:-right-12 sm:-top-10 sm:h-72 sm:w-72 sm:opacity-90">
          <img src={heroCake} alt="" className="h-full w-full object-contain" />
        </div>
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-card/70 px-3 py-1 text-[11px] uppercase tracking-widest text-rose">
            <Sparkles className="h-3 w-3" /> {currentShop?.shops.name ?? "Sua confeitaria"}
          </div>
          <h1 className="mt-4 font-display text-3xl italic leading-tight text-mauve sm:text-6xl">
            Bom dia, <span className="text-rose">{firstName}</span>.
          </h1>
          <p className="mt-3 max-w-md text-sm text-mauve/80 sm:text-base">
            Aqui está o panorama doce do seu mês. Tudo o que importa, num só olhar.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/eventos"
              className="inline-flex items-center gap-2 rounded-2xl bg-mauve px-5 py-3 text-sm font-medium text-cream shadow-soft transition hover:opacity-90"
            >
              <CalendarHeart className="h-4 w-4" /> Novo evento
            </Link>
            <Link
              to="/pdv"
              className="inline-flex items-center gap-2 rounded-2xl border border-mauve/20 bg-card/70 px-5 py-3 text-sm font-medium text-mauve backdrop-blur transition hover:bg-card"
            >
              <ShoppingBag className="h-4 w-4" /> Abrir PDV
            </Link>
          </div>
        </div>
      </motion.section>

      {/* ============ Metric grid ============ */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Metric
          icon={<TrendingUp className="h-4 w-4" />}
          label="Faturamento"
          value={formatBRL(revenue)}
          hint={`${salesCount} vendas neste mês`}
          tone="rose"
        />
        <Metric
          icon={<Wallet className="h-4 w-4" />}
          label="Custos"
          value={formatBRL(estCost)}
          hint={`${(costRatio * 100).toFixed(0)}% do faturamento`}
          tone={costsHigh ? "danger" : "sage"}
        />
        <Metric
          icon={<Sparkles className="h-4 w-4" />}
          label="Lucro líquido"
          value={formatBRL(profit)}
          hint={profitNegative ? "No vermelho" : costsHigh ? "Atenção" : "Saudável"}
          tone={profitNegative ? "danger" : costsHigh ? "warn" : "sage"}
        />
        <Metric
          icon={<ChefHat className="h-4 w-4" />}
          label="Margem"
          value={`${margin.toFixed(0)}%`}
          hint="meta 30%"
          tone={margin < 0 ? "danger" : margin >= 30 ? "sage" : "warn"}
        />
      </section>

      {/* ============ Vitrine: pedidos pendentes ============ */}
      {storefrontPending > 0 && (
        <Link
          to="/encomendas"
          className="flex items-center justify-between gap-3 rounded-2xl border border-rose/40 bg-gradient-to-r from-blush/60 to-rose/30 p-4 transition hover:from-blush hover:to-rose/50"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-cream text-mauve">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-rose">Vitrine pública</p>
              <p className="text-sm font-medium text-mauve">
                {storefrontPending} {storefrontPending === 1 ? "pedido novo aguardando" : "pedidos novos aguardando"} sua confirmação
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-mauve">Ver →</span>
        </Link>
      )}

      {/* ============ Eventos: próximo + último fechado ============ */}
      {(nextEvent || lastClosed) && (
        <section className="grid gap-4 md:grid-cols-2">
          {nextEvent && <NextEventCard ev={nextEvent} />}
          {lastClosed && <LastClosedCard ev={lastClosed} />}
        </section>
      )}

      {/* ============ Two-column main ============ */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Catalog */}
        <div className="card-soft lg:col-span-2 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-rose">No seu cardápio</p>
              <h2 className="font-display text-2xl italic text-mauve">Receitas ativas</h2>
            </div>
            <Link to="/receitas" className="inline-flex items-center gap-1 text-sm text-mauve hover:underline">
              Gerenciar <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {recipes.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-background/60 p-4 transition hover:border-rose/40">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-blush/60">
                    <BookOpen className="h-4 w-4 text-mauve" strokeWidth={1.6} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-mauve">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.servings} fatias</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-6">
          <div className="card-soft p-6">
            <div className="flex items-center gap-2 text-rose">
              <Package className="h-4 w-4" />
              <p className="text-[11px] uppercase tracking-widest">Estoque</p>
            </div>
            <p className="mt-2 font-display text-4xl italic text-mauve">{ingredientsCount}</p>
            <p className="text-xs text-muted-foreground">insumos cadastrados</p>
            <Link
              to="/insumos"
              className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-blush/40 py-2 text-xs font-medium text-mauve hover:bg-blush/70"
            >
              Gerenciar insumos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="card-soft p-6">
            <div className="flex items-center gap-2 text-rose">
              <ClipboardList className="h-4 w-4" />
              <p className="text-[11px] uppercase tracking-widest">Encomendas</p>
            </div>
            <p className="mt-2 font-display text-4xl italic text-mauve">{pendingOrders}</p>
            <p className="text-xs text-muted-foreground">pedidos em andamento</p>
            <Link
              to="/encomendas"
              className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-blush/40 py-2 text-xs font-medium text-mauve hover:bg-blush/70"
            >
              Ver encomendas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>
    </div>
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
