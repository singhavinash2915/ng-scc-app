import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Check, Lock, PartyPopper, ArrowLeft } from 'lucide-react';
import { useSeasonAwards } from '../hooks/useSeasonAwards';
import { useMembers } from '../hooks/useMembers';
import { AWARDS_NIGHT } from '../config/awardsNight';
import { SCC_LOGO_DATA_URL } from '../assets/sccLogo';

// Public, no-login voting for the People's Awards. Open to anyone with the link
// (guests included). Each device gets a stable random voter id so it's one vote
// per category per device. Results stay hidden here — revealed on Awards Night.
const DEVICE_KEY = 'scc-vote-device-id';
const NAME_KEY = 'scc-vote-name';

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function SeasonAwardsVote() {
  const { categories, votes, vote, loading } = useSeasonAwards(AWARDS_NIGHT.season);
  const { members } = useMembers();

  const [deviceId] = useState(getDeviceId);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [nameEntered, setNameEntered] = useState(() => !!localStorage.getItem(NAME_KEY));
  const [saving, setSaving] = useState<string | null>(null);

  const nominees = useMemo(
    () => members.filter(m => m.status === 'active' || m.matches_played > 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );
  const myVotes = useMemo(
    () => new Map(votes.filter(v => v.voter_id === deviceId).map(v => [v.category_id, v.nominee_id])),
    [votes, deviceId],
  );
  const votedCount = categories.filter(c => myVotes.has(c.id)).length;

  async function cast(categoryId: string, nomineeId: string) {
    if (!nomineeId) return;
    setSaving(categoryId);
    try {
      await vote(categoryId, deviceId, nomineeId);
    } finally {
      setSaving(null);
    }
  }

  function confirmName() {
    const n = name.trim();
    if (!n) return;
    localStorage.setItem(NAME_KEY, n);
    setNameEntered(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0f3d] via-[#2d1550] to-[#3d1a3d] text-white">
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* Back to app */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white transition mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to app
        </Link>

        {/* Header */}
        <div className="text-center">
          <img src={SCC_LOGO_DATA_URL} alt="SCC" className="w-14 h-14 rounded-2xl mx-auto shadow-lg" />
          <div className="flex items-center justify-center gap-2 mt-4 text-amber-300">
            <Trophy className="w-5 h-5" fill="currentColor" />
            <span className="text-[11px] font-black uppercase tracking-[3px]">The People's Awards</span>
          </div>
          <h1 className="font-display text-2xl font-extrabold mt-1">Sangria Cricket Club</h1>
          <p className="text-white/60 text-sm mt-1">Season {AWARDS_NIGHT.season} · vote for the squad legends 🏏</p>
          <div className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-semibold text-amber-200 bg-white/10 rounded-full px-3 py-1">
            <Lock className="w-3 h-3" /> Winners revealed on Awards Night · {AWARDS_NIGHT.label}
          </div>
        </div>

        {/* Name gate */}
        {!nameEntered ? (
          <div className="mt-8 bg-white/10 rounded-2xl p-5 backdrop-blur">
            <label className="block text-sm font-semibold mb-2">👋 What's your name?</label>
            <p className="text-white/60 text-xs mb-3">So we know who's voting. No login needed — anyone can join in.</p>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmName()}
              placeholder="Your name"
              className="w-full rounded-xl bg-white/90 text-slate-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              onClick={confirmName}
              disabled={!name.trim()}
              className="w-full mt-3 rounded-xl bg-amber-400 text-slate-900 font-black py-3 text-sm disabled:opacity-40"
            >
              Start voting →
            </button>
          </div>
        ) : loading ? (
          <p className="text-center text-white/50 mt-10">Loading awards…</p>
        ) : categories.length === 0 ? (
          <div className="text-center mt-10 text-white/60">
            <PartyPopper className="w-10 h-10 mx-auto opacity-40" />
            <p className="mt-3">Voting isn't open yet. Check back soon!</p>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className="mt-6 flex items-center justify-between text-xs text-white/70">
              <span>Hi <span className="font-bold text-white">{name}</span> 👋</span>
              <span>{votedCount}/{categories.length} voted</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-1.5">
              <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${(votedCount / categories.length) * 100}%` }} />
            </div>

            {/* Categories */}
            <div className="mt-4 space-y-3">
              {categories.map(cat => {
                const myPick = myVotes.get(cat.id);
                return (
                  <div key={cat.id} className="bg-white/10 rounded-2xl p-4 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cat.emoji || '🏆'}</span>
                      <h3 className="font-bold text-sm flex-1">{cat.name}</h3>
                      {myPick && <Check className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <select
                      value={myPick || ''}
                      onChange={e => cast(cat.id, e.target.value)}
                      disabled={saving === cat.id}
                      className="w-full mt-3 rounded-xl bg-white/90 text-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
                    >
                      <option value="">{myPick ? 'Change your pick…' : 'Pick a player…'}</option>
                      {nominees.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    {myPick && (
                      <p className="text-[11px] text-emerald-300 mt-2">
                        ✓ Your vote is in{saving === cat.id ? '…' : ''} — you can change it anytime before the party.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 text-center text-xs text-white/50 pb-6">
              {votedCount === categories.length
                ? '🎉 All done! Thanks for voting. See the winners on Awards Night.'
                : 'Vote for every category — winners are revealed on Awards Night.'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
