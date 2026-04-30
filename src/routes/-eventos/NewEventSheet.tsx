import { useState, useMemo } from "react";
import { X, Save, Tag, Repeat } from "lucide-react";
import type { EventRow, EventType, EventKind } from "./types";
import { KIND_META } from "./constants";
import { parseLocalDate, WEEKDAYS } from "@/lib/recurrence";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function NewEventSheet({
  shopId, types, onClose, onCreated,
}: { shopId: string; types: EventType[]; onClose: () => void; onCreated: (rows: EventRow[]) => void }) {
  const [step, setStep] = useState<"kind" | "details">("kind");
  const [typeId, setTypeId] = useState<string>("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [guests, setGuests] = useState("");
  const [recurrence, setRecurrence] = useState<"none" | "weekly" | "monthly">("none");
  const [weekday, setWeekday] = useState<string>("");
  const [dayOfMonth, setDayOfMonth] = useState<string>("");
  const [recurrenceUntil, setRecurrenceUntil] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const selectedType = types.find((t) => t.id === typeId);
  const kind: EventKind = selectedType?.kind ?? "generic";

  const byKind = useMemo(() => {
    const map = new Map<EventKind, EventType[]>();
    types.forEach((t) => {
      const arr = map.get(t.kind) ?? [];
      arr.push(t);
      map.set(t.kind, arr);
    });
    return map;
  }, [types]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Dê um nome");
    setSaving(true);

    const anchor = parseLocalDate(date);
    const { data: row, error } = await supabase
      .from("events")
      .insert({
        shop_id: shopId,
        name: name.trim(),
        date: anchor.toISOString(),
        start_time: startTime || null,
        location: location || null,
        event_type_id: typeId || null,
        customer_name: customerName || null,
        guests: guests ? Number(guests) : null,
        recurrence,
        weekday: recurrence === "weekly" ? (weekday !== "" ? Number(weekday) : anchor.getDay()) : null,
        day_of_month: recurrence === "monthly" ? (dayOfMonth ? Number(dayOfMonth) : anchor.getDate()) : null,
        recurrence_until: recurrence !== "none" && recurrenceUntil ? recurrenceUntil : null,
      })
      .select("*")
      .single();

    setSaving(false);
    if (error || !row) return toast.error("Erro ao criar evento");

    toast.success(recurrence !== "none" ? "Evento recorrente criado" : "Evento criado");
    onCreated([row as unknown as EventRow]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-mauve/40 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-petal">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">{step === "kind" ? "Escolha o tipo" : "Detalhes"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        {step === "kind" ? (
          <div className="mt-4 space-y-4">
            {(["festival", "party", "fair", "wedding", "generic"] as EventKind[]).map((k) => {
              const list = byKind.get(k) ?? [];
              if (list.length === 0) return null;
              const meta = KIND_META[k];
              const Icon = meta.icon;
              return (
                <div key={k}>
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-rose" />
                    <p className="text-[10px] uppercase tracking-widest text-rose">{meta.label}</p>
                  </div>
                  <div className="space-y-2">
                    {list.map((t) => (
                      <button key={t.id} onClick={() => { setTypeId(t.id); setStep("details"); }}
                        className="flex w-full items-start gap-3 rounded-2xl border border-border bg-background p-3 text-left hover:border-rose/60">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blush/50"><Icon className="h-4 w-4 text-mauve" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-mauve">{t.name}</p>
                          <p className="text-[11px] text-muted-foreground">{meta.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <button onClick={() => { setTypeId(""); setStep("details"); }} className="w-full rounded-xl border border-dashed border-border py-3 text-xs text-muted-foreground hover:border-rose/40">
              Pular — criar sem tipo
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            {selectedType && (
              <div className="flex items-center gap-2 rounded-xl bg-blush/40 px-3 py-2">
                <Tag className="h-3.5 w-3.5 text-rose" />
                <p className="text-xs text-mauve">{selectedType.name}</p>
                <button type="button" onClick={() => setStep("kind")} className="ml-auto text-[11px] text-rose underline">Trocar</button>
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Nome *</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder={kind === "festival" ? "Ex: Festival de Sábado" : kind === "party" ? "Ex: Aniversário Maria 5 anos" : "Nome do evento"}
                className="input-base mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-rose">Data *</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base mt-1" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-rose">Horário</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-base mt-1" />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Local</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="input-base mt-1" />
            </div>

            {(kind === "festival" || kind === "fair" || kind === "generic") && (
              <div className="rounded-xl border border-border bg-blush/20 p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-rose flex items-center gap-1"><Repeat className="h-3 w-3" /> Repetir</p>
                <div className="grid grid-cols-2 gap-2">
                  <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as any)} className="input-base">
                    <option value="none">Não repetir</option>
                    <option value="weekly">Toda semana</option>
                    <option value="monthly">Todo mês</option>
                  </select>
                  {recurrence === "weekly" && (
                    <select value={weekday} onChange={(e) => setWeekday(e.target.value)} className="input-base">
                      <option value="">Mesmo dia da data</option>
                      {WEEKDAYS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
                    </select>
                  )}
                  {recurrence === "monthly" && (
                    <input type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} placeholder="Dia do mês" className="input-base" />
                  )}
                </div>
                {recurrence !== "none" && (
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-rose">Até quando (opcional)</label>
                    <input type="date" value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} className="input-base mt-1" />
                    <p className="mt-1 text-[10px] text-muted-foreground">Um único evento que se repete {recurrence === "weekly" ? "toda semana" : "todo mês"} — sem duplicar no banco.</p>
                  </div>
                )}
              </div>
            )}

            {(kind === "party" || kind === "wedding") && (
              <>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-rose">{kind === "wedding" ? "Noivos" : "Cliente"}</label>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input-base mt-1" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-rose">Convidados</label>
                  <input type="number" value={guests} onChange={(e) => setGuests(e.target.value)} className="input-base mt-1" />
                </div>
              </>
            )}

            <button type="submit" disabled={saving} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-mauve px-4 py-3 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Criar evento"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
