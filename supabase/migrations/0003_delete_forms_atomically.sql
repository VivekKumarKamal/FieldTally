-- Delete a form and all application-owned records in one transaction.
--
-- The API uses the caller's JWT, so auth.uid() remains the authorization
-- boundary even though the function bypasses row-level policies internally.
create or replace function public.delete_owned_form(target_form_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.forms
    where id = target_form_id
      and created_by = auth.uid()
  ) then
    raise exception 'Only the form owner can delete it.' using errcode = '42501';
  end if;

  delete from public.submissions where form_id = target_form_id;
  delete from public.form_versions where form_id = target_form_id;
  delete from public.form_members where form_id = target_form_id;
  delete from public.forms where id = target_form_id;

  return true;
end;
$$;

revoke all on function public.delete_owned_form(uuid) from public;
grant execute on function public.delete_owned_form(uuid) to authenticated;
