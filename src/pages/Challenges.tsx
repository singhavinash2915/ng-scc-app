import { useState } from 'react';
import { Swords, Check, X, Plus, Trophy, Share2 } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { SignInCard } from '../components/SignInCard';
import { useMe } from '../context/MemberContext';
import { useMembers } from '../hooks/useMembers';
import { useChallenges } from '../hooks/useChallenges';
import { METRICS, metricDef, autoTitle, type Metric } from '../lib/challenges';

// ─── Challenges ───────────────────────────────────────────────────────────────
// CricHeroes announced this and opens a four-screen form, because it cannot
// know who you'd want to play. Ours does — it has everyone's season in front of
// it — so the main path is a rivalry the app already spotted, accepted in one
// tap. The form is here, but it's the rare case rather than the only one.

export function Challenges() {
  const { me } = useMe();
  const { members } = useMembers();
  const C = useChallenges();
  const [picking, setPicking] = useState(false);
  const [metric, setMetric] = useState<Metric>('runs');
  const [opponent, setOpponent] = useState<string | null>(null);
  const [stake, setStake] = useState('');
  const [busy, setBusy] = useState(false);

  const name = (id: string | null) => members.find(m => m.id === id)?.name ?? '—';
  const squad = members.filter(m => m.status === 'active' && m.id !== me?.id)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!me) {
    return (
      <div>
        <Header title="Challenges" subtitle="Take on a teammate" />
        <div className="p-4 max-w-md mx-auto"><SignInCard /></div>
      </div>
    );
  }

  if (C.tableMissing) {
    return (
      <div>
        <Header title="Challenges" subtitle="Take on a teammate" />
        <div className="p-4 max-w-md mx-auto">
          <Card tone="warn" className="p-5">
            <p className="font-black text-slate-900 dark:text-white">Not set up yet</p>
            <p className="t-body text-slate-600 dark:text-white/70 mt-1">
              Run <code>supabase/migrations/add_challenges.sql</code> in the Supabase
              SQL editor, then reload.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const send = async (m: Metric, oppId: string, withStake?: string) => {
    setBusy(true);
    const err = await C.create(m, [oppId], null,
      autoTitle(m, [me.name, name(oppId)]), withStake ?? null);
    setBusy(false);
    if (err) alert(err); else { setPicking(false); setOpponent(null); setStake(''); }
  };

  /**
   * The result, written to be pasted into the group. A challenge settled
   * silently in an app is a challenge nobody remembers losing — the stake only
   * means anything if the whole club sees who owes it.
   */
  const shareResult = async (title: string, winnerId: string | null, st: string | null) => {
    const text = winnerId
      ? `⚔️ ${title}\n\n🏆 ${name(winnerId)} wins.${st ? `\n\nThat\u2019s a ${st} owed.` : ''}\n\nsangriacricket.club`
      : `⚔️ ${title}\n\nNobody qualified — nothing settled.\n\nsangriacricket.club`;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* dismissed */ } }
    await navigator.clipboard.writeText(text);
    alert('Copied — paste it into the group.');
  };

  return (
    <div>
      <Header title="Challenges" subtitle="Take on a teammate" />
      <div className="p-4 max-w-md mx-auto space-y-3">

        {/* ── Suggested — the one-tap path ────────────────────────────────
            Only genuinely close gaps get here. "400 runs behind Shaan" is a
            discouragement, not a challenge, and offering it once teaches
            people to ignore the whole page. */}
        {C.suggestions.length > 0 && (
          <>
            <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 px-1">
              Rivalries worth settling
            </p>
            {C.suggestions.map((s, n) => (
              <Card key={`${s.metric}-${s.opponentId}`} className={`p-4 m-enter m-${Math.min(n + 1, 6)}`}>
                <p className="font-black text-slate-900 dark:text-white">{name(s.opponentId)}</p>
                <p className="t-body text-slate-500 dark:text-white/60 mt-0.5">{s.pitch}</p>
                <button disabled={busy} onClick={() => void send(s.metric, s.opponentId)}
                  className="mt-3 w-full py-2.5 r-control bg-emerald-500 text-white font-black t-body
                             disabled:opacity-40 inline-flex items-center justify-center gap-1.5">
                  <Swords className="w-4 h-4" /> {metricDef(s.metric).label}
                </button>
              </Card>
            ))}
          </>
        )}

        {/* ── Yours ───────────────────────────────────────────────────── */}
        {C.mine.length > 0 && (
          <>
            <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 px-1 pt-2">
              Your challenges
            </p>
            {C.mine.map(c => {
              const my = (c.players ?? []).find(p => p.member_id === me.id);
              const pending = my && !my.accepted;
              const standings = C.standingsFor(c);
              return (
                <Card key={c.id} tone={pending ? 'warn' : 'plain'} className="p-4">
                  <p className="font-black text-slate-900 dark:text-white">
                    {c.title ?? metricDef(c.metric).label}
                  </p>
                  <p className="t-meta text-slate-400">{metricDef(c.metric).hint}</p>
                  {c.stake && (
                    <p className="t-body font-bold text-amber-600 dark:text-amber-300 mt-1.5">
                      🍵 Loser {c.stake}
                    </p>
                  )}
                  {c.status === 'settled' && (
                    <p className="t-body font-black text-emerald-600 dark:text-emerald-300 mt-1.5
                                  inline-flex items-center gap-1.5">
                      <Trophy className="w-4 h-4" />
                      {c.winner_id ? `${name(c.winner_id)} won` : 'Nobody qualified'}
                    </p>
                  )}

                  {pending ? (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => void C.respond(c.id, true)}
                        className="flex-1 py-2.5 r-control bg-emerald-500 text-white font-black t-body
                                   inline-flex items-center justify-center gap-1.5">
                        <Check className="w-4 h-4" /> Accept
                      </button>
                      <button onClick={() => void C.respond(c.id, false)}
                        className="px-4 r-control border border-slate-200 dark:border-white/10 text-slate-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-1.5">
                      {standings.map((st, i) => (
                        <div key={st.memberId} className="flex items-center gap-2">
                          <span className="w-5 t-num text-sm text-slate-400">{i + 1}</span>
                          <span className="flex-1 t-body font-bold text-slate-800 dark:text-white/85 truncate">
                            {name(st.memberId)}
                          </span>
                          <span className={`t-meta tabular-nums ${
                            st.qualified ? 'text-slate-600 dark:text-white/70' : 'text-slate-400'}`}>
                            {st.detail}
                          </span>
                        </div>
                      ))}
                      {standings.length === 0 && (
                        <p className="t-meta text-slate-400">Waiting for them to accept.</p>
                      )}

                      {/* Either player can settle. A challenge that needs an
                          admin to close it never gets closed. */}
                      {c.status !== 'settled' && standings.length > 1 && (
                        <button onClick={async () => {
                          const w = await C.settle(c);
                          void shareResult(c.title ?? metricDef(c.metric).label, w, c.stake);
                        }}
                          className="w-full mt-2 py-2 r-control border border-slate-200
                                     dark:border-white/10 t-meta font-black text-slate-500">
                          Settle it
                        </button>
                      )}
                      {c.status === 'settled' && (
                        <button onClick={() => void shareResult(
                          c.title ?? metricDef(c.metric).label, c.winner_id, c.stake)}
                          className="w-full mt-2 py-2 r-control bg-emerald-500 text-white
                                     t-meta font-black inline-flex items-center justify-center gap-1.5">
                          <Share2 className="w-3.5 h-3.5" /> Share the result
                        </button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </>
        )}

        {/* ── Custom — the rare case ──────────────────────────────────── */}
        {!picking ? (
          <button onClick={() => setPicking(true)}
            className="w-full py-3 r-control border-2 border-dashed border-slate-200 dark:border-white/10
                       text-slate-500 font-bold t-body inline-flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" /> Challenge someone else
          </button>
        ) : (
          <Card className="p-4 space-y-3">
            <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400">Pick a contest</p>
            <div className="grid grid-cols-2 gap-2">
              {METRICS.map(m => (
                <button key={m.key} onClick={() => setMetric(m.key)}
                  className={`p-2.5 r-control border-2 text-left ${
                    metric === m.key
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                      : 'border-slate-200 dark:border-white/10'}`}>
                  <span className="block t-body font-black text-slate-800 dark:text-white/85">{m.label}</span>
                  <span className="block t-micro text-slate-400 leading-tight mt-0.5">{m.hint}</span>
                  {m.needsBalls && (
                    <span className="inline-block mt-1 t-micro font-black uppercase tracking-wider
                                     px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700
                                     dark:bg-sky-400/20 dark:text-sky-200">
                      app-scored only
                    </span>
                  )}
                </button>
              ))}
            </div>

            <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 pt-1">Against</p>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
              {squad.map(m => (
                <button key={m.id} onClick={() => setOpponent(m.id)}
                  className={`py-2 r-control border t-body font-bold truncate px-2 ${
                    opponent === m.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                      : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80'}`}>
                  {m.name}
                </button>
              ))}
            </div>

            <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 pt-1">
              Stake <span className="normal-case tracking-normal text-slate-300">optional</span>
            </p>
            <input value={stake} onChange={e => setStake(e.target.value)}
              placeholder="buys chai · carries the kit bag"
              className="w-full px-4 py-2.5 r-control bg-slate-50 dark:bg-white/5 border
                         border-slate-200 dark:border-white/10 text-slate-900 dark:text-white
                         placeholder:text-slate-400 t-body" />
            <p className="t-micro text-slate-400 -mt-1">
              Between the two of you — the app doesn't collect it, and it's never money.
            </p>

            <button disabled={!opponent || busy}
              onClick={() => opponent && void send(metric, opponent, stake)}
              className="w-full py-3 r-control bg-emerald-500 text-white font-black t-body disabled:opacity-40">
              {busy ? 'Sending…' : 'Send challenge'}
            </button>
            <button onClick={() => setPicking(false)}
              className="w-full t-meta font-bold text-slate-400">Cancel</button>
          </Card>
        )}

        {C.suggestions.length === 0 && C.mine.length === 0 && !picking && (
          <p className="t-body text-slate-400 text-center py-6">
            No close rivalries yet — play a few more matches and they'll show up here.
          </p>
        )}
      </div>
    </div>
  );
}

export default Challenges;
