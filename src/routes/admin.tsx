import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Settings2, Users, XCircle } from "lucide-react";
import { PageHeader, Shell, StatCard } from "@/components/page-parts";
import { cn } from "@/lib/utils";
import {
  useAdminReports,
  useAdminMetrics,
  useResolveReport,
  useAdminUsers,
  useCurrentMember,
  useUserPermissions,
} from "@/hooks/use-api";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — LoopSquad" },
      {
        name: "description",
        content:
          "Review cheat flags, moderate the queue, adjust sprint settings and manage squad membership.",
      },
      { property: "og:title", content: "Admin Console — LoopSquad" },
      {
        property: "og:description",
        content: "Cheat flags, queue moderation and sprint settings for squad admins.",
      },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { isLoading: memberLoading } = useCurrentMember();
  const { data: permissionsData } = useUserPermissions();
  const flagsQuery = useAdminReports("pending");
  const statsQuery = useAdminMetrics();
  const resolveReportMutation = useResolveReport();
  const usersQuery = useAdminUsers("active");
  const users = usersQuery.data ?? [];
  const isAdmin = permissionsData?.role === "admin" || permissionsData?.role === "super_admin";

  if (memberLoading) {
    return (
      <Shell>
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      </Shell>
    );
  }

  if (!isAdmin) {
    return (
      <Shell>
        <div className="py-16 text-center">
          <XCircle className="mx-auto size-12 text-destructive/60" />
          <p className="mt-3 text-lg font-medium">Admin access required</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You don't have permission to view this console.
          </p>
        </div>
      </Shell>
    );
  }

  const watchlist = users
    .filter((m) => (m.trustScore ?? 100) < 90)
    .map((m) => ({
      id: m.id,
      name: m.displayName ?? "Member",
      handle: m.email ? `@${m.email.split("@")[0]}` : "@member",
      avatar: (m.displayName ?? "M").charAt(0).toUpperCase(),
      trustScore: m.trustScore ?? 100,
    }));

  return (
    <Shell>
      <PageHeader
        eyebrow="Moderators only"
        title="Admin console"
        description="Keep the loop honest: resolve flags, moderate the queue and tune this sprint's settings."
        action={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium"
          >
            <Settings2 className="size-4" /> Sprint settings
          </button>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Members"
          value={statsQuery.data?.users?.toString() ?? "—"}
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Open flags"
          value={(flagsQuery.data?.length ?? 0).toString()}
          hint={`${flagsQuery.data?.filter((f) => f.status === "pending").length || 0} high severity`}
          icon={<AlertTriangle className="size-4" />}
        />
        <StatCard
          label="Reviews"
          value={statsQuery.data?.reviews?.toString() ?? "—"}
          icon={<CheckCircle2 className="size-4" />}
        />
        <StatCard
          label="Communities"
          value={statsQuery.data?.communities?.toString() ?? "—"}
          icon={<Users className="size-4" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="surface p-6">
          <h2 className="text-3xl">Cheat flags</h2>
          <ul className="mt-4 space-y-3">
            {flagsQuery.data?.length ? (
              <ul className="mt-4 space-y-3">
                {flagsQuery.data?.map((f) => (
                  <li key={f.id} className="rounded-lg bg-secondary/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{f.reportedUserName}</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest",
                          f.status === "pending"
                            ? "bg-destructive/15 text-destructive"
                            : f.status === "investigating"
                              ? "bg-warning/15 text-warning"
                              : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {f.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{f.reason}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                        onClick={() => {
                          void resolveReportMutation.mutate({
                            reportId: f.id,
                            status: "resolved",
                            notes: `Resolved: ${f.reason}`,
                          });
                        }}
                      >
                        <XCircle className="size-3.5" /> Penalise
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold"
                        onClick={() => {
                          void resolveReportMutation.mutate({
                            reportId: f.id,
                            status: "dismissed",
                            notes: "Flag dismissed",
                          });
                        }}
                      >
                        <CheckCircle2 className="size-3.5" /> Dismiss
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No open flags</p>
            )}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="surface p-6">
            <h2 className="text-3xl">Queue moderation</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {flagsQuery.data?.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block line-clamp-1 font-medium">{f.reportedUserName}</span>
                    <span className="text-xs text-muted-foreground">{f.reason}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground"
                      onClick={() => {
                        void resolveReportMutation.mutate({
                          reportId: f.id,
                          status: "resolved",
                          notes: `Resolved: ${f.reason}`,
                        });
                      }}
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground"
                      onClick={() => {
                        void resolveReportMutation.mutate({
                          reportId: f.id,
                          status: "dismissed",
                          notes: "Flag dismissed",
                        });
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface p-6">
            <h2 className="text-3xl">Low trust watchlist</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {watchlist.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold">
                      {m.avatar}
                    </span>
                    <span>
                      <span className="block font-medium">{m.name}</span>
                      <span className="text-xs text-muted-foreground">{m.handle}</span>
                    </span>
                  </span>
                  <span className="text-sm text-warning">{m.trustScore}%</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </Shell>
  );
}
