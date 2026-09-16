import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, BarChart3, CheckCircle2, Settings2, Users, XCircle } from "lucide-react";
import { PageHeader, Shell, StatCard } from "@/components/page-parts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import apiClientService from "@/lib/api-client";
import {
  useAdminReports,
  useAdminMetrics,
  useResolveReport,
  useAdminUsers,
  useCurrentMember,
  useUserPermissions,
  useAdminAnalytics,
  useAdminRetention,
  useAdminTopups,
  useApproveTopup,
  useRejectTopup,
} from "@/hooks/use-api";
import { ErrorNotice } from "@/components/common/query-state";

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
  const analyticsQuery = useAdminAnalytics();
  const retentionQuery = useAdminRetention();
  const resolveReportMutation = useResolveReport();
  const usersQuery = useAdminUsers("active");
  const users = usersQuery.data ?? [];
  const topupsQuery = useAdminTopups("pending");
  const topups = topupsQuery.data ?? [];
  const panels = [
    { label: "metrics", query: statsQuery },
    { label: "reports", query: flagsQuery },
    { label: "users", query: usersQuery },
    { label: "top-ups", query: topupsQuery },
  ];
  const failedQuery = panels.find((p) => p.query.isError);
  const approveTopup = useApproveTopup();
  const rejectTopup = useRejectTopup();
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

      {failedQuery ? (
        <ErrorNotice
          className="mt-6"
          error={failedQuery.query.error}
          onRetry={() => {
            void statsQuery.refetch();
            void flagsQuery.refetch();
            void usersQuery.refetch();
            void topupsQuery.refetch();
          }}
        >
          {`Could not load ${failedQuery.label}. Some panels below may be incomplete.`}
        </ErrorNotice>
      ) : null}

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

      {/* Analytics funnel */}
      {analyticsQuery.data && (
        <div className="mt-6 surface p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <BarChart3 className="size-4" /> Funnel — {analyticsQuery.data.period}
          </h3>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: "Videos submitted", value: analyticsQuery.data.totals.submits },
              { label: "Watch claims", value: analyticsQuery.data.totals.claims },
              { label: "Reviews done", value: analyticsQuery.data.totals.reviews },
              { label: "Claim rate", value: `${analyticsQuery.data.totals.claimRate}%` },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cohort retention */}
      {retentionQuery.data && retentionQuery.data.cohorts.length > 0 && (
        <div className="mt-6 surface p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="size-4" /> Cohort Retention (W1 / W4)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Cohort date</th>
                  <th className="pb-2 pr-4 text-right">Users</th>
                  <th className="pb-2 pr-4 text-right">Week 1</th>
                  <th className="pb-2 text-right">Week 4</th>
                </tr>
              </thead>
              <tbody>
                {retentionQuery.data.cohorts.map((c) => (
                  <tr key={c.date} className="border-b border-border/50">
                    <td className="py-2 pr-4 tabular-nums">{c.date}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{c.total}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      <span
                        className={cn(
                          "font-medium",
                          c.week1Retention >= 50
                            ? "text-green-400"
                            : c.week1Retention >= 25
                              ? "text-yellow-400"
                              : "text-red-400",
                        )}
                      >
                        {c.week1Retention}%
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      <span
                        className={cn(
                          "font-medium",
                          c.week4Retention >= 30
                            ? "text-green-400"
                            : c.week4Retention >= 10
                              ? "text-yellow-400"
                              : "text-red-400",
                        )}
                      >
                        {c.week4Retention}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

          <section className="surface p-6">
            <h2 className="text-3xl">NGN top-ups</h2>
            {topupsQuery.isError ? (
              <ErrorNotice
                error={topupsQuery.error}
                onRetry={() => void topupsQuery.refetch()}
                className="mt-4"
              >
                Could not load pending top-ups
              </ErrorNotice>
            ) : null}
            {topups.length ? (
              <ul className="mt-4 space-y-3">
                {topups.map((t) => (
                  <li key={t.id} className="rounded-lg bg-secondary/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{t.displayName ?? t.email ?? "Member"}</p>
                      <span className="text-sm font-semibold tabular-nums">
                        ₦{t.ngnAmount.toLocaleString()} → {t.creditsAmount} credits
                      </span>
                    </div>
                    {t.proofImagePath ? (
                      <div className="mt-2">
                        <ProofThumb id={t.id} name={t.proofImageName} />
                      </div>
                    ) : (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        Ref: {t.transferReference}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString()}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                        onClick={() => {
                          void approveTopup.mutate(t.id, {
                            onSuccess: (res) =>
                              toast.success(
                                `Top-up approved — ${res.credits} credits issued (balance ${res.balance})`,
                              ),
                            onError: (e: unknown) =>
                              toast.error(e instanceof Error ? e.message : String(e)),
                          });
                        }}
                      >
                        <CheckCircle2 className="size-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold"
                        onClick={() => {
                          const reason =
                            window.prompt(
                              "Reason for rejection (shown to the member)",
                              "Payment not found",
                            ) ?? "Payment not found";
                          void rejectTopup.mutate(
                            { id: t.id, reason },
                            {
                              onSuccess: () => toast.success("Top-up rejected"),
                              onError: (e: unknown) =>
                                toast.error(e instanceof Error ? e.message : String(e)),
                            },
                          );
                        }}
                      >
                        <XCircle className="size-3.5" /> Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No pending NGN top-ups</p>
            )}
          </section>
        </div>
      </div>
    </Shell>
  );
}

// Fetches the receipt for a top-up (via the admin-only proof endpoint) and
// shows an inline thumbnail that opens at full size. The object URL is created
// locally and revoked on unmount or when the id changes.
function ProofThumb({ id, name }: { id: string; name?: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setState("loading");
    setUrl(null);
    apiClientService.topups
      .proofBlob(id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (state === "loading") {
    return (
      <div className="grid h-24 place-items-center rounded-lg border border-border bg-secondary/40 text-xs text-muted-foreground">
        Loading proof…
      </div>
    );
  }

  if (state === "error" || !url) {
    return (
      <p className="text-xs text-destructive">
        Proof could not be loaded — {name ? `"${name}"` : "see original transfer reference"}.
      </p>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Open full size"
      className="block w-fit rounded-lg border border-border"
    >
      <img
        src={url}
        alt={name ?? "Transfer receipt"}
        className="max-h-40 rounded-lg object-contain bg-black/5"
      />
    </a>
  );
}
