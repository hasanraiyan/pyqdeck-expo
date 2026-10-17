import { CommunityPost, CommunityComment } from '../types/community';

export const INITIAL_MOCK_POSTS: CommunityPost[] = [
  {
    id: 'post-1',
    slug: 'bankers-algorithm-operating-systems',
    author: {
      id: 'user-1',
      name: 'Aarav Sharma',
      headline: 'CSE 3rd Year • Operating Systems & Core CS',
      college: 'BEU Tech',
    },
    createdAt: '2h',
    body: `Can someone explain why **Banker's Algorithm** fails if the allocation state doesn't have a *safe sequence*?

Specifically confused about **Step 3** in #OperatingSystems. In my handwritten trace below, process $P_1$ requests $(1, 0, 2)$ but $\\text{Available} = (3, 3, 2)$. Why does the OS deny it even though:

$$\\text{Available} \\ge \\text{Request}$$

Attached my rough calculation sheet. Would appreciate any insights from seniors or peers who took the 2023 exam!

#OperatingSystems #Semester5 #ComputerScience #Deadlock`,
    hashtags: ['OperatingSystems', 'Semester5', 'ComputerScience', 'Deadlock'],
    attachments: [
      {
        id: 'att-1-1',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1000&q=80',
        name: 'bankers_algo_trace.jpg',
      },
    ],
    likesCount: 38,
    isLiked: false,
    commentsCount: 5,
    bookmarksCount: 12,
    isBookmarked: false,
    status: 'published',
  },
  {
    id: 'post-2',
    slug: 'cn-module-3-transport-layer-handwritten-notes',
    author: {
      id: 'user-2',
      name: 'Priya Patel',
      headline: 'ECE 6th Sem • Networking & Telecom • Top Contributor',
      college: 'GEC Patna',
    },
    createdAt: '4h',
    body: `Finished compiling my handwritten revision notes for **#ComputerNetworks Module 3** (*Transport Layer & TCP Congestion Control*).

Key areas summarized:
• **TCP 3-way handshake** vs UDP header structure
• Slow Start, Congestion Avoidance, Fast Retransmit (AIMD):
$$\\text{CWND} = \\text{CWND} + \\frac{1}{\\text{CWND}}$$
• Leaky Bucket vs Token Bucket with numerical walk-throughs

Attaching the full 6-page PDF. Clean diagrams, high-yield for university exams. Feel free to download or save!

#ComputerNetworks #Notes #Semester6 #ExamPrep`,
    hashtags: ['ComputerNetworks', 'Notes', 'Semester6', 'ExamPrep'],
    attachments: [
      {
        id: 'att-2-1',
        type: 'pdf',
        url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        name: 'CN_Module3_TCP_Congestion_Control.pdf',
        size: '1.8 MB',
        pageCount: 6,
        thumbnailUrl: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=800&q=80',
        previewPages: [
          'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1000&q=80',
        ],
      },
    ],
    likesCount: 94,
    isLiked: true,
    commentsCount: 6,
    bookmarksCount: 64,
    isBookmarked: true,
    status: 'published',
  },
  {
    id: 'post-3',
    slug: 'dbms-2022-b-plus-tree-splitting-pyq-solution',
    author: {
      id: 'user-3',
      name: 'Vikram Singh',
      headline: 'IT Final Year • Database Systems & Cloud',
      college: 'MIT Muzaffarpur',
    },
    createdAt: '7h',
    body: `Solved solution for **#DatabaseManagementSystems** 2022 Q2b (*B+ Tree insertion with splitting steps*).

Order $m = 4$, so maximum keys per node is $m - 1 = 3$:
$$\\text{Max Keys} = 3, \\quad \\text{Min Keys} = \\lceil m/2 \\rceil - 1 = 1$$

Make sure to write out each intermediate split step explicitly during your university exam. University evaluators allocate 4 marks solely for intermediate root overflow diagrams!

Attached 2 high-res photos of the complete step-by-step tree construction.

#DBMS #PYQSolutions #Semester5 #DataStructures`,
    hashtags: ['DBMS', 'PYQSolutions', 'Semester5', 'DataStructures'],
    attachments: [
      {
        id: 'att-3-1',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1000&q=80',
        name: 'b_plus_tree_solved_p1.jpg',
      },
      {
        id: 'att-3-2',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1000&q=80',
        name: 'b_plus_tree_solved_p2.jpg',
      },
      {
        id: 'att-3-3',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1000&q=80',
        name: 'b_plus_tree_solved_p3.jpg',
      },
    ],
    likesCount: 52,
    isLiked: false,
    commentsCount: 3,
    bookmarksCount: 31,
    isBookmarked: false,
    status: 'published',
  },
  {
    id: 'post-4',
    slug: 'compiler-design-slr1-lr0-parsing-exam-tips',
    author: {
      id: 'user-4',
      name: 'Sneha Roy',
      headline: 'CSE Senior • Compiler Design & Systems Programming',
      college: 'BCE Bhagalpur',
    },
    createdAt: '1d',
    body: `A quick strategy tip for students appearing in **#CompilerDesign**:

1. Always left-factor and eliminate left recursion *before* starting $\\text{FIRST}$ and $\\text{FOLLOW}$ calculations.
2. **SLR(1)** parsing tables have appeared for 14 marks in 2019, 2021, 2022, and 2023 papers without fail.
3. If a shift-reduce conflict arises in state $I_k$, explain *why* the grammar is ambiguous instead of panicking. Evaluators award partial marks for conflict identification.

Check 2021-2023 past questions on the app before test day. #ExamTips #CompilerDesign #Semester6`,
    hashtags: ['ExamTips', 'CompilerDesign', 'Semester6'],
    attachments: [],
    likesCount: 128,
    isLiked: false,
    commentsCount: 4,
    bookmarksCount: 95,
    isBookmarked: true,
    status: 'published',
  },
];

export const INITIAL_MOCK_COMMENTS: Record<string, CommunityComment[]> = {
  'post-1': [
    {
      id: 'c-1',
      postId: 'post-1',
      author: {
        id: 'user-commenter-1',
        name: 'Nikhil Kashyap',
        headline: 'CSE Sem 6 • Systems & OS',
      },
      body: `Look at step 2 in your trace: if you allocate $(1, 0, 2)$, the new Need vector for $P_1$ becomes:
$$\\text{Need}_{P_1} = (0, 2, 0)$$
but $\\text{Available}$ drops to $(2, 3, 0)$. None of the remaining processes can satisfy $\\text{Need} \\le \\text{Available}$, so no safe sequence exists! The OS avoids entering this unsafe state.`,
      createdAt: '1h ago',
      likesCount: 14,
      isLiked: true,
      replies: [
        {
          id: 'r-1-1',
          postId: 'post-1',
          parentId: 'c-1',
          replyToAuthorName: 'Nikhil Kashyap',
          author: {
            id: 'user-commenter-2',
            name: 'Ananya Sen',
            headline: 'CSE Sem 5 • Core CS',
          },
          body: `@Nikhil Exactly! And remember: **Unsafe state $\\ne$ Deadlock**, but *Unsafe state may lead to deadlock*. That is why Banker's algorithm is strictly conservative.`,
          createdAt: '45m ago',
          likesCount: 6,
          isLiked: false,
          replies: [
            {
              id: 'r-1-1-1',
              postId: 'post-1',
              parentId: 'c-1',
              replyToAuthorName: 'Ananya Sen',
              author: {
                id: 'user-1',
                name: 'Aarav Sharma',
                headline: 'Author • CSE 3rd Year',
              },
              body: '@Ananya @Nikhil Oh wow, that completely clicked for me now! I forgot to verify if the NEXT process in line would starve with the reduced vector. Thank you both!',
              createdAt: '20m ago',
              likesCount: 4,
              isLiked: false,
            },
          ],
        },
      ],
    },
    {
      id: 'c-2',
      postId: 'post-1',
      author: {
        id: 'user-c2',
        name: 'Rohan Mehra',
        headline: 'IT Sem 6 • Software Engineering',
      },
      body: 'Can this same logic apply to Resource Allocation Graphs (RAG) when multiple resource instances are present?',
      createdAt: '30m ago',
      likesCount: 3,
      isLiked: false,
      replies: [
        {
          id: 'r-2-1',
          postId: 'post-1',
          parentId: 'c-2',
          replyToAuthorName: 'Rohan Mehra',
          author: {
            id: 'user-3',
            name: 'Vikram Singh',
            headline: 'IT Final Year',
          },
          body: '@Rohan For single instances, a simple cycle in RAG is necessary and sufficient for deadlock. But for multiple instances, a cycle is only necessary, not sufficient—that\'s where Banker\'s matrix safety test comes in.',
          createdAt: '15m ago',
          likesCount: 5,
          isLiked: false,
        },
      ],
    },
  ],
  'post-2': [
    {
      id: 'c-201',
      postId: 'post-2',
      author: {
        id: 'user-c201',
        name: 'Aditi Verma',
        headline: 'ECE Sem 6 • Networks',
      },
      body: 'The Leaky Bucket vs Token Bucket diagram on page 4 is crystal clear! Our professor asked this exact comparison in last year\'s internals.',
      createdAt: '2h ago',
      likesCount: 8,
      isLiked: false,
      replies: [
        {
          id: 'r-201-1',
          postId: 'post-2',
          parentId: 'c-201',
          replyToAuthorName: 'Aditi Verma',
          author: {
            id: 'user-2',
            name: 'Priya Patel',
            headline: 'Author • ECE 6th Sem',
          },
          body: '@Aditi So glad it helped! Be sure to write the formula for Token Bucket burst capacity as well, evaluators give 2 extra marks for that.',
          createdAt: '1h ago',
          likesCount: 4,
          isLiked: false,
        },
      ],
    },
  ],
};

// In-memory store that components can subscribe to
class CommunityStore {
  private posts: CommunityPost[] = [...INITIAL_MOCK_POSTS];
  private comments: Record<string, CommunityComment[]> = { ...INITIAL_MOCK_COMMENTS };
  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  getPosts(): CommunityPost[] {
    return this.posts;
  }

  getPostById(idOrSlug: string): CommunityPost | undefined {
    return this.posts.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
  }

  getComments(postId: string): CommunityComment[] {
    return this.comments[postId] || [];
  }

  toggleLikePost(postId: string) {
    this.posts = this.posts.map((p) => {
      if (p.id !== postId) return p;
      const nextLiked = !p.isLiked;
      return {
        ...p,
        isLiked: nextLiked,
        likesCount: nextLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1),
      };
    });
    this.notify();
  }

  toggleBookmarkPost(postId: string) {
    this.posts = this.posts.map((p) => {
      if (p.id !== postId) return p;
      const nextBookmarked = !p.isBookmarked;
      return {
        ...p,
        isBookmarked: nextBookmarked,
        bookmarksCount: nextBookmarked ? p.bookmarksCount + 1 : Math.max(0, p.bookmarksCount - 1),
      };
    });
    this.notify();
  }

  dismissPost(postId: string) {
    this.posts = this.posts.filter((p) => p.id !== postId);
    this.notify();
  }

  addPost(newPostData: Omit<CommunityPost, 'id' | 'slug' | 'createdAt' | 'likesCount' | 'isLiked' | 'commentsCount' | 'bookmarksCount' | 'isBookmarked'>): CommunityPost {
    const id = `post-${Date.now()}`;
    const slug = newPostData.body
      .slice(0, 30)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `post-${Date.now()}`;

    const newPost: CommunityPost = {
      ...newPostData,
      id,
      slug,
      createdAt: 'Just now',
      likesCount: 0,
      isLiked: false,
      commentsCount: 0,
      bookmarksCount: 0,
      isBookmarked: false,
      status: 'published',
      isOwnPost: true,
    };

    this.posts = [newPost, ...this.posts];
    this.comments[id] = [];
    this.notify();
    return newPost;
  }

  // Supports nested replies: "comment pe comment"
  addComment(
    postId: string,
    text: string,
    parentCommentId?: string,
    replyToAuthorName?: string,
    authorName = 'You',
    authorHeadline = 'Student • PYQDeck Community'
  ): CommunityComment {
    const newComment: CommunityComment = {
      id: `c-${Date.now()}`,
      postId,
      parentId: parentCommentId,
      replyToAuthorName,
      author: {
        id: 'current-user',
        name: authorName,
        headline: authorHeadline,
      },
      body: text,
      createdAt: 'Just now',
      likesCount: 0,
      isLiked: false,
      replies: [],
    };

    const existing = this.comments[postId] || [];

    if (!parentCommentId) {
      // Top-level comment
      this.comments[postId] = [...existing, newComment];
    } else {
      // Helper to recursively find and append reply
      const appendReply = (list: CommunityComment[]): CommunityComment[] => {
        return list.map((item) => {
          if (item.id === parentCommentId) {
            return {
              ...item,
              replies: [...(item.replies || []), newComment],
            };
          }
          if (item.replies && item.replies.length > 0) {
            return {
              ...item,
              replies: appendReply(item.replies),
            };
          }
          return item;
        });
      };

      this.comments[postId] = appendReply(existing);
    }

    // Update post comments count
    this.posts = this.posts.map((p) => {
      if (p.id === postId) {
        return { ...p, commentsCount: p.commentsCount + 1 };
      }
      return p;
    });

    this.notify();
    return newComment;
  }

  toggleLikeComment(postId: string, commentId: string) {
    const postComments = this.comments[postId];
    if (!postComments) return;

    const toggleInList = (list: CommunityComment[]): CommunityComment[] => {
      return list.map((c) => {
        if (c.id === commentId) {
          const nextLiked = !c.isLiked;
          return {
            ...c,
            isLiked: nextLiked,
            likesCount: nextLiked ? c.likesCount + 1 : Math.max(0, c.likesCount - 1),
          };
        }
        if (c.replies && c.replies.length > 0) {
          return {
            ...c,
            replies: toggleInList(c.replies),
          };
        }
        return c;
      });
    };

    this.comments[postId] = toggleInList(postComments);
    this.notify();
  }
}

export const communityStore = new CommunityStore();
