-- ============================================================
-- Wipe completo de la base de datos
-- Ejecutar esto en el SQL Editor de Supabase ANTES de re-ejecutar
-- supabase.sql completo.
-- ============================================================

-- 1. Borrar tablas (orden inverso de dependencias por FK)
drop table if exists public.bookings      cascade;
drop table if exists public.shifts        cascade;
drop table if exists public.staff_services cascade;
drop table if exists public.staff         cascade;
drop table if exists public.services      cascade;
drop table if exists public.businesses    cascade;

-- 2. Borrar funciones (por si quedaron de un wipe anterior)
drop function if exists public.set_staff_assignment(uuid, text, uuid[]) cascade;
drop function if exists public.create_booking(uuid,text,text,date,time,text,uuid,int,uuid) cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.next_available_slug(text, uuid) cascade;
drop function if exists public.get_available_slots(uuid, date, uuid, int) cascade;
drop function if exists public.get_free_staff(uuid, date, time, int, uuid) cascade;
drop function if exists public.get_eligible_staff(uuid, uuid) cascade;
drop function if exists public.is_staff_owner(uuid) cascade;
drop function if exists public.is_business_owner(uuid) cascade;

-- 3. Borrar trigger
drop trigger if exists on_auth_user_created on auth.users;

-- 4. Borrar usuarios de Auth
delete from auth.users;

-- 5. (Opcional) Borrar archivos del bucket branding desde el dashboard:
--    Storage → branding → vaciar o eliminar archivos manualmente.
