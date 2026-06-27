/**
 * CricHeroes proxy Edge Function
 *
 * CricHeroes rebuilt their website (App Router) so match data is no longer
 * embedded in the page HTML — scraping __NEXT_DATA__ now fails. We therefore
 * read live/result data from their authenticated API (the same source the
 * daily sync uses), and fall back to the old scrape only if that fails.
 *
 * Usage:
 *   GET /functions/v1/cricheroes?matchId=25047665&type=live
 *   GET /functions/v1/cricheroes?matchId=25047665&type=scorecard
 *   GET /functions/v1/cricheroes?teamId=12345&type=team-matches
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
};

// ── CricHeroes authenticated API ───────────────────────────────────────────
// The auth token is session-based and rotates; override it without a redeploy
// by setting the CH_AUTH secret (supabase secrets set CH_AUTH=...).
const CH_API_KEY = 'cr!CkH3r0s';
const CH_AUTH = Deno.env.get('CH_AUTH') || 'db1df8c0-35c5-11f1-acbe-2f500bd24aef';
const CH_UDID = '3833274f1b23ae81b995ebfdfb7f948b';
// Teams whose feeds may contain a given match: SCC external + the two internal sides.
const FEED_TEAM_IDS = [7927431, 12538514, 12538560];

function chApiHeaders() {
  return {
    'api-key': CH_API_KEY,
    'authorization': CH_AUTH,
    'udid': CH_UDID,
    'device-type': 'Chrome: 146.0.0.0',
    'accept': 'application/json',
    'content-type': 'application/json',
    'origin': 'https://cricheroes.com',
    'referer': 'https://cricheroes.com/',
    'User-Agent': 'Mozilla/5.0',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function chApiGet(path: string): Promise<any> {
  const res = await fetch(`https://api.cricheroes.in/${path}`, { headers: chApiHeaders() });
  if (!res.ok) throw new Error(`ch-api ${path} -> ${res.status}`);
  return res.json();
}

// ── Heroes of the Match ──────────────────────────────────────────────────────
// Pulls CricHeroes' own player_of_the_match + best_performances (batting &
// bowling) + insight one-liners straight from the summary-scorecard endpoint.
async function buildHeroes(matchId: string) {
  const resp = await chApiGet(`api/v1/scorecard/get-summary-scorecard/${matchId}`);
  const d = resp?.data ?? {};
  // Strip CricHeroes' <font> markup from the insight statements.
  const insights = Array.isArray(d.insight_statements)
    ? d.insight_statements.map((s: string) => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    : [];
  return {
    player_of_the_match: d.player_of_the_match ?? null,
    best_performances: d.best_performances ?? { batting: [], bowling: [] },
    insight_statements: insights,
    match_summary: d.match_summary?.summary ?? null,
  };
}

// ── Match Insights (phases of play + turning points) ─────────────────────────
// Aggregates the ball-by-ball commentary into compact per-over rows so the
// client can build phase splits and turning-point overs without shipping every
// ball. Each over: { inning, over, team_id, runs, wickets, dots, boundaryRuns,
// legalBalls, seq[] }.
async function buildInsights(matchId: string) {
  // Authoritative innings totals + insight one-liners from the summary scorecard
  // (the ball-by-ball commentary can be incomplete on quick-scored matches, so
  // the client reconciles totals/wickets against these).
  let innTotals: Array<{ inning: number; team_id: number; team_name: string; runs: number; wickets: number; balls: number; runRate: number }> = [];
  let insightStatements: string[] = [];
  try {
    const sresp = await chApiGet(`api/v1/scorecard/get-summary-scorecard/${matchId}`);
    const sd = sresp?.data ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const tk of ['team_a', 'team_b'] as const) {
      const t = sd[tk] ?? {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const inn of (t.innings ?? [])) {
        innTotals.push({
          inning: Number(inn.inning), team_id: t.id, team_name: t.name,
          runs: Number(inn.total_run ?? 0), wickets: Number(inn.total_wicket ?? 0),
          balls: Number(inn.balls_played ?? 0),
          runRate: Number(inn.summary?.rr ?? 0),
        });
      }
    }
    insightStatements = Array.isArray(sd.insight_statements)
      ? sd.insight_statements.map((s: string) => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean)
      : [];
  } catch (_e) { /* totals optional */ }

  const resp = await chApiGet(`api/v1/scorecard/get-commentary/${matchId}`);
  const groups = resp?.data?.commentary_with_over_summary ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const balls: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const g of groups) for (const b of (g?.match_over_balls ?? [])) balls.push(b);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byOver = new Map<string, any>();
  for (const b of balls) {
    const key = `${b.inning}-${b.current_over}`;
    let o = byOver.get(key);
    if (!o) {
      o = { inning: Number(b.inning), over: Number(b.current_over), team_id: b.team_id,
            runs: 0, wickets: 0, dots: 0, boundaryRuns: 0, legalBalls: 0, seq: [] as string[] };
      byOver.set(key, o);
    }
    const run = Number(b.run ?? 0);
    const extra = Number(b.extra_run ?? 0);
    const isWide = String(b.extra_type_code ?? '').toLowerCase() === 'wd';
    const isNoball = String(b.extra_type_code ?? '').toLowerCase() === 'nb';
    o.runs += run + extra;
    if (b.is_out) o.wickets += 1;
    if (b.is_boundry) o.boundaryRuns += run;
    if (!isWide && !isNoball) o.legalBalls += 1;
    if (run === 0 && extra === 0 && !b.is_out) o.dots += 1;
    o.seq.push(b.is_out ? 'W' : isWide ? 'wd' : isNoball ? 'nb' : String(run));
  }
  // Balls come newest-first → reverse seq so each over reads chronologically.
  const overs = [...byOver.values()].map(o => ({ ...o, seq: o.seq.reverse() }))
    .sort((a, b) => a.inning - b.inning || a.over - b.over);
  return { overs, innTotals, insightStatements };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function chTeamFeed(teamId: number): Promise<any[]> {
  const ms = Date.now();
  const url = `https://api.cricheroes.in/api/v1/team/get-team-match/${teamId}?pagesize=12&teamId=${teamId}&pageno=1&datetime=${ms}`;
  const res = await fetch(url, { headers: chApiHeaders() });
  if (!res.ok) throw new Error(`team-feed ${teamId} -> ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.data ?? []);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeLive(m: any) {
  const status: 'live' | 'completed' | 'upcoming' =
    (m.status || '').toLowerCase() === 'upcoming' ? 'upcoming'
    : (m.match_result === 'Resulted' || m.winning_team_id) ? 'completed'
    : 'live';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const over = (inn: any) => (inn?.[0]?.summary?.over || '').replace(/[()]/g, '').replace('Ov', '').trim();
  return {
    matchId: String(m.match_id),
    status,
    maxOvers: m.overs ?? null,
    currentInning: m.current_inning ?? null,
    teamA: { name: m.team_a, score: m.team_a_summary || null, overs: over(m.team_a_innings), inning: m.team_a_innings?.[0]?.inning ?? null },
    teamB: { name: m.team_b, score: m.team_b_summary || null, overs: over(m.team_b_innings), inning: m.team_b_innings?.[0]?.inning ?? null },
    result: m.match_summary?.summary || (m.win_by && m.winning_team ? `${m.winning_team} won by ${m.win_by}` : ''),
    ground: m.ground_name || '',
    tossDetails: m.toss_details || '',
  };
}

// Full per-innings scorecard (batting + bowling tables) in the legacy shape the
// app's useFullScorecard / useStatSync expect: [{ teamName, inning{...},
// batting[], bowling[], extras }]. Source: scorecard/v2/get-scorecard.
async function buildScorecardArray(matchId: string) {
  const resp = await chApiGet(`api/v1/scorecard/v2/get-scorecard/${matchId}`);
  const data = resp?.data ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const innings: any[] = [];
  for (const side of ['team_a', 'team_b']) {
    const team = data[side] ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metaByNum: Record<number, any> = {};
    for (const i of (team.innings ?? [])) metaByNum[Number(i.inning)] = i;
    for (const sc of (team.scorecard ?? [])) {
      // CricHeroes returns super-over innings as strings ('3'/'4') — coerce.
      const innNum = Number(sc.inning);
      const meta = metaByNum[innNum] ?? {};
      innings.push({
        team_id: team.id,
        teamName: team.name ?? '',
        inning: {
          summary: meta.summary ?? {},
          total_run: meta.total_run, total_wicket: meta.total_wicket,
          total_extra: meta.total_extra, overs_played: meta.overs_played,
          is_allout: meta.is_allout, inning_num: innNum,
        },
        batting: sc.batting ?? [],
        bowling: sc.bowling ?? [],
        extras: sc.extras ?? {},
      });
    }
  }
  innings.sort((a, b) => (a.inning.inning_num ?? 0) - (b.inning.inning_num ?? 0));
  return innings;
}

// Find a match across the relevant team feeds and return normalized live data.
async function findLive(matchId: string) {
  for (const tid of FEED_TEAM_IDS) {
    try {
      const feed = await chTeamFeed(tid);
      const m = feed.find((x) => String(x.match_id) === String(matchId));
      if (m) return normalizeLive(m);
    } catch (_e) { /* try next team */ }
  }
  return null;
}

async function fetchNextData(chUrl: string): Promise<Record<string, unknown>> {
  const res = await fetch(chUrl, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('NO_NEXT_DATA');
  const nextData = JSON.parse(m[1]);
  return nextData?.props?.pageProps ?? {};
}

async function tryUrls(candidates: string[]): Promise<Record<string, unknown>> {
  const errors: string[] = [];
  for (const url of candidates) {
    try { return await fetchNextData(url); } catch (e) { errors.push(`${url} → ${String(e)}`); }
  }
  throw new Error(`All URLs failed:\n${errors.join('\n')}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'scorecard';
    const teamId = url.searchParams.get('teamId');
    const matchId = url.searchParams.get('matchId');

    // ── Team match list (legacy scrape; kept for callers that still use it) ───
    if (type === 'team-matches') {
      if (!teamId) return json({ error: 'teamId required for type=team-matches' }, 400);
      try {
        const feed = await chTeamFeed(Number(teamId));
        return json({ apiTeamMatches: feed });
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    if (!matchId) return json({ error: 'matchId query param required' }, 400);

    // ── Heroes of the Match (PoM, best batter/bowler, insights) ──────────────
    if (type === 'heroes') {
      try { return json({ heroes: await buildHeroes(matchId) }); }
      catch (e) { return json({ heroes: null, error: String(e) }, 200); }
    }

    // ── Match Insights (phases of play + turning-point overs) ─────────────────
    if (type === 'insights') {
      try { return json({ insights: await buildInsights(matchId) }); }
      catch (e) { return json({ insights: null, error: String(e) }, 200); }
    }

    // ── 1) Full live ball-by-ball via the CricHeroes API (mini-scorecard) ─────
    //    Returns the same shape the app's parseFromMini expects (batsmen,
    //    bowlers, recent over, partnership, both teams' innings, result).
    //    For type=scorecard we also include the full innings tables.
    try {
      const mini = await chApiGet(`api/v1/scorecard/get-mini-scorecard/${matchId}`);
      const miniScorecard = mini?.data ? { status: mini.status, data: mini.data } : null;
      let scorecard: unknown = undefined;
      if (type === 'scorecard') {
        try { scorecard = await buildScorecardArray(matchId); } catch (_e) { /* keep mini only */ }
      }
      if (miniScorecard || scorecard) return json({ miniScorecard, scorecard });
    } catch (_e) { /* fall through */ }

    // ── 2) Fallback: score line from the team-match feed ─────────────────────
    const liveFeed = await findLive(matchId);
    if (liveFeed) return json({ liveFeed });

    // ── 3) Last resort: the old website scrape (usually fails now) ───────────
    try {
      const pageProps = await tryUrls([
        `https://cricheroes.com/scorecard/${matchId}/x/x/${type}`,
        `https://cricheroes.in/scorecard/${matchId}/x/x/${type}`,
      ]);
      return json(pageProps);
    } catch (_e) {
      return json({ liveFeed: null });
    }
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
