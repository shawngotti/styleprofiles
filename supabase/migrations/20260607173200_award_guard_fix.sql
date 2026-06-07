-- Batch 9 (fix) — narrow the award submission publish guard to the owning pro.
-- The first version keyed off auth.uid(), which broke the consent-resolution
-- path: award_consent_resolved (SECURITY DEFINER) cascades an UPDATE to the
-- submission, but auth.uid() inside it is still the *subject's* JWT, so the
-- guard wrongly blocked the auto-publish.
--
-- Correct rule: only the owning pro is restricted from changing their own
-- entry's status / editing a published entry. Everyone else who can reach the
-- row is trusted — admins, the service-role Edge Function (auth.uid() null, so
-- owns_pro is false), and the consent trigger (acts as the subject, who does
-- not own the pro). RLS (awardsub_admin_update: is_admin OR owns_pro) already
-- bars any other browser actor from updating the row at all.

create or replace function public.award_submission_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or not public.owns_pro(old.pro_id) then
    return new;  -- admin, server context, or the consent trigger (subject)
  end if;
  -- owning pro, acting from the browser:
  if new.status is distinct from old.status then
    raise exception 'only admins may change a submission''s status';
  end if;
  if old.status <> 'pending' then
    raise exception 'this submission can no longer be edited';
  end if;
  return new;
end;
$$;
