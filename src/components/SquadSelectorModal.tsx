import { useState, useEffect, useMemo } from 'react';
import { Card } from './ui/Card';
import { useCardStats } from '../hooks/useCardStats';
import { tierFor } from '../lib/playerCard';
import {
  Users, Check, X, Crown, Star, ChevronUp, ChevronDown,
  CheckCircle2, HelpCircle, XCircle, Send, Save, Sparkles, Loader2,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useMatchPolls } from '../hooks/useMatchPolls';
import { useUnavailability } from '../hooks/useUnavailability';
import { APP_URL } from '../data/appMeta';
import type { Match, Member, MatchPoll } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
}

const RESPONSE_META = {
  available:   { label: 'IN',     color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-100 dark:bg-green-900/30',  icon: CheckCircle2 },
  maybe:       { label: 'MAYBE',  color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-100 dark:bg-amber-900/30',  icon: HelpCircle },
  unavailable: { label: 'OUT',    color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-100 dark:bg-red-900/30',      icon: XCircle },
};

const ROLE_ICON: Record<string, string> = {
  batsman: '🏏', bowler: '⚡', all_rounder: '🌟', wicket_keeper: '🧤',
};

export function SquadSelectorModal({ isOpen, onClose, match }: Props) {
  const { members } = useMembers();
  const { updateMatch } = useMatches();
  const { polls, fetchPollsByMatch } = useMatchPolls();

  // Ordered playing XI (by batting position 1..N)
  const [squad, setSquad] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string>('');
  const [viceCaptainId, setViceCaptainId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'available' | 'maybe'>('all');
  // Same tier the squad cards and profiles show, from the same shared source —
  // a captain picking a squad must see what the player sees on their own page.
  const { all: cardAll, statsFor } = useCardStats();
  const tierOf = (id: string) => tierFor(statsFor(id), cardAll);
  const [saving, setSaving] = useState(false);

  // Hydrate from existing match data
  useEffect(() => {
    if (!isOpen) return;
    fetchPollsByMatch(match.id);
    if (match.players && match.players.length > 0) {
      setSquad(match.players.map(p => p.member_id));
    } else {
      setSquad([]);
    }
    setCaptainId(match.captain_id || '');
    setViceCaptainId(match.vice_captain_id || '');
  }, [isOpen, match.id, match.players, match.captain_id, match.vice_captain_id, fetchPollsByMatch]);

  // Build a map from poll responses
  const pollByMember = useMemo(() => {
    const m: Record<string, MatchPoll> = {};
    polls.forEach(p => { m[p.member_id] = p; });
    return m;
  }, [polls]);

  // Filter + sort the bench (members not in squad)
  // Who has told us they're away on this date. The poll has 7 responses in its
  // lifetime; availability has 33 from 22 members. Picking a squad off the
  // emptier of the two was the reason this screen felt like guesswork.
  const U = useUnavailability();
  const away = useMemo(() => U.awayOn(match.date), [U, match.date]);

  const benchMembers = useMemo(() => {
    return members
      .filter(m => m.status === 'active')
      .filter(m => !squad.includes(m.id))
      .filter(m => {
        if (filter === 'all') return true;
        const resp = pollByMember[m.id]?.response;
        if (filter === 'available') return resp === 'available';
        if (filter === 'maybe') return resp === 'maybe';
        return true;
      })
      .filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        // Available first, maybe next, then no-response, then unavailable
        const order = { available: 0, maybe: 1, unavailable: 3 } as Record<string, number>;
        const ra = pollByMember[a.id]?.response;
        const rb = pollByMember[b.id]?.response;
        // Anyone away sinks below everyone else, whatever the poll says: a
        // stale "available" from three weeks ago does not outrank someone
        // telling us this week that they're in their hometown.
        const aa = away.has(a.id) ? 1 : 0, ab = away.has(b.id) ? 1 : 0;
        if (aa !== ab) return aa - ab;
        const oa = ra ? order[ra] : 2;
        const ob = rb ? order[rb] : 2;
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name);
      });
  }, [members, squad, filter, search, pollByMember, away]);

  // Helpers
  const memberById = useMemo(() => {
    const m: Record<string, Member> = {};
    members.forEach(x => { m[x.id] = x; });
    return m;
  }, [members]);

  // Auto-pick top 12 — fills based on poll responses (available > maybe > rest)
  const autoPickSquad = () => {
    // Away is a hard exclusion, not a ranking. Someone who has said they are
    // out of Pune that week cannot be auto-picked at all — the whole point of
    // collecting the dates is that nobody has to remember them.
    const eligible = members.filter(m => m.status === 'active' && !away.has(m.id));
    const available = eligible.filter(m => pollByMember[m.id]?.response === 'available');
    const maybe = eligible.filter(m => pollByMember[m.id]?.response === 'maybe');
    const others = eligible.filter(m =>
      pollByMember[m.id]?.response !== 'available' &&
      pollByMember[m.id]?.response !== 'maybe' &&
      pollByMember[m.id]?.response !== 'unavailable'
    );
    const pool = [...available, ...maybe, ...others];
    const xi = pool.slice(0, 12).map(m => m.id);
    setSquad(xi);
  };

  const addToSquad = (id: string) => {
    if (squad.includes(id)) return;
    setSquad(prev => [...prev, id]);
  };
  const removeFromSquad = (id: string) => {
    setSquad(prev => prev.filter(x => x !== id));
    if (captainId === id) setCaptainId('');
    if (viceCaptainId === id) setViceCaptainId('');
  };
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setSquad(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };
  const moveDown = (idx: number) => {
    setSquad(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const handleSave = async () => {
    if (squad.length === 0) {
      alert('Add at least one player to the playing squad');
      return;
    }
    setSaving(true);
    try {
      await updateMatch(
        match.id,
        {
          captain_id: captainId || null,
          vice_captain_id: viceCaptainId || null,
        },
        squad,  // playerIds in order
      );
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to save squad. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleShareWhatsApp = () => {
    const xi = squad.map((id, i) => `${i + 1}. ${memberById[id]?.name || '—'}${id === captainId ? ' (C)' : id === viceCaptainId ? ' (VC)' : ''}`).join('\n');
    const dateStr = new Date(match.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    // The link is the whole point. A squad list in the group is an
    // announcement; a squad list with a confirm link is a question that
    // answers itself back into the app.
    const link = `${APP_URL}/squad/${match.id}`;
    const msg = `🏏 *SCC Squad* 🏏\n\n📅 ${dateStr}\n📍 ${match.venue}${match.opponent ? `\nvs ${match.opponent}` : ''}\n\n*Playing 12:*\n${xi}\n\nTap to confirm you're playing 👇\n${link}\n\n- Sangria Cricket Club`;
    if (navigator.share) {
      navigator.share({ text: msg }).catch(() => navigator.clipboard.writeText(msg));
    } else {
      navigator.clipboard.writeText(msg);
      alert('Squad copied to clipboard!');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Squad Selector" size="lg">
      <div className="space-y-4">

        {/* Match info */}
        <div className="r-card bg-gray-50 dark:bg-gray-800 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="t-meta font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400">
              {match.match_type === 'internal' ? '🏏 Internal Match' : `vs ${match.opponent || 'TBD'}`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(match.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {match.venue}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-black tabular-nums ${
              squad.length === 12 ? 'text-emerald-600 dark:text-emerald-400'
              : squad.length > 12 ? 'text-red-600 dark:text-red-400'
              : 'text-amber-600 dark:text-amber-400'
            }`}>
              {squad.length} / 12
            </span>
            {/* An internal fixture needs BOTH squads, so the total is the wrong
                number to watch: 12 players all from Brahmos is not a match. */}
            {match.match_type === 'internal' && (() => {
              const b = squad.filter(id => memberById[id]?.jersey_team === 'brahmos').length;
              const a = squad.filter(id => memberById[id]?.jersey_team === 'agni').length;
              const even = Math.abs(b - a) <= 1;
              return (
                <span className={`t-micro font-black px-2 py-0.5 rounded-full ${
                  even ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                       : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}`}>
                  B{b} · A{a}
                </span>
              );
            })()}
            <span className="text-xs text-gray-400">selected</span>
          </div>
        </div>

        {/* Auto-pick + Search bar */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={autoPickSquad}>
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Auto-pick from poll
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSquad([])} disabled={squad.length === 0}>
            <X className="w-3.5 h-3.5 mr-1.5" />
            Clear
          </Button>
          <div className="flex-1" />
          <Input
            placeholder="Search members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="!w-48"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* ── PLAYING XI (left) ─────────────────────────────────────────── */}
          <Card className="border-emerald-300 dark:border-emerald-800 p-3 bg-emerald-50/30 dark:bg-emerald-900/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5" fill="currentColor" />
                Playing Squad ({squad.length})
              </h3>
            </div>
            {squad.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-8 text-center">
                Tap "Auto-pick" or add players from the right →
              </p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {squad.map((id, idx) => {
                  const m = memberById[id];
                  if (!m) return null;
                  return (
                    <div key={id} className="flex items-center gap-2 px-2 py-1.5 r-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 group">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 t-micro font-black text-emerald-700 dark:text-emerald-300 flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="t-micro font-bold text-primary-600">{m.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                          <span className={`inline-block mr-1.5 t-micro font-black uppercase tracking-wider
                                            px-1.5 py-0.5 rounded-full align-middle ${tierOf(m.id).chip}`}>
                            {tierOf(m.id).label}
                          </span>
                          {m.name}
                          {m.role && <span className="ml-1 text-gray-400">{ROLE_ICON[m.role]}</span>}
                          {captainId === id && <span className="ml-1 t-micro font-black text-amber-600">C</span>}
                          {viceCaptainId === id && <span className="ml-1 t-micro font-black text-blue-600">VC</span>}
                        </p>
                      </div>
                      <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30">
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => moveDown(idx)} disabled={idx === squad.length - 1} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30">
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <button onClick={() => removeFromSquad(id)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Captain / VC pickers */}
            {squad.length > 0 && (
              <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800/40 grid grid-cols-2 gap-2">
                <div>
                  <label className="t-micro font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Crown className="w-3 h-3" fill="currentColor" /> Captain
                  </label>
                  <select
                    value={captainId}
                    onChange={e => setCaptainId(e.target.value)}
                    className="w-full mt-1 text-xs px-2 py-1.5 r-control border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  >
                    <option value="">— None —</option>
                    {squad.map(id => (
                      <option key={id} value={id}>{memberById[id]?.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="t-micro font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Vice-Captain
                  </label>
                  <select
                    value={viceCaptainId}
                    onChange={e => setViceCaptainId(e.target.value)}
                    className="w-full mt-1 text-xs px-2 py-1.5 r-control border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  >
                    <option value="">— None —</option>
                    {squad.filter(id => id !== captainId).map(id => (
                      <option key={id} value={id}>{memberById[id]?.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </Card>

          {/* ── BENCH (right) ─────────────────────────────────────────────── */}
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2 gap-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Bench ({benchMembers.length})
              </h3>
              <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 r-card p-0.5">
                {(['all', 'available', 'maybe'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2 py-0.5 t-micro rounded font-bold uppercase tracking-wider ${
                      filter === f
                        ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                        : 'text-gray-500'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'available' ? '✓ In' : '? Maybe'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1 max-h-96 overflow-y-auto">
              {benchMembers.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-8 text-center">No more players</p>
              ) : (
                benchMembers.map(m => {
                  const resp = pollByMember[m.id]?.response;
                  const meta = resp ? RESPONSE_META[resp] : null;
                  const note = pollByMember[m.id]?.note;
                  return (
                    <button
                      key={m.id}
                      onClick={() => addToSquad(m.id)}
                      disabled={squad.length >= 12}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 r-control border transition-colors text-left ${
                        squad.length >= 12
                          ? 'opacity-40 cursor-not-allowed border-gray-200 dark:border-gray-700'
                          : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                      }`}
                    >
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <span className="t-micro font-bold text-gray-600 dark:text-gray-300">{m.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                          {m.name}
                          {m.role && <span className="ml-1 text-gray-400">{ROLE_ICON[m.role]}</span>}
                          {m.jersey_number != null && <span className="ml-1 t-micro text-gray-400">#{m.jersey_number}</span>}
                          {/* Stated where the decision is made. They can still
                              be picked — people come back early — but never
                              without the captain seeing it. */}
                          {away.has(m.id) && (
                            <span className="ml-1.5 t-micro px-1.5 py-0.5 rounded-full font-black
                                             bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                              AWAY
                            </span>
                          )}
                        </p>
                        {note && <p className="t-micro text-gray-400 italic truncate">"{note}"</p>}
                      </div>
                      {meta && (
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full t-micro font-black ${meta.bg} ${meta.color}`}>
                          <meta.icon className="w-2.5 h-2.5" />
                          {meta.label}
                        </span>
                      )}
                      <Check className="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100" />
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={handleShareWhatsApp} variant="secondary" disabled={squad.length === 0}>
            <Send className="w-4 h-4 mr-1.5" /> Share to WhatsApp
          </Button>
          <Button variant="secondary" onClick={onClose}>
            <X className="w-4 h-4 mr-1.5" /> Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save Squad
          </Button>
        </div>

        <p className="t-meta text-gray-400 text-center">
          Tip: tap "Auto-pick" to fill the 12 based on who said "I'm in" on the poll.
        </p>
      </div>
    </Modal>
  );
}

export default SquadSelectorModal;
