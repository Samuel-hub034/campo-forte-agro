import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/use-auth";
import { useAccess } from "@/lib/use-access";
import { Sprout } from "lucide-react";

export function RequireAuth({
  children,
  requireAdmin = false,
  allowWithoutSubscription = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowWithoutSubscription?: boolean;
}) {
  const { user, loading } = useAuth();
  const access = useAccess();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (access.loading) return;
    if (requireAdmin && !access.isAdmin) {
      navigate({ to: "/" });
      return;
    }
    if (
      !allowWithoutSubscription &&
      !access.hasAccess &&
      path !== "/assinatura"
    ) {
      navigate({ to: "/assinatura" });
    }
  }, [user, loading, access, navigate, requireAdmin, allowWithoutSubscription, path]);

  if (loading || !user || access.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Sprout className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }
  if (requireAdmin && !access.isAdmin) return null;
  if (!allowWithoutSubscription && !access.hasAccess && path !== "/assinatura")
    return null;

  return <>{children}</>;
}
