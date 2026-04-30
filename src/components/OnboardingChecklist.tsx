import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Sparkles, X, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

type Step = {
  key: string;
  label: string;
  description: string;
  to: "/insumos" | "/receitas" | "/vitrine";
  done: boolean;
};

export function OnboardingChecklist({
  ingredientsCount,
  recipesCount,
  hasStorefront,
}: {
  ingredientsCount: number;
  recipesCount: number;
  hasStorefront: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem("onboarding-dismissed") === "1");
    const stored = localStorage.getItem("onboarding-collapsed");
    if (stored !== null) setCollapsed(stored === "1");
    else setCollapsed(true);
  }, []);

  const steps: Step[] = [
    {
      key: "ingredients",
      label: "Adicione seu primeiro insumo",
      description: "Cadastre matérias-primas para calcular custos.",
      to: "/insumos",
      done: ingredientsCount > 0,
    },
    {
      key: "recipes",
      label: "Crie sua primeira receita",
      description: "Vincule insumos e calcule margem por fatia.",
      to: "/receitas",
      done: recipesCount > 0,
    },
    {
      key: "storefront",
      label: "Personalize sua vitrine",
      description: "Coloque sua confeitaria online em 1 minuto.",
      to: "/vitrine",
      done: hasStorefront,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const allDone = completed === steps.length;

  if (dismissed || allDone) return null;

  const dismiss = () => {
    localStorage.setItem("onboarding-dismissed", "1");
    setDismissed(true);
  };

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("onboarding-collapsed", next ? "1" : "0");
  };

  const progressPct = (completed / steps.length) * 100;

  // Collapsed: compact inline bar
  if (collapsed) {
    return (
      <button
        onClick={toggleCollapse}
        className="card-soft flex w-full items-center gap-3 bg-gradient-to-r from-blush/40 to-card p-3 text-left transition-colors hover:from-blush/60"
      >
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blush to-rose">
          <Sparkles className="h-3.5 w-3.5 text-mauve" strokeWidth={1.7} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-mauve">
              Primeiros passos — {completed}/{steps.length}
            </p>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-card">
              <div
                className="h-full rounded-full bg-rose transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  // Expanded: full checklist
  return (
    <div className="card-soft relative overflow-hidden bg-gradient-to-br from-blush/50 via-card to-card p-4 sm:p-5">
      <div className="absolute right-2 top-2 flex items-center gap-0.5">
        <button
          onClick={toggleCollapse}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-blush/50 hover:text-mauve"
          aria-label="Recolher"
          title="Recolher"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          onClick={dismiss}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-blush/50 hover:text-mauve"
          aria-label="Dispensar"
          title="Dispensar definitivamente"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blush to-rose">
          <Sparkles className="h-4 w-4 text-mauve" strokeWidth={1.7} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-mauve">Vamos começar</p>
          <p className="text-[11px] text-muted-foreground">
            {completed} de {steps.length} passos concluídos
          </p>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-card">
        <div
          className="h-full rounded-full bg-rose transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ul className="mt-3 space-y-1.5">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              to={s.to}
              className={`flex items-start gap-3 rounded-xl border px-3 py-2 transition-colors ${
                s.done
                  ? "border-success/30 bg-success/5"
                  : "border-border bg-card hover:border-rose/40 hover:bg-blush/20"
              }`}
            >
              {s.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" strokeWidth={1.7} />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-rose" strokeWidth={1.7} />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    s.done ? "text-muted-foreground line-through" : "text-mauve"
                  }`}
                >
                  {s.label}
                </p>
                <p className="text-[11px] text-muted-foreground">{s.description}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
