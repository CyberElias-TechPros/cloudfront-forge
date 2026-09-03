import type { ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/common/button";

/**
 * Shared "the data did not arrive" surface.
 *
 * Data hooks no longer convert API failures into empty lists, so every screen
 * that renders a list needs an honest error state. Without one, a 500 looks
 * identical to "you have no reviews yet".
 */
export function ErrorState({
  title = "Could not load this",
  error,
  onRetry,
  className,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return (
    <div
      role="alert"
      className={cn(
        "surface flex flex-col items-center gap-3 border-destructive/30 px-6 py-10 text-center",
        className,
      )}
    >
      <TriangleAlert className="size-6 text-destructive" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {message || "The request did not succeed. Check your connection and try again."}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Compact inline variant for cards and sidebars. */
export function ErrorNotice({
  error,
  onRetry,
  className,
  children,
}: {
  error?: unknown;
  onRetry?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive",
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <TriangleAlert className="size-3.5 shrink-0" />
        <span className="truncate">{children ?? message ?? "Something went wrong"}</span>
      </span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded border border-destructive/40 px-2 py-0.5 text-[11px] hover:bg-destructive/10"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
