import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Home, BookOpen, CalendarHeart, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";

const tabs = [
  { to: "/", label: "Início", icon: Home },
  { to: "/receitas", label: "Receitas", icon: BookOpen },
  { to: "/festival", label: "Festival", icon: CalendarHeart },
  { to: "/pdv", label: "PDV", icon: ShoppingBag },
] as const;

export function AppLayout() {
  const location = useLocation();
  return (
    <div className="min-h-screen floral-bg">
      <main className="mx-auto max-w-2xl px-4 pt-6 app-scroll">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2 py-2 safe-bottom">
          {tabs.map((t) => {
            const active = location.pathname === t.to;
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors data-[active=true]:text-mauve"
                data-active={active}
              >
                {active && (
                  <motion.span
                    layoutId="navpill"
                    className="absolute inset-0 -z-0 rounded-2xl bg-blush/70"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className="relative z-10 h-5 w-5" strokeWidth={1.6} />
                <span className="relative z-10">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
