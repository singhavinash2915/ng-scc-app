/**
 * CricHeroes proxy Edge Function
 * Fetches CricHeroes pages with a proper browser User-Agent
 * and returns the structured __NEXT_DATA__ JSON.
 *
 * Usage:
 *   GET /functions/v1/cricheroes?matchId=25047665&type=scorecard
 *   GET /functions/v1/cricheroes?matchId=25047665&type=live
 *   GET /functions/v1/cricheroes?teamId=12345&type=team-matches&page=1
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

async function fetchNextData(chUrl: string): Promise<Record<string, unknown>> {
  const res = await fetch(chUrl, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('NO_NEXT_DATA');
  const nextData = JSON.parse(m[1]);
  return nextData?.props?.pageProps ?? {};
}

// Try a list of candidate URLs; return the first that succeeds
async function tryUrls(candidates: string[]): Promise<{ pageProps: Record<string, unknown>; url: string }> {
  const errors: string[] = [];
  for (const url of candidates) {
    try {
      const pageProps = await fetchNextData(url);
      return { pageProps, url };
    } catch (e) {
      errors.push(`${url} → ${String(e)}`);
    }
  }
  throw new Error(`All URLs failed:\n${errors.join('\n')}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url    = new URL(req.url);
    const type   = url.searchParams.get('type') || 'scorecard';
    const teamId = url.searchParams.get('teamId');
    const matchId = url.searchParams.get('matchId');

    // ── Team match list (via player profile — only reliable SSR source) ──────
    if (type === 'team-matches') {
      if (!teamId) {
        return new Response(
          JSON.stringify({ error: 'teamId required for type=team-matches' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Step 1: Fetch team profile to get team members & pick the first player
      const playerId = url.searchParams.get('playerId');  // optional override
      const page     = url.searchParams.get('page') || '1';
      const pageSize = url.searchParams.get('pageSize') || '12';

      if (!playerId) {
        // Fetch team profile to get member list
        const { pageProps: teamPage } = await tryUrls([
          `https://cricheroes.in/team-profile/${teamId}/matches`,
          `https://cricheroes.in/team-profile/${teamId}/x/matches`,
        ]);
        const members = teamPage?.members as { data?: { members?: { player_id: number; name: string }[] } };
        const memberList = members?.data?.members ?? [];
        if (memberList.length === 0) {
          return new Response(
            JSON.stringify({ error: 'No members found for this team', teamDetails: teamPage?.teamDetails }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        // Return the member list so the client can pick a player and call again
        return new Response(
          JSON.stringify({
            _step: 'pick-player',
            teamName: (teamPage?.teamDetails as { data?: { team_name?: string } })?.data?.team_name ?? '',
            members: memberList.map((m: { player_id: number; name: string }) => ({
              player_id: m.player_id,
              name: m.name,
            })),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Step 2: Fetch player profile page N — matches are in __NEXT_DATA__
      const paginationUrl = page === '1'
        ? `https://cricheroes.in/player-profile/${playerId}/x`
        : `https://cricheroes.in/player/get-player-match/${playerId}?pagesize=${pageSize}&pageno=${page}`;

      if (page === '1') {
        // Page 1: parse from player profile SSR
        const { pageProps } = await tryUrls([
          `https://cricheroes.in/player-profile/${playerId}/x`,
        ]);
        return new Response(
          JSON.stringify({
            _step: 'matches',
            matches: pageProps?.matches ?? {},
            playerInfo: (pageProps?.playerInfo as { data?: Record<string, unknown> })?.data ?? {},
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } else {
        // Page 2+: CricHeroes internal API (JSON response, no HTML)
        const res = await fetch(paginationUrl, { headers: BROWSER_HEADERS });
        if (!res.ok) throw new Error(`CricHeroes pagination returned ${res.status}`);
        const json = await res.json();
        return new Response(
          JSON.stringify({ _step: 'matches', matches: json }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ── Match scorecard / live ────────────────────────────────────────────────
    if (!matchId) {
      return new Response(
        JSON.stringify({ error: 'matchId query param required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { pageProps } = await tryUrls([
      `https://cricheroes.com/scorecard/${matchId}/x/x/${type}`,
      `https://cricheroes.in/scorecard/${matchId}/x/x/${type}`,
    ]);
    return new Response(JSON.stringify(pageProps), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
