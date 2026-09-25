import { useMemberProfile } from "@/hooks/use-api";
import { X } from "lucide-react";

/**
 * Read-only profile card for another member: identity always, creator fields
 * only when the member keeps their profile public (the API hides private
 * profiles, so a null profile here is the member's choice — not an error).
 */
export function MemberProfileDialog({
  userId,
  displayName,
  onClose,
}: {
  userId: string;
  displayName?: string | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useMemberProfile(userId);

  const profile = data?.profile ?? null;
  const name = data?.displayName ?? displayName ?? "Creator";

  const rows: Array<[string, string]> = profile
    ? [
        ...(profile.niche ? ([["Niche", profile.niche]] as [string, string][]) : []),
        ...(profile.country ? ([["Country", profile.country]] as [string, string][]) : []),
        ...(profile.experienceLevel
          ? ([["Experience", profile.experienceLevel]] as [string, string][])
          : []),
        ...(profile.lookingFor
          ? ([["Looking for", profile.lookingFor]] as [string, string][])
          : []),
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="surface w-full max-w-md p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center overflow-hidden rounded-full bg-accent font-display text-xl text-accent-foreground">
              {data?.photoUrl ? (
                <img src={data.photoUrl} alt="" className="size-full object-cover" />
              ) : (
                name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
              )}
            </span>
            <div>
              <h3 className="text-xl font-semibold">{name}</h3>
              {profile?.publicProfile === 0 ? (
                <p className="text-xs text-muted-foreground">Profile is private</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close profile"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading profile…</p>
        ) : isError ? (
          <p className="mt-4 text-sm text-destructive">Could not load this profile right now.</p>
        ) : profile?.bio ? (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{profile.bio}</p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No bio shared yet.</p>
        )}

        {!isLoading && !isError && rows.length > 0 ? (
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-secondary/60 p-3">
                <dt className="text-xs uppercase tracking-widest text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-sm font-medium capitalize">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {!isLoading && !isError && profile?.goals ? (
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Goals:</span> {profile.goals}
          </p>
        ) : null}
      </div>
    </div>
  );
}
