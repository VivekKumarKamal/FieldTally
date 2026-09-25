-- ============================================================================
-- Data Exercises: templates + exercise instances on top of forms/submissions
-- ============================================================================
--
-- A "template" is a forms row with kind = 'exercise_template'. "Using" a
-- template clones it into a forms row with kind = 'exercise' (same idea as
-- apps/web/src/lib/templates.ts's createFormFromTemplate, just persisted).
-- Entries are ordinary `submissions` rows against that instance.
--
-- No RLS policy changes are needed: forms_select's existing
-- `(access_open = true and status = 'published')` clause already makes a
-- public template or a public exercise instance readable by anyone,
-- including anonymous visitors, regardless of created_by. See
-- 0001_row_level_security.sql for that policy.
--
-- Apply with `supabase db push`, or paste into the SQL editor.
-- ============================================================================

alter table public.forms
  add column if not exists kind text not null default 'form'
  check (kind in ('form', 'exercise', 'exercise_template'));

create index if not exists forms_public_templates_idx
  on public.forms (kind, access_open, status)
  where kind = 'exercise_template';

create index if not exists forms_created_by_kind_idx
  on public.forms (created_by, kind, updated_at desc);

-- ---------------------------------------------------------------------------
-- Seed: built-in "Class Entry Tracker" template
-- ---------------------------------------------------------------------------
-- Owner-less (created_by = null) so it can never be edited/deleted through the
-- app (forms_update/forms_delete require is_form_owner, which is never true
-- for a null created_by). Only runnable via SQL editor / service role.

insert into public.forms (id, kind, draft_schema, status, access_open, created_by)
values (
  '00000000-0000-4000-8000-000000000001',
  'exercise_template',
  jsonb_build_object(
    'title', 'Class Entry Tracker',
    'content', jsonb_build_object(
      'type', 'doc',
      'attrs', jsonb_build_object('liveDuringExercise', true, 'chartConfig', jsonb_build_object()),
      'content', jsonb_build_array(
        jsonb_build_object(
          'type', 'heading',
          'attrs', jsonb_build_object('level', 1),
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Class Entry Tracker'))
        ),
        jsonb_build_object(
          'type', 'paragraph',
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Tap the button each time a student walks in.'))
        )
      )
    )
  ),
  'published',
  true,
  null
)
on conflict (id) do nothing;

insert into public.form_versions (form_id, title, content, version, created_by)
select
  '00000000-0000-4000-8000-000000000001',
  'Class Entry Tracker',
  (select draft_schema -> 'content' from public.forms where id = '00000000-0000-4000-8000-000000000001'),
  1,
  null
where not exists (
  select 1 from public.form_versions where form_id = '00000000-0000-4000-8000-000000000001'
);
