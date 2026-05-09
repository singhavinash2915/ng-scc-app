import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Trophy, Crown, Star, ChevronLeft, Camera, Calendar as CalIcon,
  Cake, Award, TrendingUp, Zap, Shield, Sparkles, Lock,
  CheckCircle2,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useCricketStats } from '../hooks/useCricketStats';
import { useMOMCounts } from '../hooks/useMOMCounts';
import { useFormGuide, type FormResult } from '../hooks/useFormGuide';
import { useMatchPhotos } from '../hooks/useMatchPhotos';
import { useAchievements, type Achievement } from '../hooks/useAchievements';
import { useMatchMemories } from '../hooks/useMatchMemories';

const ROLE_LABEL: Record<string, string> = {
  batsman: '🏏 Batsman',
  bowler: '⚡ Bowler',
  all_rounder: '🌟 All-rounder',
  wicket_keeper: '🧤 Wicket-keeper',
};
const TIER_GRADIENT: Record<string, string> = {
  bronze:  'linear-gradient(135deg, #92400e 0%, #1a0f05 100%)',
  silver:  'linear-gradient(135deg, #475569 0%, #0f172a 100%)',
  gold:    'linear-gradient(135deg, #b45309 0%, #1a0f05 100%)',
  diamond: 'linear-gradient(135deg, #1e40af 0%, #831843 100%)',
};
const TIER_BORDER: Record<string, string> = {
  bronze:  'rgba(180,83,9,0.5)',
  silver:  'rgba(148,163,184,0.5)',
  gold:    'rgba(251,191,36,0.6)',
  diamond: 'rgba(168,85,247,0.6)',
};

function FormDots({ form }: { form: FormResult[] | undefined }) {
  if (!form || form.length === 0) return null;
  return (
    <span className="inline-flex gap-1">
      {form.map((r, i) => (
        <span key={i} className={`w-2.5 h-2.5 rounded-full ${
          r === 'won' ? 'bg-emerald-500' : r === 'lost' ? 'bg-red-500' : 'bg-amber-500'
        }`} />
      ))}
    </span>
  );
}

function AchievementCard({ a }: { a: Achievement }) {
  const tierColor = a.tier ? TIER_GRADIENT[a.tier] : TIER_GRADIENT.bronze;
  const tierBorder = a.tier ? TIER_BORDER[a.tier] : TIER_BORDER.bronze;
  const pct = a.progress ? Math.min(100, (a.progress.current / a.progress.target) * 100) : (a.unlocked ? 100 : 0);

  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 transition-all ${a.unlocked ? '' : 'opacity-50 grayscale'}`}
         style={{ background: a.unlocked ? tierColor : 'linear-gradient(135deg, #1f2937 0%, #0a1019 100%)' }}>
      <div className="absolute inset-0 rounded-2xl pointer-events-none"
           style={{ border: `1px solid ${a.unlocked ? tierBorder : 'rgba(75,85,99,0.3)'}` }} />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="text-3xl mb-2">{a.unlocked ? a.emoji : '🔒'}</div>
          {a.tier && a.unlocked && (
            <span className="text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded-full bg-white/10 text-white/80">
              {a.tier}
            </span>
          )}
        </div>
        <h4 className={`font-black text-sm leading-tight ${a.unlocked ? 'text-white' : 'text-gray-400'}`}>
          {a.title}
        </h4>
        <p className={`text-[11px] mt-1 leading-snug ${a.unlocked ? 'text-white/60' : 'text-gray-500'}`}>
          {a.desc}
        </p>
        {a.progress && !a.unlocked && (
          <>
            <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[10px] text-emerald-400 mt-1 tabular-nums">
              {a.progress.current} / {a.progress.target}
            </p>
          </>
        )}
        {a.unlocked && (
          <div className="absolute top-2 right-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" fill="currentColor" />
          </div>
        )}
      </div>
    </div>
  );
}

type Tab = 'overview' | 'achievements' | 'photos' | 'memories' | 'matches';

export function MemberProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { members } = useMembers();
  const { matches } = useMatches();
  const { stats } = useCricketStats('2025-26');
  const { counts: momCounts } = useMOMCounts();
  const { formByMember } = useFormGuide();
  const { photos } = useMatchPhotos();
  const [tab, setTab] = useState<Tab>('overview');

  const member = members.find(m => m.id === id);
  const memberStats = stats.find(s => s.member_id === id);
  const moms = momCounts[id || ''] || 0;
  const form = formByMember[id || ''];
  const matchesPlayed = useMemo(() => {
    return matches.filter(m =>
      ['won', 'lost', 'draw'].includes(m.result) &&
      m.players?.some(p => p.member_id === id)
    );
  }, [matches, id]);
  const memories = useMatchMemories(matches, id);
  const achievements = useAchievements(memberStats, moms, matchesPlayed.length);

  // Photos from matches this member played in
  const memberPhotos = useMemo(() => {
    const matchIds = new Set(matchesPlayed.map(m => m.id));
    return photos.filter(p => matchIds.has(p.match_id));
  }, [photos, matchesPlayed]);

  // Win rate (when this member played)
  const winRate = useMemo(() => {
    const ext = matchesPlayed.filter(m => m.match_type === 'external');
    const won = ext.filter(m => m.result === 'won').length;
    return ext.length > 0 ? Math.round((won / ext.length) * 100) : 0;
  }, [matchesPlayed]);

  if (!member) {
    return (
      <div>
        <Header title="Profile" />
        <div className="p-8 text-center">
          <Lock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Player not found.</p>
          <button onClick={() => navigate('/members')} className="mt-4 text-primary-600 font-bold">
            ← Back to Members
          </button>
        </div>
      </div>
    );
  }

  const dismissals = (memberStats?.fielding_catches || 0) + (memberStats?.fielding_stumpings || 0) + (memberStats?.fielding_run_outs || 0);
  const unlockedCount = achievements.filter(a => a.unlocked).length;

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'overview', label: 'Overview', icon: <Star className="w-3.5 h-3.5" /> },
    { id: 'achievements', label: 'Achievements', icon: <Award className="w-3.5 h-3.5" />, count: unlockedCount },
    { id: 'photos', label: 'Photos', icon: <Camera className="w-3.5 h-3.5" />, count: memberPhotos.length },
    { id: 'memories', label: 'Memories', icon: <CalIcon className="w-3.5 h-3.5" />, count: memories.length },
    { id: 'matches', label: 'Matches', icon: <Trophy className="w-3.5 h-3.5" />, count: matchesPlayed.length },
  ];

  return (
    <div>
      <Header title={member.name} subtitle="Player profile" />

      <div className="p-4 lg:p-8 space-y-5 max-w-5xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-gray-500 hover:text-primary-600 flex items-center gap-1 font-semibold"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl shadow-2xl"
             style={{ background: 'radial-gradient(800px circle at 0% 0%, rgba(16,185,129,0.3), transparent 50%), radial-gradient(600px circle at 100% 100%, rgba(59,130,246,0.25), transparent 60%), linear-gradient(135deg, #061122 0%, #0a1019 100%)' }}>
          <div className="absolute inset-0 border border-emerald-500/20 rounded-3xl pointer-events-none" />
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-400/15 rounded-full blur-3xl" />

          <div className="relative p-6 lg:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {member.avatar_url ? (
              <img src={member.avatar_url} alt={member.name}
                   className="w-28 h-28 lg:w-32 lg:h-32 rounded-3xl object-cover border-[3px] border-emerald-400/40 shadow-xl shadow-emerald-500/30 flex-shrink-0" />
            ) : (
              <div className="w-28 h-28 lg:w-32 lg:h-32 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 border-[3px] border-emerald-400/40 flex items-center justify-center shadow-xl shadow-emerald-500/30 flex-shrink-0">
                <span className="text-5xl font-black text-emerald-950">{member.name.charAt(0)}</span>
              </div>
            )}

            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight"
                    style={{ background: 'linear-gradient(180deg, #fff, #6ee7b7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {member.name}
                </h1>
                {member.jersey_number != null && (
                  <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-white/90 text-xs font-black tabular-nums">
                    #{member.jersey_number}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start flex-wrap">
                {member.role && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                    {ROLE_LABEL[member.role] || member.role}
                  </span>
                )}
                {moms > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[11px] font-black">
                    <Crown className="w-3 h-3" fill="currentColor" />
                    {moms} MOM{moms > 1 ? 's' : ''}
                  </span>
                )}
                {member.status === 'inactive' && (
                  <span className="px-2 py-0.5 rounded-full bg-gray-500/15 border border-gray-500/30 text-gray-300 text-[11px] font-bold">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-xs mt-2">
                Member since {new Date(member.join_date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                {member.birthday && (
                  <> · 🎂 {new Date(member.birthday).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</>
                )}
              </p>

              {/* Quick stat strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                <Pill v={memberStats?.batting_runs || 0} label="Runs" color="text-blue-300" />
                <Pill v={memberStats?.bowling_wickets || 0} label="Wickets" color="text-red-300" />
                <Pill v={dismissals} label="Dismissals" color="text-emerald-300" />
                <Pill v={`${winRate}%`} label="Win Rate" color="text-amber-300" />
              </div>

              {form && form.length > 0 && (
                <div className="mt-4 flex items-center gap-2 justify-center sm:justify-start">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Recent form</span>
                  <FormDots form={form} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── TABS ───────────────────────────────────────────────────── */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-gray-800 overflow-x-auto">
          {tabs.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
                {t.count != null && t.count > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── TAB CONTENT ────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {memberStats ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <BigStatCard icon={<TrendingUp className="w-3.5 h-3.5 text-blue-300" />} label="Highest Score"
                  value={memberStats.batting_highest_score?.toString() || '—'}
                  subtitle={`${memberStats.batting_innings} innings · avg ${memberStats.batting_average?.toFixed(1) || '—'}`}
                  gradient="linear-gradient(135deg, #1e3a8a 0%, #0a1019 100%)" />
                <BigStatCard icon={<Zap className="w-3.5 h-3.5 text-red-300" fill="currentColor" />} label="Best Bowling"
                  value={memberStats.bowling_best_figures || '—'}
                  subtitle={memberStats.bowling_economy > 0 ? `Eco ${memberStats.bowling_economy.toFixed(2)}` : `${memberStats.bowling_overs?.toFixed(1) || 0} overs`}
                  gradient="linear-gradient(135deg, #7f1d1d 0%, #0a1019 100%)" />
                <BigStatCard icon={<Shield className="w-3.5 h-3.5 text-emerald-300" />} label="Catches"
                  value={memberStats.fielding_catches}
                  subtitle={`${memberStats.fielding_stumpings || 0} st · ${memberStats.fielding_run_outs || 0} ro`}
                  gradient="linear-gradient(135deg, #065f46 0%, #0a1019 100%)" />
                <BigStatCard icon={<Crown className="w-3.5 h-3.5 text-amber-300" fill="currentColor" />} label="MOM Awards"
                  value={moms}
                  subtitle={moms === 0 ? 'None yet' : moms === 1 ? 'this season' : 'this season'}
                  gradient="linear-gradient(135deg, #78350f 0%, #0a1019 100%)" />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center">
                <p className="text-sm text-gray-500">No stats yet for this season — wait for the first match to be played!</p>
              </div>
            )}

            {/* Latest unlocks */}
            {unlockedCount > 0 && (
              <div>
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[2px] mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Recent achievements
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {achievements.filter(a => a.unlocked).slice(0, 4).map(a => (
                    <AchievementCard key={a.id} a={a} />
                  ))}
                </div>
              </div>
            )}

            {/* This-day memories */}
            {memories.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[2px] mb-2 flex items-center gap-1.5">
                  <CalIcon className="w-3.5 h-3.5 text-pink-400" />
                  On this day
                </h3>
                <div className="space-y-2">
                  {memories.slice(0, 3).map(m => (
                    <MemoryCard key={m.match.id} memory={m} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'achievements' && (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              <span className="font-black text-emerald-600 dark:text-emerald-400">{unlockedCount}</span> of {achievements.length} unlocked this season
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {achievements.map(a => <AchievementCard key={a.id} a={a} />)}
            </div>
          </div>
        )}

        {tab === 'photos' && (
          <div>
            {memberPhotos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
                <Camera className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No match photos featuring {member.name.split(' ')[0]} yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {memberPhotos.map(p => (
                  <a key={p.id} href={p.photo_url} target="_blank" rel="noopener noreferrer"
                     className="group relative aspect-square rounded-xl overflow-hidden">
                    <img src={p.photo_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    {p.match && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-[10px] text-white font-bold truncate">vs {p.match.opponent || '—'}</p>
                        <p className="text-[9px] text-white/60">{new Date(p.match.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'memories' && (
          <div>
            {memories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
                <Cake className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No matches on this date in past years (yet!).</p>
                <p className="text-xs text-gray-400 mt-1">Check back another day — every match becomes a memory eventually.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  📅 <span className="font-bold">{memories.length} match{memories.length > 1 ? 'es' : ''}</span> on this day in past years
                </p>
                {memories.map(m => <MemoryCard key={m.match.id} memory={m} />)}
              </div>
            )}
          </div>
        )}

        {tab === 'matches' && (
          <div>
            {matchesPlayed.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
                <p className="text-sm text-gray-500">No matches played yet.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {matchesPlayed.slice(0, 50).map(m => (
                  <Link key={m.id} to="/matches" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-black text-white flex-shrink-0 ${
                      m.result === 'won' ? 'bg-emerald-500'
                      : m.result === 'lost' ? 'bg-red-500'
                      : 'bg-amber-500'
                    }`}>
                      {m.result === 'won' ? 'W' : m.result === 'lost' ? 'L' : 'D'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">vs {m.opponent || 'TBD'}</p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {m.our_score && ` · ${m.our_score}`}
                      </p>
                    </div>
                    {m.man_of_match_id === id && (
                      <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" fill="currentColor" />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────
function Pill({ v, label, color }: { v: number | string; label: string; color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
      <p className={`text-2xl lg:text-3xl font-black tabular-nums leading-none ${color}`}>{v}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1.5 font-bold">{label}</p>
    </div>
  );
}

function BigStatCard({ icon, label, value, subtitle, gradient }: {
  icon: React.ReactNode; label: string; value: string | number; subtitle: string; gradient: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4" style={{ background: gradient }}>
      <div className="absolute inset-0 rounded-2xl pointer-events-none border border-white/10" />
      <div className="flex items-center gap-1.5 mb-2 relative">
        {icon}
        <span className="text-white/70 text-[10px] font-bold uppercase tracking-[1.5px]">{label}</span>
      </div>
      <p className="text-3xl font-black text-white tabular-nums leading-none">{value}</p>
      <p className="text-[11px] text-white/50 mt-1.5">{subtitle}</p>
    </div>
  );
}

function MemoryCard({ memory }: { memory: { match: import('../types').Match; yearsAgo: number } }) {
  const m = memory.match;
  return (
    <div className="rounded-xl border border-pink-200 dark:border-pink-900/30 bg-pink-50 dark:bg-pink-900/10 p-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center flex-shrink-0">
        <span className="text-lg">🗓️</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-pink-600 dark:text-pink-400">
          {memory.yearsAgo === 1 ? '1 year ago' : `${memory.yearsAgo} years ago`}
        </p>
        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
          {m.match_type === 'internal' ? 'Internal Match' : `vs ${m.opponent || 'TBD'}`}
          <span className={`ml-2 text-xs font-black ${
            m.result === 'won' ? 'text-emerald-600' : m.result === 'lost' ? 'text-red-600' : 'text-amber-600'
          }`}>{m.result.toUpperCase()}</span>
        </p>
        {m.our_score && (
          <p className="text-[11px] text-gray-500 truncate">{m.our_score} {m.opponent_score && `vs ${m.opponent_score}`}</p>
        )}
      </div>
    </div>
  );
}

export default MemberProfile;
