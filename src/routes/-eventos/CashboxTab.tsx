import { Unlock, Lock, AlertCircle } from "lucide-react";
import type { EventRow, EventProduct, Sale } from "./types";
import { formatBRL } from "@/lib/store";

export function CashboxTab({
  event, products, sales, cashbox, onClose, onReopen, onUpdateOpening,
}: {
  event: EventRow;
  products: EventProduct[];
  sales: Sale[];
  cashbox: { total: number; itemsSold: number; byMethod: Record<string, number>; cost: number; profit: number; sobras: { name: string; planned: number; sold: number }[] };
  onClose: () => void;
  onReopen: () => void;
  onUpdateOpening: (v: number) => void;
}) {
  const closed = !!event.closed_at;
  const summary = event.payment_summary;
  const display = closed && summary ? summary : { total: cashbox.total, by_method: cashbox.byMethod, items_sold: cashbox.itemsSold, cost_estimated: cashbox.cost, profit: cashbox.profit };

  const methodLabel: Record<string, string> = { cash: "Dinheiro", pix: "Pix", credit: "Crédito", debit: "Débito", other: "Outro" };

  return (
    <div className="space-y-4">
      <div className="card-soft p-4 bg-gradient-to-br from-blush/60 to-card sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-rose">Caixa do evento {closed && "(fechado)"}</p>
            <p className="mt-1 text-2xl font-semibold text-mauve sm:text-3xl">{formatBRL(display.total)}</p>
            <p className="text-xs text-muted-foreground">{display.items_sold} itens vendidos</p>
          </div>
          {closed ? (
            <button onClick={onReopen} className="inline-flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-xs text-mauve hover:bg-blush/40">
              <Unlock className="h-3.5 w-3.5" /> Reabrir
            </button>
          ) : (
            <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-3 py-2 text-xs font-medium text-cream hover:opacity-90">
              <Lock className="h-3.5 w-3.5" /> Fechar caixa
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card-soft p-4">
          <p className="text-[11px] uppercase tracking-widest text-rose mb-2">Por forma de pagamento</p>
          {Object.keys(display.by_method).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {Object.entries(display.by_method).map(([m, v]) => (
                <li key={m} className="flex justify-between text-sm">
                  <span className="text-mauve">{methodLabel[m] ?? m}</span>
                  <span className="font-medium text-mauve">{formatBRL(Number(v))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-soft p-4">
          <p className="text-[11px] uppercase tracking-widest text-rose mb-2">Resultado estimado</p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex justify-between"><span className="text-mauve">Vendas</span><span className="text-mauve">{formatBRL(display.total)}</span></li>
            <li className="flex justify-between"><span className="text-muted-foreground">Custo dos insumos (~)</span><span className="text-destructive">−{formatBRL(display.cost_estimated)}</span></li>
            {Number(event.fee) > 0 && (
              <li className="flex justify-between"><span className="text-muted-foreground">Taxa do evento</span><span className="text-destructive">−{formatBRL(Number(event.fee))}</span></li>
            )}
            <li className="flex justify-between border-t border-border pt-1.5 mt-1.5">
              <span className="font-medium text-mauve">Lucro estimado</span>
              <span className={`font-bold ${display.profit < 0 ? "text-destructive" : "text-success"}`}>{formatBRL(display.profit)}</span>
            </li>
          </ul>
          <p className="mt-2 text-[10px] text-muted-foreground flex items-start gap-1"><AlertCircle className="h-3 w-3 mt-0.5" /> Custo estimado em 30% do preço. Cálculo refinado virá com a receita ligada a cada produto.</p>
        </div>
      </div>

      {!closed && (
        <div className="card-soft p-4">
          <label className="text-[11px] uppercase tracking-widest text-rose">Troco inicial</label>
          <input
            type="number" step="0.01"
            defaultValue={event.opening_cash ?? 0}
            onBlur={(e) => onUpdateOpening(Number(e.target.value) || 0)}
            className="input-base mt-1 max-w-[180px]"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-soft overflow-hidden">
          <p className="border-b border-border/60 bg-blush/30 px-3 py-3 sm:px-4 text-sm font-medium text-mauve md:px-4 md:py-2.5">Previsto vs vendido</p>
          {cashbox.sobras.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Adicione produtos ao evento.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {cashbox.sobras.map((s) => {
                const sobra = s.planned - s.sold;
                return (
                  <li key={s.name} className="flex items-center justify-between px-3 py-2.5 sm:px-4 text-sm md:px-4">
                    <span className="text-mauve">{s.name}</span>
                    <span className="text-xs">
                      <span className="text-success font-medium">{s.sold}</span>
                      <span className="text-muted-foreground"> / {s.planned} planejados</span>
                      {sobra > 0 && <span className="ml-2 text-warning">{sobra} sobra</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card-soft overflow-hidden">
          <p className="border-b border-border/60 bg-blush/30 px-3 py-3 sm:px-4 text-sm font-medium text-mauve md:px-4 md:py-2.5">Vendas registradas ({sales.length})</p>
          {sales.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma venda. Use o PDV com este evento selecionado.</p>
          ) : (
            <ul className="divide-y divide-border/60 sm:max-h-64 sm:overflow-y-auto">
              {sales.slice().reverse().map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm sm:px-4">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-mauve">{s.item}</span>
                    <span className="text-[10px] text-muted-foreground">{methodLabel[s.payment_method] ?? s.payment_method}</span>
                  </div>
                  <span className="shrink-0 font-medium text-mauve">{formatBRL(Number(s.price))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
