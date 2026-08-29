import { useCallback, useMemo, useState } from 'react';
import { useMembers } from './useMembers';
import { useMatches } from './useMatches';
import { useTransactions } from './useTransactions';
import { useTournaments } from './useTournaments';
import { useCricketStats } from './useCricketStats';
import { useAIInsight } from './useAIInsight';
import { useScorecardHighlights } from './useScorecardHighlights';
import { useMahaSangram } from './useMahaSangram';
import { useChallenges } from './useChallenges';
import { useSquads } from './useSquads';
import { useUnavailability } from './useUnavailability';
import { useGroundDates } from './useGroundDates';
import { useSeasonLeague } from './useSeasonLeague';
import { useClubExtras } from './useClubExtras';
import { useAuth } from '../context/AuthContext';
import { buildLadder } from '../lib/challengeLadder';
import { buildMatcher } from '../lib/challenges';
import { CLUB_FACTS } from '../lib/clubFacts';
import { quickAnswer } from '../lib/quickAnswers';
import { useMe } from '../context/MemberContext';

// ─── Ask the club a question ──────────────────────────────────────────────────
// Everything the chat needs, in one place, so the floating bubble and the
// /ai-insights tab are the same implementation rather than two that drift.
//
// This hook is EXPENSIVE by design — it pulls members, matches, transactions,
// stats twice over, scorecards, challenges, squads, availability, bookings and
// the league table. Nothing may mount it globally: it belongs behind a lazy
// boundary that only loads when somebody actually opens the chat. Mounting it
// on every page would make the whole app slower for a feature most people never
// tap.

/** A per-device daily ceiling. This exists because the API credits ran out
 *  once already, and making the chat reachable everywhere makes that easier,
 *  not harder. It is not security — clearing storage resets it — it is an
 *  accident guard, which is what actually went wrong. */
export const DAILY_LIMIT = 12;
const COUNT_KEY = 'scc-ai-asks';

function todayKey() { return new Date().toLocaleDateString('en-CA'); }

export function readAsksToday(): number {
  try {
    const raw = JSON.parse(localStorage.getItem(COUNT_KEY) || '{}');
    return raw.day === todayKey() ? Number(raw.n) || 0 : 0;
  } catch { return 0; }
}
function bumpAsks() {
  try {
    localStorage.setItem(COUNT_KEY, JSON.stringify({ day: todayKey(), n: readAsksToday() + 1 }));
  } catch { /* private mode — the cap simply doesn't apply */ }
}

export interface ChatMessage { role: 'user' | 'ai'; text: string }

export function useClubChat() {
  const { members } = useMembers();
  const { matches } = useMatches();
  const { transactions } = useTransactions();
  const { tournaments } = useTournaments();
  const { stats, getLeaderboard } = useCricketStats();
  const { stats: careerStats } = useCricketStats('all');
  const { generateInsight } = useAIInsight();
  const { matchHighlights, seasonRecords, playerCareerBests } = useScorecardHighlights(null);
  const maha = useMahaSangram(matches, members, null);
  const challenges = useChallenges();
  const { squads } = useSquads(members);
  const unavail = useUnavailability();
  const groundDates = useGroundDates();
  const seasonLeague = useSeasonLeague();
  const { isAdmin } = useAuth();
  const { me } = useMe();
  const nameOf = useCallback(
    (id: string) => members.find(m => m.id === id)?.name ?? 'Unknown', [members]);
  const slotDateOf = useCallback((slotId: string | null) =>
    (slotId ? groundDates.bookings.find(b => b.id === slotId)?.date ?? null : null),
    [groundDates.bookings]);
  const extras = useClubExtras(isAdmin, nameOf, slotDateOf);

  const [asksToday, setAsksToday] = useState(readAsksToday);
  const left = Math.max(0, DAILY_LIMIT - asksToday);

  const leaderboard = useMemo(() => getLeaderboard(), [getLeaderboard]);

  /** Answer locally when we can be certain. Free, instant, and — being read
   *  from the data rather than generated — incapable of being subtly wrong
   *  about a number. Anything it isn't sure of returns null and goes to the
   *  model. This also runs BEFORE the daily cap, because a question that
   *  costs nothing should not use up an allowance meant to limit spending. */
  const tryQuick = useCallback((question: string): string | null => quickAnswer(question, {
    members, matches,
    squads: squads.map(sq => ({
      name: sq.name, captain: sq.captain,
      players: sq.players.map(p => ({ name: p.name, isCaptain: p.isCaptain })),
    })),
    awayOn: unavail.awayOn,
    awayRows: unavail.rows,
    upcomingSlots: groundDates.upcoming.map(b => ({
      date: b.date, time_slot: b.time_slot, venue: b.venue,
    })),
    seasonStats: stats.map(x => ({
      member_id: x.member_id, batting_runs: x.batting_runs, bowling_wickets: x.bowling_wickets,
    })),
    careerStats: careerStats.map(x => ({
      member_id: x.member_id, batting_runs: x.batting_runs, bowling_wickets: x.bowling_wickets,
    })),
    me, isAdmin,
  }), [members, matches, squads, unavail, groundDates.upcoming, stats, careerStats, me, isAdmin]);

  const ask = useCallback(async (question: string): Promise<string> => {
    const quick = tryQuick(question);
    if (quick) return quick;

    if (left <= 0) {
      return `You've used today's ${DAILY_LIMIT} questions. The chat costs the club a little each time, so it resets tomorrow.`;
    }
    bumpAsks();
    setAsksToday(n => n + 1);
    const financeAccess = isAdmin;
    const topRunScorer = [...stats].sort((a, b) => b.batting_runs - a.batting_runs)[0];
    const topWicketTaker = [...stats].filter(s => s.bowling_wickets > 0).sort((a, b) => b.bowling_wickets - a.bowling_wickets)[0];
    const mvpPlayer = leaderboard[0];
    const allMatchesCount = matches.length;
    // External matches only for overall club stats
    const completedMatches = matches.filter(m => m.match_type !== 'internal' && ['won','lost','draw'].includes(m.result));
    const wons = completedMatches.filter(m => m.result === 'won').length;

    // ── 1. Members — full profile with balance + cricket stats ──────────────
    // Financial fields (wallet_balance, deposits, fees) are only included for
    // members/admins — for public users they're omitted entirely.
    const allMemberProfiles = members.map(m => {
      const s = stats.find(st => st.member_id === m.id);
      // Per-member transaction summary (member-only)
      const memberTxns = transactions.filter(t => t.member_id === m.id);
      const totalDeposited = memberTxns.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
      const totalFeesPaid  = memberTxns.filter(t => t.type === 'match_fee').reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const c = careerStats.find(st => st.member_id === m.id);
      const jt = (m as { jersey_team?: string | null }).jersey_team ?? null;
      return {
        name: m.name,
        status: m.status,
        matches_played: m.matches_played,
        // Which MahaSangram side they were auctioned to, and the number printed
        // on their shirt. Members ask "who's on Agni" constantly and the model
        // had no way to answer it.
        mahasangram_side: jt ? (jt === 'brahmos' ? 'SCC Brahmos' : 'SCC Agni') : null,
        // Career = every season summed. The fields below without this prefix
        // are the CURRENT season only.
        career_runs: c?.batting_runs ?? null,
        career_wickets: c?.bowling_wickets ?? null,
        career_matches: c?.batting_innings ?? null,
        career_highest_score: c?.batting_highest_score ?? null,
        career_best_bowling: c?.bowling_best_figures ?? null,
        jersey_number: (m as { jersey_number?: number | null }).jersey_number ?? null,
        ...(financeAccess ? {
          wallet_balance: m.balance,
          total_deposited: totalDeposited,
          total_fees_paid: totalFeesPaid,
        } : {}),
        // CricHeroes stats (null = not imported yet)
        batting_runs: s?.batting_runs ?? null,
        batting_innings: s?.batting_innings ?? null,
        batting_average: s?.batting_average ?? null,
        batting_strike_rate: s?.batting_strike_rate ?? null,
        batting_highest_score: s?.batting_highest_score ?? null,
        batting_fifties: s?.batting_fifties ?? null,
        batting_hundreds: s?.batting_hundreds ?? null,
        batting_ducks: s?.batting_ducks ?? null,
        bowling_wickets: s?.bowling_wickets ?? null,
        bowling_overs: s?.bowling_overs ?? null,
        bowling_economy: s?.bowling_economy ?? null,
        bowling_average: s?.bowling_average ?? null,
        bowling_best_figures: s?.bowling_best_figures ?? null,
        bowling_five_wickets: s?.bowling_five_wickets ?? null,
        fielding_catches: s?.fielding_catches ?? null,
        fielding_stumpings: s?.fielding_stumpings ?? null,
        fielding_run_outs: s?.fielding_run_outs ?? null,
      };
    });

    // ── 2. All Matches ───────────────────────────────────────────────────────
    const allMatchesData = matches.map(m => ({
      date: m.date,
      opponent: m.opponent,
      result: m.result,
      venue: m.venue,
      our_score: m.our_score,
      opponent_score: m.opponent_score,
      match_fee: m.match_fee,
      match_type: m.match_type,
      man_of_match: m.man_of_match?.name ?? null,
      players_count: m.players?.length ?? 0,
    }));

    // ── 3. Transactions — recent 50 + club financial totals ──────────────────
    const recentTxns = [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50)
      .map(t => ({
        date: t.date,
        type: t.type,
        amount: t.amount,
        member: t.member?.name ?? null,
        description: t.description,
      }));

    const totalDepositsEver  = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
    const totalExpensesEver  = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalMatchFeesEver = transactions.filter(t => t.type === 'match_fee').reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalFunds         = members.reduce((s, m) => s + m.balance, 0);

    // ── 4. Tournaments ───────────────────────────────────────────────────────
    const tournamentsData = tournaments.map(t => ({
      name: t.name,
      status: t.status,
      result: t.result,
      our_position: t.our_position,
      format: t.format,
      start_date: t.start_date,
      end_date: t.end_date,
      venue: t.venue,
      prize_money: t.prize_money,
      entry_fee: t.entry_fee,
    }));

    // ── MOM leaderboard — who has won Man of the Match most this season ──────
    const momTally: Record<string, number> = {};
    matches.forEach(m => {
      const momName = m.man_of_match?.name;
      if (momName && m.result && m.result !== 'upcoming' && m.result !== 'cancelled') {
        momTally[momName] = (momTally[momName] || 0) + 1;
      }
    });
    const momLeaderboard = Object.entries(momTally)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, awards: count }));
    const topMOM = momLeaderboard[0];

    // ── 5. Club summary ──────────────────────────────────────────────────────
    const clubSummary = {
      totalMembers: members.length,
      activeMembers: members.filter(m => m.status === 'active').length,
      totalMatchesRecorded: allMatchesCount,
      externalMatchesCompleted: completedMatches.length,
      wins: wons,
      losses: completedMatches.filter(m => m.result === 'lost').length,
      draws: completedMatches.filter(m => m.result === 'draw').length,
      winRate: completedMatches.length > 0 ? `${Math.round(wons / completedMatches.length * 100)}%` : 'N/A',
      // Financial totals are member-only — omitted for public users
      ...(financeAccess ? {
        clubFunds: `₹${totalFunds.toLocaleString('en-IN')}`,
        totalDepositsEver: `₹${totalDepositsEver.toLocaleString('en-IN')}`,
        totalExpensesEver: `₹${totalExpensesEver.toLocaleString('en-IN')}`,
        totalMatchFeesCollected: `₹${totalMatchFeesEver.toLocaleString('en-IN')}`,
      } : {}),
      topRunScorer: topRunScorer ? `${topRunScorer.member?.name} — ${topRunScorer.batting_runs} runs (avg ${topRunScorer.batting_average})` : 'N/A',
      topWicketTaker: topWicketTaker ? `${topWicketTaker.member?.name} — ${topWicketTaker.bowling_wickets} wkts (eco ${topWicketTaker.bowling_economy})` : 'N/A',
      mvp: mvpPlayer ? `${mvpPlayer.member?.name} (${mvpPlayer.batting_runs}R · ${mvpPlayer.bowling_wickets}W)` : 'N/A',
      totalMOMAwardsThisSeason: momLeaderboard.reduce((s, x) => s + x.awards, 0),
      topMOMWinner: topMOM ? `${topMOM.name} — ${topMOM.awards} MOM award${topMOM.awards > 1 ? 's' : ''}` : 'N/A',
      tournamentsPlayed: tournamentsData.length,
    };

    // Compact scorecard summaries (only most recent 50 matches to keep prompt size sane)
    // A window again. Per-match highlights are asked about for RECENT games —
    // "what did he score last week" — while anything older is already covered
    // by seasonRecords and the career bests below, at a fraction of the size.
    const recentMatchHighlights = matchHighlights.slice(0, 40);
    // Top 30 players by season runs — covers all active SCC members
    // Scorecards name everyone who batted, so this was carrying career bests
    // for 681 players — 647 of them opposition. That was 37k tokens a question,
    // 41% of the whole payload, to answer questions nobody asks. Keep our own.
    const matchToMember = buildMatcher(members);
    const topCareerStats = playerCareerBests.filter(p => matchToMember(p.name));

    // ── MahaSangram — the internal competition, as a table ──────────────────
    const nameOf = (id: string) => members.find(x => x.id === id)?.name ?? 'Unknown';
    const SIDE = (t: string | null) =>
      t === 'brahmos' ? 'SCC Brahmos' : t === 'agni' ? 'SCC Agni' : null;
    const mahaSangram = {
      whatItIs: 'SCC\u2019s internal competition: SCC Brahmos vs SCC Agni, squads filled by auction.',
      played: maha.played,
      upcoming: maha.upcoming,
      seriesScore: maha.seriesScore,
      leader: SIDE(maha.leader),
      standings: maha.standings.map(st => ({
        side: SIDE(st.side), played: st.played, won: st.won, lost: st.lost,
        noResult: st.noResult, points: st.points,
      })),
      fixtures: maha.fixtures.map(f => ({
        date: f.date, result: f.result, winner: SIDE(f.winning_team),
      })),
    };

    // ── Challenges — the most-used feature in the app ────────────────────────
    // Members ask "who has challenged me" and "who's winning" more than they
    // ask anything else, and the chat could not answer either.
    const challengeRows = challenges.rows.map(c => ({
      title: c.title,
      status: c.status,
      metric: c.metric,
      target: c.target,
      stake: c.stake,
      pinnedToMatch: c.match_id
        ? matches.find(x => x.id === c.match_id)?.date ?? 'a fixture'
        : 'any match',
      players: (c.players ?? []).map(pl => ({
        name: nameOf(pl.member_id), accepted: pl.accepted,
      })),
      winner: c.winner_id ? nameOf(c.winner_id) : null,
    }));
    const challengeLadder = buildLadder(challenges.rows).map(r => ({
      name: nameOf(r.memberId), won: r.won, played: r.played,
      currentStreak: r.streak, bestStreak: r.bestStreak,
    }));

    // ── MahaSangram squads, with captains ───────────────────────────────────
    const mahaSquads = squads.map(sq => ({
      team: sq.name,
      captain: sq.captain,
      purse_lakh: sq.purse,
      spent_lakh: sq.spent,
      players: sq.players.map(pl => ({
        name: pl.name, price_lakh: pl.price, isCaptain: pl.isCaptain,
      })),
    }));

    // ── Who is away, and the club's real playing calendar ───────────────────
    // Names and reasons are ADMIN-ONLY, matching the availability page itself:
    // a member there sees a count, never who or why. Everyone gets the counts,
    // because "how many are around on the 7th" is a fair question for anyone.
    // An explicit shape, not a bare list. Sent as `null` for a non-admin and
    // `[]` for "nobody is away", the model cannot tell the two apart — and it
    // guessed wrong, telling an admin their own data was admin-only. `visible`
    // separates permission from emptiness; `loaded` separates both from a fetch
    // that simply hadn't returned when the question was asked.
    const awayDetail = {
      visible: isAdmin,
      loaded: !unavail.loading,
      entries: isAdmin ? unavail.rows.map(r => ({
        name: members.find(m => m.id === r.member_id)?.name ?? 'Unknown',
        from: r.from_date, to: r.to_date, reason: r.reason,
      })) : [],
    };

    const playingCalendar = groundDates.upcoming.slice(0, 60).map(b => {
      const away = unavail.awayOn(b.date);
      const free = members.filter(m => m.status === 'active' && !away.has(m.id));
      const fx = matches.find(m => m.result === 'upcoming' && m.date === b.date);
      return {
        date: b.date,
        time: b.time_slot,
        venue: b.venue,
        fixture: fx?.opponent ?? null,
        awayCount: away.size,
        freeBrahmos: free.filter(m => m.jersey_team === 'brahmos').length,
        freeAgni: free.filter(m => m.jersey_team === 'agni').length,
      };
    });

    const leagueTable = {
      name: seasonLeague.name,
      window: seasonLeague.window,
      played: seasonLeague.played.length,
      upcoming: seasonLeague.upcoming.length,
      won: seasonLeague.won, lost: seasonLeague.lost, draw: seasonLeague.draw,
      winPct: seasonLeague.winPct, points: seasonLeague.points,
      totalFixtures: seasonLeague.totalFixtures,
    };

    const answer = await generateInsight('club_chat', {
      question,
      // What the club IS — definitions the database can't hold.
      clubFacts: CLUB_FACTS,
      // Signals to the edge function whether the asker may see club finances.
      // When false, no financial data is included and the AI is instructed to
      // politely decline money/fund/balance questions.
      financeAccess,
      clubSummary,
      allMembers: allMemberProfiles,
      // One list, sent once. `chMatches` used to be this same array under a
      // second name — 12k tokens of literal duplication on every question.
      allMatches: allMatchesData,
      momLeaderboard,
      recentTransactions: financeAccess ? recentTxns : [],
      tournaments: tournamentsData,
      // ── NEW: detailed scorecard data (synced from CricHeroes per match) ──
      // Use these to answer questions about specific matches, individual
      // batting/bowling performances, season records, and player bests.
      matchHighlights: recentMatchHighlights,  // [{date, scores, best_batter, best_bowler, ...}]
      seasonRecords,                            // highest individual, best bowling, highest team total, lowest all-out
      playerCareerBests: topCareerStats,        // [{name, highest_score, best_bowling, total_runs, total_wickets}]
      // ── Season 2026-27 additions ──
      mahaSangram,                              // internal competition table + fixtures
      challenges: challengeRows,                // every challenge, who's in it, who won
      challengeLadder,                          // season-long wins/streaks
      mahaSquads,                               // both squads, captains, auction prices
      awayDetail,                               // admin only: who's away and why
      playingCalendar,                          // booked slots + who's free
      leagueTable,                              // this season's league record
      feedback: extras.feedback,                // the public feedback wall
      opponentBookings: extras.opponentBookings, // admin only: who booked us
      joinRequests: extras.joinRequests,        // admin only: who wants to join
      groundFund: extras.groundFund,            // admin only: ground contributions
      bookingTotals: extras.bookingTotals,      // pre-computed: do not re-add
    });
    return answer || 'Sorry, I could not generate a response.';
  }, [members, matches, transactions, tournaments, stats, careerStats, leaderboard,
      matchHighlights, seasonRecords, playerCareerBests, maha, challenges, squads,
      unavail, groundDates, seasonLeague, isAdmin, generateInsight, left, extras, tryQuick]);

  return { ask, tryQuick, left, limit: DAILY_LIMIT };
}
