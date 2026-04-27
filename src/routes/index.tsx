import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { TrendingUp, Wallet, Sparkles, CalendarHeart, ArrowRight } from "lucide-react";
import { useStore, formatBRL } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";
import heroCake from "@/assets/hero-cake.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Início — Jack Menezes Cakes Manager" },
      { name: "description", content: "Resumo do mês: faturamento, custos e lucro limpo." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { sales, recipes, ingredients } = useStore();

  const revenue = sales.reduce((s, x) => s + x.price, 0);
  // custo estimado: usa 55% como placeholder para receitas vendidas
  const estCost = sales.length * 7.5; // mock simples por fatia
  const profit = revenue - estCost;
  const costRatio = revenue > 0 ? estCost / revenue : 0;
  const profitable = costRatio < 0.6;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Bem-vinda, Jack"
        title="Sua confeitaria hoje"
        subtitle="Um olhar carinhoso sobre o seu mês."
      />

      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="card-soft relative overflow-hidden p-6"
      >
        <div className="absolute -right-6 -top-6 h-44 w-44 opacity-90">
          <img src={heroCake} alt="" className="h-full w-full object-contain" />
        </div>
        <p className="text-xs uppercase tracking-widest text-rose">Lucro do mês</p>
        <p className="font-display text-5xl italic text-mauve mt-2">{formatBRL(profit)}</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blush/70 px-3 py-1 text-xs text-mauve">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.6} />
          {profitable ? "Tudo doce por aqui" : "Atenção aos custos"}
        </div>
      </motion.div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3">
        <Metric
          icon={<TrendingUp className="h-4 w-4" strokeWidth={1.6} />}
          label="Faturamento"
          value={formatBRL(revenue)}
          tone="rose"
        />
        <Metric
          icon={<Wallet className="h-4 w-4" strokeWidth={1.6} />}
          label="Custos totais"
          value={formatBRL(estCost)}
          tone={profitable ? "sage" : "warn"}
        />
      </div>

      {/* Big CTA */}
      <Link
        to="/festival"
        className="card-soft group flex items-center justify-between gap-4 bg-gradient-to-br from-blush/70 to-card p-5 transition-shadow hover:shadow-petal"
      >
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rose/40 text-mauve">
            <CalendarHeart className="h-7 w-7" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-rose">Atalho</p>
            <p className="font-display text-2xl italic text-mauve">Novo Festival</p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-mauve transition-transform group-hover:translate-x-1" />
      </Link>

      {/* Mini stats */}
      <div className="card-soft p-5">
        <p className="text-xs uppercase tracking-widest text-rose">No seu cardápio</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {recipes.map((r) => (
            <span key={r.id} className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-mauve">
              {r.name}
            </span>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {ingredients.length} insumos cadastrados · {sales.length} vendas registradas
        </p>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "rose" | "sage" | "warn";
}) {
  const toneCls =
    tone === "sage"
      ? "text-success"
      : tone === "warn"
        ? "text-warning"
        : "text-mauve";
  return (
    <div className="card-soft p-4">
      <div className="flex items-center gap-2 text-rose">
        {icon}
        <span className="text-[11px] uppercase tracking-widest">{label}</span>
      </div>
      <p className={`mt-2 font-display text-2xl italic ${toneCls}`}>{value}</p>
    </div>
  );
}
