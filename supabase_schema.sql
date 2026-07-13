-- RoofU LMS — Supabase Schema
-- This file is a reference snapshot of the table shapes for a fresh setup.
-- It does NOT include RLS policies, helper functions, or triggers — those
-- are defined procedurally in migrations/001_multi_tenant.sql (run that
-- after this file, then migrations/002_template_client_clone.sql once).

create extension if not exists "uuid-ossp";

-- Clients (tenants) — added by migrations/001_multi_tenant.sql
create table clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  is_template boolean not null default false,
  created_at timestamptz default now()
);

-- Programs
create table programs (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  client_id uuid not null references clients(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Courses
create table courses (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  product text not null default 'SalesRabbit',
  quiz_id uuid,
  is_published boolean default true,
  client_id uuid not null references clients(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Program ↔ Course join (ordered)
create table program_courses (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid references programs(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  "order" integer default 0,
  client_id uuid not null references clients(id)
);

-- Sections
create table sections (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  course_id uuid references courses(id) on delete cascade,
  quiz_id uuid,
  "order" integer default 0,
  client_id uuid not null references clients(id)
);

-- Lessons
create table lessons (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  section_id uuid references sections(id) on delete cascade,
  video_type text check (video_type in ('youtube', 'mp4')) default 'youtube',
  video_url text,
  written_content text,
  quiz_id uuid,
  duration_minutes integer,
  attachment_url text,
  attachment_name text,
  "order" integer default 0,
  client_id uuid not null references clients(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Quizzes
create table quizzes (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  attached_to_id uuid,
  attached_to_type text check (attached_to_type in ('lesson', 'section', 'course')),
  pass_threshold integer default 80,
  max_retakes integer,
  show_correct_answers boolean default false,
  client_id uuid not null references clients(id)
);

-- Quiz Questions
create table quiz_questions (
  id uuid primary key default uuid_generate_v4(),
  quiz_id uuid references quizzes(id) on delete cascade,
  question_text text not null,
  options jsonb not null default '[]',
  correct_option_index integer not null default 0,
  "order" integer default 0,
  client_id uuid not null references clients(id)
);

-- Users
-- auth_id links to auth.users.id, set either by the handle_new_user trigger
-- (email match on signup) or the claim_pending_account() RPC (fallback).
-- email is globally unique across ALL clients by design — one email = one
-- client, never touch this constraint when working on multi-tenant features.
create table users (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  role text check (role in ('admin', 'learner', 'super_admin')) default 'learner',
  auth_id uuid,
  client_id uuid not null references clients(id),
  created_at timestamptz default now()
);

-- User ↔ Program enrollments
create table user_program_enrollments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  program_id uuid references programs(id) on delete cascade,
  enrolled_at timestamptz default now(),
  client_id uuid not null references clients(id)
);

-- Learner progress per course
create table progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  completed_lesson_ids jsonb default '[]',
  completed_section_ids jsonb default '[]',
  course_completed boolean default false,
  last_lesson_id uuid references lessons(id) on delete set null,
  last_updated timestamptz default now(),
  client_id uuid not null references clients(id),
  unique(user_id, course_id)
);

-- Quiz results
create table quiz_results (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  quiz_id uuid references quizzes(id) on delete cascade,
  score integer,
  passed boolean,
  completed_at timestamptz default now(),
  client_id uuid not null references clients(id)
);
