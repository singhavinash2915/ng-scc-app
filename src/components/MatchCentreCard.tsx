import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Swords, TrendingUp, MapPin, Crown, Target, Activity, BarChart3, ChevronRight } from 'lucide-react';
import { useMatchPreview, type PreviewStatRow } from '../hooks/useMatchPreview';
import { usePredictions } from '../hooks/usePredictions';
import type { Match, Member } from '../types';

interface Props {
  nextMatch: Match;
  matches: Match[];
  members: Member[];
  cricketStats: PreviewStatRow[];
}

const Initials = ({ name, url, ring }: { name: string; url: string | null; ring: string }) =>
  url ? (
    <img src={url} alt="" className={`w-9 h-9 rounded-xl object-cover border ${ring}`} />
  ) : (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${ring} bg-white/8`}>
      <span className="text-xs font-black text-white">{name.charAt(0)}</span>
    </div>
  );

/**
 * Match Centre — a premium pre-match analytics card for the next match.
 * Head-to-head, form, venue record, win probability, key players + community pick.
 */
export function MatchCentreCard({ nextMatch, matches, members, cricketStats }: Props) {
  const { predictions } = usePredictions(nextMatch.id);
  const preview = useMatchPreview(nextMatch, matches, members, cricketStats, predictions);

  const probColor = useMemo(() => {
    const p = preview?.winProbability ?? 50;
    if (p >= 60) return { bar: 'from-emerald-400 to-teal-300', text: 'text-emerald-300' };
    if (p >= 40) return { bar: 'from-amber-400 to-yellow-300', text: 'text-amber-300' };
    return { bar: 'from-rose-400 to-red-300', text: 'text-rose-300' };
  }, [preview?.winProbability]);

  if (!preview) return null;

  const {
    opponent, isInternal, firstMeeting, played, won, lost, winRate,
    avgRunsUs, avgRunsThem, venueName, venuePlayed, venueWon, venueLost,
    form, winProbability, storyline, keyBatsman, keyBowler, predictTotal, predictForUs,
  } = preview;

  return (
    <div
      className="w-full relative overflow-hidden rounded-2xl p-5 lg:p-6 shadow-2xl"
      style={{
        background:
          'radial-gradient(700px circle at 100% 0%, rgba(139,92,246,0.28), transparent 55%), radial-gradient(600px circle at 0% 100%, rgba(16,185,129,0.20), transparent 60%), linear-gradient(180deg, #0b1020, #0a0f1a)',
      }}
    >
      <div className="absolute inset-0 border border-violet-500/25 rounded-2xl pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-violet-300" />
          <span className="text-violet-300 text-[10px] font-bold uppercase tracking-[2px]">Match Centre</span>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-[1.5px] text-white/40">Pre-match analytics</span>
      </div>

      {/* SCC vs Opponent */}
      <div className="relative flex items-center justify-center gap-4 mb-4">
        <span className="text-lg lg:text-xl font-black text-white text-right flex-1 truncate">Sangria CC</span>
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/8 border border-white/15 flex-shrink-0">
          <Swords className="w-4 h-4 text-violet-300" />
        </div>
        <span className="text-lg lg:text-xl font-black bg-gradient-to-r from-violet-300 to-emerald-300 bg-clip-text text-transparent text-left flex-1 truncate">
          {isInternal ? 'Internal' : opponent}
        </span>
      </div>

      {/* Storyline */}
      <div className="relative mb-4 rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5">
        <p className="text-[12px] lg:text-[13px] text-gray-200 leading-snug font-medium">{storyline}</p>
      </div>

      {/* Head-to-head stat row */}
      {!isInternal && (
        <div className="relative grid grid-cols-4 gap-2 mb-4">
          {[
            { v: played, l: 'Played', c: 'text-white' },
            { v: won, l: 'Won', c: 'text-emerald-300' },
            { v: lost, l: 'Lost', c: 'text-rose-300' },
            { v: firstMeeting ? '—' : `${winRate}%`, l: 'Win Rate', c: 'text-amber-300' },
          ].map(({ v, l, c }) => (
            <div key={l} className="flex flex-col items-center bg-white/5 rounded-xl py-2 border border-white/8">
              <span className={`text-xl lg:text-2xl font-black tabular-nums leading-none ${c}`}>{v}</span>
              <span className="text-gray-500 text-[8px] font-bold uppercase tracking-[1px] mt-1">{l}</span>
            </div>
          ))}
        </div>
      )}

      {/* Avg runs us vs them */}
      {!isInternal && avgRunsUs != null && avgRunsThem != null && (
        <div className="relative mb-4 flex items-center justify-between rounded-xl bg-white/5 border border-white/8 px-3.5 py-2.5">
          <div className="text-center flex-1">
            <p className="text-emerald-300 text-lg font-black tabular-nums leading-none">{avgRunsUs}</p>
            <p className="text-gray-500 text-[8px] font-bold uppercase tracking-[1px] mt-1">Our avg</p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-white/40 px-2">Avg runs</span>
          <div className="text-center flex-1">
            <p className="text-rose-300 text-lg font-black tabular-nums leading-none">{avgRunsThem}</p>
            <p className="text-gray-500 text-[8px] font-bold uppercase tracking-[1px] mt-1">Their avg</p>
          </div>
        </div>
      )}

      {/* Win probability meter */}
      <div className="relative mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-white/50 flex items-center gap-1">
            <Target className="w-3 h-3" /> Win probability
          </span>
          <span className={`text-sm font-black tabular-nums ${probColor.text}`}>{winProbability}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-white/8 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${probColor.bar} transition-[width] duration-1000 ease-out`}
            style={{ width: `${winProbability}%` }}
          />
        </div>
      </div>

      {/* Form + venue */}
      <div className="relative grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-xl bg-white/5 border border-white/8 px-3 py-2.5">
          <p className="text-gray-500 text-[8px] font-bold uppercase tracking-[1px] mb-1.5 flex items-center gap-1">
            <Activity className="w-3 h-3" /> Recent form
          </p>
          <div className="flex gap-1">
            {form.length === 0 && <span className="text-gray-500 text-xs">No data</span>}
            {form.map((f, i) => (
              <span
                key={i}
                className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                  f === 'W' ? 'bg-emerald-500/25 text-emerald-300'
                  : f === 'L' ? 'bg-rose-500/25 text-rose-300'
                  : 'bg-white/10 text-gray-300'
                }`}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/8 px-3 py-2.5">
          <p className="text-gray-500 text-[8px] font-bold uppercase tracking-[1px] mb-1.5 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> At {venueName || 'venue'}
          </p>
          {venuePlayed > 0 ? (
            <p className="text-sm font-black text-white tabular-nums">
              <span className="text-emerald-300">{venueWon}W</span>
              <span className="text-gray-500 mx-1">·</span>
              <span className="text-rose-300">{venueLost}L</span>
              <span className="text-gray-500 text-[10px] font-semibold ml-1.5">/ {venuePlayed}</span>
            </p>
          ) : (
            <p className="text-gray-500 text-xs">First time here</p>
          )}
        </div>
      </div>

      {/* Key players to watch */}
      {(keyBatsman || keyBowler) && (
        <div className="relative grid grid-cols-2 gap-2 mb-4">
          {keyBatsman && (
            <div className="rounded-xl bg-white/5 border border-white/8 px-3 py-2.5 flex items-center gap-2.5">
              <Initials name={keyBatsman.name} url={keyBatsman.avatar_url} ring="border-emerald-400/40" />
              <div className="min-w-0">
                <p className="text-emerald-300 text-[8px] font-bold uppercase tracking-[1px] flex items-center gap-1">
                  <TrendingUp className="w-2.5 h-2.5" /> Top bat
                </p>
                <p className="text-white text-xs font-black truncate leading-tight">{keyBatsman.name}</p>
                <p className="text-gray-400 text-[10px] font-semibold tabular-nums">{keyBatsman.value} {keyBatsman.label.replace(' this season', '')}</p>
              </div>
            </div>
          )}
          {keyBowler && (
            <div className="rounded-xl bg-white/5 border border-white/8 px-3 py-2.5 flex items-center gap-2.5">
              <Initials name={keyBowler.name} url={keyBowler.avatar_url} ring="border-violet-400/40" />
              <div className="min-w-0">
                <p className="text-violet-300 text-[8px] font-bold uppercase tracking-[1px] flex items-center gap-1">
                  <Crown className="w-2.5 h-2.5" /> Top bowl
                </p>
                <p className="text-white text-xs font-black truncate leading-tight">{keyBowler.name}</p>
                <p className="text-gray-400 text-[10px] font-semibold tabular-nums">{keyBowler.value} {keyBowler.label.replace(' this season', '')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Community prediction CTA */}
      <Link
        to="/predictions"
        className="relative flex items-center justify-between rounded-xl bg-violet-500/15 border border-violet-400/30 px-3.5 py-2.5 hover:bg-violet-500/25 transition-colors"
      >
        <span className="text-[12px] font-bold text-violet-100">
          {predictTotal > 0
            ? (isInternal
                ? `🎰 ${predictTotal} member${predictTotal === 1 ? '' : 's'} have predicted`
                : `🎰 ${predictForUs} of ${predictTotal} back SCC to win`)
            : '🎰 Be the first to predict this match'}
        </span>
        <ChevronRight className="w-4 h-4 text-violet-300 flex-shrink-0" />
      </Link>
    </div>
  );
}
