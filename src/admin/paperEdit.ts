/**
 * Page-level editing of a stored paper: the list the admin sees is a mix of
 * pages the paper already has ("existing", referenced by id) and pages just
 * added from the camera or gallery ("new", local files). Pure so it can be unit
 * tested; the sheet only renders it and the API layer sends it.
 */

export type NewPage = { uri: string; name: string; type: string };

export type Slot =
  | {
      kind: 'existing';
      publicId: string;
      thumbUrl: string;
      width: number | null;
      height: number | null;
    }
  | { kind: 'new'; page: NewPage };

export const MAX_PAGES = 20;

/** The stored pages as editable slots, in order. */
export const slotsFromPages = (
  pages: { publicId: string; thumbUrl: string; width?: number | null; height?: number | null }[]
): Slot[] =>
  pages.map((p) => ({
    kind: 'existing' as const,
    publicId: p.publicId,
    thumbUrl: p.thumbUrl,
    width: p.width ?? null,
    height: p.height ?? null,
  }));

/** Append new pages at the end, never past the page limit. */
export const addNewPages = (slots: Slot[], pages: NewPage[], max = MAX_PAGES): Slot[] => {
  const room = Math.max(0, max - slots.length);
  if (room === 0 || pages.length === 0) return slots;
  return [...slots, ...pages.slice(0, room).map((page) => ({ kind: 'new' as const, page }))];
};

export const removeSlot = (slots: Slot[], index: number): Slot[] =>
  index < 0 || index >= slots.length ? slots : slots.filter((_, i) => i !== index);

/** Swap a page with its neighbour. Returns the same array when it cannot move. */
export const moveSlot = (slots: Slot[], index: number, delta: -1 | 1): Slot[] => {
  const j = index + delta;
  if (index < 0 || index >= slots.length || j < 0 || j >= slots.length) return slots;
  const next = [...slots];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
};

/** The page at `index` becomes the given new page (the old one is dropped on save). */
export const replaceSlot = (slots: Slot[], index: number, page: NewPage): Slot[] =>
  index < 0 || index >= slots.length
    ? slots
    : slots.map((s, i) => (i === index ? { kind: 'new' as const, page } : s));

/** Swap in an edited (cropped / rotated) file for a new page. Existing pages are untouched. */
export const updateNewPage = (slots: Slot[], index: number, uri: string): Slot[] =>
  slots.map((s, i) =>
    i === index && s.kind === 'new'
      ? { kind: 'new' as const, page: { ...s.page, uri, name: `page-${i + 1}.jpg`, type: 'image/jpeg' } }
      : s
  );

export const newPagesOf = (slots: Slot[]): NewPage[] =>
  slots.flatMap((s) => (s.kind === 'new' ? [s.page] : []));

export type ChangeSummary = {
  added: number;
  removed: number;
  /** Kept pages are in a different order than they were stored. */
  reordered: boolean;
  kept: number;
  changed: boolean;
};

/** What saving would do, comparing the stored page ids with the current list. */
export const summarizeChanges = (originalIds: string[], slots: Slot[]): ChangeSummary => {
  const keptIds = slots.flatMap((s) => (s.kind === 'existing' ? [s.publicId] : []));
  const keptSet = new Set(keptIds);
  const added = slots.length - keptIds.length;
  const removed = originalIds.filter((id) => !keptSet.has(id)).length;
  const originalKept = originalIds.filter((id) => keptSet.has(id));
  const reordered = originalKept.some((id, i) => id !== keptIds[i]);
  return {
    added,
    removed,
    reordered,
    kept: keptIds.length,
    changed: added > 0 || removed > 0 || reordered,
  };
};

/** "2 added, 1 removed, order changed", or '' when nothing changed. */
export const describeChanges = (c: ChangeSummary): string => {
  const parts: string[] = [];
  if (c.added) parts.push(`${c.added} added`);
  if (c.removed) parts.push(`${c.removed} removed`);
  if (c.reordered) parts.push('order changed');
  return parts.join(', ');
};

/**
 * The page list to commit: kept pages by their own id, and each new page by the
 * id issued for it. `issuedIds` is in the order the new pages appear in the list.
 */
export const buildCommitPages = (slots: Slot[], issuedIds: string[]): { publicId: string }[] => {
  let next = 0;
  return slots.map((s) => ({ publicId: s.kind === 'existing' ? s.publicId : issuedIds[next++] }));
};
