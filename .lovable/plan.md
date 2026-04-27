## Plano em ondas

Você listou 6 frentes. Tentar tudo num ciclo só quebra coisas que já funcionam (financeiro de receitas está delicado). Vamos por ondas. **Esta aprovação cobre só a Onda 1.** Onda 2 e 3 ficam descritas no fim para você aprovar separadamente depois.

---

## ONDA 1 — Eventos + PDV por evento + Fechamento de caixa

### O que muda do ponto de vista do uso

**Eventos (festival de tortas, feira, etc.)**
- Criar evento com **vários produtos**, não só uma receita. Ex: festival de sábado com 9 bolos, cada um com quantidade prevista, preço de venda no evento e custo unitário (puxado da receita).
- Eventos **recorrentes**: marcar "todo sábado" e o sistema gera as próximas ocorrências.
- Lista de insumos do evento agora é **colapsável** (recolhida por padrão, abre num acordeão), libera a tela.
- Cada evento tem 4 abas: **Produtos**, **Insumos** (calculado), **Tarefas** (já existe), **Caixa**.

**PDV ligado a evento**
- Topo do PDV: seletor "Vendendo em: [Loja / Festival sábado 04/05 / Feira centro]".
- Quando um evento está selecionado, os **botões do PDV viram os produtos daquele evento** (com preço do evento, foto se tiver). Sem evento = produtos PDV padrão de hoje.
- **Carrinho lateral**: toca no produto, vai pro carrinho, pode +/- quantidade, escolhe forma de pagamento (Dinheiro / Pix / Crédito / Débito), fecha venda. Uma venda = vários itens.
- Mostra **estoque previsto** do produto no evento (ex: "5/40 vendidos") em tempo real.

**Fechamento de Caixa do Evento**
- Aba "Caixa" do evento mostra: troco inicial, total vendido (somado das vendas do PDV durante o evento), por forma de pagamento, custo dos insumos consumidos, taxa do evento, **lucro real do evento**, sobras (produtos não vendidos).
- Botão "Fechar caixa" trava o evento, gera um snapshot pra histórico e libera a comparação "previsto vs realizado".

**Dashboard (atualização leve, não é repaginada total)**
- Card "Próximo evento" com contagem regressiva.
- Card "Resultado do último evento fechado" puxando direto do snapshot.

### Mudanças técnicas

**Banco — migrações novas**
- `event_products`: id, event_id, name, recipe_id (nullable), unit_price, planned_qty, sold_qty, image_url, position. Substitui o `event_recipes` atual como fonte de produtos do evento (mantemos `event_recipes` por compat, mas a UI nova usa `event_products`).
- `events`: adicionar `recurrence` (text: 'none' | 'weekly' | 'monthly'), `recurrence_until` (date nullable), `parent_event_id` (uuid nullable, pra ligar ocorrências), `closed_at` (timestamptz nullable), `payment_summary` (jsonb nullable — snapshot ao fechar).
- `sales`: adicionar `event_id` (uuid nullable), `payment_method` (text: 'cash'|'pix'|'credit'|'debit'|'other'), `cart_id` (uuid — agrupa itens da mesma venda). RLS herda do shop via product/event.
- Novo `pdv_carts` opcional só pra agrupar vendas do mesmo cliente — ou usar `cart_id` no próprio `sales` (mais simples, vou por aqui).

**Frontend**
- `src/routes/eventos.tsx`: refatorar pra UI por abas; lista de insumos vira `<Collapsible>` recolhido. Editor de produtos do evento (tabela com nome, receita opcional, qtd planejada, preço).
- `src/routes/pdv.tsx`: adicionar seletor de evento no topo; carrinho lateral (Sheet); seleção de forma de pagamento; query de produtos muda quando há evento selecionado.
- Nova rota `src/routes/eventos/$id.tsx` (detalhe do evento com as 4 abas) — ou modal grande, decido pelo padrão atual da tela. Vou manter dentro de `eventos.tsx` como sheet de detalhe pra não inflar rotas.
- `src/routes/index.tsx`: 2 cards novos (próximo evento, último fechamento).

**Segurança / migração futura**
- Tudo via `supabase` client direto + RLS (já o padrão atual). Nada de TanStack server functions específicas do Lovable. RLS novas seguem o padrão `is_shop_member` / `has_shop_role` que já existe.
- Sem AI, sem connectors novos. Zero acoplamento com Lovable.

### Riscos e o que NÃO mexo

- **Não toco** em `receitas.tsx`, `insumos.tsx`, `clientes.tsx`, `encomendas.tsx`. Já estão estabilizados.
- **Não toco** no cálculo financeiro da receita (Você recebe / Lucro real).
- `event_recipes` continua existindo pra não quebrar eventos antigos; novos eventos usam `event_products`.

### Entregáveis da Onda 1
1. Migração SQL com as 3 mudanças acima.
2. Eventos refatorado com produtos múltiplos + recorrência + insumos colapsáveis.
3. PDV com seletor de evento + carrinho + forma de pagamento.
4. Aba Caixa do evento com fechamento.
5. Dashboard com 2 cards novos.

Estimativa: ~4-6 arquivos tocados, 1 migração.

---

## ONDA 2 (depois, aprovação separada) — Vitrine pública estilo iFood

Como você descreveu: cliente acessa `/loja/{slug}`, vê produtos com foto/preço/descrição, **se cadastra na hora** (nome, whatsapp, endereço, retirada/entrega), monta pedido, ao confirmar:
1. Cria registro em `customers` (ou reusa se whatsapp já existe).
2. Cria `order` com status `pendente`.
3. Abre WhatsApp com mensagem pronta pra você.
4. Aparece em Encomendas (badge "novo") + no Dashboard.

Segurança crítica (vitrine é pública, qualquer um acessa):
- Endpoint público com **rate limit por IP+whatsapp**.
- Validação Zod rigorosa de todos os campos.
- RLS policy nova permitindo INSERT anônimo só nas colunas seguras de `customers` e `orders`, com `shop_id` derivado do slug (não confiável vindo do cliente).
- Honeypot anti-bot + checagem de whatsapp em formato BR válido.
- Sem login do cliente, sem sessão, sem dados sensíveis retornados.
- Editor de produtos da vitrine: upload de imagem (Supabase Storage bucket `catalog-images` público de leitura, escrita só dono).
- Separar **vitrine de encomendas** (catálogo padrão) de **vitrine de evento** (produtos de um evento específico, com data limite). Toggle por receita: "mostrar em encomendas" / "mostrar no evento X".

Arquivos: nova rota `src/routes/loja.$slug.tsx` (pública, fora do `_authenticated`), refatoração de `catalogo.tsx` com editor, novo bucket de Storage, 2 migrações (storage + RLS pública).

---

## ONDA 3 (depois, aprovação separada) — Polimento e densidade

- Insumos: layout em tabela densa (ou cards 2-3 colunas), edit inline.
- Filtros globais por período (dia/semana/mês/ano/evento) em vendas, encomendas, dashboard.
- Dashboard repaginado com gráficos (receita por mês, top produtos, ticket médio).
- Auditoria de RLS com `supabase--linter`, revisão de policies pensando em pós-Lovable.
- Limpeza de `festival.tsx` órfão.
- Documento `MIGRATION.md` listando tudo que precisa ser desacoplado quando sair do Lovable (variáveis de ambiente, build do TanStack Start no Hostinger, etc.).

---

**Confirma a Onda 1?** Se sim, eu já começo pelo schema do banco e depois UI. Onda 2 e 3 viram tarefas separadas depois que a 1 estiver redonda em produção.