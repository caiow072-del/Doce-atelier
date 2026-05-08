import { type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";

export type OrderItem = { name: string; qty: number; price: number };

export function OrderItemsEditor({
  items,
  onChange,
}: {
  items: OrderItem[];
  onChange: (items: OrderItem[]) => void;
}) {
  const addItem = () => onChange([...items, { name: "", qty: 1, price: 0 }]);
  const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, patch: Partial<OrderItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const total = items.reduce((s, it) => s + it.qty * it.price, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-rose">Itens do pedido</p>
        {total > 0 && (
          <span className="text-xs font-medium text-mauve tabular-nums">
            Total: {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        )}
      </div>
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <input
            value={it.name}
            onChange={(e) => updateItem(i, { name: e.target.value })}
            placeholder="Ex: Bolo de ninho, Coxinha..."
            maxLength={120}
            className="input-base flex-1 text-xs"
          />
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={it.qty}
            onChange={(e) => updateItem(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
            className="input-base w-14 text-center text-xs"
            placeholder="Qtd"
          />
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={it.price || ""}
            onChange={(e) => updateItem(i, { price: Number(e.target.value) || 0 })}
            className="input-base w-20 text-xs"
            placeholder="R$ un."
          />
          <button
            type="button"
            onClick={() => removeItem(i)}
            className="mt-1.5 rounded p-1 text-destructive hover:bg-destructive/10"
            aria-label="Remover item"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-1 rounded-lg bg-blush/40 px-2.5 py-1.5 text-xs font-medium text-mauve hover:bg-blush/70"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar item
      </button>
    </div>
  );
}
