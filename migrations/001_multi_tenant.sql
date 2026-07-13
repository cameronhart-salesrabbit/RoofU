-- RoofU multi-tenant conversion — Phase 1 (schema, RLS, helper functions, triggers)
-- Run this whole script in the Supabase SQL Editor, top to bottom, in one go.
-- Safe to run more than once (idempotent) if something needs re-running.
--
-- Design: top-level tables (programs, courses, users, quizzes) get
-- client_id default current_client_id() so old app code that never mentions
-- client_id keeps working unchanged. Child tables get client_id derived by
-- trigger from their parent, so the app never has to supply it for those.
-- Existing SalesRabbit data is backfilled to a new "SalesRabbit" client.

begin;

-- =========================================================================
-- 1. clients table
-- =========================================================================
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  is_template boolean not null default false,
  created_at timestamptz default now()
);

-- =========================================================================
-- 2. client_id column on every existing table (nullable for now)
-- =========================================================================
alter table public.programs add column if not exists client_id uuid references public.clients(id);
alter table public.courses add column if not exists client_id uuid references public.clients(id);
alter table public.program_courses add column if not exists client_id uuid references public.clients(id);
alter table public.sections add column if not exists client_id uuid references public.clients(id);
alter table public.lessons add column if not exists client_id uuid references public.clients(id);
alter table public.quizzes add column if not exists client_id uuid references public.clients(id);
alter table public.quiz_questions add column if not exists client_id uuid references public.clients(id);
alter table public.users add column if not exists client_id uuid references public.clients(id);
alter table public.user_program_enrollments add column if not exists client_id uuid references public.clients(id);
alter table public.quiz_results add column if not exists client_id uuid references public.clients(id);
alter table public.progress add column if not exists client_id uuid references public.clients(id);

-- =========================================================================
-- 3. Create the SalesRabbit client and backfill every existing row to it
--    (fixed UUID so this script is safely re-runnable)
-- =========================================================================
insert into public.clients (id, name, slug, is_template)
values ('a0000000-0000-4000-8000-000000000001', 'SalesRabbit', 'salesrabbit', false)
on conflict (id) do nothing;

update public.programs set client_id = 'a0000000-0000-4000-8000-000000000001' where client_id is null;
update public.courses set client_id = 'a0000000-0000-4000-8000-000000000001' where client_id is null;
update public.program_courses set client_id = 'a0000000-0000-4000-8000-000000000001' where client_id is null;
update public.sections set client_id = 'a0000000-0000-4000-8000-000000000001' where client_id is null;
update public.lessons set client_id = 'a0000000-0000-4000-8000-000000000001' where client_id is null;
update public.quizzes set client_id = 'a0000000-0000-4000-8000-000000000001' where client_id is null;
update public.quiz_questions set client_id = 'a0000000-0000-4000-8000-000000000001' where client_id is null;
update public.users set client_id = 'a0000000-0000-4000-8000-000000000001' where client_id is null;
update public.user_program_enrollments set client_id = 'a0000000-0000-4000-8000-000000000001' where client_id is null;
update public.quiz_results set client_id = 'a0000000-0000-4000-8000-000000000001' where client_id is null;
update public.progress set client_id = 'a0000000-0000-4000-8000-000000000001' where client_id is null;

-- =========================================================================
-- 4. Lock client_id down: NOT NULL + index everywhere
-- =========================================================================
alter table public.programs alter column client_id set not null;
alter table public.courses alter column client_id set not null;
alter table public.program_courses alter column client_id set not null;
alter table public.sections alter column client_id set not null;
alter table public.lessons alter column client_id set not null;
alter table public.quizzes alter column client_id set not null;
alter table public.quiz_questions alter column client_id set not null;
alter table public.users alter column client_id set not null;
alter table public.user_program_enrollments alter column client_id set not null;
alter table public.quiz_results alter column client_id set not null;
alter table public.progress alter column client_id set not null;

create index if not exists idx_programs_client_id on public.programs(client_id);
create index if not exists idx_courses_client_id on public.courses(client_id);
create index if not exists idx_program_courses_client_id on public.program_courses(client_id);
create index if not exists idx_sections_client_id on public.sections(client_id);
create index if not exists idx_lessons_client_id on public.lessons(client_id);
create index if not exists idx_quizzes_client_id on public.quizzes(client_id);
create index if not exists idx_quiz_questions_client_id on public.quiz_questions(client_id);
create index if not exists idx_users_client_id on public.users(client_id);
create index if not exists idx_user_program_enrollments_client_id on public.user_program_enrollments(client_id);
create index if not exists idx_quiz_results_client_id on public.quiz_results(client_id);
create index if not exists idx_progress_client_id on public.progress(client_id);

-- =========================================================================
-- 5. Widen users.role to allow 'super_admin' (drop whatever the existing
--    auto-named check constraint is called, then re-add it)
-- =========================================================================
do $$
declare
  con record;
begin
  for con in
    select c.conname
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(c.conkey)
    where rel.relname = 'users' and att.attname = 'role' and c.contype = 'c'
  loop
    execute format('alter table public.users drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.users add constraint users_role_check check (role in ('admin', 'learner', 'super_admin'));

-- =========================================================================
-- 6. Helper functions (SECURITY DEFINER so they bypass RLS internally —
--    tables are NOT marked FORCE ROW LEVEL SECURITY, so this works safely)
-- =========================================================================
create or replace function public.current_client_id()
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select client_id from public.users where auth_id = auth.uid() limit 1;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.users where auth_id = auth.uid() and role = 'super_admin'
  );
$$;

-- Claims a pending (auth_id IS NULL) invited account for the currently
-- authenticated user, matched strictly on their own VERIFIED auth email
-- (auth.email(), not anything the client could supply). Runs as
-- SECURITY DEFINER so it can find + link the row even though the caller's
-- own client_id doesn't resolve yet (they're not linked to any row). Only
-- ever touches auth_id — role/client_id on the claimed row are untouched.
create or replace function public.claim_pending_account()
returns public.users
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed public.users;
begin
  update public.users
  set auth_id = auth.uid()
  where auth_id is null
    and lower(email) = lower(auth.email())
  returning * into claimed;

  return claimed;
end;
$$;

grant execute on function public.current_client_id() to authenticated, anon;
grant execute on function public.is_super_admin() to authenticated, anon;
grant execute on function public.claim_pending_account() to authenticated;

-- =========================================================================
-- 7. Top-level tables: default client_id to the caller's own client
--    (old app code that never mentions client_id keeps working unchanged)
-- =========================================================================
alter table public.programs alter column client_id set default public.current_client_id();
alter table public.courses alter column client_id set default public.current_client_id();
alter table public.users alter column client_id set default public.current_client_id();
alter table public.quizzes alter column client_id set default public.current_client_id();

-- =========================================================================
-- 8. Child tables: derive client_id from parent via trigger (overrides
--    whatever the app sends, so app code never needs to supply it)
-- =========================================================================
create or replace function public.set_client_id_from_course()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select client_id into new.client_id from public.courses where id = new.course_id;
  return new;
end;
$$;
drop trigger if exists trg_sections_client_id on public.sections;
create trigger trg_sections_client_id
  before insert or update of course_id on public.sections
  for each row execute function public.set_client_id_from_course();

create or replace function public.set_client_id_from_section()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select client_id into new.client_id from public.sections where id = new.section_id;
  return new;
end;
$$;
drop trigger if exists trg_lessons_client_id on public.lessons;
create trigger trg_lessons_client_id
  before insert or update of section_id on public.lessons
  for each row execute function public.set_client_id_from_section();

create or replace function public.set_client_id_from_quiz()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select client_id into new.client_id from public.quizzes where id = new.quiz_id;
  return new;
end;
$$;
drop trigger if exists trg_quiz_questions_client_id on public.quiz_questions;
create trigger trg_quiz_questions_client_id
  before insert or update of quiz_id on public.quiz_questions
  for each row execute function public.set_client_id_from_quiz();

-- program_courses also guards against linking a course from a different client
create or replace function public.set_client_id_from_program()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  prog_client uuid;
  course_client uuid;
begin
  select client_id into prog_client from public.programs where id = new.program_id;
  select client_id into course_client from public.courses where id = new.course_id;
  if course_client is distinct from prog_client then
    raise exception 'Cannot link course % (client %) into program % (client %) - different clients',
      new.course_id, course_client, new.program_id, prog_client;
  end if;
  new.client_id := prog_client;
  return new;
end;
$$;
drop trigger if exists trg_program_courses_client_id on public.program_courses;
create trigger trg_program_courses_client_id
  before insert or update of program_id, course_id on public.program_courses
  for each row execute function public.set_client_id_from_program();

create or replace function public.set_client_id_from_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select client_id into new.client_id from public.users where id = new.user_id;
  return new;
end;
$$;
drop trigger if exists trg_progress_client_id on public.progress;
create trigger trg_progress_client_id
  before insert or update of user_id on public.progress
  for each row execute function public.set_client_id_from_user();
drop trigger if exists trg_quiz_results_client_id on public.quiz_results;
create trigger trg_quiz_results_client_id
  before insert or update of user_id on public.quiz_results
  for each row execute function public.set_client_id_from_user();
drop trigger if exists trg_user_program_enrollments_client_id on public.user_program_enrollments;
create trigger trg_user_program_enrollments_client_id
  before insert or update of user_id on public.user_program_enrollments
  for each row execute function public.set_client_id_from_user();

-- =========================================================================
-- 9. Enable RLS + tenant-isolation policy on all 12 tables
-- =========================================================================
alter table public.clients enable row level security;
alter table public.programs enable row level security;
alter table public.courses enable row level security;
alter table public.program_courses enable row level security;
alter table public.sections enable row level security;
alter table public.lessons enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.users enable row level security;
alter table public.user_program_enrollments enable row level security;
alter table public.quiz_results enable row level security;
alter table public.progress enable row level security;

drop policy if exists tenant_isolation on public.programs;
create policy tenant_isolation on public.programs for all
  using (client_id = public.current_client_id() or public.is_super_admin())
  with check (client_id = public.current_client_id() or public.is_super_admin());

drop policy if exists tenant_isolation on public.courses;
create policy tenant_isolation on public.courses for all
  using (client_id = public.current_client_id() or public.is_super_admin())
  with check (client_id = public.current_client_id() or public.is_super_admin());

drop policy if exists tenant_isolation on public.program_courses;
create policy tenant_isolation on public.program_courses for all
  using (client_id = public.current_client_id() or public.is_super_admin())
  with check (client_id = public.current_client_id() or public.is_super_admin());

drop policy if exists tenant_isolation on public.sections;
create policy tenant_isolation on public.sections for all
  using (client_id = public.current_client_id() or public.is_super_admin())
  with check (client_id = public.current_client_id() or public.is_super_admin());

drop policy if exists tenant_isolation on public.lessons;
create policy tenant_isolation on public.lessons for all
  using (client_id = public.current_client_id() or public.is_super_admin())
  with check (client_id = public.current_client_id() or public.is_super_admin());

drop policy if exists tenant_isolation on public.quizzes;
create policy tenant_isolation on public.quizzes for all
  using (client_id = public.current_client_id() or public.is_super_admin())
  with check (client_id = public.current_client_id() or public.is_super_admin());

drop policy if exists tenant_isolation on public.quiz_questions;
create policy tenant_isolation on public.quiz_questions for all
  using (client_id = public.current_client_id() or public.is_super_admin())
  with check (client_id = public.current_client_id() or public.is_super_admin());

drop policy if exists tenant_isolation on public.users;
create policy tenant_isolation on public.users for all
  using (client_id = public.current_client_id() or public.is_super_admin())
  with check (client_id = public.current_client_id() or public.is_super_admin());

drop policy if exists tenant_isolation on public.user_program_enrollments;
create policy tenant_isolation on public.user_program_enrollments for all
  using (client_id = public.current_client_id() or public.is_super_admin())
  with check (client_id = public.current_client_id() or public.is_super_admin());

drop policy if exists tenant_isolation on public.quiz_results;
create policy tenant_isolation on public.quiz_results for all
  using (client_id = public.current_client_id() or public.is_super_admin())
  with check (client_id = public.current_client_id() or public.is_super_admin());

drop policy if exists tenant_isolation on public.progress;
create policy tenant_isolation on public.progress for all
  using (client_id = public.current_client_id() or public.is_super_admin())
  with check (client_id = public.current_client_id() or public.is_super_admin());

-- clients: everyone can see their own client row (or super-admin sees all);
-- only super-admin can write (provisioning stays a manual/SQL process)
drop policy if exists tenant_isolation_select on public.clients;
create policy tenant_isolation_select on public.clients for select
  using (id = public.current_client_id() or public.is_super_admin());

drop policy if exists super_admin_write on public.clients;
create policy super_admin_write on public.clients for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- =========================================================================
-- 10. Fix handle_new_user: once client_id is NOT NULL, its old "no match"
--     branch (a bare INSERT with no client concept) would hard-fail with a
--     confusing not-null-violation. Replace with a clear, loud rejection
--     instead — matches the actual invite-first model (an admin must add
--     you before you can sign up). Also made the email match
--     case-insensitive while touching this. Note: Supabase Auth may wrap
--     this exception in a generic "Database error saving new user" message
--     rather than passing the custom text through to the client — that's a
--     known Supabase limitation, not a bug in this function.
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.users set auth_id = new.id
  where lower(email) = lower(new.email) and auth_id is null;

  if not found then
    raise exception 'No pending account found for %. Ask your admin to add you first.', new.email;
  end if;

  return new;
end;
$$;

commit;

-- =========================================================================
-- Verification queries — run these AFTER the script above completes
-- (not part of the transaction; read-only, safe to run anytime)
-- =========================================================================
-- select count(*) from public.clients; -- should be 1 (SalesRabbit) right after this script
-- select client_id, count(*) from public.courses group by client_id; -- everything should be SalesRabbit's id
-- select rolname from pg_roles where rolname in ('anon','authenticated'); -- sanity check roles exist

-- =========================================================================
-- Optional: promote your own account to super_admin (run separately,
-- after confirming the script above worked — replace the email below
-- with your actual admin login email if it's different)
-- =========================================================================
-- update public.users set role = 'super_admin' where email = 'cameron.hart@salesrabbit.com';

