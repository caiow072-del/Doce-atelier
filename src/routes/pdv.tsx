import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cake, Utensils, Sparkles, Settings2, Plus, Trash2, X, Minus, ShoppingCart, CalendarHeart, Store, Image as ImageIcon, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { getOccurrences } from "@/lib/recurrence";
import { uploadShopImage } from "@/lib/upload";

export const Route = createFileRoute("/pdv")({
  head: () => ({
    meta: [
      { title: "PDV — Cakes Manager" },
      { name: "description", content: "Carrinho rápido para vendas de loja, festival ou feira." },
    ],
  }),
  component: PDVPage,
});

type Product = { id: string; label: string; price: number; icon: string; tone: string; position: number; active: boolean; image_url: string | null };
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

type Period = "today" | "week" | "month" | "all";

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
  const [period, setPeriod] = useState<Period>("today");
  const [showManage, setShowManage] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);

  const periodStart = useMemo(() => {
    const d = new Date();
    if (period === "today") { d.setHours(0,0,0,0); return d; }
    if (period === "week") { d.setDate(d.getDate() - 7); return d; }
    if (period === "month") { d.setMonth(d.getMonth() - 1); return d; }
    return null; // all
  }, [period]);

  // ============ Load (produtos + eventos) ============
  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      supabase.from("pdv_products").select("*").eq("shop_id", shopId).eq("active", true).order("position"),
      supabase.from("events").select("id, name, date, closed_at, recurrence, recurrence_until, weekday, day_of_month").eq("shop_id", shopId).is("closed_at", null),
    ]).then(async ([p, e]) => {
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
      const horizon = new Date(Date.now() + 7 * 86_400_000);
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const evList = ((e.data ?? []) as EventLite[]).filter((ev) => {
        if (ev.recurrence && ev.recurrence !== "none") {
          return getOccurrences(ev as any, todayStart, horizon).length > 0;
        }
        return new Date(ev.date) >= todayStart && new Date(ev.date).toISOString().slice(0,10) >= today;
      }).slice(0, 10);
      setEvents(evList);
      setLoading(false);
    });
  }, [shopId]);

  // ============ Load sales (reage ao período) ============
  useEffect(() => {
    if (!shopId) return;
    let q = supabase.from("sales").select("id, item, price, sold_at, payment_method").eq("shop_id", shopId);
    if (periodStart) q = q.gte("sold_at", periodStart.toISOString());
    q.order("sold_at", { ascending: false }).limit(500).then(({ data }) => {
      setSales((data ?? []) as Sale[]);
    });
  }, [shopId, periodStart]);

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

  const inCart = (eventProductId: string) =>
    cart.find((c) => c.event_product_id === eventProductId)?.qty ?? 0;

  const addToCart = (item: Omit<CartItem, "qty">, maxAvailable?: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.id === item.id);
      const currentQty = idx >= 0 ? prev[idx].qty : 0;
      if (typeof maxAvailable === "number" && currentQty + 1 > maxAvailable) {
        toast.error("Sem estoque suficiente");
        return prev;
      }
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
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-widest text-rose">Total</p>
            <div className="flex gap-0.5 rounded-full border border-border bg-card/70 p-0.5">
              {([
                { k: "today", l: "Hoje" },
                { k: "week", l: "7d" },
                { k: "month", l: "30d" },
                { k: "all", l: "Tudo" },
              ] as const).map((p) => (
                <button key={p.k} onClick={() => setPeriod(p.k)}
                  className={`rounded-full px-2 py-0.5 text-[10px] transition ${period === p.k ? "bg-mauve text-cream" : "text-mauve/70 hover:text-mauve"}`}>
                  {p.l}
                </button>
              ))}
            </div>
          </div>
          <motion.p key={`${totalToday}-${period}`} initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="font-display text-3xl italic text-mauve mt-1">
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
              const inC = inCart(p.id);
              const left = p.planned_qty > 0 ? Math.max(0, p.planned_qty - p.sold_qty - inC) : Infinity;
              const sold_out = p.planned_qty > 0 && left === 0;
              const maxAvail = p.planned_qty > 0 ? p.planned_qty - p.sold_qty : undefined;
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
                  }, maxAvail)}
                  className="card-soft group relative flex flex-col overflow-hidden text-left disabled:opacity-50"
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
                    {inC > 0 && !sold_out && (
                      <span className="absolute left-1.5 top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-mauve px-1.5 text-[10px] font-semibold text-cream">
                        {inC}
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
              const inC = cart.find((c) => c.product_id === p.id)?.qty ?? 0;
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
                  className={`card-soft group relative flex flex-col overflow-hidden text-left min-h-[110px] ${p.image_url ? "" : `items-center justify-center gap-1.5 bg-gradient-to-br ${bg} px-3 py-3 text-center`}`}
                >
                  {p.image_url ? (
                    <>
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-blush/60 to-card">
                        <img src={p.image_url} alt={p.label} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                        {inC > 0 && (
                          <span className="absolute left-1.5 top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-mauve px-1.5 text-[10px] font-semibold text-cream">{inC}</span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between gap-1 px-2.5 py-2">
                        <p className="line-clamp-2 text-xs font-medium leading-tight text-mauve">{p.label}</p>
                        <p className="text-sm font-semibold text-mauve">{fmtBRL(Number(p.price))}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-card/70">
                        <Icon className="h-5 w-5 text-mauve" strokeWidth={1.4} />
                      </div>
                      <p className="line-clamp-2 text-xs font-medium leading-tight text-mauve">{p.label}</p>
                      <p className="text-sm font-semibold text-mauve">{fmtBRL(Number(p.price))}</p>
                      {inC > 0 && (
                        <span className="absolute left-1.5 top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-mauve px-1.5 text-[10px] font-semibold text-cream">{inC}</span>
                      )}
                    </>
                  )}
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

      {/* FAB carrinho flutuante */}
      <AnimatePresence>
        {cartCount > 0 && !showCart && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setShowCart(true)}
            className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-mauve px-5 py-3.5 text-cream shadow-petal sm:bottom-6"
            aria-label={`Abrir carrinho com ${cartCount} itens`}
          >
            <div className="relative">
              <ShoppingCart className="h-5 w-5" />
              <motion.span
                key={cartCount}
                initial={{ scale: 1.4 }}
                animate={{ scale: 1 }}
                className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1 text-[10px] font-semibold text-mauve"
              >
                {cartCount}
              </motion.span>
            </div>
            <span className="text-sm font-semibold tabular-nums">{fmtBRL(cartTotal)}</span>
          </motion.button>
        )}
      </AnimatePresence>
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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setLabel(p.label);
    setPrice(String(p.price));
    setIcon(p.icon);
    setTone(p.tone);
    setImageUrl(p.image_url);
  };

  const reset = () => {
    setEditingId(null); setLabel(""); setPrice(""); setIcon("cake"); setTone("rose"); setImageUrl(null);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadShopImage("product-images", shopId, file);
      setImageUrl(url);
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!label.trim() || !price) return toast.error("Preencha rótulo e preço");
    if (editingId) {
      const { data, error } = await supabase.from("pdv_products")
        .update({ label: label.trim(), price: Number(price), icon, tone, image_url: imageUrl })
        .eq("id", editingId).select("*").single();
      if (error) return toast.error("Erro ao salvar");
      onChange(products.map((p) => p.id === editingId ? (data as Product) : p));
      toast.success("Produto atualizado");
    } else {
      const { data, error } = await supabase.from("pdv_products")
        .insert({ shop_id: shopId, label: label.trim(), price: Number(price), icon, tone, image_url: imageUrl, position: products.length })
        .select("*").single();
      if (error) return toast.error("Erro ao criar");
      onChange([...products, data as Product]);
      toast.success("Produto adicionado");
    }
    reset();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("pdv_products").update({ active: false }).eq("id", id);
    if (error) return toast.error("Erro");
    onChange(products.filter((p) => p.id !== id));
    if (editingId === id) reset();
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
            <li key={p.id} className={`flex items-center gap-2 px-3 py-2 ${editingId === p.id ? "bg-blush/30" : ""}`}>
              {p.image_url ? (
                <img src={p.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blush/40">
                  <Cake className="h-4 w-4 text-mauve" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-mauve">{p.label}</p>
                <p className="text-[11px] text-muted-foreground">{fmtBRL(Number(p.price))}</p>
              </div>
              <button onClick={() => startEdit(p)} className="rounded-lg p-1.5 text-mauve hover:bg-blush/50" aria-label="Editar"><Settings2 className="h-4 w-4" /></button>
              <button onClick={() => remove(p.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-2 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-rose">{editingId ? "Editando produto" : "Novo produto"}</p>
            {editingId && (
              <button onClick={reset} className="text-[11px] text-muted-foreground hover:text-mauve">Cancelar edição</button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className={`grid h-16 w-16 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-blush/20 ${uploading ? "opacity-50" : "hover:bg-blush/40"}`}>
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-mauve" />
              ) : imageUrl ? (
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-5 w-5 text-mauve/60" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="flex-1 space-y-1.5">
              {imageUrl && (
                <button onClick={() => setImageUrl(null)} className="text-[11px] text-destructive hover:underline">Remover imagem</button>
              )}
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rótulo" className="input-base w-full" />
            </div>
          </div>
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="Preço" className="input-base" />
          <div className="grid grid-cols-2 gap-2">
            <select value={icon} onChange={(e) => setIcon(e.target.value)} className="input-base">
              <option value="cake">Bolo</option><option value="utensils">Salgado</option><option value="sparkles">Especial</option>
            </select>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className="input-base">
              <option value="rose">Rosa</option><option value="blush">Blush</option><option value="sage">Verde</option>
            </select>
          </div>
          <button onClick={save} disabled={uploading} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-mauve px-4 py-2 text-sm text-cream hover:opacity-90 disabled:opacity-60">
            {editingId ? <><Check className="h-4 w-4" /> Salvar</> : <><Plus className="h-4 w-4" /> Adicionar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
