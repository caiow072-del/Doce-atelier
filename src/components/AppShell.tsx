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
  ClipboardList,
  CalendarDays,
  Globe,
  Users,
  Palette,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

type NavItem = {
  to: "/" | "/insumos" | "/receitas" | "/eventos" | "/encomendas" | "/calendario" | "/catalogo" | "/clientes" | "/pdv" | "/vitrine";
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/insumos", label: "Insumos", icon: Package },
  { to: "/receitas", label: "Receitas", icon: BookOpen },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/encomendas", label: "Encomendas", icon: ClipboardList },
  { to: "/eventos", label: "Eventos", icon: CalendarHeart },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/catalogo", label: "Catálogo", icon: Globe },
  { to: "/vitrine", label: "Minha vitrine", icon: Palette },
  { to: "/pdv", label: "PDV", icon: ShoppingBag },
];

const mobileNav = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/eventos", label: "Eventos", icon: CalendarHeart },
  { to: "/encomendas", label: "Pedidos", icon: ClipboardList },
  { to: "/pdv", label: "PDV", icon: ShoppingBag },
] as const;

const roleLabel: Record<string, string> = {
  owner: "Proprietário(a)",
  manager: "Gerente",
  staff: "Equipe",
};

export function AppShell() {
  const { user, currentShop, shops, isApproved, setCurrentShopId, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);

  const isActive = (to: string, end?: boolean) =>
    end ? location.pathname === to : location.pathname === to || location.pathname.startsWith(to + "/");

  // Auth Guard: Block access if user profile is not approved
  if (user && isApproved === false) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#FCFAFA]/95 backdrop-blur-md p-6">
        <div className="max-w-md w-full bg-card p-8 rounded-3xl border border-border/60 shadow-petal text-center">
          <div className="mb-6 flex justify-center">
            <div className="p-4 bg-rose/10 rounded-full">
              <Sparkles className="h-10 w-10 text-rose animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-brand text-mauve mb-4">Aguardando Aprovação</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            Acesso Pendente: Seu cadastro foi recebido e está aguardando a aprovação do administrador do Doce Atelier.
          </p>
          <button 
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
            className="flex items-center justify-center gap-2 w-full py-3 bg-blush/60 text-mauve rounded-2xl font-medium hover:bg-blush transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen floral-bg overflow-x-hidden">
      <div className="flex w-full max-w-full">
        {/* ============ Desktop Sidebar ============ */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-card/60 backdrop-blur-xl lg:flex">
          {/* Brand */}
          <div className="flex flex-col items-center px-4 pt-6 pb-2">
            <div className="flex items-center justify-center h-28 w-full overflow-hidden">
              <img 
                src="/logo.svg" 
                alt="Doce Atelier" 
                className="h-52 w-auto object-contain scale-110" 
              />
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-[0.4em] text-muted-foreground font-black">Painel</p>
          </div>

          {/* Shop switcher */}
          <div className="mt-5 px-3">
            <button
              onClick={() => setShopMenuOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-background/60 px-3 py-2.5 text-left transition-colors hover:border-rose/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Store className="h-4 w-4 shrink-0 text-rose" strokeWidth={1.6} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-mauve">{currentShop?.shops.name ?? "Sem loja"}</p>
                  <div className="mt-0.5">
                    {currentShop?.role && (
                      <span className="inline-flex items-center rounded-full bg-rose/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-rose">
                        {roleLabel[currentShop.role] ?? currentShop.role}
                      </span>
                    )}
                  </div>
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
          <nav className="mt-5 flex-1 space-y-0.5 px-2 overflow-y-auto">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to, item.end);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
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
              <div className="grid h-9 w-9 place-items-center rounded-full bg-rose/40 text-sm font-semibold text-mauve">
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
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          {/* Mobile topbar — hamburger opens drawer with full nav */}
          <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border/60 bg-card/80 px-4 py-2.5 backdrop-blur-xl lg:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-background/60 text-mauve"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.7} />
            </button>
            <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
              <div className="flex h-16 w-full max-w-[200px] items-center justify-center overflow-hidden">
                <img src="/logo.svg" alt="Doce Atelier" className="h-28 w-auto object-contain scale-110" />
              </div>
            </div>
            <div
              className="grid h-9 w-9 place-items-center rounded-full bg-rose/40 text-sm font-semibold text-mauve"
              aria-label="Conta"
            >
              {(user?.email ?? "?").charAt(0).toUpperCase()}
            </div>
          </header>

          {/* Page — no max-w here; each page picks its own via <PageContainer/> */}
          <main className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden px-3 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-6">
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

      {/* ============ Mobile drawer ============ */}
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
              <div className="flex flex-col items-center gap-2 mb-6 w-full">
                <div className="flex h-28 w-full items-center justify-center overflow-hidden">
                  <img src="/logo.svg" alt="Doce Atelier" className="h-48 w-auto object-contain scale-110" />
                </div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground font-black">Painel de Gestão</p>
              </div>
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-muted-foreground" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 rounded-xl bg-blush/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Loja atual</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm font-medium text-mauve">{currentShop?.shops.name}</p>
                {currentShop?.role && (
                  <span className="inline-flex items-center rounded-full bg-rose/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-rose">
                    {roleLabel[currentShop.role] ?? currentShop.role}
                  </span>
                )}
              </div>
            </div>

            <nav className="mt-6 space-y-1 overflow-y-auto">
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
