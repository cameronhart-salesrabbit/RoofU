-- RoofU multi-tenant conversion — clone "Generic External Template"
-- (a0000000-0000-4000-8000-000000000002) into a new client, "Roofing Template"
-- (a0000000-0000-4000-8000-000000000003).
--
-- Same pattern as migrations/002_template_client_clone.sql, generalized to
-- an arbitrary source/target client. Run once. Not safe to re-run blindly
-- (would create a second duplicate copy) — see cleanup query at the bottom
-- if you need to redo it.

begin;

-- 1. Create the new client
insert into public.clients (id, name, slug, is_template)
values ('a0000000-0000-4000-8000-000000000003', 'Roofing Template', 'roofing-template', false)
on conflict (id) do nothing;

-- Mapping tables: old id -> new id, generated up front so every later step
-- can join against a stable, already-known mapping.
create temp table map_programs (old_id uuid primary key, new_id uuid not null) on commit drop;
create temp table map_courses (old_id uuid primary key, new_id uuid not null) on commit drop;
create temp table map_sections (old_id uuid primary key, new_id uuid not null) on commit drop;
create temp table map_lessons (old_id uuid primary key, new_id uuid not null) on commit drop;
create temp table map_quizzes (old_id uuid primary key, new_id uuid not null) on commit drop;

insert into map_programs (old_id, new_id)
select id, uuid_generate_v4() from public.programs where client_id = 'a0000000-0000-4000-8000-000000000002';

insert into map_courses (old_id, new_id)
select id, uuid_generate_v4() from public.courses where client_id = 'a0000000-0000-4000-8000-000000000002';

insert into map_sections (old_id, new_id)
select id, uuid_generate_v4() from public.sections where client_id = 'a0000000-0000-4000-8000-000000000002';

insert into map_lessons (old_id, new_id)
select id, uuid_generate_v4() from public.lessons where client_id = 'a0000000-0000-4000-8000-000000000002';

insert into map_quizzes (old_id, new_id)
select id, uuid_generate_v4() from public.quizzes where client_id = 'a0000000-0000-4000-8000-000000000002';

-- 2. Clone programs
insert into public.programs (id, title, description, client_id, created_at, updated_at)
select m.new_id, p.title, p.description, 'a0000000-0000-4000-8000-000000000003', now(), now()
from public.programs p join map_programs m on m.old_id = p.id;

-- 3. Clone courses (quiz_id left null for now, patched in step 8)
insert into public.courses (id, title, description, product, quiz_id, is_published, client_id, created_at, updated_at)
select m.new_id, c.title, c.description, c.product, null, c.is_published, 'a0000000-0000-4000-8000-000000000003', now(), now()
from public.courses c join map_courses m on m.old_id = c.id;

-- 4. Clone program_courses (remap both program_id and course_id)
insert into public.program_courses (program_id, course_id, "order", client_id)
select mp.new_id, mc.new_id, pc."order", 'a0000000-0000-4000-8000-000000000003'
from public.program_courses pc
join map_programs mp on mp.old_id = pc.program_id
join map_courses mc on mc.old_id = pc.course_id
where pc.client_id = 'a0000000-0000-4000-8000-000000000002';

-- 5. Clone sections (quiz_id left null for now, patched in step 8)
insert into public.sections (id, title, course_id, quiz_id, "order", client_id)
select ms.new_id, s.title, mc.new_id, null, s."order", 'a0000000-0000-4000-8000-000000000003'
from public.sections s
join map_sections ms on ms.old_id = s.id
join map_courses mc on mc.old_id = s.course_id;

-- 6. Clone lessons (quiz_id left null for now, patched in step 8)
insert into public.lessons (
  id, title, section_id, video_type, video_url, written_content, quiz_id,
  duration_minutes, attachment_url, attachment_name, "order", client_id, created_at, updated_at
)
select
  ml.new_id, l.title, msec.new_id, l.video_type, l.video_url, l.written_content, null,
  l.duration_minutes, l.attachment_url, l.attachment_name, l."order", 'a0000000-0000-4000-8000-000000000003', now(), now()
from public.lessons l
join map_lessons ml on ml.old_id = l.id
join map_sections msec on msec.old_id = l.section_id;

-- 7. Clone quizzes, remapping the polymorphic attached_to_id per attached_to_type
insert into public.quizzes (id, title, attached_to_id, attached_to_type, pass_threshold, max_retakes, show_correct_answers, client_id)
select
  mq.new_id,
  q.title,
  case q.attached_to_type
    when 'course' then (select new_id from map_courses where old_id = q.attached_to_id)
    when 'section' then (select new_id from map_sections where old_id = q.attached_to_id)
    when 'lesson' then (select new_id from map_lessons where old_id = q.attached_to_id)
  end,
  q.attached_to_type,
  q.pass_threshold,
  q.max_retakes,
  q.show_correct_answers,
  'a0000000-0000-4000-8000-000000000003'
from public.quizzes q
join map_quizzes mq on mq.old_id = q.id;

-- 8. Clone quiz_questions
insert into public.quiz_questions (id, quiz_id, question_text, options, correct_option_index, "order", client_id)
select uuid_generate_v4(), mq.new_id, qq.question_text, qq.options, qq.correct_option_index, qq."order", 'a0000000-0000-4000-8000-000000000003'
from public.quiz_questions qq
join map_quizzes mq on mq.old_id = qq.quiz_id;

-- 9. Patch the reverse quiz_id pointers on the cloned courses/sections/lessons
update public.courses c
set quiz_id = mq.new_id
from public.courses src
join map_courses mc on mc.old_id = src.id
join map_quizzes mq on mq.old_id = src.quiz_id
where c.id = mc.new_id and src.quiz_id is not null;

update public.sections s
set quiz_id = mq.new_id
from public.sections src
join map_sections ms on ms.old_id = src.id
join map_quizzes mq on mq.old_id = src.quiz_id
where s.id = ms.new_id and src.quiz_id is not null;

update public.lessons l
set quiz_id = mq.new_id
from public.lessons src
join map_lessons ml on ml.old_id = src.id
join map_quizzes mq on mq.old_id = src.quiz_id
where l.id = ml.new_id and src.quiz_id is not null;

commit;

-- =========================================================================
-- Verify row counts match between the source and the new client
-- =========================================================================
select 'programs' as t, count(*) filter (where client_id = 'a0000000-0000-4000-8000-000000000002') as source, count(*) filter (where client_id = 'a0000000-0000-4000-8000-000000000003') as roofing_template from public.programs
union all
select 'courses', count(*) filter (where client_id = 'a0000000-0000-4000-8000-000000000002'), count(*) filter (where client_id = 'a0000000-0000-4000-8000-000000000003') from public.courses
union all
select 'program_courses', count(*) filter (where client_id = 'a0000000-0000-4000-8000-000000000002'), count(*) filter (where client_id = 'a0000000-0000-4000-8000-000000000003') from public.program_courses
union all
select 'sections', count(*) filter (where client_id = 'a0000000-0000-4000-8000-000000000002'), count(*) filter (where client_id = 'a0000000-0000-4000-8000-000000000003') from public.sections
union all
select 'lessons', count(*) filter (where client_id = 'a0000000-0000-4000-8000-000000000002'), count(*) filter (where client_id = 'a0000000-0000-4000-8000-000000000003') from public.lessons
union all
select 'quizzes', count(*) filter (where client_id = 'a0000000-0000-4000-8000-000000000002'), count(*) filter (where client_id = 'a0000000-0000-4000-8000-000000000003') from public.quizzes
union all
select 'quiz_questions', count(*) filter (where client_id = 'a0000000-0000-4000-8000-000000000002'), count(*) filter (where client_id = 'a0000000-0000-4000-8000-000000000003') from public.quiz_questions;
-- every row's "source" and "roofing_template" counts should be equal

-- =========================================================================
-- Cleanup (only if you need to re-run this script from scratch) — client_id
-- foreign keys do NOT cascade-delete, so clean up child tables first:
-- =========================================================================
-- delete from public.quiz_questions where client_id = 'a0000000-0000-4000-8000-000000000003';
-- delete from public.quizzes where client_id = 'a0000000-0000-4000-8000-000000000003';
-- delete from public.lessons where client_id = 'a0000000-0000-4000-8000-000000000003';
-- delete from public.sections where client_id = 'a0000000-0000-4000-8000-000000000003';
-- delete from public.program_courses where client_id = 'a0000000-0000-4000-8000-000000000003';
-- delete from public.courses where client_id = 'a0000000-0000-4000-8000-000000000003';
-- delete from public.programs where client_id = 'a0000000-0000-4000-8000-000000000003';
-- delete from public.clients where id = 'a0000000-0000-4000-8000-000000000003';
