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
        prompt = `Based on this match context and player availability/stats, suggest the best 11 players with roles and batting order:

Match: ${data.match?.opponent || 'TBD'} at ${data.match?.venue || 'TBD'}
Format: ${data.match?.format || 'T20'}

Available players and their stats:
${JSON.stringify(data.players, null, 2)}

Provide: (1) Best XI with roles, (2) batting order, (3) bowling lineup, (4) one-line reasoning. Be specific about players.`;
        break;

      case 'match_prediction':
        prompt = `Predict the match outcome for SCC:

Match: SCC vs ${data.match?.opponent || 'Opponent'} at ${data.match?.venue}
Date: ${data.match?.date}

SCC Recent Form: ${JSON.stringify(data.recentForm)}
Squad Stats: ${JSON.stringify(data.squadStats)}
Head-to-Head: ${JSON.stringify(data.h2h || 'No data')}

Give: (1) Win probability %, (2) Key match-ups to watch, (3) SCC's strengths/weaknesses, (4) Bold prediction with reasoning.`;
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
- If a stat field is null for a member, it means their CricHeroes stats haven't been imported yet — say "match stats not available" for that field
- Be conversational and concise (under 150 words)
- Use actual numbers from the data, never make up stats

CLUB SUMMARY:
${JSON.stringify(data.clubSummary)}

ALL MEMBERS WITH STATS (${data.allMembers?.length} players):
${JSON.stringify(data.allMembers)}

RECENT MATCHES:
${JSON.stringify(data.recentMatches?.slice(0, 15))}`;
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
