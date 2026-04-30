import { useState } from "react";
import { Lock } from "lucide-react";

export function SubTab({
  active, onClick, icon: Icon, label, hint, closed,
}: { active: boolean; onClick: () => void; icon: any; label: string; hint?: string; closed?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`relative -mb-px flex flex-1 min-w-0 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-xs sm:text-sm transition-colors sm:flex-initial sm:px-3 ${
        active
          ? "border-rose text-mauve"
          : "border-transparent text-muted-foreground hover:text-mauve"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate font-medium">{label}</span>
      {hint && (
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] num ${active ? "bg-blush/70 text-mauve" : "bg-muted text-muted-foreground"}`}>
          {hint}
        </span>
      )}
      {closed && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
    </button>
  );
}

export function KindChip({ label, icon: Icon, active, onClick, count }: { label: string; icon: any; active: boolean; onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active ? "border-rose bg-blush/70 text-mauve" : "border-border bg-card text-muted-foreground hover:border-rose/40"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
      <span className="ml-1 rounded-full bg-card/70 px-1.5 text-[10px]">{count}</span>
    </button>
  );
}

export function Badge({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[11px] text-mauve">
      <Icon className="h-3 w-3 shrink-0" /> <span className="truncate">{label}</span>
    </span>
  );
}

export function NotesInline({ notes }: { notes: string }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <p className="whitespace-pre-line text-xs text-mauve/80">
      {notes}{" "}
      <button onClick={() => setOpen(false)} className="text-rose hover:underline">ocultar</button>
    </p>
  ) : (
    <button onClick={() => setOpen(true)} className="text-[11px] text-rose hover:underline">ver observações</button>
  );
}
