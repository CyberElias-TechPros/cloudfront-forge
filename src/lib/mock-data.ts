export type Member = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  points: number;
  streak: number;
  level: number;
  rank: number;
  niche: string;
  subsGiven: number;
  subsReceived: number;
  watchMinutes: number;
  trustScore: number;
};

export type Task = {
  id: string;
  owner: string;
  handle: string;
  avatar: string;
  title: string;
  niche: string;
  durationSec: number;
  requiredSec: number;
  reward: number;
  status: "pending" | "watching" | "verified" | "expired";
  postedAgo: string;
  thumbHue: number;
};

export type Submission = {
  id: string;
  title: string;
  postedAgo: string;
  watchers: number;
  target: number;
  subs: number;
  comments: number;
  status: "active" | "completed" | "queued";
};

export const currentUser: Member = {
  id: "me",
  name: "Chinedu A.",
  handle: "@chineducreates",
  avatar: "CA",
  points: 1840,
  streak: 6,
  level: 7,
  rank: 4,
  niche: "Tech reviews",
  subsGiven: 62,
  subsReceived: 58,
  watchMinutes: 412,
  trustScore: 94,
};

export const members: Member[] = [
  {
    id: "1",
    name: "Amaka O.",
    handle: "@amakacooks",
    avatar: "AO",
    points: 3120,
    streak: 21,
    level: 12,
    rank: 1,
    niche: "Food",
    subsGiven: 128,
    subsReceived: 131,
    watchMinutes: 890,
    trustScore: 99,
  },
  {
    id: "2",
    name: "Tunde B.",
    handle: "@tundefitness",
    avatar: "TB",
    points: 2740,
    streak: 15,
    level: 10,
    rank: 2,
    niche: "Fitness",
    subsGiven: 110,
    subsReceived: 104,
    watchMinutes: 765,
    trustScore: 97,
  },
  {
    id: "3",
    name: "Zainab M.",
    handle: "@zaraskincare",
    avatar: "ZM",
    points: 2210,
    streak: 9,
    level: 9,
    rank: 3,
    niche: "Beauty",
    subsGiven: 96,
    subsReceived: 92,
    watchMinutes: 640,
    trustScore: 96,
  },
  { ...currentUser, id: "4" },
  {
    id: "5",
    name: "Bola K.",
    handle: "@bolatalks",
    avatar: "BK",
    points: 1610,
    streak: 4,
    level: 6,
    rank: 5,
    niche: "Podcast",
    subsGiven: 54,
    subsReceived: 61,
    watchMinutes: 388,
    trustScore: 88,
  },
  {
    id: "6",
    name: "Ifeanyi D.",
    handle: "@ifygaming",
    avatar: "ID",
    points: 1290,
    streak: 2,
    level: 5,
    rank: 6,
    niche: "Gaming",
    subsGiven: 41,
    subsReceived: 47,
    watchMinutes: 300,
    trustScore: 81,
  },
  {
    id: "7",
    name: "Grace N.",
    handle: "@gracesings",
    avatar: "GN",
    points: 980,
    streak: 1,
    level: 4,
    rank: 7,
    niche: "Music",
    subsGiven: 33,
    subsReceived: 30,
    watchMinutes: 210,
    trustScore: 76,
  },
  {
    id: "8",
    name: "Segun P.",
    handle: "@segunbuilds",
    avatar: "SP",
    points: 720,
    streak: 0,
    level: 3,
    rank: 8,
    niche: "DIY",
    subsGiven: 21,
    subsReceived: 25,
    watchMinutes: 150,
    trustScore: 69,
  },
];

export const tasks: Task[] = [
  {
    id: "t1",
    owner: "Amaka O.",
    handle: "@amakacooks",
    avatar: "AO",
    title: "3 Nigerian breakfasts under 15 minutes",
    niche: "Food",
    durationSec: 486,
    requiredSec: 180,
    reward: 30,
    status: "pending",
    postedAgo: "12m ago",
    thumbHue: 25,
  },
  {
    id: "t2",
    owner: "Tunde B.",
    handle: "@tundefitness",
    avatar: "TB",
    title: "No-gym home workout — week 1 of 12",
    niche: "Fitness",
    durationSec: 720,
    requiredSec: 180,
    reward: 30,
    status: "watching",
    postedAgo: "38m ago",
    thumbHue: 155,
  },
  {
    id: "t3",
    owner: "Zainab M.",
    handle: "@zaraskincare",
    avatar: "ZM",
    title: "My honest 30-day retinol results",
    niche: "Beauty",
    durationSec: 402,
    requiredSec: 180,
    reward: 30,
    status: "pending",
    postedAgo: "1h ago",
    thumbHue: 330,
  },
  {
    id: "t4",
    owner: "Bola K.",
    handle: "@bolatalks",
    avatar: "BK",
    title: "Why your first 100 subscribers are the hardest",
    niche: "Podcast",
    durationSec: 1260,
    requiredSec: 240,
    reward: 40,
    status: "verified",
    postedAgo: "3h ago",
    thumbHue: 260,
  },
  {
    id: "t5",
    owner: "Ifeanyi D.",
    handle: "@ifygaming",
    avatar: "ID",
    title: "Ranking every FIFA skill move in 2026",
    niche: "Gaming",
    durationSec: 640,
    requiredSec: 180,
    reward: 30,
    status: "pending",
    postedAgo: "4h ago",
    thumbHue: 85,
  },
  {
    id: "t6",
    owner: "Grace N.",
    handle: "@gracesings",
    avatar: "GN",
    title: "Worship medley (live, one take)",
    niche: "Music",
    durationSec: 540,
    requiredSec: 180,
    reward: 30,
    status: "expired",
    postedAgo: "yesterday",
    thumbHue: 200,
  },
];

export const submissions: Submission[] = [
  {
    id: "s1",
    title: "Tecno Camon 40 — 3 weeks later, honest review",
    postedAgo: "2h ago",
    watchers: 14,
    target: 20,
    subs: 11,
    comments: 9,
    status: "active",
  },
  {
    id: "s2",
    title: "Best budget mic for YouTube in Nigeria",
    postedAgo: "3d ago",
    watchers: 20,
    target: 20,
    subs: 18,
    comments: 15,
    status: "completed",
  },
  {
    id: "s3",
    title: "How I edit a video on my phone only",
    postedAgo: "queued",
    watchers: 0,
    target: 20,
    subs: 0,
    comments: 0,
    status: "queued",
  },
];

export const badges = [
  { name: "Day One", desc: "Joined the founding cohort", earned: true, icon: "Flag" },
  { name: "Fair Player", desc: "Give more than you take for 30 days", earned: true, icon: "Scale" },
  { name: "Watch Hound", desc: "Complete 100 verified watches", earned: true, icon: "Eye" },
  { name: "Streak Keeper", desc: "7-day participation streak", earned: false, icon: "Flame" },
  { name: "Comment King", desc: "Leave 50 genuine comments", earned: false, icon: "MessageCircle" },
  { name: "Century Club", desc: "Help a member reach 100 subs", earned: false, icon: "Trophy" },
];

export const activity = [
  { who: "Amaka O.", what: "verified a full watch on your review", when: "8m ago", points: "+30" },
  { who: "Tunde B.", what: "subscribed to your channel", when: "26m ago", points: "+15" },
  { who: "You", what: "completed the daily watch quest", when: "1h ago", points: "+50" },
  { who: "Segun P.", what: "was flagged for a 12-second watch", when: "2h ago", points: "-40" },
  { who: "Zainab M.", what: "left a genuine comment on your video", when: "3h ago", points: "+20" },
];
