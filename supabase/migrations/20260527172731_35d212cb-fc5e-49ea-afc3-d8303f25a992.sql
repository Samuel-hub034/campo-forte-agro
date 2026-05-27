
-- 1. Restore execute permission on has_role so RLS policies can call it
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;

-- 2. Ensure the admin email has the admin role (idempotent)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE u.email = '0001152659@senaimgaluno.com.br'
ON CONFLICT DO NOTHING;
