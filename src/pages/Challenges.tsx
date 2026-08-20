import { useState } from 'react';
import { Check, X, Trophy, Share2, HelpCircle, ChevronDown, Swords, Search,
         Pencil, Trash2 } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { SignInCard } from '../components/SignInCard';
import { useMe } from '../context/MemberContext';
import { useMatches } from '../hooks/useMatches';
import { useMembers } from '../hooks/useMembers';
import { useChallenges } from '../hooks/useChallenges';
import { CATEGORY, TARGET_METRICS, metricDef, autoTitle,
         type Metric, type Category } from '../lib/challenges';
import { challengeUrl } from '../utils/bookingMessages';

// ─── Challenges ───────────────────────────────────────────────────────────────
// CricHeroes announced this and opens a four-screen form, because it cannot
// know who you'd want to play. Ours does — it has everyone's season in front of
// it — so the main path is a rivalry the app already spotted, accepted in one
// tap. The form is here, but it's the rare case rather than the only one.

export function Challenges() {
  const { me } = useMe();
  const { members } = useMembers();
  const { matches } = useMatches();
  const C = useChallenges();
  const [metric, setMetric] = useState<Metric>('runs');
  const [opponent, setOpponent] = useState<string | null>(null);
  const [stake, setStake] = useState('');
  const [howOpen, setHowOpen] = useState(false);
  const [cat, setCat] = useState<Category>('batting');
  const [mode, setMode] = useState<'h2h' | 'target'>('h2h');
  const [target, setTarget] = useState('');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editStake, setEditStake] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [busy, setBusy] = useState(false);

  const name = (id: string | null) => members.find(m => m.id === id)?.name ?? '—';
  const squad = members.filter(m => m.status === 'active' && m.id !== me?.id)
    .filter(m => !q.trim() || m.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  /** Fixtures you could pin a target challenge to. */
  const upcoming = matches
    .filter(m => m.result === 'upcoming')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);
  const matchLabel = (id: string | null) => {
    const m = matches.find(x => x.id === id);
    return m ? `${m.opponent || 'SCC'} · ${new Date(m.date + 'T00:00:00')
      .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Any match';
  };

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
    const n = mode === 'target' ? Number(target) : null;
    if (mode === 'target' && (!n || n < 1)) { alert('Set a target first.'); return; }
    setBusy(true);
    const title = n
      ? `${n} ${metricDef(m).label.replace(/^Most /, '').replace(/^Best /, '')} in a match`
      : autoTitle(m, [me.name, name(oppId)]);
    const err = await C.create(m, [oppId], null, title, withStake ?? null, n,
      mode === 'target' ? matchId : null);
    setBusy(false);
    if (err) { alert(err); return; }

    // The in-app alert only catches them if they open the app. This is what
    // actually reaches them — same handoff the match bookings use.
    const opp = members.find(x => x.id === oppId);
    const url = challengeUrl(opp?.phone, {
      from: me.name, contest: metricDef(m).label, stake: withStake || null,
    });
    if (url) window.open(url, '_blank', 'noopener');

    setOpponent(null); setStake(''); setQ(''); setMatchId(null);
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

        {/* Suggested rivalries were removed at the club's request. The
            engine still exists in lib/challenges.ts if it's ever wanted back —
            in practice it kept offering the same contest against three
            different people, which read as noise rather than a nudge. */}

        {/* ── Waiting on you ────────────────────────────────────────────
            Members kept asking where they could see who had challenged them.
            The answer used to be "somewhere in your list", which is not an
            answer. It's the first thing on the page now, and it says who. */}
        {C.inbox.length > 0 && (
          <>
            <p className="t-micro font-black uppercase tracking-[1.5px] text-emerald-600
                          dark:text-emerald-400 px-1">
              ⚔️ You've been challenged
            </p>
            {C.inbox.map(c => (
              <Card key={c.id} tone="good" className="p-4">
                <p className="font-black text-slate-900 dark:text-white">
                  {c.created_by ? `${name(c.created_by)} challenged you` : 'A challenge'}
                </p>
                <p className="t-body text-slate-600 dark:text-white/70 mt-0.5">
                  {c.kind === 'target'
                    ? `First to ${c.target}${c.match_id ? ` — ${matchLabel(c.match_id)}` : ' in any match'}`
                    : metricDef(c.metric).label}
                </p>
                {c.stake && (
                  <p className="t-meta font-bold text-amber-600 dark:text-amber-300 mt-1">
                    🍵&nbsp; Loser {c.stake}
                  </p>
                )}
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
              </Card>
            ))}
          </>
        )}

        {/* ── Yours ───────────────────────────────────────────────────── */}
        {C.active.length > 0 && (
          <>
            <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 px-1 pt-2">
              Your challenges
            </p>
            {C.active.map(c => {
              const my = (c.players ?? []).find(p => p.member_id === me.id);
              const pending = my && !my.accepted;
              const standings = C.standingsFor(c);
              return (
                <Card key={c.id} tone={pending ? 'warn' : 'plain'} className="p-4">
                  {/* Who you're playing, first. The generated title for a
                      target challenge ("3 sixes in a match") never said, which
                      made a page of them indistinguishable. */}
                  <p className="t-micro font-black uppercase tracking-wider text-slate-400">
                    {(() => {
                      const them = (c.players ?? [])
                        .filter(p => p.member_id !== me.id)
                        .map(p => name(p.member_id).split(' ')[0]);
                      return them.length ? `You v ${them.join(', ')}` : 'You';
                    })()}
                  </p>
                  <p className="font-black text-slate-900 dark:text-white">
                    {c.title ?? metricDef(c.metric).label}
                  </p>
                  <p className="t-meta text-slate-400">
                    {c.kind === 'target'
                      ? `First to ${c.target}${c.match_id ? ` — ${matchLabel(c.match_id)}` : ' in any match'}`
                      : metricDef(c.metric).hint}
                  </p>
                  {c.stake && (
                    <p className="t-body font-bold text-amber-600 dark:text-amber-300 mt-1.5">
                      🍵&nbsp; Loser {c.stake}
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
                      {/* A leaderboard of one is not a leaderboard. Until they
                          accept, say what's actually happening. */}
                      {(c.players ?? []).some(p => p.member_id !== me.id && !p.accepted) ? (
                        <p className="t-meta text-slate-400">
                          Waiting for {(c.players ?? [])
                            .filter(p => p.member_id !== me.id && !p.accepted)
                            .map(p => name(p.member_id).split(' ')[0]).join(', ')} to accept.
                        </p>
                      ) : standings.map((st, i) => (
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

                      {/* Yours, and nobody has taken it up — so the terms are
                          still open. Once they accept this disappears: that's
                          the moment a stake becomes real, and letting someone
                          delete a contest they're losing would make the whole
                          thing worthless. */}
                      {c.created_by === me.id && c.status !== 'settled' &&
                       !(c.players ?? []).some(p => p.member_id !== me.id && p.accepted) && (
                        editing === c.id ? (
                          <div className="mt-2 space-y-2">
                            {c.kind === 'target' && (
                              <input type="number" inputMode="numeric" min={1}
                                value={editTarget} onChange={e => setEditTarget(e.target.value)}
                                placeholder="Target"
                                className="w-full px-3 py-2 r-control bg-slate-50 dark:bg-white/5
                                           border border-slate-200 dark:border-white/10 t-body
                                           text-slate-900 dark:text-white" />
                            )}
                            <input value={editStake} onChange={e => setEditStake(e.target.value)}
                              placeholder="Stake (optional)"
                              className="w-full px-3 py-2 r-control bg-slate-50 dark:bg-white/5
                                         border border-slate-200 dark:border-white/10 t-body
                                         text-slate-900 dark:text-white" />
                            <div className="flex gap-2">
                              <button onClick={async () => {
                                const err = await C.edit(c, {
                                  stake: editStake || null,
                                  ...(c.kind === 'target' && editTarget
                                    ? { target: Number(editTarget) } : {}),
                                });
                                if (err) alert(err); else setEditing(null);
                              }}
                                className="flex-1 py-2 r-control bg-emerald-500 text-white
                                           t-meta font-black">Save</button>
                              <button onClick={() => setEditing(null)}
                                className="px-4 r-control border border-slate-200
                                           dark:border-white/10 t-meta font-black text-slate-500">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => {
                              setEditing(c.id);
                              setEditStake(c.stake ?? '');
                              setEditTarget(c.target ? String(c.target) : '');
                            }}
                              className="flex-1 py-2 r-control border border-slate-200
                                         dark:border-white/10 t-meta font-black text-slate-500
                                         inline-flex items-center justify-center gap-1.5">
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button onClick={async () => {
                              if (!confirm('Withdraw this challenge?')) return;
                              const err = await C.withdraw(c);
                              if (err) alert(err);
                            }}
                              className="px-4 r-control border border-rose-200 dark:border-rose-400/25
                                         text-rose-500 inline-flex items-center justify-center">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      )}

                      {/* Either player can settle. A challenge that needs an
                          admin to close it never gets closed. */}
                      {/* A fixture-pinned challenge can't be settled before
                          the fixture. Offering it made "Settle it" look like a
                          button that decides the result rather than records it. */}
                      {c.status !== 'settled' && standings.length > 1 &&
                       !(c.match_id && matches.find(x => x.id === c.match_id)?.result === 'upcoming') && (
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

        {/* ── Start one ─────────────────────────────────────────────────
            Always open rather than hidden behind a button. This IS the page —
            asking someone to tap "create" before they can see what a challenge
            even offers is a screen of nothing. Category chips first so the
            twelve contests read as three choices. */}
        <Card className="p-4 space-y-3">
          <p className="font-display text-lg font-extrabold text-slate-900 dark:text-white">
            Call someone out
          </p>

          {/* Two shapes of contest, and they answer different questions:
              "who ends up ahead over the season" vs "who does it first in a
              single match". Worth choosing before anything else. */}
          <div className="flex gap-2">
            {([
              { k: 'h2h' as const, l: 'Head to head', h: 'Most over the season' },
              { k: 'target' as const, l: 'First to…', h: 'In a single match' },
            ]).map(o => (
              <button key={o.k}
                onClick={() => {
                  setMode(o.k);
                  // Only some contests make sense as a one-match feat.
                  if (o.k === 'target' && !TARGET_METRICS.includes(metric)) setMetric('runs');
                }}
                className={`flex-1 py-2 r-control border-2 ${
                  mode === o.k
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                    : 'border-slate-200 dark:border-white/10'}`}>
                <span className="block t-body font-black text-slate-800 dark:text-white/85">{o.l}</span>
                <span className="block t-micro text-slate-400">{o.h}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {(Object.keys(CATEGORY) as Category[]).map(k => (
              <button key={k} onClick={() => { setCat(k); setMetric(CATEGORY[k].metrics[0]); }}
                className={`flex-1 py-2.5 r-control t-body font-black transition-colors ${
                  cat === k
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/60'}`}>
                {CATEGORY[k].emoji} {CATEGORY[k].label}
              </button>
            ))}
          </div>

          {/* Contest chips — horizontal scroll rather than a wall of buttons. */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {CATEGORY[cat].metrics
              .filter(k => mode === 'h2h' || TARGET_METRICS.includes(k))
              .map(k => {
              const d = metricDef(k);
              return (
                <button key={k} onClick={() => setMetric(k)}
                  className={`flex-shrink-0 px-3 py-2 r-control border-2 text-left min-w-[9.5rem] ${
                    metric === k
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                      : 'border-slate-200 dark:border-white/10'}`}>
                  <span className="block t-body font-black text-slate-800 dark:text-white/85">{d.label}</span>
                  <span className="block t-micro text-slate-400 leading-tight mt-0.5">{d.hint}</span>
                  {d.needsBalls && (
                    <span className="inline-block mt-1 t-micro font-black uppercase tracking-wider
                                     px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700
                                     dark:bg-sky-400/20 dark:text-sky-200">app-scored</span>
                  )}
                </button>
              );
            })}
          </div>

          {mode === 'target' && (
            <div className="flex items-center gap-2">
              <span className="t-body font-bold text-slate-600 dark:text-white/70">First to</span>
              <input type="number" inputMode="numeric" min={1} value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder="4"
                className="w-20 px-3 py-2 r-control text-center t-num text-lg
                           bg-slate-50 dark:bg-white/5 border border-slate-200
                           dark:border-white/10 text-slate-900 dark:text-white" />
              <span className="t-body font-bold text-slate-600 dark:text-white/70">
                {metricDef(metric).label.replace(/^Most /, '')} in one match
              </span>
            </div>
          )}

          {mode === 'target' && (
            <>
              <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400">
                Which match
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {/* "Any match" is really "ever", which nobody waits on. Naming
                    the fixture makes it a bet about Sunday — but it stays an
                    option, because an open-ended target is still valid. */}
                {[{ id: null as string | null, label: 'Any match' },
                  ...upcoming.map(m => ({ id: m.id, label: matchLabel(m.id) }))].map(o => (
                  <button key={o.id ?? 'any'} onClick={() => setMatchId(o.id)}
                    className={`flex-shrink-0 px-3 py-2 r-control border-2 t-body font-bold ${
                      matchId === o.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Opponent — faces, not a dropdown. You're picking a person. */}
          <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 pt-1">Against</p>
          {/* 47 faces is a lot of swiping to reach a name you already know. */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a teammate"
              className="w-full pl-9 pr-3 py-2 r-control bg-slate-50 dark:bg-white/5 border
                         border-slate-200 dark:border-white/10 text-slate-900 dark:text-white
                         placeholder:text-slate-400 t-body" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {squad.map(m => (
              <button key={m.id} onClick={() => setOpponent(m.id)}
                className={`flex-shrink-0 w-[4.5rem] text-center ${
                  opponent === m.id ? '' : 'opacity-60'}`}>
                {m.avatar_url
                  ? <img src={m.avatar_url} alt="" className={`w-14 h-14 rounded-full object-cover mx-auto border-2 ${
                      opponent === m.id ? 'border-emerald-500' : 'border-transparent'}`} />
                  : <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center
                                     font-black text-slate-500 dark:text-white/60 border-2 ${
                        opponent === m.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                          : 'border-transparent bg-slate-100 dark:bg-white/10'}`}>
                      {m.name[0]}
                    </div>}
                <span className="block t-micro font-bold text-slate-600 dark:text-white/70 truncate mt-1">
                  {m.name.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>

          <input value={stake} onChange={e => setStake(e.target.value)}
            placeholder="Stake — buys chai, carries the kit bag (optional)"
            className="w-full px-4 py-2.5 r-control bg-slate-50 dark:bg-white/5 border
                       border-slate-200 dark:border-white/10 text-slate-900 dark:text-white
                       placeholder:text-slate-400 t-body" />

          <button disabled={!opponent || busy}
            onClick={() => opponent && void send(metric, opponent, stake)}
            className="w-full py-3.5 r-control bg-emerald-500 text-white font-black
                       disabled:opacity-40 inline-flex items-center justify-center gap-2">
            <Swords className="w-4 h-4" />
            {busy ? 'Sending…'
              : opponent ? `Challenge ${name(opponent).split(' ')[0]}` : 'Pick someone'}
          </button>
          <p className="t-micro text-slate-400 text-center -mt-1">
            They get a notification, a WhatsApp message and an alert in the app.
          </p>
        </Card>

        {/* ── The club board ─────────────────────────────────────────────
            A challenge nobody can see is a private bet. The stake only bites
            when the club is watching — so every accepted challenge shows here,
            and once it's settled, who won and what they're owed. */}
        {C.club.length > 0 && (
          <>
            <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400 px-1 pt-2">
              Around the club
            </p>
            {C.club.map(c => {
              const standings = C.standingsFor(c);
              const names = (c.players ?? []).filter(p => p.accepted)
                .map(p => name(p.member_id).split(' ')[0]);
              return (
                <Card key={c.id} tone={c.status === 'settled' ? 'good' : 'plain'} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 dark:text-white truncate">
                        {names.join(' v ') || 'Challenge'}
                      </p>
                      <p className="t-meta text-slate-400">
                        {c.kind === 'target'
                          ? `First to ${c.target}${c.match_id ? ` — ${matchLabel(c.match_id)}` : ''}`
                          : metricDef(c.metric).label}
                      </p>
                    </div>
                    {c.status !== 'settled' &&
                     !(c.players ?? []).every(p => p.accepted) && (
                      <span className="flex-shrink-0 t-micro font-black uppercase tracking-wider
                                       px-2 py-1 rounded-full bg-slate-100 text-slate-500
                                       dark:bg-white/10 dark:text-white/50">
                        Not accepted yet
                      </span>
                    )}
                    {c.status === 'settled' && c.winner_id && (
                      <span className="flex-shrink-0 t-micro font-black uppercase tracking-wider
                                       px-2 py-1 rounded-full bg-emerald-100 text-emerald-700
                                       dark:bg-emerald-400/20 dark:text-emerald-200
                                       inline-flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> {name(c.winner_id).split(' ')[0]}
                      </span>
                    )}
                  </div>

                  {c.stake && (
                    <p className="t-meta font-bold text-amber-600 dark:text-amber-300 mt-1">
                      🍵&nbsp; Loser {c.stake}
                    </p>
                  )}

                  {/* Live standings while it runs; the frozen result once it's
                      settled — both come from the same scorecards. */}
                  <div className="mt-2 space-y-1">
                    {(c.players ?? []).every(p => p.accepted) &&
                     standings.slice(0, 4).map((st, i) => (
                      <div key={st.memberId} className="flex items-center gap-2 t-meta">
                        <span className="w-4 t-num text-slate-400">{i + 1}</span>
                        <span className="flex-1 font-bold text-slate-700 dark:text-white/75 truncate">
                          {name(st.memberId)}
                        </span>
                        <span className="tabular-nums text-slate-500 dark:text-white/55">
                          {st.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </>
        )}

        {/* ── How it works ──────────────────────────────────────────────
            Collapsed, because someone who already gets it shouldn't scroll
            past the explanation on every visit — and someone who doesn't will
            look for exactly this. */}
        <button onClick={() => setHowOpen(o => !o)}
          className="w-full flex items-center gap-2 py-2 t-meta font-bold text-slate-400">
          <HelpCircle className="w-4 h-4" /> How challenges work
          <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${howOpen ? 'rotate-180' : ''}`} />
        </button>
        {howOpen && (
          <Card className="p-4 space-y-3 t-body text-slate-600 dark:text-white/70">
            <div>
              <p className="font-black text-slate-900 dark:text-white">Nothing to log</p>
              <p className="mt-0.5">
                Your match performances count towards a challenge automatically. The
                standings read the same season stats as the leaderboard, so the two
                can never disagree — and if a scorecard is corrected, the challenge
                corrects with it.
              </p>
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-white">Both of you have to agree</p>
              <p className="mt-0.5">
                A challenge you're invited to stays pending until you accept. Nobody
                appears on a public board because somebody else named them.
              </p>
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-white">Some contests need a minimum</p>
              <p className="mt-0.5">
                Strike rate needs 30 balls, economy 4 overs, death economy 12 balls.
                A strike rate off four deliveries isn't a strike rate. Until you reach
                it you're shown as unqualified rather than winning by accident.
              </p>
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-white">Four contests need app scoring</p>
              <p className="mt-0.5">
                Death-over economy, dot percentage, strike rate in a chase and
                partnership runs are worked out ball by ball, so they only count
                matches scored in this app — not the ones synced from CricHeroes.
                They're badged "app-scored only" when you pick.
              </p>
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-white">Either of you can settle it</p>
              <p className="mt-0.5">
                Whoever taps Settle freezes the result, so a later stat correction
                can't rewrite who won. If neither of you reached the minimum, nobody
                wins — the app won't invent a winner.
              </p>
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-white">Stakes are between you</p>
              <p className="mt-0.5">
                "Loser buys chai" is recorded and shown, never collected. The app
                doesn't touch your balance — stakes are never money.
              </p>
            </div>
          </Card>
        )}

        {C.active.length === 0 && C.inbox.length === 0 && (
          <p className="t-body text-slate-400 text-center py-6">
No challenges yet. Pick someone and call them out.
          </p>
        )}
      </div>
    </div>
  );
}

export default Challenges;
