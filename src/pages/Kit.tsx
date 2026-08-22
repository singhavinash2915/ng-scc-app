import { useMemo, useState } from 'react';
import { Share2 } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { JerseyShirt } from '../components/JerseyShirt';
import { useMembers } from '../hooks/useMembers';
import { useMe } from '../context/MemberContext';
import { JERSEY, type JerseyTeam } from '../lib/playerCard';

// ─── Kit ──────────────────────────────────────────────────────────────────────
// The club had shirts printed and the app should show them off. It opens on
// YOUR shirt if you have one, because "here is the kit" is a poster and "here
// is your name and number on it" is something a member sends to their family.
//
// The squad lists are ordered by NUMBER rather than name — that's how a team
// sheet reads, and it makes a shared number obvious rather than hiding it
// between two alphabetised rows.

type Member = { id: string; name: string; jersey_team?: string | null; jersey_number?: number | null };

export function Kit() {
  const { members } = useMembers();
  const { me } = useMe();
  const [team, setTeam] = useState<JerseyTeam | null>(null);

  const squads = useMemo(() => {
    const out: Record<JerseyTeam, Member[]> = { brahmos: [], agni: [] };
    for (const m of members as Member[]) {
      if (m.jersey_team === 'brahmos' || m.jersey_team === 'agni') out[m.jersey_team].push(m);
    }
    for (const k of ['brahmos', 'agni'] as JerseyTeam[]) {
      out[k].sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999));
    }
    return out;
  }, [members]);

  const mine = useMemo(() => {
    const m = (members as Member[]).find(x => x.id === me?.id);
    return m?.jersey_team === 'brahmos' || m?.jersey_team === 'agni'
      ? { team: m.jersey_team as JerseyTeam, name: m.name, number: m.jersey_number ?? null }
      : null;
  }, [members, me]);

  // Your side first if you have one — a kit page should open on your own shirt.
  const order: JerseyTeam[] = mine
    ? [mine.team, mine.team === 'brahmos' ? 'agni' : 'brahmos']
    : ['brahmos', 'agni'];

  const shown = team ?? order[0];

  const share = async () => {
    if (!mine) return;
    const text = `My ${JERSEY[mine.team].name} shirt — ${mine.name.split(' ')[0].toUpperCase()} ${mine.number} 🏏\n\nsangriacricket.club/kit`;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* dismissed */ } }
    await navigator.clipboard.writeText(text);
    alert('Copied — paste it into the group.');
  };

  return (
    <div>
      <Header title="The Kit" subtitle="SCC Brahmos · SCC Agni" />
      <div className="p-4 max-w-md mx-auto space-y-3">

        {/* ── Yours ────────────────────────────────────────────────────────
            First, and bigger than everything else. This is the bit worth
            opening the page for. */}
        {mine && (
          <Card className="p-5 text-center overflow-hidden">
            <p className="t-micro font-black uppercase tracking-[2px] text-slate-400">
              Your shirt
            </p>
            <div className="flex justify-center mt-2">
              <JerseyShirt team={mine.team} name={mine.name.split(' ')[0]}
                number={mine.number} size={230} />
            </div>
            <p className="font-display text-lg font-extrabold text-slate-900 dark:text-white mt-1">
              {JERSEY[mine.team].name}
            </p>
            <button onClick={share}
              className="mt-3 w-full py-2.5 r-control bg-emerald-500 text-white font-black t-body
                         inline-flex items-center justify-center gap-1.5">
              <Share2 className="w-4 h-4" /> Share your shirt
            </button>
          </Card>
        )}

        {/* ── Both teams ───────────────────────────────────────────────── */}
        <div className="flex gap-2">
          {order.map(t => (
            <button key={t} onClick={() => setTeam(t)}
              className={`flex-1 py-2.5 r-control t-body font-black transition-colors ${
                shown === t
                  ? 'text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/60'}`}
              style={shown === t ? { background: JERSEY[t].bg } : undefined}>
              {JERSEY[t].name}
            </button>
          ))}
        </div>

        <Card className="p-5">
          <div className="flex justify-center">
            <JerseyShirt team={shown} name="PLAYER" number={7} size={200} />
          </div>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-white/10">
            <img src={JERSEY[shown].crest} alt="" className="w-9 h-9 object-contain" />
            <div className="min-w-0">
              <p className="font-black text-slate-900 dark:text-white">{JERSEY[shown].name}</p>
              <p className="t-meta text-slate-500 dark:text-white/55">
                {squads[shown].length} shirts printed
              </p>
            </div>
          </div>
        </Card>

        {/* ── The squad, by number ─────────────────────────────────────── */}
        <Card className="p-5">
          <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 mb-2">
            {JERSEY[shown].name} — by number
          </p>
          <div className="space-y-0.5">
            {squads[shown].map(m => {
              const isMe = m.id === me?.id;
              return (
                <div key={m.id}
                  className={`flex items-center gap-3 py-1.5 px-2 -mx-2 r-control ${
                    isMe ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''}`}>
                  <span className="t-num text-lg w-10 text-right"
                    style={{ color: JERSEY[shown].ink }}>
                    {m.jersey_number}
                  </span>
                  <span className={`flex-1 t-body truncate ${
                    isMe ? 'font-black text-emerald-700 dark:text-emerald-300'
                         : 'font-bold text-slate-700 dark:text-white/80'}`}>
                    {m.name}{isMe && ' · you'}
                  </span>
                </div>
              );
            })}
          </div>
          {!squads[shown].length && (
            <p className="t-meta text-slate-400">No shirts recorded yet.</p>
          )}
        </Card>

        {!mine && (
          <Card tone="quiet" className="p-4">
            <p className="t-meta text-slate-500 dark:text-white/55 leading-snug">
              No shirt against your name yet. If you ordered one, ask an admin to add
              your number — it'll show on your player card too.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

export default Kit;
