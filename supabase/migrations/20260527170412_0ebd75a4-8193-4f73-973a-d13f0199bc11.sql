
-- 1. Payments: remove user self-insert
DROP POLICY IF EXISTS "users insert own payments" ON public.payments;

-- 2. Subscriptions: restrict insert to safe defaults
DROP POLICY IF EXISTS "users insert own sub" ON public.subscriptions;
CREATE POLICY "users insert own sub safe defaults"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pendente'
  AND amount = 120
  AND expires_at IS NULL
  AND started_at IS NULL
);

-- Also restrict user updates so they can't self-activate
DROP POLICY IF EXISTS "users update own sub" ON public.subscriptions;
-- (users have no update path; admins still manage via "admins manage all subs")

-- 3. user_roles: add restrictive policy blocking non-admin inserts/updates/deletes
CREATE POLICY "only admins write roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Realtime: remove tables from publication to prevent cross-user broadcast leaks
ALTER PUBLICATION supabase_realtime DROP TABLE public.animals;
ALTER PUBLICATION supabase_realtime DROP TABLE public.sales;

-- 5. Lock down SECURITY DEFINER functions from direct execution by clients
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_animal_weight() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
-- These remain callable internally by RLS policies and triggers (run as definer/owner).
