import { createFileRoute } from "@tanstack/react-router";
import { ConfirmDialog, type ConfirmConfig } from "@/components/ConfirmDialog";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  ClipboardList,
  Plus,
  Phone,
  Calendar as CalIcon,
  Trash2,
  Save,
  X,
  Search,
  UserPlus,
  Users,
  MessageCircle,
  MapPin,
  Globe,
  Package,
  Truck,
  Check,
  Sparkles,
  MoreVertical,
  ChevronDown,
  Mic,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OrderItemsEditor, type OrderItem } from "./-encomendas/OrderItemsEditor";
import { parseNaturalOrder, parseNaturalOrderWithLLM, findCustomerMatch } from "@/lib/ai-order";

export const Route = createFileRoute("/encomendas")({
  head: () => ({
    meta: [
      { title: "Encomendas — Cakes Manager" },
      { name: "description", content: "Gerencie pedidos personalizados de clientes." },
    ],
  }),
  component: EncomendasPage,
});

type OrderStatus = "orcamento" | "confirmado" | "produzindo" | "pronto" | "entregue" | "cancelado";

type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
};

type Order = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  description: string;
  servings: number | null;
  delivery_at: string;
  delivery_address: string | null;
  total_price: number;
  deposit_paid: number;
  status: OrderStatus;
  notes: string | null;
  source: "manual" | "storefront" | null;
  delivery_method: "pickup" | "delivery" | null;
  items: Array<{ name: string; qty: number; price: number }> | null;
  created_at: string;
};

const statusLabel: Record<OrderStatus, string> = {
  orcamento: "Orçamento",
  confirmado: "Confirmado",
  produzindo: "Produzindo",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const statusTone: Record<OrderStatus, string> = {
  orcamento: "bg-muted text-muted-foreground",
  confirmado: "bg-blush/60 text-mauve",
  produzindo: "bg-rose/40 text-mauve",
  pronto: "bg-sage/40 text-mauve",
  entregue: "bg-success/20 text-success",
  cancelado: "bg-destructive/15 text-destructive",
};

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const digits = (p: string) => p.replace(/\D/g, "");

function EncomendasPage() {
  const { currentShop } = useAuth();
  const shopId = currentShop?.shop_id;
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<"todos" | "ativos" | "vitrine" | OrderStatus>("ativos");
  const [confirmCfg, setConfirmCfg] = useState<ConfirmConfig | null>(null);
  const [showAI, setShowAI] = useState(false);

  const loadAll = async () => {
    if (!shopId) return;
    setLoading(true);
    const [oRes, cRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("shop_id", shopId)
        .order("delivery_at", { ascending: true }),
      supabase
        .from("customers")
        .select("id, name, phone, address")
        .eq("shop_id", shopId)
        .order("name"),
    ]);
    if (oRes.error) toast.error("Erro ao carregar encomendas");
    if (cRes.error) toast.error("Erro ao carregar clientes");
    setOrders((oRes.data ?? []) as Order[]);
    setCustomers((cRes.data ?? []) as Customer[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const visible = orders.filter((o) => {
    if (filter === "todos") return true;
    if (filter === "ativos") return !["entregue", "cancelado"].includes(o.status);
    if (filter === "vitrine") return o.source === "storefront";
    return o.status === filter;
  });

  const pendingStorefront = orders.filter(
    (o) => o.source === "storefront" && o.status === "orcamento",
  ).length;

  const updateStatus = async (id: string, status: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) return toast.error("Erro ao atualizar");
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  };

  const remove = (id: string) => {
    setConfirmCfg({
      title: "Excluir encomenda?",
      description: "Essa ação não pode ser desfeita. O pedido será removido permanentemente.",
      confirmLabel: "Excluir",
      variant: "destructive",
      action: async () => {
        const { error } = await supabase.from("orders").delete().eq("id", id);
        if (error) return toast.error("Erro ao excluir");
        setOrders((prev) => prev.filter((o) => o.id !== id));
        toast.success("Encomenda excluída");
      },
    });
  };

  return (
    <PageContainer width="default">
    <div className="space-y-6">
      <PageHeader eyebrow="Pedidos personalizados" title="Encomendas" subtitle="Bolos, tortas, salgados, kits e mais — tudo sob medida." />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Mobile: dropdown filter */}
        <div className="sm:hidden w-full">
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-full border-border bg-card text-sm text-mauve">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="vitrine">🌐 Vitrine{pendingStorefront > 0 ? ` (${pendingStorefront})` : ""}</SelectItem>
              <SelectItem value="orcamento">Orçamento</SelectItem>
              <SelectItem value="confirmado">Confirmado</SelectItem>
              <SelectItem value="produzindo">Produzindo</SelectItem>
              <SelectItem value="pronto">Pronto</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Desktop: pills */}
        <div className="hidden sm:flex flex-wrap gap-1.5">
          {(["ativos", "vitrine", "orcamento", "confirmado", "produzindo", "pronto", "entregue", "todos"] as const).map((f) => {
            const isVitrine = f === "vitrine";
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`relative inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f ? "bg-mauve text-cream" : "bg-card text-muted-foreground hover:bg-blush/40"
                }`}
              >
                {isVitrine && <Globe className="h-3 w-3" />}
                {f === "ativos" ? "Ativos" : f === "todos" ? "Todos" : isVitrine ? "Vitrine" : statusLabel[f as OrderStatus]}
                {isVitrine && pendingStorefront > 0 && (
                  <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose px-1 text-[10px] font-semibold text-mauve">
                    {pendingStorefront}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAI(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose/80 to-blush px-3 py-2 text-sm font-medium text-mauve hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" /> Assistente
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-3 py-2 text-sm font-medium text-cream hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nova
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card-soft p-10 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : visible.length === 0 ? (
        <div className="mx-auto max-w-md flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/60 bg-card/40 py-12 px-6 text-center mt-6">
          <ClipboardList className="mx-auto h-10 w-10 text-rose" strokeWidth={1.4} />
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma encomenda neste filtro.</p>
          {customers.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Dica: cadastre seus clientes primeiro em{" "}
              <Link to="/clientes" className="underline text-mauve">
                Clientes
              </Link>
              .
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((o) => {
            const remaining = o.total_price - o.deposit_paid;
            const wa = o.customer_phone ? digits(o.customer_phone) : "";
            const waLink = wa ? `https://wa.me/${wa.startsWith("55") ? wa : "55" + wa}` : null;
            const isStorefront = o.source === "storefront";
            const needsApproval = isStorefront && o.status === "orcamento";
            return (
              <div
                key={o.id}
                className={`card-soft p-4 ${needsApproval ? "ring-2 ring-rose/60 ring-offset-2 ring-offset-cream" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-display text-lg italic text-mauve truncate">{o.customer_name}</p>
                      {isStorefront && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-rose/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-mauve">
                          <Globe className="h-2.5 w-2.5" /> Vitrine
                        </span>
                      )}
                    </div>
                    {o.customer_phone && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Phone className="h-3 w-3" /> {o.customer_phone}
                      </p>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusTone[o.status]}`}>
                    {statusLabel[o.status]}
                  </span>
                </div>
                <p className="mt-2 text-sm text-mauve">{o.description}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalIcon className="h-3 w-3" /> {fmtDate(o.delivery_at)}
                  </span>
                  {o.delivery_method && (
                    <span className="inline-flex items-center gap-1">
                      {o.delivery_method === "delivery" ? <Truck className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                      {o.delivery_method === "delivery" ? "Entrega" : "Retirada"}
                    </span>
                  )}
                </div>
                {o.delivery_address && (
                  <p className="mt-0.5 inline-flex items-start gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3" /> {o.delivery_address}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="text-mauve font-semibold">{fmtBRL(o.total_price)}</p>
                    {o.deposit_paid > 0 && (
                      <p className={`text-[11px] ${remaining > 0 ? "text-muted-foreground" : "text-success"}`}>
                        Falta {fmtBRL(remaining)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {needsApproval && (
                      <button
                        onClick={() => updateStatus(o.id, "confirmado")}
                        className="inline-flex items-center gap-1 rounded-lg bg-success/15 px-2 py-1.5 text-xs font-medium text-success hover:bg-success/25"
                      >
                        <Check className="h-3.5 w-3.5" /> Aceitar
                      </button>
                    )}
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-success/15 p-1.5 text-success hover:bg-success/25"
                        aria-label="WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-blush/40" aria-label="Ações">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-1.5" align="end">
                        <p className="px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">Status</p>
                        {(Object.keys(statusLabel) as OrderStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => updateStatus(o.id, s)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left transition ${o.status === s ? "bg-blush/40 font-medium text-mauve" : "text-muted-foreground hover:bg-blush/20 hover:text-mauve"}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${statusTone[s].split(" ")[0]}`} />
                            {statusLabel[s]}
                          </button>
                        ))}
                        <div className="my-1 h-px bg-border/60" />
                        <button
                          onClick={() => remove(o.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && shopId && (
        <NewOrderSheet
          shopId={shopId}
          customers={customers}
          onClose={() => setShowNew(false)}
          onCustomerCreated={(c) => setCustomers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
          onCreated={(o) => {
            setOrders((prev) => [...prev, o].sort((a, b) => a.delivery_at.localeCompare(b.delivery_at)));
            setShowNew(false);
          }}
        />
      )}
      {showAI && shopId && (
        <AIAssistantModal
          shopId={shopId}
          customers={customers}
          onClose={() => setShowAI(false)}
          onCustomerCreated={(c) => setCustomers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
          onCreated={(o) => {
            setOrders((prev) => [...prev, o].sort((a, b) => a.delivery_at.localeCompare(b.delivery_at)));
            setShowAI(false);
          }}
        />
      )}

      <ConfirmDialog config={confirmCfg} onClose={() => setConfirmCfg(null)} />
    </div>
    </PageContainer>
  );
}

function NewOrderSheet({
  shopId,
  customers,
  onClose,
  onCreated,
  onCustomerCreated,
}: {
  shopId: string;
  customers: Customer[];
  onClose: () => void;
  onCreated: (o: Order) => void;
  onCustomerCreated: (c: Customer) => void;
}) {
  const [selected, setSelected] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [showQuickNew, setShowQuickNew] = useState(false);

  // dados do bolo / entrega
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("");
  const [deliveryAt, setDeliveryAt] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [depositPaid, setDepositPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q))
      .slice(0, 8);
  }, [customers, search]);

  const pickCustomer = (c: Customer) => {
    setSelected(c);
    setSearch("");
    if (!deliveryAddress) setDeliveryAddress(c.address);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return toast.error("Selecione ou cadastre um cliente");
    if (!description.trim()) return toast.error("Descreva o bolo / pedido");
    if (!deliveryAt) return toast.error("Informe a data de entrega");

    setSaving(true);
    const { data, error } = await supabase
      .from("orders")
      .insert({
        shop_id: shopId,
        customer_id: selected.id,
        customer_name: selected.name,
        customer_phone: selected.phone,
        description: description.trim(),
        servings: servings ? Number(servings) : null,
        delivery_at: new Date(deliveryAt).toISOString(),
        delivery_address: deliveryAddress.trim() || selected.address || null,
        total_price: Number(totalPrice) || 0,
        deposit_paid: Number(depositPaid) || 0,
        notes: notes.trim() || null,
      })
      .select("*")
      .single();
    setSaving(false);
    if (error) return toast.error("Erro ao criar encomenda: " + error.message);
    toast.success("Encomenda criada");
    onCreated(data as Order);
  };

  return (
    <div className="fixed inset-0 z-50 bg-mauve/40 backdrop-blur-sm" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-petal"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">Nova encomenda</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* SEÇÃO 1: Cliente */}
        <section className="mt-5 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-rose">Cliente *</p>

          {selected ? (
            <div className="flex items-start justify-between gap-2 rounded-xl bg-blush/40 p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-mauve truncate">{selected.name}</p>
                <p className="text-[11px] text-muted-foreground">{selected.phone}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-1">{selected.address}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-card"
                aria-label="Trocar cliente"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    customers.length === 0
                      ? "Nenhum cliente — cadastre abaixo ↓"
                      : "Buscar cliente por nome ou telefone..."
                  }
                  className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm text-mauve outline-none focus:border-rose"
                />
              </div>
              {filteredCustomers.length > 0 && (
                <ul className="overflow-hidden rounded-xl border border-border bg-background">
                  {filteredCustomers.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => pickCustomer(c)}
                        className="block w-full px-3 py-2 text-left text-sm text-mauve hover:bg-blush/40"
                      >
                        <span className="font-medium">{c.name}</span>{" "}
                        <span className="text-[11px] text-muted-foreground">· {c.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => setShowQuickNew(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-mauve/10 px-3 py-2 text-xs font-medium text-mauve hover:bg-mauve/20"
              >
                <UserPlus className="h-3.5 w-3.5" /> Cadastrar novo cliente
              </button>
              {customers.length > 0 && (
                <Link
                  to="/clientes"
                  className="ml-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground underline"
                >
                  <Users className="h-3 w-3" /> ver todos
                </Link>
              )}
            </>
          )}
        </section>

        {/* SEÇÃO 2: Pedido */}
        <section className="mt-5 space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-rose">Pedido</p>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-rose">Descrição do pedido *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              className="input-base mt-1"
              placeholder="Ex: Bolo de ninho 3kg decorado, 50 coxinhas, Kit festa..."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Quantidade</label>
              <input
                type="number"
                inputMode="numeric"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="input-base mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Entrega *</label>
              <input
                type="datetime-local"
                value={deliveryAt}
                onChange={(e) => setDeliveryAt(e.target.value)}
                className="input-base mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-rose">
              Endereço de entrega
            </label>
            <textarea
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              rows={2}
              maxLength={255}
              placeholder={selected ? "Padrão: endereço do cliente" : ""}
              className="input-base mt-1 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Valor total</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                className="input-base mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Sinal pago</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={depositPaid}
                onChange={(e) => setDepositPaid(e.target.value)}
                className="input-base mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-rose">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              className="input-base mt-1 resize-none"
            />
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-mauve px-4 py-3 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar encomenda"}
        </button>

        {showQuickNew && (
          <QuickNewCustomer
            shopId={shopId}
            onClose={() => setShowQuickNew(false)}
            onCreated={(c) => {
              onCustomerCreated(c);
              pickCustomer(c);
              setShowQuickNew(false);
            }}
          />
        )}
      </form>
    </div>
  );
}

function QuickNewCustomer({
  shopId,
  onClose,
  onCreated,
}: {
  shopId: string;
  onClose: () => void;
  onCreated: (c: Customer) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (name.trim().length < 2) return toast.error("Nome muito curto");
    if (digits(phone).length < 8) return toast.error("Telefone inválido");
    if (address.trim().length < 3) return toast.error("Endereço muito curto");
    setSaving(true);
    const { data, error } = await supabase
      .from("customers")
      .insert({
        shop_id: shopId,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      })
      .select("id, name, phone, address")
      .single();
    setSaving(false);
    if (error) {
      if (error.code === "23505") toast.error("Já existe um cliente com esse telefone");
      else toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Cliente cadastrado");
    onCreated(data as Customer);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-mauve/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-card p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl italic text-mauve">Novo cliente</h3>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 space-y-2">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-rose">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="input-base mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-rose">WhatsApp</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              placeholder="(00) 00000-0000"
              className="input-base mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-rose">Endereço</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              maxLength={255}
              className="input-base mt-1 resize-none"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-mauve py-2.5 text-sm font-medium text-cream disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Cadastrar e usar"}
        </button>
      </div>
    </div>
  );
}

// ─── Chat types ───────────────────────────────────────────────────────────────
type ChatMsg = { role: "user" | "model"; text: string };

interface OrderReady {
  customerName: string | null;
  deliveryDate: string | null;
  description: string;
  items: { name: string; qty: number; price: number }[];
  totalPrice: number;
  depositPaid: number;
  notes: string | null;
  newCustomerPhone?: string | null;
}

const ORDER_TAG = "[ORDER_READY]";

async function sendToGemini(history: ChatMsg[], customers: Customer[]): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return "⚠️ Chave do Gemini não configurada.";

  const today = new Date().toLocaleString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  const systemPrompt = `Você é a Doce IA, assistente de confeitaria da Doce Atelier. Ajude a registrar encomendas conversando naturalmente em português.

Data de hoje: ${today}

Clientes cadastrados:
${customers.map(c => `- ${c.name} (tel: ${c.phone})`).join("\n") || "Nenhum cliente cadastrado ainda."}

INSTRUÇÕES:
1. Converse de forma natural e simpática para coletar: nome do cliente, data e hora de entrega, itens com sabor/recheio completo (ex: "Bolo de massa branca com recheio de ninho e amendoim crocante"), valor total e valor de sinal/depósito já pago (pode ser zero).
2. Se o cliente não estiver na lista acima, pergunte o telefone para cadastrá-lo.
3. Se faltar informação importante, pergunte de forma direta.
4. Quando tiver tudo, mostre um resumo e pergunte se confirma.
5. Ao confirmar, responda com o resumo e NO FINAL da mensagem coloque EXATAMENTE o bloco JSON abaixo (nada depois dele):

${ORDER_TAG}
{
  "customerName": "Nome exato como está na lista ou nome novo",
  "deliveryDate": "2024-05-10T10:00:00Z",
  "description": "Resumo formatado bonito da encomenda",
  "items": [{"name": "Bolo de massa branca com ninho e amendoim crocante", "qty": 1, "price": 150}],
  "totalPrice": 150,
  "depositPaid": 50,
  "notes": null,
  "newCustomerPhone": null
}

ATENÇÃO: Só coloque o ${ORDER_TAG} quando o usuário confirmar. Nunca truncar o JSON.`;

  const contents = [
    { role: "user", parts: [{ text: systemPrompt + "\n\n(Aguarde a primeira mensagem do atendente)" }] },
    { role: "model", parts: [{ text: "Olá! 🎂 Sou a Doce IA! Me conte sobre a encomenda — pode falar o nome do cliente, o que deseja e para quando." }] },
    ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("Gemini error:", err);
    return `Erro ao contactar a IA: ${(err as any)?.error?.message ?? res.statusText}`;
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Resposta vazia da IA.";
}

// ─── Component ────────────────────────────────────────────────────────────────
function AIAssistantModal({
  shopId,
  customers,
  onClose,
  onCreated,
  onCustomerCreated,
}: {
  shopId: string;
  customers: Customer[];
  onClose: () => void;
  onCreated: (o: Order) => void;
  onCustomerCreated: (c: Customer) => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "model", text: "Olá! 🎂 Sou a Doce IA! Me conte sobre a encomenda — pode falar o nome do cliente, o que deseja e para quando." },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [orderReady, setOrderReady] = useState<OrderReady | null>(null);
  const [saving, setSaving] = useState(false);
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null);
  const [quickPhone, setQuickPhone] = useState("");
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // When orderReady is set, try to match customer
  useEffect(() => {
    if (!orderReady) return;
    if (orderReady.customerName) {
      const exact = customers.find(
        c => c.name.toLowerCase() === orderReady.customerName!.toLowerCase()
      );
      const partial = customers.find(
        c => c.name.toLowerCase().startsWith(orderReady.customerName!.split(" ")[0].toLowerCase())
      );
      const match = exact ?? partial ?? null;
      setMatchedCustomer(match);
      if (!match && orderReady.newCustomerPhone) {
        setQuickPhone(orderReady.newCustomerPhone);
      }
      if (!match) setShowPhoneInput(true);
    }
  }, [orderReady, customers]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMsg = { role: "user", text: text.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setIsThinking(true);

    try {
      // Only pass actual conversation (skip the initial greeting)
      const historyToSend = newHistory.filter(m => !(m.role === "model" && m === messages[0]));
      const reply = await sendToGemini(historyToSend, customers);

      // Check for ORDER_READY tag
      const tagIdx = reply.indexOf(ORDER_TAG);
      if (tagIdx !== -1) {
        const textPart = reply.slice(0, tagIdx).trim();
        const jsonPart = reply.slice(tagIdx + ORDER_TAG.length).trim();
        try {
          const parsed: OrderReady = JSON.parse(jsonPart);
          setOrderReady(parsed);
          setMessages(prev => [...prev, { role: "model", text: textPart || "✅ Perfeito! Revise os detalhes abaixo e confirme." }]);
        } catch {
          setMessages(prev => [...prev, { role: "model", text: reply }]);
        }
      } else {
        setMessages(prev => [...prev, { role: "model", text: reply }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "model", text: "Erro ao contactar a IA. Tente novamente." }]);
    }
    setIsThinking(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return toast.error("Navegador não suporta voz. Use o Chrome.");
    if (!window.isSecureContext) return toast.error("Microfone requer HTTPS.");
    if (window.self !== window.top) return toast.error("Microfone bloqueado em iframe.");

    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = () => setIsRecording(true);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => (prev ? prev + " " + transcript : transcript));
    };
    rec.onerror = (e: any) => {
      setIsRecording(false);
      if (e.error === "no-speech") toast.error("Nada foi ouvido. Tente falar novamente.");
      else if (e.error !== "aborted") toast.error("Erro de voz: " + e.error);
    };
    rec.onend = () => setIsRecording(false);
    rec.start();
  };

  const createCustomerAndSubmit = async () => {
    if (!orderReady) return;
    if (!orderReady.customerName) return toast.error("Nome do cliente não identificado.");
    const phone = quickPhone.replace(/\D/g, "");
    if (phone.length < 8) return toast.error("Informe um WhatsApp válido.");
    setSaving(true);
    const { data, error } = await supabase
      .from("customers")
      .insert({ shop_id: shopId, name: orderReady.customerName.trim(), phone: quickPhone.trim(), address: "" })
      .select("id, name, phone, address")
      .single();
    if (error) { setSaving(false); return toast.error("Erro ao criar cliente: " + error.message); }
    const c = data as Customer;
    onCustomerCreated(c);
    setMatchedCustomer(c);
    setShowPhoneInput(false);
    await submitOrder(c);
  };

  const submitOrder = async (customer: Customer) => {
    if (!orderReady) return;
    if (!orderReady.deliveryDate) return toast.error("Data de entrega inválida.");
    setSaving(true);
    const { data, error } = await supabase
      .from("orders")
      .insert({
        shop_id: shopId,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        description: orderReady.description,
        delivery_at: orderReady.deliveryDate,
        delivery_address: customer.address || null,
        total_price: orderReady.totalPrice ?? 0,
        deposit_paid: orderReady.depositPaid ?? 0,
        items: orderReady.items?.filter(i => i.name.trim()) ?? [],
        notes: orderReady.notes ?? null,
      })
      .select("*")
      .single();
    setSaving(false);
    if (error) return toast.error("Erro ao criar: " + error.message);
    toast.success("Encomenda criada pela Doce IA! ✨");
    onCreated(data as Order);
  };

  const handleSubmit = async () => {
    if (!orderReady) return;
    if (matchedCustomer) {
      await submitOrder(matchedCustomer);
    } else {
      setShowPhoneInput(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-mauve/40 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-card shadow-petal"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-rose" />
            <h2 className="font-display text-xl italic text-mauve">Doce IA</h2>
            <span className="rounded-full bg-blush/60 px-2 py-0.5 text-[10px] font-medium text-mauve">Chat</span>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-blush/30">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 p-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-mauve text-cream rounded-br-sm"
                  : "bg-blush/50 text-mauve rounded-bl-sm"
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-blush/50 px-4 py-3">
                <span className="h-1.5 w-1.5 rounded-full bg-mauve/50 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-mauve/50 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-mauve/50 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {/* Order confirmation card */}
          {orderReady && (
            <div className="rounded-2xl border-2 border-rose/30 bg-background/60 p-4 space-y-3 mt-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-rose">📋 Encomenda pronta para criar</p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-medium text-mauve">{matchedCustomer?.name ?? orderReady.customerName ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entrega</span>
                  <span className="font-medium text-mauve">
                    {orderReady.deliveryDate
                      ? new Date(orderReady.deliveryDate).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium text-mauve">{fmtBRL(orderReady.totalPrice ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sinal pago</span>
                  <span className="font-medium text-mauve">{fmtBRL(orderReady.depositPaid ?? 0)}</span>
                </div>
                <div className="pt-1 border-t border-border">
                  {orderReady.items?.map((it, i) => (
                    <div key={i} className="flex items-center gap-2 py-0.5">
                      <span className="grid h-5 w-5 place-items-center rounded-md bg-blush/60 text-[10px] font-bold text-mauve">{it.qty}</span>
                      <span className="text-mauve">{it.name}</span>
                      {it.price > 0 && <span className="ml-auto text-muted-foreground text-xs">{fmtBRL(it.price)}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {showPhoneInput && !matchedCustomer && (
                <div className="space-y-2 rounded-xl border border-border bg-blush/20 p-3">
                  <p className="text-xs text-warning font-medium">
                    "{orderReady.customerName}" não está cadastrado. Informe o WhatsApp para cadastrar:
                  </p>
                  <input
                    value={quickPhone}
                    onChange={e => setQuickPhone(e.target.value)}
                    className="input-base text-xs w-full"
                    placeholder="WhatsApp"
                    type="tel"
                  />
                  <button
                    onClick={createCustomerAndSubmit}
                    disabled={saving}
                    className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-mauve py-2 text-xs font-medium text-cream disabled:opacity-60"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> {saving ? "Criando..." : "Cadastrar e criar encomenda"}
                  </button>
                </div>
              )}

              {!showPhoneInput && (
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-mauve py-3 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" /> {saving ? "Criando..." : "✅ Criar encomenda"}
                </button>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        {!orderReady && (
          <div className="border-t border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleRecording}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all ${
                  isRecording ? "bg-rose animate-pulse text-white" : "bg-blush/60 text-rose hover:bg-rose hover:text-white"
                }`}
                title="Falar"
              >
                <Mic className="h-4 w-4" />
              </button>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                className="input-base flex-1 py-2 text-sm"
                placeholder={isRecording ? "Ouvindo..." : "Escreva ou fale sua mensagem..."}
                disabled={isThinking}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isThinking}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mauve text-cream hover:opacity-90 disabled:opacity-40 transition-all"
              >
                {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-base">↑</span>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

