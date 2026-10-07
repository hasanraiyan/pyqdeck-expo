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
<svg viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748B"/>
    </marker>
    <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563EB"/>
    </marker>
    <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669"/>
    </marker>
    <marker id="arrow-purple" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#7C3AED"/>
    </marker>
  </defs>

  <!-- Title & Subtitle Banner -->
  <rect x="0" y="0" width="800" height="450" rx="12" fill="#F8FAFC"/>
  <text x="30" y="32" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#0F172A">Out-of-Order (OoO) SuperScalar CPU Architecture</text>
  <text x="30" y="48" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#64748B">Speculative Front-End • Dynamic Scheduling Engine • Non-Blocking Memory Subsystem</text>

  <!-- ZONE 1: INSTRUCTION FRONT-END (BLUE) -->
  <rect x="20" y="65" width="230" height="365" rx="8" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.5"/>
  <rect x="30" y="75" width="125" height="20" rx="4" fill="#DBEAFE"/>
  <text x="36" y="89" font-family="monospace" font-size="9.5" font-weight="700" fill="#1D4ED8">IN-ORDER FRONT-END</text>

  <!-- PC & Branch Target Buffer -->
  <rect x="35" y="105" width="200" height="42" rx="6" fill="#FFFFFF" stroke="#93C5FD" stroke-width="1.5"/>
  <text x="45" y="122" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#1E3A8A">Program Counter & BTB</text>
  <text x="45" y="137" font-family="monospace" font-size="9.5" fill="#3B82F6">TAGE Branch Predictor • PC + 16</text>

  <!-- L1 Instruction Cache -->
  <rect x="35" y="160" width="200" height="42" rx="6" fill="#FFFFFF" stroke="#93C5FD" stroke-width="1.5"/>
  <text x="45" y="177" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#1E3A8A">L1 Instruction Cache</text>
  <text x="45" y="192" font-family="monospace" font-size="9.5" fill="#3B82F6">32 KB • 8-Way • 4-Wide Fetch</text>

  <!-- 4-Wide Instruction Decoder -->
  <rect x="35" y="215" width="200" height="42" rx="6" fill="#FFFFFF" stroke="#93C5FD" stroke-width="1.5"/>
  <text x="45" y="232" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#1E3A8A">4-Wide Macro-Op Decoder</text>
  <text x="45" y="247" font-family="monospace" font-size="9.5" fill="#3B82F6">x86 / RISC-V → Micro-op Fusion</text>

  <!-- Register Rename & RAT -->
  <rect x="35" y="270" width="200" height="42" rx="6" fill="#FFFFFF" stroke="#93C5FD" stroke-width="1.5"/>
  <text x="45" y="287" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#1E3A8A">Register Alias Table (RAT)</text>
  <text x="45" y="302" font-family="monospace" font-size="9.5" fill="#3B82F6">Eliminates WAR & WAW Hazards</text>

  <!-- Front-End Micro-Op Queue -->
  <rect x="35" y="325" width="200" height="42" rx="6" fill="#FFFFFF" stroke="#93C5FD" stroke-width="1.5"/>
  <text x="45" y="342" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#1E3A8A">Decoded Micro-op Queue</text>
  <text x="45" y="357" font-family="monospace" font-size="9.5" fill="#3B82F6">64 Entries • Speculative Stream</text>

  <!-- Connecting Arrows Inside Front-End -->
  <path d="M 135 147 L 135 160" stroke="#93C5FD" stroke-width="2" marker-end="url(#arrow-blue)"/>
  <path d="M 135 202 L 135 215" stroke="#93C5FD" stroke-width="2" marker-end="url(#arrow-blue)"/>
  <path d="M 135 257 L 135 270" stroke="#93C5FD" stroke-width="2" marker-end="url(#arrow-blue)"/>
  <path d="M 135 312 L 135 325" stroke="#93C5FD" stroke-width="2" marker-end="url(#arrow-blue)"/>

  <!-- Dispatch Arrow from Front-End to OoO Core -->
  <path d="M 235 346 L 270 346 L 270 190 L 285 190" stroke="#2563EB" stroke-width="2.5" marker-end="url(#arrow-blue)"/>
  <text x="242" y="270" font-family="monospace" font-size="9" font-weight="700" fill="#2563EB" transform="rotate(-90, 242, 270)">DISPATCH (4 uOps/cyc)</text>

  <!-- ZONE 2: DYNAMIC EXECUTION CORE (PURPLE / AMBER) -->
  <rect x="285" y="65" width="280" height="365" rx="8" fill="#FDF4FF" stroke="#F0ABFC" stroke-width="1.5"/>
  <rect x="295" y="75" width="155" height="20" rx="4" fill="#F5D0FE"/>
  <text x="301" y="89" font-family="monospace" font-size="9.5" font-weight="700" fill="#86198F">OUT-OF-ORDER EXECUTION</text>

  <!-- Reorder Buffer (ROB) -->
  <rect x="298" y="105" width="254" height="40" rx="6" fill="#FFFFFF" stroke="#D946EF" stroke-width="1.5"/>
  <text x="308" y="122" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#701A75">Unified Reorder Buffer (ROB)</text>
  <text x="308" y="137" font-family="monospace" font-size="9.5" fill="#A21CAF">192 Entries • In-Order Retirement Guard</text>

  <!-- Unified Reservation Stations -->
  <rect x="298" y="160" width="254" height="42" rx="6" fill="#FFFFFF" stroke="#D946EF" stroke-width="1.5"/>
  <text x="308" y="177" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#701A75">Unified Reservation Station (RS)</text>
  <text x="308" y="192" font-family="monospace" font-size="9.5" fill="#A21CAF">Wakeup & Select Logic • 96 Sched Entries</text>

  <!-- Parallel Execution Ports -->
  <!-- Port 0: Fast ALU + Branch -->
  <rect x="298" y="222" width="122" height="44" rx="5" fill="#FAF5FF" stroke="#C084FC" stroke-width="1.2"/>
  <text x="305" y="238" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" font-weight="700" fill="#581C87">Int ALU 0 / BR</text>
  <text x="305" y="253" font-family="monospace" font-size="9" fill="#7E22CE">Latency: 1 cyc</text>

  <!-- Port 1: Int ALU + Shift -->
  <rect x="430" y="222" width="122" height="44" rx="5" fill="#FAF5FF" stroke="#C084FC" stroke-width="1.2"/>
  <text x="437" y="238" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" font-weight="700" fill="#581C87">Int ALU 1 / Shift</text>
  <text x="437" y="253" font-family="monospace" font-size="9" fill="#7E22CE">Latency: 1 cyc</text>

  <!-- Port 2: Vector & FPU (SIMD) -->
  <rect x="298" y="276" width="122" height="44" rx="5" fill="#FAF5FF" stroke="#C084FC" stroke-width="1.2"/>
  <text x="305" y="292" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" font-weight="700" fill="#581C87">Vector / FPU</text>
  <text x="305" y="307" font-family="monospace" font-size="9" fill="#7E22CE">256-bit FMA (4 cyc)</text>

  <!-- Port 3: Load / Store Queue (LSQ) -->
  <rect x="430" y="276" width="122" height="44" rx="5" fill="#FAF5FF" stroke="#C084FC" stroke-width="1.2"/>
  <text x="437" y="292" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" font-weight="700" fill="#581C87">Load / Store Queue</text>
  <text x="437" y="307" font-family="monospace" font-size="9" fill="#7E22CE">64 Entries • Forwarding</text>

  <!-- Physical Register File (PRF) -->
  <rect x="298" y="335" width="254" height="42" rx="6" fill="#FFFFFF" stroke="#D946EF" stroke-width="1.5"/>
  <text x="308" y="352" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#701A75">Physical Register File (PRF)</text>
  <text x="308" y="367" font-family="monospace" font-size="9.5" fill="#A21CAF">160 Integer + 160 FP Physical Regs</text>

  <!-- Arrows in OoO Engine -->
  <path d="M 425 145 L 425 160" stroke="#C084FC" stroke-width="2" marker-end="url(#arrow-purple)"/>
  <path d="M 360 202 L 360 222" stroke="#C084FC" stroke-width="1.8" marker-end="url(#arrow-purple)"/>
  <path d="M 490 202 L 490 222" stroke="#C084FC" stroke-width="1.8" marker-end="url(#arrow-purple)"/>
  <path d="M 360 266 L 360 276" stroke="#C084FC" stroke-width="1.8" marker-end="url(#arrow-purple)"/>
  <path d="M 490 266 L 490 276" stroke="#C084FC" stroke-width="1.8" marker-end="url(#arrow-purple)"/>

  <!-- Common Data Bus (CDB) Bypass -->
  <path d="M 425 320 L 425 335" stroke="#D946EF" stroke-width="2" marker-end="url(#arrow-purple)"/>

  <!-- ZONE 3: MEMORY & RETIREMENT BACK-END (GREEN / ROSE) -->
  <rect x="585" y="65" width="195" height="365" rx="8" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.5"/>
  <rect x="595" y="75" width="140" height="20" rx="4" fill="#DCFCE7"/>
  <text x="601" y="89" font-family="monospace" font-size="9.5" font-weight="700" fill="#15803D">MEMORY & COMMIT</text>

  <!-- Architectural Register File & Retire -->
  <rect x="595" y="105" width="175" height="52" rx="6" fill="#FFFFFF" stroke="#86EFAC" stroke-width="1.5"/>
  <text x="605" y="123" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#14532D">In-Order Retirement</text>
  <text x="605" y="138" font-family="monospace" font-size="9.5" fill="#16A34A">Commit up to 4 uOps</text>
  <text x="605" y="151" font-family="monospace" font-size="9" fill="#15803D">Updates Arch State (ARF)</text>

  <!-- Translation Lookaside Buffer -->
  <rect x="595" y="172" width="175" height="44" rx="6" fill="#FFFFFF" stroke="#86EFAC" stroke-width="1.5"/>
  <text x="605" y="190" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#14532D">Data TLB (dTLB)</text>
  <text x="605" y="205" font-family="monospace" font-size="9.5" fill="#16A34A">64 Entries • 4-Level MMU</text>

  <!-- L1 Data Cache -->
  <rect x="595" y="230" width="175" height="52" rx="6" fill="#FFFFFF" stroke="#86EFAC" stroke-width="1.5"/>
  <text x="605" y="248" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#14532D">L1 Data Cache</text>
  <text x="605" y="263" font-family="monospace" font-size="9.5" fill="#16A34A">32 KB • 8-Way • Non-blocking</text>
  <text x="605" y="276" font-family="monospace" font-size="9" fill="#15803D">Hit Latency: 4 Cycles</text>

  <!-- L2 Cache & Coherency Interconnect -->
  <rect x="595" y="300" width="175" height="56" rx="6" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.5"/>
  <text x="605" y="318" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#9F1239">Unified L2 Cache</text>
  <text x="605" y="333" font-family="monospace" font-size="9.5" fill="#E11D48">512 KB • 8-Way (12 Cycles)</text>
  <text x="605" y="348" font-family="monospace" font-size="9" fill="#BE123C">MESI Coherence Protocol</text>

  <!-- System Fabric Bus -->
  <rect x="595" y="370" width="175" height="44" rx="6" fill="#FFF7ED" stroke="#FED7AA" stroke-width="1.5"/>
  <text x="605" y="388" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#9A3412">L3 Ring / DRAM Bus</text>
  <text x="605" y="403" font-family="monospace" font-size="9.5" fill="#C2410C">Shared 16 MB • Memory Ctrl</text>

  <!-- Connections from LSQ to D-Cache & Memory -->
  <path d="M 552 298 L 575 298 L 575 256 L 595 256" stroke="#059669" stroke-width="2" marker-end="url(#arrow-green)"/>
  <path d="M 682 216 L 682 230" stroke="#059669" stroke-width="1.8" marker-end="url(#arrow-green)"/>
  <path d="M 682 282 L 682 300" stroke="#E11D48" stroke-width="1.8" marker-end="url(#arrow)"/>
  <path d="M 682 356 L 682 370" stroke="#C2410C" stroke-width="1.8" marker-end="url(#arrow)"/>

  <!-- ROB to Commit arrow -->
  <path d="M 552 125 L 595 125" stroke="#7C3AED" stroke-width="2" marker-end="url(#arrow-purple)"/>
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
