// ─── Send what the question needs ─────────────────────────────────────────────
// Every question used to carry the whole club — squads, scorecards, finances,
// bookings, availability — about 37,000 tokens, whether it was asked about
// Diwali or a bowling average.
//
// This picks the blocks a question plausibly needs. It is deliberately
// GENEROUS: the cost of sending a block that goes unread is a fraction of a
// rupee, while the cost of withholding one is the model saying "I don't have
// that" about data the app is holding. So topics overlap, several can match at
// once, and anything unrecognised falls back to a broad default rather than a
// narrow guess.

export type Block =
  | 'members'        // full member rows with stats
  | 'matches'        // every fixture
  | 'highlights'     // per-match best batter/bowler
  | 'careerBests'    // per-player bests + season records
  | 'finance'        // transactions, club money
  | 'calendar'       // booked slots + who's free
  | 'away'           // who is away, admin only
  | 'squads'         // MahaSangram sides, captains, auction
  | 'challenges'     // member-vs-member contests
  | 'feedback'
  | 'bookings'       // opponents booking us + totals
  | 'requests'       // join requests
  | 'tournaments'
  | 'league';

/** A slim roster and the club facts always travel — nearly every question
 *  names a person, and the facts are what stop it inventing definitions. */
export const ALWAYS: Block[] = [];

// Each pattern ends `)s?\b` on purpose. Without it \bchallenge\b does not
// match "challenges" and \bopponent\b does not match "opponents" — so the two
// most natural phrasings of those questions fell through to the default set,
// which does not contain the block they needed. Found by testing the router,
// not by reading it.
const RULES: Array<{ block: Block; words: RegExp }> = [
  { block: 'members',     words: /\b(run|runs|wicket|average|strike rate|econom|batting|bowling|fielding|catch|stat|score[sd]?|form|best|top|most|player|batsman|bowler|allrounder|all-rounder)s?\b/ },
  { block: 'careerBests', words: /\b(best|highest|record|career|all[- ]time|ever|fifty|hundred|century|figures|most)s?\b/ },
  { block: 'highlights',  words: /\b(match|game|scored|took|performance|innings|last|recent|against|vs|versus|on \d)s?\b/ },
  { block: 'matches',     words: /\b(match|game|fixture|played|won|lost|result|win rate|record|history|opponent|vs|versus|beat|defeat)s?\b/ },
  { block: 'calendar',    words: /\b(when|next|schedule|upcoming|book(ed|ing)?|slot|ground|date|free|available|play(ing)?|fixture|weekend)s?\b/ },
  { block: 'away',        words: /\b(away|unavailable|travel|holiday|diwali|leave|absent|miss(ing)?|hometown|wedding)s?\b/ },
  { block: 'squads',      words: /\b(squad|team|side|captain|brahmos|agni|mahasangram|maha sangram|auction|price|bought|jersey|number)s?\b/ },
  { block: 'challenges',  words: /\b(challenge|challenged|bet|stake|ladder|streak|rival)s?\b/ },
  { block: 'finance',     words: /\b(money|fund|balance|wallet|paid|payment|fee|expense|cost|deposit|owe|due|rupee|₹|cash|spend|spent|contribut)s?\b/ },
  { block: 'bookings',    words: /\b(book(ed|ing)?|opponent|external team|revenue|earn|income|slot|hire|rent)s?\b/ },
  { block: 'feedback',    words: /\b(feedback|review|rating|suggestion|complain|said about|opinion)s?\b/ },
  { block: 'requests',    words: /\b(join|joining|applicant|new member|request|apply|trial)s?\b/ },
  { block: 'tournaments', words: /\b(tournament|cup|trophy|knockout|final|league stage)s?\b/ },
  { block: 'league',      words: /\b(league|table|standing|points|position)s?\b/ },
];

/** When nothing matches, this is what a general question about the club most
 *  often needs. Broad on purpose — an unrecognised question is the one most
 *  likely to be about anything. */
const DEFAULT: Block[] = ['members', 'matches', 'careerBests', 'squads', 'calendar'];

export function selectBlocks(question: string): Set<Block> {
  const q = question.toLowerCase();
  const picked = new Set<Block>(ALWAYS);
  for (const r of RULES) if (r.words.test(q)) picked.add(r.block);

  // A question about a person by name, with no other signal, still wants stats.
  if (picked.size === 0) DEFAULT.forEach(b => picked.add(b));

  // Pairs that are useless apart: asking about a match performance without the
  // matches themselves gives dates with no context.
  if (picked.has('highlights')) picked.add('matches');
  if (picked.has('away')) picked.add('calendar');
  if (picked.has('bookings')) picked.add('calendar');
  return picked;
}
