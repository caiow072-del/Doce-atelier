import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  sticky = true,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-5 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 lg:py-4",
        sticky && "sticky top-12 lg:top-0 z-30 bg-card/85 backdrop-blur-xl border-b border-border/60",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 md:flex-row md:items-end md:justify-between md:gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] uppercase tracking-[0.22em] text-rose font-medium">{eyebrow}</p>
          )}
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-mauve leading-tight md:text-2xl">
            {title}
          </h1>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 md:text-sm">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
