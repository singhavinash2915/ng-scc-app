import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Calendar, Check, X, ArrowRight } from 'lucide-react';
import { useMatches } from '../hooks/useMatches';
import { useMembers } from '../hooks/useMembers';
import { useMatchPolls } from '../hooks/useMatchPolls';
import { useGroundDates } from '../hooks/useGroundDates';
import { useMe } from '../context/MemberContext';
import { SignInCard } from '../components/SignInCard';
import { SCC_LOGO_DATA_URL } from '../assets/sccLogo';
import { matchTimeLabel } from '../lib/matchTime';

// ─── Squad confirmation ───────────────────────────────────────────────────────
// The screen a WhatsApp tap lands on, and the reason the loop closes.
//
// Deliberately NOT the existing /poll/:matchId page, which is 516 lines and a
// whole product. Someone arriving from the group is holding a phone, standing
// somewhere, and has about fifteen seconds of patience: one screen, no scroll,
// no navigation, two buttons.
//
// The answer is written to match_polls — the same table the squad picker reads
// for its availability column. So a confirmation appears in the picker with no
// further wiring, and the near-dead poll system becomes the confirmation system
// rather than being deleted and rebuilt.

export default function SquadConfirm() {
  const { matchId } = useParams<{ matchId: string }>();
  const { matches, loading } = useMatches();
  const { members } = useMembers();
  const { submitResponse } = useMatchPolls();
  const ground = useGroundDates();
  const { me } = useMe();

  const [sent, setSent] = useState<'available' | 'unavailable' | null>(null);
  const [busy, setBusy] = useState(false);

  const match = useMemo(
    () => matches.find(m => m.id === matchId) ?? null, [matches, matchId]);

  /** Their existing answer, so a second visit shows what they already said. */
  useEffect(() => {
    if (!match || !me) return;
    const mine = match.polls?.find(p => p.member_id === me.id);
    if (mine?.response === 'available' || mine?.response === 'unavailable') {
      setSent(mine.response);
    }
  }, [match, me]);

  const picked = !!me && (match?.players ?? []).some(p => p.member_id === me.id);
  const slot = match ? ground.byDate.get(match.date) : null;

  const answer = async (r: 'available' | 'unavailable') => {
    if (!me || !matchId) return;
    setBusy(true);
    await submitResponse(matchId, me.id, r);
    setSent(r);
    setBusy(false);
  };

  const squadNames = useMemo(() => {
    const byId = new Map(members.map(m => [m.id, m.name.split(' ')[0]]));
    return (match?.players ?? []).map(p => byId.get(p.member_id) ?? '—');
  }, [match, members]);

  const dateLabel = match
    ? new Date(match.date + 'T00:00:00').toLocaleDateString('en-GB',
        { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  return (
    <div className="min-h-screen text-white"
      style={{ background: 'linear-gradient(160deg,#065f46 0%,#064e3b 55%,#022c22 100%)' }}>
      <div className="max-w-md mx-auto px-5 py-8">
        <div className="flex items-center gap-3 mb-6">
          <img src={SCC_LOGO_DATA_URL} alt="" className="w-10 h-10 r-card" />
          <p className="font-display font-extrabold">Sangria Cricket Club</p>
        </div>

        {loading && !match ? (
          <p className="text-white/60">Loading…</p>
        ) : !match ? (
          <div className="r-card bg-white/10 p-5">
            <p className="font-black">Match not found</p>
            <p className="t-body text-white/60 mt-1">
              This link may be for a fixture that's since been removed.
            </p>
            <Link to="/" className="inline-flex items-center gap-1.5 mt-3 t-meta font-black">
              Open the app <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <>
            <p className="t-micro font-black uppercase tracking-[2px] text-emerald-300">
              {picked ? "You're in the squad" : 'Squad announced'}
            </p>
            <p className="font-display text-3xl font-extrabold mt-1 leading-tight">
              {match.opponent || 'SCC'}
            </p>

            <div className="mt-3 space-y-1.5">
              <p className="t-body text-white/80 inline-flex items-center gap-2">
                <Calendar className="w-4 h-4 shrink-0" />
                {dateLabel}{matchTimeLabel(match, slot?.time_slot) ? ` · ${matchTimeLabel(match, slot?.time_slot)}` : ''}
              </p>
              {(slot?.venue || match.venue) && (
                <p className="t-body text-white/80 inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4 shrink-0" />
                  {slot?.venue || match.venue}
                </p>
              )}
            </div>

            {/* ── The decision ─────────────────────────────────────────── */}
            <div className="mt-6">
              {!me ? (
                <div className="text-slate-900 dark:text-white">
                  <SignInCard />
                </div>
              ) : sent ? (
                <div className="r-card bg-white/12 p-4">
                  <p className="font-black inline-flex items-center gap-2">
                    {sent === 'available'
                      ? <><Check className="w-5 h-5 text-emerald-300" /> You're in — see you there</>
                      : <><X className="w-5 h-5 text-rose-300" /> Thanks for letting us know</>}
                  </p>
                  <button onClick={() => setSent(null)}
                    className="t-meta font-bold text-white/60 underline mt-1">
                    Change my answer
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => void answer('available')} disabled={busy}
                    className="py-4 r-card bg-white text-emerald-800 font-black
                               inline-flex items-center justify-center gap-2 disabled:opacity-50">
                    <Check className="w-5 h-5" /> I'm in
                  </button>
                  <button onClick={() => void answer('unavailable')} disabled={busy}
                    className="py-4 r-card bg-white/15 text-white font-black
                               inline-flex items-center justify-center gap-2 disabled:opacity-50">
                    <X className="w-5 h-5" /> Can't make it
                  </button>
                </div>
              )}
            </div>

            {squadNames.length > 0 && (
              <div className="mt-6 pt-5 border-t border-white/15">
                <p className="t-micro font-black uppercase tracking-[1.5px] text-white/50">
                  The squad · {squadNames.length}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {squadNames.map((n, i) => (
                    <span key={`${n}-${i}`}
                      className="t-micro font-bold px-2 py-1 rounded-full bg-white/12 text-white/90">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Link to="/" className="inline-flex items-center gap-1.5 mt-7 t-meta font-bold text-white/60">
              Open the full app <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
