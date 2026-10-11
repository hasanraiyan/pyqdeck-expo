// Path of the public "does this year have an original paper?" check.
//
// That URL is cached for everyone (the server sends Cache-Control: public,
// s-maxage=60 + stale-while-revalidate=120, and Cloudflare honours it), which is
// right for students but wrong for an admin who has just uploaded or removed a
// paper: the refetch right after the change would be answered from the cache
// with the OLD value. Passing `bust` makes the URL unique, so it skips every
// cache between the phone and the database.
export function paperStatusPath(subjectId: string, year: number, bust?: number): string {
  const base = `/papers/${encodeURIComponent(subjectId)}/${year}`;
  return bust ? `${base}?fresh=${bust}` : base;
}
