// ─── Images left behind in the old Supabase project ──────────────────────────
// The database moved to a new project; the files in Storage did not, because the
// old project is restricted and its storage answers 402 to every request. So
// every avatar_url and logo_url in the database still points at a bucket nobody
// can read.
//
// Rendering those URLs gives 58 different screens a broken-image icon. Treating
// them as absent instead lets the fallback that already exists everywhere — the
// member's initials, the sponsor's name — do its job.
//
// This is deliberately keyed to the OLD project ref rather than "any failure":
// when the files are copied across and the URLs rewritten to the new project,
// this stops matching on its own and the photos come back with no code change.

const DEAD_PROJECT = 'zrrmpaatydhlkntfpcmw';

/** A URL the app can actually load, or null if it points at the dead project. */
export function liveUrl<T extends string | null | undefined>(url: T): string | null {
  if (!url) return null;
  return url.includes(DEAD_PROJECT) ? null : url;
}

/** Same, for a row carrying one of the two image columns. */
export function withLiveImages<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  if ('avatar_url' in out) out.avatar_url = liveUrl(out.avatar_url as string | null);
  if ('logo_url' in out)   out.logo_url   = liveUrl(out.logo_url as string | null);
  return out as T;
}

/**
 * Catch anything the two helpers above don't reach — a member embedded in a
 * match row, a sponsor inside a poster. Image load errors do not bubble, so this
 * listens in the capture phase, and it only touches images pointing at the dead
 * project so a genuinely broken image elsewhere still shows up as broken and
 * gets noticed.
 */
export function hideDeadImages() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    const el = e.target as HTMLImageElement | null;
    if (!el || el.tagName !== 'IMG') return;
    if (!el.src.includes(DEAD_PROJECT)) return;
    el.style.display = 'none';
  }, true);
}
