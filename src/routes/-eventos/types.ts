export type EventKind = "festival" | "party" | "fair" | "wedding" | "generic";

export type EventType = { id: string; name: string; color: string; icon: string; kind: EventKind };

export type EventRow = {
  id: string;
  name: string;
  date: string;
  location: string | null;
  notes: string | null;
  event_type_id: string | null;
  start_time: string | null;
  guests: number | null;
  main_flavor: string | null;
  customer_name: string | null;
  fee: number;
  opening_cash: number;
  recurrence: string;
  recurrence_until: string | null;
  parent_event_id: string | null;
  weekday: number | null;
  day_of_month: number | null;
  closed_at: string | null;
  payment_summary: PaymentSummary | null;
};

export type Recipe = { 
  id: string; 
  name: string; 
  servings: number; 
  image_url?: string | null; 
  labor_cost?: number; 
  packaging_cost?: number; 
  waste_pct?: number; 
  slice_price?: number | null; 
  public_price?: number | null 
};

export type Ingredient = { 
  id: string; 
  name: string; 
  unit: string; 
  package_qty?: number; 
  price_paid?: number; 
  stock_qty?: number 
};

export type RecipeIng = { 
  recipe_id: string; 
  ingredient_id: string; 
  quantity: number 
};

export type EventProduct = {
  id: string;
  event_id: string;
  recipe_id: string | null;
  name: string;
  unit_price: number;
  planned_qty: number;
  sold_qty: number;
  image_url: string | null;
  position: number;
  sale_mode: "unit" | "slice";
  batches: number;
};

export type EventTask = { 
  id: string; 
  day_key: string; 
  task: string; 
  done: boolean; 
  position: number 
};

export type Sale = {
  id: string;
  price: number;
  qty: number;
  payment_method: string;
  product_id: string | null;
  item: string;
  sold_at: string;
};

export type PaymentSummary = {
  total: number;
  by_method: Record<string, number>;
  items_sold: number;
  cost_estimated: number;
  profit: number;
  closed_at: string;
};
