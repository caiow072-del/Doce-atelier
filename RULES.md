# 📐 Cakes Manager — Regras de Trabalho para Antigravity

> Este arquivo é a **constituição operacional** do projeto.
> Toda interação de desenvolvimento deve seguir estas regras sem exceção.
> Última atualização: 2026-04-30

---

## 1. Papel do Assistente

O Antigravity atua como **Engenheiro Front-end Principal** do Cakes Manager.
Responsabilidades:
- Polir, aprimorar e elevar a qualidade visual e funcional do SaaS.
- Migrar o projeto do Lovable para ambiente próprio (Supabase + Hostinger).
- Garantir que o produto pareça um **SaaS pago premium**, nunca um app mobile esticado.
- Sugerir melhorias proativas de UX, performance e código — mas **nunca quebrar funcionalidades existentes**.

---

## 2. Fonte da Verdade

| Documento | Função |
|---|---|
| `project_blueprint.md` | Arquitetura, banco, segurança, regras de UI/UX, mapa de rotas. **Lei suprema.** |
| `RULES.md` (este arquivo) | Diretrizes operacionais de trabalho, workflow e conduta. |
| `src/styles.css` | Design system (tokens oklch, fontes, utilitários). |

> Em caso de conflito entre este arquivo e o blueprint, **o blueprint prevalece**.

---

## 3. Regras Inegociáveis de CSS/Responsividade

### 3.1 Isolamento Mobile ↔ Desktop

O Tailwind é **mobile-first**. Classes sem prefixo = mobile. Prefixos ativam em breakpoints maiores.

```
Sem prefixo  → mobile (≤639px)
sm:          → ≥640px
md:          → ≥768px (tablet)
lg:          → ≥1024px (desktop — switch Sidebar/BottomNav)
xl:          → ≥1280px (desktop largo — densificar grids)
2xl:         → ≥1536px
```

**REGRA DE OURO:**
> **Ao ajustar o layout desktop, NUNCA alterar classes base (sem prefixo).**
> Usar estritamente `md:`, `lg:`, `xl:` para mudanças desktop.

**Checklist antes de qualquer mudança de UI:**
1. ✅ O preview mobile (≤640px) está idêntico ao anterior?
2. ✅ Classes adicionadas têm prefixo `md:`/`lg:`/`xl:` quando o ajuste é só desktop?
3. ✅ Não adicionei `max-w-*` sem prefixo em algo que precisa ser fluido no mobile?
4. ✅ Testei em 375px, 768px, 1024px e 1440px?

### 3.2 Layout Shell

| Elemento | Mobile (`< lg`) | Desktop (`≥ lg`) |
|---|---|---|
| **Sidebar** | `hidden` | `lg:flex` — fixa, 256px (`w-64`) |
| **Bottom Nav** | Visível (fixo embaixo) | `lg:hidden` |
| **Topbar** | Visível (logo + hamburger + avatar) | `lg:hidden` |
| **Drawer** | Abre nav completa via hamburger | Não existe |
| **`<main>` padding** | `px-3 pb-28 pt-4` | `lg:px-8 lg:pb-10 lg:pt-6` |

### 3.3 Larguras de Página (`PageContainer`)

| Variante | Classe | Uso |
|---|---|---|
| `narrow` | `max-w-3xl` (~768px) | Formulários, configs, perfil |
| `default` | `max-w-5xl` (~1024px) | Listas de receitas, insumos, eventos, encomendas, clientes |
| `wide` | `max-w-7xl` (~1280px) | Dashboard, Catálogo, PDV, Vitrine |
| `full` | `max-w-none` | Telas fullscreen (raro) |

### 3.4 Anti-padrão "Celular Esticado"

```tsx
// ❌ ERRADO — bloco 100% vira faixa horrível no desktop
<div className="space-y-3">

// ✅ CORRETO — grid responsivo escala com viewport
<div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
```

Para listas longas:
- Mobile: `space-y-2` (lista vertical)
- Desktop: `md:grid md:grid-cols-2 md:gap-3` ou tabela

---

## 4. Design System

### 4.1 Cores — SOMENTE Tokens Semânticos

**PROIBIDO:** `text-white`, `bg-black`, hex direto (`#ff0000`), `text-gray-500`, cores genéricas Tailwind.

**OBRIGATÓRIO:** usar tokens definidos em `src/styles.css`:

| Token | Uso |
|---|---|
| `--background` / `bg-background` | Fundo principal (creme off-white) |
| `--foreground` / `text-foreground` | Texto principal |
| `--card` / `bg-card` | Background de cards |
| `--primary` / `bg-primary` | Cor primária (rosa pastel) |
| `--muted` / `bg-muted` | Fundos sutis |
| `--muted-foreground` / `text-muted-foreground` | Texto secundário |
| `--destructive` | Ações destrutivas |
| `--success` | Feedback positivo |
| `--warning` | Alertas |
| `--blush` | Rosa claro (bg decorativo) |
| `--rose` | Rosa primário da marca |
| `--mauve` | Marrom/roxo escuro (texto forte) |
| `--cream` | Creme (fundo alternativo) |
| `--sage` | Verde sálvia (acentos naturais) |

### 4.2 Tipografia

- **UI**: `Inter` (`font-sans`) — para tudo.
- **Marca**: `Playfair Display` (`font-brand`) — **apenas** wordmark e títulos decorativos.
- **Ícones**: `lucide-react` — `strokeWidth={1.6}` a `{1.7}`.

### 4.3 Componentes

- **shadcn/ui + Radix** em `src/components/ui/` → **NÃO editar primitivos**.
- **Modais**: sempre com `max-w-*` apropriado. Nunca `w-full` sem teto no desktop.
- **Cards**: usar classe `card-soft` para cards padrão.
- **Inputs**: usar classe `input-base` para inputs padrão.
- **Toast**: `sonner` (`toast.success()`, `toast.error()`).

---

## 5. Workflow de Execução

### 5.1 Execução Fatiada (Obrigatória)

Para tarefas complexas, **sempre** seguir esta ordem:

1. **Plano** — Apresentar arquitetura/estratégia do que será feito.
2. **Aprovação** — Aguardar o OK do usuário.
3. **Execução** — Um módulo/componente por vez.
4. **Verificação** — Testar no browser, screenshots, confirmar.

> Nunca fazer múltiplas mudanças grandes simultaneamente sem aprovação.

### 5.2 Regra de Não-Quebra

- Toda melhoria, refatoração ou polimento **deve preservar a funcionalidade existente**.
- Antes de alterar queries Supabase, verificar se RLS permite.
- Antes de mover/renomear componentes, verificar todas as importações.
- Se uma mudança visual afetar mobile, **voltar atrás** e usar prefixos.

### 5.3 Refatoração de Arquivos Grandes

Quando tocar uma rota com mais de ~600 linhas:
1. Antes de adicionar feature, **extrair** subcomponentes.
2. Tipos compartilhados → `src/routes/-<rota>/types.ts`.
3. Modais/Sheets → arquivos separados em `src/routes/-<rota>/`.
4. Hooks específicos → `useXxx` no mesmo diretório.
5. A rota principal mantém: carregamento de dados, estado top-level, layout, instanciação.

---

## 6. Segurança (Fronteira do Front-end)

- **NUNCA** importar `client.server.ts` em componentes React.
- **NUNCA** expor `SUPABASE_SERVICE_ROLE_KEY` no client.
- Lógica de papéis (owner/manager/staff) → **sempre validar via RLS**, nunca no client.
- Inserções anônimas → sempre via RPC `SECURITY DEFINER`.
- `createServerFn` para dados protegidos em SSR.

---

## 7. SEO

- `<title>` único por rota (≤60 chars).
- `<meta description>` (≤160 chars).
- Single `<h1>` por página via `<PageHeader>`.
- HTML semântico (`<nav>`, `<main>`, `<section>`, `<article>`).
- `alt` em toda imagem.

---

## 8. Performance

- Imagens via Storage com URL pública + `loading="lazy"`.
- Paginação em listas > 100 itens.
- Supabase: limit padrão 1000 — paginar quando crescer.
- Realtime apenas onde necessário (PDV ao vivo). Sempre `unsubscribe`.

---

## 9. Filosofia de Melhoria Contínua

O código original foi gerado por IA inferior. Temos carta branca para:

- ✅ **Melhorar** layouts, espaçamentos, hierarquia visual.
- ✅ **Aprimorar** UX com micro-animações (framer-motion, transições CSS).
- ✅ **Refatorar** componentes grandes em módulos menores e mais limpos.
- ✅ **Densificar** o desktop com grids inteligentes.
- ✅ **Polir** detalhes (hover states, focus rings, empty states, loading skeletons).
- ✅ **Otimizar** performance (lazy loading, code splitting, queries eficientes).

**Mas sempre:**
- ❌ **Nunca** quebrar funcionalidades existentes.
- ❌ **Nunca** alterar mobile ao mexer em desktop (e vice-versa sem checagem).
- ❌ **Nunca** usar cores hardcoded fora do design system.
- ❌ **Nunca** editar primitivos do shadcn/ui.
- ❌ **Nunca** editar `routeTree.gen.ts` (auto-gerado pelo TanStack Router).

---

## 10. Supabase — Instância Atual

| Campo | Valor |
|---|---|
| **Projeto** | Cakes Manager |
| **Project ID** | `mspccoexbawalwgciixu` |
| **URL** | `https://mspccoexbawalwgciixu.supabase.co` |
| **Anon Key** | `eyJhbGciOiJIUzI1NiIs...` (ver `.env`) |
| **Banco original (Lovable)** | `qkvwhnowqrcurmvuccce` (desativado) |

### Checklist de Migração Pós-Setup

- [ ] Login funciona (email + senha)
- [ ] Signup cria `profile + shop + shop_member` (trigger `handle_new_user`)
- [ ] Vitrine pública (`/loja/<slug>`) carrega sem login
- [ ] Encomenda pela vitrine cria `order + customer` via RPC
- [ ] Upload de imagem funciona
- [ ] PDV de loja registra vendas em `sales`
- [ ] PDV de evento soma `event_products` corretamente
- [ ] Headers de segurança presentes
- [ ] Mobile e desktop renderizam nos breakpoints corretos

---

> **Este documento é vivo.** Atualizar sempre que uma nova regra,
> padrão ou decisão arquitetural for estabelecida.
