-- Przypomnienie mailowe per pozycja: moment wysyłki w UTC (null = brak przypomnienia).
alter table public.items add column reminder_at timestamptz;
