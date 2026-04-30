import {
  CalendarHeart,
  PartyPopper,
  Store,
  Sparkles,
  Tag,
} from "lucide-react";
import type { EventKind } from "./types";

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export const KIND_META: Record<EventKind, { label: string; icon: any; description: string }> = {
  festival: { label: "Festival", icon: CalendarHeart, description: "Produção em lotes para vender em vários dias." },
  party: { label: "Festa / Encomenda", icon: PartyPopper, description: "Bolo personalizado para um cliente." },
  fair: { label: "Feira / Bazar", icon: Store, description: "Estande com vendas no caixa e troco inicial." },
  wedding: { label: "Casamento", icon: Sparkles, description: "Bolo principal e logística completa." },
  generic: { label: "Outro", icon: Tag, description: "Evento genérico personalizado." },
};

export const FESTIVAL_DAYS = [
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
];
export const PARTY_DAYS = [
  { key: "antevespera", label: "2 dias antes" },
  { key: "vespera", label: "Véspera" },
  { key: "dia", label: "Dia" },
];
export const FAIR_DAYS = [
  { key: "preparo", label: "Preparo" },
  { key: "montagem", label: "Montagem" },
  { key: "feira", label: "Feira" },
];
export const WEDDING_DAYS = [
  { key: "semana", label: "Semana" },
  { key: "vespera", label: "Véspera" },
  { key: "dia", label: "Dia" },
];
export const GENERIC_DAYS = [
  { key: "antes", label: "Antes" },
  { key: "dia", label: "Dia" },
];

export const daysFor = (k: EventKind) =>
  ({ festival: FESTIVAL_DAYS, party: PARTY_DAYS, fair: FAIR_DAYS, wedding: WEDDING_DAYS, generic: GENERIC_DAYS }[k]);

export const DEFAULT_TASKS: Record<EventKind, { day_key: string; task: string }[]> = {
  festival: [
    { day_key: "qua", task: "Comprar insumos faltantes" },
    { day_key: "qua", task: "Preparar bases e massas" },
    { day_key: "qui", task: "Assar bolos e bases de torta" },
    { day_key: "qui", task: "Preparar recheios" },
    { day_key: "sex", task: "Montar e rechear" },
    { day_key: "sex", task: "Decoração final" },
    { day_key: "sab", task: "Embalar e etiquetar" },
    { day_key: "sab", task: "Carregar carro e ir ao local" },
  ],
  party: [
    { day_key: "antevespera", task: "Confirmar pedido com cliente" },
    { day_key: "vespera", task: "Assar massas" },
    { day_key: "vespera", task: "Preparar recheio" },
    { day_key: "dia", task: "Montar e decorar" },
    { day_key: "dia", task: "Embalar para entrega" },
  ],
  fair: [
    { day_key: "preparo", task: "Separar troco inicial" },
    { day_key: "preparo", task: "Preparar produtos" },
    { day_key: "montagem", task: "Montar barraca" },
    { day_key: "feira", task: "Abrir caixa" },
    { day_key: "feira", task: "Fechar caixa e contar" },
  ],
  wedding: [
    { day_key: "semana", task: "Reunião final com noivos" },
    { day_key: "vespera", task: "Assar todas as camadas" },
    { day_key: "dia", task: "Montar bolo no local" },
    { day_key: "dia", task: "Decoração e entrega" },
  ],
  generic: [
    { day_key: "antes", task: "Planejar produção" },
    { day_key: "dia", task: "Executar evento" },
  ],
};
