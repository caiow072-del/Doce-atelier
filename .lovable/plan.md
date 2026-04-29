# Roteiro de melhorias — 3 partes

Vou dividir as melhorias do site em **3 entregas sequenciais**, começando agora pela **Parte 1**. Cada parte é independente e deixa o app utilizável ao final.

---

## Parte 1 — Mobile, UX e Fluxo (INICIAR AGORA)

Foco em deixar a navegação fluida no celular e remover scrolls desnecessários.

1. **Eliminar scroll horizontal no mobile** em todas as páginas:
   - `pdv.tsx` linha 268: trocar `overflow-x-auto` por grid/flex-wrap responsivo.
   - `eventos.tsx`, `receitas.tsx`, `insumos.tsx`, `clientes.tsx`, `encomendas.tsx`, `catalogo.tsx`: revisar tabelas/listas e converter para cards empilhados no mobile (`md:table` + `card list` no mobile).
   - Garantir `min-w-0` e `truncate` em headers e linhas longas.

2. **Corrigir corte na direita da aba de Eventos no mobile** (390px):
   - Auditar paddings do `PageContainer` + cards internos da `eventos.tsx`.
   - Trocar `whitespace-nowrap` indevido em badges/preços por `flex-wrap`.
   - Ajustar largura do card "evento atual" para usar `w-full` real sem `min-w` fixo.

3. **Onboarding curto para novos usuários** (3 passos):
   - Modal/checklist na home (`index.tsx`): "Crie sua loja → Adicione 1 insumo → Crie 1 receita".
   - Persistência via `localStorage` + flag em `profiles`.

4. **Consistência visual**:
   - Padronizar tamanhos de ícones (`size-4` em ações, `size-5` em headers).
   - Revisar uso de tokens (`text-muted-foreground`, `bg-muted/40`) em vez de cores hardcoded.

**Entregável:** App fluido no mobile (sem scroll lateral), sem corte na tela de Eventos, onboarding inicial, visual consistente.

---

## Parte 2 — PDV e Vitrine

Profissionalizar a venda e o storefront público.

1. **PDV (`pdv.tsx`)**:
   - Suporte a leitor de **código de barras** (input com auto-focus + listener Enter).
   - **Estorno/cancelamento de venda** (com motivo, devolve estoque).
   - **Cupons de desconto** (tabela `coupons` + validação no checkout).
   - **Atalhos de teclado** (F2 finalizar, F4 limpar, etc.).
   - Mostrar troco em destaque + impressão de cupom simples (window.print de uma view dedicada).

2. **Vitrine pública (`loja.$slug.tsx`)**:
   - **SEO por produto**: head dinâmico com og:image, og:title, description.
   - **Preview** antes de publicar (modo `?preview=1` já parcial → completar).
   - **Analytics básico** (contador de visitas/cliques em produto, tabela `shop_analytics`).
   - **Seções configuráveis** (destaques, categorias) com drag-to-reorder.
   - **Pixel/links de WhatsApp** com mensagem pré-preenchida por produto.

3. **Encomendas a partir da vitrine**:
   - Botão "Encomendar" cria pré-encomenda em `orders` ligada ao cliente (cria se não existir).

**Entregável:** PDV de balcão funcional + vitrine com SEO, preview e analytics.

---

## Parte 3 — Segurança, Performance e Refactor

Endurecer o backend e ganhar velocidade.

1. **Segurança**:
   - **RLS estrita em `sales`**: separar policies de SELECT/INSERT/UPDATE/DELETE; restringir DELETE/UPDATE a owner/admin do shop.
   - **Rate limiting** na vitrine pública (edge function com KV/Postgres counter por IP).
   - **Auditoria** (tabela `audit_log` para mudanças sensíveis: produtos, preços, vendas).
   - **LGPD**: exportar dados do cliente + deletar conta (RPC).
   - Rodar `security--run_security_scan` e corrigir achados.

2. **Performance**:
   - **Code-splitting por rota** com `React.lazy` (eventos.tsx 1960 linhas, receitas.tsx 1154, catalogo.tsx 1194, loja.$slug.tsx 1084).
   - **Quebrar `eventos.tsx`** em: `EventHeader`, `ProductsTab`, `TasksTab`, `CashboxTab`, `AddProductModal`, `EditProductModal` (arquivos separados em `src/routes/-eventos/`).
   - **Imagens** com `loading="lazy"` + dimensões fixas (CLS).
   - **Memoização** de listas grandes (`useMemo` + virtualização opcional em `catalogo`).
   - **Índices DB** em queries frequentes (já há alguns; auditar e adicionar faltantes).

3. **Estabilidade**:
   - Error boundaries por rota.
   - Skeletons consistentes durante loaders.
   - Retry automático em falhas de rede (TanStack Query já oferece — padronizar config).

**Entregável:** App seguro, rápido e com arquivos refatorados em pedaços manejáveis.

---

## Detalhes técnicos

- **Stack:** TanStack Start + Supabase (Lovable Cloud) + Tailwind v4 + shadcn/ui.
- **Mobile breakpoint:** `sm:` (640px) — abaixo é mobile-first.
- **Migrations:** Parte 3 exigirá novas migrations para `coupons`, `shop_analytics`, `audit_log` e revisão de policies de `sales`.
- **Sem breaking changes:** dados existentes preservados; policies novas adicionadas como complementares.

---

**Iniciando agora pela Parte 1.** Ao final dela apresento o resultado e seguimos para a Parte 2 mediante sua aprovação (ou ajustes).
