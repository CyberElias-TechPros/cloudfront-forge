import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useCommunities,
  useCurrentMember,
  useMissions,
  useMyProfile,
  useUnreadNotificationCount,
  useUserPermissions,
} from "@/hooks/use-api";
import { apiClientService } from "@/lib/api-client";

// Only the transport is stubbed: the hooks, React Query and the mapping helpers
// all run for real, so a query that fails must surface as an error state
// instead of being turned into an empty list inside the hook.
vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  // The hooks import the service through the module's *default* export, so both
  // the default and the named binding have to be replaced.
  const stub = {
    communities: { list: vi.fn() },
    missions: { list: vi.fn() },
    users: { profile: vi.fn(), member: vi.fn() },
    auth: { permissions: vi.fn() },
    notifications: { unreadCount: vi.fn() },
  };
  return { ...actual, apiClientService: stub, default: stub };
});

const service = apiClientService as unknown as {
  communities: { list: ReturnType<typeof vi.fn> };
  missions: { list: ReturnType<typeof vi.fn> };
  users: { profile: ReturnType<typeof vi.fn>; member: ReturnType<typeof vi.fn> };
  auth: { permissions: ReturnType<typeof vi.fn> };
  notifications: { unreadCount: ReturnType<typeof vi.fn> };
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("data hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useCommunities maps the payload", async () => {
    service.communities.list.mockResolvedValue({
      items: [{ id: "c1", name: "Loop Squad", memberCount: 3, createdAt: "2024-01-01" }],
    });
    const { result } = renderHook(() => useCommunities(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toMatchObject({ id: "c1", name: "Loop Squad" });
  });

  it("useCommunities surfaces API failures instead of an empty list", async () => {
    service.communities.list.mockRejectedValue(new Error("Service Unavailable"));
    const { result } = renderHook(() => useCommunities(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });

  it("useMissions surfaces API failures instead of an empty list", async () => {
    service.missions.list.mockRejectedValue(new Error("Service Unavailable"));
    const { result } = renderHook(() => useMissions(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("useMyProfile propagates the error to the caller", async () => {
    service.users.profile.mockRejectedValue(new Error("Unauthorized"));
    const { result } = renderHook(() => useMyProfile(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("keeps header queries dormant until member bootstrap is complete", () => {
    const member = renderHook(() => useCurrentMember(false), { wrapper });
    const permissions = renderHook(() => useUserPermissions(false), { wrapper });
    const notifications = renderHook(() => useUnreadNotificationCount(false), { wrapper });

    expect(member.result.current.fetchStatus).toBe("idle");
    expect(permissions.result.current.fetchStatus).toBe("idle");
    expect(notifications.result.current.fetchStatus).toBe("idle");
    expect(service.users.member).not.toHaveBeenCalled();
    expect(service.auth.permissions).not.toHaveBeenCalled();
    expect(service.notifications.unreadCount).not.toHaveBeenCalled();
  });
});
