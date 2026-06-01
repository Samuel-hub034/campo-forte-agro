import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export type AccessStatus = "ativa" | "trial" | "atrasada" | "vencida" | "cancelada" | "pendente";

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
      const sub = subRes.data as (typeof subRes.data & {
        trial_ends_at?: string | null;
        auto_renew?: boolean;
        cancelled_at?: string | null;
      }) | null;
      const now = Date.now();
      let status: AccessStatus = "pendente";
      let trialDaysLeft = 0;
      if (sub) {
        const raw = sub.status as AccessStatus;
        if (raw === "trial" && sub.trial_ends_at) {
          const end = new Date(sub.trial_ends_at).getTime();
          if (end > now) {
            status = "trial";
            trialDaysLeft = Math.max(0, Math.ceil((end - now) / 86_400_000));
          } else {
            status = "vencida";
          }
        } else if (raw === "ativa" && sub.expires_at && new Date(sub.expires_at).getTime() < now) {
          status = "vencida";
        } else {
          status = raw;
        }
      }
      const hasAccess = isAdmin || status === "ativa" || status === "trial";
      return { isAdmin, roles, subscription: sub, status, hasAccess, trialDaysLeft };
    },
  });

  return {
    loading: loading || isLoading,
    isAdmin: data?.isAdmin ?? false,
    subscription: data?.subscription ?? null,
    status: (data?.status ?? "pendente") as AccessStatus,
    hasAccess: data?.hasAccess ?? false,
    trialDaysLeft: data?.trialDaysLeft ?? 0,
  };
}
