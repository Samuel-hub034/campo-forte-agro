import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export function useAccess() {
  const { user, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["access", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const [rolesRes, subRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
        supabase.from("subscriptions").select("*").eq("user_id", user!.id).maybeSingle(),
      ]);
      const roles = (rolesRes.data ?? []).map((r) => r.role);
      const isAdmin = roles.includes("admin");
      const sub = subRes.data;
      const now = Date.now();
      type Status = "ativa" | "atrasada" | "vencida" | "pendente";
      let status: Status = "pendente";
      if (sub) {
        const raw = sub.status as Status;
        if (raw === "ativa" && sub.expires_at && new Date(sub.expires_at).getTime() < now) {
          status = "vencida";
        } else {
          status = raw;
        }
      }
      return {
        isAdmin,
        roles,
        subscription: sub,
        status,
        hasAccess: isAdmin || status === "ativa",
      };
    },
  });

  return {
    loading: loading || isLoading,
    isAdmin: data?.isAdmin ?? false,
    subscription: data?.subscription ?? null,
    status: data?.status ?? "pendente",
    hasAccess: data?.hasAccess ?? false,
  };
}
