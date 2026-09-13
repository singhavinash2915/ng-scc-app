import type { Member } from '../types';

// ─── Matching a scorecard name to a member ────────────────────────────────────
// CricHeroes names are typed by whoever scored the match: "Aditya P", "Niraj
// Parmeshwar", "AKASH JADHAV", "Honey porwal". Turning one into an SCC member is
// the single most consequential guess the app makes — it decides whose runs
// those are, whose wickets, and now who captained.
//
// So it is deliberately strict, and returns null rather than guessing when two
// members could answer. It lived inside useStatSync, which meant anything
// outside that hook had to invent its own looser version; the loose one in the
// prediction scorer matches on first name alone, which is exactly how "Aditya"
// ends up on the wrong Aditya.

function norm(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
}

function matchPlayer(chName: string, members: Member[]): Member | null {
  // Critical: when SCC has TWO members sharing a first name (e.g. Aditya
  // Purohit AND Aditya Jaiswal), CricHeroes scorecard rows like "Aditya P"
  // and "Aditya" must NOT collide. We resolve via the last-name initial
  // when the CH name uses the "First + Initial" form.
  //
  // Rules (in order):
  //   1. Exact normalised match.
  //   2. "First + SingleLetterInitial" → match SCC member whose last name
  //      starts with that letter. If multiple Adityas, "Aditya P" → Purohit.
  //   3. Multi-word name → require first AND last word to match (last word
  //      can be a startsWith match either direction).
  //   4. Single-word first name → only match if EXACTLY ONE SCC member
  //      has that first name. If ambiguous, return null (skip the row).

  const n = norm(chName);
  if (!n) return null;

  // 1. Exact
  let m = members.find(x => norm(x.name) === n);
  if (m) return m;

  const parts = n.split(' ');
  const byFirst = members.filter(x => norm(x.name).split(' ')[0] === parts[0]);

  // 2. "First + Initial" form (e.g. "Aditya P", "Vinay R")
  if (parts.length === 2 && parts[1].length === 1) {
    const chInitial = parts[1][0];
    const initialMatch = byFirst.find(x => {
      const xp = norm(x.name).split(' ');
      const lastWord = xp[xp.length - 1] || '';
      return lastWord[0] === chInitial;
    });
    if (initialMatch) return initialMatch;
    // Fallback only if there's a single candidate with this first name
    if (byFirst.length === 1) return byFirst[0];
    return null; // ambiguous — skip rather than misattribute
  }

  // 3. Multi-word name — require first AND last to align
  if (parts.length >= 2) {
    m = members.find(x => {
      const xp = norm(x.name).split(' ');
      const lastCh  = parts[parts.length - 1];
      const lastSb  = xp[xp.length - 1];
      return xp[0] === parts[0] && (
        lastSb === lastCh ||
        lastSb.startsWith(lastCh) ||
        lastCh.startsWith(lastSb)
      );
    });
    if (m) return m;
    // No surname match: only resolve if first name is unique
    if (byFirst.length === 1) return byFirst[0];
    return null;
  }

  // 4. Single-word first name only — match only if unambiguous
  if (byFirst.length === 1) return byFirst[0];

  return null;
}

export { norm, matchPlayer as matchPlayerName };
