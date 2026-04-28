import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Package, Plus, Pencil, Trash2, Save, X, Loader2, Search, Sparkles, Check, AlertTriangle, LayoutGrid, List } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { formatBRL } from "@/lib/store";
import { SUGGESTED_INGREDIENTS, type SuggestedIngredient } from "@/lib/suggestions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [toDelete, setToDelete] = useState<Ingredient | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("ingredients").delete().eq("id", toDelete.id);
    setDeleting(false);
    if (error) {
      toast.error("Não foi possível excluir: " + error.message);
    } else {
      toast.success("Insumo excluído");
      setItems((s) => s.filter((x) => x.id !== toDelete.id));
      setToDelete(null);
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
        <div className="flex gap-2">
          <button
            onClick={() => setShowSuggestions(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose/40 bg-blush/30 px-3 py-2.5 text-sm font-medium text-mauve hover:bg-blush/50"
          >
            <Sparkles className="h-4 w-4" /> Sugestões
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-mauve px-4 py-2.5 text-sm font-medium text-cream hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Novo insumo
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-mauve">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          onCreate={() => setCreating(true)}
          onShowSuggestions={() => setShowSuggestions(true)}
        />
      ) : (
        <>
          {/* Desktop table — compact */}
          <div className="card-soft hidden overflow-hidden lg:block">
            <table className="w-full text-[13px]">
              <thead className="bg-blush/30 text-left text-[10px] uppercase tracking-widest text-mauve">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Embalagem</th>
                  <th className="px-3 py-2">Preço</th>
                  <th className="px-3 py-2">Custo / un.</th>
                  <th className="px-3 py-2">Estoque</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((i) => {
                  const unitCost = i.package_qty > 0 ? i.price_paid / i.package_qty : 0;
                  const low = i.stock_qty <= 0;
                  return (
                    <tr key={i.id} className="text-mauve hover:bg-blush/15">
                      <td className="px-3 py-1.5 font-medium">{i.name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                        {i.package_qty} {i.unit}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums">{formatBRL(i.price_paid)}</td>
                      <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                        {formatBRL(unitCost)}/{i.unit}
                      </td>
                      <td className={`px-3 py-1.5 tabular-nums ${low ? "text-destructive" : "text-muted-foreground"}`}>
                        {i.stock_qty} {i.unit}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex justify-end gap-0.5">
                          <button
                            onClick={() => setEditing(i)}
                            className="rounded-md p-1 text-mauve hover:bg-blush/50"
                            aria-label="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setToDelete(i)}
                            className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet — compact rows */}
          <div className="card-soft divide-y divide-border/60 overflow-hidden lg:hidden">
            {filtered.map((i) => {
              const unitCost = i.package_qty > 0 ? i.price_paid / i.package_qty : 0;
              const low = i.stock_qty <= 0;
              return (
                <div key={i.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-mauve">{i.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground tabular-nums">
                      {i.package_qty}{i.unit} · {formatBRL(i.price_paid)} · {formatBRL(unitCost)}/{i.unit}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] tabular-nums ${low ? "bg-destructive/10 text-destructive" : "bg-blush/40 text-mauve"}`}>
                    {i.stock_qty}{i.unit}
                  </span>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      onClick={() => setEditing(i)}
                      className="rounded-md p-1.5 text-mauve hover:bg-blush/50"
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setToDelete(i)}
                      className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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

      {showSuggestions && shopId && (
        <SuggestionsModal
          shopId={shopId}
          existingNames={items.map((i) => i.name.toLowerCase())}
          onClose={() => setShowSuggestions(false)}
          onImported={async () => {
            setShowSuggestions(false);
            await load();
          }}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">Excluir insumo?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Tem certeza que deseja excluir{" "}
              <span className="font-semibold text-foreground">{toDelete?.name}</span>?
              <br />
              Se ele estiver em alguma receita, será removido dela também. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({
  onCreate,
  onShowSuggestions,
}: {
  onCreate: () => void;
  onShowSuggestions: () => void;
}) {
  return (
    <div className="grid place-items-center rounded-3xl border-2 border-dashed border-border bg-card/40 p-12 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blush/60">
        <Package className="h-7 w-7 text-mauve" strokeWidth={1.4} />
      </div>
      <h2 className="mt-4 font-display text-2xl italic text-mauve">Nenhum insumo ainda</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Comece com nossas sugestões prontas (massa, ovos, leite, açúcar...) ou cadastre o seu.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          onClick={onShowSuggestions}
          className="inline-flex items-center gap-2 rounded-2xl border border-rose/50 bg-blush/40 px-5 py-2.5 text-sm font-medium text-mauve hover:bg-blush/60"
        >
          <Sparkles className="h-4 w-4" /> Ver sugestões prontas
        </button>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-2xl bg-mauve px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Cadastrar do zero
        </button>
      </div>
    </div>
  );
}

function SuggestionsModal({
  shopId,
  existingNames,
  onClose,
  onImported,
}: {
  shopId: string;
  existingNames: string[];
  onClose: () => void;
  onImported: () => void;
}) {
  const initialSelected = SUGGESTED_INGREDIENTS.filter(
    (s) => !existingNames.includes(s.name.toLowerCase())
  ).map((s) => s.key);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [overrides, setOverrides] = useState<Record<string, { price: string; package: string }>>(
    Object.fromEntries(
      SUGGESTED_INGREDIENTS.map((s) => [
        s.key,
        { price: s.price_paid.toString(), package: s.package_qty.toString() },
      ])
    )
  );
  const [saving, setSaving] = useState(false);

  const toggle = (k: string) =>
    setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const importSelected = async () => {
    if (selected.length === 0) {
      toast.error("Selecione pelo menos uma sugestão");
      return;
    }
    setSaving(true);
    const rows = SUGGESTED_INGREDIENTS.filter((s) => selected.includes(s.key)).map((s) => ({
      shop_id: shopId,
      name: s.name,
      unit: s.unit,
      package_qty: Number(overrides[s.key]?.package) || s.package_qty,
      price_paid: Number(overrides[s.key]?.price) || s.price_paid,
      stock_qty: 0,
    }));
    const { error } = await supabase.from("ingredients").insert(rows);
    setSaving(false);
    if (error) {
      toast.error("Erro ao importar: " + error.message);
      return;
    }
    toast.success(`${rows.length} insumo(s) adicionado(s)`);
    onImported();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-mauve/30 backdrop-blur-sm sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-card p-6 pb-10 sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-rose">Para começar rápido</p>
            <h2 className="font-display text-2xl italic text-mauve">Sugestões de insumos</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          Marque o que você usa, ajuste o preço se necessário, e adicione ao seu estoque.
        </p>

        <ul className="space-y-2">
          {SUGGESTED_INGREDIENTS.map((s) => {
            const checked = selected.includes(s.key);
            const ov = overrides[s.key];
            return (
              <li
                key={s.key}
                className={`rounded-2xl border p-3 transition-colors ${checked ? "border-rose/60 bg-blush/30" : "border-border bg-background"}`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(s.key)}
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${checked ? "border-mauve bg-mauve text-cream" : "border-border bg-card"}`}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-mauve">{s.name}</p>
                    {s.hint && <p className="text-[11px] text-muted-foreground">{s.hint}</p>}
                  </div>
                </label>
                {checked && (
                  <div className="mt-2 grid grid-cols-2 gap-2 pl-8">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-rose">Preço (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={ov.price}
                        onChange={(e) =>
                          setOverrides((o) => ({ ...o, [s.key]: { ...o[s.key], price: e.target.value } }))
                        }
                        className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-mauve outline-none focus:border-rose"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-rose">
                        Embalagem ({s.unit})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={ov.package}
                        onChange={(e) =>
                          setOverrides((o) => ({ ...o, [s.key]: { ...o[s.key], package: e.target.value } }))
                        }
                        className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-mauve outline-none focus:border-rose"
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <button
          onClick={importSelected}
          disabled={saving || selected.length === 0}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-mauve py-3.5 text-sm font-semibold text-cream disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Adicionar {selected.length} insumo(s)
        </button>
      </div>
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
