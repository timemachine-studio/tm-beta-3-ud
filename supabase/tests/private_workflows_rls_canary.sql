-- Production-safe RLS canary. The temporary row is always rolled back.
begin;

do $$
declare
  owner_id uuid;
  other_id uuid := gen_random_uuid();
  canary_id text := 'rls_canary_' || replace(gen_random_uuid()::text, '-', '');
  original_role text := current_user;
  visible_rows integer;
begin
  select id into owner_id from auth.users limit 1;
  if owner_id is null then
    raise exception 'RLS canary needs one existing auth user';
  end if;

  insert into public.private_workflows
    (id, user_id, slug, title, description, instructions, steps)
  values
    (canary_id, owner_id, 'rls_canary', 'RLS canary',
     'Temporary row to verify account isolation.',
     'This temporary workflow exists only inside a rolled-back transaction.',
     '[]'::jsonb);

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into visible_rows from public.private_workflows where id = canary_id;
  if visible_rows <> 1 then
    raise exception 'Owner could not read private workflow';
  end if;

  perform set_config('request.jwt.claim.sub', other_id::text, true);
  select count(*) into visible_rows from public.private_workflows where id = canary_id;
  if visible_rows <> 0 then
    raise exception 'Another account could read private workflow';
  end if;

  perform set_config('role', original_role, true);
end;
$$;

rollback;
