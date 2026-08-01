import { PURSE_LAKH, BASE_PRICE_OPTIONS, SQUAD_SIZE, SQUAD_TARGET, BID_STEP_SMALL, BID_STEP_BIG, formatPrice } from '../hooks/useSCCLeague';

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
    'Every registered player gets **one ballot** — pick 1 captain and 1 vice-captain.',
    'You **can vote for yourself**. Campaigning is encouraged 😏',
    'Captain and vice-captain must be **different people**.',
    'Only players who registered as **IN** can be voted for.',
    'You can **change your ballot** any time until voting closes.',
    'The **top 2 captain vote-getters** become the captains of the two teams.',
    'The **next 2 highest vice-captain picks** (excluding the captains) become their deputies.',
    'A tie is broken by **SCC Rankings rating**, then by a coin toss.',
    'Captains and vice-captains are **auto-assigned** to their team — they are not auctioned.',
  ],
};

export const AUCTION_RULES: RuleSection = {
  title: 'Auction rules',
  emoji: '🔨',
  rules: [
    `Each team gets a purse of **${formatPrice(PURSE_LAKH)}**.`,
    `Each squad is **${SQUAD_SIZE} players**: captain + vice-captain + **${SQUAD_SIZE - 2} bought at auction**.`,
    `Captain & vice-captain are **retained** at ${formatPrice(BASE_PRICE_OPTIONS[2])} each, deducted from the purse.`,
    'Everyone else enters the pool in **random order** — nobody knows when their name comes up.',
    `Your **base price** is the one you picked at registration (${BASE_PRICE_OPTIONS.map(formatPrice).join(' · ')}).`,
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
    '**One match a month**, dates published before the auction so everyone can plan.',
    'Points: **Win 3 · Tie 1 · Loss 0**. Standings live in the app.',
    'Squads are **locked for the season** — with one mid-season transfer window if the teams look lopsided.',
    'Missing your match? Tell your captain early — repeated no-shows may be traded 😬',
    'Winner lifts the **SCC League trophy** at Awards Night 🏆',
  ],
};

export const ALL_RULES = [CAPTAIN_RULES, AUCTION_RULES, SEASON_RULES];
