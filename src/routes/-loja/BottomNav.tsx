// Bottom-nav fixo no mobile da vitrine. Esconde no desktop.

import { Home, Tag, ShoppingBag, User } from "lucide-react";

export type BottomNavTab = "home" | "promo" | "orders" | "profile";

export function BottomNav({
  active, onSelect,
}: {
  active: BottomNavTab;
  onSelect: (t: BottomNavTab) => void;
}) {
  const items: { key: BottomNavTab; label: string; icon: any }[] = [
    { key: "home", label: "Início", icon: Home },
    { key: "promo", label: "Promoções", icon: Tag },
    { key: "orders", label: "Pedidos", icon: ShoppingBag },
    { key: "profile", label: "Perfil", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-rose/30 bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
        {items.map((it) => {
          const Icon = it.icon;
          const isActive = active === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onSelect(it.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition ${isActive ? "text-rose" : "text-mauve/60 hover:text-mauve"}`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "fill-rose/30 stroke-rose" : ""}`} strokeWidth={isActive ? 2.2 : 1.7} />
              <span>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
