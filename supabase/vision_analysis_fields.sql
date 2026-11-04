-- Additive garment-analysis details; existing wardrobe fields remain unchanged.
alter table public.wardrobe_items
  add column if not exists neckline_closure text,
  add column if not exists construction text;
