import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommunityAuthor, CommunityPost } from '../types/community';
import { communityStore } from '../data/mockCommunity';

export interface UserProfileData {
  id: string;
  name: string;
  avatarUrl?: string;
  coverUrl?: string;
  bio: string;
  about?: string;
  college: string;
  university: string;
  branch: string;
  semester: string;
  gradYear?: string;
  location?: string;
  github?: string;
  linkedin?: string;
  website?: string;
  twitter?: string;
  skills: string[];
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
  contributionsCount: number;
  upvotesCount: number;
}

const OWN_PROFILE_STORAGE_KEY = '@pyqdeck_own_profile_v1';
const FOLLOWED_USERS_KEY = '@pyqdeck_followed_users_v1';

const DEFAULT_MOCK_PROFILES: Record<string, UserProfileData> = {
  'user-1': {
    id: 'user-1',
    name: 'Aarav Sharma',
    avatarUrl: undefined,
    coverUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80',
    bio: 'CSE 3rd Year • Operating Systems & Core CS • GATE \'25 Aspirant',
    about: 'Passionate about operating system kernels, concurrency, and algorithms. Currently deep-diving into Banker\'s Algorithm and Linux paging subsystems. Actively solving and sharing PYQs for BEU semester exams.',
    college: 'BEU Tech Campus',
    university: 'Bihar Engineering University, Patna',
    branch: 'Computer Science & Engineering',
    semester: '6th Semester',
    gradYear: '2026',
    location: 'Patna, Bihar',
    github: 'aaravsharma-beu',
    linkedin: 'aarav-sharma-cs',
    skills: ['Operating Systems', 'C/C++', 'Algorithms', 'Data Structures', 'Linux Kernel'],
    followersCount: 142,
    followingCount: 38,
    isFollowing: false,
    contributionsCount: 12,
    upvotesCount: 384,
  },
  'user-2': {
    id: 'user-2',
    name: 'Priya Patel',
    avatarUrl: undefined,
    coverUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    bio: 'ECE 6th Sem • Networking & Telecom • Top Contributor',
    about: 'Electronics & Communication enthusiast with a focus on high-speed telecommunications and TCP congestion protocols. Creator of comprehensive handwritten notes for Module 3 & 4 past papers.',
    college: 'Government Engineering College (GEC) Patna',
    university: 'Bihar Engineering University, Patna',
    branch: 'Electronics & Communication Engineering',
    semester: '6th Semester',
    gradYear: '2026',
    location: 'Patna, Bihar',
    github: 'priyapatel-ece',
    linkedin: 'priya-patel-telecom',
    skills: ['Computer Networks', 'Digital Communication', 'Signal Processing', 'Microprocessors'],
    followersCount: 289,
    followingCount: 64,
    isFollowing: false,
    contributionsCount: 26,
    upvotesCount: 890,
  },
  'user-3': {
    id: 'user-3',
    name: 'Vikram Singh',
    avatarUrl: undefined,
    coverUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
    bio: 'IT Final Year • Database Systems & Cloud',
    about: 'Final year Information Technology student specializing in relational database query optimization and B+ Tree indexing. Mentoring juniors through exam walk-throughs and syllabus breakdowns.',
    college: 'Muzaffarpur Institute of Technology (MIT)',
    university: 'Bihar Engineering University, Patna',
    branch: 'Information Technology',
    semester: '8th Semester',
    gradYear: '2025',
    location: 'Muzaffarpur, Bihar',
    github: 'vikramsingh-db',
    linkedin: 'vikram-singh-mit',
    skills: ['DBMS', 'SQL Optimization', 'Cloud Computing', 'Distributed Systems'],
    followersCount: 198,
    followingCount: 51,
    isFollowing: false,
    contributionsCount: 18,
    upvotesCount: 520,
  },
  'user-4': {
    id: 'user-4',
    name: 'Sneha Roy',
    avatarUrl: undefined,
    coverUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    bio: 'CSE Senior • Compiler Design & Systems Programming',
    about: 'Focused on formal grammar theory, SLR(1)/LR(0) parsing pipelines, and compiler front-ends. Frequent contributor of verified solutions and exam strategy guides.',
    college: 'Bhagalpur College of Engineering (BCE)',
    university: 'Bihar Engineering University, Patna',
    branch: 'Computer Science & Engineering',
    semester: '7th Semester',
    gradYear: '2025',
    location: 'Bhagalpur, Bihar',
    github: 'sneharoy-compiler',
    linkedin: 'sneha-roy-bce',
    skills: ['Compiler Design', 'Formal Languages', 'C Programming', 'System Architecture'],
    followersCount: 310,
    followingCount: 72,
    isFollowing: false,
    contributionsCount: 31,
    upvotesCount: 975,
  },
};

const DEFAULT_OWN_PROFILE: UserProfileData = {
  id: 'me',
  name: 'You (Student)',
  avatarUrl: undefined,
  coverUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
  bio: 'Engineering Student • Bihar Engineering University • PYQDeck Community',
  about: 'Engineering student preparing for BEU semester exams with previous year question papers, notes, and peer discussions on PYQDeck.',
  college: 'Bihar Engineering University Campus',
  university: 'Bihar Engineering University, Patna',
  branch: 'Computer Science & Engineering',
  semester: '6th Semester',
  gradYear: '2026',
  location: 'Bihar, India',
  github: '',
  linkedin: '',
  website: '',
  twitter: '',
  skills: ['Semester Prep', 'Core Engineering', 'PYQ Revision'],
  followersCount: 19,
  followingCount: 42,
  isFollowing: false,
  contributionsCount: 4,
  upvotesCount: 88,
};

class UserProfileService {
  private followedUsersCache: Set<string> | null = null;

  private async getFollowedSet(): Promise<Set<string>> {
    if (this.followedUsersCache) {
      return this.followedUsersCache;
    }
    try {
      const raw = await AsyncStorage.getItem(FOLLOWED_USERS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        this.followedUsersCache = new Set(arr);
        return this.followedUsersCache;
      }
    } catch {}
    this.followedUsersCache = new Set();
    return this.followedUsersCache;
  }

  private async saveFollowedSet(set: Set<string>): Promise<void> {
    this.followedUsersCache = set;
    try {
      await AsyncStorage.setItem(FOLLOWED_USERS_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  }

  async getProfile(
    userId: string,
    authorHint?: CommunityAuthor,
    clerkUser?: any
  ): Promise<UserProfileData> {
    const isOwn = userId === 'me' || (clerkUser?.id && userId === clerkUser.id);
    const followedSet = await this.getFollowedSet();

    if (isOwn) {
      let localData: Partial<UserProfileData> = {};
      try {
        const raw = await AsyncStorage.getItem(OWN_PROFILE_STORAGE_KEY);
        if (raw) {
          localData = JSON.parse(raw);
        }
      } catch {}

      const name =
        localData.name ||
        clerkUser?.fullName ||
        clerkUser?.firstName ||
        DEFAULT_OWN_PROFILE.name;
      const avatarUrl =
        localData.avatarUrl || clerkUser?.imageUrl || undefined;

      const profile: UserProfileData = {
        ...DEFAULT_OWN_PROFILE,
        ...localData,
        id: clerkUser?.id || 'me',
        name,
        avatarUrl,
        isFollowing: false,
      };

      // Calculate dynamic user posts count from community store
      const ownPosts = communityStore.getPosts().filter((p) => p.author.id === 'me' || p.author.id === profile.id);
      if (ownPosts.length > 0) {
        profile.contributionsCount = Math.max(profile.contributionsCount, ownPosts.length);
      }

      return profile;
    }

    // Other user: check predefined mock profiles
    const base = DEFAULT_MOCK_PROFILES[userId];
    const isFollowing = followedSet.has(userId);

    if (base) {
      const userPosts = communityStore.getPosts().filter((p) => p.author.id === userId);
      const postsCount = userPosts.length;
      const totalLikes = userPosts.reduce((acc, p) => acc + (p.likesCount || 0), 0);

      return {
        ...base,
        isFollowing,
        followersCount: base.followersCount + (isFollowing ? 1 : 0),
        upvotesCount: Math.max(base.upvotesCount, totalLikes),
        contributionsCount: Math.max(base.contributionsCount, postsCount),
      };
    }

    // Dynamic author fallback if unknown user ID
    const name = authorHint?.name || 'Student';
    const bio = authorHint?.bio || 'Student • PYQDeck Community';
    const college = authorHint?.college || 'Bihar Engineering University';

    return {
      id: userId,
      name,
      avatarUrl: authorHint?.avatarUrl,
      coverUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80',
      bio,
      about: `${name} is an active student contributor on PYQDeck sharing notes and discussions.`,
      college,
      university: 'Bihar Engineering University, Patna',
      branch: 'Engineering',
      semester: 'B.Tech',
      location: 'Bihar, India',
      skills: ['Engineering', 'PYQ Solutions'],
      followersCount: 15 + (isFollowing ? 1 : 0),
      followingCount: 12,
      isFollowing,
      contributionsCount: communityStore.getPosts().filter((p) => p.author.id === userId).length,
      upvotesCount: 45,
    };
  }

  async updateOwnProfile(updates: Partial<UserProfileData>): Promise<UserProfileData> {
    try {
      const raw = await AsyncStorage.getItem(OWN_PROFILE_STORAGE_KEY);
      const existing = raw ? JSON.parse(raw) : {};
      const merged = { ...DEFAULT_OWN_PROFILE, ...existing, ...updates };
      await AsyncStorage.setItem(OWN_PROFILE_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    } catch {
      return { ...DEFAULT_OWN_PROFILE, ...updates };
    }
  }

  async toggleFollowUser(userId: string): Promise<boolean> {
    const set = await this.getFollowedSet();
    const currentlyFollowing = set.has(userId);
    if (currentlyFollowing) {
      set.delete(userId);
    } else {
      set.add(userId);
    }
    await this.saveFollowedSet(set);
    return !currentlyFollowing;
  }
}

export const userProfileService = new UserProfileService();
