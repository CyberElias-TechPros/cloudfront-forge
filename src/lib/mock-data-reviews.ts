export type ReviewStatus = "assigned" | "in_progress" | "completed" | "overdue" | "skipped";

export type Review = {
  id: string;
  videoId: string;
  videoTitle: string;
  videoThumbnail: string | null;
  youtubeUrl: string;
  submitterId: string;
  submitterName: string;
  submitterHandle: string;
  reviewerId: string;
  reviewerName: string;
  reviewerHandle: string;
  status: ReviewStatus;
  score: number | null;
  feedbackText: string | null;
  questions: ReviewQuestion[];
  answers: ReviewAnswer[];
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  dueAt: string;
};

export type ReviewQuestion = {
  id: string;
  text: string;
  type: "rating" | "text" | "boolean";
};

export type ReviewAnswer = {
  questionId: string;
  questionText: string;
  answer: string | number | boolean;
};

export const reviewQuestions: ReviewQuestion[] = [
  { id: "q1", text: "Video quality (1-5 stars)", type: "rating" },
  { id: "q2", text: "Audio clarity (1-5 stars)", type: "rating" },
  { id: "q3", text: "Content helpfulness (1-5 stars)", type: "rating" },
  { id: "q4", text: "Thumbnail appeal (1-5 stars)", type: "rating" },
  { id: "q5", text: "What did you like most?", type: "text" },
  { id: "q6", text: "What could be improved?", type: "text" },
  { id: "q7", text: "Would you recommend this video?", type: "boolean" },
];

export const reviews: Review[] = [
  {
    id: "r1",
    videoId: "v1",
    videoTitle: "3 Nigerian breakfasts under 15 minutes",
    videoThumbnail: null,
    youtubeUrl: "https://youtube.com/watch?v=abc123",
    submitterId: "1",
    submitterName: "Amaka O.",
    submitterHandle: "@amakacooks",
    reviewerId: "me",
    reviewerName: "Chinedu A.",
    reviewerHandle: "@chineducreates",
    status: "in_progress",
    score: null,
    feedbackText: null,
    questions: reviewQuestions,
    answers: [],
    assignedAt: "2026-08-10T08:00:00Z",
    startedAt: "2026-08-10T09:30:00Z",
    completedAt: null,
    dueAt: "2026-08-12T08:00:00Z",
  },
  {
    id: "r2",
    videoId: "v2",
    videoTitle: "Best budget mic for YouTube in Nigeria",
    videoThumbnail: null,
    youtubeUrl: "https://youtube.com/watch?v=def456",
    submitterId: "me",
    submitterName: "Chinedu A.",
    submitterHandle: "@chineducreates",
    reviewerId: "2",
    reviewerName: "Tunde B.",
    reviewerHandle: "@tundefitness",
    status: "completed",
    score: 4,
    feedbackText:
      "Great content overall. The mic recommendations were spot on and really useful for budget creators. The audio could be slightly better but overall solid.",
    questions: reviewQuestions,
    answers: [
      { questionId: "q1", questionText: "Video quality (1-5 stars)", answer: 4 },
      { questionId: "q2", questionText: "Audio clarity (1-5 stars)", answer: 3 },
      { questionId: "q3", questionText: "Content helpfulness (1-5 stars)", answer: 5 },
      { questionId: "q4", questionText: "Thumbnail appeal (1-5 stars)", answer: 4 },
      {
        questionId: "q5",
        questionText: "What did you like most?",
        answer: "The mic recommendations",
      },
      {
        questionId: "q6",
        questionText: "What could be improved?",
        answer: "Audio levels could be more consistent",
      },
      { questionId: "q7", questionText: "Would you recommend this video?", answer: true },
    ],
    assignedAt: "2026-08-08T10:00:00Z",
    startedAt: "2026-08-08T11:00:00Z",
    completedAt: "2026-08-09T14:30:00Z",
    dueAt: "2026-08-10T10:00:00Z",
  },
  {
    id: "r3",
    videoId: "v3",
    videoTitle: "How I edit a video on my phone only",
    videoThumbnail: null,
    youtubeUrl: "https://youtube.com/watch?v=ghi789",
    submitterId: "3",
    submitterName: "Zainab M.",
    submitterHandle: "@zaraskincare",
    reviewerId: "me",
    reviewerName: "Chinedu A.",
    reviewerHandle: "@chineducreates",
    status: "assigned",
    score: null,
    feedbackText: null,
    questions: reviewQuestions,
    answers: [],
    assignedAt: "2026-08-10T12:00:00Z",
    startedAt: null,
    completedAt: null,
    dueAt: "2026-08-12T12:00:00Z",
  },
  {
    id: "r4",
    videoId: "v4",
    videoTitle: "Ranking every FIFA skill move in 2026",
    videoThumbnail: null,
    youtubeUrl: "https://youtube.com/watch?v=jkl012",
    submitterId: "5",
    submitterName: "Bola K.",
    submitterHandle: "@bolatalks",
    reviewerId: "me",
    reviewerName: "Chinedu A.",
    reviewerHandle: "@chineducreates",
    status: "overdue",
    score: null,
    feedbackText: null,
    questions: reviewQuestions,
    answers: [],
    assignedAt: "2026-08-08T15:00:00Z",
    startedAt: null,
    completedAt: null,
    dueAt: "2026-08-10T15:00:00Z",
  },
];
