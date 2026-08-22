// ─── The player card, as data ─────────────────────────────────────────────────
// The club already thinks in trading cards without having drawn one: graded base
// prices, auction bids, Cricket DNA archetypes, MahaSangram squads. This gives
// that idea one shape, so the same card can appear on a profile, in the auction,
// in a squad pick and in a comparison and be recognisably the same object.
//
// Tiers are cut on a percentile of the squad, not on fixed run totals. A fixed
// bar ages badly — 300 runs means one thing in a 10-match season and another in
// a 25-match one — and it would quietly re-tier the whole club the moment the
// fixture list changed.

export type Tier = 'legend' | 'elite' | 'pro' | 'squad';

export interface CardTier {
  key: Tier;
  label: string;
  /** Full Tailwind class strings. Never interpolate these — Tailwind only
   *  compiles class names it can see literally in the source. */
  ring: string;
  chip: string;
  glow: string;
}

export const TIERS: Record<Tier, CardTier> = {
  legend: {
    key: 'legend', label: 'Legend',
    ring: 'border-amber-400/70 dark:border-amber-300/60',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200',
    glow: 'from-amber-200/50 to-transparent dark:from-amber-400/20',
  },
  elite: {
    key: 'elite', label: 'Elite',
    ring: 'border-violet-400/60 dark:border-violet-300/50',
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-400/20 dark:text-violet-200',
    glow: 'from-violet-200/50 to-transparent dark:from-violet-400/20',
  },
  pro: {
    key: 'pro', label: 'Pro',
    ring: 'border-sky-400/60 dark:border-sky-300/50',
    chip: 'bg-sky-100 text-sky-800 dark:bg-sky-400/20 dark:text-sky-200',
    glow: 'from-sky-200/50 to-transparent dark:from-sky-400/20',
  },
  squad: {
    key: 'squad', label: 'Squad',
    ring: 'border-slate-300 dark:border-white/15',
    chip: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/70',
    glow: 'from-slate-200/40 to-transparent dark:from-white/10',
  },
};

export interface CardStats {
  memberId: string;
  runs: number;
  wickets: number;
  matches: number;
  strikeRate?: number;
  economy?: number;
}

/**
 * One number to rank a player by, in the same currency as the MOM suggestion —
 * a wicket is worth about twenty runs. Deliberately the same weighting, so a
 * player's tier and their MOM shortlist position never contradict each other.
 */
export const rating = (s: CardStats) => s.runs + s.wickets * 20;

/** Batting / bowling / both, from what they actually do rather than a label. */
export function role(s: CardStats): string {
  const r = s.runs, w = s.wickets * 20;
  if (r && w && Math.min(r, w) / Math.max(r, w) > 0.45) return 'All-rounder';
  return w > r ? 'Bowler' : 'Batter';
}

/**
 * Tier by standing within the squad: top 10% Legend, 30% Elite, 60% Pro.
 * Everyone who has played is at least Squad — the card is a club membership
 * before it's a ranking, and a tier nobody can reach isn't worth printing.
 */
export function tierFor(s: CardStats, all: CardStats[]): CardTier {
  const ranked = [...all].filter(x => x.matches > 0).sort((a, b) => rating(b) - rating(a));
  const i = ranked.findIndex(x => x.memberId === s.memberId);
  if (i < 0 || !ranked.length) return TIERS.squad;
  const pct = i / ranked.length;
  if (pct < 0.10) return TIERS.legend;
  if (pct < 0.30) return TIERS.elite;
  if (pct < 0.60) return TIERS.pro;
  return TIERS.squad;
}

// ─── The same language, for matches ───────────────────────────────────────────
// A player card says what someone IS through a coloured ring and a chip. A
// match card should say what a match WAS the same way, so the two read as one
// system rather than two designers' work.
//
// Deliberately the same shape as CardTier — ring, chip, glow — so a screen
// styles a match exactly as it styles a player and nothing has to be learned
// twice.

export type ResultKey = 'won' | 'lost' | 'draw' | 'upcoming' | 'cancelled';

export const RESULT_TONE: Record<ResultKey, CardTier> = {
  won: {
    key: 'legend', label: 'Won',
    ring: 'border-emerald-400/60 dark:border-emerald-300/50',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200',
    glow: 'from-emerald-200/50 to-transparent dark:from-emerald-400/20',
  },
  lost: {
    key: 'squad', label: 'Lost',
    ring: 'border-rose-300/60 dark:border-rose-400/30',
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-400/20 dark:text-rose-200',
    glow: 'from-rose-200/40 to-transparent dark:from-rose-400/15',
  },
  draw: {
    key: 'pro', label: 'No result',
    ring: 'border-slate-300 dark:border-white/15',
    chip: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/70',
    glow: 'from-slate-200/40 to-transparent dark:from-white/10',
  },
  upcoming: {
    key: 'elite', label: 'Upcoming',
    ring: 'border-sky-400/60 dark:border-sky-300/50',
    chip: 'bg-sky-100 text-sky-800 dark:bg-sky-400/20 dark:text-sky-200',
    glow: 'from-sky-200/50 to-transparent dark:from-sky-400/20',
  },
  cancelled: {
    key: 'squad', label: 'Cancelled',
    ring: 'border-slate-300 dark:border-white/15',
    chip: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/50',
    glow: 'from-slate-200/30 to-transparent dark:from-white/5',
  },
};

/** Falls back to "no result" for anything unexpected in the data. */
export const resultTone = (r: string | null | undefined): CardTier =>
  RESULT_TONE[(r ?? 'draw') as ResultKey] ?? RESULT_TONE.draw;


// ─── Printed jerseys ──────────────────────────────────────────────────────────
// The club had shirts made: Brahmos in black and purple, Agni in navy and gold,
// both with a rocket. A member's squad number is the most personal thing the
// app can show them — it's on their back every match — so it belongs on their
// card rather than buried on a kit page nobody opens twice.
//
// Colours are lifted from the actual print, not invented, so the card and the
// shirt are recognisably the same thing.

export type JerseyTeam = 'brahmos' | 'agni';

export interface JerseyKit {
  name: string;
  /** Shirt body — the card's number plate uses this. */
  bg: string;
  /** Number and name print colour. */
  ink: string;
  crest: string;
}

export const JERSEY: Record<JerseyTeam, JerseyKit> = {
  brahmos: {
    name: 'SCC Brahmos',
    bg: 'linear-gradient(150deg,#1a0b2e 0%,#3b1578 55%,#0a0a12 100%)',
    ink: '#f0b429',
    crest: '/team-logos/brahmos.png',
  },
  agni: {
    name: 'SCC Agni',
    bg: 'linear-gradient(150deg,#16233f 0%,#1e3a5f 55%,#0d1526 100%)',
    ink: '#f5a623',
    crest: '/team-logos/agni.png',
  },
};

export const jerseyOf = (t: string | null | undefined): JerseyKit | null =>
  t === 'brahmos' || t === 'agni' ? JERSEY[t] : null;
