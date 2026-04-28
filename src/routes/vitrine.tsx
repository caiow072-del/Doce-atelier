// /vitrine — entry point that just redirects the user into the live editor
// of their own storefront. The actual editing UX lives inside /loja/{slug}?edit=1.

import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2, Globe } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/vitrine")({
  head: () => ({
    meta: [
      { title: "Minha vitrine — Cakes Manager" },
      { name: "description", content: "Edite sua loja virtual ao vivo." },
    ],
  }),
  component: VitrineRedirect,
});

function VitrineRedirect() {
  const { currentShop, loading } = useAuth();
  const slug = currentShop?.shops.slug;

  if (loading) {
    return (
      <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-mauve" /></div>
    );
  }
  if (!slug) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <Globe className="h-8 w-8 text-mauve/40" />
        <p className="mt-3 text-sm text-mauve">Nenhuma loja vinculada à sua conta.</p>
      </div>
    );
  }
  return <Navigate to="/loja/$slug" params={{ slug }} search={{ edit: "1" } as any} replace />;
}
