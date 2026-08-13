export type Mission = {
  id: string;
  title: string;
  description: string;
  reward: { xp: number; credits: number };
  category: "watch" | "subscribe" | "comment" | "submit" | "review" | "social";
  difficulty: "easy" | "medium" | "hard";
  estimatedTimeMins: number;
  icon: string;
};

export type MissionAssignment = {
  id: string;
  missionId: string;
  title: string;
  description: string;
  reward: { xp: number; credits: number };
  category: string;
  difficulty: "easy" | "medium" | "hard";
  status: "assigned" | "in_progress" | "completed" | "expired" | "skipped";
  progress: number;
  total: number;
  assignedAt: string;
  dueAt: string;
  claimed: boolean;
};

export const missions: Mission[] = [
  {
    id: "m1",
    title: "Watch 3 squad videos",
    description: "Watch three videos from your queue with verified watch time.",
    reward: { xp: 50, credits: 0 },
    category: "watch",
    difficulty: "easy",
    estimatedTimeMins: 9,
    icon: "Eye",
  },
  {
    id: "m2",
    title: "Subscribe to 2 new channels",
    description: "Subscribe to at least two creator channels in your queue.",
    reward: { xp: 30, credits: 0 },
    category: "subscribe",
    difficulty: "easy",
    estimatedTimeMins: 2,
    icon: "UserPlus",
  },
  {
    id: "m3",
    title: "Leave 3 genuine comments",
    description: "Comment on three different squad videos with meaningful feedback.",
    reward: { xp: 40, credits: 0 },
    category: "comment",
    difficulty: "medium",
    estimatedTimeMins: 6,
    icon: "MessageCircle",
  },
  {
    id: "m4",
    title: "Submit your video",
    description: "Add a new YouTube video to the squad rotation queue.",
    reward: { xp: 50, credits: 0 },
    category: "submit",
    difficulty: "easy",
    estimatedTimeMins: 1,
    icon: "Upload",
  },
  {
    id: "m5",
    title: "Complete a review",
    description: "Provide thoughtful feedback on a peer's queued video.",
    reward: { xp: 60, credits: 10 },
    category: "review",
    difficulty: "medium",
    estimatedTimeMins: 10,
    icon: "Star",
  },
  {
    id: "m6",
    title: "Keep your streak alive",
    description: "Participate in the squad today by watching at least one video.",
    reward: { xp: 25, credits: 0 },
    category: "watch",
    difficulty: "easy",
    estimatedTimeMins: 3,
    icon: "Flame",
  },
  {
    id: "m7",
    title: "Reach 100% trust score",
    description: "Achieve a trust score of 100% with no flags in the last 30 days.",
    reward: { xp: 200, credits: 50 },
    category: "social",
    difficulty: "hard",
    estimatedTimeMins: 0,
    icon: "ShieldCheck",
  },
  {
    id: "m8",
    title: "Help 3 members reach targets",
    description: "Watch videos from three different members so they can claim rewards.",
    reward: { xp: 100, credits: 25 },
    category: "watch",
    difficulty: "hard",
    estimatedTimeMins: 15,
    icon: "HeartHandshake",
  },
];

export const missionAssignments: MissionAssignment[] = [
  {
    id: "a1",
    missionId: "m1",
    title: "Watch 3 squad videos",
    description: "Watch three videos from your queue with verified watch time.",
    reward: { xp: 50, credits: 0 },
    category: "watch",
    difficulty: "easy",
    status: "in_progress",
    progress: 2,
    total: 3,
    assignedAt: "2026-08-11T00:00:00Z",
    dueAt: "2026-08-12T00:00:00Z",
    claimed: false,
  },
  {
    id: "a2",
    missionId: "m2",
    title: "Subscribe to 2 new channels",
    description: "Subscribe to at least two creator channels in your queue.",
    reward: { xp: 30, credits: 0 },
    category: "subscribe",
    difficulty: "easy",
    status: "completed",
    progress: 2,
    total: 2,
    assignedAt: "2026-08-11T00:00:00Z",
    dueAt: "2026-08-12T00:00:00Z",
    claimed: true,
  },
  {
    id: "a3",
    missionId: "m3",
    title: "Leave 3 genuine comments",
    description: "Comment on three different squad videos with meaningful feedback.",
    reward: { xp: 40, credits: 0 },
    category: "comment",
    difficulty: "medium",
    status: "assigned",
    progress: 1,
    total: 3,
    assignedAt: "2026-08-11T00:00:00Z",
    dueAt: "2026-08-12T00:00:00Z",
    claimed: false,
  },
  {
    id: "a4",
    missionId: "m6",
    title: "Keep your streak alive",
    description: "Participate in the squad today by watching at least one video.",
    reward: { xp: 25, credits: 0 },
    category: "watch",
    difficulty: "easy",
    status: "completed",
    progress: 1,
    total: 1,
    assignedAt: "2026-08-11T00:00:00Z",
    dueAt: "2026-08-12T00:00:00Z",
    claimed: true,
  },
  {
    id: "a5",
    missionId: "m5",
    title: "Complete a review",
    description: "Provide thoughtful feedback on a peer's queued video.",
    reward: { xp: 60, credits: 10 },
    category: "review",
    difficulty: "medium",
    status: "assigned",
    progress: 0,
    total: 1,
    assignedAt: "2026-08-11T00:00:00Z",
    dueAt: "2026-08-12T00:00:00Z",
    claimed: false,
  },
  {
    id: "a6",
    missionId: "m8",
    title: "Help 3 members reach targets",
    description: "Watch videos from three different members so they can claim rewards.",
    reward: { xp: 100, credits: 25 },
    category: "watch",
    difficulty: "hard",
    status: "expired",
    progress: 1,
    total: 3,
    assignedAt: "2026-08-10T00:00:00Z",
    dueAt: "2026-08-11T00:00:00Z",
    claimed: false,
  },
];
