import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, Radio } from 'lucide-react';
import { useMatches } from '../hooks/useMatches';
import { useLiveScore } from '../hooks/useLiveScore';
import { LiveScorecard } from '../components/LiveScorecard';
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
  const { chMatchId } = useParams<{ chMatchId: string }>();
  const { matches } = useMatches();

  const match = useMemo(
    () => matches.find(m => String(m.ch_match_id) === String(chMatchId)),
    [matches, chMatchId],
  );

  const { data, loading, error, countdown, refetch } = useLiveScore(chMatchId);
  const isOver = !!data?.result;

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
            <img src={SCC_LOGO_DATA_URL} alt="SCC" className="w-11 h-11 rounded-xl object-cover" />
            <div className="flex-1">
              <h1 className="text-lg font-extrabold leading-tight">{CLUB_NAME}</h1>
              <p className="text-[11px] text-gray-400">Live Match Centre</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/15 text-red-300 border border-red-500/30">
              <Radio className={`w-3 h-3 ${isOver ? '' : 'animate-pulse'}`} />
              {isOver ? 'FULL TIME' : 'LIVE'}
            </span>
          </Link>

          {/* Live scorecard */}
          {chMatchId ? (
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
          ) : (
            <p className="text-center text-gray-400 py-12">No match specified.</p>
          )}

          {/* Growth CTA — the hook for other clubs */}
          <div className="mt-6 rounded-2xl p-5 bg-gradient-to-br from-violet-600/90 via-blue-600/80 to-[#0a1019] border border-white/10">
            <p className="text-sm font-extrabold text-white">
              📱 This is our own club app — live ball-by-ball, stats, predictions &amp; more.
            </p>
            <p className="text-sm font-black text-emerald-200 mt-1">
              {GET_APP_CTA} <span className="underline">{APP_URL}</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-gray-900 text-sm font-bold hover:bg-gray-100 transition"
              >
                Explore the app <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="/book-match"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 text-white text-sm font-bold border border-white/15 hover:bg-white/15 transition"
              >
                🏏 Book a match vs SCC
              </a>
            </div>
            <p className="text-[11px] text-white/60 mt-3">📲 {INSTAGRAM}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
