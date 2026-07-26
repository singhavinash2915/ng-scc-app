import { Link } from 'react-router-dom';
import { ArrowLeft, Radio, Youtube, Tv } from 'lucide-react';
import { useLiveStream } from '../hooks/useLiveStream';
import { LiveStreamPlayer } from '../components/LiveStreamPlayer';
import { DemoScorecard } from '../components/DemoScorecard';
import { SCC_LOGO_DATA_URL } from '../assets/sccLogo';

/**
 * Standalone watch page — /watch
 *
 * Used when a stream is live but isn't paired with a CricHeroes match id.
 * When it IS paired, the Dashboard banner sends members to /live/:chMatchId
 * instead, where the player sits directly above our live scorecard.
 */
export function Watch() {
  const { stream, videoId, isLive, loading } = useLiveStream();

  return (
    <div className="min-h-screen bg-[#070b14] text-gray-100">
      <div
        className="min-h-screen"
        style={{
          background:
            'radial-gradient(900px circle at 10% -8%, rgba(225,29,72,0.20), transparent 46%),' +
            'radial-gradient(900px circle at 100% 0%, rgba(37,99,235,0.18), transparent 44%)',
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white transition mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to app
          </Link>

          <div className="flex items-center gap-3 mb-5">
            <img src={SCC_LOGO_DATA_URL} alt="SCC" className="w-11 h-11 rounded-xl" />
            <div>
              <p className="font-display text-lg font-extrabold leading-tight">Sangria Cricket Club</p>
              <p className="text-white/50 text-xs font-semibold">Live stream</p>
            </div>
          </div>

          {loading ? (
            <p className="text-white/50 text-sm">Checking the stream…</p>
          ) : isLive && videoId ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md">
                  <Radio className="w-3 h-3 animate-pulse" /> Live
                </span>
                {stream.title && <span className="text-sm font-bold text-white truncate">{stream.title}</span>}
              </div>
              <LiveStreamPlayer videoId={videoId} title={stream.title} />

              {/* No CricHeroes match paired → show a demo scorecard so members
                  (and we, while testing) can see the full video + score layout. */}
              <div className="mt-4">
                <DemoScorecard />
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
              <Tv className="w-10 h-10 mx-auto text-white/25" />
              <p className="font-display text-lg font-extrabold mt-3">No live stream right now</p>
              <p className="text-white/55 text-sm mt-1.5">
                We go live from the ground on match days — check back then, or catch the replays on our channel. 🏏
              </p>
              {stream.channel_url && (
                <a
                  href={stream.channel_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-4 bg-rose-600 hover:bg-rose-500 transition-colors text-white font-bold text-sm rounded-full px-4 py-2.5"
                >
                  <Youtube className="w-4 h-4" /> Watch past matches
                </a>
              )}
            </div>
          )}

          {isLive && stream.channel_url && (
            <a
              href={stream.channel_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex items-center gap-2.5 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/8 transition-colors"
            >
              <Youtube className="w-5 h-5 text-rose-500 flex-shrink-0" />
              <span className="flex-1 text-sm font-semibold">Subscribe to the SCC channel</span>
              <span className="text-white/40 text-xs">Replays live here →</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
