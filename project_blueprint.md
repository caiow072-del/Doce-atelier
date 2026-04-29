# 🍰 Cakes Manager — Project Blueprint & Handover

> Documento Master de arquitetura, segurança e diretrizes de manutenção.
> Mantido como fonte da verdade para qualquer migração de plataforma
> (Lovable → Hostinger / Antigravity / VPS / Vercel / etc.).
>
> Última atualização: 2026-04-29

---

## 1. Visão Geral

**Cakes Manager** é um SaaS para confeitarias / ateliês doces. Ele cobre:

- Gestão de **insumos** (estoque, custo)
- **Receitas** com cálculo automático de custo, margem e preço
- **Encomendas** (pedidos sob demanda)
- **Eventos** (feiras, festivais, pop-ups) com PDV próprio
- **PDV** de loja (vendas avulsas do dia a dia)
- **Catálogo público** + **Vitrine/Storefront** (`/loja/$slug`) consumida por clientes finais sem login
- **Multi-tenant**: 1 usuário pode pertencer a várias `shops` com papéis (`owner`, `manager`, `staff`)

A plataforma foi pensada como **mobile-first** para o uso operacional (PDV, eventos)
e **SaaS desktop elegante** para o backoffice (catálogo, eventos, receitas, dashboard).

---

## 2. Stack Tecnológico

### 2.1 Frontend

| Tecnologia | Versão | Observações |
|---|---|---|
| **React** | 19.2 | Function components + hooks. Sem class components. |
| **TypeScript** | 5.8 | `strict: true`. Toda nova prop/retorno deve ser tipado. |
| **Vite** | 7.3 | Build tool. Plugin `@cloudflare/vite-plugin` para SSR no Worker. |
| **TanStack Router** | 1.168 | File-based routing em `src/routes/`. `routeTree.gen.ts` é auto-gerado — **nunca editar**. |
| **TanStack Start** | 1.167 | SSR + `createServerFn`. Entry: `src/start.ts` (middleware de segurança). |
| **TanStack Query** | 5.83 | Caching de queries server-state quando aplicável. |
| **Tailwind CSS** | 4.2 | Configurado via `@import` no `src/styles.css` (sem `tailwind.config.js`). Tokens em `oklch`. |
| **shadcn/ui + Radix** | last | Componentes em `src/components/ui/`. Não editar manualmente os primitivos. |
| **framer-motion** | 12.38 | Animações pontuais (hero, transições). |
| **lucide-react** | 0.575 | Ícones. Stroke padrão 1.6–1.7. |
| **react-hook-form + zod** | 7.71 / 3.24 | Forms + validação. |
| **sonner** | 2.0 | Toast notifications (`toast.success`, `toast.error`). |
| **zustand** | 5.0 | Estado client-side leve (carrinho do PDV, etc). |
| **date-fns** | 4.1 | Manipulação de datas. |
| **recharts** | 2.15 | Gráficos do dashboard. |
| **embla-carousel** | 8.6 | Carrosséis (vitrine). |

### 2.2 Backend

| Tecnologia | Função |
|---|---|
| **Supabase (Postgres 15)** | Banco principal, auth, storage. |
| **@supabase/supabase-js** 2.104 | SDK. 3 entry points: `client` (browser), `auth-middleware` (server-fn autenticada), `client.server` (admin/service role). |
| **Supabase Auth** | Email + senha. Google OAuth pode ser ativado. **Auto-confirm desligado**. |
| **Supabase Storage** | Buckets públicos: `product-images`, `recipe-images`, `storefront-banners`. |
| **Cloudflare Workers** (via TanStack Start) | Runtime SSR. Compat: `nodejs_compat`. |

### 2.3 Variáveis de Ambiente

**Cliente (expostas no bundle — `import.meta.env`):**
```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

**Servidor (`process.env`, nunca expor):**
```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY     # APENAS server. Bypassa RLS.
SUPABASE_DB_URL               # Conexão direta ao Postgres (migrations)
LOVABLE_API_KEY               # Lovable AI Gateway (opcional)
```

> **Regra de ouro pós-migração:** o `SUPABASE_SERVICE_ROLE_KEY` jamais
> deve aparecer em arquivo importado por componente React. Apenas em
> `*.server.ts` ou dentro de `.handler()` de `createServerFn`.

---

## 3. Arquitetura de Banco de Dados

### 3.1 Convenções gerais

- Todas as tabelas vivem no schema `public`.
- IDs: `uuid` com `gen_random_uuid()`.
- Timestamps: `created_at` e `updated_at` com default `now()`. Trigger `touch_updated_at()` atualiza `updated_at`.
- **Multi-tenant**: praticamente toda tabela tem `shop_id uuid NOT NULL`.
- Sem foreign keys explícitas declaradas (relacionamento por convenção `*_id`); RLS garante consistência de tenant.
- **Não usar foreign key direta para `auth.users`**. Usar `profiles` no schema `public`.

### 3.2 Tabelas (resumo funcional)

| Tabela | Para quê |
|---|---|
| `profiles` | Dados extras do usuário (nome, avatar). 1:1 com `auth.users`. Criada automaticamente via trigger `handle_new_user()`. |
| `shops` | Lojas/ateliês. Tenant raiz. Campos: `name`, `slug`, `whatsapp`, `description`, `logo_url`, `theme`, `target_margin`, `created_by`. |
| `shop_members` | Junção user↔shop com `role` (`owner`/`manager`/`staff`). |
| `shop_storefront` | Configuração da vitrine pública (hero, banners, horários, entrega, redes sociais, seções). |
| `shop_visits` | Telemetria anônima de visitas à vitrine. |
| `event_types` | Tipos de eventos personalizados por loja (feira, casamento, etc). |
| `events` | Evento com data, local, recorrência, taxa, abertura de caixa, fechamento. |
| `event_occurrences` | Ocorrências de eventos recorrentes. |
| `event_products` | Produtos vendidos no PDV de evento (com `planned_qty` / `sold_qty`). |
| `event_recipes` | Receitas associadas a um evento (produção). |
| `event_tasks` | Checklist de preparação por dia. |
| `ingredients` | Insumos de estoque (preço pago, qty da embalagem, estoque). |
| `recipes` | Receitas com `labor_cost`, `packaging_cost`, `target_margin`, `waste_pct`, `public_price`, `promo_price`, `slice_price`. |
| `recipe_ingredients` | Junção receita↔insumo com quantidade. |
| `pdv_products` | Catálogo do PDV de loja (avulso). |
| `customers` | Clientes da loja. |
| `orders` | Encomendas. Inclui `items jsonb`, status, entrega, depósito. |
| `sales` | Linhas de venda (PDV). Suporta refund. |

### 3.3 Segurança — Modelo RLS

**Princípios:**
1. **Toda tabela tem RLS habilitada.**
2. Acesso autenticado é validado via duas funções `SECURITY DEFINER` com `search_path = public`:
   - `is_shop_member(_shop_id, _user_id) → boolean`
   - `has_shop_role(_shop_id, _user_id, _roles[]) → boolean`
3. **Leitura**: `is_shop_member(...)`. **Escrita**: `has_shop_role(..., ARRAY['owner','manager'])`.
4. **NUNCA** colocar lógica de papel no client. Sempre validar via RLS.

**Acesso anônimo (storefront público):**
- Anônimo (`anon`) **não** lê diretamente `shops` nem `recipes` para evitar vazar campos sensíveis (`target_margin`, `labor_cost`, `created_by`, `whatsapp` interno, etc).
- Anônimo lê apenas as **views públicas**:
  - `shops_public` — apenas campos seguros para a vitrine (`id, name, slug, whatsapp, description, logo_url, theme`).
  - `recipes_public` — apenas campos de exibição (`id, name, description, image_url, public_price, promo_price, slice_price, category, is_featured, catalog_position`) e somente onde `show_in_catalog = true`.
- `shop_storefront` é lido público diretamente (não tem campos sensíveis).
- `shop_visits`: anônimo pode INSERT (telemetria), mas SELECT só para membros.

**Inserção anônima (encomendas pela vitrine):**
- Anônimo **não** insere em `customers` nem `orders` diretamente.
- Tudo passa pela **RPC `create_storefront_order(...)`** (`SECURITY DEFINER`) que:
  - Valida tamanho/sanidade dos campos (nome ≤120, telefone ≤30, total entre 0 e 1.000.000, data futura).
  - Reaproveita `customer` por `(shop_id, phone)`.
  - Cria `order` com `source = 'storefront'`, `status = 'orcamento'`.
  - Retorna `uuid` do pedido.

**Storage:**
- Listagem dos buckets bloqueada para anônimo. Acesso direto por URL pública continua funcionando (buckets `public = true`).

### 3.4 RPCs / Functions principais

| Função | Tipo | Para quê |
|---|---|---|
| `handle_new_user()` | Trigger `auth.users` | Cria `profiles` + `shops` + `shop_members` (owner) ao registrar. |
| `is_shop_member(_shop_id, _user_id)` | `SECURITY DEFINER` | Checa pertencimento. Usada em RLS de leitura. |
| `has_shop_role(_shop_id, _user_id, _roles[])` | `SECURITY DEFINER` | Checa papel. Usada em RLS de escrita. |
| `create_storefront_order(...)` | `SECURITY DEFINER` | Cria pedido público a partir da vitrine. |
| `touch_updated_at()` | Trigger | Atualiza `updated_at`. |

---

## 4. Arquitetura UI/UX (CRÍTICO)

> Esta seção é **inegociável**. Toda mudança de layout deve respeitar
> as regras abaixo, sob pena de degradar o produto a "celular esticado
> no monitor" — que é exatamente o anti-padrão que estamos combatendo.

### 4.1 Filosofia visual

- **Estilo**: SaaS profissional e elegante, com toque artesanal (paleta blush/rose/mauve, serif Playfair na marca).
- **Densidade**: respiração generosa no mobile; **densidade controlada** no desktop com grids reais.
- **Tipografia**: `Inter` para UI, `Playfair Display` (`.font-brand`) só para wordmark e títulos decorativos.
- **Cores**: **somente tokens semânticos** definidos em `src/styles.css` (`--blush`, `--rose`, `--mauve`, `--cream`, `--sage`, `--card`, `--background`, `--muted-foreground` etc.). **Proibido** `text-white`, `bg-black`, hex direto em componentes.

### 4.2 Layout shell — `src/components/AppShell.tsx`

| Breakpoint | Estrutura |
|---|---|
| `< lg` (mobile/tablet) | Topbar fixa (logo + hamburger + avatar) → `<main>` → **Bottom Nav fixa** com 4 atalhos (Início, Eventos, Pedidos, PDV). Drawer lateral abre nav completa. |
| `>= lg` (desktop ≥1024px) | **Sidebar fixa** 256px (`w-64`) com nav completa, switcher de loja, card de usuário. Topbar mobile escondida. Bottom nav escondida. |

**Regras estritas:**
- **Sidebar = só desktop** (`lg:flex hidden`).
- **Bottom nav = só mobile** (`lg:hidden`).
- **`<main>` não tem `max-width`**. Cada página define sua própria via `<PageContainer>`.
- O shell aplica padding horizontal responsivo: `px-3 sm:px-6 lg:px-8`.
- Padding inferior aumenta no mobile (`pb-28`) para folgar a bottom nav fixa; no desktop volta a `pb-10`.

### 4.3 Larguras de página — `src/components/PageContainer.tsx`

Toda página é envolvida por `<PageContainer width="...">`. As larguras são padronizadas:

| Variante | `max-w-*` | px aprox. | Quando usar |
|---|---|---|---|
| `narrow` | `max-w-3xl` | ~768px | Formulários, configurações, perfil |
| `default` | `max-w-5xl` | ~1024px | Listas de receitas, insumos, eventos, encomendas, clientes |
| `wide` | `max-w-7xl` | ~1280px | **Dashboard, Catálogo, PDV, Vitrine** — telas com grids densos |
| `full` | `max-w-none` | — | Telas que precisam ocupar 100% (raro: festival fullscreen, etc) |

> **Por que isso existe:** evitar a "tela esticada". Um card de KPI
> que no mobile ocupa 100% **não pode** ocupar 100% num monitor de
> 1920px — vira faixa horrível. Por isso o `wide` é o teto e os grids
> internos têm `grid-cols-2 md:grid-cols-3 xl:grid-cols-4` etc.

### 4.4 Regra de Grids Dinâmicos (anti "celular esticado")

Para cards de KPI, produtos, eventos:

```tsx
// ✅ CORRETO — grid responsivo escala com o viewport
<div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">

// ❌ ERRADO — bloco único 100% que vira faixa no desktop
<div className="space-y-3">
```

Para listas longas:
- Mobile: lista vertical (`space-y-2`).
- Desktop: 2 colunas (`md:grid md:grid-cols-2 md:gap-3`) ou tabela.

### 4.5 Modais e Sheets

| Padrão | Uso |
|---|---|
| **Drawer/Sheet lateral direito** (`max-w-md`) | Configuração contextual (ex: `ManageProductsSheet` do PDV). Abre por cima, não desloca o layout. |
| **Modal central** (`max-w-lg` para forms, `max-w-2xl` para conteúdo) | Ações pontuais (adicionar produto, carrinho de checkout). **Nunca** ocupar a tela inteira no desktop. |
| **Bottom sheet** (vaul) | Ações rápidas no mobile. |

> **Regra:** todo modal precisa ter `max-w-*` apropriado. Não deixar
> `w-full` sem teto em desktop.

### 4.6 ⚠️ REGRA CRÍTICA DE RESPONSIVIDADE

> **NUNCA alterar o layout mobile ao fazer ajustes exclusivos de desktop.**
>
> Tailwind é mobile-first: as classes sem prefixo (`grid-cols-2`)
> valem para todos os breakpoints. As classes com prefixo
> (`md:`, `lg:`, `xl:`) só ativam acima daquele breakpoint.
>
> **Exemplos:**
>
> ```tsx
> // ❌ ERRADO — mexeu em mobile sem querer
> <div className="grid-cols-4 gap-2">
>
> // ✅ CORRETO — mobile mantido, ajuste é exclusivo desktop
> <div className="grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-2">
> ```
>
> **Checklist antes de fazer commit de ajuste de layout:**
> 1. Abri o preview no viewport mobile (≤640px) e o layout está idêntico ao anterior?
> 2. As classes que adicionei têm prefixo `md:`/`lg:`/`xl:` quando o ajuste é só desktop?
> 3. Não adicionei `max-w-*` sem prefixo em algo que precisa ser fluido no mobile?
>
> **Responsabilidades CSS estritamente separadas:**
> - Estilo base (sem prefixo) = mobile.
> - `md:` = tablet (≥768px).
> - `lg:` = desktop (≥1024px) — **único breakpoint usado para Sidebar/BottomNav switch**.
> - `xl:` = desktop largo (≥1280px) — para densificar grids.

### 4.7 Headers de página

Usar `<PageHeader>` (`src/components/PageHeader.tsx`) com `title`, `subtitle`,
e slot opcional `actions` (botões à direita). Uma única `<h1>` por página
(SEO). Subtítulo curto, em `text-muted-foreground`.

---

## 5. Mapa de Rotas e Componentes

### 5.1 Estrutura `src/routes/`

```
src/routes/
├── __root.tsx              # Layout raiz (html/head/body, providers, AppShell)
├── index.tsx               # Dashboard (/)
├── login.tsx               # /login (única rota fora do AppShell)
├── insumos.tsx             # /insumos
├── receitas.tsx            # /receitas
├── clientes.tsx            # /clientes
├── encomendas.tsx          # /encomendas
├── eventos.tsx             # /eventos    [GIGANTE — ver §5.3]
├── calendario.tsx          # /calendario
├── catalogo.tsx            # /catalogo
├── vitrine.tsx             # /vitrine    (config da storefront)
├── pdv.tsx                 # /pdv         [GIGANTE — ver §5.3]
├── festival.tsx            # /festival    (modo apresentação fullscreen)
├── loja.$slug.tsx          # /loja/:slug  (PÚBLICO — anon)
├── -loja/                  # subcomponentes do storefront
│   ├── HeroCardapio.tsx
│   ├── ProductListHorizontal.tsx
│   ├── CategoryPicker.tsx
│   ├── BottomNav.tsx
│   └── HoursEditor.tsx
└── -pdv/                   # subcomponentes do PDV
    ├── types.ts            # Tipos compartilhados (Product, EventProduct, fmtBRL)
    ├── AddProductModal.tsx # Modal "adicionar produto" (loja ou evento, da receita ou avulso)
    └── ManageProductsSheet.tsx # Sheet lateral de CRUD do PDV de loja
```

> **Convenção TanStack:** pastas iniciadas com `-` (ex: `-pdv/`, `-loja/`)
> são **ignoradas** pelo file-based routing. É onde colocamos componentes
> usados apenas por aquela rota — mantém colocation sem poluir as rotas.

### 5.2 Componentes globais

| Caminho | Função |
|---|---|
| `src/components/AppShell.tsx` | Layout principal autenticado (sidebar/bottomnav). |
| `src/components/PageContainer.tsx` | Wrapper de largura por página. |
| `src/components/PageHeader.tsx` | Cabeçalho de página padronizado. |
| `src/components/InlineEdit.tsx` | Edição inline de campos. |
| `src/components/OnboardingChecklist.tsx` | Checklist de primeira execução. |
| `src/components/ui/*` | shadcn/ui (não editar primitivos). |

### 5.3 Estratégia de "fatiamento" de páginas gigantes

Páginas como `pdv.tsx` (~1145 linhas originais) e `eventos.tsx` (~1960 linhas)
ficam inviáveis de manter num único arquivo: re-render desnecessário,
diff conflitante, code-splitter do Vite/TanStack reclama, e a leitura
no editor vira um inferno.

**Padrão adotado:**

1. **Tipos compartilhados** → `src/routes/-<rota>/types.ts`.
2. **Sub-views modais/sheets** → arquivos separados em `src/routes/-<rota>/`:
   - Cada modal vira seu próprio componente com props tipadas.
   - O componente recebe callbacks (`onClose`, `onChange`, `onAdded...`) em vez de manipular estado global.
3. **Hooks específicos** → `useXxx` colocados no mesmo diretório se forem reutilizados.
4. A rota principal (`pdv.tsx`) fica responsável por:
   - Carregar dados (queries Supabase).
   - Estado top-level (loja atual, evento selecionado, modais abertos).
   - Renderizar o layout e instanciar os subcomponentes.

**Exemplo concreto — PDV foi reduzido de 1145 → 765 linhas extraindo:**
- `types.ts` (tipos `Product`, `EventProduct`, helper `fmtBRL`)
- `AddProductModal.tsx` (modal de adicionar — funciona em modo `shop` ou `event`)
- `ManageProductsSheet.tsx` (sheet lateral de CRUD)

**Quando refatorar:** ao tocar uma rota que passou de ~600 linhas, **antes**
de adicionar feature nova, extrair o que está crescendo. Não acumular dívida.

### 5.4 Carregamento de dados

- **Browser** (componentes): `import { supabase } from "@/integrations/supabase/client"`. Respeita RLS como o usuário logado.
- **Server functions autenticadas**: `createServerFn().middleware([requireSupabaseAuth])`. Use para SSR de dados protegidos.
- **Admin/service role**: apenas em `*.server.ts` quando precisar bypassar RLS (jobs, webhooks).
- **Loader isomórfico** NUNCA importa `client.server`. Sempre via `createServerFn`.

### 5.5 Segurança no edge / TanStack Start

`src/start.ts` aplica via middleware global em toda resposta server-rendered:

- **CSP** restritiva (default-src self; libera Supabase REST + Realtime + Google Fonts).
- `X-Frame-Options: DENY` (não pode ser embedado).
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy`: bloqueia camera/mic/geo.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`.

> Em qualquer migração, replicar esses headers (Nginx, Cloudflare,
> Vercel headers config, etc.).

---

## 6. Diretrizes de Manutenção

### 6.1 Aspecto visual — não-negociável

- O produto deve sempre **parecer um SaaS pago e elegante**, não um app mobile com layout esticado.
- **Grids dinâmicos** com breakpoints reais (`md:`, `lg:`, `xl:`).
- **Densidade adequada por viewport**: cards menores e mais colunas no desktop; cards grandes e empilhados no mobile.
- **Tokens semânticos sempre**. Cores hardcoded reprovam o code review.
- **Animações sutis**. Framer-motion para entrada de hero/cards, não para tudo.

### 6.2 Antes de cada mudança de UI

1. Identificar se é mobile, desktop ou ambos.
2. Se for **só desktop**: usar prefixos (`lg:`, `xl:`) e **não tocar** as classes base.
3. Se for **só mobile**: alterar as classes base e usar `lg:` para resetar no desktop se necessário.
4. Verificar nos viewports 375px, 768px, 1024px e 1440px antes de fechar.
5. Se acrescentou um modal: tem `max-w-*` apropriado? Faz sentido no desktop?

### 6.3 Antes de mexer no banco

1. Toda alteração via migration SQL versionada (`supabase/migrations/`).
2. Toda nova tabela: RLS **habilitada** + políticas para `authenticated` (member/role) + decidir explicitamente sobre `anon`.
3. Campos sensíveis (custo, margem, telefone interno) nunca em policies de `anon` — usar **view pública**.
4. Inserções anônimas: sempre via **RPC `SECURITY DEFINER`** com validação dentro.
5. Funções `SECURITY DEFINER` precisam de `SET search_path = public`.
6. Tabelas user-scoped: **não** referenciar `auth.users` por FK; usar `profiles`.

### 6.4 Antes de extrair componente

- Existe outro lugar usando lógica parecida? Considerar componente compartilhado em `src/components/`.
- Se é específico da rota: vai para `src/routes/-<rota>/`.
- Tipos compartilhados: `src/routes/-<rota>/types.ts`.
- Props com callbacks tipados (não passar setters do React diretamente).

### 6.5 Antes de adicionar dependência

- Existe equivalente já instalado? (Radix, lucide, framer-motion cobrem muita coisa).
- Funciona em **Cloudflare Worker / edge**? Pacotes Node-only quebram SSR (ver `<server-runtime>` nas docs do projeto).
- Tamanho do bundle: evitar libs gigantes para usos pontuais.

### 6.6 Performance

- Imagens via Storage com URL pública direta. Considerar `<img loading="lazy">` em listas longas.
- Paginação em listas que podem passar de 100 itens.
- Supabase tem **limit padrão de 1000 linhas por query** — sempre paginar quando crescer.
- Realtime apenas onde realmente preciso (PDV ao vivo). Lembrar de `unsubscribe`.

### 6.7 SEO

- `<title>` único por rota (≤60 chars), `meta description` (≤160 chars).
- Single `<h1>` por página.
- HTML semântico (`<nav>`, `<main>`, `<section>`, `<article>`).
- `alt` em toda imagem.
- `og:image` no leaf route (vitrine usa o banner da loja).

---

## 7. Pacote de Migração — Checklist

Quando for sair do Lovable para outra plataforma (Hostinger / Vercel / VPS):

### 7.1 Backend (Supabase próprio)

1. Criar conta em supabase.com e novo projeto.
2. Exportar SQL completo do projeto atual (`pg_dump --schema-only` + dados se quiser):
   - Tabelas, RLS policies, functions, triggers, **views públicas** (`shops_public`, `recipes_public`).
3. Recriar buckets de storage: `product-images`, `recipe-images`, `storefront-banners` (todos `public = true`) e suas policies.
4. Configurar Auth: email+senha, confirmação obrigatória, OAuth Google se desejar.
5. Replicar secrets (LOVABLE_API_KEY se usar AI gateway próprio, etc).
6. Recriar trigger `on_auth_user_created → handle_new_user()`.

### 7.2 Frontend

1. Atualizar `.env`:
   ```
   VITE_SUPABASE_URL=<nova_url>
   VITE_SUPABASE_PUBLISHABLE_KEY=<nova_anon>
   VITE_SUPABASE_PROJECT_ID=<novo_ref>
   SUPABASE_URL=<nova_url>
   SUPABASE_PUBLISHABLE_KEY=<nova_anon>
   SUPABASE_SERVICE_ROLE_KEY=<nova_service>
   ```
2. Build: `bun install && bun run build`.
3. Deploy:
   - **Hostinger Node.js**: rodar `node .output/server/index.mjs` (ou equivalente do build TanStack Start). Verificar se a hospedagem suporta SSR Node 20+.
   - **Vercel/Netlify**: adapter padrão funciona.
   - **VPS**: pm2 + nginx reverse proxy. Replicar headers de segurança no nginx.

### 7.3 DNS / Domínio

- Apontar A/CNAME para o novo host.
- Configurar SSL (Let's Encrypt se VPS).
- Replicar headers de segurança (CSP, HSTS, etc) no servidor web — eles
  não são propriedade do app, são do edge.

### 7.4 Verificação pós-migração

- [ ] Login funciona (email + senha).
- [ ] Signup cria `profile + shop + shop_member` (trigger).
- [ ] Vitrine pública (`/loja/<slug>`) carrega sem login.
- [ ] Encomenda pela vitrine cria `order + customer` via RPC.
- [ ] Upload de imagem (produto, receita, banner) funciona.
- [ ] PDV de loja vende e registra em `sales`.
- [ ] PDV de evento: `event_products` somam corretamente.
- [ ] Headers de segurança presentes (testar com securityheaders.com).
- [ ] Mobile e desktop renderizam corretamente nos breakpoints.

---

## 8. Glossário rápido

| Termo | Significado |
|---|---|
| **Shop** | Tenant raiz. Ateliê/confeitaria. |
| **Storefront / Vitrine** | Página pública `/loja/:slug` que clientes finais veem. |
| **PDV** | Ponto de venda — modo operacional para registrar vendas (loja ou evento). |
| **Encomenda** | Pedido sob demanda, com data de entrega. |
| **Evento** | Feira/pop-up com PDV próprio, produção planejada e fechamento de caixa. |
| **RLS** | Row-Level Security do Postgres. |
| **RPC** | Remote Procedure Call — função do banco chamada via `supabase.rpc('...')`. |

---

> Mantenha este documento vivo. Toda decisão arquitetural relevante
> (nova regra de UI, nova tabela, nova RPC, mudança de stack) deve
> ser refletida aqui antes do merge.
