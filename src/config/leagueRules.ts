import { PURSE_LAKH, PRICE_TIERS, AUCTION_SETS, SQUAD_SIZE, SQUAD_TARGET, VOTE_UNLOCK_AT, BID_STEPS, formatPrice } from '../hooks/useSCCLeague';

// ─── SCC League rulebook ───────────────────────────────────────────────────────
// One place for every rule, so the app, the auctioneer and the WhatsApp group
// are all reading the same thing.

export interface RuleSection {
  title: string;
  emoji: string;
  rules: string[];
}

export const CAPTAIN_RULES: RuleSection = {
  title: 'Captain election',
  emoji: '👑',
  rules: [
    `Voting stays **locked until ${VOTE_UNLOCK_AT} players have confirmed** — the first few to register don't get to pick the captains for everyone else.`,
    'Only players registered as **IN** get a ballot — if you are sitting out, you do not pick the captains for those who turn up.',
    'Every registered player gets **one ballot** — pick the **one** player you want captaining a team.',
    'You **can vote for yourself**. Campaigning is encouraged 😏',
    "**Captaincy is optional.** Don't fancy the job? Untick *Put me on the captain ballot* and you're left off it — you still play, you just can't be voted captain 🙅",
    'Only players who registered as **IN** *and* are up for the job appear on the ballot — so no vote is ever wasted on someone who would decline.',
    'Your captaincy choice **locks when voting opens**. Pulling out after people have backed you throws their votes away.',
    'You can **change your ballot** any time until voting closes.',
    '**Nobody sees the running count.** Vote for who you actually want leading, not for whoever looks like they are winning 🤐',
    'The **top 2 vote-getters** become the captains of the two teams.',
    'A tie is broken by **SCC Rankings rating**, then by a coin toss.',
    'Captains are **auto-assigned** to their own team — they are not auctioned.',
    'Each captain names their own deputy after the auction — that is **their call, not a vote**.',
  ],
};

export const AUCTION_RULES: RuleSection = {
  title: 'Auction rules',
  emoji: '🔨',
  rules: [
    `Each team gets a purse of **${formatPrice(PURSE_LAKH)}** — and it is meant to run out. The whole pool is worth about ₹17 Cr at base, so there is roughly enough money to win two or three bidding wars, not twelve.`,
    `Players come up in **sets**: ${AUCTION_SETS.map(x => `${x.emoji} ${x.label}`).join(' → ')} → unsold round. Order inside a set is **random**.`,
    'The **Marquee Set goes first**, while every purse is full and nobody has spent a rupee. Get in early or wait and gamble 😈',
    `Each squad is **${SQUAD_SIZE} players**: the captain + **${SQUAD_SIZE - 1} bought at auction**.`,
    `**${SQUAD_TARGET} players, ${SQUAD_SIZE} a side** — every registered player has a place, so the maths lands exactly: 2 captains retained and ${SQUAD_TARGET - 2} under the hammer.`,
    `The captain is **retained at their own graded price**, deducted from the purse before bidding starts.`,
    '**Base price is earned, not chosen.** It is graded automatically from your SCC Rankings rating — nobody picks their own slab.',
    `Grades: ${PRICE_TIERS.map(t => `**${t.emoji} ${t.label} ${formatPrice(t.price)}**`).join(' · ')}.`,
    'Played too few matches to be rated? You start at **Grade C** — the auction is where you fix that 😄',
    `Bidding rises in **${formatPrice(BID_STEPS[2].step)}** steps below ${formatPrice(100)}, **${formatPrice(BID_STEPS[1].step)}** from ${formatPrice(100)}, and **${formatPrice(BID_STEPS[0].step)}** at ${formatPrice(200)} and above.`,
    'Your **one-liner is read out** before bidding opens. Make it count 🗣️',
    'A captain **cannot bid** beyond what leaves enough purse to fill their remaining slots at base price.',
    'Every squad must contain **at least one wicket-keeper**.',
    'Unsold players go to a **second round** and can be picked up at base price.',
    'Each captain gets **one RTM (Right To Match) card** — steal back a player by matching the winning bid. Use it wisely 🃏',
    "The auctioneer's decision is final. No re-bids after the hammer falls 🔨",
  ],
};

export const SEASON_RULES: RuleSection = {
  title: 'The season',
  emoji: '⚔️',
  rules: [
    `We need **${SQUAD_TARGET} confirmed players** before the auction can happen.`,
    '**Two to three league matches every month**, dates published before the auction so everyone can plan.',
    'Points: **Win 3 · Tie 1 · Loss 0**. Standings live in the app.',
    'Squads are **locked for the season** — with one mid-season transfer window if the teams look lopsided.',
    'Missing your match? Tell your captain early — repeated no-shows may be traded 😬',
    '**Team names come later** — once the squad list and the two captains are locked, each captain names their own side 🎨',
    'Winner lifts the **SCC League trophy** at Awards Night 🏆',
  ],
};

export const ALL_RULES = [CAPTAIN_RULES, AUCTION_RULES, SEASON_RULES];
