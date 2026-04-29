import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
import { getOccurrences } from "@/lib/recurrence";

export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — Cakes Manager" },
      { name: "description", content: "Visualize encomendas e eventos da confeitaria." },
    ],
  }),
  component: CalendarioPage,
});

type Item = { id: string; title: string; date: string; kind: "evento" | "encomenda"; status?: string; recurring?: boolean };

const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const dayNames = ["D", "S", "T", "Q", "Q", "S", "S"];

function CalendarioPage() {
  const { currentShop } = useAuth();
  const shopId = currentShop?.shop_id;
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    if (!shopId) return;
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
    const startISO = monthStart.toISOString();
    const endISO = monthEnd.toISOString();
    Promise.all([
      // Eventos não recorrentes que caem no mês + TODOS os recorrentes (para expandir)
      supabase.from("events").select("id, name, date, recurrence, recurrence_until, weekday, day_of_month").eq("shop_id", shopId),
      supabase.from("orders").select("id, customer_name, description, delivery_at, status").eq("shop_id", shopId).gte("delivery_at", startISO).lt("delivery_at", endISO),
    ]).then(([ev, od]) => {
      const all: Item[] = [];
      (ev.data ?? []).forEach((e: any) => {
        if (!e.recurrence || e.recurrence === "none") {
          // Só inclui se estiver no mês visível
          const d = new Date(e.date);
          if (d >= monthStart && d <= monthEnd) {
            all.push({ id: e.id, title: e.name, date: e.date, kind: "evento" });
          }
        } else {
          const occs = getOccurrences(e, monthStart, monthEnd);
          occs.forEach((o, idx) => {
            all.push({ id: `${e.id}-${idx}`, title: e.name, date: o.toISOString(), kind: "evento", recurring: true });
          });
        }
      });
      (od.data ?? []).forEach((o: { id: string; customer_name: string; description: string; delivery_at: string; status: string }) =>
        all.push({ id: o.id, title: `${o.customer_name} — ${o.description}`, date: o.delivery_at, kind: "encomenda", status: o.status }),
      );
      setItems(all);
    });
  }, [shopId, cursor]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const startWeekday = first.getDay();
    const cells: (Date | null)[] = Array(startWeekday).fill(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    items.forEach((it) => {
      const d = new Date(it.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    });
    return map;
  }, [items]);

  const today = new Date();
  const isToday = (d: Date) => d.toDateString() === today.toDateString();

  return (
    <PageContainer width="default">
    <div className="space-y-6">
      <PageHeader eyebrow="Agenda" title="Calendário" subtitle="Eventos e entregas em um só lugar." />

      <div className="card-soft p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="rounded-xl bg-blush/40 p-2 text-mauve hover:bg-blush/70"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="font-display text-xl italic text-mauve">
            {monthNames[cursor.getMonth()]} {cursor.getFullYear()}
          </p>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="rounded-xl bg-blush/40 p-2 text-mauve hover:bg-blush/70"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
          {dayNames.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.map((d, i) => {
            if (!d) return <div key={i} className="aspect-square" />;
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const dayItems = itemsByDay.get(key) ?? [];
            return (
              <div
                key={i}
                className={`aspect-square rounded-lg border p-1 text-left text-[11px] overflow-hidden ${
                  isToday(d) ? "border-rose bg-blush/40" : "border-border bg-card"
                }`}
              >
                <p className={`font-medium ${isToday(d) ? "text-mauve" : "text-muted-foreground"}`}>{d.getDate()}</p>
                <div className="mt-0.5 space-y-0.5">
                  {dayItems.slice(0, 2).map((it) => (
                    <div
                      key={it.id}
                      className={`truncate rounded px-1 text-[9px] flex items-center gap-0.5 ${
                        it.kind === "evento" ? "bg-rose/40 text-mauve" : "bg-sage/40 text-mauve"
                      }`}
                      title={it.title}
                    >
                      {it.recurring && <Repeat className="h-2 w-2 shrink-0" />}
                      <span className="truncate">{it.title}</span>
                    </div>
                  ))}
                  {dayItems.length > 2 && (
                    <p className="text-[9px] text-muted-foreground">+{dayItems.length - 2}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {items.length === 0 && (
        <div className="card-soft p-8 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-rose" strokeWidth={1.4} />
          <p className="mt-3 text-sm text-muted-foreground">Nada agendado neste mês.</p>
          <div className="mt-3 flex justify-center gap-2">
            <Link to="/eventos" className="rounded-xl bg-mauve px-4 py-2 text-xs text-cream">
              Criar evento
            </Link>
            <Link to="/encomendas" className="rounded-xl bg-blush/60 px-4 py-2 text-xs text-mauve">
              Nova encomenda
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
