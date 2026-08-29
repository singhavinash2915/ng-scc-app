import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured. Please add ANTHROPIC_API_KEY to Supabase Edge Function secrets.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { type, data } = await req.json();
    const client = new Anthropic({ apiKey });

    let prompt = '';
    let systemPrompt = 'You are an expert cricket analyst and sports psychologist for SCC (Sangria Cricket Club). Be concise, enthusiastic, and insightful. Use cricket terminology naturally. Keep responses under 200 words unless asked for more.';

    switch (type) {
      case 'squad_selector':
        if (Array.isArray(data.preSelectedSquad) && data.preSelectedSquad.length > 0) {
          // ── MODE A: a squad has already been picked — analyse expected performance ──
          prompt = `You are the SCC team analyst. A squad has ALREADY been selected for this match. Your job is NOT to pick a new XI — your job is to predict how THIS specific squad will perform and give tactical advice.

═══ MATCH ═══
${data.match ? `Opponent: ${data.match.opponent || 'Internal Match'}
Venue: ${data.match.venue || 'TBD'}
Date: ${data.match.date}
Type: ${data.match.match_type}` : 'Match TBD'}

═══ SELECTED SQUAD (${data.preSelectedSquad.length} players) ═══
${JSON.stringify(data.preSelectedSquad, null, 2)}

═══ HOW TO READ THE DATA ═══
- ch_runs / ch_avg / ch_sr / ch_hs / ch_fifties = season batting stats
- ch_wickets / ch_economy / ch_best = season bowling stats
- ch_catches = fielding catches
- last_10_selected = how often this player is picked recently (consistency)
- team (if present) = internal-match team (dhurandars / bazigars)

═══ OUTPUT FORMAT ═══
Write a tight match-day analysis using ONLY the selected squad above. Do NOT mention any player not in the squad.

**Squad Strength Score** — rate the squad x/10 with a one-line reason.

**Top match-winners** — pick the 2-3 players from this squad most likely to win the match. Cite their actual stats (runs/wkts/avg/eco).

**Batting plan** — Suggested top 3 batters from the squad based on ch_runs + ch_avg + ch_sr. ${data.match?.match_type === 'internal' ? 'For internal matches, list per team if team field is present.' : ''}

**Bowling attack** — Main wicket-takers from the squad and economy bowlers.

**Areas of concern** — Any imbalance in the squad (e.g. too few bowlers, no wicket-keeper, missing all-rounder).

**Match call** — One punchy sentence predicting how this squad performs vs ${data.match?.opponent || 'the opponent'}.

⚠️ STRICT RULES:
- Use ONLY the squad listed above. Do NOT recommend other players.
- Use ONLY the stats provided. Do NOT invent numbers.
- Keep total under 280 words.`;
        } else {
          // ── MODE B: no squad yet — recommend a best XI (original behaviour) ──
          prompt = `You are the SCC team selector. No squad has been picked yet for this match — recommend the best XI using recent selection history and CricHeroes performance stats.

═══ MATCH ═══
${data.match ? `Opponent: ${data.match.opponent || 'Internal Match'}
Venue: ${data.match.venue || 'TBD'}
Date: ${data.match.date}
Type: ${data.match.match_type}` : 'Match TBD'}

═══ HOW TO READ THE DATA ═══
- last_10_selected = how many of the last ${data.last_10_window} matches this player was actually in the squad
  · 8–10 = core regular (very likely available)
  · 5–7 = semi-regular (usually available)
  · 1–4 = fringe (uncertain)
  · NOT in list = 0 appearances = excluded (do not pick them)
- recent_form = team W/L results in matches they were selected (newest first)
- ch_* fields = CricHeroes season stats (runs, avg, wickets, economy, etc.)
- Squad is managed via WhatsApp — everyone in this list was selected at least once recently

═══ SELECTION RULES ═══
1. Prefer players with higher last_10_selected — they are the ones consistently showing up
2. Use ch_runs / ch_avg / ch_wickets / ch_economy to rank players of equal availability
3. Balance the XI: aim for 4–5 batters, 1 WK, 2 all-rounders, 3–4 bowlers
4. For internal matches (Dhurandars vs Bazigars), note the team split if relevant

═══ PLAYER POOL — ${data.total_in_pool} players (sorted by recent selection frequency) ═══
${JSON.stringify(data.players, null, 2)}

═══ OUTPUT FORMAT ═══
**Best XI** (numbered, with batting position and role):
1. [Name] — [role] — [why selected: form/stats]
... (11 players)

**Bowling Attack**: Main bowlers and expected overs split

**Bench / Concerns**: Anyone on the fringe worth noting

**Selector's Note**: One punchy line on team balance and the key selection call.

Keep total under 350 words.`;
        }
        break;

      case 'match_prediction':
        prompt = `Predict the outcome of SCC's next match using recent form and the likely squad.

═══ MATCH ═══
${data.match ? `SCC vs ${data.match.opponent || 'Opponent'}
Venue: ${data.match.venue || 'TBD'} | Date: ${data.match.date}
Type: ${data.match.match_type}` : 'Match TBD'}

═══ SCC RECENT FORM (last 8 external matches, newest first) ═══
Form string: ${data.winLoss?.last8 || '—'} (W=win L=loss D=draw)
Record: ${data.winLoss?.wins || 0}W ${data.winLoss?.losses || 0}L
${JSON.stringify(data.recentForm, null, 2)}

═══ LIKELY SQUAD (players selected in 3+ of last 10 matches, with CricHeroes stats) ═══
Fields: name, role, last_10_selected, ch_runs, ch_avg, ch_wickets, ch_economy
${JSON.stringify(data.likelySquad, null, 2)}

═══ OUTPUT FORMAT ═══
**Win Probability**: SCC X% | Draw Y% | Loss Z%

**Key Match-Ups**: 2–3 specific player battles to watch

**SCC Strengths**: 2 bullet points based on current form + squad

**SCC Risks**: 2 bullet points (weak links, conditions, thin bench)

**Bold Prediction**: One punchy sentence with your verdict.

Keep total under 300 words. Use actual player names from the squad.`;
        break;

      case 'cricket_dna':
        prompt = `Analyze this cricket player's DNA and create their unique cricket identity:

Player: ${data.member?.name}
Stats: ${JSON.stringify(data.stats)}
Matches Played: ${data.member?.matches_played}

Create a fun, insightful cricket identity with:
1. "Cricket DNA Type" (e.g., "Aggressive Opener", "Death Bowler", "Anchor Batsman", "All-Round Warrior")
2. "Signature Move" (their standout skill)
3. "Cricket Personality" (1 emoji + fun label like "🔥 The Wall", "⚡ Storm Bringer")
4. "Strengths" (2-3 bullet points)
5. "Level Up" (1 area to improve)
6. "Cricket Wisdom" (a motivational one-liner tailored to their style)
7. "Comparable Legend" (which cricket legend they play like and why)

Keep it fun, positive, and specific to their actual numbers.`;
        break;

      case 'leaderboard_commentary':
        prompt = `Create exciting season leaderboard commentary for SCC:

Season Standings: ${JSON.stringify(data.leaderboard)}
Season Summary: ${data.summary}

Write: (1) A dramatic season headline, (2) Top performer spotlight (2-3 sentences each for top 3), (3) Most improved player, (4) Fun stat of the season, (5) Season verdict in one punchy sentence.`;
        break;

      case 'form_tracker':
        prompt = `Analyze this player's recent form and provide insights:

Player: ${data.member?.name}
Last 5 matches performance: ${JSON.stringify(data.recentMatches)}
Overall stats: ${JSON.stringify(data.stats)}
Career average: ${data.careerAverage}

Provide: (1) Current form rating (Poor/Average/Good/Excellent/Peak), (2) Form trend (Rising/Steady/Declining), (3) What's working, (4) What to watch out for, (5) Form prediction for next match.`;
        break;

      case 'training_recommendations':
        prompt = `Based on this player's stats, provide personalized training recommendations:

Player: ${data.member?.name}
Stats: ${JSON.stringify(data.stats)}
Weaknesses identified: ${JSON.stringify(data.weaknesses)}

Suggest: (1) Top 3 priority training areas, (2) Specific drills for each, (3) Mental game tips, (4) Weekly training schedule suggestion, (5) Short-term goal (next 5 matches).`;
        break;

      case 'match_report': {
        // Find the MOM's actual contribution from the scorecard.
        // This is what was missing before — Claude was guessing batting vs bowling.
        const momName: string | null = data.match?.man_of_match ?? null;
        const sc = data.scorecard;
        const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

        // Safety: build the set of CONFIRMED SCC player names (anyone in the
        // selected squad / players list). The AI MUST NOT praise anyone not
        // in this set — this prevents opposition players being attributed to
        // SCC even if the client sends bad scorecard data.
        const sccRosterNorm = new Set<string>();
        if (Array.isArray(data.players)) {
          for (const p of data.players) {
            const n = norm((p as { name?: string }).name || '');
            if (n) sccRosterNorm.add(n);
          }
        }
        const isOnSccRoster = (name: string) => {
          const n = norm(name);
          if (!n) return false;
          if (sccRosterNorm.size === 0) return true; // no roster passed — trust scorecard
          for (const r of sccRosterNorm) {
            if (r === n || r.includes(n) || n.includes(r)) return true;
          }
          return false;
        };

        let momBatLine = '';
        let momBowlLine = '';
        let momRole = 'unknown';
        if (momName && sc) {
          const nm = norm(momName);
          const bat = (sc.sccBatting || []).find((b: Record<string, unknown>) =>
            norm((b.name as string) || '').includes(nm) || nm.includes(norm((b.name as string) || ''))
          );
          const bowl = (sc.sccBowling || []).find((b: Record<string, unknown>) =>
            norm((b.name as string) || '').includes(nm) || nm.includes(norm((b.name as string) || ''))
          );
          if (bat) momBatLine = `${bat.runs} runs off ${bat.balls} balls (${bat['4s'] || 0} fours, ${bat['6s'] || 0} sixes${bat.how_to_out ? ', ' + bat.how_to_out : ', not out'})`;
          if (bowl && Number(bowl.wickets) > 0) momBowlLine = `${bowl.wickets}/${bowl.runs} in ${bowl.overs}${bowl.balls ? '.' + bowl.balls : ''} overs (econ ${bowl.economy_rate || '?'})`;
          if (momBatLine && momBowlLine) momRole = 'all-rounder';
          else if (momBowlLine) momRole = 'bowler';
          else if (momBatLine) momRole = 'batter';
        }

        // Top 3 batters + top 3 wicket-takers for SCC in this match (for "Key moments")
        // ⚠️ Filter through the SCC roster check to eliminate any opposition
        // players that might have slipped into the scorecard arrays.
        const topBatters = (sc?.sccBatting || [])
          .filter((b: Record<string, unknown>) => Number(b.balls) > 0 && isOnSccRoster((b.name as string) || ''))
          .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.runs) - Number(a.runs))
          .slice(0, 3)
          .map((b: Record<string, unknown>) => `${b.name}: ${b.runs}(${b.balls})`);
        const topBowlers = (sc?.sccBowling || [])
          .filter((b: Record<string, unknown>) => Number(b.wickets) > 0 && isOnSccRoster((b.name as string) || ''))
          .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.wickets) - Number(a.wickets))
          .slice(0, 3)
          .map((b: Record<string, unknown>) => `${b.name}: ${b.wickets}/${b.runs}`);

        prompt = `Write an exciting cricket match report for this SCC match.

⚠️ STRICT RULES — follow these exactly:
1. Use ONLY the facts provided below. Do NOT invent stats, scores, or performances.
2. When describing the Man of the Match, base it ONLY on the figures listed below. If MOM is a "bowler", praise the bowling spell — do NOT praise their batting unless batting figures are also listed. Vice versa for batter.
3. If a player isn't mentioned in the figures, do NOT name them.
4. Keep it tight: ≤ 200 words total.

────────────────────────────
MATCH FACTS:
- Opponent: ${data.match?.opponent ?? 'Unknown'}
- Venue: ${data.match?.venue ?? 'Unknown'}
- Date: ${data.match?.date ?? 'Unknown'}
- Result: SCC ${data.match?.result ?? '?'}
- SCC score: ${data.match?.our_score ?? sc?.sccTotal + '/' + sc?.sccWkts ?? '?'}
- Opponent score: ${data.match?.opponent_score ?? sc?.oppTotal + '/' + sc?.oppWkts ?? '?'}

MAN OF THE MATCH: ${momName ?? 'Not awarded'}
- Role in this match: ${momRole}
- Batting figures: ${momBatLine || '(did not bat / no significant batting contribution)'}
- Bowling figures: ${momBowlLine || '(did not bowl / no wickets)'}

TOP SCC BATTERS THIS MATCH: ${topBatters.length ? topBatters.join(', ') : '(no data)'}
TOP SCC WICKET-TAKERS: ${topBowlers.length ? topBowlers.join(', ') : '(no data)'}
────────────────────────────

Write the report with these sections (markdown headers ok):
1. **Punchy headline** (≤ 10 words)
2. **Match summary** (2-3 sentences using ONLY the scores above)
3. **Hero of the match** — explain why ${momName ?? 'the MOM'} won, citing ONLY the figures above. If they won for bowling, describe the bowling spell. If batting, the batting innings. If all-round, both. Do not invent extra details.
4. **Key moments** (1-2 bullet points, from the top performers list above)
5. **What this means for SCC** (1 sentence on momentum/season journey)`;
        break;
      }

      case 'head_to_head':
        prompt = `Analyze head-to-head between these two SCC players:

Player A: ${JSON.stringify(data.playerA)}
Player B: ${JSON.stringify(data.playerB)}

Compare: (1) Overall who has better numbers, (2) Batting comparison, (3) Fielding comparison, (4) Team contribution, (5) The verdict - who's currently SCC's more valuable player and why.`;
        break;

      case 'club_chat': {
        prompt = data.question;
        // Club finances are member-only. When the asker isn't a member the
        // client strips all financial data from the payload; we ALSO instruct
        // the model to decline money questions so it never guesses/hallucinates.
        const financeAccess = data.financeAccess !== false;
        const financeRule = financeAccess
          ? `- wallet_balance is the member's current club wallet balance; total_deposited is how much they've paid in total; total_fees_paid is match fees deducted
- For financial questions, use recentTransactions and clubFinancials`
          : `- FINANCES ARE PRIVATE: This user is not a logged-in member. You must NOT reveal or estimate any money figures — club funds, wallet balances, deposits, expenses, match fees, or transactions. If asked anything about money/funds/balances/payments, politely reply that financial details are visible to club members only and suggest they sign in on the app with their phone number (the one the club holds for them — there is no password or PIN). Never guess amounts.`;
        // Club knowledge travels with the request. It lives in one place
        // (src/lib/clubFacts.ts) rather than being duplicated here, where the
        // two copies would drift and the model would confidently state the
        // stale one. Older clients that don't send it simply get the data-only
        // prompt they had before.
        const clubFacts = typeof data.clubFacts === 'string' && data.clubFacts.length
          ? `\n${data.clubFacts}\n`
          : '';
        systemPrompt = `You are SCC's AI assistant — an expert on Sangria Cricket Club (SCC). Answer ONLY from the club knowledge and data below.
${clubFacts}

IMPORTANT RULES:
- You are given only the data sections relevant to this question. If answering needs something that is not present below, say plainly that you don't have it to hand and suggest they ask more specifically (e.g. name the player, the match or the month) — do NOT guess, and do not claim the club has no such data
- Match member names approximately/fuzzily (e.g. "Aditya Jaiswal" matches "Aaditya Jaiswal", "Shubham" could be any of the Shubhams — list all matches)
- If a stat field is null/zero for a member, it means their CricHeroes stats haven't been imported yet — say "stats not yet available"
${financeRule}
- Be conversational and concise (under 200 words unless the question needs more detail)
- Use actual numbers from the data, never make up stats
- For match history use allMatches — it is the COMPLETE list of every match the club has played, not a sample
- For THIS SEASON's cricket stats use allMembers[*] batting_/bowling_ fields; for ALL-TIME or CAREER totals use the career_* fields (career_runs, career_wickets, career_matches, career_highest_score, career_best_bowling). NEVER present a season figure as all-time or vice versa — say which one you are quoting
- For PER-MATCH stats (e.g. "what did Avinash score on May 7?"), use matchHighlights — the 40 most recent matches, each with date, scores, best_batter and best_bowler. For older matches use seasonRecords and playerCareerBests, and say you only hold per-ball detail for recent games
- For PLAYER career bests (highest score, best bowling figures), use playerCareerBests — SCC members only; you do not hold career records for opposition players
- For SEASON RECORDS (highest individual score, best bowling, highest team total, lowest all-out), use seasonRecords
- For MOM tally / leaderboard, use momLeaderboard
- For tournament questions, use tournaments
- For MAHASANGRAM / Brahmos vs Agni / the internal competition, use mahaSangram (table, series score, fixtures). A member's side and shirt number are on allMembers[*].mahasangram_side and jersey_number
- For CHALLENGES ("who challenged me", "what challenges are running", "who's winning"), use challenges; for the season-long wins/streaks table use challengeLadder
- For CAPTAINS and SQUADS of SCC Brahmos / SCC Agni, use mahaSquads — it has each team's captain, its full auctioned squad and what each player cost in the auction (in ₹ lakh)
- For "when do we play next", "is there a match on X", "which dates are free", use playingCalendar — these are the BOOKED GROUND SLOTS, which is the club's real calendar; a slot with fixture: null is booked with no opponent arranged yet
- For "who is away" / "who's travelling": use awayDetail. If awayDetail.visible is FALSE, do not name anyone or guess reasons — give the COUNTS from playingCalendar (awayCount, freeBrahmos, freeAgni) and say names are visible to club admins. If visible is TRUE, name them freely from awayDetail.entries — the asker is an admin. An EMPTY entries list with visible TRUE means nobody has blocked any dates; say exactly that, never that the data is restricted. If awayDetail.loaded is false, say the availability data is still loading rather than reporting nobody is away
- For this season's league record, use leagueTable
- For FEEDBACK members have left (and admin replies), use feedback — this is the club's public feedback wall
- For any TOTAL of opponent booking money, use bookingTotals — grandTotal and byTeam are already computed. Do NOT add the amounts in opponentBookings yourself; quote the computed figure. Team names in that list contain typos of each other ("GritForce"/"GrtiForce"), which the totals already merge
- opponentBookings, joinRequests and groundFund are ADMIN-ONLY and arrive as null for everyone else. If null, say that detail is visible to club admins; never guess at it. Contact names and phone numbers are deliberately not included even for admins — point them at the Bookings page for those
- The club knowledge above explains what these competitions ARE. Use it for "what is X" questions and never guess at a definition it doesn't cover

${[
  ['CLUB SUMMARY & FINANCIALS', data.clubSummary],
  [`ALL MEMBERS (${data.allMembers?.length ?? 0})`, data.allMembers],
  [`ALL MATCHES — every fixture on record (${data.allMatches?.length ?? 0})`, data.allMatches],
  [`PER-MATCH HIGHLIGHTS — best batter & bowler, ${data.matchHighlights?.length ?? 0} most recent matches`, data.matchHighlights],
  ['SEASON RECORDS', data.seasonRecords],
  ['PLAYER CAREER BESTS (SCC members only)', data.playerCareerBests],
  ['MOM LEADERBOARD', data.momLeaderboard],
  ['RECENT TRANSACTIONS (last 50)', data.recentTransactions],
  ['TOURNAMENTS', data.tournaments],
  ['SCC MAHASANGRAM — the internal Brahmos vs Agni competition', data.mahaSangram],
  ['CHALLENGES — member-vs-member contests', data.challenges],
  ['CHALLENGE SEASON LADDER', data.challengeLadder],
  ['MAHASANGRAM SQUADS — captains and auctioned players (₹ lakh)', data.mahaSquads],
  ['PLAYING CALENDAR — booked ground slots, with who is free on each', data.playingCalendar],
  ['WHO IS AWAY (visible=false means the asker is not an admin)', data.awayDetail],
  ['SEASON LEAGUE RECORD', data.leagueTable],
  ['FEEDBACK WALL', data.feedback],
  ['OPPONENT BOOKINGS (admin only)', data.opponentBookings],
  ['BOOKING TOTALS — already added up; quote these, do not re-add', data.bookingTotals],
  ['JOIN REQUESTS (admin only)', data.joinRequests],
  ['GROUND FUND CONTRIBUTIONS (admin only)', data.groundFund],
]
  // Sections the client did not send are OMITTED, not printed as "undefined".
  // The client routes each question to the data it needs, so an absent section
  // means "not relevant to this question" — see the note below about saying so.
  .filter(([, v]) => v !== undefined && v !== null)
  .map(([label, v]) => `${label}:\n${JSON.stringify(v)}`)
  .join('\n\n')}`;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown insight type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const message = await client.messages.create({
      // Haiku 4.5: $1/$5 per MTok against Sonnet 4.5's $3/$15. These are lookups
      // over structured data the prompt already contains, not reasoning tasks —
      // the payload does the work, and paying three times the rate to read it
      // back was the expensive half of a bill that ran out.
      model: 'claude-haiku-4-5',
      // 1024 truncated longer answers mid-sentence — a match report or a squad
      // rationale runs past it. Chat replies are held short by the prompt, not
      // by the ceiling.
      max_tokens: 4096,
      // The club data is now the whole archive rather than a window, which
      // makes the system prompt large and almost entirely identical between
      // questions. Caching it means the second and later questions in a
      // sitting are billed at a tenth of the rate for the shared part; without
      // it, sending everything would multiply the cost of every question.
      // The 5-minute default, deliberately, not the 1-hour TTL. A 1h write
      // costs 2x base against 1.25x, and needs three reads to pay for itself.
      // This page sees a handful of sessions a week, most of them one or two
      // questions — so the long TTL would have made the common case 60% dearer
      // while trying to make it cheaper. At 5 minutes the break-even is two
      // questions, which a single sitting usually clears.
      system: [{ type: 'text', text: systemPrompt,
                 cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
    });
    // Surfaced in the function logs so cache behaviour is checkable rather
    // than assumed — a stray timestamp anywhere in the prompt would silently
    // drop the hit rate to zero and nothing else would show it.
    console.log('usage', JSON.stringify(message.usage));

    const content = message.content[0].type === 'text' ? message.content[0].text : '';

    // usage travels back so cache behaviour and cost are observable from the
    // client. A stray timestamp in the prompt would drop cache hits to zero
    // and nothing else in the app would show it.
    return new Response(JSON.stringify({ content, type, usage: message.usage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI insight error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate insight' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
