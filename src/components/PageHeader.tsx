import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  /** @deprecated no longer rendered — kept so call sites don't break */
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
        "mb-4 flex flex-col gap-2 md:mb-5 md:flex-row md:items-end md:justify-between md:gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-mauve leading-tight md:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}
