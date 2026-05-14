import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  subtitle,
  backTo = "/",
  right,
}: {
  title: string;
  subtitle?: string;
  backTo?: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const canGoBack =
    typeof window !== "undefined" && window.history.length > 1;

  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {canGoBack ? (
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.history.back()}
            aria-label="Voltar"
            className="mt-0.5 h-10 w-10 shrink-0 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            asChild
            aria-label="Voltar ao painel"
            className="mt-0.5 h-10 w-10 shrink-0 rounded-xl"
          >
            <Link to={backTo as never}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
