import { useRouteError, isRouteErrorResponse, Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TriangleAlert, RotateCcw, House } from "lucide-react";

export function RouteError() {
  const error = useRouteError();

  let title = "Algo salió mal";
  let message = "Ocurrió un error inesperado al cargar esta página.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText || "Error"}`;
    if (typeof error.data === "string") message = error.data;
  } else if (error instanceof Error && error.message) {
    message = error.message;
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <TriangleAlert className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline" }))}
            onClick={() => window.location.reload()}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Recargar
          </button>
          <Link to="/" className={cn(buttonVariants({ variant: "default" }))}>
            <House className="mr-2 h-4 w-4" />
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
