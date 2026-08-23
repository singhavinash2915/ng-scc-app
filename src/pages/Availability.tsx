import { useMemo, useState } from 'react';
import { CalendarOff, Pencil, Trash2, Users, CalendarCheck, Info } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { SignInCard } from '../components/SignInCard';
import { RangeCalendar } from '../components/RangeCalendar';
import { useMe } from '../context/MemberContext';
import { useAuth } from '../context/AuthContext';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useUnavailability, type Unavailability } from '../hooks/useUnavailability';
import { useMemberActivity } from '../hooks/useMemberActivity';
import { useGroundDates } from '../hooks/useGroundDates';

// ─── Availability ─────────────────────────────────────────────────────────────
// Squad polling asks "can you play on the 4th", which needs the fixture to
// exist. This asks the question that comes first — which dates are worth
// booking — and that is the one that decides whether a festive-season fixture
// survives contact with everyone's travel plans.

const REASONS = ['Diwali', 'Hometown', 'Wedding', 'Work travel', 'Holiday'];

const pretty = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const range = (a: string, b: string) => (a === b ? pretty(a) : `${pretty(a)} – ${pretty(b)}`);

type Tab = 'mine' | 'everyone' | 'dates';

export default function Availability() {
  const { me } = useMe();
  const { isAdmin } = useAuth();
  const { members } = useMembers();
  const { matches } = useMatches();
  const U = useUnavailability();
  // Who actually turns up — played in at least one of the last ten matches.
  // The full roster is 48, but counting everyone on the books makes every
  // weekend look like a 48-man squad and every date equally green, which tells
  // an admin nothing. The regulars are the pool a fixture is picked from.
  const { activeMembers } = useMemberActivity(members, matches);
  // The bookings, not the fixture list. Most booked slots have no fixture row
  // yet, and the club plays Tue/Thu/Sat rather than Sundays — so both "is there
  // cricket that day" and "which dates can we even use" come from here.
  const ground = useGroundDates();

  const [tab, setTab] = useState<Tab>('mine');
  const [sel, setSel] = useState<{ from: string; to: string } | null>(null);
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState<Unavailability | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);
  const mine = U.mine(me?.id);

  /** Play dates: every booked ground slot, plus any fixture without one. */
  const fixtureDates = useMemo(() => {
    const s = new Set(ground.dates);
    for (const m of matches) if (m.result === 'upcoming') s.add(m.date);
    return s;
  }, [ground.dates, matches]);

  const meta = (date: string) => {
    const away = U.awayOn(date);
    return {
      blocked: !!me && away.has(me.id),
      fixture: fixtureDates.has(date),
      // Everyone except you. A count only — never who, never why.
      othersAway: [...away].filter(id => id !== me?.id).length,
    };
  };

  const save = async () => {
    if (!me || !sel) return;
    setBusy(true);
    const r = reason.trim() || null;
    if (editing) await U.edit(editing.id, sel.from, sel.to, r);
    else await U.add(me.id, sel.from, sel.to, r);
    setBusy(false); setSel(null); setReason(''); setEditing(null);
  };

  const startEdit = (u: Unavailability) => {
    setEditing(u);
    setSel({ from: u.from_date, to: u.to_date });
    setReason(u.reason ?? '');
    setTab('mine');
  };

  // ── Best dates ────────────────────────────────────────────────────────────
  // Every Saturday and Sunday for the next ten weeks, scored by who is around.
  // Split by MahaSangram side, because an internal fixture needs BOTH squads:
  // a date with eleven Brahmos and three Agni free is a bad internal date that
  // a plain headcount would rank as the best of the month.
  const bestDates = useMemo(() => {
    const active = activeMembers;
    const matchOn = new Map(matches.filter(m => m.result === 'upcoming').map(m => [m.date, m]));
    return ground.upcoming.slice(0, 24).map(b => {
      const away = U.awayOn(b.date);
      const free = active.filter(m => !away.has(m.id));
      return {
        date: b.date,
        slot: b.time_slot,
        total: free.length,
        brahmos: free.filter(m => m.jersey_team === 'brahmos').length,
        agni: free.filter(m => m.jersey_team === 'agni').length,
        awayNames: active.filter(m => away.has(m.id)).map(m => m.name.split(' ')[0]),
        fixture: matchOn.get(b.date)?.opponent ?? null,
        hasFixture: matchOn.has(b.date),
      };
    });
  }, [activeMembers, U, ground.upcoming, matches]);

  if (U.tableMissing) {
    return (
      <div className="space-y-4">
        <Header title="Availability" subtitle="Tell the club when you're away" />
        <Card className="p-5">
          <p className="font-black text-slate-900 dark:text-white">One migration to run first</p>
          <p className="t-body text-slate-500 dark:text-white/50 mt-1">
            Run <code className="t-meta">supabase/migrations/add_member_unavailability.sql</code> in
            the Supabase SQL editor, then reload this page.
          </p>
        </Card>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof Users }> = [
    { id: 'mine', label: 'Your dates', icon: CalendarOff },
    ...(isAdmin ? [
      { id: 'everyone' as Tab, label: 'Everyone', icon: Users },
      { id: 'dates' as Tab, label: 'Best dates', icon: CalendarCheck },
    ] : []),
  ];

  return (
    <div className="space-y-4">
      <Header title="Availability" subtitle="Tell the club when you're away" />

      {tabs.length > 1 && (
        <div className="flex gap-1 p-1 r-card bg-slate-100 dark:bg-white/5">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 r-control t-meta font-black inline-flex items-center
                          justify-center gap-1.5 ${
                tab === t.id ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                             : 'text-slate-500'}`}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── YOUR DATES ─────────────────────────────────────────────────────── */}
      {tab === 'mine' && (!me ? <SignInCard /> : (
        <>
          <Card className="p-4">
            <RangeCalendar value={sel} onChange={setSel} meta={meta} />

            {sel && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10">
                <p className="font-black text-slate-900 dark:text-white">
                  {editing ? 'Change this to' : 'Away'} {range(sel.from, sel.to)}
                </p>
                {/* What it costs you, stated before you commit. A block that
                    quietly loses you a match is the one people regret. */}
                {(() => {
                  const hit = matches.filter(m => m.result === 'upcoming'
                    && m.date >= sel.from && m.date <= sel.to);
                  return hit.length ? (
                    <p className="t-meta font-semibold text-amber-600 dark:text-amber-400 mt-1">
                      You’d miss {hit.length} fixture{hit.length > 1 ? 's' : ''} —{' '}
                      {hit.map(m => `${pretty(m.date)} v ${m.opponent || 'SCC'}`).join(', ')}
                    </p>
                  ) : null;
                })()}

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {REASONS.map(r => (
                    <button key={r} onClick={() => setReason(r)}
                      className={`t-micro font-black px-2.5 py-1 rounded-full border ${
                        reason === r
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                          : 'border-slate-200 dark:border-white/15 text-slate-500'}`}>
                      {r}
                    </button>
                  ))}
                </div>
                <input value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="w-full mt-2 px-3 py-2 r-control bg-slate-50 dark:bg-white/5
                             border border-slate-200 dark:border-white/10 t-body
                             text-slate-900 dark:text-white" />

                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setSel(null); setReason(''); setEditing(null); }}
                    className="px-4 py-2.5 r-control border border-slate-200 dark:border-white/10
                               t-meta font-black text-slate-500">Cancel</button>
                  <button onClick={() => void save()} disabled={busy}
                    className="flex-1 py-2.5 r-control bg-rose-500 text-white t-meta font-black
                               disabled:opacity-40">
                    {busy ? 'Saving…' : editing ? 'Update' : 'Mark me away'}
                  </button>
                </div>
              </div>
            )}
          </Card>

          {mine.length > 0 && (
            <Card className="p-4">
              <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400">
                You’re away
              </p>
              <div className="mt-2 divide-y divide-slate-100 dark:divide-white/10">
                {mine.map(u => (
                  <div key={u.id} className="flex items-center gap-2 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="font-black t-body text-slate-900 dark:text-white">
                        {range(u.from_date, u.to_date)}
                      </p>
                      {u.reason && <p className="t-meta text-slate-500">{u.reason}</p>}
                    </div>
                    {/* Plans change constantly in festive season, so editing is
                        a first-class action rather than delete-and-redo. */}
                    <button onClick={() => startEdit(u)}
                      className="w-9 h-9 r-control border border-slate-200 dark:border-white/10
                                 flex items-center justify-center text-slate-500">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => void U.remove(u.id)}
                      className="w-9 h-9 r-control border border-slate-200 dark:border-white/10
                                 flex items-center justify-center text-rose-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <p className="t-micro text-slate-400 px-1 inline-flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            Club admins can see these dates and reasons so they can schedule around
            them. Other members only ever see a count, never names — the small grey
            number on a day is how many others are away.
          </p>
        </>
      ))}

      {/* ── EVERYONE (admin) ───────────────────────────────────────────────── */}
      {tab === 'everyone' && isAdmin && (
        <Card className="p-4">
          {U.rows.length === 0 ? (
            <p className="t-body text-slate-500 dark:text-white/50">
              Nobody has blocked any dates yet. Worth asking the group before the
              festive weeks — an empty calendar and a fully-free club look identical.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/10">
              {[...U.rows].sort((a, b) => a.from_date.localeCompare(b.from_date)).map(u => {
                const m = byId.get(u.member_id);
                return (
                  <div key={u.id} className="flex items-center gap-3 py-2.5">
                    {m?.avatar_url
                      ? <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      : <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold t-body text-slate-900 dark:text-white truncate">
                        {m?.name ?? 'Unknown'}
                      </p>
                      <p className="t-meta text-slate-500">
                        {range(u.from_date, u.to_date)}{u.reason ? ` · ${u.reason}` : ''}
                      </p>
                    </div>
                    <button onClick={() => void U.remove(u.id)}
                      className="w-8 h-8 r-control border border-slate-200 dark:border-white/10
                                 flex items-center justify-center text-rose-500 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── BEST DATES (admin) ─────────────────────────────────────────────── */}
      {tab === 'dates' && isAdmin && (
        <Card className="p-4">
          <p className="t-micro font-black uppercase tracking-[1.5px] text-slate-400">
            Your booked slots
          </p>
          <p className="t-meta text-slate-500 dark:text-white/50 mt-1">
            The ground slots you’ve actually booked — not every weekend, since the
            club plays Tue/Thu/Sat. Counting the {activeMembers.length} regulars
            (played one of the last ten matches). Brahmos and Agni are counted
            separately because an internal fixture needs both squads: 11–3 is a
            worse date than 8–8 even though more people are free.
          </p>
          <div className="mt-3 space-y-1">
            {bestDates.map(d => {
              // Internal viability is the smaller side — that's what caps the game.
              const internal = Math.min(d.brahmos, d.agni);
              // 11 is a team. Below that the date is unplayable, not merely thin.
              const tone = d.total >= 14 ? 'bg-emerald-500'
                         : d.total >= 11 ? 'bg-amber-500' : 'bg-rose-500';
              return (
                <div key={d.date}
                  className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-white/10">
                  <span className={`w-1.5 h-8 rounded-full shrink-0 ${tone}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold t-body text-slate-900 dark:text-white">
                      {new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB',
                        { weekday: 'short', day: 'numeric', month: 'short' })}
                      {/* A slot with no fixture is the one worth acting on — the
                          ground is paid for and nothing is scheduled on it. */}
                      {d.hasFixture
                        ? <span className="t-micro font-black text-emerald-600 dark:text-emerald-400"> · {d.fixture}</span>
                        : <span className="t-micro font-black text-amber-600 dark:text-amber-400"> · no fixture yet</span>}
                    </p>
                    <p className="t-micro text-slate-400 truncate">
                      {d.slot ? `${d.slot} · ` : ''}
                      {d.awayNames.length ? `Away: ${d.awayNames.join(', ')}` : 'Everyone free'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="t-num text-lg text-slate-900 dark:text-white leading-none">{d.total}</p>
                    <p className="t-micro text-slate-400">
                      B{d.brahmos} · A{d.agni}
                      {internal >= 8 && <span className="text-emerald-600 dark:text-emerald-400"> ✓</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
