import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

export type Permission =
  | "read"
  | "write"
  | "admin"
  | "moderate"
  | "manage_users"
  | "manage_communities"
  | "manage_videos"
  | "manage_reviews"
  | "manage_missions"
  | "view_analytics";

interface RequirePermissionProps {
  permission: Permission | Permission[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequirePermission({ permission, children, fallback }: RequirePermissionProps) {
  const { user, loading } = useAuth();

  const { data: permissionsData, isLoading: permissionsLoading } = useQuery({
    queryKey: ["auth", "permissions"],
    queryFn: async () => {
      const response = await api.get<{ permissions: string[]; role: string }>(
        "/api/v1/auth/permissions",
      );
      return response;
    },
    enabled: !!user,
  });

  if (loading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !permissionsData) {
    return fallback ?? null;
  }

  const userPermissions = permissionsData.permissions as Permission[];
  const requiredPermissions = Array.isArray(permission) ? permission : [permission];
  const hasAccess = requiredPermissions.some((p) => userPermissions.includes(p));

  if (!hasAccess) {
    return fallback ?? null;
  }

  return <>{children}</>;
}
