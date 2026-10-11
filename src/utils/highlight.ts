// Splits result text into plain and matched runs for search highlighting.
// Token based (no dynamic RegExp), so user input can't break the pattern and
// "networks" still lights up for a "network" search.

export type HighlightPart = { text: string; hit: boolean };

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'was', 'with', 'that', 'this', 'from', 'what', 'which',
  'is', 'of', 'in', 'to', 'an', 'a', 'on', 'or', 'by', 'as', 'at', 'it', 'its', 'be',
  'explain', 'define', 'write', 'short', 'note', 'notes', 'discuss', 'describe', 'state',
]);

const TOKEN = /([\p{L}\p{M}\p{N}]+)/u;

export function queryTerms(query: string): string[] {
  const seen = new Set<string>();
  for (const raw of query.toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u)) {
    if (raw.length >= 2 && !STOPWORDS.has(raw)) seen.add(raw);
  }
  // A cap keeps long scanned questions cheap to match against.
  return [...seen].sort((a, b) => b.length - a.length).slice(0, 24);
}

export function splitHighlight(text: string, query: string): HighlightPart[] {
  if (!text) return [];
  const terms = queryTerms(query);
  if (terms.length === 0) return [{ text, hit: false }];

  const parts: HighlightPart[] = [];
  const push = (t: string, hit: boolean) => {
    if (!t) return;
    const last = parts[parts.length - 1];
    if (last && last.hit === hit) last.text += t;
    else parts.push({ text: t, hit });
  };

  // split() with a capture group puts the tokens at the odd indices.
  text.split(TOKEN).forEach((piece, i) => {
    if (i % 2 === 0) return push(piece, false);
    const lower = piece.toLowerCase();
    push(piece, terms.some((term) => lower.startsWith(term)));
  });
  return parts;
}
