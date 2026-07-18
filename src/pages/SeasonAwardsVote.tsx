import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Check, Lock, PartyPopper, ArrowLeft } from 'lucide-react';
import { useSeasonAwards } from '../hooks/useSeasonAwards';
import { useMembers } from '../hooks/useMembers';
import { AWARDS_NIGHT } from '../config/awardsNight';
import { SCC_LOGO_DATA_URL } from '../assets/sccLogo';

// Squad-only voting for the People's Awards. You vote AS a specific SCC member
// (picked from the squad list), so it's strictly one vote per member. Your phone
// is then bound to that member — you can't switch names to stuff extra votes,
// and a member already claimed by another phone can't be voted for again.
const DEVICE_KEY = 'scc-vote-device-id';
const MEMBER_KEY = 'scc-vote-member-id';

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
  const [myMemberId, setMyMemberId] = useState<string>(() => localStorage.getItem(MEMBER_KEY) || '');
  const [saving, setSaving] = useState<string | null>(null);
  const [claimError, setClaimError] = useState('');

  const nominees = useMemo(
    () => members.filter(m => m.status === 'active' || m.matches_played > 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );
  const myName = members.find(m => m.id === myMemberId)?.name || '';

  // Members already claimed by a DIFFERENT device — can't be voted for again.
  const claimedByOthers = useMemo(() => {
    const s = new Set<string>();
    votes.forEach(v => { if (v.device_id && v.device_id !== deviceId) s.add(v.voter_id); });
    return s;
  }, [votes, deviceId]);

  const myVotes = useMemo(
    () => new Map(votes.filter(v => v.voter_id === myMemberId).map(v => [v.category_id, v.nominee_id])),
    [votes, myMemberId],
  );
  const votedCount = categories.filter(c => myVotes.has(c.id)).length;

  async function cast(categoryId: string, nomineeId: string) {
    if (!nomineeId || !myMemberId || !AWARDS_NIGHT.votingOpen) return;
    setSaving(categoryId);
    try {
      await vote(categoryId, myMemberId, nomineeId, deviceId);
    } finally {
      setSaving(null);
    }
  }

  function pickMe(id: string) {
    if (!id) return;
    if (claimedByOthers.has(id)) {
      setClaimError('That member has already voted from another phone.');
      return;
    }
    setClaimError('');
    localStorage.setItem(MEMBER_KEY, id);
    setMyMemberId(id);
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

        {/* Voting closed — no more votes accepted */}
        {!AWARDS_NIGHT.votingOpen ? (
          <div className="mt-8 bg-white/10 rounded-2xl p-6 text-center backdrop-blur">
            <Lock className="w-10 h-10 mx-auto text-amber-300" />
            <p className="font-display text-xl font-extrabold mt-3">Voting has closed 🔒</p>
            <p className="text-white/60 text-sm mt-2">Thanks to everyone who voted! 🙌<br />The winners are revealed live at Awards Night · {AWARDS_NIGHT.label}. 🏆</p>
          </div>
        ) : /* Identity gate — pick yourself from the squad (one vote per member) */
        !myMemberId ? (
          <div className="mt-8 bg-white/10 rounded-2xl p-5 backdrop-blur">
            <label className="block text-sm font-semibold mb-2">👋 Who are you?</label>
            <p className="text-white/60 text-xs mb-3">Pick your name from the squad. You get <b>one vote per member</b>, and this phone locks to your name — so no one can vote twice.</p>
            <select
              value=""
              onChange={e => pickMe(e.target.value)}
              className="w-full rounded-xl bg-white/90 text-slate-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">Select your name…</option>
              {nominees.map(m => (
                <option key={m.id} value={m.id} disabled={claimedByOthers.has(m.id)}>
                  {m.name}{claimedByOthers.has(m.id) ? ' · already voted' : ''}
                </option>
              ))}
            </select>
            {claimError && <p className="text-rose-300 text-xs mt-2">🔒 {claimError}</p>}
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
              <span>Voting as <span className="font-bold text-white">{myName}</span> 👋</span>
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
