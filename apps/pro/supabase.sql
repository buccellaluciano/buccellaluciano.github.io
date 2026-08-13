-- ============================================================
-- Booking SaaS — Esquema para Supabase (PostgreSQL 15+)
-- Migración desde server.js + sdb.sql (Node/Express + PG local)
-- hacia front 100% estático + Supabase (Auth, Postgres, Storage).
--
-- Cómo usarlo:
--   1. Creá un proyecto en https://supabase.com (plan gratuito).
--   2. En el SQL Editor de tu proyecto, pegá y ejecutá TODO este archivo.
--   3. Creá el bucket público "branding" (Storage → New bucket,
--      desmarcar "Restrict file uploads" / marcar public) — también se
--      intenta crear desde el SQL al final.
--   4. Copiá la URL del proyecto y la key pública "anon" desde
--      Settings → API, y pegálas en js/supabase.js.
--
-- Cambios clave respecto al esquema anterior:
--   · Se elimina la tabla `users`: la identidad la maneja Supabase Auth
--     (auth.users). businesses.user_id referencia auth.users(id).
--   · La columna password desaparece (la maneja Auth con bcrypt).
--   · bookings NO es legible por público (RLS): la disponibilidad se
--     calcula dentro de funciones SECURITY DEFINER (RPC), nunca se expone
--     la tabla con datos de clientes.
--   · businesses.branding guarda URLs de Storage (no base64).
--   · Los índices UNIQUE parciales anti-doble-reserva se conservan.
-- ============================================================

-- ─── EXTENSIONS ──────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;   -- gen_random_uuid() en PG < 13
create extension if not exists unaccent;   -- normalización de slugs

-- ─── BUSINESSES (una por usuario) ────────────────────────────────────────────

create table if not exists public.businesses (
    id            uuid        primary key default gen_random_uuid(),
    user_id       uuid        not null unique references auth.users(id) on delete cascade,
    slug          text        not null unique,
    business_name text        not null,
    description   text,
    zone          text,
    address       text,
    whatsapp      text,
    brand_color   text        not null default '#6366f1',
    booking_mode  text        not null default 'direct'
                              check (booking_mode in ('direct', 'service')),
    open_time     time        not null default '09:00',
    close_time    time        not null default '18:00',
    slot_duration int         not null default 60
                              check (slot_duration > 0),
    -- Working days: array de valores JS getDay() (0=Dom … 6=Sáb)
    working_days  int[]       not null default '{1,2,3,4,5}',
    -- Branding: { favicon, logo, background } con URLs públicas de Storage
    branding      jsonb       not null default '{}',
    updated_at    timestamptz not null default now(),
    created_at    timestamptz not null default now()
);

create index if not exists idx_businesses_slug    on public.businesses (slug);
create index if not exists idx_businesses_user_id on public.businesses (user_id);

-- ─── SERVICES ────────────────────────────────────────────────────────────────

create table if not exists public.services (
    id          uuid        primary key default gen_random_uuid(),
    business_id uuid        not null references public.businesses(id) on delete cascade,
    name        text        not null,
    duration    int         not null check (duration > 0),
    price       numeric(10,2),
    description text,
    created_at  timestamptz not null default now()
);

create index if not exists idx_services_business on public.services (business_id);

-- ─── STAFF ───────────────────────────────────────────────────────────────────

create table if not exists public.staff (
    id              uuid        primary key default gen_random_uuid(),
    business_id     uuid        not null references public.businesses(id) on delete cascade,
    name            text        not null,
    email           text,
    phone           text,
    assignment_type text        not null default 'unassigned'
                                check (assignment_type in ('unassigned', 'generic', 'specific')),
    status          text        not null default 'active'
                                check (status in ('active', 'inactive')),
    created_at      timestamptz not null default now()
);

create index if not exists idx_staff_business on public.staff (business_id);

-- Many-to-many: staff ↔ services
create table if not exists public.staff_services (
    staff_id   uuid not null references public.staff(id)     on delete cascade,
    service_id uuid not null references public.services(id)  on delete cascade,
    primary key (staff_id, service_id)
);

-- ─── SHIFTS ──────────────────────────────────────────────────────────────────

create table if not exists public.shifts (
    id             uuid        primary key default gen_random_uuid(),
    staff_id       uuid        not null references public.staff(id) on delete cascade,
    start_time     time        not null,
    end_time       time        not null,
    shift_date     date,                 -- NULL = recurrente
    recurring_days int[]       not null default '{}',
    created_at     timestamptz not null default now(),
    constraint shifts_times_check check (start_time < end_time)
);

create index if not exists idx_shifts_staff      on public.shifts (staff_id);
create index if not exists idx_shifts_shift_date on public.shifts (shift_date);

-- ─── BOOKINGS ────────────────────────────────────────────────────────────────

create table if not exists public.bookings (
    id                uuid        primary key default gen_random_uuid(),
    business_id       uuid        not null references public.businesses(id) on delete cascade,
    client_name       text        not null,
    phone             text        not null,
    date              date        not null,
    time              time        not null,
    duration          int         not null check (duration > 0),
    service_name      text,               -- denormalizado (registro histórico)
    assigned_staff_id uuid        references public.staff(id) on delete set null,
    created_at        timestamptz not null default now()
);

-- ─── CRITICAL: previene doble reserva a nivel de base de datos ─────────────
-- Un negocio puede aceptar varias reservas en el mismo (date, time), una por
-- staff disponible. Dos índices UNIQUE parciales lo garantizan:
--   1) Un staff no puede estar doblemente reservado en el mismo slot.
--   2) Si una reserva NO tiene staff asignado (negocios legacy sin staff),
--      el slot sigue siendo exclusivo a nivel negocio.
-- Los inserts concurrentes que violen cualquiera de las reglas fallan con
-- error 23505 (unique_violation) en vez de crear una doble reserva.

create unique index if not exists idx_bookings_staff_slot
    on public.bookings (assigned_staff_id, date, time)
    where assigned_staff_id is not null;

create unique index if not exists idx_bookings_business_slot_unassigned
    on public.bookings (business_id, date, time)
    where assigned_staff_id is null;

create index if not exists idx_bookings_business_date on public.bookings (business_id, date);

-- ─── PLANS (planes de suscripción / mensualidad) ─────────────────────────────
-- style: 'pilates' = cupo limitado por día laboral · 'gym' = acceso libre.
create table if not exists public.plans (
    id               uuid          primary key default gen_random_uuid(),
    business_id      uuid          not null references public.businesses(id) on delete cascade,
    name             text          not null,
    price            numeric(10,2) not null check (price >= 0),
    style            text          not null default 'pilates'
                                   check (style in ('pilates', 'gym')),
    capacity_per_day int           check (capacity_per_day is null or capacity_per_day > 0),
    billing_day      int           not null default 1 check (billing_day between 1 and 28),
    description      text,
    active           boolean       not null default true,
    created_at       timestamptz   not null default now(),
    updated_at       timestamptz   not null default now()
);

create index if not exists idx_plans_business on public.plans (business_id);

-- ─── SUBSCRIPTIONS (suscriptores) ────────────────────────────────────────────
-- plan_name / plan_price están denormalizados: si el plan cambia, la
-- suscripción conserva el precio original al momento del alta.
create table if not exists public.subscriptions (
    id                uuid         primary key default gen_random_uuid(),
    business_id       uuid         not null references public.businesses(id) on delete cascade,
    plan_id           uuid         references public.plans(id) on delete set null,
    plan_name         text         not null,
    plan_price        numeric(10,2),
    client_name       text         not null,
    phone             text         not null,
    start_date        date         not null,
    next_billing_date date         not null,
    status            text         not null default 'active'
                                   check (status in ('active', 'paused', 'cancelled')),
    created_at        timestamptz  not null default now()
);

create index if not exists idx_subscriptions_business on public.subscriptions (business_id);
create index if not exists idx_subscriptions_billing  on public.subscriptions (business_id, next_billing_date);

-- ─── PLAN_SLOTS (grilla de clases de un plan estilo "por clase") ─────────────
-- Clases recurrentes semanales: día de semana + horario + cupo por horario.
create table if not exists public.plan_slots (
    id          uuid        primary key default gen_random_uuid(),
    plan_id     uuid        not null references public.plans(id) on delete cascade,
    day_of_week int         not null check (day_of_week between 0 and 6),  -- JS getDay()
    start_time  time        not null,
    end_time    time        not null,
    capacity    int         not null check (capacity > 0),
    created_at  timestamptz not null default now(),
    constraint plan_slots_times_check check (start_time < end_time)
);

create index if not exists idx_plan_slots_plan on public.plan_slots (plan_id);

-- ─── SUBSCRIPTION_SLOTS (clases a las que se anota cada suscriptor) ──────────
create table if not exists public.subscription_slots (
    subscription_id uuid not null references public.subscriptions(id) on delete cascade,
    slot_id         uuid not null references public.plan_slots(id) on delete cascade,
    primary key (subscription_id, slot_id)
);

-- ─── HELPERS DE PROPIEDAD (usadas por RLS) ───────────────────────────────────
-- Deben definirse DESPUÉS de las tablas: PostgreSQL valida el body de las
-- funciones SQL en el CREATE y las tablas aún no existen antes de este punto.

-- ¿El usuario autenticado es dueño del negocio `p_biz`?
-- SECURITY DEFINER: corre como el dueño (postgres) y saltea RLS, evitando
-- recursión infinita cuando la política de `businesses` la evalúa. auth.uid()
-- lee el JWT del caller, así que la identidad sigue siendo la del usuario.
create or replace function public.is_business_owner(p_biz uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
    select exists (
        select 1 from public.businesses b
        where b.id = p_biz and b.user_id = auth.uid()
    );
$$;

-- ¿El usuario autenticado es dueño del negocio al que pertenece el staff `p_staff`?
create or replace function public.is_staff_owner(p_staff uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
    select exists (
        select 1 from public.staff s
        where s.id = p_staff and public.is_business_owner(s.business_id)
    );
$$;

-- ¿El usuario autenticado es dueño del negocio al que pertenece el plan `p_plan`?
create or replace function public.is_plan_owner(p_plan uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
    select exists (
        select 1 from public.plans p
        where p.id = p_plan and public.is_business_owner(p.business_id)
    );
$$;

-- ¿El usuario autenticado es dueño del negocio de la suscripción `p_sub`?
create or replace function public.is_subscription_owner(p_sub uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
    select exists (
        select 1 from public.subscriptions s
        where s.id = p_sub and public.is_business_owner(s.business_id)
    );
$$;

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────

alter table public.businesses    enable row level security;
alter table public.services      enable row level security;
alter table public.staff         enable row level security;
alter table public.staff_services enable row level security;
alter table public.shifts        enable row level security;
alter table public.bookings      enable row level security;
alter table public.plans         enable row level security;
alter table public.subscriptions enable row level security;
alter table public.plan_slots         enable row level security;
alter table public.subscription_slots enable row level security;

-- businesses: lectura pública (slug + config de la página pública),
-- escritura solo del dueño.
drop policy if exists "businesses_public_read" on public.businesses;
create policy "businesses_public_read" on public.businesses
    for select using (true);
drop policy if exists "businesses_owner_insert" on public.businesses;
create policy "businesses_owner_insert" on public.businesses
    for insert with check (auth.uid() = user_id);
drop policy if exists "businesses_owner_update" on public.businesses;
create policy "businesses_owner_update" on public.businesses
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "businesses_owner_delete" on public.businesses;
create policy "businesses_owner_delete" on public.businesses
    for delete using (auth.uid() = user_id);

-- services: catálogo público, escritura solo del dueño.
drop policy if exists "services_public_read" on public.services;
create policy "services_public_read" on public.services
    for select using (true);
drop policy if exists "services_owner_insert" on public.services;
create policy "services_owner_insert" on public.services
    for insert with check (public.is_business_owner(business_id));
drop policy if exists "services_owner_update" on public.services;
create policy "services_owner_update" on public.services
    for update using (public.is_business_owner(business_id))
    with check (public.is_business_owner(business_id));
drop policy if exists "services_owner_delete" on public.services;
create policy "services_owner_delete" on public.services
    for delete using (public.is_business_owner(business_id));

-- staff / shifts / staff_services: solo el dueño. El público accede por RPC.
drop policy if exists "staff_owner_all" on public.staff;
create policy "staff_owner_all" on public.staff
    for all using (public.is_business_owner(business_id))
    with check (public.is_business_owner(business_id));

drop policy if exists "shifts_owner_all" on public.shifts;
create policy "shifts_owner_all" on public.shifts
    for all using (public.is_staff_owner(staff_id))
    with check (public.is_staff_owner(staff_id));

drop policy if exists "staff_services_owner_all" on public.staff_services;
create policy "staff_services_owner_all" on public.staff_services
    for all using (public.is_staff_owner(staff_id))
    with check (public.is_staff_owner(staff_id));

-- bookings: NUNCA legible por público (datos de clientes). El alta pública
-- pasa exclusivamente por create_booking() (RPC SECURITY DEFINER), que valida
-- disponibilidad y maneja la concurrencia. No se otorga INSERT directo.
drop policy if exists "bookings_owner_read" on public.bookings;
create policy "bookings_owner_read" on public.bookings
    for select using (public.is_business_owner(business_id));
drop policy if exists "bookings_owner_update" on public.bookings;
create policy "bookings_owner_update" on public.bookings
    for update using (public.is_business_owner(business_id))
    with check (public.is_business_owner(business_id));
drop policy if exists "bookings_owner_delete" on public.bookings;
create policy "bookings_owner_delete" on public.bookings
    for delete using (public.is_business_owner(business_id));

-- plans: catálogo público (la página pública muestra los planes),
-- escritura solo del dueño.
drop policy if exists "plans_public_read" on public.plans;
create policy "plans_public_read" on public.plans
    for select using (true);
drop policy if exists "plans_owner_insert" on public.plans;
create policy "plans_owner_insert" on public.plans
    for insert with check (public.is_business_owner(business_id));
drop policy if exists "plans_owner_update" on public.plans;
create policy "plans_owner_update" on public.plans
    for update using (public.is_business_owner(business_id))
    with check (public.is_business_owner(business_id));
drop policy if exists "plans_owner_delete" on public.plans;
create policy "plans_owner_delete" on public.plans
    for delete using (public.is_business_owner(business_id));

-- subscriptions: NUNCA legible por público (datos de clientes). El alta
-- pública pasa por create_subscription() (RPC SECURITY DEFINER). El dueño
-- puede leer/editar/eliminar.
drop policy if exists "subscriptions_owner_read" on public.subscriptions;
create policy "subscriptions_owner_read" on public.subscriptions
    for select using (public.is_business_owner(business_id));
drop policy if exists "subscriptions_owner_update" on public.subscriptions;
create policy "subscriptions_owner_update" on public.subscriptions
    for update using (public.is_business_owner(business_id))
    with check (public.is_business_owner(business_id));
drop policy if exists "subscriptions_owner_delete" on public.subscriptions;
create policy "subscriptions_owner_delete" on public.subscriptions
    for delete using (public.is_business_owner(business_id));

-- plan_slots: grilla pública (la página pública muestra las clases),
-- escritura solo del dueño del plan.
drop policy if exists "plan_slots_public_read" on public.plan_slots;
create policy "plan_slots_public_read" on public.plan_slots
    for select using (true);
drop policy if exists "plan_slots_owner_insert" on public.plan_slots;
create policy "plan_slots_owner_insert" on public.plan_slots
    for insert with check (public.is_plan_owner(plan_id));
drop policy if exists "plan_slots_owner_update" on public.plan_slots;
create policy "plan_slots_owner_update" on public.plan_slots
    for update using (public.is_plan_owner(plan_id))
    with check (public.is_plan_owner(plan_id));
drop policy if exists "plan_slots_owner_delete" on public.plan_slots;
create policy "plan_slots_owner_delete" on public.plan_slots
    for delete using (public.is_plan_owner(plan_id));

-- subscription_slots: solo el dueño (la anotación pública pasa por RPC).
drop policy if exists "subscription_slots_owner_all" on public.subscription_slots;
create policy "subscription_slots_owner_all" on public.subscription_slots
    for all using (public.is_subscription_owner(subscription_id))
    with check (public.is_subscription_owner(subscription_id));

-- ─── RPC — Disponibilidad ────────────────────────────────────────────────────
-- Todas SECURITY DEFINER (corren como el dueño, saltean RLS internamente)
-- para leer staff/shifts/bookings sin exponerlos por REST.
-- set search_path fijo para evitar ataques de hijacking de search_path.

-- Staff elegible para un servicio (o genérico si p_service_id es NULL).
-- Reemplaza getEligibleStaff() + GET /api/public/staff.
create or replace function public.get_eligible_staff(p_biz uuid, p_service_id uuid default null)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
    select s.id, s.name
    from public.staff s
    where s.business_id = p_biz
      and s.status = 'active'
      and (s.assignment_type = 'generic'
           or (s.assignment_type = 'specific'
               and exists (select 1 from public.staff_services ss
                           where ss.staff_id = s.id and ss.service_id = p_service_id)))
    order by s.name;
$$;

-- Staff que además está libre en la ventana [p_time, p_time + p_duration]
-- del día p_date. Reemplaza getFreeStaff() + GET /api/public/staff-available.
create or replace function public.get_free_staff(
    p_biz        uuid,
    p_date       date,
    p_time       time,
    p_duration   int,
    p_service_id uuid default null
) returns table (id uuid, name text)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
    v_req_start int;
    v_req_end   int;
    v_js_dow    int;
    r           record;
    v_covered   boolean;
begin
    if p_date is null or p_time is null then
        raise exception 'Fecha y hora requeridas';
    end if;

    if coalesce(p_duration, 60) < 5 then
        raise exception 'Duración inválida (mínimo 5 min)';
    end if;

    v_req_start := extract(hour from p_time)::int * 60 + extract(minute from p_time)::int;
    v_req_end   := v_req_start + coalesce(p_duration, 60);
    v_js_dow    := extract(isodow from p_date)::int % 7;   -- JS getDay(): 0=Dom

    for r in select * from public.get_eligible_staff(p_biz, p_service_id) loop

        -- Una reserva sin staff bloquea TODO el slot (semántica de Path B)
        if exists (
            select 1 from public.bookings b
            where b.business_id = p_biz and b.date = p_date and b.assigned_staff_id is null
              and v_req_start < extract(hour from b.time)::int * 60
                                + extract(minute from b.time)::int + coalesce(b.duration, v_req_end - v_req_start)
              and v_req_end > extract(hour from b.time)::int * 60 + extract(minute from b.time)::int
        ) then
            continue;
        end if;

        -- Cobertura de turno: si tiene turnos ese día, alguno debe cubrir la ventana.
        -- Si no tiene turnos definidos → se trata como disponible (comportamiento legacy).
        v_covered := not exists (
            select 1 from public.shifts sh
            where sh.staff_id = r.id
              and (sh.shift_date = p_date
                   or (sh.shift_date is null and v_js_dow = any(sh.recurring_days)))
        );
        if not v_covered then
            v_covered := exists (
                select 1 from public.shifts sh
                where sh.staff_id = r.id
                  and (sh.shift_date = p_date
                       or (sh.shift_date is null and v_js_dow = any(sh.recurring_days)))
                  and extract(hour from sh.start_time)::int * 60 + extract(minute from sh.start_time)::int <= v_req_start
                  and extract(hour from sh.end_time)::int   * 60 + extract(minute from sh.end_time)::int   >= v_req_end
            );
        end if;
        if not v_covered then
            continue;
        end if;

        -- Sin reservas solapadas de este staff en la ventana
        if exists (
            select 1 from public.bookings b
            where b.assigned_staff_id = r.id and b.date = p_date
              and v_req_start < extract(hour from b.time)::int * 60
                                + extract(minute from b.time)::int + coalesce(b.duration, v_req_end - v_req_start)
              and v_req_end > extract(hour from b.time)::int * 60 + extract(minute from b.time)::int
        ) then
            continue;
        end if;

        id   := r.id;
        name := r.name;
        return next;
    end loop;
end;
$$;

-- Slots libres del día. Reemplaza GET /api/public/slots.
-- Path A (sin staff): slot libre si ninguna reserva solapa.
-- Path B (con staff): slot libre si al menos un staff elegible está libre.
create or replace function public.get_available_slots(
    p_biz        uuid,
    p_date       date,
    p_service_id uuid default null,
    p_duration   int   default null
) returns text[]
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
    v_biz       public.businesses%rowtype;
    v_duration  int;
    v_open      int;
    v_close     int;
    v_t         int;
    v_has_staff int;
    v_free      int;
    v_slots     text[] := '{}';
begin
    select * into v_biz from public.businesses where id = p_biz;
    if not found then
        raise exception 'Negocio no encontrado';
    end if;

    v_duration := coalesce(p_duration, v_biz.slot_duration);
    if v_duration <= 0 then
        raise exception 'Duración inválida';
    end if;
    if v_duration < 5 then
        v_duration := 5;   -- floor razonable (nadie reserva turnos de 1 min)
    end if;

    v_open  := extract(hour from v_biz.open_time)::int * 60 + extract(minute from v_biz.open_time)::int;
    v_close := extract(hour from v_biz.close_time)::int * 60 + extract(minute from v_biz.close_time)::int;

    -- Cap de seguridad: evitar que un llamado con parámetros extremos
    -- (ej. open=00:00, close=23:59, duration=5) itere +280 veces y
    -- sature el servidor. Si el rango del negocio es más grande, que
    -- el dueño ajuste open/close a algo razonable o aumente duration.
    if ((v_close - v_duration) - v_open) / v_duration > 500 then
        raise exception 'Rango horario demasiado amplio (ajustá el horario del local).';
    end if;

    select count(*) into v_has_staff from public.get_eligible_staff(p_biz, p_service_id);

    for v_t in v_open .. (v_close - v_duration) by v_duration loop
        if v_has_staff > 0 then
            -- Una reserva sin staff bloquea el slot completo
            if exists (
                select 1 from public.bookings b
                where b.business_id = p_biz and b.date = p_date and b.assigned_staff_id is null
                  and v_t < extract(hour from b.time)::int * 60 + extract(minute from b.time)::int + coalesce(b.duration, v_duration)
                  and v_t + v_duration > extract(hour from b.time)::int * 60 + extract(minute from b.time)::int
            ) then
                continue;
            end if;

            select count(*) into v_free
            from public.get_free_staff(
                p_biz, p_date, make_time(v_t / 60, v_t % 60, 0), v_duration, p_service_id
            );
            if v_free = 0 then
                continue;
            end if;
        else
            -- Path A: cualquier reserva solapada bloquea el slot
            if exists (
                select 1 from public.bookings b
                where b.business_id = p_biz and b.date = p_date
                  and v_t < extract(hour from b.time)::int * 60 + extract(minute from b.time)::int + coalesce(b.duration, v_biz.slot_duration)
                  and v_t + v_duration > extract(hour from b.time)::int * 60 + extract(minute from b.time)::int
            ) then
                continue;
            end if;
        end if;

        v_slots := array_append(v_slots, lpad((v_t / 60)::text, 2, '0') || ':' || lpad((v_t % 60)::text, 2, '0'));
    end loop;

    return v_slots;
end;
$$;

-- ─── RPC — Slugs ─────────────────────────────────────────────────────────────

-- Genera un slug único para un nombre de negocio (appende -2, -3 … si existe).
-- p_own_id permite excluir el propio negocio (renombrado: mismo nombre → mismo slug).
create or replace function public.next_available_slug(p_name text, p_own_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
    v_base text;
    v_slug text;
    v_n    int := 1;
begin
    v_base := lower(
        regexp_replace(
            regexp_replace(unaccent(coalesce(trim(p_name), '')), '[^a-z0-9\s-]', '', 'g'),
            '\s+', '-', 'g'
        )
    );
    v_base := regexp_replace(v_base, '-+', '-', 'g');
    if v_base = '' then
        v_base := 'negocio';
    end if;

    v_slug := v_base;
    while exists (
        select 1 from public.businesses
        where slug = v_slug
          and (p_own_id is null or id <> p_own_id)
    ) loop
        v_n    := v_n + 1;
        v_slug := v_base || '-' || v_n;
    end loop;
    return v_slug;
end;
$$;

-- Alta automática del negocio al crearse el usuario en Supabase Auth.
-- Lee business_name y whatsapp de user_metadata (los manda register.js en
-- signUp options.data). Funciona con o sin confirmación de email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
    v_name text;
begin
    v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''), 'Mi negocio');
    insert into public.businesses (user_id, slug, business_name, whatsapp)
    values (
        new.id,
        public.next_available_slug(v_name),
        v_name,
        nullif(trim(coalesce(new.raw_user_meta_data ->> 'whatsapp', '')), '')
    );
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ─── RPC — Crear reserva ──────────────────────────────────────────────────────

-- Alta de reserva pública con validación de disponibilidad y manejo de
-- concurrencia (23505). Reemplaza POST /api/public/bookings.
-- Devuelve { ok, error?, assigned_staff_id? } — nunca lanza excepciones
-- de dominio (las convierte en el campo `error`).
create or replace function public.create_booking(
    p_biz               uuid,
    p_name              text,
    p_phone             text,
    p_date              date,
    p_time              time,
    p_service_name      text default null,
    p_service_id        uuid default null,
    p_duration          int  default null,
    p_assigned_staff_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
    v_biz            public.businesses%rowtype;
    v_duration       int;
    v_resolved_svc   uuid;
    v_has_staff      int;
    v_free           int;
    v_staff_id       uuid;
    v_staff_found    uuid;
begin
    -- ── Validación de entrada ───────────────────────────────────────
    if p_biz is null or coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = ''
       or p_date is null or p_time is null then
        return jsonb_build_object('ok', false, 'error', 'Faltan datos requeridos.');
    end if;
    if p_phone !~ '^[\d\s\+\-\(\)]{7,}$' then
        return jsonb_build_object('ok', false, 'error', 'Teléfono inválido.');
    end if;

    select * into v_biz from public.businesses where id = p_biz;
    if not found then
        return jsonb_build_object('ok', false, 'error', 'Negocio no encontrado.');
    end if;

    v_duration := coalesce(p_duration, v_biz.slot_duration);
    if v_duration <= 0 or v_duration > 1440 then
        return jsonb_build_object('ok', false, 'error', 'Duración inválida.');
    end if;

    -- Resolver el servicio por id, o por nombre como fallback
    v_resolved_svc := p_service_id;
    if v_resolved_svc is null and p_service_name is not null then
        select id into v_resolved_svc
        from public.services
        where business_id = p_biz and name = p_service_name
        limit 1;
    end if;

    select count(*) into v_has_staff from public.get_eligible_staff(p_biz, v_resolved_svc);

    -- ── Path A: sin modelo de staff (capacidad única) ───────────────
    if v_has_staff = 0 then
        begin
            insert into public.bookings
                (business_id, client_name, phone, date, time, duration, service_name, assigned_staff_id)
            values
                (p_biz, trim(p_name), trim(p_phone), p_date, p_time, v_duration, p_service_name, null);
            return jsonb_build_object('ok', true);
        exception
            when unique_violation then
                return jsonb_build_object('ok', false,
                    'error', 'Ese turno ya fue tomado. Por favor elegí otro.');
        end;
    end if;

    -- ── Path B: con staff ───────────────────────────────────────────
    select count(*) into v_free
    from public.get_free_staff(p_biz, p_date, p_time, v_duration, v_resolved_svc);
    if v_free = 0 then
        return jsonb_build_object('ok', false,
            'error', 'Ese turno ya no está disponible. Por favor elegí otro.');
    end if;

    if p_assigned_staff_id is not null then
        -- El staff elegido debe seguir libre
        select s.id into v_staff_found
        from public.get_free_staff(p_biz, p_date, p_time, v_duration, v_resolved_svc) s
        where s.id = p_assigned_staff_id;
        if v_staff_found is null then
            return jsonb_build_object('ok', false,
                'error', 'El empleado seleccionado ya no está disponible. Por favor elegí otro.');
        end if;
        v_staff_id := v_staff_found;
    else
        -- "Sin preferencia": asignar el primer staff libre
        select s.id into v_staff_id
        from public.get_free_staff(p_biz, p_date, p_time, v_duration, v_resolved_svc) s
        limit 1;
        -- carrera: si mientras tanto se ocupó el único staff libre,
        -- no insertar como reserva sin staff (semántica de staff model)
        if v_staff_id is null then
            return jsonb_build_object('ok', false,
                'error', 'Ese turno ya no está disponible. Por favor elegí otro.');
        end if;
    end if;

    begin
        insert into public.bookings
            (business_id, client_name, phone, date, time, duration, service_name, assigned_staff_id)
        values
            (p_biz, trim(p_name), trim(p_phone), p_date, p_time, v_duration, p_service_name, v_staff_id);
        return jsonb_build_object('ok', true, 'assigned_staff_id', v_staff_id);
    exception
        when unique_violation then
            return jsonb_build_object('ok', false, 'error',
                case when p_assigned_staff_id is not null
                     then 'El empleado seleccionado ya no está disponible. Por favor elegí otro.'
                     else 'Ese turno se acaba de ocupar. Por favor elegí otro.' end);
    end;
end;
$$;

-- ─── RPC — Asignación de staff ────────────────────────────────────────────────

-- Actualiza assignment_type y el set de servicios del staff, atómicamente
-- (reemplaza la transacción BEGIN/COMMIT del server). Solo el dueño del
-- negocio del staff puede llamarla.
create or replace function public.set_staff_assignment(
    p_staff_id       uuid,
    p_assignment_type text,
    p_service_ids    uuid[] default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
    if not public.is_staff_owner(p_staff_id) then
        return jsonb_build_object('ok', false, 'error', 'No autorizado.');
    end if;
    if p_assignment_type not in ('unassigned', 'generic', 'specific') then
        return jsonb_build_object('ok', false, 'error', 'Tipo de asignación inválido.');
    end if;

    update public.staff set assignment_type = p_assignment_type where id = p_staff_id;
    delete from public.staff_services where staff_id = p_staff_id;

    if p_assignment_type = 'specific' and array_length(p_service_ids, 1) is not null then
        insert into public.staff_services (staff_id, service_id)
        select p_staff_id, s.id from unnest(p_service_ids) as s(id)
        on conflict do nothing;
    end if;

    return jsonb_build_object('ok', true);
end;
$$;

-- ─── RPC — Suscripciones ──────────────────────────────────────────────────────

-- Fecha del próximo cobro según el día de cobro del plan (1..28).
-- Si hoy es antes o igual al día de cobro → este mes; si no → el mes que viene.
create or replace function public.next_billing_date(p_billing_day int, p_from date default current_date)
returns date
language sql
stable
set search_path = public, pg_catalog
as $$
    select case
        when extract(day from p_from)::int <= p_billing_day
            then make_date(extract(year from p_from)::int, extract(month from p_from)::int, p_billing_day)
        else (date_trunc('month', p_from)::date + interval '1 month')::date + (p_billing_day - 1)
    end;
$$;

-- Alta de suscripción pública. Valida el plan, calcula la fecha del próximo
-- cobro y, si el plan es estilo 'pilates', anota al suscriptor en las clases
-- (slots) indicadas verificando el cupo de cada una. Devuelve
-- { ok, error?, next_billing_date?, subscription_id? }.
create or replace function public.create_subscription(
    p_biz      uuid,
    p_plan_id  uuid,
    p_name     text,
    p_phone    text,
    p_slot_ids uuid[] default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
    v_plan   public.plans%rowtype;
    v_next   date;
    v_sub_id uuid;
    v_slot   public.plan_slots%rowtype;
    v_count  int;
    v_sid    uuid;
begin
    if p_biz is null or p_plan_id is null or coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' then
        return jsonb_build_object('ok', false, 'error', 'Faltan datos requeridos.');
    end if;
    if p_phone !~ '^[\d\s\+\-\(\)]{7,}$' then
        return jsonb_build_object('ok', false, 'error', 'Teléfono inválido.');
    end if;

    select * into v_plan from public.plans
    where id = p_plan_id and business_id = p_biz;
    if not found then
        return jsonb_build_object('ok', false, 'error', 'Plan no encontrado.');
    end if;
    if not v_plan.active then
        return jsonb_build_object('ok', false, 'error', 'Ese plan ya no está disponible.');
    end if;

    -- Pre-verificación de cupo de las clases elegidas (estilo por clase)
    if v_plan.style = 'pilates' and p_slot_ids is not null then
        foreach v_sid in array p_slot_ids loop
            select * into v_slot from public.plan_slots
            where id = v_sid and plan_id = v_plan.id;
            if not found then
                return jsonb_build_object('ok', false, 'error', 'Clase no encontrada.');
            end if;
            select count(*) into v_count
            from public.subscription_slots ss
            join public.subscriptions s on s.id = ss.subscription_id
            where ss.slot_id = v_sid and s.status = 'active';
            if v_count >= v_slot.capacity then
                return jsonb_build_object('ok', false, 'error', 'La clase elegida ya está llena. Elegí otro horario.');
            end if;
        end loop;
    end if;

    v_next := public.next_billing_date(v_plan.billing_day, current_date);

    insert into public.subscriptions
        (business_id, plan_id, plan_name, plan_price, client_name, phone, start_date, next_billing_date, status)
    values
        (p_biz, v_plan.id, v_plan.name, v_plan.price, trim(p_name), trim(p_phone), current_date, v_next, 'active')
    returning id into v_sub_id;

    -- Anotar al suscriptor en las clases elegidas
    if p_slot_ids is not null then
        foreach v_sid in array p_slot_ids loop
            insert into public.subscription_slots (subscription_id, slot_id)
            values (v_sub_id, v_sid)
            on conflict do nothing;
        end loop;
    end if;

    return jsonb_build_object('ok', true, 'next_billing_date', v_next, 'subscription_id', v_sub_id);
end;
$$;

-- Devuelve la grilla de clases de un plan con el cupo ocupado (suscripciones
-- activas anotadas) para mostrar disponibilidad en la página pública.
create or replace function public.get_plan_slots(p_plan uuid)
returns table (
    id          uuid,
    day_of_week int,
    start_time  time,
    end_time    time,
    capacity    int,
    enrolled    bigint
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
    select
        ps.id,
        ps.day_of_week,
        ps.start_time,
        ps.end_time,
        ps.capacity,
        coalesce(count(ss.subscription_id), 0) as enrolled
    from public.plan_slots ps
    left join public.subscription_slots ss on ss.slot_id = ps.id
    left join public.subscriptions s on s.id = ss.subscription_id and s.status = 'active'
    where ps.plan_id = p_plan
    group by ps.id, ps.day_of_week, ps.start_time, ps.end_time, ps.capacity, ps.created_at
    order by ps.day_of_week, ps.start_time;
$$;

-- Anota a un suscriptor existente en una clase (con verificación de cupo).
-- Útil para agregar/quitar clases después del alta.
create or replace function public.enroll_slot(p_subscription uuid, p_slot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
    v_sub  public.subscriptions%rowtype;
    v_slot public.plan_slots%rowtype;
    v_count int;
begin
    select * into v_sub from public.subscriptions where id = p_subscription;
    if not found then
        return jsonb_build_object('ok', false, 'error', 'Suscripción no encontrada.');
    end if;
    if v_sub.status <> 'active' then
        return jsonb_build_object('ok', false, 'error', 'La suscripción no está activa.');
    end if;

    select * into v_slot from public.plan_slots where id = p_slot_id;
    if not found or v_slot.plan_id <> v_sub.plan_id then
        return jsonb_build_object('ok', false, 'error', 'La clase no corresponde a tu plan.');
    end if;

    select count(*) into v_count
    from public.subscription_slots ss
    join public.subscriptions s on s.id = ss.subscription_id
    where ss.slot_id = p_slot_id and s.status = 'active';

    if v_count >= v_slot.capacity then
        return jsonb_build_object('ok', false, 'error', 'Esa clase ya está llena. Elegí otro horario.');
    end if;

    insert into public.subscription_slots (subscription_id, slot_id)
    values (p_subscription, p_slot_id)
    on conflict do nothing;

    return jsonb_build_object('ok', true);
end;
$$;

-- ─── STORAGE — Branding ──────────────────────────────────────────────────────

-- Bucket público para favicon / logo / fondo.
-- NOTA: un bucket público sirve los archivos por CDN (las URLs de
-- getPublicUrl() no pasan por RLS). Por eso NO hace falta una policy SELECT
-- abierta: la única que existe es la del dueño, para listar/borrar vía la
-- Storage API (list() para limpiar archivos al quitar un asset).
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

-- Único acceso a storage.objects: el dueño del negocio. El primer segmento
-- de la ruta debe ser el id del negocio, y el negocio debe pertenecer al
-- usuario autenticado. Ruta: {business_id}/{favicon|logo|background}
drop policy if exists "branding_public_read" on storage.objects;
drop policy if exists "branding_owner_write" on storage.objects;
drop policy if exists "branding_owner_all" on storage.objects;
create policy "branding_owner_all" on storage.objects
    for all
    using (
        bucket_id = 'branding'
        and exists (
            select 1 from public.businesses b
            where b.id::text = (storage.foldername(name))[1]
              and b.user_id = auth.uid()
        )
    )
    with check (
        bucket_id = 'branding'
        and exists (
            select 1 from public.businesses b
            where b.id::text = (storage.foldername(name))[1]
              and b.user_id = auth.uid()
        )
    );

-- ─── PERMISOS ────────────────────────────────────────────────────────────────
-- Postgres otorga EXECUTE a PUBLIC por defecto: lo revocamos y concedemos
-- explícitamente a los roles que corresponden, para que anon NO pueda llamar
-- funciones que no son públicas.

-- ── Públicos (anon + authenticated): flujo de disponibilidad y reserva.
--    Son SECURITY DEFINER a propósito: leen bookings internamente sin
--    exponerla por REST. Mitigado con search_path fijo y validación de
--    entrada; solo devuelven slots/nombres/ok, nunca datos de clientes.
revoke execute on function public.get_eligible_staff(uuid, uuid)       from public;
revoke execute on function public.get_free_staff(uuid, date, time, int, uuid) from public;
revoke execute on function public.get_available_slots(uuid, date, uuid, int)  from public;
revoke execute on function public.create_booking(uuid, text, text, date, time, text, uuid, int, uuid) from public;

grant execute on function public.get_eligible_staff(uuid, uuid)       to anon, authenticated;
grant execute on function public.get_free_staff(uuid, date, time, int, uuid) to anon, authenticated;
grant execute on function public.get_available_slots(uuid, date, uuid, int)  to anon, authenticated;
grant execute on function public.create_booking(uuid, text, text, date, time, text, uuid, int, uuid) to anon, authenticated;

-- Suscripciones: alta pública por RPC
revoke execute on function public.create_subscription(uuid, uuid, text, text, uuid[]) from public;
grant execute on function public.create_subscription(uuid, uuid, text, text, uuid[]) to anon, authenticated;
grant execute on function public.get_plan_slots(uuid)                        to anon, authenticated;
grant execute on function public.enroll_slot(uuid, uuid)                     to anon, authenticated;
grant execute on function public.next_billing_date(int, date)                to authenticated;

-- ── Solo autenticados: utilidades internas del panel.
revoke execute on function public.next_available_slug(text, uuid)       from public;
revoke execute on function public.set_staff_assignment(uuid, text, uuid[]) from public;
revoke execute on function public.is_business_owner(uuid)               from public;
revoke execute on function public.is_staff_owner(uuid)                  from public;
revoke execute on function public.is_plan_owner(uuid)                   from public;
revoke execute on function public.is_subscription_owner(uuid)           from public;

grant execute on function public.next_available_slug(text, uuid)       to authenticated;
grant execute on function public.set_staff_assignment(uuid, text, uuid[]) to authenticated;

-- Los helpers de RLS deben ser ejecutables por el usuario que consulta (el
-- motor de políticas los evalúa con sus permisos). Solo los usa el dueño en
-- operaciones autenticadas (nunca anon, cuyas lecturas públicas no los llaman).
grant execute on function public.is_business_owner(uuid)     to authenticated;
grant execute on function public.is_staff_owner(uuid)        to authenticated;
grant execute on function public.is_plan_owner(uuid)         to authenticated;
grant execute on function public.is_subscription_owner(uuid) to authenticated;

-- ── Solo trigger: nadie la llama por RPC.
revoke execute on function public.handle_new_user() from public;
