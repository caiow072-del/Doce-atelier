// Horários de funcionamento por dia da semana (formato 24h "HH:mm").
// Cada dia pode ter 0..N intervalos. Formato:
// { mon: [["09:00","12:00"], ["14:00","18:00"]], tue: [...], ... }

export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const DAY_LABELS: Record<DayKey, string> = {
  sun: "Domingo",
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
};
export const DAY_SHORT: Record<DayKey, string> = {
  sun: "Dom",
  mon: "Seg",
  tue: "Ter",
  wed: "Qua",
  thu: "Qui",
  fri: "Sex",
  sat: "Sáb",
};

export type Interval = [string, string]; // ["09:00","17:00"]
export type BusinessHours = Partial<Record<DayKey, Interval[]>>;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function dayKeyOf(d: Date): DayKey {
  return DAY_KEYS[d.getDay()];
}

export type OpenStatus =
  | { open: true; closesAt: string }
  | { open: false; opensAt?: string; opensDay?: DayKey };

export function getOpenStatus(hours: BusinessHours | null | undefined, now = new Date()): OpenStatus {
  if (!hours || Object.keys(hours).length === 0) return { open: false };

  const today = dayKeyOf(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayIntervals = hours[today] ?? [];

  for (const [start, end] of todayIntervals) {
    const s = toMinutes(start);
    const e = toMinutes(end);
    if (nowMin >= s && nowMin < e) return { open: true, closesAt: end };
  }

  // procurar próximo horário (até 7 dias à frente)
  for (let i = 0; i < 7; i++) {
    const dayIdx = (now.getDay() + i) % 7;
    const dayKey = DAY_KEYS[dayIdx];
    const intervals = hours[dayKey] ?? [];
    for (const [start] of intervals) {
      const s = toMinutes(start);
      if (i === 0 && s <= nowMin) continue;
      return { open: false, opensAt: start, opensDay: dayKey };
    }
  }
  return { open: false };
}

export function defaultHours(): BusinessHours {
  return {
    mon: [["09:00", "18:00"]],
    tue: [["09:00", "18:00"]],
    wed: [["09:00", "18:00"]],
    thu: [["09:00", "18:00"]],
    fri: [["09:00", "18:00"]],
    sat: [["09:00", "13:00"]],
  };
}
