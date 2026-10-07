import React from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { NativeContentRenderer } from '../components/NativeContentRenderer';
import { FaqAccordion } from '../components/FaqAccordion';
import { extractFaqsFromNotes } from '../utils/faqParser';
import { COLORS, FONTS } from '../theme/colors';

const SAMPLE_NOTES_WITH_MERMAID = `# Comprehensive Mermaid Diagram Showcase

This sample page demonstrates all major diagram types supported by Mermaid running completely offline inside PyQdeck. Tap any diagram to open the interactive pinch-to-zoom viewer.

> [!NOTE]
> All diagram types compile and render offline using bundled Mermaid.js with zero network requests.

> [!TIP] Interactive Gesture Navigation
> Tap any diagram to launch the dedicated viewer. Use two fingers to pinch-to-zoom up to 5x or pan smoothly across large graphs.

> [!WARNING]
> Common exam trap: Do not confuse Interface inheritance with Class extension!

> [!EXAM] High Yield Topic
> Expect a 5-mark question comparing synchronous RPC and asynchronous event streams in distributed architectures.

---

## 1. Flowchart (flowchart TD & LR)

Flowcharts visualize algorithmic branching, decision trees, and system architectures.

\`\`\`mermaid
flowchart TD
    Start([Start]) --> Input[/"Input array A of size N"/]
    Input --> Init["i = 0, max = A[0]"]
    Init --> LoopCheck{"i < N ?"}
    LoopCheck -- Yes --> ValCheck{"A[i] > max ?"}
    ValCheck -- Yes --> UpdateMax["max = A[i]"]
    ValCheck -- No --> Next["i = i + 1"]
    UpdateMax --> Next
    Next --> LoopCheck
    LoopCheck -- No --> Output[/"Return max"/]
    Output --> End([End])
\`\`\`

### 1.1 Multi-Language Code Block (Auto-Tabbed by Language)

When consecutive code blocks with different languages appear in notes, they are automatically grouped into an interactive segmented tab bar:

\`\`\`java
// Java Implementation
public class MaxFinder {
    public static int findMax(int[] arr) {
        int max = arr[0];
        for (int i = 1; i < arr.length; i++) {
            if (arr[i] > max) max = arr[i];
        }
        return max;
    }
}
\`\`\`
\`\`\`python
# Python Implementation
def find_max(arr: list[int]) -> int:
    max_val = arr[0]
    for x in arr[1:]:
        if x > max_val:
            max_val = x
    return max_val
\`\`\`
\`\`\`cpp
// C++ Implementation
int findMax(const vector<int>& arr) {
    int maxVal = arr[0];
    for (size_t i = 1; i < arr.size(); ++i) {
        if (arr[i] > maxVal) maxVal = arr[i];
    }
    return maxVal;
}
\`\`\`
\`\`\`typescript
// TypeScript Implementation
function findMax(arr: number[]): number {
    return Math.max(...arr);
}
\`\`\`

### 1.2 Multi-Approach Code Block (Grouped by Headings)

Different algorithmic solutions under \`### Approach\` headings are automatically unified into interactive tabs with copy buttons and haptic feedback:

### Approach 1: Iterative (O(N) Time, O(1) Space)
\`\`\`python
def climb_stairs_iterative(n: int) -> int:
    if n <= 2:
        return n
    prev2, prev1 = 1, 2
    for _ in range(3, n + 1):
        prev2, prev1 = prev1, prev2 + prev1
    return prev1
\`\`\`

### Approach 2: Recursive with Memoization (O(N) Time, O(N) Space)
\`\`\`python
def climb_stairs_memo(n: int, memo: dict = None) -> int:
    if memo is None:
        memo = {}
    if n in memo:
        return memo[n]
    if n <= 2:
        return n
    memo[n] = climb_stairs_memo(n - 1, memo) + climb_stairs_memo(n - 2, memo)
    return memo[n]
\`\`\`

### Approach 3: Matrix Exponentiation (O(log N) Time)
\`\`\`python
# O(log N) state-transition matrix [[1, 1], [1, 0]]^(n-1)
import numpy as np

def climb_stairs_matrix(n: int) -> int:
    if n <= 2:
        return n
    F = np.matrix([[1, 1], [1, 0]], dtype=object)
    result = np.linalg.matrix_power(F, n)
    return int(result[0, 1])
\`\`\`

---

## 2. Smart Image Galleries & Lightbox

PyQdeck automatically groups consecutive Markdown images into responsive native grids with pinch-to-zoom (up to 5x), two-finger pan, and swipeable image viewers.

### 2.1 Single Figure Card (With Caption & Tap-to-Zoom)
![Demo Figure hosted on Cloudinary](https://res.cloudinary.com/djkpavwmp/image/upload/v1791340887/jc9p5keppvpm0aqowkod.png)

### 2.2 Dual Comparison (50/50 Side-by-Side)
![Demo Figure A](https://res.cloudinary.com/djkpavwmp/image/upload/v1791340887/jc9p5keppvpm0aqowkod.png)
![Demo Figure B](https://res.cloudinary.com/djkpavwmp/image/upload/v1791340887/jc9p5keppvpm0aqowkod.png)

### 2.3 Multi-Image Hero Grid with +N Overflow (6 Images)
When 5 or more images appear consecutively, PyQdeck renders the Hero + 3-Slot Column with an automatic overflow badge (+N):

![Demo Figure 1](https://res.cloudinary.com/djkpavwmp/image/upload/v1791340887/jc9p5keppvpm0aqowkod.png)
![Demo Figure 2](https://res.cloudinary.com/djkpavwmp/image/upload/v1791340887/jc9p5keppvpm0aqowkod.png)
![Demo Figure 3](https://res.cloudinary.com/djkpavwmp/image/upload/v1791340887/jc9p5keppvpm0aqowkod.png)
![Demo Figure 4](https://res.cloudinary.com/djkpavwmp/image/upload/v1791340887/jc9p5keppvpm0aqowkod.png)
![Demo Figure 5](https://res.cloudinary.com/djkpavwmp/image/upload/v1791340887/jc9p5keppvpm0aqowkod.png)
![Demo Figure 6](https://res.cloudinary.com/djkpavwmp/image/upload/v1791340887/jc9p5keppvpm0aqowkod.png)

### 2.4 Recommended Video Lectures (Interactive YouTube Embed)
YouTube videos inserted as markdown links, embed tags \`@[youtube](...)\`, or raw URLs automatically become native interactive video cards with inline playback, poster thumbnails, timestamp seeking, and app deep linking:

[Recommended Lecture: Computer Architecture & Pipelining](https://www.youtube.com/watch?v=tQHAwV9B8hQ&t=385s)

@[youtube](https://www.youtube.com/watch?v=tQHAwV9B8hQ&t=385s)

---

### 2.5 Algorithmic Step-by-Step Stepper / Timeline
Complex sequential algorithms, protocol handshakes, and compilation phases are rendered as interactive connected vertical timelines with numbered badge nodes:

:::step 1: Lexical Analysis (Scanning)
Reads raw source characters and converts them into a stream of meaningful tokens (keywords, identifiers, literals, operators) while stripping comments and whitespace.
:::

:::step 2: Syntax Analysis (Parsing)
Constructs the **Abstract Syntax Tree (AST)** according to formal grammar rules (Context-Free Grammar). Detects syntax errors like mismatched brackets or missing semicolons.
:::

:::step 3: Semantic Analysis & Type Checking
Verifies semantic consistency, type compatibility, variable declarations, and scope resolution across the AST.
:::

:::step 4: Intermediate Code Generation (IR)
Transforms the AST into machine-independent intermediate representation (Three-Address Code / Quadruples) suitable for platform-agnostic optimization.
:::

:::step 5: Code Optimization
Applies loop unrolling, dead code elimination, and constant folding to maximize execution efficiency.
:::

:::step 6: Target Code Generation
Translates optimized IR into target assembly or machine code with optimal register allocation.
:::

---

### 2.6 Interactive Collapsible Hints & Spoilers (Details & Summary)
Standard details and summary blocks render as native accordion cards with smooth toggle animations and haptic feedback to conceal hints, proofs, and intermediate calculation steps:

<details>
<summary>💡 Hint: Matrix Exponentiation for O(log N) Fibonacci</summary>

Recall that the Fibonacci recurrence can be expressed as a $2 \\times 2$ state transition matrix:
$$ \\begin{pmatrix} F_{n+1} \\\\ F_n \\end{pmatrix} = \\begin{pmatrix} 1 & 1 \\\\ 1 & 0 \\end{pmatrix}^n \\begin{pmatrix} F_1 \\\\ F_0 \\end{pmatrix} $$
Using binary exponentiation, $\\begin{pmatrix} 1 & 1 \\\\ 1 & 0 \\end{pmatrix}^n$ is computed in exactly $O(\\log N)$ arithmetic operations!
</details>

<details>
<summary>🔍 Proof of Time Complexity</summary>

Since the exponent $n$ is halved at each recursive step ($n \\to \\lfloor n/2 \\rfloor$), the call stack depth is strictly bounded by $\\lfloor \\log_2 n \\rfloor + 1$. Each $2 \\times 2$ matrix multiplication requires 8 scalar multiplications and 4 additions ($O(1)$), yielding an overall runtime of $O(\\log N)$ and auxiliary space of $O(1)$.
</details>

---

### 2.7 Custom SVG Vector Diagrams (Hardware & Engineering Graphics)
In addition to algorithmic Mermaid charts, PyQdeck renders native SVG vector graphics with infinite sharpness, responsive aspect ratios, tap-to-zoom pinch exploration, and an optional raw XML source viewer. Both fenced \`\`\`svg blocks and raw \`<svg>\` markup are natively supported:

\`\`\`svg
<svg viewBox="0 0 540 180" xmlns="http://www.w3.org/2000/svg">
  <title>CPU Memory & Cache Hierarchy</title>
  <rect x="10" y="20" width="110" height="140" rx="8" fill="#EEF2FF" stroke="#6366F1" stroke-width="2"/>
  <text x="65" y="70" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#312E81">CPU Core</text>
  <text x="65" y="95" font-family="monospace" font-size="11" text-anchor="middle" fill="#4F46E5">Registers</text>
  <text x="65" y="115" font-family="monospace" font-size="11" text-anchor="middle" fill="#4F46E5">L1 Cache</text>

  <path d="M 120 90 L 160 90" stroke="#6366F1" stroke-width="2"/>

  <rect x="160" y="35" width="100" height="110" rx="8" fill="#F0FDF4" stroke="#22C55E" stroke-width="2"/>
  <text x="210" y="85" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#14532D">L2 Cache</text>
  <text x="210" y="105" font-family="monospace" font-size="10" text-anchor="middle" fill="#16A34A">~256 KB</text>

  <path d="M 260 90 L 300 90" stroke="#22C55E" stroke-width="2"/>

  <rect x="300" y="45" width="100" height="90" rx="8" fill="#FEFCE8" stroke="#EAB308" stroke-width="2"/>
  <text x="350" y="85" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#713F12">L3 Cache</text>
  <text x="350" y="105" font-family="monospace" font-size="10" text-anchor="middle" fill="#CA8A04">~16 MB Shared</text>

  <path d="M 400 90 L 440 90" stroke="#EAB308" stroke-width="2"/>

  <rect x="440" y="55" width="90" height="70" rx="8" fill="#FDF2F8" stroke="#EC4899" stroke-width="2"/>
  <text x="485" y="90" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#831843">Main RAM</text>
  <text x="485" y="108" font-family="monospace" font-size="10" text-anchor="middle" fill="#DB2777">DDR4 / DDR5</text>
</svg>
\`\`\`

---

## 3. Sequence Diagram (sequenceDiagram)

Sequence diagrams depict message exchanges between distributed actors, servers, and databases.

\`\`\`mermaid
sequenceDiagram
    autonumber
    actor Student as Student App
    participant Auth as Auth Server (Clerk)
    participant API as PyQdeck API Gateway
    participant DB as PostgreSQL DB
    participant Cache as Redis Cache

    Student->>Auth: Request JWT Auth Token
    Auth-->>Student: Return Session Token
    Student->>API: GET /api/v1/questions/detail (Bearer token)
    API->>Cache: Check question cache (key: q_102)
    alt Cache Hit
        Cache-->>API: Return cached question & solution
    else Cache Miss
        API->>DB: SELECT * FROM questions WHERE id = 102
        DB-->>API: Return question record
        API->>Cache: SETEX q_102 3600 (store in cache)
    end
    API-->>Student: 200 OK (Render JSON response)
\`\`\`

---

## 3. Entity Relationship Diagram (erDiagram)

ER diagrams model relational database schemas, foreign keys, and cardinalities.

\`\`\`mermaid
erDiagram
    STUDENT ||--o{ RECENT_STUDY : tracks
    STUDENT ||--o{ VOTE : submits
    SUBJECT ||--|{ QUESTION : contains
    SEMESTER ||--|{ SUBJECT : includes
    QUESTION ||--o| SOLUTION : provides
    QUESTION ||--o{ VOTE : receives

    STUDENT {
        string student_id PK
        string email
        string name
        timestamp created_at
    }
    SUBJECT {
        string subject_id PK
        string code
        string name
        int semester_number
    }
    QUESTION {
        string question_id PK
        string subject_id FK
        int year
        string q_number
        int marks
        text content
    }
    SOLUTION {
        string solution_id PK
        string question_id FK
        text markdown_body
        int upvotes
        int downvotes
    }
\`\`\`

---

## 4. State Diagram (stateDiagram-v2)

State diagrams illustrate finite state machines, process transitions, and TCP connection lifecycles.

\`\`\`mermaid
stateDiagram-v2
    [*] --> CLOSED
    CLOSED --> LISTEN: passive open
    LISTEN --> SYN_RECEIVED: rcv SYN, send SYN+ACK
    SYN_RECEIVED --> ESTABLISHED: rcv ACK
    CLOSED --> SYN_SENT: active open, send SYN
    SYN_SENT --> ESTABLISHED: rcv SYN+ACK, send ACK
    ESTABLISHED --> FIN_WAIT_1: close, send FIN
    FIN_WAIT_1 --> FIN_WAIT_2: rcv ACK
    FIN_WAIT_2 --> TIME_WAIT: rcv FIN, send ACK
    TIME_WAIT --> CLOSED: 2MSL timeout
\`\`\`

---

## 5. Class Diagram (classDiagram)

Class diagrams model object-oriented software designs, inheritance, and interface implementations.

\`\`\`mermaid
classDiagram
    class User {
        +String userId
        +String email
        +login() bool
        +logout() void
    }
    class Student {
        +int semester
        +String branch
        +submitFeedback() void
    }
    class Admin {
        +manageSubjects() void
        +approveSolution() void
    }
    class QuestionPaper {
        +String subjectCode
        +int year
        +getQuestions() List~Question~
    }

    User <|-- Student : Inherits
    User <|-- Admin : Inherits
    Student --> QuestionPaper : Studies
\`\`\`

---

## 6. Git Graph (gitGraph)

Git graphs show branch topology, commits, merges, and release workflows.

\`\`\`mermaid
gitGraph
    commit id: "Initial setup"
    commit id: "SDK 57 upgrade"
    branch feat/mermaid-diagrams
    checkout feat/mermaid-diagrams
    commit id: "Add mermaid bundle"
    commit id: "Implement MermaidBlock"
    commit id: "Add fullscreen zoom"
    checkout main
    commit id: "Minor style fix"
    merge feat/mermaid-diagrams id: "Merge PR #42"
    commit id: "Release v1.0.8" tag: "v1.0.8"
\`\`\`

---

## 7. Mindmap (mindmap)

Mindmaps are useful for syllabus breakdowns, revision trees, and conceptual mind mapping.

\`\`\`mermaid
mindmap
  root((Operating Systems))
    Process Management
      Scheduling Algorithms
        FCFS
        Round Robin
        SJF
      IPC & Deadlocks
        Semaphores
        Bankers Algorithm
    Memory Management
      Paging
      Segmentation
      Virtual Memory
    File Systems
      Allocation Methods
      Directory Structures
\`\`\`

---

## 8. Pie Chart (pie)

Pie charts display question weightage, marks distributions, and exam pattern splits.

\`\`\`mermaid
pie title BEU Exam Marks Weightage Distribution
    "Module 1 (Process Scheduling)" : 28
    "Module 2 (Deadlocks & Concurrency)" : 22
    "Module 3 (Memory & Paging)" : 25
    "Module 4 (File Systems & Storage)" : 15
    "Module 5 (Protection & Security)" : 10
\`\`\`

---

## 9. User Journey (journey)

User journey diagrams visualize student study flows and user sentiment.

\`\`\`mermaid
journey
    title Student Exam Preparation Journey
    section Finding Papers
      Open PyQdeck: 5: Student
      Select Semester & Subject: 4: Student
      Browse Questions by Year: 5: Student
    section Revision
      Read Question & Solution: 5: Student
      Inspect Architecture Diagram: 5: Student, App
      Zoom into Diagram Details: 5: Student
    section Practice
      Copy Question Text: 4: Student
      Bookmark for Exam Night: 5: Student
\`\`\`

---

## 10. Bar Chart & Line Chart (xychart-beta)

Bar charts and line graphs visualize marks trends, difficulty metrics, and year-by-year question counts.

\`\`\`mermaid
xychart-beta
    title "Year-wise Question Frequency & Marks Weightage"
    x-axis ["2019", "2020", "2021", "2022", "2023"]
    y-axis "Marks" 0 --> 100
    bar [45, 60, 75, 82, 90]
    line [40, 55, 70, 78, 88]
\`\`\`

---

## 11. Gantt Timeline Bar Chart (gantt)

Gantt charts display revision timelines, study schedules, and project milestone bars.

\`\`\`mermaid
gantt
    title Semester Exam Revision Schedule
    dateFormat YYYY-MM-DD
    section Unit 1 & 2
      Process Management & CPU Scheduling :done, u1, 2024-05-01, 2024-05-06
      Threads, IPC & Synchronization      :active, u2, 2024-05-07, 2024-05-12
    section Unit 3 & 4
      Paging & Virtual Memory             :u3, 2024-05-13, 2024-05-18
      File Systems & Secondary Storage    :u4, 2024-05-19, 2024-05-24
\`\`\`

---

## 12. Academic & Historical Timeline (timeline)

Timelines illustrate academic semester progressions, syllabus milestones, and chronological history.

\`\`\`mermaid
timeline
    title B.Tech Computer Science 4-Year Curriculum Timeline
    Year 1 : Physics & Math : Engineering Mechanics : Programming in C
    Year 2 : Data Structures : Digital Logic : Computer Organization : OS
    Year 3 : Database Management : Algorithms : Computer Networks : Web Tech
    Year 4 : Compiler Design : Cloud Computing : Machine Learning : Final Capstone
\`\`\`

---

## Frequently Asked Questions

### Q: What diagram types can be rendered offline inside PyQdeck?
PyQdeck supports all 11+ core Mermaid diagram engines completely offline: Flowcharts, Sequence Diagrams, ER Diagrams, State Machines, Class Diagrams, Git Graphs, Mindmaps, Pie Charts, XY Bar & Line Charts (\`xychart-beta\`), Gantt Charts, and Timelines.

### Q: How do students interact with large diagrams?
Tapping anywhere on any diagram opens the dedicated Fullscreen Viewer. You can pinch-to-zoom up to 5x with two fingers, pan smoothly across large architectures, and copy diagram syntax.

### Q: Does diagram rendering require an internet connection?
No. The diagram parser and rendering engine are bundled directly inside the local app bundle. All diagrams compile and render 100% offline with zero external network requests.
`;

export const MermaidDemoScreen: React.FC = () => {
  const { notesBody, faqs } = React.useMemo(
    () => extractFaqsFromNotes(SAMPLE_NOTES_WITH_MERMAID),
    []
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ScreenContainer variant="read">
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Mermaid Showcase (Offline & Interactive)</Text>
            <Text style={styles.bannerSubtitle}>
              Rendered directly from bundled Mermaid.js. Tap any diagram to pinch-zoom up to 5x, pan across large architectures, or copy diagram source.
            </Text>
          </View>
          <NativeContentRenderer content={notesBody} fontSize={16} />
          {faqs.length > 0 && <FaqAccordion items={faqs} />}
        </ScreenContainer>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingVertical: 18,
    paddingBottom: 40,
  },
  banner: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  bannerTitle: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
});
