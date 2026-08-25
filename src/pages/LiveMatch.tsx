import { useMemo , useState} from 'react';
import { Card } from '../components/ui/Card';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, Radio, EyeOff } from 'lucide-react';
import { useMatches } from '../hooks/useMatches';
import { useLiveScore } from '../hooks/useLiveScore';
import { useLiveStream } from '../hooks/useLiveStream';
import { LiveScorecard } from '../components/LiveScorecard';
import { LiveStreamPlayer } from '../components/LiveStreamPlayer';
import { LiveAddons } from '../components/LiveAddons';
import { SCC_LOGO_DATA_URL } from '../assets/sccLogo';
import { APP_URL, CLUB_NAME, GET_APP_CTA, INSTAGRAM } from '../data/appMeta';

/**
 * Standalone, shareable public live-score page — /live/:chMatchId
 *
 * Designed to be dropped into WhatsApp cricket groups: "📺 Follow SCC LIVE 👈".
 * No login, no app chrome — just a branded live scorecard that anyone can open
 * in a browser, plus a "get this for your club" hook at the bottom.
 *
 * The :chMatchId param is the CricHeroes match id (so the link is shareable
 * without a DB lookup); we still try to enrich it with opponent/venue/date
 * from our own matches table when available.
 */
export function LiveMatch() {
  // ── Spoiler guard ─────────────────────────────────────────────────────────
  // YouTube live runs roughly 20-30 seconds behind the ground. Our scorecard
  // does not — so a viewer sees "WICKET" in the score before the ball reaches
  // the video, which is the one thing that makes a stream not worth watching.
  //
  // Hidden by default while a stream is playing, and the choice is remembered:
  // asking someone the same question every over is its own kind of annoying.
  const [showScore, setShowScore] = useState(
    () => localStorage.getItem('scc-live-show-score') === '1',
  );
  const revealScore = (v: boolean) => {
    setShowScore(v);
    localStorage.setItem('scc-live-show-score', v ? '1' : '0');
  };
  const { chMatchId } = useParams<{ chMatchId: string }>();
  const { matches } = useMatches();

  const match = useMemo(
    () => matches.find(m => String(m.ch_match_id) === String(chMatchId)),
    [matches, chMatchId],
  );

  const { data, loading, error, countdown, refetch } = useLiveScore(chMatchId);
  const isOver = !!data?.result;

  // Live YouTube stream — show it here when it's for THIS match (or when the
  // admin hasn't paired it with a specific CricHeroes id).
  const { stream, videoId: streamVideoId, isLive: streamIsLive } = useLiveStream();
  const showStream = streamIsLive
    && (!stream.ch_match_id || String(stream.ch_match_id) === String(chMatchId));
  // Only guard spoilers when there is actually a video to be behind.
  const watching = showStream && !!streamVideoId;

  return (
    <div className="dark min-h-screen bg-[#070b14] text-gray-100">
      <div
        className="min-h-screen"
        style={{
          background:
            'radial-gradient(900px circle at 10% -8%, rgba(16,185,129,0.20), transparent 46%),' +
            'radial-gradient(900px circle at 100% 0%, rgba(37,99,235,0.18), transparent 44%)',
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
          {/* Header */}
          <Link to="/" className="flex items-center gap-3 mb-5">
            <img src={SCC_LOGO_DATA_URL} alt="SCC" className="w-11 h-11 r-card object-cover" />
            <div className="flex-1">
              <h1 className="text-lg font-extrabold leading-tight">{CLUB_NAME}</h1>
              <p className="t-meta text-gray-400">Live Match Centre</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full t-meta font-bold bg-red-500/15 text-red-300 border border-red-500/30">
              <Radio className={`w-3 h-3 ${isOver ? '' : 'animate-pulse'}`} />
              {isOver ? 'FULL TIME' : 'LIVE'}
            </span>
          </Link>

          {/* Live video stream — shown above the scorecard when we're streaming
              this match (paired by CricHeroes id, or a stream with no pairing). */}
          {showStream && streamVideoId && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 bg-rose-600 text-white t-micro font-black uppercase tracking-widest px-2.5 py-1 r-card">
                  <Radio className="w-3 h-3 animate-pulse" /> Live stream
                </span>
                {stream.title && <span className="text-xs font-bold text-gray-300 truncate">{stream.title}</span>}
              </div>
              <LiveStreamPlayer videoId={streamVideoId} title={stream.title} />
              <div className="mt-3">
                <LiveAddons videoId={streamVideoId} matchId={match?.id ?? null} />
              </div>
            </div>
          )}

          {/* Live scorecard — behind a spoiler guard while the stream plays. */}
          {watching && !showScore && (
            <button onClick={() => revealScore(true)}
              className="w-full mb-5 p-4 r-card border border-white/10 bg-white/5 text-left">
              <p className="font-black text-white inline-flex items-center gap-2">
                <EyeOff className="w-4 h-4" /> Score hidden
              </p>
              <p className="t-meta text-gray-400 mt-0.5">
                The stream runs about 30 seconds behind the ground. Tap to show the
                live score anyway — you'll see wickets before they reach the video.
              </p>
            </button>
          )}
          {watching && showScore && (
            <button onClick={() => revealScore(false)}
              className="t-meta font-bold text-gray-400 inline-flex items-center gap-1.5 mb-2">
              <EyeOff className="w-3.5 h-3.5" /> Hide score (avoid spoilers)
            </button>
          )}

          {chMatchId && (!watching || showScore) ? (
            <LiveScorecard
              data={data}
              loading={loading}
              error={error}
              countdown={countdown}
              refetch={refetch}
              chMatchId={chMatchId}
              matchOpponent={match?.opponent}
              matchVenue={match?.venue}
              matchDate={match?.date}
            />
          ) : !chMatchId ? (
            <p className="text-center text-gray-400 py-12">No match specified.</p>
          ) : null}

          {/* Growth CTA — the hook for other clubs */}
          <Card className="mt-6 p-5 bg-gradient-to-br from-violet-600/90 via-blue-600/80 to-[#0a1019] border-white/10">
            <p className="text-sm font-extrabold text-white">
              📱 This is our own club app — live ball-by-ball, stats, predictions &amp; more.
            </p>
            <p className="text-sm font-black text-emerald-200 mt-1">
              {GET_APP_CTA} <span className="underline">{APP_URL}</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 r-card bg-white text-gray-900 text-sm font-bold hover:bg-gray-100 transition"
              >
                Explore the app <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="/book-match"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 r-card bg-white/10 text-white text-sm font-bold border border-white/15 hover:bg-white/15 transition"
              >
                🏏 Book a match vs SCC
              </a>
            </div>
            <p className="t-meta text-white/60 mt-3">📲 {INSTAGRAM}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
