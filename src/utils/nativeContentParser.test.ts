import test from 'node:test';
import assert from 'node:assert/strict';
import { parseContentBlocks } from './nativeContentParser.ts';

test('parseContentBlocks groups multi-language code blocks into code_tabs', () => {
  const md = `
Some intro text

\`\`\`java
int a = 1;
\`\`\`
\`\`\`python
a = 1
\`\`\`
`;
  const blocks = parseContentBlocks(md);
  const codeTabs = blocks.find((b) => b.type === 'code_tabs') as any;
  assert.ok(codeTabs, 'Should find code_tabs block');
  assert.equal(codeTabs.tabs.length, 2);
  assert.equal(codeTabs.tabs[0].label, 'Java');
  assert.equal(codeTabs.tabs[1].label, 'Python');
});

test('parseContentBlocks groups headed approach code blocks even when preceded by prose', () => {
  const md = `
### 1.2 Multi-Approach Code Block (Grouped by Headings)

Different algorithmic solutions under \`### Approach\` headings are automatically unified into interactive tabs with copy buttons:

### Approach 1: Iterative (O(N) Time, O(1) Space)
\`\`\`python
def climb_stairs_iterative(n: int) -> int:
    return n
\`\`\`

### Approach 2: Recursive with Memoization (O(N) Time, O(N) Space)
\`\`\`python
def climb_stairs_memo(n: int) -> int:
    return n
\`\`\`

### Approach 3: Matrix Exponentiation (O(log N) Time)
\`\`\`python
def climb_stairs_matrix(n: int) -> int:
    return n
\`\`\`
`;

  const blocks = parseContentBlocks(md);
  const codeTabs = blocks.find((b) => b.type === 'code_tabs') as any;
  assert.ok(codeTabs, 'Should find code_tabs block for approaches');
  assert.equal(codeTabs.tabs.length, 3);
  assert.equal(codeTabs.tabs[0].label, 'Approach 1: Iterative (O(N) Time, O(1) Space)');
  assert.equal(codeTabs.tabs[1].label, 'Approach 2: Recursive with Memoization (O(N) Time, O(N) Space)');
  assert.equal(codeTabs.tabs[2].label, 'Approach 3: Matrix Exponentiation (O(log N) Time)');

  // Verify prose before Approach 1 is preserved
  const firstBlock = blocks[0];
  assert.equal(firstBlock.type, 'markdown');
  assert.ok((firstBlock as any).content.includes('Different algorithmic solutions'));
});
