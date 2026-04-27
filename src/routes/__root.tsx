import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AppLayout } from "@/components/AppLayout";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Jack Menezes Cakes Manager — Gestão doce e simples" },
      {
        name: "description",
        content:
          "Gestão de confeitaria simples e visual: festivais de sábado, ficha técnica automática, PDV no celular.",
      },
      { property: "og:title", content: "Jack Menezes Cakes Manager" },
      { property: "og:description", content: "Gestão doce, simples e elegante para sua confeitaria." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: () => <AppLayout />,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-display text-6xl italic text-mauve">404</h1>
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

function _Outlet() {
  return <Outlet />;
}
