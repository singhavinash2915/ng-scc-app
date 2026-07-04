import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle, Trophy, Sparkles, TrendingUp, Star, BarChart2,
  Send, Trash2, Plus, Award, ChevronRight, Zap,
  ArrowUp, ArrowDown, Minus, CheckCircle,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { TradingCard } from '../components/TradingCard';
import { useMatches } from '../hooks/useMatches';
import { useMembers } from '../hooks/useMembers';
import { useCricketStats } from '../hooks/useCricketStats';
import { useMOMCounts } from '../hooks/useMOMCounts';
import { useAuth } from '../context/AuthContext';
import { useFantasyPoints, FANTASY_POINTS } from '../hooks/useFantasyPoints';
import { useMilestones } from '../hooks/useMilestones';
import { usePowerRankings } from '../hooks/usePowerRankings';
import { useMatchHighlights } from '../hooks/useMatchHighlights';
import { useMatchChat } from '../hooks/useMatchChat';
import { useClubPolls } from '../hooks/useClubPolls';
import { useSeasonAwards } from '../hooks/useSeasonAwards';
import { AWARDS_NIGHT, awardsRevealed, isAdminPreview } from '../config/awardsNight';

type Tab = 'fantasy' | 'rankings' | 'milestones' | 'highlights' | 'chat' | 'cards' | 'polls' | 'awards';

// ── Overall rating for trading cards (reused from Compare page logic) ────────
function computeOVR(s: { batting_runs: number; bowling_wickets: number; fielding_catches: number; batting_strike_rate: number }, moms: number): number {
  const batPts = Math.min(s.batting_runs / 20, 40) + Math.min(s.batting_strike_rate / 10, 15);
  const bowlPts = Math.min(s.bowling_wickets * 2, 30);
  const fieldPts = Math.min(s.fielding_catches, 10);
  const momPts = Math.min(moms * 3, 15);
  return Math.round(Math.min(batPts + bowlPts + fieldPts + momPts, 99));
}

export function EngagementHub() {
  const initialTab = (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab')) as Tab | null;
  const [tab, setTab] = useState<Tab>(initialTab || 'fantasy');
  const { matches } = useMatches();
  const { members } = useMembers();
  const { stats } = useCricketStats('2025-26');
  const { counts: momCounts } = useMOMCounts();
  const { isAdmin } = useAuth();

  const fantasyPlayers = useFantasyPoints(stats, members, momCounts);
  const milestones = useMilestones(stats, members, momCounts);
  const powerRankings = usePowerRankings(matches, members, stats, momCounts);
  const matchHighlights = useMatchHighlights(matches, members);

  // Live match for chat
  const todayMatch = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return matches.find(m => m.date === today && m.ch_match_id);
  }, [matches]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'fantasy',    label: 'Fantasy',    icon: <Zap className="w-3.5 h-3.5" /> },
    { id: 'rankings',   label: 'Rankings',   icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'milestones', label: 'Milestones', icon: <Star className="w-3.5 h-3.5" /> },
    { id: 'highlights', label: 'Highlights', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'chat',       label: 'Match Chat', icon: <MessageCircle className="w-3.5 h-3.5" />, badge: todayMatch ? 'LIVE' : undefined },
    { id: 'cards',      label: 'Cards',      icon: <Award className="w-3.5 h-3.5" /> },
    { id: 'polls',      label: 'Polls',      icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { id: 'awards',     label: 'Awards',     icon: <Trophy className="w-3.5 h-3.5" /> },
  ];

  return (
    <div>
      <Header title="Club Hub" subtitle="Fantasy, Rankings, Milestones & more" />
      <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                tab === t.id
                  ? 'bg-primary-600 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {t.icon}
              {t.label}
              {t.badge && (
                <span className="px-1 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-full animate-pulse">{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'fantasy' && <FantasyTab players={fantasyPlayers} />}
        {tab === 'rankings' && <RankingsTab rankings={powerRankings} />}
        {tab === 'milestones' && <MilestonesTab milestones={milestones} />}
        {tab === 'highlights' && <HighlightsTab highlights={matchHighlights} />}
        {tab === 'chat' && <ChatTab match={todayMatch} members={members} />}
        {tab === 'cards' && <CardsTab stats={stats} members={members} momCounts={momCounts} />}
        {tab === 'polls' && <PollsTab members={members} isAdmin={isAdmin} />}
        {tab === 'awards' && <AwardsTab members={members} isAdmin={isAdmin} />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1: FANTASY POINTS
// ══════════════════════════════════════════════════════════════════════════════
function FantasyTab({ players }: { players: ReturnType<typeof useFantasyPoints> }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-5 py-4">
          <h2 className="text-white text-lg font-black flex items-center gap-2"><Zap className="w-5 h-5" /> Fantasy Leaderboard</h2>
          <p className="text-indigo-200 text-xs mt-0.5">Season 2025-26 · Auto-calculated from match performance</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-2 flex items-center gap-4 text-[10px] text-gray-500 font-medium flex-wrap">
          <span>{FANTASY_POINTS.runPt}pt/run</span>
          <span>{FANTASY_POINTS.wicketPt}pt/wkt</span>
          <span>{FANTASY_POINTS.catchPt}pt/catch</span>
          <span>{FANTASY_POINTS.momBonus}pt MOM</span>
          <span>+{FANTASY_POINTS.fiftyBonus} for 50, +{FANTASY_POINTS.centuryBonus} for 100</span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {players.slice(0, 20).map((p, i) => (
            <Link key={p.member.id} to={`/profile/${p.member.id}`} className="block">
              <div className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                i === 0 ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
              }`}>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                  i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}>{i + 1}</span>
                {p.member.avatar_url ? (
                  <img src={p.member.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary-600">{p.member.name.charAt(0)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{p.member.name}</p>
                  <p className="text-[10px] text-gray-500">
                    🏏{p.breakdown.batting} · ⚡{p.breakdown.bowling} · 🧤{p.breakdown.fielding}{p.breakdown.bonus > 0 ? ` · ⭐${p.breakdown.bonus}` : ''}
                  </p>
                </div>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{p.total}</span>
                <span className="text-[9px] text-gray-400 font-bold">PTS</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2: POWER RANKINGS
// ══════════════════════════════════════════════════════════════════════════════
function RankingsTab({ rankings }: { rankings: ReturnType<typeof usePowerRankings> }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-4">
          <h2 className="text-white text-lg font-black flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Power Rankings</h2>
          <p className="text-emerald-200 text-xs mt-0.5">Weighted by recent form (60%) + season performance (40%)</p>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {rankings.map((p, i) => (
            <Link key={p.member.id} to={`/profile/${p.member.id}`} className="block">
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                  i === 0 ? 'bg-emerald-500 text-white' : i === 1 ? 'bg-gray-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}>{p.rank}</span>
                {p.member.avatar_url ? (
                  <img src={p.member.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary-600">{p.member.name.charAt(0)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{p.member.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>Form: {Math.round(p.recentForm)}</span>
                    <span>·</span>
                    <span>Season: {Math.round(p.seasonPoints)}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 flex items-center gap-2">
                  {p.movement > 0 ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />
                   : p.movement < 0 ? <ArrowDown className="w-3.5 h-3.5 text-red-500" />
                   : <Minus className="w-3 h-3 text-gray-400" />}
                  <div className={`px-2.5 py-1 rounded-lg font-black text-sm tabular-nums ${
                    p.rating >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : p.rating >= 60 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : p.rating >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>{p.rating}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3: MILESTONES
// ══════════════════════════════════════════════════════════════════════════════
function MilestonesTab({ milestones }: { milestones: ReturnType<typeof useMilestones> }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-500" fill="currentColor" /> Career Milestones
      </h2>
      {milestones.length === 0 && (
        <p className="text-center text-gray-400 py-8">No milestones reached yet.</p>
      )}
      {milestones.slice(0, 30).map(m => (
        <Link key={m.id} to={`/profile/${m.memberId}`} className="block">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
            <span className="text-2xl flex-shrink-0">{m.emoji}</span>
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-amber-600">{m.memberName.charAt(0)}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-gray-900 dark:text-white">{m.title}</p>
              <p className="text-xs text-gray-500">{m.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4: MATCH HIGHLIGHTS
// ══════════════════════════════════════════════════════════════════════════════
function HighlightsTab({ highlights }: { highlights: ReturnType<typeof useMatchHighlights> }) {
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-500" /> Match Highlights
      </h2>
      {highlights.slice(0, 10).map(h => (
        <div key={h.matchId} className={`rounded-2xl overflow-hidden border ${
          h.result === 'won' ? 'border-emerald-200 dark:border-emerald-900/50'
          : h.result === 'lost' ? 'border-red-200 dark:border-red-900/50'
          : 'border-gray-200 dark:border-gray-700'
        }`}>
          <div className={`px-4 py-2.5 flex items-center justify-between ${
            h.result === 'won' ? 'bg-emerald-50 dark:bg-emerald-900/20'
            : h.result === 'lost' ? 'bg-red-50 dark:bg-red-900/20'
            : 'bg-gray-50 dark:bg-gray-800'
          }`}>
            <div>
              <p className="text-xs font-bold text-gray-800 dark:text-white">vs {h.opponent}</p>
              <p className="text-[10px] text-gray-500">{fmtDate(h.date)} · {h.venue}</p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
              h.result === 'won' ? 'bg-emerald-500 text-white' : h.result === 'lost' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
            }`}>{h.result === 'draw' ? 'NR' : h.result}</span>
          </div>
          <div className="px-4 py-3 bg-white dark:bg-gray-900 space-y-1.5">
            {h.highlights.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="text-base">{item.emoji}</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase w-16 flex-shrink-0">{item.label}</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 5: MATCH DAY CHAT
// ══════════════════════════════════════════════════════════════════════════════
function ChatTab({ match, members }: { match: ReturnType<typeof useMatches>['matches'][0] | undefined; members: ReturnType<typeof useMembers>['members'] }) {
  const [myId, setMyId] = useState<string>(() => localStorage.getItem('scc-chat-member-id') || '');
  const [msg, setMsg] = useState('');
  const { messages, sendMessage } = useMatchChat(match?.id || '');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!match) {
    return (
      <div className="text-center py-12">
        <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No match today</p>
        <p className="text-xs text-gray-400 mt-1">Match Day Chat activates on game day</p>
      </div>
    );
  }

  const handleSend = async () => {
    if (!msg.trim() || !myId) return;
    await sendMessage(myId, msg.trim());
    setMsg('');
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 px-4 py-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <h2 className="text-white text-sm font-black">LIVE — vs {match.opponent}</h2>
        </div>

        {/* Member selector */}
        {!myId && (
          <div className="p-4 bg-white dark:bg-gray-900">
            <select
              value={myId}
              onChange={e => { setMyId(e.target.value); localStorage.setItem('scc-chat-member-id', e.target.value); }}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm"
            >
              <option value="">Select your name to chat</option>
              {members.sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Messages */}
        <div className="bg-gray-50 dark:bg-gray-950 p-3 max-h-[400px] overflow-y-auto space-y-2">
          {messages.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-6">Be the first to send a message! 🏏</p>
          )}
          {messages.map(m => {
            const isMe = m.member_id === myId;
            return (
              <div key={m.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                  isMe ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                }`}>
                  {!isMe && (
                    <p className="text-[10px] font-bold text-primary-600 dark:text-primary-400 mb-0.5">
                      {(m.member as { name?: string } | undefined)?.name || 'Member'}
                    </p>
                  )}
                  <p className="text-sm">{m.emoji || m.message}</p>
                  <p className={`text-[9px] mt-0.5 ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                    {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        {myId && (
          <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-1">
              {['🔥', '💪', '🏆', '😊', '👏', '😤'].map(e => (
                <button key={e} onClick={() => sendMessage(myId, e, e)}
                  className="text-lg hover:scale-125 transition-transform">{e}</button>
              ))}
            </div>
            <input
              value={msg} onChange={e => setMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="flex-1 rounded-full bg-gray-100 dark:bg-gray-800 px-4 py-2 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <button onClick={handleSend} disabled={!msg.trim()}
              className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center disabled:opacity-40">
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 6: TRADING CARDS
// ══════════════════════════════════════════════════════════════════════════════
function CardsTab({ stats, members, momCounts }: { stats: ReturnType<typeof useCricketStats>['stats']; members: ReturnType<typeof useMembers>['members']; momCounts: Record<string, number> }) {
  const statsByMember = useMemo(() => {
    const m: Record<string, typeof stats[0]> = {};
    stats.forEach(s => { m[s.member_id] = s; });
    return m;
  }, [stats]);

  const playersWithStats = useMemo(() =>
    members
      .filter(m => statsByMember[m.id])
      .map(m => ({ member: m, stats: statsByMember[m.id], momCount: momCounts[m.id] || 0, rating: computeOVR(statsByMember[m.id], momCounts[m.id] || 0) }))
      .sort((a, b) => b.rating - a.rating),
    [members, statsByMember, momCounts]
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
        <Award className="w-5 h-5 text-blue-500" /> Player Trading Cards
      </h2>
      <p className="text-xs text-gray-500">Tap a card to view full profile</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 justify-items-center">
        {playersWithStats.slice(0, 20).map(p => (
          <Link key={p.member.id} to={`/profile/${p.member.id}`}>
            <TradingCard member={p.member} stats={p.stats} momCount={p.momCount} rating={p.rating} />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 7: POLLS & QUIZZES
// ══════════════════════════════════════════════════════════════════════════════
function PollsTab({ isAdmin }: { members: ReturnType<typeof useMembers>['members']; isAdmin: boolean }) {
  const { polls, votes, createPoll, vote, deletePoll, getResults } = useClubPolls();
  const [showCreate, setShowCreate] = useState(false);
  const [myId] = useState<string>(() => localStorage.getItem('scc-chat-member-id') || '');
  const [form, setForm] = useState({ question: '', options: ['', ''], type: 'poll' as 'poll' | 'quiz' });

  const addOption = () => setForm(f => ({ ...f, options: [...f.options, ''] }));
  const handleCreate = async () => {
    if (!form.question.trim() || form.options.filter(o => o.trim()).length < 2) return;
    await createPoll({
      question: form.question.trim(),
      type: form.type,
      options: form.options.filter(o => o.trim()).map(text => ({ text: text.trim() })),
      category: 'fun',
      expires_at: null,
      created_by: 'Admin',
    });
    setForm({ question: '', options: ['', ''], type: 'poll' });
    setShowCreate(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-cyan-500" /> Polls & Quizzes
        </h2>
        {isAdmin && (
          <Button onClick={() => setShowCreate(true)} className="text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> New Poll
          </Button>
        )}
      </div>

      {polls.length === 0 && (
        <p className="text-center text-gray-400 py-8">No active polls. {isAdmin ? 'Create one!' : 'Check back later!'}</p>
      )}

      {polls.map(poll => {
        const results = getResults(poll.id);
        const myVote = votes.find(v => v.poll_id === poll.id && v.member_id === myId);
        const totalVotes = results.reduce((s, r) => s + r.count, 0);

        return (
          <div key={poll.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-white dark:bg-gray-900">
              <div className="flex items-start justify-between">
                <p className="text-sm font-bold text-gray-900 dark:text-white flex-1">{poll.question}</p>
                {isAdmin && (
                  <button onClick={() => deletePoll(poll.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {poll.options.map((opt, oi) => {
                  const result = results.find(r => r.optionIndex === oi);
                  const count = result?.count || 0;
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  const isMyVote = myVote?.option_index === oi;

                  return (
                    <button
                      key={oi}
                      onClick={() => myId && vote(poll.id, myId, oi)}
                      disabled={!myId}
                      className={`w-full text-left rounded-xl px-3 py-2.5 border transition-all relative overflow-hidden ${
                        isMyVote
                          ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {totalVotes > 0 && (
                        <div className="absolute inset-0 bg-primary-100 dark:bg-primary-900/20 rounded-xl" style={{ width: `${pct}%` }} />
                      )}
                      <div className="relative flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800 dark:text-white flex items-center gap-1.5">
                          {isMyVote && <CheckCircle className="w-3.5 h-3.5 text-primary-500" />}
                          {opt.text}
                        </span>
                        {totalVotes > 0 && (
                          <span className="text-xs font-bold text-gray-500 tabular-nums">{pct}% ({count})</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
            </div>
          </div>
        );
      })}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Poll">
        <div className="space-y-3">
          <Input label="Question" value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} placeholder="Ask something fun..." />
          {form.options.map((opt, i) => (
            <Input key={i} label={`Option ${i + 1}`} value={opt}
              onChange={e => setForm(f => ({ ...f, options: f.options.map((o, j) => j === i ? e.target.value : o) }))}
              placeholder={`Option ${i + 1}`} />
          ))}
          {form.options.length < 4 && (
            <button onClick={addOption} className="text-xs text-primary-600 font-semibold">+ Add option</button>
          )}
          <Button onClick={handleCreate} className="w-full">Create Poll</Button>
        </div>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 8: SEASON AWARDS VOTING
// ══════════════════════════════════════════════════════════════════════════════
function AwardsTab({ members, isAdmin }: { members: ReturnType<typeof useMembers>['members']; isAdmin: boolean }) {
  const { categories, votes, createCategory, vote, deleteCategory, getResults } = useSeasonAwards();
  const [showCreate, setShowCreate] = useState(false);
  // Same identity key used app-wide ('scc-my-profile-id', set from Dashboard →
  // My Stats). Previously this tab checked a different, rarely-set key
  // ('scc-chat-member-id') so the vote picker never appeared for most members.
  const [myId, setMyId] = useState<string>(() => localStorage.getItem('scc-my-profile-id') || '');
  const [form, setForm] = useState({ name: '', emoji: '🏆' });
  const [copied, setCopied] = useState(false);
  const memberById = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members]);
  // Results stay sealed until Awards Night — only admins can peek early.
  const revealed = awardsRevealed(isAdmin);
  const voteUrl = `${window.location.origin}/vote`;

  const defaultCategories = [
    { name: "People's Champion (Fan MVP)", emoji: '👑' },
    { name: 'Funniest Player in the Squad', emoji: '😂' },
    { name: 'Loudest Appealer', emoji: '🎤' },
    { name: 'Best Celebration / Victory Dance', emoji: '🕺' },
    { name: 'Best Sledger (Friendly Trash Talk)', emoji: '🦴' },
    { name: 'Golden Duck Award (Best Sport About Getting Out)', emoji: '🦆' },
    { name: 'Most Fashionably Late', emoji: '⏰' },
    { name: 'Best Company Post-Match (Snacks & Stories MVP)', emoji: '🍕' },
    { name: 'Spirit of Cricket', emoji: '🤝' },
    { name: 'Main Character of the Season', emoji: '🎬' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" /> Season Awards 2025-26
        </h2>
        {isAdmin && (
          <Button onClick={() => setShowCreate(true)} className="text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Category
          </Button>
        )}
      </div>

      <p className="text-xs text-gray-500">The People's Awards — vote for who you think deserves each one. Have fun, keep it kind! 🏏</p>

      {/* Shareable public voting link — open to everyone, no login */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-200">📣 Share the voting link — open to all</p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70 truncate">{voteUrl}</p>
        </div>
        <button
          onClick={() => { navigator.clipboard?.writeText(voteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 text-white shrink-0"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      {/* Reveal status */}
      <div className={`rounded-xl p-2.5 text-center text-[11px] font-semibold ${
        revealed
          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
      }`}>
        {revealed
          ? (isAdminPreview(isAdmin)
              ? `🔓 Admin preview — results hidden from everyone else until Awards Night (${AWARDS_NIGHT.label})`
              : '🎉 Results are live!')
          : `🔒 Results are sealed until Awards Night · ${AWARDS_NIGHT.label}. Voting stays open till then!`}
      </div>

      {/* Identity picker — same flow as "My Stats"; shown until the member is known */}
      {!myId && (
        <div className="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-3">
          <select
            value=""
            onChange={e => { if (e.target.value) { setMyId(e.target.value); localStorage.setItem('scc-my-profile-id', e.target.value); } }}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm"
          >
            <option value="">👋 Select your name to vote</option>
            {members.slice().sort((a, b) => a.name.localeCompare(b.name)).map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      {categories.length === 0 && isAdmin && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center">
          <p className="text-sm text-gray-500 mb-3">No award categories yet. Add the defaults?</p>
          <Button onClick={async () => { for (const c of defaultCategories) await createCategory(c.name, c.emoji); }}>
            Add Default Categories
          </Button>
        </div>
      )}

      {categories.map(cat => {
        const results = getResults(cat.id);
        const myVote = votes.find(v => v.category_id === cat.id && v.voter_id === myId);
        const totalVotes = results.reduce((s, r) => s + r.count, 0);
        const topNominees = results.slice(0, 5);

        return (
          <div key={cat.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{cat.emoji || '🏆'}</span>
                <h3 className="font-bold text-gray-800 dark:text-white text-sm">{cat.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 font-medium">
                  {revealed ? `${totalVotes} votes` : '🔒 sealed'}
                </span>
                {isAdmin && (
                  <button onClick={() => deleteCategory(cat.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                )}
              </div>
            </div>
            <div className="p-4 bg-white dark:bg-gray-900 space-y-3">
              {/* Vote selector */}
              {myId && (
                <select
                  value={myVote?.nominee_id || ''}
                  onChange={e => e.target.value && vote(cat.id, myId, e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm"
                >
                  <option value="">Cast your vote...</option>
                  {members.filter(m => m.status === 'active' || m.matches_played > 0).sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                    <option key={m.id} value={m.id}>{m.name}{myVote?.nominee_id === m.id ? ' ✓' : ''}</option>
                  ))}
                </select>
              )}

              {/* Results — sealed until Awards Night (admins can preview) */}
              {!revealed ? (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center py-1">
                  {myVote ? '✓ Your vote is locked in. ' : ''}Winners revealed on Awards Night 🎉
                </p>
              ) : topNominees.length > 0 && (
                <div className="space-y-1.5">
                  {topNominees.map((r, i) => {
                    const m = memberById[r.nominee_id];
                    if (!m) return null;
                    const pct = totalVotes > 0 ? Math.round((r.count / totalVotes) * 100) : 0;
                    return (
                      <div key={r.nominee_id} className="flex items-center gap-2.5">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                          i === 0 ? 'bg-amber-400 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                        }`}>{i + 1}</span>
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <span className="text-[10px] font-bold">{m.name.charAt(0)}</span>
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-800 dark:text-white flex-1 truncate">{m.name}</span>
                        <div className="w-20 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 tabular-nums w-8 text-right">{r.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Award Category">
        <div className="space-y-3">
          <Input label="Award Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Best Fielder" />
          <Input label="Emoji" value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} placeholder="🏆" />
          <Button onClick={async () => { await createCategory(form.name, form.emoji); setShowCreate(false); setForm({ name: '', emoji: '🏆' }); }} className="w-full">Create</Button>
        </div>
      </Modal>
    </div>
  );
}
