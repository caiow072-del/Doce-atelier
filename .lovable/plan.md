# Plano: Eventos clean com lista em drawer

Foco: tela principal mostra **um evento por vez**. A lista vira um painel lateral (Sheet) acionado por botão. Tudo o que é ruído visual no mobile some ou se reagrupa.

## Mudanças em `src/routes/eventos.tsx`

### 1. Substituir o card "Histórico" por um seletor compacto + drawer

Hoje o card de histórico ocupa toda a largura, sempre visível, com chips de filtro acima. Vai virar:

```text
┌─────────────────────────────────────────┐
│ [📅 Festival de Tortas — 28/04]    [▾] │   ← botão único, abre o drawer
└─────────────────────────────────────────┘
```

- Um único botão mostrando o evento atualmente selecionado (ícone do tipo + nome + data + chevron).
- Ao clicar, abre `Sheet` (lateral à direita no desktop, lateral à esquerda no mobile via `side="left"`) contendo:
  - Campo de busca por nome (filtro local).
  - Os chips de tipo (Todos/Festival/Festa/Feira/...) — saem da tela principal.
  - A lista de eventos (mesmos cards de hoje, mas em coluna única dentro do drawer).
  - Botão "+ Novo evento" no rodapé do drawer.
- Ao selecionar um evento: fecha o drawer automaticamente.

### 2. Header da página mais leve

- Remover `eyebrow="Coração do negócio"` (já depreciado no componente).
- Remover botão `Tipos` do header — mover para dentro do drawer como link discreto no rodapé ("Gerenciar tipos").
- O `+ Novo evento` também sai do header e vai para o drawer (rodapé). No header fica apenas o título.
- Resultado: header com só o `h1` "Eventos" e nada mais — limpo no mobile.

### 3. EventHeader (card do evento selecionado) mais clean

- Reduzir o título de `text-2xl italic` para `text-lg md:text-xl` sem itálico.
- Tirar o eyebrow "tipo do evento" (já aparece como ícone na frente do nome no seletor).
- Compactar a linha de meta (data, hora, local) numa única linha truncada com separadores `·`.
- Esconder `notes` por padrão; mostrar atrás de um link "ver observações" se existir.
- Manter botões editar/excluir, mas como `ghost` icon-only à direita.

### 4. Barra de progresso

- Fica, mas com label menor (`text-[11px]`) e sem o "Produção" redundante — só `{done}/{total} tarefas` à direita.

### 5. Tabs

- Mantém os 3 botões (Produtos / Tarefas / Caixa) mas com hint **só no desktop** (`hidden md:block`) — no mobile só ícone + label, evitando texto truncado.

### 6. Estado vazio

Se `events.length === 0`: mostra ilustração centralizada + botão "Criar primeiro evento", sem seletor nem drawer.

## Mudança em `src/components/PageHeader.tsx`

- `subtitle` recebe `hidden md:block` para sumir no mobile (no desktop continua visível).

## Layout final mobile

```text
┌───────────────────────────────┐
│ Eventos                       │   ← header limpo, só título
│ ┌───────────────────────────┐ │
│ │ 🎪 Festival de Tortas  ▾ │ │   ← seletor único (abre drawer)
│ │    28/04 · 14:00          │ │
│ └───────────────────────────┘ │
│                               │
│ ┌───────────────────────────┐ │
│ │ Festival de Tortas        │ │   ← card do evento selecionado
│ │ 28/04 · Centro · semanal  │ │
│ │ [✏] [🗑]                   │ │
│ │ ─────────────────────     │ │
│ │ ▓▓▓▓░░░░  3/8 tarefas     │ │
│ └───────────────────────────┘ │
│                               │
│ [Produtos][Tarefas][Caixa]    │
│                               │
│ (conteúdo da tab ativa)       │
└───────────────────────────────┘
```

## Arquivos afetados

- `src/routes/eventos.tsx` — refator visual (sem mexer em dados, mutations, sub-tabs `ProductsTab`/`TasksTab`/`CashboxTab`, `NewEventSheet`, `TypesSheet`).
- `src/components/PageHeader.tsx` — `subtitle` invisível no mobile.

Sem mudanças de banco, schema, ou comportamento funcional.
