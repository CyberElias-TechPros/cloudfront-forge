import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { PageHeader, Shell } from "@/components/page-parts";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearch } from "@/hooks/use-api";
import { ErrorState } from "@/components/common/query-state";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — LoopSquad" },
      {
        name: "description",
        content: "Search communities and videos on LoopSquad.",
      },
    ],
  }),
  component: SearchPage,
});

interface CommunitySearchResult {
  id: string;
  name: string;
  description?: string | null;
}

interface VideoSearchResult {
  id: string;
  title: string;
  creatorName?: string | null;
}

function SearchPage() {
  const [query, setQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  });
  const { data: results, isLoading, isError, error, refetch } = useSearch(query);

  useEffect(() => {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("q") || "";
    setQuery(q);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    const url = new URL(window.location.href);
    if (trimmed) {
      url.searchParams.set("q", trimmed);
    } else {
      url.searchParams.delete("q");
    }
    window.history.replaceState({}, "", url.toString());
  };

  const communities = useMemo(
    () => (results?.communities ?? []) as CommunitySearchResult[],
    [results],
  );
  const videos = useMemo(() => (results?.videos ?? []) as VideoSearchResult[], [results]);

  return (
    <Shell>
      <PageHeader
        eyebrow="Find"
        title="Search"
        description="Search communities and videos across LoopSquad."
      />

      <form onSubmit={handleSearch} className="mt-6">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search communities and videos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </form>

      <div className="mt-8 grid gap-6">
        {isLoading && <p className="text-sm text-muted-foreground">Searching...</p>}

        {isError ? (
          <ErrorState title="Search failed" error={error} onRetry={() => void refetch()} />
        ) : null}

        {!isLoading && !isError && query.length > 0 && (
          <>
            <section>
              <h2 className="mb-4 text-2xl font-semibold">Communities</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {communities.length === 0 && (
                  <p className="text-sm text-muted-foreground">No communities found.</p>
                )}
                {communities.map((c) => (
                  <Card key={c.id}>
                    <CardHeader>
                      <CardTitle>{c.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{c.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold">Videos</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {videos.length === 0 && (
                  <p className="text-sm text-muted-foreground">No videos found.</p>
                )}
                {videos.map((v) => (
                  <Card key={v.id}>
                    <CardHeader>
                      <CardTitle>{v.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        by {v.creatorName || "Unknown"}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}
