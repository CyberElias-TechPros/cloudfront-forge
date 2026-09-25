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
  useAdminAppeals,
  useReviewAppeal,
  useAdminSupport,
  useResolveSupport,
  useSuspendUser,
  useReinstateUser,
  useSetUserRole,
  useAdminCommunities,
  useCreateMission,
  useCreateMissionChain,
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
  const appealsQuery = useAdminAppeals("pending");
  const appeals = appealsQuery.data ?? [];
  const supportQuery = useAdminSupport("open");
  const supportRequests = supportQuery.data ?? [];
  const reviewAppeal = useReviewAppeal();
  const resolveSupport = useResolveSupport();
  const suspendUser = useSuspendUser();
  const reinstateUser = useReinstateUser();
  const setUserRole = useSetUserRole();
  const [memberFilter, setMemberFilter] = useState<"active" | "suspended">("active");
  const membersQuery = useAdminUsers(memberFilter);
  const isAdminRole = permissionsData?.role === "admin" || permissionsData?.role === "super_admin";
  const panels = [
    // Moderator-tier accounts never load the admin-only panels, so their
    // queries are left out of the failure surface.
    ...(isAdminRole ? [{ label: "metrics", query: statsQuery }] : []),
    { label: "reports", query: flagsQuery },
    ...(isAdminRole
      ? [
          { label: "users", query: usersQuery },
          { label: "top-ups", query: topupsQuery },
        ]
      : []),
  ];
  const failedQuery = panels.find((p) => p.query.isError);
  const approveTopup = useApproveTopup();
  const rejectTopup = useRejectTopup();
  const isAdmin = permissionsData?.role === "admin" || permissionsData?.role === "super_admin";
  // Moderators work the moderation tier (reports, appeals, support) without
  // seeing analytics, user management or money flows.
  const isModerator = permissionsData?.role === "moderator";

  if (memberLoading) {
    return (
      <Shell>
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      </Shell>
    );
  }

  if (!isAdmin && !isModerator) {
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

      {isAdmin ? (
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
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Open flags"
            value={(flagsQuery.data?.length ?? 0).toString()}
            icon={<AlertTriangle className="size-4" />}
          />
          <StatCard
            label="Pending appeals"
            value={appeals.length.toString()}
            icon={<CheckCircle2 className="size-4" />}
          />
        </div>
      )}

      {/* Analytics funnel */}
      {isAdmin && analyticsQuery.data && (
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
      {isAdmin && retentionQuery.data && retentionQuery.data.cohorts.length > 0 && (
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

          {isAdmin && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Appeals */}
      <section className="surface mt-6 p-6">
        <h2 className="text-3xl">Appeals</h2>
        {appealsQuery.isError ? (
          <ErrorNotice
            error={appealsQuery.error}
            onRetry={() => void appealsQuery.refetch()}
            className="mt-4"
          >
            Could not load appeals
          </ErrorNotice>
        ) : null}
        {appeals.length ? (
          <ul className="mt-4 space-y-3">
            {appeals.map((a) => (
              <li key={a.id} className="rounded-lg bg-secondary/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {a.reportedName ?? "Member"} · {a.reportReason} report on {a.resourceType}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{a.reason}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    disabled={reviewAppeal.isPending}
                    onClick={() => {
                      void reviewAppeal.mutate(
                        { appealId: a.id, status: "accepted" },
                        {
                          onSuccess: () =>
                            toast.success(
                              "Appeal accepted — report dismissed, penalty reversed, video restored if it was removed",
                            ),
                          onError: (e: unknown) =>
                            toast.error(e instanceof Error ? e.message : String(e)),
                        },
                      );
                    }}
                  >
                    <CheckCircle2 className="size-3.5" /> Accept appeal
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold"
                    disabled={reviewAppeal.isPending}
                    onClick={() => {
                      const note = window.prompt("Optional note shown to the member") ?? undefined;
                      void reviewAppeal.mutate(
                        { appealId: a.id, status: "rejected", note },
                        {
                          onSuccess: () => toast.success("Appeal rejected"),
                          onError: (e: unknown) =>
                            toast.error(e instanceof Error ? e.message : String(e)),
                        },
                      );
                    }}
                  >
                    <XCircle className="size-3.5" /> Reject appeal
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No pending appeals</p>
        )}
      </section>

      {/* Support inbox */}
      <section className="surface mt-6 p-6">
        <h2 className="text-3xl">Support inbox</h2>
        {supportQuery.isError ? (
          <ErrorNotice
            error={supportQuery.error}
            onRetry={() => void supportQuery.refetch()}
            className="mt-4"
          >
            Could not load support requests
          </ErrorNotice>
        ) : null}
        {supportRequests.length ? (
          <ul className="mt-4 space-y-3">
            {supportRequests.map((s) => (
              <li key={s.id} className="rounded-lg bg-secondary/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {s.userName ?? "Member"}{" "}
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-accent">
                      {s.topic}
                    </span>
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {s.message}
                </p>
                {s.userEmail ? (
                  <p className="mt-1 text-xs text-muted-foreground">{s.userEmail}</p>
                ) : null}
                <div className="mt-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    disabled={resolveSupport.isPending}
                    onClick={() => {
                      void resolveSupport.mutate(s.id, {
                        onSuccess: () => toast.success("Request resolved — member notified"),
                        onError: (e: unknown) =>
                          toast.error(e instanceof Error ? e.message : String(e)),
                      });
                    }}
                  >
                    <CheckCircle2 className="size-3.5" /> Mark resolved
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No open support requests</p>
        )}
      </section>

      {/* Member moderation (admin tier only) */}
      {isAdmin && (
        <section className="surface mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl">Member moderation</h2>
            <div className="flex gap-2">
              {(["active", "suspended"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setMemberFilter(f)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-semibold capitalize",
                    memberFilter === f
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {membersQuery.isError ? (
            <ErrorNotice
              error={membersQuery.error}
              onRetry={() => void membersQuery.refetch()}
              className="mt-4"
            >
              Could not load members
            </ErrorNotice>
          ) : null}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="p-3">Member</th>
                  <th className="p-3">Trust</th>
                  <th className="p-3">Role</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(membersQuery.data ?? []).slice(0, 25).map((u) => (
                  <tr key={u.id} className="border-b border-border/50 last:border-0">
                    <td className="p-3">
                      <p className="font-medium">{u.displayName ?? u.email ?? "Member"}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="p-3 tabular-nums">{u.trustScore ?? 100}%</td>
                    <td className="p-3">
                      <select
                        value={u.platformRole ?? "member"}
                        onChange={(e) => {
                          const role = e.target.value as "moderator" | "admin" | "member";
                          void setUserRole.mutate(
                            { userId: u.id, role: role === "member" ? null : role },
                            {
                              onSuccess: () => toast.success("Platform role updated"),
                              onError: (err: unknown) =>
                                toast.error(err instanceof Error ? err.message : String(err)),
                            },
                          );
                        }}
                        className="rounded-md border border-border bg-card px-2 py-1 text-xs"
                      >
                        <option value="member">member</option>
                        <option value="moderator">moderator</option>
                        <option value="admin">admin</option>
                      </select>
                      {u.platformRole === "super_admin" ? (
                        <span className="ml-2 text-xs text-accent">super admin</span>
                      ) : null}
                    </td>
                    <td className="p-3 text-right">
                      {memberFilter === "active" ? (
                        <button
                          type="button"
                          className="rounded-md border border-destructive/50 px-2.5 py-1 text-xs font-semibold text-destructive"
                          disabled={suspendUser.isPending}
                          onClick={() => {
                            const reason = window.prompt("Reason for suspension (shown to member)");
                            if (reason === null) return;
                            void suspendUser.mutate(
                              { userId: u.id, reason: reason || undefined },
                              {
                                onSuccess: () => toast.success("Member suspended"),
                                onError: (e: unknown) =>
                                  toast.error(e instanceof Error ? e.message : String(e)),
                              },
                            );
                          }}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold"
                          disabled={reinstateUser.isPending}
                          onClick={() => {
                            void reinstateUser.mutate(u.id, {
                              onSuccess: () => toast.success("Member reinstated"),
                              onError: (e: unknown) =>
                                toast.error(e instanceof Error ? e.message : String(e)),
                            });
                          }}
                        >
                          Reinstate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Communities overview (admin tier only) */}
      {isAdmin && <AdminCommunitiesPanel />}

      {/* Mission authoring (admin tier only) */}
      {isAdmin && <AdminMissionsPanel />}
    </Shell>
  );
}

function AdminCommunitiesPanel() {
  const [filter, setFilter] = useState<"all" | "active" | "archived">("all");
  const communitiesQuery = useAdminCommunities(filter === "all" ? undefined : filter);
  const rows = communitiesQuery.data?.items ?? [];

  return (
    <section className="surface mt-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl">Communities</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {communitiesQuery.data
              ? `${communitiesQuery.data.total} communit${communitiesQuery.data.total === 1 ? "y" : "ies"} on the platform`
              : "Every squad, its owner and size at a glance."}
          </p>
        </div>
        <div className="flex gap-2">
          {(["all", "active", "archived"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-semibold capitalize",
                filter === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {communitiesQuery.isError ? (
        <ErrorNotice
          error={communitiesQuery.error}
          onRetry={() => void communitiesQuery.refetch()}
          className="mt-4"
        >
          Could not load communities
        </ErrorNotice>
      ) : communitiesQuery.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading communities…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No communities match this filter.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Community</th>
                <th className="p-3">Owner</th>
                <th className="p-3 text-right">Members</th>
                <th className="p-3">Visibility</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3">
                    <p className="font-medium">{c.name}</p>
                    {c.description ? (
                      <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                        {c.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="p-3 text-muted-foreground">{c.ownerName ?? "—"}</td>
                  <td className="p-3 text-right tabular-nums">{c.memberCount}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {c.isPublic ? "Public" : "Invite only"}
                  </td>
                  <td className="p-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        c.status === "active"
                          ? "bg-success/15 text-success"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

function AdminMissionsPanel() {
  const createMission = useCreateMission();
  const createChain = useCreateMissionChain();

  const [mission, setMission] = useState({
    title: "",
    description: "",
    difficulty: "medium" as Difficulty,
    xpReward: 25,
    creditReward: 10,
    timeEstimateMinutes: 15,
  });
  const [chain, setChain] = useState({
    niche: "",
    steps: [
      {
        title: "",
        description: "",
        difficulty: "easy" as Difficulty,
        xpReward: 15,
        creditReward: 5,
      },
      {
        title: "",
        description: "",
        difficulty: "medium" as Difficulty,
        xpReward: 25,
        creditReward: 10,
      },
    ],
  });

  const inputClass =
    "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const submitMission = () => {
    if (mission.title.trim().length < 5) {
      toast.error("Mission title needs at least 5 characters");
      return;
    }
    createMission.mutate(
      { ...mission, title: mission.title.trim(), description: mission.description.trim() },
      {
        onSuccess: () => {
          toast.success("Mission created — it is live in the mission catalogue");
          setMission((prev) => ({ ...prev, title: "", description: "" }));
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
      },
    );
  };

  const submitChain = () => {
    if (chain.niche.trim().length < 2) {
      toast.error("Give the chain a niche (e.g. Tech reviews)");
      return;
    }
    if (chain.steps.some((step) => step.title.trim().length < 5)) {
      toast.error("Every step needs a title of at least 5 characters");
      return;
    }
    createChain.mutate(
      {
        niche: chain.niche.trim(),
        steps: chain.steps.map((step) => ({ ...step, title: step.title.trim() })),
      },
      {
        onSuccess: (data) => {
          toast.success(`Chain created with ${data.steps} steps`);
          setChain((prev) => ({
            niche: "",
            steps: prev.steps.map((step) => ({ ...step, title: "", description: "" })),
          }));
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
      },
    );
  };

  const stepFields = (step: (typeof chain.steps)[number], index: number) => (
    <div key={index} className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Step {index + 1}
        </p>
        {chain.steps.length > 2 ? (
          <button
            type="button"
            className="text-xs font-medium text-destructive hover:underline"
            onClick={() =>
              setChain((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }))
            }
          >
            Remove
          </button>
        ) : null}
      </div>
      <input
        value={step.title}
        placeholder={`Step ${index + 1} title (min 5 chars)`}
        maxLength={200}
        onChange={(e) =>
          setChain((prev) => ({
            ...prev,
            steps: prev.steps.map((s, i) => (i === index ? { ...s, title: e.target.value } : s)),
          }))
        }
        className={inputClass}
      />
      <textarea
        value={step.description}
        placeholder="What the member should do"
        rows={2}
        maxLength={1000}
        onChange={(e) =>
          setChain((prev) => ({
            ...prev,
            steps: prev.steps.map((s, i) =>
              i === index ? { ...s, description: e.target.value } : s,
            ),
          }))
        }
        className={inputClass}
      />
      <div className="mt-2 grid grid-cols-3 gap-2">
        <label className="text-xs text-muted-foreground">
          Difficulty
          <select
            value={step.difficulty}
            onChange={(e) =>
              setChain((prev) => ({
                ...prev,
                steps: prev.steps.map((s, i) =>
                  i === index ? { ...s, difficulty: e.target.value as Difficulty } : s,
                ),
              }))
            }
            className={inputClass}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          XP
          <input
            type="number"
            min={0}
            value={step.xpReward}
            onChange={(e) =>
              setChain((prev) => ({
                ...prev,
                steps: prev.steps.map((s, i) =>
                  i === index ? { ...s, xpReward: Math.max(0, Number(e.target.value) || 0) } : s,
                ),
              }))
            }
            className={inputClass}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Credits
          <input
            type="number"
            min={0}
            value={step.creditReward}
            onChange={(e) =>
              setChain((prev) => ({
                ...prev,
                steps: prev.steps.map((s, i) =>
                  i === index
                    ? { ...s, creditReward: Math.max(0, Number(e.target.value) || 0) }
                    : s,
                ),
              }))
            }
            className={inputClass}
          />
        </label>
      </div>
    </div>
  );

  return (
    <section className="surface mt-6 p-6">
      <h2 className="text-3xl">Mission authoring</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Publish one-off missions or a 2–5 step chain. Both go live in the catalogue immediately and
        are recorded in the audit log.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-lg font-semibold">Single mission</h3>
          <div className="mt-3 space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">
              Title
              <input
                value={mission.title}
                maxLength={200}
                placeholder="Comment on 3 squad videos"
                onChange={(e) => setMission((prev) => ({ ...prev, title: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Description
              <textarea
                value={mission.description}
                rows={3}
                maxLength={1000}
                placeholder="Leave a thoughtful comment on three videos from your community."
                onChange={(e) => setMission((prev) => ({ ...prev, description: e.target.value }))}
                className={inputClass}
              />
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="text-xs text-muted-foreground">
                Difficulty
                <select
                  value={mission.difficulty}
                  onChange={(e) =>
                    setMission((prev) => ({ ...prev, difficulty: e.target.value as Difficulty }))
                  }
                  className={inputClass}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                XP
                <input
                  type="number"
                  min={0}
                  value={mission.xpReward}
                  onChange={(e) =>
                    setMission((prev) => ({
                      ...prev,
                      xpReward: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Credits
                <input
                  type="number"
                  min={0}
                  value={mission.creditReward}
                  onChange={(e) =>
                    setMission((prev) => ({
                      ...prev,
                      creditReward: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Minutes
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={mission.timeEstimateMinutes}
                  onChange={(e) =>
                    setMission((prev) => ({
                      ...prev,
                      timeEstimateMinutes: Math.min(300, Math.max(1, Number(e.target.value) || 15)),
                    }))
                  }
                  className={inputClass}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={submitMission}
              disabled={createMission.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createMission.isPending ? "Publishing…" : "Publish mission"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-lg font-semibold">Mission chain</h3>
          <label className="mt-3 block text-xs font-medium text-muted-foreground">
            Niche prefix
            <input
              value={chain.niche}
              maxLength={50}
              placeholder="Tech reviews"
              onChange={(e) => setChain((prev) => ({ ...prev, niche: e.target.value }))}
              className={inputClass}
            />
          </label>
          <div className="mt-3 space-y-3">
            {chain.steps.map(stepFields)}
            {chain.steps.length < 5 ? (
              <button
                type="button"
                className="w-full rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary hover:text-foreground"
                onClick={() =>
                  setChain((prev) => ({
                    ...prev,
                    steps: [
                      ...prev.steps,
                      {
                        title: "",
                        description: "",
                        difficulty: "medium" as Difficulty,
                        xpReward: 25,
                        creditReward: 10,
                      },
                    ],
                  }))
                }
              >
                + Add step (2–5 steps)
              </button>
            ) : null}
            <button
              type="button"
              onClick={submitChain}
              disabled={createChain.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createChain.isPending ? "Creating…" : "Create chain"}
            </button>
          </div>
        </div>
      </div>
    </section>
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
