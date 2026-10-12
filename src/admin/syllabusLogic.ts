/**
 * Pure helpers for the in-app Syllabus & Notes admin section
 * (docs/SRS-admin-syllabus-notes-app.md). No React, storage or network
 * imports, so they run under `node --test`.
 */

import type { Tools } from './adminLogic';
import { can } from './adminLogic';

export const canReadSyllabus = (tools: Tools | undefined) =>
  can(tools, 'manage_syllabus', 'read') || can(tools, 'manage_notes', 'read');

export const canWriteSyllabus = (tools: Tools | undefined, action: string) =>
  can(tools, 'manage_syllabus', action);

export const canWriteNotes = (tools: Tools | undefined, action: string) =>
  can(tools, 'manage_notes', action);

/** Slug suggestion for a new subject: lowercase, non-alphanumerics to dashes. */
export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Pasted bulk topic titles: one per line, blanks skipped, de-duplicated. */
export function parseTopicTitles(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim().replace(/\s+/g, ' ');
    if (!t) continue;
    if (!seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
    }
  }
  // Return in first-seen order with original casing of first occurrence.
  const out: string[] = [];
  const lowerSeen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim().replace(/\s+/g, ' ');
    if (!t) continue;
    const k = t.toLowerCase();
    if (!lowerSeen.has(k)) {
      lowerSeen.add(k);
      out.push(t);
    }
  }
  return out;
}

export interface SubjectDraft {
  name: string;
  code: string;
  semester: string;
  branches: string[];
  kind: 'theory' | 'lab';
  pyqSubjectId: string;
}

export function validateSubjectDraft(d: SubjectDraft): string | null {
  if (!d.name.trim()) return 'Add a subject name.';
  if (d.name.trim().length > 120) return 'The name is at most 120 characters.';
  if (d.code && d.code.length > 20) return 'The code is at most 20 characters.';
  const sem = Number(d.semester);
  if (!d.semester.trim() || !Number.isInteger(sem) || sem < 1 || sem > 8) {
    return 'Semester must be 1–8.';
  }
  if (d.branches.length === 0) return 'Pick at least one branch.';
  return null;
}

export function validateModuleTitle(title: string): string | null {
  if (!title.trim()) return 'Add a module title.';
  if (title.trim().length > 160) return 'The title is at most 160 characters.';
  return null;
}

export function validateTopicTitle(title: string): string | null {
  if (!title.trim()) return 'Add a topic title.';
  if (title.trim().length > 200) return 'The title is at most 200 characters.';
  return null;
}

/**
 * update (full replace) vs patch (append / small hunks). The server patch is
 * all-or-nothing with exact-match `find`, so the app only picks patch when the
 * change is a pure append or a single contiguous replacement; else update.
 * Returns 'update' | 'patch-append' | 'patch-replace' | 'none'.
 */
export function pickNotesWrite(
  before: string,
  after: string
): 'update' | 'patch-append' | 'patch-replace' | 'none' {
  if (before === after) return 'none';
  if (!before) return 'update';
  if (after.startsWith(before) && after.length > before.length) return 'patch-append';
  // Single contiguous replacement: common prefix + common suffix cover `before`.
  let p = 0;
  while (p < before.length && p < after.length && before[p] === after[p]) p++;
  let s = 0;
  while (
    s < before.length - p &&
    s < after.length - p &&
    before[before.length - 1 - s] === after[after.length - 1 - s]
  ) {
    s++;
  }
  const removed = before.length - p - s;
  const added = after.length - p - s;
  // Small single-hunk edit (typo fix): patch-replace, else full update.
  if (removed <= 500 && added <= 2000 && removed + added <= 2000) return 'patch-replace';
  return 'update';
}

/** Scope/confirm copy for a destructive delete, so the dialog states the blast radius. */
export function deleteConfirmText(kind: 'subject' | 'module' | 'topic', counts: { topics: number; notes: number }): string {
  if (kind === 'subject') {
    return `This subject holds ${counts.topics} topics${counts.notes ? ` with notes on ${counts.notes}` : ''}. Everything will be removed. Student progress for it becomes inert.`;
  }
  if (kind === 'module') {
    return `This module holds ${counts.topics} topics${counts.notes ? ` with notes on ${counts.notes}` : ''} — all will be removed.`;
  }
  return counts.notes > 0
    ? 'Its notes will be removed too. PYQ links to it become orphaned. The topic id is gone for good.'
    : 'PYQ links to it become orphaned. The topic id is gone for good.';
}

/** Branches this account may write in (grant branches '*' = all). */
export function writableBranches(tools: Tools | undefined, allBranches: string[]): string[] {
  const g = tools?.['manage_syllabus'];
  if (!g || !g.branches) return [];
  if (g.branches === '*') return allBranches;
  const set = new Set(g.branches.map((b) => b.toLowerCase()));
  return allBranches.filter((b) => set.has(b.toLowerCase()));
}
