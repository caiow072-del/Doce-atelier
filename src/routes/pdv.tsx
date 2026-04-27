import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cake, Utensils, Sparkles, Trash2 } from "lucide-react";
import { useStore, formatBRL } from "@/lib/store";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/pdv")({
  head: () => ({
    meta: [
      { title: "PDV — Jack Menezes Cakes Manager" },
      { name: "description", content: "Modo cozinha: registre vendas com um toque." },
    ],
  }),
  component: PDVPage,
});

const buttons = [
  { label: "1 Fatia Doce", price: 17, icon: Cake, tone: "rose" },
  { label: "Combo 2 Fatias", price: 32, icon: Sparkles, tone: "blush" },
  { label: "Fatia Menor", price: 15, icon: Cake, tone: "rose" },
  { label: "Torta Salgada", price: 15, icon: Utensils, tone: "sage" },
] as const;

function PDVPage() {
  const { sales, addSale } = useStore();
  const today = new Date().toDateString();
  const todaySales = sales.filter((s) => new Date(s.at).toDateString() === today);
  const total = todaySales.reduce((s, x) => s + x.price, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Modo cozinha · Sábado"
        title="Ponto de venda"
        subtitle="Toque para registrar uma venda."
      />

      {/* Total do dia */}
      <motion.div
        layout
        className="card-soft overflow-hidden bg-gradient-to-br from-blush/80 to-card p-6"
      >
        <p className="text-[11px] uppercase tracking-widest text-rose">Total de hoje</p>
        <motion.p
          key={total}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="font-display text-5xl italic text-mauve mt-1"
        >
          {formatBRL(total)}
        </motion.p>
        <p className="text-xs text-muted-foreground">{todaySales.length} vendas</p>
      </motion.div>

      {/* Botões grandes */}
      <div className="grid grid-cols-2 gap-3">
        {buttons.map((b) => {
          const Icon = b.icon;
          const bg =
            b.tone === "blush"
              ? "from-rose/60 to-blush/60"
              : b.tone === "sage"
                ? "from-sage/40 to-blush/40"
                : "from-blush/70 to-card";
          return (
            <motion.button
              key={b.label}
              whileTap={{ scale: 0.94 }}
              onClick={() => addSale(b.label, b.price)}
              className={`card-soft flex aspect-square flex-col items-center justify-center gap-3 bg-gradient-to-br ${bg} p-4 text-center`}
            >
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-card/70">
                <Icon className="h-7 w-7 text-mauve" strokeWidth={1.4} />
              </div>
              <p className="font-display text-lg italic leading-tight text-mauve">{b.label}</p>
              <p className="text-sm font-semibold text-mauve">{formatBRL(b.price)}</p>
            </motion.button>
          );
        })}
      </div>

      {/* Últimas vendas */}
      <div className="card-soft overflow-hidden">
        <div className="border-b border-border/60 bg-blush/30 px-5 py-3">
          <p className="text-sm font-medium text-mauve">Últimas vendas de hoje</p>
        </div>
        {todaySales.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhuma venda ainda. Vai dar um doce dia! 🌸
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            <AnimatePresence initial={false}>
              {todaySales
                .slice()
                .reverse()
                .slice(0, 8)
                .map((s) => (
                  <motion.li
                    key={s.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-between px-5 py-3 text-sm"
                  >
                    <span className="text-mauve">{s.item}</span>
                    <span className="font-semibold text-mauve">{formatBRL(s.price)}</span>
                  </motion.li>
                ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
