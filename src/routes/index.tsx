import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
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

function Dashboard() {
  const { user, currentShop } = useAuth();
  const shopId = currentShop?.shop_id;

  const [revenue, setRevenue] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredientsCount, setIngredientsCount] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);

  useEffect(() => {
    if (!shopId) return;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    Promise.all([
      supabase.from("sales").select("price").eq("shop_id", shopId).gte("sold_at", startOfMonth.toISOString()),
      supabase.from("recipes").select("id, name, servings").eq("shop_id", shopId).order("name").limit(6),
      supabase.from("ingredients").select("id", { count: "exact", head: true }).eq("shop_id", shopId),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("shop_id", shopId).in("status", ["orcamento", "confirmado", "produzindo", "pronto"]),
    ]).then(([s, r, i, o]) => {
      const sales = (s.data ?? []) as { price: number }[];
      setRevenue(sales.reduce((sum, x) => sum + Number(x.price), 0));
      setSalesCount(sales.length);
      setRecipes((r.data ?? []) as Recipe[]);
      setIngredientsCount(i.count ?? 0);
      setPendingOrders(o.count ?? 0);
    });
  }, [shopId]);

  const estCost = salesCount * 7.5;
  const profit = revenue - estCost;
  const costRatio = revenue > 0 ? estCost / revenue : 0;
  const costsHigh = costRatio >= 0.6;
  const profitNegative = profit < 0;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
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
        <div className="pointer-events-none absolute -right-12 -top-10 h-64 w-64 opacity-90 sm:h-72 sm:w-72">
          <img src={heroCake} alt="" className="h-full w-full object-contain" />
        </div>
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-card/70 px-3 py-1 text-[11px] uppercase tracking-widest text-rose">
            <Sparkles className="h-3 w-3" /> {currentShop?.shops.name ?? "Sua confeitaria"}
          </div>
          <h1 className="mt-4 font-display text-4xl italic leading-tight text-mauve sm:text-6xl">
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
