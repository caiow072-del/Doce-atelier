-- Add kind (template type) to event_types
ALTER TABLE public.event_types
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'generic';

-- Add optional fields to events for richer per-template UI
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS start_time text,
  ADD COLUMN IF NOT EXISTS guests integer,
  ADD COLUMN IF NOT EXISTS main_flavor text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_cash numeric NOT NULL DEFAULT 0;
