/** "just now", "5 min ago", "2 h ago", "3 d ago". Pure, so it runs under node --test. */
export function draftAge(savedAt: number, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - savedAt) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
