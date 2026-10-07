import React from 'react';
import { View, StyleSheet, ScrollView, Text, ActivityIndicator, InteractionManager } from 'react-native';
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
<svg viewBox="0 0 800 420" width="800" height="420" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569"/>
    </marker>
    <marker id="arr-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563EB"/>
    </marker>
    <marker id="arr-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669"/>
    </marker>
  </defs>

  <rect width="800" height="420" rx="12" fill="#F8FAFC"/>
  <text x="400" y="34" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="700" fill="#0F172A">TCP Three-Way Handshake</text>
  <text x="400" y="54" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#64748B">Connection establishment between client and server</text>

  <!-- Client -->
  <rect x="80" y="80" width="140" height="44" rx="8" fill="#DBEAFE" stroke="#2563EB" stroke-width="2"/>
  <text x="150" y="108" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="#1E3A8A">Client</text>
  <line x1="150" y1="124" x2="150" y2="395" stroke="#94A3B8" stroke-width="2" stroke-dasharray="6 5"/>

  <!-- Server -->
  <rect x="580" y="80" width="140" height="44" rx="8" fill="#D1FAE5" stroke="#059669" stroke-width="2"/>
  <text x="650" y="108" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="#065F46">Server</text>
  <line x1="650" y1="124" x2="650" y2="395" stroke="#94A3B8" stroke-width="2" stroke-dasharray="6 5"/>

  <!-- Step 1: SYN -->
  <line x1="150" y1="170" x2="648" y2="215" stroke="#2563EB" stroke-width="2.5" marker-end="url(#arr-b)"/>
  <rect x="290" y="168" width="220" height="26" rx="13" fill="#FFFFFF" stroke="#2563EB"/>
  <text x="400" y="186" text-anchor="middle" font-family="monospace" font-size="12" font-weight="700" fill="#1D4ED8">1. SYN  seq=x</text>
  <text x="60" y="176" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#64748B">CLOSED</text>
  <text x="740" y="226" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#64748B">LISTEN</text>

  <!-- Step 2: SYN-ACK -->
  <line x1="650" y1="250" x2="152" y2="295" stroke="#059669" stroke-width="2.5" marker-end="url(#arr-g)"/>
  <rect x="270" y="248" width="260" height="26" rx="13" fill="#FFFFFF" stroke="#059669"/>
  <text x="400" y="266" text-anchor="middle" font-family="monospace" font-size="12" font-weight="700" fill="#047857">2. SYN-ACK  seq=y, ack=x+1</text>
  <text x="60" y="306" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#64748B">SYN_SENT</text>
  <text x="740" y="256" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#64748B">SYN_RCVD</text>

  <!-- Step 3: ACK -->
  <line x1="150" y1="330" x2="648" y2="365" stroke="#2563EB" stroke-width="2.5" marker-end="url(#arr-b)"/>
  <rect x="290" y="328" width="220" height="26" rx="13" fill="#FFFFFF" stroke="#2563EB"/>
  <text x="400" y="346" text-anchor="middle" font-family="monospace" font-size="12" font-weight="700" fill="#1D4ED8">3. ACK  ack=y+1</text>
  <text x="60" y="346" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#059669">ESTABLISHED</text>
  <text x="740" y="386" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#059669">ESTABLISHED</text>
</svg>
\`\`\`

---

### 2.8 Illustrated Vector Artwork (University Campus & Student Study Scene)
In addition to technical protocol diagrams, PyQdeck renders rich artistic vector illustrations, campus scenes, and educational graphics with layered gradients, drop shadows, and clean geometry:

\`\`\`svg
<svg viewBox="0 0 800 480" width="800" height="480" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#EFF6FF"/>
      <stop offset="100%" stop-color="#F8FAFC"/>
    </linearGradient>
    <linearGradient id="bldg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E2E8F0"/>
      <stop offset="100%" stop-color="#CBD5E1"/>
    </linearGradient>
    <linearGradient id="dome" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCD34D"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
    <linearGradient id="desk" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F1F5F9"/>
    </linearGradient>
    <linearGradient id="screen" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
    <linearGradient id="diploma" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFFBEB"/>
      <stop offset="50%" stop-color="#FEF3C7"/>
      <stop offset="100%" stop-color="#FDE68A"/>
    </linearGradient>
  </defs>

  <!-- Sky Canvas -->
  <rect width="800" height="480" rx="16" fill="url(#sky)"/>

  <!-- University Sun / Academic Crest Glow -->
  <circle cx="700" cy="90" r="50" fill="#FEF08A" opacity="0.6"/>
  <circle cx="700" cy="90" r="32" fill="#FDE047"/>

  <!-- Subtle clouds -->
  <path d="M 120 70 Q 140 50 170 60 Q 200 50 220 70 Q 230 85 210 95 Q 120 100 120 70 Z" fill="#FFFFFF" opacity="0.8"/>
  <path d="M 520 85 Q 540 65 570 75 Q 600 65 620 85 Q 630 100 610 110 Q 520 115 520 85 Z" fill="#FFFFFF" opacity="0.7"/>

  <!-- BACKGROUND: University Grand Hall / Library Building -->
  <!-- Main building body -->
  <rect x="220" y="110" width="360" height="150" fill="url(#bldg)" stroke="#94A3B8" stroke-width="1.5" rx="4"/>
  <!-- Central Grand Dome -->
  <path d="M 340 110 Q 400 30 460 110 Z" fill="url(#dome)"/>
  <!-- Dome spire & star -->
  <line x1="400" y1="30" x2="400" y2="10" stroke="#F59E0B" stroke-width="3"/>
  <polygon points="400,6 403,12 409,12 404,16 406,22 400,18 394,22 396,16 391,12 397,12" fill="url(#gold)"/>
  <!-- Clock Tower Face -->
  <circle cx="400" cy="85" r="14" fill="#FFFFFF" stroke="#1D4ED8" stroke-width="2"/>
  <line x1="400" y1="85" x2="400" y2="76" stroke="#1E293B" stroke-width="2" stroke-linecap="round"/>
  <line x1="400" y1="85" x2="407" y2="85" stroke="#1E293B" stroke-width="1.5" stroke-linecap="round"/>

  <!-- Triangular Pediment -->
  <polygon points="310,110 400,65 490,110" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.5"/>
  <circle cx="400" cy="95" r="5" fill="#F59E0B"/>

  <!-- Classical Columns / Pillars -->
  <g fill="#F1F5F9" stroke="#94A3B8" stroke-width="1.2">
    <rect x="330" y="110" width="16" height="150"/>
    <rect x="370" y="110" width="16" height="150"/>
    <rect x="414" y="110" width="16" height="150"/>
    <rect x="454" y="110" width="16" height="150"/>
    <!-- Grand Entrance Arched Doorway -->
    <path d="M 386 260 L 386 210 Q 400 195 414 210 L 414 260 Z" fill="#1E293B"/>
  </g>

  <!-- Wing Windows Left -->
  <g fill="#93C5FD" stroke="#60A5FA" stroke-width="1">
    <rect x="240" y="130" width="22" height="35" rx="10"/>
    <rect x="275" y="130" width="22" height="35" rx="10"/>
    <rect x="240" y="180" width="22" height="35" rx="2"/>
    <rect x="275" y="180" width="22" height="35" rx="2"/>
  </g>
  <!-- Wing Windows Right -->
  <g fill="#93C5FD" stroke="#60A5FA" stroke-width="1">
    <rect x="502" y="130" width="22" height="35" rx="10"/>
    <rect x="537" y="130" width="22" height="35" rx="10"/>
    <rect x="502" y="180" width="22" height="35" rx="2"/>
    <rect x="537" y="180" width="22" height="35" rx="2"/>
  </g>

  <!-- Building steps / base -->
  <polygon points="190,260 610,260 630,285 170,285" fill="#CBD5E1"/>

  <!-- Campus Green Lawns & Trees -->
  <ellipse cx="140" cy="270" rx="45" ry="55" fill="#10B981" opacity="0.85"/>
  <ellipse cx="120" cy="280" rx="35" ry="45" fill="#059669"/>
  <rect x="135" y="295" width="10" height="30" fill="#78350F" rx="2"/>

  <ellipse cx="660" cy="270" rx="45" ry="55" fill="#10B981" opacity="0.85"/>
  <ellipse cx="680" cy="280" rx="35" ry="45" fill="#059669"/>
  <rect x="655" y="295" width="10" height="30" fill="#78350F" rx="2"/>

  <!-- FOREGROUND: Student Academic Study Desk (Curved Modern Platform) -->
  <path d="M 40 330 Q 400 300 760 330 L 760 480 L 40 480 Z" fill="url(#desk)" stroke="#E2E8F0" stroke-width="2"/>

  <!-- 1. Open Academic Textbook (Left) -->
  <g transform="translate(90, 310)">
    <!-- Book Shadow -->
    <path d="M 10 70 Q 110 55 210 70 L 220 95 Q 110 80 0 95 Z" fill="#94A3B8" opacity="0.3"/>
    <!-- Book Cover -->
    <path d="M 10 50 Q 110 38 210 50 L 210 85 Q 110 73 10 85 Z" fill="#3B82F6"/>
    <!-- Pages Left -->
    <path d="M 15 48 Q 110 35 110 46 L 110 80 Q 110 70 15 82 Z" fill="#FFFFFF" stroke="#E2E8F0"/>
    <!-- Pages Right -->
    <path d="M 110 46 Q 110 35 205 48 L 205 82 Q 110 70 110 80 Z" fill="#F8FAFC" stroke="#E2E8F0"/>
    <!-- Page Lines / Math formulas -->
    <line x1="30" y1="56" x2="95" y2="52" stroke="#94A3B8" stroke-width="2"/>
    <line x1="30" y1="63" x2="90" y2="60" stroke="#94A3B8" stroke-width="2"/>
    <line x1="30" y1="70" x2="75" y2="67" stroke="#3B82F6" stroke-width="2"/>
    <text x="125" y="60" font-family="monospace" font-size="9" font-weight="700" fill="#2563EB">∫ f(x) dx</text>
    <line x1="125" y1="67" x2="190" y2="69" stroke="#94A3B8" stroke-width="2"/>
    <line x1="125" y1="74" x2="180" y2="76" stroke="#94A3B8" stroke-width="2"/>
    <!-- Bookmark ribbon -->
    <path d="M 110 42 Q 115 65 125 90 L 120 92 Q 110 65 108 42 Z" fill="#EF4444"/>
  </g>

  <!-- 2. Modern Open Laptop (Center) -->
  <g transform="translate(310, 275)">
    <!-- Laptop Display Lid -->
    <rect x="15" y="0" width="160" height="106" rx="8" fill="#1E293B" stroke="#475569" stroke-width="2"/>
    <!-- Screen Glass -->
    <rect x="22" y="7" width="146" height="92" rx="4" fill="url(#screen)"/>
    <!-- Screen Header Dots -->
    <circle cx="30" cy="15" r="2.5" fill="#EF4444"/>
    <circle cx="38" cy="15" r="2.5" fill="#F59E0B"/>
    <circle cx="46" cy="15" r="2.5" fill="#10B981"/>
    <!-- Code Editor UI on screen -->
    <text x="30" y="32" font-family="monospace" font-size="8" fill="#38BDF8">const exam = solve(pastPapers);</text>
    <text x="30" y="44" font-family="monospace" font-size="8" fill="#34D399">rank = 1; // Top 0.1%</text>
    <!-- Code Graph on screen -->
    <polyline points="30,85 55,65 80,72 105,52 135,45 155,38" fill="none" stroke="#F59E0B" stroke-width="2"/>
    <circle cx="155" cy="38" r="3" fill="#F59E0B"/>
    <!-- Laptop Base / Keyboard Deck -->
    <polygon points="0,118 190,118 175,106 15,106" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
    <rect x="75" y="112" width="40" height="4" rx="2" fill="#94A3B8"/>
  </g>

  <!-- 3. Graduation Mortarboard & Diploma (Right) -->
  <g transform="translate(530, 290)">
    <!-- Graduation Cap (Diamond Top) -->
    <polygon points="120,15 210,38 120,60 30,38" fill="url(#screen)" stroke="#0F172A" stroke-width="1.5"/>
    <!-- Cap Skull Cap Underneath -->
    <path d="M 75 48 Q 120 75 165 48 L 165 65 Q 120 90 75 65 Z" fill="#0F172A"/>
    <!-- Cap Button & Golden Tassel -->
    <circle cx="120" cy="38" r="4" fill="url(#gold)"/>
    <path d="M 120 38 Q 160 48 175 75 Q 178 85 180 92" fill="none" stroke="#F59E0B" stroke-width="2.5"/>
    <polygon points="176,92 184,92 182,105 178,105" fill="url(#gold)"/>

    <!-- University Diploma Scroll -->
    <g transform="translate(50, 85) rotate(-12)">
      <rect x="0" y="0" width="95" height="24" rx="12" fill="url(#diploma)" stroke="#D97706" stroke-width="1.2"/>
      <!-- Red Ribbon Tie -->
      <rect x="42" y="-1" width="12" height="26" fill="#DC2626" rx="2"/>
      <path d="M 48 24 L 40 40 L 48 36 L 56 40 Z" fill="#DC2626"/>
    </g>
  </g>

  <!-- 4. Steaming Coffee Cup (Near Laptop) -->
  <g transform="translate(265, 365)">
    <!-- Saucer -->
    <ellipse cx="20" cy="38" rx="22" ry="6" fill="#CBD5E1"/>
    <!-- Mug Body -->
    <rect x="6" y="10" width="28" height="26" rx="4" fill="#3B82F6"/>
    <!-- Mug Handle -->
    <path d="M 34 16 Q 44 23 34 30" fill="none" stroke="#3B82F6" stroke-width="3"/>
    <!-- Hot Coffee Surface -->
    <ellipse cx="20" cy="12" rx="12" ry="4" fill="#78350F"/>
    <!-- Steam Swirls -->
    <path d="M 15 6 Q 13 -4 17 -10" fill="none" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <path d="M 23 4 Q 26 -6 22 -12" fill="none" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
  </g>

  <!-- 5. Floating Knowledge Sparkles & Formulas -->
  <g opacity="0.85">
    <text x="60" y="240" font-family="monospace" font-size="14" font-weight="700" fill="#2563EB">E = mc²</text>
    <text x="680" y="220" font-family="monospace" font-size="13" font-weight="700" fill="#059669">O(N log N)</text>
    <text x="210" y="325" font-family="monospace" font-size="14" font-weight="700" fill="#D97706">A* ➔ Goal</text>

    <!-- Golden Sparkles -->
    <path d="M 290 230 L 293 238 L 301 241 L 293 244 L 290 252 L 287 244 L 279 241 L 287 238 Z" fill="#FBBF24"/>
    <path d="M 515 250 L 517 256 L 523 258 L 517 260 L 515 266 L 513 260 L 507 258 L 513 256 Z" fill="#38BDF8"/>
    <path d="M 720 370 L 722 376 L 728 378 L 722 380 L 720 386 L 718 380 L 712 378 L 718 376 Z" fill="#FBBF24"/>
  </g>

  <!-- Bottom Caption Badge -->
  <rect x="250" y="442" width="300" height="26" rx="13" fill="#FFFFFF" stroke="#E2E8F0"/>
  <text x="400" y="459" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#1E293B">🎓 PyQdeck • Empowering Academic Excellence</text>
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

  // Defer the heavy diagram render until the navigation transition finishes,
  // otherwise the JS thread is blocked and the screen feels stuck.
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, []);

  if (!ready) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

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
