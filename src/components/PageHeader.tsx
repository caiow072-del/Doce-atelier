import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** @deprecated kept for backwards compatibility — header is no longer sticky */
  sticky?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-4",
        className,
      )}
    >
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
    </header>
  );
}
