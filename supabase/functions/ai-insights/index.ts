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
        prompt = `You are the SCC team selector. Pick the best XI for this match using AVAILABILITY as the PRIMARY filter, then quality.

═══ MATCH ═══
${data.match ? `Opponent: ${data.match.opponent || 'Internal Match'}
Venue: ${data.match.venue || 'TBD'}
Date: ${data.match.date}
Type: ${data.match.match_type}` : 'Match TBD'}

═══ SELECTION RULES (CRITICAL — follow in order) ═══
1. NEVER select players with poll_response = "unavailable". They are NOT available.
2. STRONGLY PREFER poll_response = "available" (confirmed attending).
3. For players with poll_response = "maybe" or "no_response", use last_15_matches_played as a proxy — higher = more likely to show up.
4. Weight last_15_matches_played heavily: 10+ = core regular, 5–9 = semi-regular, <5 = fringe/likely absent.
5. recent_results = their team's W/L record in matches they played (W = win, L = loss, newest first). Longer winning streaks = better form.
6. Use season stats (runs, avg, wickets, economy) ONLY for quality ranking AFTER availability filtering.
7. If a player has unavailable poll but great stats — still EXCLUDE them. No exceptions.

═══ POLL DATA SUMMARY ═══
Has poll data: ${data.has_poll_data}
Responded: ${data.poll_responded_count} players
Last N matches window: ${data.last_15_window}

═══ PLAYER POOL (sorted by availability → recent participation) ═══
Each entry: name, role, jersey, poll_response, last_15_matches_played, last_15_availability_pct, recent_results (W/L when they played), season stats
${JSON.stringify(data.players, null, 2)}

═══ OUTPUT FORMAT ═══
**Best XI** (number each player with their batting position and role):
1. [Name] — [role] — [one reason: poll/form/stats]
... (11 players)

**Bowling Attack**: List the main bowlers and their likely overs

**Squad Concerns**: Name any key players excluded (unavailable/poor form) and who fills in

**Selector's Note**: One punchy line on the team's balance and key selection call.

Keep total response under 350 words.`;
        break;

      case 'match_prediction':
        prompt = `Predict the outcome of SCC's next match using real form data and likely squad.

═══ MATCH ═══
${data.match ? `SCC vs ${data.match.opponent || 'Opponent'}
Venue: ${data.match.venue || 'TBD'} | Date: ${data.match.date}
Type: ${data.match.match_type}` : 'Match TBD'}

═══ SCC RECENT FORM (last 8 external matches, newest first) ═══
Form string: ${data.winLoss?.last8 || '—'} (W=win L=loss D=draw)
Record: ${data.winLoss?.wins || 0}W ${data.winLoss?.losses || 0}L
${JSON.stringify(data.recentForm, null, 2)}

═══ LIKELY SQUAD (poll=available OR played 3+ of last 15; excludes unavailable) ═══
Fields: name, role, poll response, recent_of_15 (last 15 matches played), season runs/avg/wickets/economy
${JSON.stringify(data.likelySquad, null, 2)}

═══ OUTPUT FORMAT ═══
**Win Probability**: SCC X% | Draw Y% | Loss Z%

**Key Match-Ups**: 2-3 specific player battles to watch (batter vs bowler angles)

**SCC Strengths**: 2 bullet points based on current form + squad

**SCC Risks**: 2 bullet points (injury absences, weak links, conditions)

**Bold Prediction**: One punchy sentence with your verdict and reasoning.

Keep total response under 300 words. Be specific — use player names from the squad.`;
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

      case 'match_report':
        prompt = `Write an exciting match report for this SCC match:

Match Details: ${JSON.stringify(data.match)}
Players: ${JSON.stringify(data.players)}
Man of Match: ${data.match?.man_of_match?.name || 'Not awarded'}

Write: (1) Punchy headline, (2) Match summary (3-4 sentences), (3) Hero of the match spotlight, (4) Key moments, (5) What this result means for SCC's journey.`;
        break;

      case 'head_to_head':
        prompt = `Analyze head-to-head between these two SCC players:

Player A: ${JSON.stringify(data.playerA)}
Player B: ${JSON.stringify(data.playerB)}

Compare: (1) Overall who has better numbers, (2) Batting comparison, (3) Fielding comparison, (4) Team contribution, (5) The verdict - who's currently SCC's more valuable player and why.`;
        break;

      case 'club_chat':
        prompt = data.question;
        systemPrompt = `You are SCC's AI assistant — an expert on Sangria Cricket Club (SCC). Answer ONLY from the data below.

IMPORTANT RULES:
- Match member names approximately/fuzzily (e.g. "Aditya Jaiswal" matches "Aaditya Jaiswal", "Shubham" could be any of the Shubhams — list all matches)
- If a stat field is null/zero for a member, it means their CricHeroes stats haven't been imported yet — say "stats not yet available"
- wallet_balance is the member's current club wallet balance; total_deposited is how much they've paid in total; total_fees_paid is match fees deducted
- Be conversational and concise (under 200 words unless the question needs more detail)
- Use actual numbers from the data, never make up stats
- For financial questions, use recentTransactions and clubFinancials
- For match history, use allMatches (internal SCC records) or chMatches (full CricHeroes history)
- For SEASON cricket stats (totals over the season), use allMembers[*].cricketStats
- For PER-MATCH stats (e.g. "what did Avinash score on May 7?"), use matchHighlights — each entry has the date, scores, best_batter and best_bowler for that match
- For PLAYER career bests this season (highest score, best bowling figures), use playerCareerBests
- For SEASON RECORDS (highest individual score, best bowling, highest team total, lowest all-out), use seasonRecords
- For MOM tally / leaderboard, use momLeaderboard
- For tournament questions, use tournaments

CLUB SUMMARY & FINANCIALS:
${JSON.stringify(data.clubSummary)}

ALL MEMBERS WITH STATS + WALLET INFO (${data.allMembers?.length} players):
${JSON.stringify(data.allMembers)}

ALL MATCHES — SCC INTERNAL RECORDS (${data.allMatches?.length} total):
${JSON.stringify(data.allMatches)}

CRICHEROES FULL MATCH HISTORY (${data.chMatches?.length ?? 0} matches, most recent first):
${JSON.stringify(data.chMatches?.slice(0, 80))}

PER-MATCH HIGHLIGHTS — best batter & best bowler from CricHeroes scorecards for the most recent ${data.matchHighlights?.length ?? 0} matches:
${JSON.stringify(data.matchHighlights)}

SEASON RECORDS (highest individual score, best bowling, highest team total, lowest all-out):
${JSON.stringify(data.seasonRecords)}

PLAYER CAREER BESTS THIS SEASON (sorted by total runs, top ${data.playerCareerBests?.length ?? 0} players):
${JSON.stringify(data.playerCareerBests)}

MOM LEADERBOARD:
${JSON.stringify(data.momLeaderboard)}

RECENT TRANSACTIONS (last 50):
${JSON.stringify(data.recentTransactions)}

TOURNAMENTS:
${JSON.stringify(data.tournaments)}`;
        break;

      default:
        return new Response(JSON.stringify({ error: 'Unknown insight type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';

    return new Response(JSON.stringify({ content, type }), {
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
