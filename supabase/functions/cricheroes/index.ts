/**
 * CricHeroes proxy Edge Function
 * Fetches CricHeroes scorecard pages with a proper browser User-Agent
 * and returns the structured __NEXT_DATA__ JSON.
 *
 * Usage:
 *   GET /functions/v1/cricheroes?matchId=25047665&type=scorecard
 *   GET /functions/v1/cricheroes?matchId=25047665&type=live
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url  = new URL(req.url);
    const matchId = url.searchParams.get('matchId');
    const type    = url.searchParams.get('type') || 'scorecard'; // 'live' | 'scorecard'

    if (!matchId) {
      return new Response(
        JSON.stringify({ error: 'matchId query param required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const chUrl = `https://cricheroes.com/scorecard/${matchId}/x/x/${type}`;

    const res = await fetch(chUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `CricHeroes returned ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const html = await res.text();

    // Extract __NEXT_DATA__ JSON
    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
    );

    if (!match) {
      return new Response(
        JSON.stringify({ error: 'Could not find scorecard data in response' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const nextData = JSON.parse(match[1]);
    const pageProps = nextData?.props?.pageProps ?? {};

    return new Response(
      JSON.stringify(pageProps),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
