import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cake, Utensils, Sparkles, Settings2, Plus, Trash2, X, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/pdv")({
  head: () => ({
    meta: [
      { title: "PDV — Cakes Manager" },
      { name: "description", content: "Modo cozinha: registre vendas com um toque." },
    ],
  }),
  component: PDVPage,
});

type Product = {
  id: string;
  label: string;
  price: number;
  icon: string;
  tone: string;
  position: number;
  active: boolean;
};

type Sale = {
  id: string;
  item: string;
  price: number;
  sold_at: string;
};

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const iconMap: Record<string, typeof Cake> = {
  cake: Cake,
  utensils: Utensils,
  sparkles: Sparkles,
};

const toneMap: Record<string, string> = {
  rose: "from-blush/70 to-card",
  blush: "from-rose/60 to-blush/60",
  sage: "from-sage/40 to-blush/40",
};

function PDVPage() {
  const { currentShop } = useAuth();
  const shopId = currentShop?.shop_id;
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    Promise.all([
      supabase.from("pdv_products").select("*").eq("shop_id", shopId).eq("active", true).order("position"),
      supabase.from("sales").select("id, item, price, sold_at").eq("shop_id", shopId).gte("sold_at", startOfDay.toISOString()).order("sold_at", { ascending: false }),
    ]).then(async ([p, s]) => {
      let prods = (p.data ?? []) as Product[];
      // Seed defaults
      if (prods.length === 0) {
        const seeds = [
          { shop_id: shopId, label: "1 Fatia Doce", price: 17, icon: "cake", tone: "rose", position: 0 },
          { shop_id: shopId, label: "Combo 2 Fatias", price: 32, icon: "sparkles", tone: "blush", position: 1 },
          { shop_id: shopId, label: "Fatia Menor", price: 15, icon: "cake", tone: "rose", position: 2 },
          { shop_id: shopId, label: "Torta Salgada", price: 15, icon: "utensils", tone: "sage", position: 3 },
        ];
        const { data: inserted } = await supabase.from("pdv_products").insert(seeds).select("*");
        prods = (inserted ?? []) as Product[];
      }
      setProducts(prods);
      setSales((s.data ?? []) as Sale[]);
      setLoading(false);
    });
  }, [shopId]);

  const total = sales.reduce((sum, x) => sum + Number(x.price), 0);

  const addSale = async (p: Product) => {
    if (!shopId) return;
    const { data, error } = await supabase
      .from("sales")
      .insert({ shop_id: shopId, product_id: p.id, item: p.label, price: p.price })
      .select("id, item, price, sold_at")
      .single();
    if (error) return toast.error("Erro ao registrar");
    setSales((prev) => [data as Sale, ...prev]);
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Modo cozinha" title="Ponto de venda" subtitle="Toque para registrar uma venda." />

      {/* Total do dia */}
      <motion.div layout className="card-soft overflow-hidden bg-gradient-to-br from-blush/80 to-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-rose">Total de hoje</p>
            <motion.p
              key={total}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-display text-5xl italic text-mauve mt-1"
            >
              {fmtBRL(total)}
            </motion.p>
            <p className="text-xs text-muted-foreground">{sales.length} vendas</p>
          </div>
          <button
            onClick={() => setShowManage(true)}
            className="rounded-xl bg-card/70 p-2 text-mauve hover:bg-card"
            aria-label="Gerenciar produtos"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </motion.div>

      {/* Botões */}
      {loading ? (
        <div className="card-soft p-10 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : products.length === 0 ? (
        <div className="card-soft p-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum produto. Crie seus botões de venda.</p>
          <button onClick={() => setShowManage(true)} className="mt-3 rounded-xl bg-mauve px-4 py-2 text-sm text-cream">
            Criar produtos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => {
            const Icon = iconMap[p.icon] ?? Cake;
            const bg = toneMap[p.tone] ?? toneMap.rose;
            return (
              <motion.button
                key={p.id}
                whileTap={{ scale: 0.94 }}
                onClick={() => addSale(p)}
                className={`card-soft flex aspect-square flex-col items-center justify-center gap-3 bg-gradient-to-br ${bg} p-4 text-center`}
              >
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-card/70">
                  <Icon className="h-7 w-7 text-mauve" strokeWidth={1.4} />
                </div>
                <p className="font-display text-lg italic leading-tight text-mauve">{p.label}</p>
                <p className="text-sm font-semibold text-mauve">{fmtBRL(Number(p.price))}</p>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Últimas vendas */}
      <div className="card-soft overflow-hidden">
        <div className="border-b border-border/60 bg-blush/30 px-5 py-3">
          <p className="text-sm font-medium text-mauve">Últimas vendas de hoje</p>
        </div>
        {sales.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhuma venda ainda. Vai dar um doce dia! 🌸
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            <AnimatePresence initial={false}>
              {sales.slice(0, 8).map((s) => (
                <motion.li
                  key={s.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-between px-5 py-3 text-sm"
                >
                  <span className="text-mauve">{s.item}</span>
                  <span className="font-semibold text-mauve">{fmtBRL(Number(s.price))}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {showManage && shopId && (
        <ManageProductsSheet
          shopId={shopId}
          products={products}
          onClose={() => setShowManage(false)}
          onChange={setProducts}
        />
      )}
    </div>
  );
}

function ManageProductsSheet({
  shopId,
  products,
  onClose,
  onChange,
}: {
  shopId: string;
  products: Product[];
  onClose: () => void;
  onChange: (p: Product[]) => void;
}) {
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [icon, setIcon] = useState("cake");
  const [tone, setTone] = useState("rose");

  const add = async () => {
    if (!label.trim() || !price) return toast.error("Preencha rótulo e preço");
    const { data, error } = await supabase
      .from("pdv_products")
      .insert({ shop_id: shopId, label: label.trim(), price: Number(price), icon, tone, position: products.length })
      .select("*")
      .single();
    if (error) return toast.error("Erro");
    onChange([...products, data as Product]);
    setLabel("");
    setPrice("");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("pdv_products").update({ active: false }).eq("id", id);
    if (error) return toast.error("Erro");
    onChange(products.filter((p) => p.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 bg-mauve/40 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-petal">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">Produtos do PDV</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="mt-4 divide-y divide-border/60 rounded-xl border border-border">
          {products.length === 0 ? (
            <li className="p-4 text-center text-sm text-muted-foreground">Nenhum produto.</li>
          ) : (
            products.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm text-mauve">{p.label}</p>
                  <p className="text-[11px] text-muted-foreground">{fmtBRL(Number(p.price))}</p>
                </div>
                <button onClick={() => remove(p.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="mt-4 space-y-2 rounded-xl border border-border p-3">
          <p className="text-[10px] uppercase tracking-widest text-rose">Novo produto</p>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rótulo" className="input-base" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="Preço" className="input-base" />
          <div className="grid grid-cols-2 gap-2">
            <select value={icon} onChange={(e) => setIcon(e.target.value)} className="input-base">
              <option value="cake">Bolo</option>
              <option value="utensils">Salgado</option>
              <option value="sparkles">Especial</option>
            </select>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className="input-base">
              <option value="rose">Rosa</option>
              <option value="blush">Blush</option>
              <option value="sage">Verde</option>
            </select>
          </div>
          <button onClick={add} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-mauve px-4 py-2 text-sm text-cream hover:opacity-90">
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
