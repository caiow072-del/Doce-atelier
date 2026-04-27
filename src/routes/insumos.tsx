import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Package, Plus, Pencil, Trash2, Save, X, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { formatBRL } from "@/lib/store";

export const Route = createFileRoute("/insumos")({
  head: () => ({
    meta: [
      { title: "Insumos — Cakes Manager" },
      { name: "description", content: "Gerencie os insumos da sua confeitaria." },
    ],
  }),
  component: InsumosPage,
});

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  package_qty: number;
  price_paid: number;
  stock_qty: number;
  shop_id: string;
};

const UNITS = ["g", "kg", "ml", "L", "un"] as const;

function InsumosPage() {
  const { currentShop } = useAuth();
  const shopId = currentShop?.shop_id;

  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("ingredients")
      .select("*")
      .eq("shop_id", shopId)
      .order("name");
    if (error) {
      toast.error("Erro ao carregar insumos: " + error.message);
    } else {
      setItems((data ?? []) as Ingredient[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  const remove = async (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"?`)) return;
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir: " + error.message);
    } else {
      toast.success("Insumo excluído");
      setItems((s) => s.filter((x) => x.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Estoque"
        title="Insumos"
        subtitle="Cadastre seus ingredientes para que o sistema calcule o custo de cada receita."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar insumo..."
            className="w-full rounded-2xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-mauve outline-none focus:border-rose"
          />
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-mauve px-4 py-2.5 text-sm font-medium text-cream hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo insumo
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-mauve">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card-soft hidden overflow-hidden lg:block">
            <table className="w-full text-sm">
              <thead className="bg-blush/30 text-left text-[11px] uppercase tracking-widest text-mauve">
                <tr>
                  <th className="px-5 py-3">Nome</th>
                  <th className="px-5 py-3">Embalagem</th>
                  <th className="px-5 py-3">Preço pago</th>
                  <th className="px-5 py-3">Custo / unidade</th>
                  <th className="px-5 py-3">Estoque</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((i) => {
                  const unitCost = i.package_qty > 0 ? i.price_paid / i.package_qty : 0;
                  return (
                    <tr key={i.id} className="text-mauve">
                      <td className="px-5 py-3 font-medium">{i.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {i.package_qty} {i.unit}
                      </td>
                      <td className="px-5 py-3">{formatBRL(i.price_paid)}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatBRL(unitCost)}/{i.unit}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {i.stock_qty} {i.unit}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setEditing(i)}
                            className="rounded-lg p-1.5 text-mauve hover:bg-blush/50"
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => remove(i.id, i.name)}
                            className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((i) => {
              const unitCost = i.package_qty > 0 ? i.price_paid / i.package_qty : 0;
              return (
                <div key={i.id} className="card-soft p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-mauve">{i.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {i.package_qty} {i.unit} · {formatBRL(i.price_paid)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => setEditing(i)}
                        className="rounded-lg bg-blush/40 p-2 text-mauve"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(i.id, i.name)}
                        className="rounded-lg bg-destructive/10 p-2 text-destructive"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-blush/30 px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-rose">Custo unit.</p>
                      <p className="text-mauve">{formatBRL(unitCost)}/{i.unit}</p>
                    </div>
                    <div className="rounded-lg bg-blush/30 px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-rose">Estoque</p>
                      <p className="text-mauve">{i.stock_qty} {i.unit}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {(creating || editing) && shopId && (
        <IngredientForm
          shopId={shopId}
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(saved) => {
            setItems((s) => {
              const exists = s.find((x) => x.id === saved.id);
              if (exists) return s.map((x) => (x.id === saved.id ? saved : x)).sort((a, b) => a.name.localeCompare(b.name));
              return [...s, saved].sort((a, b) => a.name.localeCompare(b.name));
            });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid place-items-center rounded-3xl border-2 border-dashed border-border bg-card/40 p-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blush/60">
        <Package className="h-7 w-7 text-mauve" strokeWidth={1.4} />
      </div>
      <h2 className="mt-4 font-display text-2xl italic text-mauve">Nenhum insumo ainda</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Comece adicionando seus ingredientes (leite condensado, farinha, bombom...) com o preço pago.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-mauve px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Cadastrar primeiro insumo
      </button>
    </div>
  );
}

function IngredientForm({
  shopId,
  initial,
  onClose,
  onSaved,
}: {
  shopId: string;
  initial: Ingredient | null;
  onClose: () => void;
  onSaved: (i: Ingredient) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState<string>(initial?.unit ?? "g");
  const [packageQty, setPackageQty] = useState(initial?.package_qty?.toString() ?? "");
  const [pricePaid, setPricePaid] = useState(initial?.price_paid?.toString() ?? "");
  const [stockQty, setStockQty] = useState(initial?.stock_qty?.toString() ?? "0");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !packageQty || !pricePaid) {
      toast.error("Preencha nome, embalagem e preço");
      return;
    }
    setSaving(true);
    const payload = {
      shop_id: shopId,
      name: name.trim(),
      unit,
      package_qty: Number(packageQty),
      price_paid: Number(pricePaid),
      stock_qty: Number(stockQty || 0),
    };
    if (initial) {
      const { data, error } = await supabase
        .from("ingredients")
        .update(payload)
        .eq("id", initial.id)
        .select()
        .single();
      if (error) {
        toast.error("Erro ao salvar: " + error.message);
      } else {
        toast.success("Insumo atualizado");
        onSaved(data as Ingredient);
      }
    } else {
      const { data, error } = await supabase
        .from("ingredients")
        .insert(payload)
        .select()
        .single();
      if (error) {
        toast.error("Erro ao criar: " + error.message);
      } else {
        toast.success("Insumo cadastrado");
        onSaved(data as Ingredient);
      }
    }
    setSaving(false);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-mauve/30 backdrop-blur-sm sm:items-center"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg rounded-t-3xl bg-card p-6 pb-10 sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">
            {initial ? "Editar insumo" : "Novo insumo"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-rose">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Leite Condensado"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-mauve outline-none focus:border-rose"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Quantidade da embalagem</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={packageQty}
                onChange={(e) => setPackageQty(e.target.value)}
                placeholder="395"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-mauve outline-none focus:border-rose"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Unidade</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-mauve outline-none focus:border-rose"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Preço pago (R$)</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={pricePaid}
                onChange={(e) => setPricePaid(e.target.value)}
                placeholder="6.50"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-mauve outline-none focus:border-rose"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Estoque atual</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-mauve outline-none focus:border-rose"
              />
            </div>
          </div>

          {packageQty && pricePaid && Number(packageQty) > 0 && (
            <div className="rounded-xl bg-blush/40 px-3 py-2 text-xs text-mauve">
              Custo por {unit}:{" "}
              <span className="font-semibold">
                {formatBRL(Number(pricePaid) / Number(packageQty))}
              </span>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-mauve py-3.5 text-sm font-semibold text-cream disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {initial ? "Salvar alterações" : "Cadastrar insumo"}
        </button>
      </form>
    </div>
  );
}
