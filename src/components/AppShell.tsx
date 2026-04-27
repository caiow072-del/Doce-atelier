import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BookOpen,
  CalendarHeart,
  ShoppingBag,
  Package,
  Store,
  Menu,
  LogOut,
  ChevronDown,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

type NavItem = {
  to: "/" | "/insumos" | "/receitas" | "/festival" | "/pdv";
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/insumos", label: "Insumos", icon: Package },
  { to: "/receitas", label: "Receitas", icon: BookOpen },
  { to: "/festival", label: "Festivais", icon: CalendarHeart },
  { to: "/pdv", label: "PDV", icon: ShoppingBag },
];

const mobileNav = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/receitas", label: "Receitas", icon: BookOpen },
  { to: "/festival", label: "Festival", icon: CalendarHeart },
  { to: "/pdv", label: "PDV", icon: ShoppingBag },
] as const;

export function AppShell() {
  const { user, currentShop, shops, setCurrentShopId, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);

  const isActive = (to: string, end?: boolean) =>
    end ? location.pathname === to : location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen floral-bg">
      <div className="flex">
        {/* ============ Desktop Sidebar ============ */}
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-border/60 bg-card/60 backdrop-blur-xl lg:flex">
          {/* Brand */}
          <div className="flex items-center gap-3 px-6 pt-7">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blush to-rose shadow-soft">
              <Sparkles className="h-5 w-5 text-mauve" strokeWidth={1.6} />
            </div>
            <div className="leading-tight">
              <p className="font-display text-xl italic text-mauve">Cakes Manager</p>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Atelier doce</p>
            </div>
          </div>

          {/* Shop switcher */}
          <div className="mt-6 px-4">
            <button
              onClick={() => setShopMenuOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-background/60 px-3 py-2.5 text-left transition-colors hover:border-rose/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Store className="h-4 w-4 shrink-0 text-rose" strokeWidth={1.6} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-mauve">{currentShop?.shops.name ?? "Sem loja"}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{currentShop?.role}</p>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${shopMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {shopMenuOpen && shops.length > 1 && (
              <div className="mt-1 overflow-hidden rounded-xl border border-border/60 bg-card">
                {shops.map((s) => (
                  <button
                    key={s.shop_id}
                    onClick={() => {
                      setCurrentShopId(s.shop_id);
                      setShopMenuOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-mauve hover:bg-blush/40"
                  >
                    {s.shops.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="mt-6 flex-1 space-y-1 px-3">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to, item.end);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-gradient-to-r from-blush/80 to-rose/30 text-mauve"
                      : "text-muted-foreground hover:bg-blush/30 hover:text-mauve"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.7} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User card */}
          <div className="m-3 rounded-2xl border border-border/60 bg-background/60 p-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-rose/40 font-display text-sm italic text-mauve">
                {(user?.email ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-mauve">{user?.email}</p>
                <p className="text-[10px] text-muted-foreground">Conectada</p>
              </div>
              <button
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/login" });
                }}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-blush/60 hover:text-mauve"
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* ============ Main content ============ */}
        <div className="flex min-h-screen flex-1 flex-col">
          {/* Mobile topbar */}
          <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-card/80 px-4 py-3 backdrop-blur-xl lg:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-xl bg-blush/60 text-mauve"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-center leading-tight">
              <p className="font-display text-lg italic text-mauve">{currentShop?.shops.name ?? "Cakes Manager"}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-rose/40 font-display text-sm italic text-mauve">
              {(user?.email ?? "?").charAt(0).toUpperCase()}
            </div>
          </header>

          {/* Page */}
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-10">
            <Outlet />
          </main>
        </div>
      </div>

      {/* ============ Mobile bottom nav ============ */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-card/90 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2 py-2">
          {mobileNav.map((t) => {
            const active = isActive(t.to, t.to === "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-medium transition-colors ${
                  active ? "bg-blush/70 text-mauve" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.6} />
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ============ Mobile drawer (CSS only, instant) ============ */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-mauve/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-72 flex-col bg-card p-5 shadow-petal"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blush to-rose">
                  <Sparkles className="h-5 w-5 text-mauve" strokeWidth={1.6} />
                </div>
                <p className="font-display text-xl italic text-mauve">Cakes Manager</p>
              </div>
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-muted-foreground" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 rounded-xl bg-blush/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Loja atual</p>
              <p className="text-sm font-medium text-mauve">{currentShop?.shops.name}</p>
            </div>

            <nav className="mt-6 space-y-1">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to, item.end);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      active ? "bg-blush/70 text-mauve" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.7} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <button
              onClick={async () => {
                setMobileOpen(false);
                await signOut();
                navigate({ to: "/login" });
              }}
              className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-blush/60 px-4 py-3 text-sm text-mauve"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
