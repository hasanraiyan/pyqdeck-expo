/**
 * Live styling for the block being edited. The text stays plain markdown (so
 * saving is lossless); this only splits it into spans so headings look like
 * headings, **bold** looks bold, markers fade back and math/code stand out.
 * Joining every span's `t` always gives back the exact input.
 */

export interface Flags {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  mono?: boolean;
  /** Markdown punctuation (#, **, `, $ ...): drawn faint. */
  dim?: boolean;
  /** Math, list markers, links. */
  accent?: boolean;
  muted?: boolean;
  size?: 1 | 2 | 3;
}

export interface Span {
  t: string;
  f: Flags;
}

const merge = (a: Flags, b: Flags): Flags => ({ ...a, ...b });

const push = (out: Span[], t: string, f: Flags) => {
  if (t) out.push({ t, f });
};

// Order matters: bold before italic so ** is never read as two *.
const INLINE_SRC = /\*\*([^*\n]+?)\*\*|~~([^~\n]+?)~~|\*([^*\s][^*\n]*?)\*|`([^`\n]+)`|\$([^$\n]+)\$|\[([^\]\n]+)\]\(([^)\n]+)\)/g;

function inline(text: string, base: Flags, out: Span[]) {
  let last = 0;
  // A fresh regex per call: the recursion below would otherwise reset a shared lastIndex.
  const INLINE = new RegExp(INLINE_SRC.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = INLINE.exec(text)) !== null) {
    push(out, text.slice(last, m.index), base);
    if (m[1] !== undefined) {
      push(out, '**', merge(base, { dim: true }));
      inline(m[1], merge(base, { bold: true }), out);
      push(out, '**', merge(base, { dim: true }));
    } else if (m[2] !== undefined) {
      push(out, '~~', merge(base, { dim: true }));
      inline(m[2], merge(base, { strike: true }), out);
      push(out, '~~', merge(base, { dim: true }));
    } else if (m[3] !== undefined) {
      push(out, '*', merge(base, { dim: true }));
      inline(m[3], merge(base, { italic: true }), out);
      push(out, '*', merge(base, { dim: true }));
    } else if (m[4] !== undefined) {
      push(out, '`', merge(base, { dim: true }));
      push(out, m[4], merge(base, { mono: true }));
      push(out, '`', merge(base, { dim: true }));
    } else if (m[5] !== undefined) {
      push(out, '$', merge(base, { dim: true }));
      push(out, m[5], merge(base, { mono: true, accent: true }));
      push(out, '$', merge(base, { dim: true }));
    } else {
      push(out, '[', merge(base, { dim: true }));
      push(out, m[6], merge(base, { accent: true }));
      push(out, '](', merge(base, { dim: true }));
      push(out, m[7], merge(base, { dim: true }));
      push(out, ')', merge(base, { dim: true }));
    }
    last = m.index + m[0].length;
  }
  push(out, text.slice(last), base);
}

export function highlight(text: string): Span[] {
  const out: Span[] = [];
  const lines = text.split('\n');
  let fence = false;
  let math = false;
  let raw: '</svg>' | null = null;

  lines.forEach((line, i) => {
    const nl = i < lines.length - 1 ? '\n' : '';
    const t = line.trim();
    const lower = t.toLowerCase();

    if (fence) {
      push(out, line, t.startsWith('```') ? { mono: true, dim: true } : { mono: true });
      if (t.startsWith('```')) fence = false;
    } else if (t.startsWith('```')) {
      fence = true;
      push(out, line, { mono: true, dim: true });
    } else if (math) {
      push(out, line, { mono: true, accent: true });
      if (line.includes('$$')) math = false;
    } else if (t.startsWith('$$')) {
      push(out, line, { mono: true, accent: true });
      if ((t.split('$$').length - 1) % 2 === 1) math = true;
    } else if (raw) {
      push(out, line, { mono: true, muted: true });
      if (lower.includes(raw)) raw = null;
    } else if (lower.startsWith('<svg') && !lower.includes('</svg>')) {
      raw = '</svg>';
      push(out, line, { mono: true, muted: true });
    } else {
      const h = /^(#{1,6})(\s+)(.*)$/.exec(line);
      const q = /^(\s*>\s?)(.*)$/.exec(line);
      const b = /^(\s*)([-*+]|\d+\.)(\s+)(.*)$/.exec(line);
      if (h) {
        const size = (h[1].length === 1 ? 1 : h[1].length === 2 ? 2 : 3) as 1 | 2 | 3;
        push(out, h[1] + h[2], { dim: true, bold: true, size });
        inline(h[3], { bold: true, size }, out);
      } else if (q) {
        push(out, q[1], { dim: true });
        inline(q[2], { muted: true, italic: true }, out);
      } else if (b) {
        push(out, b[1], {});
        push(out, b[2], { accent: true, bold: true });
        push(out, b[3], {});
        inline(b[4], {}, out);
      } else {
        inline(line, {}, out);
      }
    }
    push(out, nl, {});
  });
  return out;
}
