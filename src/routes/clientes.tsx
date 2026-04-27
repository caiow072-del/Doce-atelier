import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  Mail,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  MessageCircle,
  Map as MapIcon,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Cakes Manager" },
      {
        name: "description",
        content: "Carteira de clientes da confeitaria — contatos, endereços e histórico.",
      },
    ],
  }),
  component: ClientesPage,
});

export type Customer = {
  id: string;
  shop_id: string;
  user_id: string | null;
  name: string;
  phone: string;
  address: string;
  email: string | null;
  notes: string | null;
};

const customerSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(100, "Nome muito longo"),
  phone: z
    .string()
    .trim()
    .min(8, "Telefone inválido")
    .max(20, "Telefone muito longo")
    .regex(/^[0-9 +()\-]+$/, "Use só números, espaço, +, ( ) e -"),
  address: z.string().trim().min(3, "Endereço muito curto").max(255, "Endereço muito longo"),
  email: z
    .string()
    .trim()
    .max(255)
    .email("E-mail inválido")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(500, "Observações muito longas").optional().or(z.literal("")),
});

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

function ClientesPage() {
  const { currentShop } = useAuth();
  const shopId = currentShop?.shop_id;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("shop_id", shopId)
      .order("name");
    if (error) toast.error("Erro ao carregar clientes: " + error.message);
    setCustomers((data ?? []) as Customer[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("customers").delete().eq("id", toDelete.id);
    setDeleting(false);
    if (error) {
      toast.error("Não foi possível excluir: " + error.message);
      return;
    }
    toast.success("Cliente excluído");
    setCustomers((s) => s.filter((c) => c.id !== toDelete.id));
    setToDelete(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sua carteira"
        title="Clientes"
        subtitle="Contatos, endereços e atalhos de WhatsApp para encomendas mais rápidas."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, WhatsApp ou endereço..."
            className="w-full rounded-2xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-mauve outline-none focus:border-rose"
          />
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-mauve px-4 py-2.5 text-sm font-medium text-cream hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo cliente
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-mauve">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((c) => (
            <CustomerCard
              key={c.id}
              c={c}
              onEdit={() => setEditing(c)}
              onDelete={() => setToDelete(c)}
            />
          ))}
        </div>
      )}

      {(creating || editing) && shopId && (
        <CustomerForm
          shopId={shopId}
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await load();
          }}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && (
                <>
                  O cliente <span className="font-semibold">{toDelete.name}</span> será removido.
                  As encomendas existentes ficam preservadas, mas perdem o vínculo. Essa ação não
                  pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid place-items-center rounded-3xl border-2 border-dashed border-border bg-card/40 p-12 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blush/60">
        <Users className="h-7 w-7 text-mauve" strokeWidth={1.4} />
      </div>
      <h2 className="mt-4 font-display text-2xl italic text-mauve">Nenhum cliente ainda</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Cadastre clientes para reaproveitar contato, endereço e abrir o WhatsApp em um toque
        quando uma encomenda chegar.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-mauve px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Cadastrar primeiro cliente
      </button>
    </div>
  );
}

function CustomerCard({
  c,
  onEdit,
  onDelete,
}: {
  c: Customer;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const wa = digitsOnly(c.phone);
  const waLink = wa ? `https://wa.me/${wa.startsWith("55") ? wa : "55" + wa}` : null;
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    c.address
  )}`;

  return (
    <div className="card-soft p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-lg italic text-mauve truncate">{c.name}</p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Phone className="h-3 w-3" /> {c.phone}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="rounded-lg bg-blush/40 p-2 text-mauve hover:bg-blush/60"
            aria-label="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive/20"
            aria-label="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="mt-2 inline-flex items-start gap-1 text-xs text-mauve/80">
        <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-rose" /> {c.address}
      </p>
      {c.email && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Mail className="h-3 w-3" /> {c.email}
        </p>
      )}
      {c.notes && (
        <p className="mt-2 line-clamp-2 rounded-lg bg-blush/30 px-2 py-1 text-[11px] text-mauve/80">
          {c.notes}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-success/15 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/25"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        )}
        <a
          href={mapLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-blush/50 px-3 py-1.5 text-xs font-medium text-mauve hover:bg-blush/70"
        >
          <MapIcon className="h-3.5 w-3.5" /> Localização
        </a>
      </div>
    </div>
  );
}

function CustomerForm({
  shopId,
  initial,
  onClose,
  onSaved,
}: {
  shopId: string;
  initial: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = customerSchema.safeParse({ name, phone, address, email, notes });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const payload = {
      shop_id: shopId,
      name: parsed.data.name,
      phone: parsed.data.phone,
      address: parsed.data.address,
      email: parsed.data.email ? parsed.data.email : null,
      notes: parsed.data.notes ? parsed.data.notes : null,
    };
    let error;
    if (initial) {
      ({ error } = await supabase.from("customers").update(payload).eq("id", initial.id));
    } else {
      ({ error } = await supabase.from("customers").insert(payload));
    }
    setSaving(false);
    if (error) {
      if (error.code === "23505")
        toast.error("Já existe um cliente com esse telefone nesta loja.");
      else toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(initial ? "Cliente atualizado" : "Cliente cadastrado");
    onSaved();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-mauve/30 backdrop-blur-sm sm:items-center"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-6 pb-10 sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">
            {initial ? "Editar cliente" : "Novo cliente"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <FormField label="Nome *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Maria Silva"
              maxLength={100}
              className="input-base"
            />
          </FormField>
          <FormField label="WhatsApp / telefone *" hint="Ex: (11) 91234-5678">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              maxLength={20}
              className="input-base"
            />
          </FormField>
          <FormField label="Endereço *" hint="Rua, número, bairro, cidade — usado para abrir no mapa.">
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              maxLength={255}
              className="input-base resize-none"
              placeholder="Rua das Flores, 123 — Centro, Cidade"
            />
          </FormField>
          <FormField label="E-mail (opcional)">
            <input
              type="email"
              value={email ?? ""}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              className="input-base"
            />
          </FormField>
          <FormField
            label="Observações (opcional)"
            hint="Sabor preferido, alergias, datas importantes..."
          >
            <textarea
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              className="input-base resize-none"
            />
          </FormField>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-mauve py-3.5 text-sm font-semibold text-cream disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {initial ? "Salvar alterações" : "Cadastrar cliente"}
        </button>
      </form>
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-rose">{label}</label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
