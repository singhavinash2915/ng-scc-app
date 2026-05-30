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

    // ── Team match list (via _next/data route on cricheroes.com) ─────────────
    if (type === 'team-matches') {
      if (!teamId) {
        return new Response(
          JSON.stringify({ error: 'teamId required for type=team-matches' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Step 1: Get the current buildId by fetching any CricHeroes page
      const probeRes = await fetch(`https://cricheroes.com/team-profile/${teamId}/x/members`, { headers: BROWSER_HEADERS });
      if (!probeRes.ok) throw new Error(`CricHeroes returned ${probeRes.status}`);
      const probeHtml = await probeRes.text();
      const buildMatch = probeHtml.match(/"buildId"\s*:\s*"([^"]+)"/);
      if (!buildMatch) throw new Error('Could not extract buildId from CricHeroes');
      const buildId = buildMatch[1];

      // Step 2: Fetch ALL matches via _next/data route with large pagesize
      const teamSlug = url.searchParams.get('teamName') || 'x';
      const dataUrl = `https://cricheroes.com/_next/data/${buildId}/team-profile/${teamId}/${teamSlug}/matches.json?teamId=${teamId}&teamName=${teamSlug}&tabName=matches&pagesize=500`;

      const dataRes = await fetch(dataUrl, {
        headers: {
          ...BROWSER_HEADERS,
          'x-nextjs-data': '1',
          'Referer': `https://cricheroes.com/team-profile/${teamId}/${teamSlug}/members`,
        },
      });
      if (!dataRes.ok) throw new Error(`_next/data returned ${dataRes.status}`);
      const dataJson = await dataRes.json() as Record<string, unknown>;
      const pageProps = (dataJson as { pageProps?: Record<string, unknown> })?.pageProps ?? {};

      return new Response(JSON.stringify(pageProps), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
