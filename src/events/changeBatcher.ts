/**
 * Folds a burst of "these subjects changed" notices into one (docs/SRS-event-
 * driven-architecture.md, UI-FR-1). Ticking several topics quickly, or a pull
 * touching many subjects, becomes a single notice per frame carrying every
 * subject that changed, so each screen re-reads once. Timers are injected so the
 * rule can be tested without React Native.
 *
 * `null` means "cannot say which subjects" (a wipe, a rename): it wins over any
 * list in the same burst.
 */

export interface BatcherDeps {
  setTimeout(fn: () => void, ms: number): unknown;
  /** Called once per burst with the merged subjects, or null for "everything". */
  flush(subjectIds: string[] | null): void;
}

export class ChangeBatcher {
  private ids = new Set<string>();
  private all = false;
  private pending = false;
  private readonly deps: BatcherDeps;
  private readonly windowMs: number;

  constructor(deps: BatcherDeps, windowMs = 16) {
    this.deps = deps;
    this.windowMs = windowMs;
  }

  /** `subjectIds` omitted = the change cannot say which subjects changed. */
  note(subjectIds?: readonly string[]): void {
    if (subjectIds === undefined) this.all = true;
    else subjectIds.forEach((id) => this.ids.add(id));
    if (this.pending) return;
    this.pending = true;
    this.deps.setTimeout(() => {
      this.pending = false;
      const out = this.all ? null : [...this.ids];
      this.ids = new Set();
      this.all = false;
      this.deps.flush(out);
    }, this.windowMs);
  }
}
