-- RoofU Help Center — global content, not scoped to any client.
-- Run once in the Supabase SQL Editor.

begin;

create table if not exists public.help_articles (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  category text not null default 'General',
  content text,
  is_published boolean not null default true,
  "order" integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- New tables don't inherit the old blanket grants - see [[project-roofu-multitenant]]
-- for why this bit us once before with the clients table.
grant all on public.help_articles to anon;
grant all on public.help_articles to authenticated;

alter table public.help_articles enable row level security;

-- Anyone logged in (any client, any role) can read published articles.
-- super_admin can also see unpublished drafts, to preview before publishing.
drop policy if exists help_articles_select on public.help_articles;
create policy help_articles_select on public.help_articles for select
  using (is_published = true or public.is_super_admin());

-- Only super_admin can create/edit/delete - this is shared platform content,
-- not scoped to one client, so regular per-client admins can't touch it.
drop policy if exists help_articles_write on public.help_articles;
create policy help_articles_write on public.help_articles for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

commit;
