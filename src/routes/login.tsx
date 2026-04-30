import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Mail, Lock, ChefHat, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Doce Atelier" },
      { name: "description", content: "Acesse o painel da sua confeitaria." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { session } = useAuth();

  useEffect(() => {
    if (session) navigate({ to: "/" });
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName, shop_name: shopName },
          },
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      navigate({ to: "/" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      setError(
        msg.includes("Invalid login")
          ? "Email ou senha incorretos."
          : msg.includes("already registered")
          ? "Este email já está cadastrado. Faça login."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="floral-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-petal backdrop-blur-xl lg:grid-cols-2">
        {/* Side art */}
        <div className="relative hidden bg-gradient-to-br from-blush via-rose/40 to-cream p-12 lg:block">
          <div className="absolute inset-0 opacity-40" style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, oklch(0.93 0.04 18 / 0.8), transparent 50%), radial-gradient(circle at 80% 80%, oklch(0.78 0.09 15 / 0.6), transparent 50%)",
          }} />
          <div className="relative flex h-full flex-col">
            <div className="flex flex-col items-center gap-4">
              <img src="/logo.svg" alt="Doce Atelier" className="h-28 w-auto object-contain" />
            </div>

            <div className="mt-auto">
              <h1 className="font-brand text-5xl leading-tight text-mauve">
                Sua confeitaria,<br />no seu controle.
              </h1>
              <p className="mt-4 max-w-sm text-sm text-mauve/80">
                Receitas, festivais, encomendas e vitrine — tudo em um painel pensado para confeiteiras de verdade.
              </p>
              <div className="mt-8 flex items-center gap-2 text-mauve/70">
                <Sparkles className="h-4 w-4" />
                <p className="text-xs uppercase tracking-widest">Doce, simples, profissional</p>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-8 sm:p-12">
          <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
            <img src="/logo.svg" alt="Doce Atelier" className="h-24 w-auto object-contain" />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-mauve">
            {mode === "signin" ? "Bem-vinda de volta" : "Criar sua conta"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Entre para gerenciar seu próximo festival."
              : "Em segundos sua confeitaria estará pronta."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <Field label="Seu nome" icon={<ChefHat className="h-4 w-4" />}>
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jacqueline Menezes"
                    className="w-full bg-transparent outline-none"
                  />
                </Field>
                <Field label="Nome da confeitaria" icon={<Sparkles className="h-4 w-4" />}>
                  <input
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Jack Menezes Cakes"
                    className="w-full bg-transparent outline-none"
                  />
                </Field>
              </>
            )}
            <Field label="Email" icon={<Mail className="h-4 w-4" />}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className="w-full bg-transparent outline-none"
              />
            </Field>
            <Field label="Senha" icon={<Lock className="h-4 w-4" />}>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent outline-none"
              />
            </Field>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose to-blush px-4 py-3 font-medium text-mauve shadow-soft transition hover:shadow-petal disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                Ainda não tem conta?{" "}
                <button onClick={() => setMode("signup")} className="font-medium text-mauve underline-offset-2 hover:underline">
                  Cadastre-se grátis
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button onClick={() => setMode("signin")} className="font-medium text-mauve underline-offset-2 hover:underline">
                  Entre aqui
                </button>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Ao continuar, você concorda com os termos de uso. <br />
            <Link to="/" className="underline-offset-2 hover:underline">Voltar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/70 px-3.5 py-3 text-sm text-mauve transition focus-within:border-rose">
        <span className="text-rose">{icon}</span>
        {children}
      </div>
    </label>
  );
}
