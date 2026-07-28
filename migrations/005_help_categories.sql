-- RoofU Help Center categories — a managed list of category names so
-- super_admins pick from a dropdown instead of freely retyping one on every
-- article. Global, same as help_articles itself (not scoped to a client).
-- Run once in the Supabase SQL Editor.

begin;

create table if not exists public.help_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz default now()
);

-- New tables don't inherit the old blanket grants - see [[project-roofu-multitenant]]
-- for why this bit us once before with the clients table.
grant all on public.help_categories to anon;
grant all on public.help_categories to authenticated;

alter table public.help_categories enable row level security;

-- Same access model as help_articles: only super_admin can read/write.
-- (Regular admins and learners never query this table directly — they only
-- ever see the category name via help_articles.category.)
drop policy if exists help_categories_all on public.help_categories;
create policy help_categories_all on public.help_categories for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

commit;
