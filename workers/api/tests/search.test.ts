import { describe, it, expect } from "vitest";
import { searchRoutes } from "../src/routes/search";
import { createTestEnv, authRequest } from "./helpers/test-env";
const route = searchRoutes[0]!;
async function data(r: Response) { return ((await r.json()) as { data: any }).data; }
describe("search", () => {
  it("treats % and _ as literal characters", async () => {
    const env = createTestEnv();
    const uid = "searcher-uid";
    env.seedUser(uid);
    const now = new Date().toISOString();
    env.sqlite.prepare("INSERT INTO communities (id, name, description, slug, invite_code, is_public, created_at, updated_at) VALUES ('c1', 'Loop Squad', 'desc', 'loop-squad', 'INV1', 1, ?, ?)").run(now, now);
    env.sqlite.prepare("INSERT INTO communities (id, name, description, slug, invite_code, is_public, created_at, updated_at) VALUES ('c2', 'Other', 'desc', 'other', 'INV2', 1, ?, ?)").run(now, now);

    const wildcard = await data(await route.handler(authRequest("https://api.test/api/v1/search?q=%25", uid), env));
    expect(wildcard.communities).toHaveLength(0);

    const real = await data(await route.handler(authRequest("https://api.test/api/v1/search?q=Loop", uid), env));
    expect(real.communities.map((c: { id: string }) => c.id)).toEqual(["c1"]);
  });
  it("requires at least two characters", async () => {
    const env = createTestEnv();
    const uid = "searcher-uid-2";
    env.seedUser(uid);
    const result = await data(await route.handler(authRequest("https://api.test/api/v1/search?q=a", uid), env));
    expect(result.communities).toEqual([]);
  });
  it("requires auth", async () => {
    const env = createTestEnv();
    const r = await route.handler(new Request("https://api.test/api/v1/search?q=loop"), env);
    expect(r.status).toBe(401);
  });
});
