import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cake, Utensils, Sparkles, Settings2, Plus, Trash2, X, Minus, ShoppingCart, CalendarHeart, Store, Image as ImageIcon, Loader2, Check, Undo2, BadgePercent, Keyboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
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
type Sale = { id: string; item: string; price: number; sold_at: string; payment_method: string; refunded_at?: string | null; discount?: number | null };
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
  const [discountPct, setDiscountPct] = useState<number>(0); // 0..100
  const [showHotkeys, setShowHotkeys] = useState(false);

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
      const prods = (p.data ?? []) as Product[];
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
    let q = supabase.from("sales").select("id, item, price, sold_at, payment_method, refunded_at, discount").eq("shop_id", shopId);
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

  const totalToday = sales.reduce((s, x) => s + (x.refunded_at ? 0 : Number(x.price)), 0);
  const cartTotal = useMemo(() => cart.reduce((s, x) => s + x.price * x.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, x) => s + x.qty, 0), [cart]);
  const discountValue = useMemo(() => Math.round(cartTotal * discountPct) / 100, [cartTotal, discountPct]);
  const cartFinal = Math.max(0, cartTotal - discountValue);

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
    const factor = cartTotal > 0 ? cartFinal / cartTotal : 1;
    const rows = cart.flatMap((c) =>
      Array.from({ length: c.qty }).map(() => ({
        shop_id: shopId,
        product_id: c.product_id,
        event_id: selectedEventId,
        item: c.name,
        price: Math.round(c.price * factor * 100) / 100,
        qty: 1,
        payment_method: payment,
        cart_id: cartId,
        discount: Math.round(c.price * (1 - factor) * 100) / 100,
      }))
    );
    const { data, error } = await supabase.from("sales").insert(rows).select("id, item, price, sold_at, payment_method, refunded_at, discount");
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
    setDiscountPct(0);
    setShowCart(false);
    toast.success(`Venda de ${fmtBRL(cartFinal)} registrada${discountPct > 0 ? ` (${discountPct}% off)` : ""}`);
  };

  const refundSale = async (sale: Sale) => {
    if (sale.refunded_at) return;
    if (!confirm(`Estornar venda de ${fmtBRL(Number(sale.price))} (${sale.item})?`)) return;
    const reason = prompt("Motivo do estorno (opcional):") ?? "";
    const { error } = await supabase
      .from("sales")
      .update({ refunded_at: new Date().toISOString(), refund_reason: reason || null })
      .eq("id", sale.id);
    if (error) return toast.error("Não foi possível estornar");
    setSales((prev) => prev.map((s) => (s.id === sale.id ? { ...s, refunded_at: new Date().toISOString() } : s)));
    toast.success("Venda estornada");
  };

  // Atalhos de teclado: D=dinheiro, P=pix, C=crédito, B=débito,
  // Enter=finalizar, Esc=fechar carrinho, ?=mostrar atalhos
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) { setShowHotkeys((v) => !v); return; }
      if (e.key === "Escape") { setShowCart(false); setShowHotkeys(false); return; }
      if (cart.length === 0) return;
      const k = e.key.toLowerCase();
      if (k === "d") setPayment("cash");
      else if (k === "p") setPayment("pix");
      else if (k === "c") setPayment("credit");
      else if (k === "b") setPayment("debit");
      else if (e.key === "Enter") { e.preventDefault(); checkout(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const usingEvent = !!selectedEventId;

  const cartPanel = (
    <aside className="card-soft flex h-full flex-col overflow-hidden">
      <div className="border-b border-border/60 bg-blush/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-mauve">
            <ShoppingCart className="h-4 w-4" />
            <p className="text-sm font-semibold">Carrinho</p>
          </div>
          <span className="text-[11px] text-muted-foreground num">{cartCount} itens</span>
        </div>
      </div>
      {cart.length === 0 ? (
        <div className="grid flex-1 place-items-center p-6 text-center text-xs text-muted-foreground">
          Toque em um produto para adicionar.
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-border/60 overflow-y-auto">
          {cart.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-mauve">{c.name}</p>
                <p className="text-[10px] text-muted-foreground num">{fmtBRL(c.price)} · {fmtBRL(c.price * c.qty)}</p>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => changeQty(c.id, -1)} className="grid h-6 w-6 place-items-center rounded-md bg-blush/40 text-mauve hover:bg-blush/70"><Minus className="h-3 w-3" /></button>
                <span className="w-5 text-center text-xs font-semibold text-mauve num">{c.qty}</span>
                <button onClick={() => changeQty(c.id, 1)} className="grid h-6 w-6 place-items-center rounded-md bg-blush/40 text-mauve hover:bg-blush/70"><Plus className="h-3 w-3" /></button>
              </div>
              <button onClick={() => removeFromCart(c.id)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-border/60 p-3 space-y-3">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-rose">Pagamento</p>
          <div className="grid grid-cols-5 gap-1">
            {PAY_METHODS.map((m) => (
              <button key={m.key} onClick={() => setPayment(m.key)}
                className={`rounded-lg border px-1 py-1.5 text-[10px] ${
                  payment === m.key ? "border-rose bg-blush/60 text-mauve font-medium" : "border-border bg-card text-muted-foreground"
                }`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-widest text-rose"><BadgePercent className="h-3 w-3" /> Cupom (% off)</p>
          <div className="flex items-center gap-1">
            {[0, 5, 10, 15, 20].map((p) => (
              <button key={p} onClick={() => setDiscountPct(p)}
                className={`flex-1 rounded-lg border px-1 py-1 text-[10px] ${discountPct === p ? "border-rose bg-blush/60 text-mauve font-medium" : "border-border bg-card text-muted-foreground"}`}>
                {p === 0 ? "—" : `${p}%`}
              </button>
            ))}
            <input type="number" min={0} max={100} value={discountPct || ""} onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              placeholder="0" className="w-12 rounded-lg border border-border bg-card px-1 py-1 text-center text-[10px] text-mauve" />
          </div>
        </div>
        <div className="rounded-xl bg-blush/40 p-3 space-y-1">
          {discountValue > 0 && (
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Subtotal</span>
              <span className="num line-through">{fmtBRL(cartTotal)}</span>
            </div>
          )}
          {discountValue > 0 && (
            <div className="flex items-center justify-between text-[11px] text-rose">
              <span>Desconto {discountPct}%</span>
              <span className="num">- {fmtBRL(discountValue)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-mauve">Total</span>
            <span className="text-xl font-semibold text-mauve num">{fmtBRL(cartFinal)}</span>
          </div>
        </div>
        <button onClick={checkout} disabled={cart.length === 0} className="w-full rounded-xl bg-mauve px-4 py-2.5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-40">
          Cobrar e finalizar
        </button>
      </div>
    </aside>
  );

  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow="Modo cozinha"
        title="Ponto de venda"
        subtitle="Toque, monte o carrinho e cobre."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHotkeys(true)}
              className="hidden lg:inline-flex items-center gap-1.5 rounded-xl bg-blush/40 px-3 py-2 text-xs font-medium text-mauve hover:bg-blush/70"
              title="Atalhos de teclado (?)"
            >
              <Keyboard className="h-3.5 w-3.5" /> Atalhos
            </button>
            <button
              onClick={() => setShowManage(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blush/50 px-3 py-2 text-xs font-medium text-mauve hover:bg-blush/80"
            >
              <Settings2 className="h-3.5 w-3.5" /> Gerenciar produtos
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          {/* Seletor de contexto */}
          <div className="card-soft p-3">
            <p className="mb-2 text-[10px] uppercase tracking-widest text-rose">Vendendo em</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedEventId(null)}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs ${
                  !usingEvent ? "border-rose bg-blush/60 text-mauve" : "border-border bg-card text-muted-foreground hover:border-rose/40"
                }`}
              >
                <Store className="h-3.5 w-3.5 shrink-0" /> Loja (avulso)
              </button>
              {events.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedEventId(e.id)}
                  className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs ${
                    selectedEventId === e.id ? "border-rose bg-blush/60 text-mauve" : "border-border bg-card text-muted-foreground hover:border-rose/40"
                  }`}
                >
                  <CalendarHeart className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{e.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground num">{new Date(e.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Total do período */}
          <div className="card-soft flex items-center justify-between gap-3 bg-gradient-to-br from-blush/60 to-card p-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-rose">Total {period === "today" ? "hoje" : period === "week" ? "7 dias" : period === "month" ? "30 dias" : "tudo"}</p>
              <p className="text-2xl font-semibold text-mauve num">{fmtBRL(totalToday)}</p>
              <p className="text-[10px] text-muted-foreground">{sales.length} vendas</p>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-card/70 p-0.5">
              {([
                { k: "today", l: "Hoje" },
                { k: "week", l: "7d" },
                { k: "month", l: "30d" },
                { k: "all", l: "Tudo" },
              ] as const).map((p) => (
                <button key={p.k} onClick={() => setPeriod(p.k)}
                  className={`rounded-lg px-2 py-0.5 text-[10px] transition ${period === p.k ? "bg-mauve text-cream" : "text-mauve/70 hover:text-mauve"}`}>
                  {p.l}
                </button>
              ))}
            </div>
          </div>

          {usingEvent && (
            <div className="rounded-xl bg-blush/30 px-3 py-2 text-[11px] text-mauve">
              Vendendo em <strong>{selectedEvent?.name}</strong> — vai para o caixa do evento.
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
          <div className="grid-cards-sm">
            {eventProducts.map((p) => {
              const inC = inCart(p.id);
              const left = p.planned_qty > 0 ? Math.max(0, p.planned_qty - p.sold_qty - inC) : Infinity;
              const sold_out = p.planned_qty > 0 && left === 0;
              const maxAvail = p.planned_qty > 0 ? p.planned_qty - p.sold_qty : undefined;
              const cartItemId = `ep-${p.id}`;
              return (
                <div
                  key={p.id}
                  className={`card-soft group relative flex flex-col overflow-hidden text-left ${sold_out ? "opacity-50" : ""}`}
                >
                  <button
                    type="button"
                    disabled={sold_out}
                    onClick={() => addToCart({
                      id: cartItemId,
                      name: p.name,
                      price: Number(p.unit_price),
                      source: "event",
                      product_id: null,
                      event_product_id: p.id,
                    }, maxAvail)}
                    className="relative aspect-square w-full sm:aspect-[4/3] overflow-hidden bg-gradient-to-br from-blush/60 to-card disabled:cursor-not-allowed"
                  >
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
                  </button>
                  <div className="flex flex-1 flex-col gap-1.5 px-2.5 py-2">
                    <p className="line-clamp-2 text-xs font-medium leading-tight text-mauve">{p.name}</p>
                    <p className="text-sm font-semibold text-mauve">{fmtBRL(Number(p.unit_price))}</p>
                    {inC > 0 ? (
                      <div className="mt-1 flex items-center justify-between gap-1 rounded-lg bg-blush/50 p-1">
                        <button
                          onClick={() => changeQty(cartItemId, -1)}
                          className="grid h-7 w-7 place-items-center rounded-md bg-card text-mauve hover:bg-card/70"
                          aria-label="Remover um"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-sm font-bold text-mauve tabular-nums">{inC}</span>
                        <button
                          onClick={() => addToCart({
                            id: cartItemId, name: p.name, price: Number(p.unit_price),
                            source: "event", product_id: null, event_product_id: p.id,
                          }, maxAvail)}
                          disabled={sold_out}
                          className="grid h-7 w-7 place-items-center rounded-md bg-mauve text-cream hover:opacity-90 disabled:opacity-50"
                          aria-label="Adicionar mais um"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart({
                          id: cartItemId, name: p.name, price: Number(p.unit_price),
                          source: "event", product_id: null, event_product_id: p.id,
                        }, maxAvail)}
                        disabled={sold_out}
                        className="mt-1 inline-flex items-center justify-center gap-1 rounded-lg bg-mauve px-2 py-1.5 text-xs font-medium text-cream hover:opacity-90 disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar
                      </button>
                    )}
                  </div>
                </div>
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
        <div className="grid-cards-sm">
            {products.map((p) => {
              const Icon = iconMap[p.icon] ?? Cake;
              const bg = toneMap[p.tone] ?? toneMap.rose;
              const inC = cart.find((c) => c.product_id === p.id)?.qty ?? 0;
              const cartItemId = `pdv-${p.id}`;
              const addOne = () => addToCart({
                id: cartItemId, name: p.label, price: Number(p.price),
                source: "pdv", product_id: p.id, event_product_id: null,
              });
              return (
                <div
                  key={p.id}
                  className="card-soft group relative flex flex-col overflow-hidden text-left"
                >
                  {p.image_url ? (
                    <button
                      type="button"
                      onClick={addOne}
                      className="relative aspect-square w-full sm:aspect-[4/3] overflow-hidden bg-gradient-to-br from-blush/60 to-card"
                    >
                      <img src={p.image_url} alt={p.label} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={addOne}
                      className={`flex aspect-square w-full sm:aspect-[4/3] flex-col items-center justify-center gap-1.5 bg-gradient-to-br ${bg} px-3 py-3 text-center`}
                    >
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-card/70">
                        <Icon className="h-5 w-5 text-mauve" strokeWidth={1.4} />
                      </div>
                    </button>
                  )}
                  <div className="flex flex-1 flex-col gap-1.5 px-2.5 py-2">
                    <p className="line-clamp-2 text-xs font-medium leading-tight text-mauve">{p.label}</p>
                    <p className="text-sm font-semibold text-mauve">{fmtBRL(Number(p.price))}</p>
                    {inC > 0 ? (
                      <div className="mt-1 flex items-center justify-between gap-1 rounded-lg bg-blush/50 p-1">
                        <button
                          onClick={() => changeQty(cartItemId, -1)}
                          className="grid h-7 w-7 place-items-center rounded-md bg-card text-mauve hover:bg-card/70"
                          aria-label="Remover um"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-sm font-bold text-mauve tabular-nums">{inC}</span>
                        <button
                          onClick={addOne}
                          className="grid h-7 w-7 place-items-center rounded-md bg-mauve text-cream hover:opacity-90"
                          aria-label="Adicionar mais um"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={addOne}
                        className="mt-1 inline-flex items-center justify-center gap-1 rounded-lg bg-mauve px-2 py-1.5 text-xs font-medium text-cream hover:opacity-90"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
      )}

      {/* Últimas vendas */}
      <div className="card-soft overflow-hidden">
        <div className="border-b border-border/60 bg-blush/30 px-5 py-3">
          <p className="text-sm font-medium text-mauve">Últimas vendas {period === "today" ? "de hoje" : period === "week" ? "(7 dias)" : period === "month" ? "(30 dias)" : "(todas)"}</p>
        </div>
        {sales.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma venda ainda. 🌸</p>
        ) : (
          <ul className="divide-y divide-border/60">
            <AnimatePresence initial={false}>
              {sales.slice(0, 12).map((s) => {
                const refunded = !!s.refunded_at;
                return (
                  <motion.li key={s.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className={`flex items-center justify-between gap-2 px-5 py-3 text-sm ${refunded ? "opacity-60" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <span className={`text-mauve ${refunded ? "line-through" : ""}`}>{s.item}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">{PAY_METHODS.find((m) => m.key === s.payment_method)?.label ?? s.payment_method}</span>
                      {refunded && <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[9px] font-medium text-destructive"><Undo2 className="h-2.5 w-2.5" /> Estornada</span>}
                    </div>
                    <span className={`shrink-0 font-semibold text-mauve ${refunded ? "line-through" : ""}`}>{fmtBRL(Number(s.price))}</span>
                    {!refunded && (
                      <button onClick={() => refundSale(s)} title="Estornar venda"
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
        </div>

        {/* Coluna direita: carrinho fixo no PC */}
        <div className="hidden lg:block">
          <div className="sticky top-20">{cartPanel}</div>
        </div>
      </div>

      {/* Carrinho mobile (sheet) */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-mauve/40 backdrop-blur-sm lg:hidden" onClick={() => setShowCart(false)}>
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

                <div className="mt-4">
                  <p className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-rose"><BadgePercent className="h-3 w-3" /> Cupom de desconto</p>
                  <div className="flex items-center gap-1.5">
                    {[0, 5, 10, 15, 20].map((p) => (
                      <button key={p} onClick={() => setDiscountPct(p)}
                        className={`flex-1 rounded-lg border px-1 py-1.5 text-[11px] ${discountPct === p ? "border-rose bg-blush/60 text-mauve font-medium" : "border-border bg-card text-muted-foreground"}`}>
                        {p === 0 ? "—" : `${p}%`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-blush/30 p-4 space-y-1">
                  {discountValue > 0 && (
                    <>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="num line-through">{fmtBRL(cartTotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-rose">
                        <span>Desconto {discountPct}%</span>
                        <span className="num">- {fmtBRL(discountValue)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-mauve">Total</span>
                    <span className="font-display text-3xl italic text-mauve">{fmtBRL(cartFinal)}</span>
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
            className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-mauve px-5 py-3.5 text-cream shadow-petal sm:bottom-6 lg:hidden"
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
            <span className="text-sm font-semibold tabular-nums">{fmtBRL(cartFinal)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {showHotkeys && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-mauve/40 p-4 backdrop-blur-sm" onClick={() => setShowHotkeys(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-petal">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl italic text-mauve">Atalhos do PDV</h3>
              <button onClick={() => setShowHotkeys(false)} className="rounded-lg p-1.5 text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-mauve">
              {[
                ["D", "Pagamento em dinheiro"],
                ["P", "Pagamento Pix"],
                ["C", "Cartão de crédito"],
                ["B", "Cartão de débito"],
                ["Enter", "Finalizar venda"],
                ["Esc", "Fechar carrinho"],
                ["?", "Mostrar/ocultar atalhos"],
              ].map(([k, l]) => (
                <li key={k} className="flex items-center justify-between rounded-lg bg-blush/30 px-3 py-1.5">
                  <span>{l}</span>
                  <kbd className="rounded-md border border-border bg-card px-2 py-0.5 text-xs font-mono text-mauve">{k}</kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </PageContainer>
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
