-- =====================================================================
-- Ranking global · Legacy GP (F1)
-- Ejecutar en el SQL Editor de Supabase (base de datos de producción).
-- IMPORTANTE: reemplaza el schema del juego de fútbol anterior.
-- =====================================================================

-- 0. Habilitar pg_cron (requerido para el reset semanal).
--    Si esto falla, habilitalo desde: Database → Extensions → pg_cron → Enable.
create extension if not exists pg_cron;

-- 1. Tabla de partidas (una fila por submit)
drop table if exists public.partidas;
create table if not exists public.partidas (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  week_start    date not null default (date_trunc('week', now()))::date,

  player_name   text not null,
  team          text,
  nationality   text,
  style         text,
  final_rating  int,
  age           int,
  seasons       int,

  total_wins     int    not null default 0,
  total_podiums  int    not null default 0,
  total_poles    int    not null default 0,
  total_money    bigint not null default 0,
  championships  int    not null default 0,
  driver_awards  int    not null default 0,
  golden_helmets int    not null default 0
);

-- 2. Índices para los rankings (semana + métrica)
create index if not exists partidas_week_wins    on public.partidas (week_start, total_wins    desc);
create index if not exists partidas_week_podiums on public.partidas (week_start, total_podiums desc);
create index if not exists partidas_week_money   on public.partidas (week_start, total_money   desc);
create index if not exists partidas_week_champs  on public.partidas (week_start, championships desc);

-- 3. Seguridad a nivel de filas (RLS): solo lectura pública.
--    La escritura la hace la Edge Function (submit) con la service role key,
--    que salta RLS. No se expone INSERT directo a la API anónima.
alter table public.partidas enable row level security;

drop policy if exists "leer_ranking"  on public.partidas;
drop policy if exists "subir_partida" on public.partidas;

create policy "leer_ranking" on public.partidas for select using (true);

-- 3b. Privilegios explícitos (RLS es una capa aparte del GRANT).
--     service_role inserta (la Edge Function), anon/authenticated solo leen.
grant usage on schema public to anon, authenticated, service_role;
grant all on table public.partidas to service_role;
grant select on table public.partidas to anon, authenticated;

-- 4. Reset semanal: borra las semanas anteriores cada lunes a las 00:00 (UTC).
--    (pg_cron viene habilitado por defecto en Supabase)
select cron.schedule(
  'reset-ranking-semanal',
  '0 0 * * 1',
  $$ delete from public.partidas where week_start < date_trunc('week', now())::date $$
);
