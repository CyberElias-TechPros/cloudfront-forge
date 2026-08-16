import { describe, it, expect, vi } from "vitest";

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
};

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => mockApiClient),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("api client", () => {
  it("get returns data from successful response", async () => {
    const mockData = { success: true, data: { id: "1", name: "Test" } };
    mockApiClient.get.mockResolvedValue({ data: mockData });

    const { api } = await import("@/lib/api");
    const result = await api.get<{ id: string; name: string }>("/test");
    expect(result).toEqual({ id: "1", name: "Test" });
  });

  it("post returns data from successful response", async () => {
    const mockData = { success: true, data: { id: "2", message: "Created" } };
    mockApiClient.post.mockResolvedValue({ data: mockData });

    const { api } = await import("@/lib/api");
    const result = await api.post<{ id: string; message: string }>("/test", { name: "New" });
    expect(result).toEqual({ id: "2", message: "Created" });
  });

  it("put returns data from successful response", async () => {
    const mockData = { success: true, data: { id: "1", name: "Updated" } };
    mockApiClient.put.mockResolvedValue({ data: mockData });

    const { api } = await import("@/lib/api");
    const result = await api.put<{ id: string; name: string }>("/test/1", { name: "Updated" });
    expect(result).toEqual({ id: "1", name: "Updated" });
  });

  it("delete returns data from successful response", async () => {
    const mockData = { success: true, data: { deleted: true } };
    mockApiClient.delete.mockResolvedValue({ data: mockData });

    const { api } = await import("@/lib/api");
    const result = await api.delete<{ deleted: boolean }>("/test/1");
    expect(result).toEqual({ deleted: true });
  });

  it("throws on unsuccessful response", async () => {
    const mockData = { success: false, data: null };
    mockApiClient.get.mockResolvedValue({ data: mockData });

    const { api } = await import("@/lib/api");
    await expect(api.get("/test")).rejects.toThrow("Invalid API response structure");
  });
});
