import { createFileRoute } from "@tanstack/react-router";
import { ConfirmDialog, type ConfirmConfig } from "@/components/ConfirmDialog";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cake,
  Utensils,
  Sparkles,
  Settings2,
  Plus,
  Trash2,
  X,
  Minus,
  ShoppingCart,
  ShoppingBasket,
  CalendarHeart,
  Store,
  Loader2,
  Check,
  Undo2,
  BadgePercent,
  Keyboard,
  ChevronDown,
  Calendar,
  ChevronLeft,
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
import { toast } from "sonner";
import { getOccurrences } from "@/lib/recurrence";
import { ManageProductsSheet } from "./-pdv/ManageProductsSheet";
import { AddProductModal } from "./-pdv/AddProductModal";
import type { Product, EventProduct } from "./-pdv/types";
import { fmtBRL } from "./-pdv/types";

export const Route = createFileRoute("/pdv")({
  head: () => ({
    meta: [
      { title: "PDV — Doce Atelier" },
      { name: "description", content: "Carrinho rápido para vendas de loja, festival ou feira." },
    ],
  }),
  component: PDVPage,
});

type EventLite = {
  id: string;
  name: string;
  date: string;
  closed_at: string | null;
  recurrence?: string;
  recurrence_until?: string | null;
  weekday?: number | null;
  day_of_month?: number | null;
};
type Sale = {
  id: string;
  item: string;
  price: number;
  qty: number;
  sold_at: string;
  payment_method: string;
  refunded_at?: string | null;
  discount?: number | null;
  cart_id?: string | null;
};
type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  source: "pdv" | "event";
  product_id: string | null;
  event_product_id: string | null;
};
type PaymentMethod = "cash" | "pix" | "credit" | "debit" | "other";

const iconMap: Record<string, typeof Cake> = { cake: Cake, utensils: Utensils, sparkles: Sparkles };
const toneMap: Record<string, string> = {
  rose: "from-blush/70 to-card",
  blush: "from-rose/60 to-blush/60",
  sage: "from-sage/40 to-blush/40",
};
const PAY_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: "Dinheiro" },
  { key: "pix", label: "Pix" },
  { key: "credit", label: "Crédito" },
  { key: "debit", label: "Débito" },
  { key: "other", label: "Outro" },
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
  const [orderRevenue, setOrderRevenue] = useState(0);
  const [period, setPeriod] = useState<Period>("today");
  const [showManage, setShowManage] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showEventPicker, setShowEventPicker] = useState(false);

  const groupedSales = useMemo(() => {
    const groups: Record<string, {
      id: string;
      sold_at: string;
      payment_method: string;
      refunded_at: string | null;
      items: { name: string; qty: number; price: number }[];
      totalPrice: number;
      totalQty: number;
      cart_id: string | null;
    }> = {};

    sales.forEach((s) => {
      const key = s.cart_id || s.id;
      if (!groups[key]) {
        groups[key] = {
          id: s.id,
          sold_at: s.sold_at,
          payment_method: s.payment_method,
          refunded_at: s.refunded_at || null,
          items: [{ name: s.item, qty: Number(s.qty || 1), price: Number(s.price) }],
          totalPrice: Number(s.price),
          totalQty: Number(s.qty || 1),
          cart_id: s.cart_id || null,
        };
      } else {
        groups[key].items.push({ name: s.item, qty: Number(s.qty || 1), price: Number(s.price) });
        groups[key].totalPrice += Number(s.price);
        groups[key].totalQty += Number(s.qty || 1);
        if (s.refunded_at && !groups[key].refunded_at) {
          groups[key].refunded_at = s.refunded_at;
        }
      }
    });

    return Object.values(groups).sort(
      (a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime()
    );
  }, [sales]);
  const [discountPct, setDiscountPct] = useState<number>(0); // 0..100
  const [showHotkeys, setShowHotkeys] = useState(false);
  const [confirmCfg, setConfirmCfg] = useState<ConfirmConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const totalPages = Math.max(1, Math.ceil(groupedSales.length / itemsPerPage));
  const paginatedSales = useMemo(() => 
    groupedSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [groupedSales, currentPage]
  );

  // Reset page when context changes
  useEffect(() => {
    setCurrentPage(1);
  }, [period, selectedEventId, sales]);

  const periodStart = useMemo(() => {
    const d = new Date();
    if (period === "today") {
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (period === "week") {
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (period === "month") {
      d.setMonth(d.getMonth() - 1);
      return d;
    }
    return null; // all
  }, [period]);

  // ============ Load (produtos + eventos) ============
  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      supabase
        .from("pdv_products")
        .select("*")
        .eq("shop_id", shopId)
        .eq("active", true)
        .order("position"),
      supabase
        .from("events")
        .select("id, name, date, closed_at, recurrence, recurrence_until, weekday, day_of_month")
        .eq("shop_id", shopId)
        .is("closed_at", null),
    ]).then(async ([p, e]) => {
      const prods = (p.data ?? []) as Product[];
      setProducts(prods);
      const horizon = new Date(Date.now() + 7 * 86_400_000);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const evList = ((e.data ?? []) as EventLite[])
        .filter((ev) => {
          if (ev.recurrence && ev.recurrence !== "none") {
            return getOccurrences(ev as any, todayStart, horizon).length > 0;
          }
          return (
            new Date(ev.date) >= todayStart && new Date(ev.date).toISOString().slice(0, 10) >= today
          );
        })
        .slice(0, 10);
      setEvents(evList);
      setLoading(false);
    });
  }, [shopId]);

  // ============ Load sales (reage ao período) ============
  useEffect(() => {
    if (!shopId) return;
    let q = supabase
      .from("sales")
      .select("id, item, price, qty, sold_at, payment_method, refunded_at, discount, cart_id")
      .eq("shop_id", shopId);
    
    if (selectedEventId) {
      q = q.eq("event_id", selectedEventId);
    } else {
      q = q.is("event_id", null);
    }

    if (periodStart) q = q.gte("sold_at", periodStart.toISOString());
    q.order("sold_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setSales((data ?? []) as Sale[]);
      });

    let oq = supabase
      .from("orders")
      .select("total_price")
      .eq("shop_id", shopId)
      .in("status", ["confirmado", "produzindo", "pronto", "entregue"]);
    if (periodStart) oq = oq.gte("created_at", periodStart.toISOString());
    oq.then(({ data }) => {
      setOrderRevenue((data ?? []).reduce((s: number, x: any) => s + Number(x.total_price || 0), 0));
    });
  }, [shopId, periodStart, selectedEventId]);

  // Carrega produtos do evento selecionado
  useEffect(() => {
    if (!selectedEventId) {
      setEventProducts([]);
      return;
    }
    supabase
      .from("event_products")
      .select("*")
      .eq("event_id", selectedEventId)
      .order("position")
      .then(({ data }) => {
        setEventProducts((data ?? []) as EventProduct[]);
      });
  }, [selectedEventId]);

  const totalToday = sales.reduce((s, x) => s + (x.refunded_at ? 0 : Number(x.price)), 0);
  const totalGeral = totalToday + orderRevenue;
  const cartTotal = useMemo(() => cart.reduce((s, x) => s + x.price * x.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, x) => s + x.qty, 0), [cart]);
  const discountValue = useMemo(
    () => Math.round(cartTotal * discountPct) / 100,
    [cartTotal, discountPct],
  );
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
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((c) => {
        if (c.id !== id) return [c];
        const q = c.qty + delta;
        return q <= 0 ? [] : [{ ...c, qty: q }];
      }),
    );
  };

  const removeFromCart = (id: string) => setCart((p) => p.filter((c) => c.id !== id));

  const checkout = async () => {
    if (!shopId || cart.length === 0) return;
    const cartId = crypto.randomUUID();
    const factor = cartTotal > 0 ? cartFinal / cartTotal : 1;
    const rows = cart.map((c) => ({
      shop_id: shopId,
      product_id: c.product_id,
      event_id: selectedEventId,
      item: c.name,
      price: Math.round(c.price * c.qty * factor * 100) / 100,
      qty: c.qty,
      payment_method: payment,
      cart_id: cartId,
      discount: Math.round(c.price * c.qty * (1 - factor) * 100) / 100,
    }));
    const { data, error } = await supabase
      .from("sales")
      .insert(rows)
      .select("id, item, price, qty, sold_at, payment_method, refunded_at, discount, cart_id");
    if (error) return toast.error("Erro ao registrar venda");

    // Atualiza sold_qty dos event_products
    if (selectedEventId) {
      for (const c of cart) {
        if (c.event_product_id) {
          const ep = eventProducts.find((x) => x.id === c.event_product_id);
          if (ep) {
            const newSold = ep.sold_qty + c.qty;
            await supabase.from("event_products").update({ sold_qty: newSold }).eq("id", ep.id);
            setEventProducts((prev) =>
              prev.map((x) => (x.id === ep.id ? { ...x, sold_qty: newSold } : x)),
            );
          }
        }
      }
    }

    setSales((prev) => [...((data ?? []) as Sale[]).reverse(), ...prev]);
    setCart([]);
    setDiscountPct(0);
    setShowCart(false);
    toast.success(
      `Venda de ${fmtBRL(cartFinal)} registrada${discountPct > 0 ? ` (${discountPct}% off)` : ""}`,
    );
  };

  const canRefund = currentShop?.role === "owner" || currentShop?.role === "manager";

  const refundSale = (sale: Sale) => {
    if (sale.refunded_at) return;
    if (!canRefund) return toast.error("Sem permissão para estornar vendas");
    setConfirmCfg({
      title: "Estornar venda?",
      description: `Venda de ${fmtBRL(Number(sale.price))} (${sale.item}) será marcada como estornada.`,
      confirmLabel: "Estornar",
      variant: "destructive",
      action: async () => {
        const { error } = await supabase
          .from("sales")
          .update({ refunded_at: new Date().toISOString(), refund_reason: null })
          .eq("id", sale.id);
        if (error) return toast.error("Não foi possível estornar");
        setSales((prev) =>
          prev.map((s) => (s.id === sale.id ? { ...s, refunded_at: new Date().toISOString() } : s)),
        );
        toast.success("Venda estornada");
      },
    });
  };

  // Atalhos de teclado: D=dinheiro, P=pix, C=crédito, B=débito,
  // Enter=finalizar, Esc=fechar carrinho, ?=mostrar atalhos
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        setShowHotkeys((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setShowCart(false);
        setShowHotkeys(false);
        return;
      }
      if (cart.length === 0) return;
      const k = e.key.toLowerCase();
      if (k === "d") setPayment("cash");
      else if (k === "p") setPayment("pix");
      else if (k === "c") setPayment("credit");
      else if (k === "b") setPayment("debit");
      else if (e.key === "Enter") {
        e.preventDefault();
        checkout();
      }
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
                <p className="text-[10px] text-muted-foreground num">
                  {fmtBRL(c.price)} · {fmtBRL(c.price * c.qty)}
                </p>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => changeQty(c.id, -1)}
                  className="grid h-6 w-6 place-items-center rounded-md bg-blush/40 text-mauve hover:bg-blush/70"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-5 text-center text-xs font-semibold text-mauve num">
                  {c.qty}
                </span>
                <button
                  onClick={() => changeQty(c.id, 1)}
                  className="grid h-6 w-6 place-items-center rounded-md bg-blush/40 text-mauve hover:bg-blush/70"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <button
                onClick={() => removeFromCart(c.id)}
                className="rounded p-1 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-border/60 p-3 space-y-3">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-rose">Pagamento</p>
          <div className="grid grid-cols-5 gap-1">
            {PAY_METHODS.map((m) => (
              <button
                key={m.key}
                onClick={() => setPayment(m.key)}
                className={`rounded-lg border px-1 py-1.5 text-[10px] ${
                  payment === m.key
                    ? "border-rose bg-blush/60 text-mauve font-medium"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-widest text-rose">
            <BadgePercent className="h-3 w-3" /> Cupom (% off)
          </p>
          <div className="flex items-center gap-1">
            {[0, 5, 10, 15, 20].map((p) => (
              <button
                key={p}
                onClick={() => setDiscountPct(p)}
                className={`flex-1 rounded-lg border px-1 py-1 text-[10px] ${discountPct === p ? "border-rose bg-blush/60 text-mauve font-medium" : "border-border bg-card text-muted-foreground"}`}
              >
                {p === 0 ? "—" : `${p}%`}
              </button>
            ))}
            <input
              type="number"
              min={0}
              max={100}
              value={discountPct || ""}
              onChange={(e) =>
                setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
              }
              placeholder="0"
              className="w-12 rounded-lg border border-border bg-card px-1 py-1 text-center text-[10px] text-mauve"
            />
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
        <button
          onClick={checkout}
          disabled={cart.length === 0}
          className="w-full rounded-xl bg-mauve px-4 py-2.5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-40"
        >
          Cobrar e finalizar
        </button>
      </div>
    </aside>
  );

  return (
    <PageContainer width="default">
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
              <Settings2 className="h-3.5 w-3.5" /> Gerenciar
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-3 py-2 text-xs font-medium text-cream hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar produto
            </button>
          </div>
        }
      />

      <div className="space-y-4">
        <div className="min-w-0 space-y-4">
          {/* Cabeçalho Compacto: Contexto + Total Unificado */}
          <div className="flex flex-wrap items-center gap-2 max-w-full">
            <div className="card-soft flex items-center gap-1 p-1 bg-white/80 backdrop-blur-sm">
              <button
                onClick={() => {
                  setSelectedEventId(null);
                  setShowEventPicker(false);
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs transition-all ${
                  !usingEvent
                    ? "bg-mauve text-cream shadow-sm"
                    : "text-muted-foreground hover:bg-rose/5"
                }`}
              >
                <Store className="h-3.5 w-3.5 shrink-0" /> Loja
              </button>
              
              <Popover open={showEventPicker} onOpenChange={setShowEventPicker}>
                <PopoverTrigger asChild>
                  <button
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs transition-all ${
                      usingEvent
                        ? "bg-mauve text-cream shadow-sm"
                        : "text-muted-foreground hover:bg-rose/5"
                    }`}
                  >
                    <CalendarHeart className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate max-w-[120px]">{usingEvent ? selectedEvent?.name : "Eventos"}</span>
                    <ChevronDown className={`h-3 w-3 shrink-0 opacity-50 transition-transform ${showEventPicker ? "rotate-180" : ""}`} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-2" align="start">
                  <div className="grid gap-1">
                    <p className="px-2 pb-2 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Escolher evento</p>
                    {events.length === 0 ? (
                      <p className="px-2 py-4 text-center text-xs text-muted-foreground">Nenhum evento ativo.</p>
                    ) : (
                      events.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => {
                            setSelectedEventId(e.id);
                            setShowEventPicker(false);
                          }}
                          className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-all ${
                            selectedEventId === e.id
                              ? "bg-blush/40 text-mauve"
                              : "text-muted-foreground hover:bg-rose/5 hover:text-mauve"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{e.name}</p>
                            <p className="text-[10px] opacity-70">
                              {new Date(e.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                            </p>
                          </div>
                          {selectedEventId === e.id && <Check className="h-3.5 w-3.5 text-rose" />}
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Total Resumido (Fluxo de caixa) com Filtro de Período */}
            <div className="card-soft flex items-center gap-1 p-1 pl-3 bg-gradient-to-r from-blush/40 to-white/80 backdrop-blur-sm">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex flex-col text-left hover:opacity-80 transition-opacity">
                    <p className="text-[9px] uppercase tracking-tighter text-rose font-bold flex items-center gap-1">
                      Fluxo de caixa <ChevronDown className="h-2.5 w-2.5" />
                    </p>
                    <p className="text-sm font-semibold text-mauve num leading-none">{fmtBRL(totalGeral)}</p>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-3" align="start">
                  <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Composição</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-mauve flex items-center gap-1.5"><Store className="h-3 w-3 text-rose"/> PDV/Eventos</span>
                      <span className="font-medium num">{fmtBRL(totalToday)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-mauve flex items-center gap-1.5"><ClipboardList className="h-3 w-3 text-rose"/> Encomendas</span>
                      <span className="font-medium num">{fmtBRL(orderRevenue)}</span>
                    </div>
                    <div className="my-1 h-px bg-border/60" />
                    <div className="flex justify-between items-center text-sm font-bold text-mauve">
                      <span>Total</span>
                      <span className="num">{fmtBRL(totalGeral)}</span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                <SelectTrigger className="h-8 w-auto gap-1 border-none bg-transparent px-2 text-[11px] font-medium text-mauve hover:bg-rose/10 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="today" className="text-xs">Hoje</SelectItem>
                  <SelectItem value="week" className="text-xs">Semana</SelectItem>
                  <SelectItem value="month" className="text-xs">Mês</SelectItem>
                  <SelectItem value="all" className="text-xs">Ano (Tudo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {usingEvent && (
            <div className="rounded-xl bg-blush/30 px-3 py-2 text-[11px] text-mauve inline-flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-rose" />
              <span>Vendendo em <strong>{selectedEvent?.name}</strong> — caixa do evento.</span>
            </div>
          )}

          {/* Botões de produtos */}
          {loading ? (
            <div className="card-soft p-10 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : usingEvent ? (
            eventProducts.length === 0 ? (
              <div className="mx-auto max-w-md flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/60 bg-card/40 py-12 px-6 text-center mt-6">
                <ShoppingBasket className="mb-4 h-8 w-8 text-muted-foreground" strokeWidth={1.4} />
                <p className="text-sm text-muted-foreground">Este evento não tem produtos.</p>
                <p className="mt-1 text-xs text-muted-foreground/70">Adicione na aba Produtos do evento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                {eventProducts.map((p) => {
                  const inC = inCart(p.id);
                  const left =
                    p.planned_qty > 0 ? Math.max(0, p.planned_qty - p.sold_qty - inC) : Infinity;
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
                        onClick={() =>
                          addToCart(
                            {
                              id: cartItemId,
                              name: p.name,
                              price: Number(p.unit_price),
                              source: "event",
                              product_id: null,
                              event_product_id: p.id,
                            },
                            maxAvail,
                          )
                        }
                        className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-blush/60 to-card disabled:cursor-not-allowed"
                      >
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center">
                            <Cake className="h-9 w-9 text-mauve/60" strokeWidth={1.4} />
                          </div>
                        )}
                        {p.planned_qty > 0 && (
                          <span
                            className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums backdrop-blur ${sold_out ? "bg-destructive/80 text-white" : "bg-card/85 text-mauve"}`}
                          >
                            {sold_out ? "Esgotado" : `${left} restam`}
                          </span>
                        )}
                      </button>
                      <div className="flex flex-1 flex-col gap-1.5 px-2.5 py-2">
                        <p className="line-clamp-2 text-xs font-medium leading-tight text-mauve">
                          {p.name}
                        </p>
                        <p className="text-sm font-semibold text-mauve">
                          {fmtBRL(Number(p.unit_price))}
                        </p>
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
                              onClick={() =>
                                addToCart(
                                  {
                                    id: cartItemId,
                                    name: p.name,
                                    price: Number(p.unit_price),
                                    source: "event",
                                    product_id: null,
                                    event_product_id: p.id,
                                  },
                                  maxAvail,
                                )
                              }
                              disabled={sold_out}
                              className="grid h-7 w-7 place-items-center rounded-md bg-mauve text-cream hover:opacity-90 disabled:opacity-50"
                              aria-label="Adicionar mais um"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              addToCart(
                                {
                                  id: cartItemId,
                                  name: p.name,
                                  price: Number(p.unit_price),
                                  source: "event",
                                  product_id: null,
                                  event_product_id: p.id,
                                },
                                maxAvail,
                              )
                            }
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
            <div className="mx-auto max-w-md flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/60 bg-card/40 py-12 px-6 text-center mt-6">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-blush/50">
                <ShoppingBasket className="h-6 w-6 text-mauve" strokeWidth={1.4} />
              </div>
              <p className="text-base font-semibold text-mauve">Nenhum produto cadastrado ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie botões de venda rápida para agilizar o caixa.
              </p>
              <button
                onClick={() => setShowManage(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-mauve px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90"
              >
                <Plus className="h-4 w-4" /> Adicionar primeiro produto
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
              {products.map((p) => {
                const Icon = iconMap[p.icon] ?? Cake;
                const bg = toneMap[p.tone] ?? toneMap.rose;
                const inC = cart.find((c) => c.product_id === p.id)?.qty ?? 0;
                const cartItemId = `pdv-${p.id}`;
                const addOne = () =>
                  addToCart({
                    id: cartItemId,
                    name: p.label,
                    price: Number(p.price),
                    source: "pdv",
                    product_id: p.id,
                    event_product_id: null,
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
                        className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-blush/60 to-card"
                      >
                        <img
                          src={p.image_url}
                          alt={p.label}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={addOne}
                        className={`flex aspect-square w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br ${bg} px-3 py-3 text-center`}
                      >
                        <div className="grid h-9 w-9 place-items-center rounded-xl bg-card/70">
                          <Icon className="h-5 w-5 text-mauve" strokeWidth={1.4} />
                        </div>
                      </button>
                    )}
                    <div className="flex flex-1 flex-col gap-1.5 px-2.5 py-2">
                      <p className="line-clamp-2 text-xs font-medium leading-tight text-mauve">
                        {p.label}
                      </p>
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
              <p className="text-sm font-medium text-mauve">
                Últimas vendas{" "}
                {period === "today"
                  ? "de hoje"
                  : period === "week"
                    ? "(7 dias)"
                    : period === "month"
                      ? "(30 dias)"
                      : "(todas)"}
              </p>
            </div>
            {sales.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nenhuma venda ainda. 🌸
              </p>
            ) : (
              <>
                <div className="max-h-[450px] overflow-y-auto overflow-x-auto relative">
                  <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-20 bg-card shadow-sm">
                      <tr>
                        <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-rose font-bold whitespace-nowrap">Hora</th>
                        <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-rose font-bold w-full">Produto</th>
                        <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-rose font-bold whitespace-nowrap">Pagamento</th>
                        <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-rose font-bold text-right whitespace-nowrap">Valor</th>
                        <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-rose font-bold text-right whitespace-nowrap">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {paginatedSales.map((gs) => {
                        const refunded = !!gs.refunded_at;

                        let payBadge = "bg-slate-100 text-slate-800";
                        if (gs.payment_method === "pix") payBadge = "bg-emerald-100 text-emerald-800";
                        else if (gs.payment_method === "credit" || gs.payment_method === "debit") payBadge = "bg-blue-100 text-blue-800";

                        return (
                          <tr
                            key={gs.id}
                            className={`transition-colors hover:bg-rose/5 ${refunded ? "opacity-60" : ""}`}
                          >
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(gs.sold_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className="px-4 py-3 w-full">
                              <div className="flex flex-col gap-1.5">
                                <div className={`flex flex-wrap gap-1 ${refunded ? "line-through opacity-60" : ""}`}>
                                  {gs.items.map((it, i) => {
                                    const text = it.qty > 1 ? `${it.qty}x ${it.name}` : it.name;
                                    return (
                                      <span key={i} className="inline-flex items-center rounded-md bg-blush/40 px-2 py-0.5 text-[11px] font-medium text-mauve">
                                        {text}
                                      </span>
                                    );
                                  })}
                                </div>
                                {refunded && (
                                  <div className="flex">
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[9px] font-bold text-destructive uppercase">
                                      <Undo2 className="h-2.5 w-2.5" /> Estornada
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${payBadge}`}>
                                {PAY_METHODS.find((m) => m.key === gs.payment_method)?.label ?? gs.payment_method}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className={`text-sm font-bold text-mauve ${refunded ? "line-through" : ""}`}>
                                {fmtBRL(gs.totalPrice)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex justify-end">
                                {!refunded && canRefund && (
                                  <button
                                    onClick={() => {
                                      const itemsToRefund = sales.filter(s => (s.cart_id === gs.cart_id && gs.cart_id) || s.id === gs.id);
                                      setConfirmCfg({
                                        title: "Estornar pedido?",
                                        description: `Deseja estornar o pedido completo de ${fmtBRL(gs.totalPrice)}?`,
                                        confirmLabel: "Estornar",
                                        variant: "destructive",
                                        action: async () => {
                                          const ids = itemsToRefund.map(it => it.id);
                                          const { error } = await supabase
                                            .from("sales")
                                            .update({ refunded_at: new Date().toISOString() })
                                            .in("id", ids);
                                          if (error) return toast.error("Erro ao estornar");
                                          setSales(prev => prev.map(s => ids.includes(s.id) ? { ...s, refunded_at: new Date().toISOString() } : s));
                                          toast.success("Pedido estornado");
                                        }
                                      });
                                    }}
                                    title="Estornar pedido"
                                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Undo2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border/60 bg-blush/10 px-5 py-3">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Página <span className="text-mauve font-bold">{currentPage}</span> de <span className="text-mauve font-bold">{totalPages}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className="flex items-center gap-1 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-mauve shadow-sm transition-all hover:bg-rose/5 disabled:opacity-50 disabled:hover:bg-card"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                      </button>
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        className="flex items-center gap-1 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-mauve shadow-sm transition-all hover:bg-rose/5 disabled:opacity-50 disabled:hover:bg-card"
                      >
                        Próximo <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Carrinho (Sheet Flutuante Unificado) */}
      {showCart && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-mauve/40 p-4 backdrop-blur-sm"
          onClick={() => setShowCart(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-card p-5 shadow-petal"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl italic text-mauve">Carrinho</h2>
              <button
                onClick={() => setShowCart(false)}
                className="rounded-lg p-2 text-muted-foreground"
              >
                <X className="h-5 w-5" />
              </button>
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
                        <button
                          onClick={() => changeQty(c.id, -1)}
                          className="grid h-7 w-7 place-items-center rounded-lg bg-blush/40 text-mauve hover:bg-blush/70"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold text-mauve">
                          {c.qty}
                        </span>
                        <button
                          onClick={() => changeQty(c.id, 1)}
                          className="grid h-7 w-7 place-items-center rounded-lg bg-blush/40 text-mauve hover:bg-blush/70"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="w-20 text-right text-sm font-semibold text-mauve">
                        {fmtBRL(c.price * c.qty)}
                      </span>
                      <button
                        onClick={() => removeFromCart(c.id)}
                        className="rounded p-1 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-widest text-rose mb-2">
                    Forma de pagamento
                  </p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {PAY_METHODS.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => setPayment(m.key)}
                        className={`rounded-xl border px-2 py-2 text-[11px] ${
                          payment === m.key
                            ? "border-rose bg-blush/60 text-mauve font-medium"
                            : "border-border bg-card text-muted-foreground hover:border-rose/40"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-rose">
                    <BadgePercent className="h-3 w-3" /> Cupom de desconto
                  </p>
                  <div className="flex items-center gap-1.5">
                    {[0, 5, 10, 15, 20].map((p) => (
                      <button
                        key={p}
                        onClick={() => setDiscountPct(p)}
                        className={`flex-1 rounded-lg border px-1 py-1.5 text-[11px] ${discountPct === p ? "border-rose bg-blush/60 text-mauve font-medium" : "border-border bg-card text-muted-foreground"}`}
                      >
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
                    <span className="font-display text-3xl italic text-mauve">
                      {fmtBRL(cartFinal)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={checkout}
                  className="mt-4 w-full rounded-xl bg-mauve px-4 py-3 text-sm font-medium text-cream hover:opacity-90"
                >
                  Cobrar e finalizar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showManage && shopId && (
        <ManageProductsSheet
          shopId={shopId}
          products={products}
          onClose={() => setShowManage(false)}
          onChange={setProducts}
        />
      )}

      {showAdd && shopId && (
        <AddProductModal
          shopId={shopId}
          mode={usingEvent ? "event" : "shop"}
          eventId={selectedEventId}
          eventName={selectedEvent?.name}
          existingPdvCount={products.length}
          existingEventCount={eventProducts.length}
          onClose={() => setShowAdd(false)}
          onAddedShop={(p) => setProducts((prev) => [...prev, p])}
          onAddedEvent={(p) => setEventProducts((prev) => [...prev, p])}
        />
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
            <span className="text-sm font-semibold tabular-nums">{fmtBRL(cartFinal)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {showHotkeys && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-mauve/40 p-4 backdrop-blur-sm"
          onClick={() => setShowHotkeys(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-petal"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl italic text-mauve">Atalhos do PDV</h3>
              <button
                onClick={() => setShowHotkeys(false)}
                className="rounded-lg p-1.5 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
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
                <li
                  key={k}
                  className="flex items-center justify-between rounded-lg bg-blush/30 px-3 py-1.5"
                >
                  <span>{l}</span>
                  <kbd className="rounded-md border border-border bg-card px-2 py-0.5 text-xs font-mono text-mauve">
                    {k}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <ConfirmDialog config={confirmCfg} onClose={() => setConfirmCfg(null)} />
    </PageContainer>
  );
}

// ManageProductsSheet e AddProductModal foram extraídos para src/routes/-pdv/
