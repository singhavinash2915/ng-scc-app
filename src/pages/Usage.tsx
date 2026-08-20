import { useState, useEffect } from 'react';
import { TrendingUp, Users, Eye } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { fetchUsage, type DayCount, type RouteCount, type MemberUse } from '../hooks/useUsage';
import { useMembers } from '../hooks/useMembers';

// ─── Usage ────────────────────────────────────────────────────────────────────
// Its own page rather than a block wedged into Settings, where a chart sat
// between a theme toggle and a data export and belonged with neither.
//
// Still no names. Members signed in to see their own season, not to be logged,
// and a "who opened it most" board visible to several admins would change what
// signing in means. What it now excludes is ADMIN traffic — one person testing
// a page thirty times swamps a club of 46, and the number then answers nothing.

const LABEL: Record<string, string> = {
  '/': 'Dashboard', '/challenges': 'Challenges', '/members': 'Members',
  '/matches': 'Matches', '/settings': 'Settings', '/profile/:id': 'Player profiles',
  '/ground-booking': 'Ground booking', '/scc-mahasangram': 'MahaSangram',
  '/leaderboard': 'Leaderboard', '/honours': 'Honours', '/wrapped': 'Season Wrapped',
};

export function Usage() {
  const { isAdmin } = useAuth();
  const { members } = useMembers();
  const [d, setD] = useState<{
    byDay: DayCount[]; byRoute: RouteCount[]; byMember: MemberUse[];
    distinctMembers: number; missing: boolean } | null>(null);

  useEffect(() => { void fetchUsage(30).then(setD); }, []);

  if (!isAdmin) {
    return (
      <div>
        <Header title="Usage" subtitle="Admin only" />
        <div className="p-4 max-w-md mx-auto">
          <Card tone="warn" className="p-5">
            <p className="font-black text-slate-900 dark:text-white">Admin access required</p>
            <p className="t-body text-slate-600 dark:text-white/70 mt-1">
              Log in as an admin from the menu to see how the app is being used.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (!d) return <div><Header title="Usage" subtitle="Last 30 days" /></div>;

  if (d.missing) {
    return (
      <div>
        <Header title="Usage" subtitle="Last 30 days" />
        <div className="p-4 max-w-md mx-auto">
          <Card tone="warn" className="p-5">
            <p className="font-black text-slate-900 dark:text-white">Not set up yet</p>
            <p className="t-body text-slate-600 dark:text-white/70 mt-1">
              Run <code>add_usage_stats.sql</code> in Supabase, then reload.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const today = d.byDay.at(-1)?.people ?? 0;
  const busiest = Math.max(0, ...d.byDay.map(x => x.people));
  const views = d.byDay.reduce((s, x) => s + x.views, 0);
  const active = new Set(d.byDay.filter(x => x.people > 0).map(x => x.day)).size;
  const maxDay = Math.max(1, busiest);

  return (
    <div>
      <Header title="Usage" subtitle="Last 30 days · members only" />
      <div className="p-4 max-w-2xl mx-auto space-y-3">

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { l: 'Today', v: today },
            { l: 'Members using it', v: `${d.distinctMembers}/${members.length}` },
            { l: 'Days with visits', v: active },
            { l: 'Page views', v: views },
          ].map(x => (
            <Card key={x.l} className="p-4 text-center">
              <p className="t-num text-3xl text-slate-900 dark:text-white leading-none">{x.v}</p>
              <p className="t-micro font-black uppercase tracking-wider text-slate-400 mt-1.5">{x.l}</p>
            </Card>
          ))}
        </div>

        <Card className="p-5">
          <div className="flex items-center gap-1.5 text-slate-400 mb-3">
            <TrendingUp className="w-4 h-4" />
            <span className="t-micro font-black uppercase tracking-[1.5px]">Visits per day</span>
          </div>
          <div className="flex items-end gap-1 h-32">
            {d.byDay.slice(-30).map(x => (
              <div key={x.day} className="flex-1 flex flex-col items-center justify-end gap-1"
                title={`${x.day}: ${x.people}`}>
                <div className="w-full bg-emerald-400 rounded-t transition-all"
                  style={{ height: `${Math.max(3, (x.people / maxDay) * 100)}%` }} />
              </div>
            ))}
          </div>
          {d.byDay.length > 1 && (
            <div className="flex justify-between t-micro text-slate-400 mt-1.5">
              <span>{new Date(d.byDay[0].day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              <span>{new Date(d.byDay.at(-1)!.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-1.5 text-slate-400 mb-3">
            <Users className="w-4 h-4" />
            <span className="t-micro font-black uppercase tracking-[1.5px]">What gets opened</span>
          </div>
          {d.byRoute.slice(0, 12).map(r => {
            const top = d.byRoute[0]?.people || 1;
            return (
              <div key={r.route} className="py-1.5">
                <div className="flex justify-between t-body">
                  <span className="text-slate-700 dark:text-white/80">
                    {LABEL[r.route] ?? r.route}
                  </span>
                  <span className="tabular-nums text-slate-400">{r.people}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${(r.people / top) * 100}%` }} />
                </div>
              </div>
            );
          })}
          {!d.byRoute.length && (
            <p className="t-meta text-slate-400">Nothing recorded yet.</p>
          )}
        </Card>

        {/* ── Who's using it ───────────────────────────────────────────────
            Ranked by DAYS ACTIVE, not page loads. Someone with the app pinned
            in a tab isn't more engaged than someone who opens it each morning,
            and counting hits would claim otherwise. */}
        {d.byMember.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-1.5 text-slate-400 mb-3">
              <Eye className="w-4 h-4" />
              <span className="t-micro font-black uppercase tracking-[1.5px]">
                Who's using it · admin only
              </span>
            </div>
            {d.byMember.map((m, i) => {
              const name = members.find(x => x.id === m.memberId)?.name ?? 'Unknown member';
              return (
                <div key={m.memberId}
                  className="flex items-center gap-2 py-1.5 border-b border-slate-50 dark:border-white/5">
                  <span className="w-5 t-num text-sm text-slate-400">{i + 1}</span>
                  <span className="flex-1 t-body font-bold text-slate-800 dark:text-white/85 truncate">
                    {name}
                  </span>
                  <span className="t-meta text-slate-500 dark:text-white/55 tabular-nums">
                    {m.days} {m.days === 1 ? 'day' : 'days'}
                  </span>
                  <span className="t-micro text-slate-400 tabular-nums w-14 text-right">
                    {new Date(m.last + 'T00:00:00').toLocaleDateString('en-IN',
                      { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              );
            })}
            {/* Members who signed in but haven't been back. Worth knowing:
                these are the people the app has already lost. */}
            {members.length > d.byMember.length && (
              <p className="t-meta text-slate-400 mt-2">
                {members.length - d.byMember.length} members haven't opened it in this period.
              </p>
            )}
          </Card>
        )}

        <Card tone="quiet" className="p-4">
          <p className="t-meta text-slate-500 dark:text-white/55 leading-snug">
            Admin traffic is excluded, so testing a page repeatedly doesn't inflate
            the numbers. Members are told on the sign-in card that their use is
            recorded and visible to admins — tracking people who weren't told is the
            part that would be wrong, not the tracking. Ranked by days active rather
            than page loads, so a pinned tab doesn't look like enthusiasm.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default Usage;
