-- ============================================================================
-- Row Level Security policies for FieldTally
-- ============================================================================
--
-- READ THIS BEFORE APPLYING.
--
-- The application ships the Supabase *anon* key to every browser. That key is
-- safe to publish only if RLS is enabled and correct on every table: RLS is the
-- boundary that stops one customer reading another's data. The API routes in
-- src/app/api enforce the same rules a second time, but a user can always talk
-- to PostgREST directly with the anon key, so these policies are the real gate.
--
-- This file was reconstructed from the application's behaviour because the
-- project had no committed schema. Review it against your live database before
-- running it. To see what you currently have:
--
--   select schemaname, tablename, policyname, cmd, qual, with_check
--   from pg_policies where schemaname = 'public' order by tablename, policyname;
--
-- Apply with `supabase db push`, or paste into the SQL editor.
--
-- Model:
--   * A form has one creator (forms.created_by) plus rows in form_members.
--   * Roles: owner > editor > viewer > submitter.
--   * forms.access_open = true means "anyone with the link may SUBMIT".
--     It never grants read access to other people's responses, and never
--     exposes the draft or the quiz answer key.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so a policy on form_members can call them without recursing
-- into form_members' own policies.

create or replace function public.form_role(target_form_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from forms f
      where f.id = target_form_id and f.created_by = auth.uid()
    ) then 'owner'
    else (
      select m.role from form_members m
      where m.form_id = target_form_id and m.user_id = auth.uid()
      limit 1
    )
  end;
$$;

/* True for owner/editor/viewer — the people trusted with the form itself. */
create or replace function public.is_form_staff(target_form_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.form_role(target_form_id) in ('owner', 'editor', 'viewer');
$$;

create or replace function public.is_form_editor(target_form_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.form_role(target_form_id) in ('owner', 'editor');
$$;

create or replace function public.is_form_owner(target_form_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.form_role(target_form_id) = 'owner';
$$;

/* Anyone allowed to submit: members other than viewer, or any visitor when the
   form is open and published. */
create or replace function public.can_submit_to_form(target_form_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case public.form_role(target_form_id)
      when 'viewer' then false
      when 'owner' then true
      when 'editor' then true
      when 'submitter' then true
      else exists (
        select 1 from forms f
        where f.id = target_form_id
          and f.access_open = true
          and f.status = 'published'
      )
    end;
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.user_profiles  enable row level security;
alter table public.forms          enable row level security;
alter table public.form_versions  enable row level security;
alter table public.form_members   enable row level security;
alter table public.submissions    enable row level security;

-- ---------------------------------------------------------------------------
-- user_profiles
-- ---------------------------------------------------------------------------
-- A user manages only their own profile row. Reads are NOT open to all
-- authenticated users: that would let anyone dump the full email list. The
-- members API looks people up by exact email, which the policy below allows
-- without permitting enumeration by prefix or a bare select.

drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own on public.user_profiles
  for select using (id = auth.uid());

drop policy if exists user_profiles_select_collaborators on public.user_profiles;
create policy user_profiles_select_collaborators on public.user_profiles
  for select using (
    exists (
      select 1 from form_members m
      where m.user_id = user_profiles.id
        and public.is_form_owner(m.form_id)
    )
  );

drop policy if exists user_profiles_insert_own on public.user_profiles;
create policy user_profiles_insert_own on public.user_profiles
  for insert with check (id = auth.uid());

drop policy if exists user_profiles_update_own on public.user_profiles;
create policy user_profiles_update_own on public.user_profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- NOTE: adding a member by email needs a lookup on a profile the caller cannot
-- otherwise see. Do that with a SECURITY DEFINER function rather than opening
-- up user_profiles for reads:
create or replace function public.find_user_id_by_email(lookup_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from user_profiles where lower(email) = lower(lookup_email) limit 1;
$$;

revoke all on function public.find_user_id_by_email(text) from public;
grant execute on function public.find_user_id_by_email(text) to authenticated;

-- ---------------------------------------------------------------------------
-- forms
-- ---------------------------------------------------------------------------

drop policy if exists forms_select on public.forms;
create policy forms_select on public.forms
  for select using (
    created_by = auth.uid()
    or exists (
      select 1 from form_members m
      where m.form_id = forms.id and m.user_id = auth.uid()
    )
    -- A visitor may see an open published form exists so they can fill it in.
    -- draft_schema is column-level protected below.
    or (access_open = true and status = 'published')
  );

drop policy if exists forms_insert on public.forms;
create policy forms_insert on public.forms
  for insert with check (created_by = auth.uid());

drop policy if exists forms_update on public.forms;
create policy forms_update on public.forms
  for update using (public.is_form_editor(id)) with check (public.is_form_editor(id));

drop policy if exists forms_delete on public.forms;
create policy forms_delete on public.forms
  for delete using (public.is_form_owner(id));

-- `forms.draft_schema` holds unpublished questions and, in quiz mode, the answer
-- key. RLS is row-level only: the policy above lets a signed-out visitor see an
-- open form's row so they can fill it in, and without this revoke they could
-- select the draft column from it too.
--
-- Revoked for `anon` only. `authenticated` keeps it because the dashboard reads
-- the form title out of draft_schema.
--
-- RESIDUAL GAP: a signed-in user who is not a member can still read
-- draft_schema of a form whose access_open = true, because they legitimately
-- need the row to submit. Closing that fully needs one of:
--   1. a SUPABASE_SERVICE_ROLE_KEY for the API so RLS can deny non-members
--      outright and the server does the access check, or
--   2. a dedicated `forms.title` column so draft_schema can be revoked from
--      `authenticated` as well.
-- Option 2 is the smaller change and is recommended before you rely on quiz
-- integrity in a mixed-tenant deployment.
revoke select (draft_schema) on public.forms from anon;
grant select (draft_schema) on public.forms to service_role;

-- ---------------------------------------------------------------------------
-- form_versions
-- ---------------------------------------------------------------------------
-- The published schema must be readable by takers, but its `content` carries the
-- quiz answer key. Row access is granted broadly for open forms and the API
-- strips the key before responding; if you rely on quiz integrity, restrict this
-- policy to staff and serve every taker through /api/forms/:id instead.

drop policy if exists form_versions_select on public.form_versions;
create policy form_versions_select on public.form_versions
  for select using (
    public.is_form_staff(form_id)
    or exists (
      select 1 from forms f
      where f.id = form_versions.form_id
        and f.status = 'published'
        and (
          f.access_open = true
          or exists (
            select 1 from form_members m
            where m.form_id = f.id and m.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists form_versions_insert on public.form_versions;
create policy form_versions_insert on public.form_versions
  for insert with check (public.is_form_editor(form_id));

-- Published versions are immutable: submissions reference them by number, so
-- editing one would silently rewrite the questions people already answered.
drop policy if exists form_versions_update on public.form_versions;
drop policy if exists form_versions_delete on public.form_versions;
create policy form_versions_delete on public.form_versions
  for delete using (public.is_form_owner(form_id));

-- Publishing allocates version numbers with a read-then-insert, which two
-- concurrent publishes can race. This constraint turns that race into a
-- retryable unique violation instead of two rows sharing a version number.
create unique index if not exists form_versions_form_id_version_key
  on public.form_versions (form_id, version);

-- ---------------------------------------------------------------------------
-- form_members
-- ---------------------------------------------------------------------------
-- Owner-only management. Without this any authenticated user could insert a row
-- granting themselves a role on somebody else's form.

drop policy if exists form_members_select on public.form_members;
create policy form_members_select on public.form_members
  for select using (user_id = auth.uid() or public.is_form_staff(form_id));

drop policy if exists form_members_insert on public.form_members;
create policy form_members_insert on public.form_members
  for insert with check (public.is_form_owner(form_id));

drop policy if exists form_members_update on public.form_members;
create policy form_members_update on public.form_members
  for update using (public.is_form_owner(form_id)) with check (public.is_form_owner(form_id));

drop policy if exists form_members_delete on public.form_members;
create policy form_members_delete on public.form_members
  for delete using (public.is_form_owner(form_id));

create unique index if not exists form_members_form_id_user_id_key
  on public.form_members (form_id, user_id);

-- ---------------------------------------------------------------------------
-- submissions
-- ---------------------------------------------------------------------------
-- The important one. Reading every response requires an explicit staff role;
-- a submitter sees only their own. Being able to submit to an open form grants
-- no read access at all.

drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions
  for select using (
    public.is_form_staff(form_id)
    or (submitted_by is not null and submitted_by = auth.uid())
  );

drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions
  for insert with check (
    public.can_submit_to_form(form_id)
    -- Nobody may file a response under another user's identity. Anonymous
    -- responses (submitted_by is null) stay allowed for open forms.
    and (submitted_by is null or submitted_by = auth.uid())
  );

drop policy if exists submissions_update on public.submissions;
create policy submissions_update on public.submissions
  for update using (
    public.is_form_editor(form_id)
    or (submitted_by is not null and submitted_by = auth.uid())
  );

drop policy if exists submissions_delete on public.submissions;
create policy submissions_delete on public.submissions
  for delete using (public.is_form_editor(form_id));

-- ---------------------------------------------------------------------------
-- Indexes for the access paths above
-- ---------------------------------------------------------------------------
-- Every policy above filters on these columns, so they are evaluated on each
-- row of each query. Without indexes the checks degrade to sequential scans as
-- the tables grow.

create index if not exists forms_created_by_updated_at_idx
  on public.forms (created_by, updated_at desc);

create index if not exists form_members_user_id_idx
  on public.form_members (user_id);

create index if not exists submissions_form_id_filled_at_idx
  on public.submissions (form_id, filled_at desc);

create index if not exists submissions_form_id_version_idx
  on public.submissions (form_id, form_version);

create index if not exists submissions_submitted_by_idx
  on public.submissions (submitted_by);

create index if not exists form_versions_form_id_version_desc_idx
  on public.form_versions (form_id, version desc);

create unique index if not exists user_profiles_email_lower_idx
  on public.user_profiles (lower(email));
