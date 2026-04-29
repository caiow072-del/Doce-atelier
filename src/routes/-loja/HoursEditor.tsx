// Editor de horários de funcionamento — um intervalo simples por dia
// (entrada / saída). Mais que isso pode ser editado direto no banco.

import { Switch } from "@/components/ui/switch";
import { DAY_KEYS, DAY_LABELS, type BusinessHours, type DayKey } from "@/lib/business-hours";

export function HoursEditor({
  value, onChange,
}: {
  value: BusinessHours;
  onChange: (v: BusinessHours) => void;
}) {
  const update = (day: DayKey, patch: { open?: boolean; start?: string; end?: string }) => {
    const current = value[day]?.[0] ?? ["09:00", "18:00"];
    const next = { ...value };
    if (patch.open === false) {
      delete next[day];
    } else {
      const start = patch.start ?? current[0];
      const end = patch.end ?? current[1];
      next[day] = [[start, end]];
    }
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {DAY_KEYS.map((d) => {
        const interval = value[d]?.[0];
        const isOpen = !!interval;
        return (
          <div key={d} className="flex items-center gap-2 rounded-xl border border-border bg-white px-2 py-1.5">
            <span className="w-16 text-xs font-medium text-mauve">{DAY_LABELS[d]}</span>
            <Switch
              checked={isOpen}
              onCheckedChange={(v) => update(d, { open: v })}
            />
            {isOpen ? (
              <div className="flex flex-1 items-center justify-end gap-1">
                <input
                  type="time"
                  value={interval[0]}
                  onChange={(e) => update(d, { start: e.target.value })}
                  className="rounded-md border border-border bg-white px-1.5 py-0.5 text-[11px] text-mauve"
                />
                <span className="text-[11px] text-mauve/40">—</span>
                <input
                  type="time"
                  value={interval[1]}
                  onChange={(e) => update(d, { end: e.target.value })}
                  className="rounded-md border border-border bg-white px-1.5 py-0.5 text-[11px] text-mauve"
                />
              </div>
            ) : (
              <span className="flex-1 text-right text-[11px] text-mauve/40">Fechado</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
