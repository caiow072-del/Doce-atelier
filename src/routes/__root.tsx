import { Outlet, createRootRoute, HeadContent, Scripts, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import appCss from "../styles.css?url";
import { AppShell } from "@/components/AppShell";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Cakes Manager — Gestão completa para confeitarias" },
      {
        name: "description",
        content:
          "Painel completo de gestão para confeitarias: receitas, festivais, encomendas, vitrine pública e PDV.",
      },
      { property: "og:title", content: "Cakes Manager" },
      { property: "og:description", content: "Gestão doce, simples e profissional para sua confeitaria." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  return (
    <AuthProvider>
      <AuthGate />
      <Toaster richColors position="top-center" />
    </AuthProvider>
  );
}

// Routes that don't require login
const PUBLIC_ROUTES = new Set<string>(["/login"]);
const PUBLIC_PREFIXES = ["/loja"]; // future public storefront

function AuthGate() {
  const { loading, session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isPublic =
    PUBLIC_ROUTES.has(location.pathname) ||
    PUBLIC_PREFIXES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (loading) return;
    if (!session && !isPublic) {
      navigate({ to: "/login" });
    }
  }, [loading, session, isPublic, navigate]);

  if (loading) {
    return (
      <div className="floral-bg flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-mauve">
          <Loader2 className="h-7 w-7 animate-spin" />
          <p className="font-display text-lg italic">Abrindo seu atelier...</p>
        </div>
      </div>
    );
  }

  if (isPublic) return <Outlet />;
  if (!session) return null;

  return <AppShell />;
}

function NotFound() {
  return (
    <div className="floral-bg flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-display text-7xl italic text-mauve">404</h1>
        <p className="mt-2 text-muted-foreground">Esta página não está no cardápio.</p>
        <a href="/" className="mt-6 inline-flex rounded-full bg-rose px-6 py-3 text-sm font-medium text-mauve">
          Voltar ao início
        </a>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
