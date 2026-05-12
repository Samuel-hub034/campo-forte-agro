import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Beef,
  Receipt,
  TrendingUp,
  LogOut,
  Sprout,
} from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/", label: "Painel", icon: LayoutDashboard, exact: true },
  { to: "/animais", label: "Rebanho", icon: Beef },
  { to: "/vendas", label: "Vendas", icon: Receipt },
  { to: "/precos", label: "Preços", icon: TrendingUp },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg gradient-field text-primary-foreground">
              <Sprout className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="text-base font-bold">AgroGestor</div>
              <div className="text-[11px] text-muted-foreground">
                {user?.email}
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => {
              const active = n.exact
                ? location.pathname === n.to
                : location.pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
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
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-border bg-card md:hidden">
        {nav.map((n) => {
          const active = n.exact
            ? location.pathname === n.to
            : location.pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
