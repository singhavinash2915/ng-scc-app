import { useMemo, useState } from 'react';
import { Card } from './ui/Card';
import { Crown, Users } from 'lucide-react';
import { useMomVotes } from '../hooks/useMomVotes';
import type { Match, Member } from '../types';

// ─── Members' Man of the Match ─────────────────────────────────────────────────
// Sits under a played match alongside the official award. Deliberately shows
// both: the official pick keeps its crown, and the members' vote is its own
// thing. When they disagree, that's the interesting bit — not an error.

interface Props {
  match: Match;
  members: Member[];
  myMemberId: string | null;
}

export function MomVoteCard({ match, members, myMemberId }: Props) {
  const { tally, myVote, castVote, clearVote, votes, tableMissing } = useMomVotes(match.id);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const mine = myVote(myMemberId);

  /** Only players who actually turned out, so the list is short and relevant. */
  const candidates = useMemo(() => {
    const played = (match.players ?? []).map(p => p.member_id);
    const pool = played.length
      ? members.filter(m => played.includes(m.id))
      : members.filter(m => m.status === 'active');
    return pool
      .filter(m => m.id !== myMemberId)         // no voting for yourself
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [match.players, members, myMemberId]);

  const nameOf = (id: string) => members.find(m => m.id === id)?.name ?? '—';
  const leader = tally[0];
  const official = match.man_of_match_id;

  // Nothing to vote on before the match is played, and nothing to show if the
  // migration hasn't run.
  if (tableMissing || match.result === 'upcoming' || match.result === 'cancelled') return null;

  return (
    <Card className="bg-white/60 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 t-micro font-black uppercase tracking-widest text-slate-400">
          <Users className="w-3.5 h-3.5" /> Members' MOM
        </span>
        <span className="t-micro font-bold text-slate-400">
          {votes.length} vote{votes.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* the standings so far */}
      {tally.length > 0 ? (
        <div className="mt-2.5 space-y-1.5">
          {tally.slice(0, 3).map((t, i) => (
            <div key={t.member_id} className="flex items-center gap-2">
              <span className={`w-4 text-center t-meta font-black ${
                i === 0 ? 'text-amber-500' : 'text-slate-300'}`}>{i + 1}</span>
              <span className="flex-1 min-w-0 truncate t-body font-bold text-slate-800 dark:text-white/85">
                {nameOf(t.member_id)}
                {t.member_id === official && (
                  <Crown className="inline w-3 h-3 ml-1 text-amber-500" fill="currentColor" />
                )}
              </span>
              <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div className="h-full bg-violet-500" style={{ width: `${t.share * 100}%` }} />
              </div>
              <span className="t-meta font-black tabular-nums text-slate-500 w-5 text-right">
                {t.votes}
              </span>
            </div>
          ))}
          {/* The disagreement is the point, so name it rather than hide it. */}
          {official && leader && leader.member_id !== official && (
            <p className="t-micro text-violet-600 dark:text-violet-300 pt-1">
              Members say {nameOf(leader.member_id).split(' ')[0]}, the official award went to{' '}
              {nameOf(official).split(' ')[0]} 👀
            </p>
          )}
        </div>
      ) : (
        <p className="t-meta text-slate-400 mt-2">No votes yet — have the first word.</p>
      )}

      {/* voting */}
      {myMemberId ? (
        <div className="mt-3">
          {mine && !open ? (
            <div className="flex items-center gap-2">
              <span className="t-meta text-slate-500 flex-1">
                You voted <b className="text-slate-800 dark:text-white">{nameOf(mine)}</b>
              </span>
              <button onClick={() => setOpen(true)}
                className="t-meta font-black text-violet-600">Change</button>
              <button
                onClick={async () => { setBusy(true); await clearVote(myMemberId); setBusy(false); }}
                disabled={busy}
                className="t-meta font-black text-slate-400 disabled:opacity-40">Clear</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={mine ?? ''}
                onChange={async e => {
                  if (!e.target.value) return;
                  setBusy(true);
                  const err = await castVote(myMemberId, e.target.value);
                  setBusy(false);
                  if (err) alert(err); else setOpen(false);
                }}
                disabled={busy}
                className="flex-1 min-w-0 r-control border border-slate-200 dark:border-white/10
                           bg-white dark:bg-white/5 px-3 py-2 t-body font-medium
                           text-slate-800 dark:text-white disabled:opacity-50"
              >
                <option value="">Who was your Man of the Match?</option>
                {candidates.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {open && (
                <button onClick={() => setOpen(false)}
                  className="t-meta font-bold text-slate-400 px-1">Cancel</button>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="t-micro text-slate-400 mt-2.5">
          Pick your profile on the Members page to vote.
        </p>
      )}
    </Card>
  );
}
