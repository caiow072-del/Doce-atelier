// Tipos compartilhados entre os componentes do PDV
export type Product = {
  id: string;
  label: string;
  price: number;
  icon: string;
  tone: string;
  position: number;
  active: boolean;
  image_url: string | null;
};

export type EventProduct = {
  id: string;
  event_id: string;
  name: string;
  unit_price: number;
  planned_qty: number;
  sold_qty: number;
  image_url: string | null;
};

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
