import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardList, Plus, Phone, Calendar as CalIcon, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";

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

type Order = {
  id: string;
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

function EncomendasPage() {
  const { currentShop } = useAuth();
  const shopId = currentShop?.shop_id;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<"todos" | "ativos" | OrderStatus>("ativos");

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    supabase
      .from("orders")
      .select("*")
      .eq("shop_id", shopId)
      .order("delivery_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error("Erro ao carregar encomendas");
        setOrders((data ?? []) as Order[]);
        setLoading(false);
      });
  }, [shopId]);

  const visible = orders.filter((o) => {
    if (filter === "todos") return true;
    if (filter === "ativos") return !["entregue", "cancelado"].includes(o.status);
    return o.status === filter;
  });

  const updateStatus = async (id: string, status: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) return toast.error("Erro ao atualizar");
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta encomenda?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Pedidos personalizados" title="Encomendas" subtitle="Bolos sob medida, com cliente e entrega." />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(["ativos", "orcamento", "confirmado", "produzindo", "pronto", "entregue", "todos"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f ? "bg-mauve text-cream" : "bg-card text-muted-foreground hover:bg-blush/40"
              }`}
            >
              {f === "ativos" ? "Ativos" : f === "todos" ? "Todos" : statusLabel[f as OrderStatus]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-3 py-2 text-sm font-medium text-cream hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nova encomenda
        </button>
      </div>

      {loading ? (
        <div className="card-soft p-10 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : visible.length === 0 ? (
        <div className="card-soft p-10 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-rose" strokeWidth={1.4} />
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma encomenda neste filtro.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((o) => {
            const remaining = o.total_price - o.deposit_paid;
            return (
              <div key={o.id} className="card-soft p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-lg italic text-mauve truncate">{o.customer_name}</p>
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
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalIcon className="h-3 w-3" /> Entrega: {fmtDate(o.delivery_at)}
                </p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="text-mauve font-semibold">{fmtBRL(o.total_price)}</p>
                    {o.deposit_paid > 0 && (
                      <p className={`text-[11px] ${remaining > 0 ? "text-muted-foreground" : "text-success"}`}>
                        Falta {fmtBRL(remaining)}
                      </p>
                    )}
                  </div>
                  <select
                    value={o.status}
                    onChange={(e) => updateStatus(o.id, e.target.value as OrderStatus)}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  >
                    {(Object.keys(statusLabel) as OrderStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {statusLabel[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => remove(o.id)}
                    className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && shopId && (
        <NewOrderSheet
          shopId={shopId}
          onClose={() => setShowNew(false)}
          onCreated={(o) => {
            setOrders((prev) => [...prev, o].sort((a, b) => a.delivery_at.localeCompare(b.delivery_at)));
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}

function NewOrderSheet({
  shopId,
  onClose,
  onCreated,
}: {
  shopId: string;
  onClose: () => void;
  onCreated: (o: Order) => void;
}) {
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    description: "",
    servings: "",
    delivery_at: "",
    delivery_address: "",
    total_price: "",
    deposit_paid: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name || !form.description || !form.delivery_at) {
      return toast.error("Preencha cliente, descrição e data de entrega");
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("orders")
      .insert({
        shop_id: shopId,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || null,
        description: form.description,
        servings: form.servings ? Number(form.servings) : null,
        delivery_at: new Date(form.delivery_at).toISOString(),
        delivery_address: form.delivery_address || null,
        total_price: Number(form.total_price) || 0,
        deposit_paid: Number(form.deposit_paid) || 0,
        notes: form.notes || null,
      })
      .select("*")
      .single();
    setSaving(false);
    if (error) return toast.error("Erro ao criar encomenda");
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
        <div className="mt-4 space-y-3">
          {[
            { k: "customer_name", l: "Cliente *", t: "text" },
            { k: "customer_phone", l: "WhatsApp / telefone", t: "tel" },
            { k: "description", l: "Descrição do bolo *", t: "textarea" },
            { k: "servings", l: "Fatias (opcional)", t: "number" },
            { k: "delivery_at", l: "Data e hora de entrega *", t: "datetime-local" },
            { k: "delivery_address", l: "Endereço de entrega", t: "text" },
            { k: "total_price", l: "Valor total (R$)", t: "number" },
            { k: "deposit_paid", l: "Sinal já pago (R$)", t: "number" },
            { k: "notes", l: "Observações", t: "textarea" },
          ].map((f) => (
            <div key={f.k}>
              <label className="text-[10px] uppercase tracking-widest text-rose">{f.l}</label>
              {f.t === "textarea" ? (
                <textarea
                  value={(form as Record<string, string>)[f.k]}
                  onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
                  rows={2}
                  className="input-base mt-1"
                />
              ) : (
                <input
                  type={f.t}
                  value={(form as Record<string, string>)[f.k]}
                  onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
                  className="input-base mt-1"
                />
              )}
            </div>
          ))}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-mauve px-4 py-3 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar encomenda"}
        </button>
      </form>
    </div>
  );
}
