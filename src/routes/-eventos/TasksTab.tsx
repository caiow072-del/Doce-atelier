import { CheckCircle2, Circle, Trash2, Plus, Sparkles } from "lucide-react";
import type { EventTask, EventKind } from "./types";
import { KIND_META } from "./constants";

export function TasksTab({
  days, activeDay, setActiveDay, eventTasks, dayTasks, kind, newTask, setNewTask, onSeed, onToggle, onRemove, onAdd,
}: {
  days: { key: string; label: string }[];
  activeDay: string;
  setActiveDay: (d: string) => void;
  eventTasks: EventTask[];
  dayTasks: EventTask[];
  kind: EventKind;
  newTask: string;
  setNewTask: (s: string) => void;
  onSeed: () => void;
  onToggle: (t: EventTask) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <>
      <div
        className="grid gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((d) => {
          const active = activeDay === d.key;
          const dayCount = eventTasks.filter((t) => t.day_key === d.key);
          const total = dayCount.length;
          const done = dayCount.filter((t) => t.done).length;
          return (
            <button
              key={d.key}
              onClick={() => setActiveDay(d.key)}
              className={`flex flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition-colors ${
                active
                  ? "border-rose bg-blush/60 text-mauve shadow-soft"
                  : "border-border bg-card text-muted-foreground hover:border-rose/40"
              }`}
            >
              <p className="text-xs font-medium leading-none sm:text-sm">{d.label}</p>
              {total > 0 && (
                <p className="mt-1 text-[10px] leading-none num opacity-80">
                  {done}/{total}
                </p>
              )}
            </button>
          );
        })}
      </div>
      <div className="card-soft mt-3 overflow-hidden">
        {eventTasks.length === 0 && (
          <div className="border-b border-border/60 bg-blush/20 px-3 py-3 sm:px-4">
            <button onClick={onSeed} className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-3 py-1.5 text-xs font-medium text-cream hover:opacity-90">
              <Sparkles className="h-3.5 w-3.5" /> Gerar checklist sugerido para {KIND_META[kind].label}
            </button>
          </div>
        )}
        <ul className="divide-y divide-border/60">
          {dayTasks.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">Sem tarefas neste dia.</li>
          ) : dayTasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
              <button onClick={() => onToggle(t)} className="flex min-w-0 flex-1 items-center gap-2 text-left sm:gap-3">
                {t.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success sm:h-6 sm:w-6" strokeWidth={1.6} /> : <Circle className="h-5 w-5 shrink-0 text-rose sm:h-6 sm:w-6" strokeWidth={1.6} />}
                <span className={`min-w-0 break-words text-sm ${t.done ? "text-muted-foreground line-through" : "text-mauve"}`}>{t.task}</span>
              </button>
              <button onClick={() => onRemove(t.id)} className="shrink-0 rounded-lg p-1.5 text-destructive hover:bg-destructive/10" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); onAdd(); }} className="flex items-center gap-2 border-t border-border/60 bg-background/60 p-3">
          <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Adicionar tarefa..." className="input-base flex-1" />
          <button type="submit" className="rounded-xl bg-mauve px-3 py-2 text-sm text-cream hover:opacity-90"><Plus className="h-4 w-4" /></button>
        </form>
      </div>
    </>
  );
}
