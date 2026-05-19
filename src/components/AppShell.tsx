import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Beef,
  Receipt,
  TrendingUp,
  LogOut,
  Sprout,
  CloudSun,
  FileBarChart,
  Shield,
  Stethoscope,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/use-auth";
import { useAccess } from "@/lib/use-access";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const baseNav: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/", label: "Painel", icon: LayoutDashboard, exact: true },
  { to: "/animais", label: "Rebanho", icon: Beef },
  { to: "/vendas", label: "Vendas", icon: Receipt },
  { to: "/saude", label: "Saúde", icon: Stethoscope },
  { to: "/clima", label: "Clima", icon: CloudSun },
  { to: "/precos", label: "Preços", icon: TrendingUp },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const { isAdmin } = useAccess();
  const navigate = useNavigate();
  const location = useLocation();
  const [confirmOut, setConfirmOut] = useState(false);

  const nav = useMemo(
    () =>
      isAdmin
        ? [...baseNav, { to: "/admin", label: "Admin", icon: Shield }]
        : baseNav,
    [isAdmin],
  );

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg gradient-field text-primary-foreground">
              <Sprout className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5 text-base font-bold">
                AgroGestor
                {isAdmin && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    ADMIN
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">{user?.email}</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => {
              const active = n.exact
                ? location.pathname === n.to
                : location.pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to as never}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50"
                  )}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmOut(true)}
            aria-label="Sair da conta"
          >
            <LogOut className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-30 grid border-t border-border bg-card md:hidden",
          isAdmin ? "grid-cols-8" : "grid-cols-7"
        )}
      >
        {nav.map((n) => {
          const active = n.exact
            ? location.pathname === n.to
            : location.pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to as never}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          );
        })}
      </nav>

      <AlertDialog open={confirmOut} onOpenChange={setConfirmOut}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Você precisará fazer login novamente para acessar o sistema. Se
              só quer voltar ao painel, clique em Cancelar e use o botão
              Voltar ou o menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
            >
              Sim, sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
