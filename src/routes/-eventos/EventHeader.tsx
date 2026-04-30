import { useState } from "react";
import { Pencil, Trash2, Truck, Wallet, Lock } from "lucide-react";
import type { EventRow, EventKind } from "./types";
import { Badge } from "./components";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function EventHeader({ 
  event, 
  kind, 
  typeName, 
  onEdit, 
  onDelete 
}: { 
  event: EventRow; 
  kind: EventKind; 
  typeName?: string; 
  onEdit: () => void; 
  onDelete: () => void;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const metaParts: string[] = [fmtDate(event.date)];
  if (event.start_time) metaParts.push(event.start_time);
  if (event.location) metaParts.push(event.location);
  if (event.recurrence !== "none") metaParts.push(event.recurrence === "weekly" ? "semanal" : "mensal");
  if ((kind === "party" || kind === "wedding") && event.customer_name) metaParts.push(event.customer_name);
  if ((kind === "party" || kind === "wedding") && event.guests != null) metaParts.push(`${event.guests} conv.`);

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold text-mauve md:text-xl">{event.name}</h2>
        <p className="mt-1 truncate text-xs text-muted-foreground">{metaParts.join(" · ")}</p>
        {event.notes && (
          <>
            {showNotes ? (
              <p className="mt-2 whitespace-pre-line text-sm text-mauve/80">{event.notes}</p>
            ) : (
              <button onClick={() => setShowNotes(true)} className="mt-1 text-[11px] text-rose hover:underline">
                ver observações
              </button>
            )}
          </>
        )}
        {((kind === "party" || kind === "wedding") && Number(event.fee) > 0) ||
        (kind === "fair" && Number(event.opening_cash) > 0) ||
        event.closed_at ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(kind === "party" || kind === "wedding") && Number(event.fee) > 0 && <Badge icon={Truck} label={`Taxa: ${Number(event.fee).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`} />}
            {kind === "fair" && Number(event.opening_cash) > 0 && <Badge icon={Wallet} label={`Troco: ${Number(event.opening_cash).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`} />}
            {event.closed_at && <Badge icon={Lock} label={`Fechado · ${fmtDate(event.closed_at)}`} />}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-1">
        <button onClick={onEdit} className="rounded-lg p-2 text-muted-foreground hover:bg-blush/50 hover:text-mauve" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
        <button onClick={onDelete} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
