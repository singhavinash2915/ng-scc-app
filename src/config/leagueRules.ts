import { PURSE_LAKH, PRICE_TIERS, SQUAD_SIZE, SQUAD_TARGET, BID_STEP_SMALL, BID_STEP_BIG, formatPrice } from '../hooks/useSCCLeague';

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
    'Every registered player gets **one ballot** — pick the **one** player you want captaining a team.',
    'You **can vote for yourself**. Campaigning is encouraged 😏',
    'Only players who registered as **IN** can be voted for.',
    'You can **change your ballot** any time until voting closes.',
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
    `Each team gets a purse of **${formatPrice(PURSE_LAKH)}**.`,
    `Each squad is **${SQUAD_SIZE} players**: the captain + **${SQUAD_SIZE - 1} bought at auction**.`,
    `The captain is **retained at their own graded price**, deducted from the purse before bidding starts.`,
    '**Base price is earned, not chosen.** It is graded automatically from your SCC Rankings rating — nobody picks their own slab.',
    `Grades: ${PRICE_TIERS.map(t => `**${t.emoji} ${t.label} ${formatPrice(t.price)}**`).join(' · ')}.`,
    'Played too few matches to be rated? You start at **Grade C** — the auction is where you fix that 😄',
    'Everyone else enters the pool in **random order** — nobody knows when their name comes up.',
    `Bidding rises in **${formatPrice(BID_STEP_SMALL)}** steps below ${formatPrice(100)}, and **${formatPrice(BID_STEP_BIG)}** steps at ${formatPrice(100)} and above.`,
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
