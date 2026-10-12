/**
 * Pure text logic for the markdown editors (no React):
 *  - splitBlocks / joinBlocks: the live editor shows a note as blocks (a
 *    paragraph, a heading, a $$ formula, a code or mermaid fence ...). Joining
 *    the blocks always gives back the exact original text, so editing one block
 *    never touches the spacing of the rest and the save diff stays small.
 *  - insertTool: apply a toolbar snippet at a selection.
 */

export interface Block {
  /** The block's own markdown. */
  text: string;
  /** The newlines (and blank lines) between this block and the next; '' for a final block with no trailing newline. */
  sep: string;
}

export interface ToolSpec {
  pre: string;
  post?: string;
  ph?: string;
  block?: boolean;
}

type Closer = (line: string) => boolean;

/**
 * If this line opens a construct that may contain blank lines (so it must stay
 * one block), returns the test for the line that closes it. Mirrors what
 * nativeContentParser treats as one unit.
 */
function opener(line: string): { close: Closer; before?: Closer } | null {
  const t = line.trim();
  const lower = t.toLowerCase();
  if (t.startsWith('```')) return { close: (l) => l.trim().startsWith('```') };
  if (t.startsWith('$$')) {
    const marks = t.split('$$').length - 1;
    return marks % 2 === 1 ? { close: (l) => l.includes('$$') } : null;
  }
  if (t.startsWith('\\[') && !t.includes('\\]')) return { close: (l) => l.includes('\\]') };
  if (t.includes('\\begin{') && !t.includes('\\end{')) return { close: (l) => l.includes('\\end{') };
  if (lower.startsWith('<details') && !lower.includes('</details>')) {
    return { close: (l) => l.toLowerCase().includes('</details>') };
  }
  if (lower.startsWith('<svg') && !lower.includes('</svg>')) {
    return { close: (l) => l.toLowerCase().includes('</svg>') };
  }
  if (t.startsWith(':::step')) {
    return {
      close: (l) => l.trim() === ':::',
      // A step also ends (without consuming the line) at the next heading, rule or step.
      before: (l) => {
        const x = l.trim();
        return x.startsWith('#') || x.startsWith('---') || x.startsWith(':::step');
      },
    };
  }
  return null;
}

export function splitBlocks(text: string): Block[] {
  if (text === '') return [{ text: '', sep: '' }];
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  // Leading blank lines become an empty first block that carries them.
  const lead: string[] = [];
  while (i < lines.length && lines[i].trim() === '') lead.push(lines[i++]);
  if (lead.length) {
    if (i === lines.length) return [{ text: '', sep: text }];
    blocks.push({ text: '', sep: lead.join('\n') + '\n' });
  }

  while (i < lines.length) {
    const body: string[] = [];
    let open: ReturnType<typeof opener> = null;
    while (i < lines.length) {
      const line = lines[i];
      if (open) {
        if (open.before && open.before(line)) break; // this line starts the next block
        body.push(line);
        i++;
        if (open.close(line)) open = null;
        continue;
      }
      if (line.trim() === '') break;
      open = opener(line);
      // A construct that closes on its own opening line is not "open".
      body.push(line);
      i++;
    }
    const blanks: string[] = [];
    while (i < lines.length && lines[i].trim() === '') blanks.push(lines[i++]);
    const last = i >= lines.length;
    const sep = last
      ? blanks.length
        ? '\n' + blanks.join('\n')
        : ''
      : '\n' + blanks.map((b) => b + '\n').join('');
    blocks.push({ text: body.join('\n'), sep });
  }
  return blocks;
}

export function joinBlocks(blocks: Block[]): string {
  return blocks.map((b) => b.text + b.sep).join('');
}

/** Drops blocks whose text is blank (keeping at least one), without disturbing the others' spacing. */
export function pruneEmptyBlocks(blocks: Block[]): Block[] {
  if (blocks.length <= 1) return blocks;
  const out: Block[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.text.trim() === '' && !(out.length === 0 && i === blocks.length - 1)) {
      // The previous block takes over the closing separator when the last block goes.
      if (i === blocks.length - 1 && out.length) out[out.length - 1] = { ...out[out.length - 1], sep: b.sep };
      continue;
    }
    out.push(b);
  }
  return out.length ? out : [{ text: '', sep: '' }];
}

export function insertTool(text: string, sel: { start: number; end: number }, tool: ToolSpec) {
  const { start, end } = sel;
  const inner = text.slice(start, end) || tool.ph || '';
  // Block snippets (lists, headings, code) start on their own line.
  const lead = tool.block && start > 0 && text[start - 1] !== '\n' ? '\n' : '';
  const insert = `${lead}${tool.pre}${inner}${tool.post ?? ''}`;
  const caret = start + lead.length + tool.pre.length + inner.length;
  return { text: text.slice(0, start) + insert + text.slice(end), caret };
}
