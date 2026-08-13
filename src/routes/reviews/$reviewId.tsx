import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Star } from "lucide-react";
import { PageHeader, Shell } from "@/components/page-parts";
import { useReview } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reviews/$reviewId")({
  head: ({ params }) => {
    return {
      meta: [{ title: "Review — LoopSquad" }],
    };
  },
  component: ReviewDetail,
});

function ReviewDetail() {
  const { reviewId } = Route.useParams();
  const { data: detail, isLoading } = useReview(reviewId);

  if (isLoading) {
    return (
      <Shell>
        <div className="py-12 text-center text-sm text-muted-foreground">Loading review…</div>
      </Shell>
    );
  }

  if (!detail) {
    return (
      <Shell>
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Review not found.</p>
        </div>
      </Shell>
    );
  }

  const review = detail.review;

  return (
    <Shell>
      <div className="mb-4">
        <Link
          to="/reviews"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to reviews
        </Link>
      </div>

      <PageHeader
        eyebrow="Completed review"
        title={review.videoTitle}
        description={`Review by ${review.reviewerName ?? "a squad member"} for ${review.submitterName}'s video`}
      />

      <div className="mt-6 space-y-6">
        <section className="surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-3xl">Score: {review.score}/5</h2>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "size-5",
                    i < (review.score ?? 0) ? "text-accent fill-current" : "text-muted-foreground",
                  )}
                />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {detail.questions?.map((q) => {
              const answer = detail.answers?.find((a) => a.questionId === q.id);
              return (
                <div key={q.id} className="space-y-2">
                  <p className="text-sm font-medium">{q.text}</p>
                  {answer ? (
                    <p className="text-sm text-muted-foreground">
                      {typeof answer.answer === "boolean"
                        ? answer.answer
                          ? "Yes"
                          : "No"
                        : String(answer.answer)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Not answered</p>
                  )}
                </div>
              );
            })}
          </div>

          {review.feedbackText ? (
            <div className="mt-6">
              <p className="text-sm font-medium">Written feedback</p>
              <p className="mt-2 text-sm text-muted-foreground">{review.feedbackText}</p>
            </div>
          ) : null}
        </section>

        <section className="surface p-6">
          <h2 className="text-3xl mb-4">Review context</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {[
              ["Reviewer", review.reviewerName ?? "Unknown"],
              ["Submitter", review.submitterName],
              ["Status", review.status],
              ["Completed", review.completedAt ? formatDate(review.completedAt) : "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-widest text-muted-foreground">{k}</dt>
                <dd className="mt-1 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </Shell>
  );
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
