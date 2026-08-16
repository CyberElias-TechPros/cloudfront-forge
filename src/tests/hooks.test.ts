import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCommunities, useMissions, useMyProfile } from "@/hooks/use-api";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({
    data: [],
    error: null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

describe("hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useCommunities returns empty array on error", async () => {
    const { result } = renderHook(() => useCommunities());
    expect(result.current.data).toEqual([]);
  });

  it("useMissions returns empty array on error", async () => {
    const { result } = renderHook(() => useMissions());
    expect(result.current.data).toEqual([]);
  });

  it("useMyProfile throws on error", async () => {
    const { result } = renderHook(() => useMyProfile());
    expect(result.current.error).toBeDefined();
  });
});
