import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, CheckCircle, Clock, FileText, MessageCircle, Play, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Shell, Thumb } from "@/components/page-parts";
import { useReviews, useCompleteReview, useReview, useCurrentMember } from "@/hooks/use-api";
import type { Review, ReviewAnswerInput } from "@/lib/api-client";
interface ReviewQuestion {
  id: string;
  text: string;
  type?: string;
}
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/reviews")({
  head: () => ({
    meta: [
      { title: "Reviews — LoopSquad" },
      {
        name: "description",
        content:
          "Provide and receive thoughtful peer reviews on submitted videos. Earn XP and credits.",
      },
      { property: "og:title", content: "Reviews — LoopSquad" },
      {
        property: "og:description",
        content: "Peer review for creators, built on verified watch time.",
      },
    ],
  }),
  component: Reviews,
});

const statusColors = {
  assigned: "border-border text-muted-foreground",
  in_progress: "border-accent text-accent",
  completed: "border-success text-success",
  overdue: "border-destructive/30 text-destructive",
  skipped: "border-muted text-muted-foreground",
} as const;

function Reviews() {
  const [filter, setFilter] = useState<"assigned" | "in_progress" | "completed" | "all">(
    "assigned",
  );
  const [reviewToOpen, setReviewToOpen] = useState<Review | null>(null);
  const { data: reviews = [], isLoading } = useReviews();
  const { data: member } = useCurrentMember();

  const filtered = filter === "all" ? reviews : reviews.filter((r) => r.status === filter);

  const inProgress = reviews.filter((r) => r.status === "in_progress");
  const completed = reviews.filter((r) => r.status === "completed");
  const overdue = reviews.filter((r) => r.status === "overdue");

  const filters = [
    { key: "all", label: "All" },
    { key: "assigned", label: "Assigned" },
    { key: "in_progress", label: "In Progress" },
    { key: "completed", label: "Completed" },
  ] as const;

  return (
    <Shell>
      <PageHeader
        eyebrow="Peer review"
        title="Reviews"
        description="Give and receive thoughtful feedback. Reviews unlock higher trust scores and priority queue placement."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "rounded-full border border-border px-3 py-1.5 text-xs",
                    filter === f.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-accent">
                <Clock className="size-4" />
                {inProgress.length} in progress
              </span>
              <span className="flex items-center gap-1 text-warning">
                <Calendar className="size-4" />
                {overdue.length} overdue
              </span>
              <span className="flex items-center gap-1 text-success">
                <CheckCircle className="size-4" />
                {completed.length} completed
              </span>
            </div>
          </div>
        }
      />

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="surface flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading reviews...
          </div>
        ) : null}
        {!isLoading && filtered.length === 0 ? (
          <div className="surface py-12 text-center">
            <MessageCircle className="mx-auto size-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No reviews match that filter. Great job staying on top of it!
            </p>
          </div>
        ) : null}

        {filtered.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            currentUserId={member?.id}
            onOpen={() => setReviewToOpen(review)}
          />
        ))}
      </div>

      <ReviewDialog
        review={reviewToOpen}
        open={!!reviewToOpen}
        onOpenChange={(open) => {
          if (!open) setReviewToOpen(null);
        }}
      />
    </Shell>
  );
}

function ReviewCard({
  review,
  currentUserId,
  onOpen,
}: {
  review: Review;
  currentUserId?: string | undefined;
  onOpen: () => void;
}) {
  const isMine = !!currentUserId && review.reviewerId === currentUserId;
  const role = isMine ? "Reviewer" : null;

  return (
    <article className="surface flex items-center justify-between gap-4 p-5">
      <div className="flex items-center gap-4">
        <div className="w-28 shrink-0">
          <Thumb hue={220} label="Review" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium">{review.videoTitle}</h3>
            {role ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest">
                {role}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isMine
              ? `You're reviewing ${review.submitterName}'s video`
              : review.reviewerName
                ? `${review.reviewerName} is reviewing your video`
                : "Waiting for a reviewer"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className={cn("rounded-full border px-2 py-0.5", statusColors[review.status])}>
              {review.status}
            </span>
            {review.score !== null ? (
              <span className="flex items-center gap-1">
                <Star className="size-3.5 text-accent fill-current" />
                {review.score}/5
              </span>
            ) : null}
            {review.completedAt ? (
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" />
                Completed {formatDate(review.completedAt)}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" />
                Due {formatDate(review.dueAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {review.status === "completed" ? (
          <Link
            to="/reviews/$reviewId"
            params={{ reviewId: review.id }}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium"
          >
            View feedback
          </Link>
        ) : isMine ? (
          <Button size="sm" onClick={onOpen}>
            {review.status === "in_progress" ? (
              <>
                <Play className="size-4 mr-2" /> Continue review
              </>
            ) : (
              <>
                <FileText className="size-4 mr-2" /> Start review
              </>
            )}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Waiting for {review.reviewerName ?? "a squad member"}
          </span>
        )}
      </div>
    </article>
  );
}

function ReviewDialog({
  review,
  open,
  onOpenChange,
}: {
  review: Review | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!review) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ReviewDialogContent review={review} onOpenChange={onOpenChange} />
    </Dialog>
  );
}

function ReviewDialogContent({
  review,
  onOpenChange,
}: {
  review: Review;
  onOpenChange: (open: boolean) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const completeReview = useCompleteReview();
  const { data: detail } = useReview(review.id);
  const questions = detail?.questions ?? [];

  const handleAnswer = (q: ReviewQuestion, value: string | number | boolean) => {
    setAnswers((prev) => ({ ...prev, [q.id]: value }));
  };

  const handleSubmit = async () => {
    const answersArray: ReviewAnswerInput[] = questions
      .map((q) => {
        const v = answers[q.id];
        if (typeof v === "number") return { questionId: q.id, ratingValue: v };
        if (typeof v === "boolean") return { questionId: q.id, ratingValue: v ? 1 : 0 };
        if (typeof v === "string" && v.trim()) return { questionId: q.id, textAnswer: v.trim() };
        return { questionId: q.id };
      })
      .filter((a) => typeof a.ratingValue === "number" || typeof a.textAnswer === "string");

    const ratingAnswers = answersArray.filter((a) => typeof a.ratingValue === "number");
    const score =
      ratingAnswers.length > 0
        ? Math.round(
            ratingAnswers.reduce((s, a) => s + (a.ratingValue as number), 0) / ratingAnswers.length,
          )
        : undefined;
    const textAnswers = answersArray
      .filter((a) => a.textAnswer)
      .map((a) => a.textAnswer as string)
      .join(" ");

    const payload: {
      reviewId: string;
      answers: ReviewAnswerInput[];
      score?: number;
      feedbackText?: string;
    } = { reviewId: review.id, answers: answersArray };
    if (score !== undefined) payload.score = score;
    if (textAnswers) payload.feedbackText = textAnswers;

    try {
      await completeReview.mutateAsync(payload);
      toast.success("Review submitted! Thanks for the feedback.");
      onOpenChange(false);
    } catch (error) {
      console.error("Submit review error:", error);
      toast.error("Could not submit review. Try again.");
    }
  };

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Review: {review.videoTitle}</DialogTitle>
        <DialogDescription>
          Provide thoughtful feedback for {review.submitterName}.
        </DialogDescription>
      </DialogHeader>

      <div className="py-4 space-y-6 max-h-[400px] overflow-y-auto">
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questions for this review.</p>
        ) : (
          questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <label className="text-sm font-medium">{q.text}</label>
              {q.type === "rating" ? (
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleAnswer(q, star)}
                      className={cn(
                        "rounded p-1",
                        ((answers[q.id] as number | undefined) ?? 0) >= star
                          ? "text-accent"
                          : "text-muted-foreground",
                      )}
                    >
                      <Star className="size-5 fill-current" />
                    </button>
                  ))}
                </div>
              ) : q.type === "yes_no" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAnswer(q, true)}
                    className={cn(
                      "rounded-lg border border-border px-4 py-2 text-sm",
                      answers[q.id] === true && "border-success bg-success/10 text-success",
                    )}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAnswer(q, false)}
                    className={cn(
                      "rounded-lg border border-border px-4 py-2 text-sm",
                      answers[q.id] === false &&
                        "border-destructive bg-destructive/10 text-destructive",
                    )}
                  >
                    No
                  </button>
                </div>
              ) : (
                <Textarea
                  placeholder="Your answer..."
                  value={answers[q.id] as string | undefined}
                  onChange={(e) => handleAnswer(q, e.target.value)}
                  rows={3}
                />
              )}
            </div>
          ))
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!allAnswered || completeReview.isPending}>
          {completeReview.isPending ? "Submitting..." : "Submit review"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
