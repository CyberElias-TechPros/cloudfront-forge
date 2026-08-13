export type CommunityMember = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  role: "owner" | "admin" | "member";
  points: number;
  joinedAt: string;
  trustScore: number;
};

export type Community = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  memberCount: number;
  maxMembers: number;
  isPublic: boolean;
  isOwner: boolean;
  ownerId: string;
  ownerName: string;
  inviteCode: string;
  niche: string;
  thumbHue: number;
  createdAt: string;
  updatedAt: string;
};

export const communities: Community[] = [
  {
    id: "c1",
    name: "Naija Creators",
    description: "Nigerian YouTube creators supporting each other's growth.",
    slug: "naija-creators",
    memberCount: 24,
    maxMembers: 50,
    isPublic: true,
    isOwner: true,
    ownerId: "me",
    ownerName: "Chinedu A.",
    inviteCode: "NAIJA2026",
    niche: "Tech reviews",
    thumbHue: 220,
    createdAt: "2024-03-01",
    updatedAt: "2024-08-10",
  },
  {
    id: "c2",
    name: "Lagos Foodies",
    description: "Food creators in Lagos sharing recipes and tips.",
    slug: "lagos-foodies",
    memberCount: 18,
    maxMembers: 50,
    isPublic: true,
    isOwner: false,
    ownerId: "1",
    ownerName: "Amaka O.",
    inviteCode: "FOOD2026",
    niche: "Food",
    thumbHue: 25,
    createdAt: "2024-02-15",
    updatedAt: "2024-08-09",
  },
  {
    id: "c3",
    name: "Fitness Circle",
    description: "Fitness coaches and enthusiasts trading subscribers fairly.",
    slug: "fitness-circle",
    memberCount: 12,
    maxMembers: 30,
    isPublic: false,
    isOwner: false,
    ownerId: "2",
    ownerName: "Tunde B.",
    inviteCode: "FIT2026",
    niche: "Fitness",
    thumbHue: 155,
    createdAt: "2024-04-10",
    updatedAt: "2024-08-08",
  },
];

export const communityMembers: Record<string, CommunityMember[]> = {
  c1: [
    {
      id: "me",
      name: "Chinedu A.",
      handle: "@chineducreates",
      avatar: "CA",
      role: "owner",
      points: 1840,
      joinedAt: "2024-03-01",
      trustScore: 94,
    },
    {
      id: "1",
      name: "Amaka O.",
      handle: "@amakacooks",
      avatar: "AO",
      role: "admin",
      points: 3120,
      joinedAt: "2024-03-05",
      trustScore: 99,
    },
    {
      id: "2",
      name: "Tunde B.",
      handle: "@tundefitness",
      avatar: "TB",
      role: "member",
      points: 2740,
      joinedAt: "2024-03-10",
      trustScore: 97,
    },
    {
      id: "3",
      name: "Zainab M.",
      handle: "@zaraskincare",
      avatar: "ZM",
      role: "member",
      points: 2210,
      joinedAt: "2024-03-12",
      trustScore: 96,
    },
  ],
  c2: [
    {
      id: "1",
      name: "Amaka O.",
      handle: "@amakacooks",
      avatar: "AO",
      role: "owner",
      points: 3120,
      joinedAt: "2024-02-15",
      trustScore: 99,
    },
    {
      id: "me",
      name: "Chinedu A.",
      handle: "@chineducreates",
      avatar: "CA",
      role: "member",
      points: 1840,
      joinedAt: "2024-02-20",
      trustScore: 94,
    },
  ],
};
