import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cake, Utensils, Sparkles, Settings2, Plus, Trash2, X, Minus, ShoppingCart, CalendarHeart, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { getOccurrences } from "@/lib/recurrence";

export const Route = createFileRoute("/pdv")({
  head: () => ({
    meta: [
      { title: "PDV — Cakes Manager" },
      { name: "description", content: "Carrinho rápido para vendas de loja, festival ou feira." },
    ],
  }),
  component: PDVPage,
});

type Product = { id: string; label: string; price: number; icon: string; tone: string; position: number; active: boolean };
type EventProduct = { id: string; event_id: string; name: string; unit_price: number; planned_qty: number; sold_qty: number; image_url: string | null };
type EventLite = { id: string; name: string; date: string; closed_at: string | null; recurrence?: string; recurrence_until?: string | null; weekday?: number | null; day_of_month?: number | null };
type Sale = { id: string; item: string; price: number; sold_at: string; payment_method: string };
type CartItem = { id: string; name: string; price: number; qty: number; source: "pdv" | "event"; product_id: string | null; event_product_id: string | null };
type PaymentMethod = "cash" | "pix" | "credit" | "debit" | "other";

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const iconMap: Record<string, typeof Cake> = { cake: Cake, utensils: Utensils, sparkles: Sparkles };
const toneMap: Record<string, string> = { rose: "from-blush/70 to-card", blush: "from-rose/60 to-blush/60", sage: "from-sage/40 to-blush/40" };
const PAY_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: "Dinheiro" }, { key: "pix", label: "Pix" }, { key: "credit", label: "Crédito" }, { key: "debit", label: "Débito" }, { key: "other", label: "Outro" },
];

function PDVPage() {
  const { currentShop } = useAuth();
  const shopId = currentShop?.shop_id;
  const [products, setProducts] = useState<Product[]>([]);
  const [events, setEvents] = useState<EventLite[]>([]);
  const [eventProducts, setEventProducts] = useState<EventProduct[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [sales, setSales] = useState<Sale[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);

  // ============ Load ============
  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      supabase.from("pdv_products").select("*").eq("shop_id", shopId).eq("active", true).order("position"),
      supabase.from("events").select("id, name, date, closed_at").eq("shop_id", shopId).is("closed_at", null).gte("date", today).order("date").limit(10),
      supabase.from("sales").select("id, item, price, sold_at, payment_method").eq("shop_id", shopId).gte("sold_at", startOfDay.toISOString()).order("sold_at", { ascending: false }),
    ]).then(async ([p, e, s]) => {
      let prods = (p.data ?? []) as Product[];
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
      setEvents((e.data ?? []) as EventLite[]);
      setSales((s.data ?? []) as Sale[]);
      setLoading(false);
    });
  }, [shopId]);

  // Carrega produtos do evento selecionado
  useEffect(() => {
    if (!selectedEventId) { setEventProducts([]); return; }
    supabase.from("event_products").select("*").eq("event_id", selectedEventId).order("position").then(({ data }) => {
      setEventProducts((data ?? []) as EventProduct[]);
    });
  }, [selectedEventId]);

  const totalToday = sales.reduce((s, x) => s + Number(x.price), 0);
  const cartTotal = useMemo(() => cart.reduce((s, x) => s + x.price * x.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, x) => s + x.qty, 0), [cart]);

  const addToCart = (item: Omit<CartItem, "qty">) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.id === item.id);
      if (idx >= 0) {
        const copy = [...prev]; copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 }; return copy;
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) => prev.flatMap((c) => {
      if (c.id !== id) return [c];
      const q = c.qty + delta;
      return q <= 0 ? [] : [{ ...c, qty: q }];
    }));
  };

  const removeFromCart = (id: string) => setCart((p) => p.filter((c) => c.id !== id));

  const checkout = async () => {
    if (!shopId || cart.length === 0) return;
    const cartId = crypto.randomUUID();
    const rows = cart.flatMap((c) =>
      Array.from({ length: c.qty }).map(() => ({
        shop_id: shopId,
        product_id: c.product_id,
        event_id: selectedEventId,
        item: c.name,
        price: c.price,
        qty: 1,
        payment_method: payment,
        cart_id: cartId,
      }))
    );
    const { data, error } = await supabase.from("sales").insert(rows).select("id, item, price, sold_at, payment_method");
    if (error) return toast.error("Erro ao registrar venda");

    // Atualiza sold_qty dos event_products
    if (selectedEventId) {
      for (const c of cart) {
        if (c.event_product_id) {
          const ep = eventProducts.find((x) => x.id === c.event_product_id);
          if (ep) {
            const newSold = ep.sold_qty + c.qty;
            await supabase.from("event_products").update({ sold_qty: newSold }).eq("id", ep.id);
            setEventProducts((prev) => prev.map((x) => (x.id === ep.id ? { ...x, sold_qty: newSold } : x)));
          }
        }
      }
    }

    setSales((prev) => [...((data ?? []) as Sale[]).reverse(), ...prev]);
    setCart([]);
    setShowCart(false);
    toast.success(`Venda de ${fmtBRL(cartTotal)} registrada`);
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const usingEvent = !!selectedEventId;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Modo cozinha" title="Ponto de venda" subtitle="Toque, monte o carrinho e cobre." />

      {/* Seletor de contexto */}
      <div className="card-soft p-3">
        <p className="text-[10px] uppercase tracking-widest text-rose mb-2">Vendendo em</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedEventId(null)}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs ${
              !usingEvent ? "border-rose bg-blush/60 text-mauve" : "border-border bg-card text-muted-foreground hover:border-rose/40"
            }`}
          >
            <Store className="h-3.5 w-3.5" /> Loja (avulso)
          </button>
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedEventId(e.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs ${
                selectedEventId === e.id ? "border-rose bg-blush/60 text-mauve" : "border-border bg-card text-muted-foreground hover:border-rose/40"
              }`}
            >
              <CalendarHeart className="h-3.5 w-3.5" /> {e.name}
              <span className="text-[10px] text-muted-foreground">{new Date(e.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Total + carrinho */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div layout className="card-soft overflow-hidden bg-gradient-to-br from-blush/80 to-card p-4">
          <p className="text-[11px] uppercase tracking-widest text-rose">Total de hoje</p>
          <motion.p key={totalToday} initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="font-display text-3xl italic text-mauve mt-1">
            {fmtBRL(totalToday)}
          </motion.p>
          <p className="text-[11px] text-muted-foreground">{sales.length} vendas</p>
        </motion.div>
        <button
          onClick={() => setShowCart(true)}
          disabled={cart.length === 0}
          className="card-soft p-4 text-left bg-gradient-to-br from-rose/40 to-blush/40 disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-widest text-rose">Carrinho</p>
            <ShoppingCart className="h-4 w-4 text-mauve" />
          </div>
          <p className="font-display text-3xl italic text-mauve mt-1">{fmtBRL(cartTotal)}</p>
          <p className="text-[11px] text-muted-foreground">{cartCount} itens</p>
        </button>
      </div>

      {usingEvent && (
        <div className="rounded-xl bg-blush/30 px-3 py-2 text-[11px] text-mauve">
          Vendendo em <strong>{selectedEvent?.name}</strong> — vendas serão contabilizadas no caixa do evento.
        </div>
      )}

      {/* Botões de produtos */}
      {loading ? (
        <div className="card-soft p-10 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : usingEvent ? (
        eventProducts.length === 0 ? (
          <div className="card-soft p-8 text-center text-sm text-muted-foreground">
            Este evento não tem produtos. Adicione na aba Produtos do evento.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {eventProducts.map((p) => {
              const left = Math.max(0, p.planned_qty - p.sold_qty);
              const sold_out = p.planned_qty > 0 && left === 0;
              return (
                <motion.button
                  key={p.id}
                  whileTap={{ scale: 0.96 }}
                  disabled={sold_out}
                  onClick={() => addToCart({
                    id: `ep-${p.id}`,
                    name: p.name,
                    price: Number(p.unit_price),
                    source: "event",
                    product_id: null,
                    event_product_id: p.id,
                  })}
                  className="card-soft group flex flex-col overflow-hidden text-left disabled:opacity-50"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-blush/60 to-card">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                    ) : (
                      <div className="grid h-full w-full place-items-center">
                        <Cake className="h-9 w-9 text-mauve/60" strokeWidth={1.4} />
                      </div>
                    )}
                    {p.planned_qty > 0 && (
                      <span className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums backdrop-blur ${sold_out ? "bg-destructive/80 text-white" : "bg-card/85 text-mauve"}`}>
                        {sold_out ? "Esgotado" : `${left} restam`}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-1 px-2.5 py-2">
                    <p className="line-clamp-2 text-xs font-medium leading-tight text-mauve">{p.name}</p>
                    <p className="text-sm font-semibold text-mauve">{fmtBRL(Number(p.unit_price))}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )
      ) : products.length === 0 ? (
        <div className="card-soft p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum produto. Crie seus botões de venda.</p>
          <button onClick={() => setShowManage(true)} className="mt-3 rounded-xl bg-mauve px-4 py-2 text-sm text-cream">Criar produtos</button>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <button onClick={() => setShowManage(true)} className="inline-flex items-center gap-1 rounded-xl bg-blush/50 px-3 py-1.5 text-xs text-mauve hover:bg-blush/80">
              <Settings2 className="h-3.5 w-3.5" /> Gerenciar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((p) => {
              const Icon = iconMap[p.icon] ?? Cake;
              const bg = toneMap[p.tone] ?? toneMap.rose;
              return (
                <motion.button
                  key={p.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => addToCart({
                    id: `pdv-${p.id}`,
                    name: p.label,
                    price: Number(p.price),
                    source: "pdv",
                    product_id: p.id,
                    event_product_id: null,
                  })}
                  className={`card-soft flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br ${bg} px-3 py-3 text-center min-h-[110px]`}
                >
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-card/70">
                    <Icon className="h-5 w-5 text-mauve" strokeWidth={1.4} />
                  </div>
                  <p className="line-clamp-2 text-xs font-medium leading-tight text-mauve">{p.label}</p>
                  <p className="text-sm font-semibold text-mauve">{fmtBRL(Number(p.price))}</p>
                </motion.button>
              );
            })}
          </div>
        </>
      )}

      {/* Últimas vendas */}
      <div className="card-soft overflow-hidden">
        <div className="border-b border-border/60 bg-blush/30 px-5 py-3">
          <p className="text-sm font-medium text-mauve">Últimas vendas de hoje</p>
        </div>
        {sales.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma venda ainda. 🌸</p>
        ) : (
          <ul className="divide-y divide-border/60">
            <AnimatePresence initial={false}>
              {sales.slice(0, 8).map((s) => (
                <motion.li key={s.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <span className="text-mauve">{s.item}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">{PAY_METHODS.find((m) => m.key === s.payment_method)?.label ?? s.payment_method}</span>
                  </div>
                  <span className="font-semibold text-mauve">{fmtBRL(Number(s.price))}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* Carrinho lateral */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-mauve/40 backdrop-blur-sm" onClick={() => setShowCart(false)}>
          <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-card p-5 shadow-petal">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl italic text-mauve">Carrinho</h2>
              <button onClick={() => setShowCart(false)} className="rounded-lg p-2 text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>

            {cart.length === 0 ? (
              <p className="mt-8 text-center text-sm text-muted-foreground">Carrinho vazio.</p>
            ) : (
              <>
                <ul className="mt-4 divide-y divide-border/60 rounded-xl border border-border">
                  {cart.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-mauve truncate">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground">{fmtBRL(c.price)} cada</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => changeQty(c.id, -1)} className="grid h-7 w-7 place-items-center rounded-lg bg-blush/40 text-mauve hover:bg-blush/70"><Minus className="h-3 w-3" /></button>
                        <span className="w-7 text-center text-sm font-semibold text-mauve">{c.qty}</span>
                        <button onClick={() => changeQty(c.id, 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-blush/40 text-mauve hover:bg-blush/70"><Plus className="h-3 w-3" /></button>
                      </div>
                      <span className="w-20 text-right text-sm font-semibold text-mauve">{fmtBRL(c.price * c.qty)}</span>
                      <button onClick={() => removeFromCart(c.id)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                </ul>

                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-widest text-rose mb-2">Forma de pagamento</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {PAY_METHODS.map((m) => (
                      <button key={m.key} onClick={() => setPayment(m.key)}
                        className={`rounded-xl border px-2 py-2 text-[11px] ${
                          payment === m.key ? "border-rose bg-blush/60 text-mauve font-medium" : "border-border bg-card text-muted-foreground hover:border-rose/40"
                        }`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-blush/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-mauve">Total</span>
                    <span className="font-display text-3xl italic text-mauve">{fmtBRL(cartTotal)}</span>
                  </div>
                </div>

                <button onClick={checkout} className="mt-4 w-full rounded-xl bg-mauve px-4 py-3 text-sm font-medium text-cream hover:opacity-90">
                  Cobrar e finalizar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showManage && shopId && (
        <ManageProductsSheet shopId={shopId} products={products} onClose={() => setShowManage(false)} onChange={setProducts} />
      )}
    </div>
  );
}

function ManageProductsSheet({
  shopId, products, onClose, onChange,
}: { shopId: string; products: Product[]; onClose: () => void; onChange: (p: Product[]) => void }) {
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [icon, setIcon] = useState("cake");
  const [tone, setTone] = useState("rose");

  const add = async () => {
    if (!label.trim() || !price) return toast.error("Preencha rótulo e preço");
    const { data, error } = await supabase.from("pdv_products").insert({ shop_id: shopId, label: label.trim(), price: Number(price), icon, tone, position: products.length }).select("*").single();
    if (error) return toast.error("Erro");
    onChange([...products, data as Product]); setLabel(""); setPrice("");
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
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <ul className="mt-4 divide-y divide-border/60 rounded-xl border border-border">
          {products.length === 0 ? (
            <li className="p-4 text-center text-sm text-muted-foreground">Nenhum produto.</li>
          ) : products.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-sm text-mauve">{p.label}</p>
                <p className="text-[11px] text-muted-foreground">{fmtBRL(Number(p.price))}</p>
              </div>
              <button onClick={() => remove(p.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-2 rounded-xl border border-border p-3">
          <p className="text-[10px] uppercase tracking-widest text-rose">Novo produto</p>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rótulo" className="input-base" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="Preço" className="input-base" />
          <div className="grid grid-cols-2 gap-2">
            <select value={icon} onChange={(e) => setIcon(e.target.value)} className="input-base">
              <option value="cake">Bolo</option><option value="utensils">Salgado</option><option value="sparkles">Especial</option>
            </select>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className="input-base">
              <option value="rose">Rosa</option><option value="blush">Blush</option><option value="sage">Verde</option>
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
