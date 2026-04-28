import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Width = "narrow" | "default" | "wide" | "full";

const widthMap: Record<Width, string> = {
  narrow: "max-w-3xl",   // ~768px — formulários, configs
  default: "max-w-5xl",  // ~1024px — listas, receitas, insumos, eventos, encomendas, clientes
  wide: "max-w-7xl",     // ~1280px — dashboard, catálogo, PDV, vitrine
  full: "max-w-none",
};

export function PageContainer({
  width = "default",
  className,
  children,
}: {
  width?: Width;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full", widthMap[width], className)}>
      {children}
    </div>
  );
}
