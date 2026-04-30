import { useState } from "react";
import { Save, Repeat } from "lucide-react";
import type { EventRow, EventType, EventKind } from "./types";
import { parseLocalDate, WEEKDAYS } from "@/lib/recurrence";

export function EditMeta({
  event, kind, types, onSave, onCancel,
}: { event: EventRow; kind: EventKind; types: EventType[]; onSave: (patch: Partial<EventRow>) => void | Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(event.date.slice(0, 10));
  const [startTime, setStartTime] = useState(event.start_time ?? "");
  const [location, setLocation] = useState(event.location ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");
  const [typeId, setTypeId] = useState(event.event_type_id ?? "");
  const [customerName, setCustomerName] = useState(event.customer_name ?? "");
  const [guests, setGuests] = useState(event.guests?.toString() ?? "");
  const [mainFlavor, setMainFlavor] = useState(event.main_flavor ?? "");
  const [fee, setFee] = useState(event.fee?.toString() ?? "0");
  const [openingCash, setOpeningCash] = useState(event.opening_cash?.toString() ?? "0");
  const [recurrence, setRecurrence] = useState(event.recurrence ?? "none");
  const [weekday, setWeekday] = useState<string>(event.weekday != null ? String(event.weekday) : "");
  const [dayOfMonth, setDayOfMonth] = useState<string>(event.day_of_month != null ? String(event.day_of_month) : "");
  const [recurrenceUntil, setRecurrenceUntil] = useState<string>(event.recurrence_until ?? "");

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-rose">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-base mt-1" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-rose">Tipo</label>
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="input-base mt-1">
            <option value="">— Sem tipo —</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-rose">Data {recurrence !== "none" ? "inicial" : ""}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base mt-1" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-rose">Horário</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-base mt-1" />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] uppercase tracking-widest text-rose">Local / endereço</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="input-base mt-1" />
        </div>
        <div className="md:col-span-2 rounded-xl border border-border bg-blush/20 p-3">
          <p className="text-[10px] uppercase tracking-widest text-rose mb-2 flex items-center gap-1"><Repeat className="h-3 w-3" /> Recorrência</p>
          <div className="grid grid-cols-2 gap-2">
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className="input-base">
              <option value="none">Não se repete</option>
              <option value="weekly">Toda semana</option>
              <option value="monthly">Todo mês</option>
            </select>
            {recurrence === "weekly" && (
              <select value={weekday} onChange={(e) => setWeekday(e.target.value)} className="input-base">
                <option value="">Mesmo dia da semana da data</option>
                {WEEKDAYS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
              </select>
            )}
            {recurrence === "monthly" && (
              <input type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} placeholder="Dia do mês (ex: 15)" className="input-base" />
            )}
          </div>
          {recurrence !== "none" && (
            <div className="mt-2">
              <label className="text-[10px] uppercase tracking-widest text-rose">Até quando (opcional)</label>
              <input type="date" value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} className="input-base mt-1" />
            </div>
          )}
        </div>
        {(kind === "party" || kind === "wedding") && (
          <>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Cliente</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input-base mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Convidados</label>
              <input type="number" value={guests} onChange={(e) => setGuests(e.target.value)} className="input-base mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Sabor principal</label>
              <input value={mainFlavor} onChange={(e) => setMainFlavor(e.target.value)} className="input-base mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Taxa (R$)</label>
              <input type="number" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} className="input-base mt-1" />
            </div>
          </>
        )}
        {kind === "fair" && (
          <div>
            <label className="text-[10px] uppercase tracking-widest text-rose">Troco inicial (R$)</label>
            <input type="number" step="0.01" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} className="input-base mt-1" />
          </div>
        )}
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-widest text-rose">Observações</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input-base mt-1" />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() =>
            onSave({
              name: name.trim() || event.name,
              date: parseLocalDate(date).toISOString(),
              start_time: startTime || null,
              location: location || null,
              notes: notes || null,
              event_type_id: typeId || null,
              customer_name: customerName || null,
              guests: guests ? Number(guests) : null,
              main_flavor: mainFlavor || null,
              fee: Number(fee) || 0,
              opening_cash: Number(openingCash) || 0,
              recurrence,
              weekday: recurrence === "weekly" ? (weekday !== "" ? Number(weekday) : parseLocalDate(date).getDay()) : null,
              day_of_month: recurrence === "monthly" ? (dayOfMonth ? Number(dayOfMonth) : parseLocalDate(date).getDate()) : null,
              recurrence_until: recurrence !== "none" && recurrenceUntil ? recurrenceUntil : null,
            })
          }
          className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-4 py-2 text-sm text-cream hover:opacity-90"
        >
          <Save className="h-4 w-4" /> Salvar
        </button>
        <button onClick={onCancel} className="rounded-xl bg-blush/40 px-4 py-2 text-sm text-mauve hover:bg-blush/70">Cancelar</button>
      </div>
    </div>
  );
}
