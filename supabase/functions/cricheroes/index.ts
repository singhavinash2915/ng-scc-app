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

    // ── Team match list ───────────────────────────────────────────────────────
    if (type === 'team-matches') {
      if (!teamId) {
        return new Response(
          JSON.stringify({ error: 'teamId required for type=team-matches' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const page = url.searchParams.get('page') || '1';
      const pq   = `?page=${page}`;

      // CricHeroes team profile URL patterns to try in order.
      // The slug after the team ID is optional / varies, so we try several.
      const candidates = [
        `https://cricheroes.in/team-profile/${teamId}/x/x/matches${pq}`,
        `https://cricheroes.in/team-profile/${teamId}/x/matches${pq}`,
        `https://cricheroes.in/team-profile/${teamId}/matches${pq}`,
        `https://cricheroes.com/team-profile/${teamId}/x/x/matches${pq}`,
        `https://cricheroes.com/team-profile/${teamId}/x/matches${pq}`,
        // Also try without /matches — the team profile page may include recent matches
        `https://cricheroes.in/team-profile/${teamId}/x/x${pq}`,
        `https://cricheroes.in/team-profile/${teamId}${pq}`,
      ];

      const { pageProps, url: succeededUrl } = await tryUrls(candidates);
      return new Response(
        JSON.stringify({ ...pageProps, _succeededUrl: succeededUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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
