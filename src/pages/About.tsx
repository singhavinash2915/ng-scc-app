import { Link } from 'react-router-dom';
import {
  Trophy, Users, Calendar, MapPin, Phone, Mail, Instagram,
  Target, Heart, TrendingUp, Building2, ExternalLink,
  Star, Crown, Award, Zap, Shield, Sparkles, Send, Globe, ChevronRight,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useMemberActivity } from '../hooks/useMemberActivity';
import { useSponsor } from '../hooks/useSponsor';
import { useCricketStats } from '../hooks/useCricketStats';
import { useMOMCounts } from '../hooks/useMOMCounts';

export function About() {
  const { members } = useMembers();
  const { matches } = useMatches();
  const { activeCount } = useMemberActivity(members, matches);
  const { sponsors } = useSponsor();
  const { stats: cricketStats } = useCricketStats('2025-26');
  const { counts: momCounts } = useMOMCounts();

  // Quick stats
  const completedMatches = matches.filter(m => ['won', 'lost', 'draw'].includes(m.result) && m.match_type !== 'internal');
  const won = completedMatches.filter(m => m.result === 'won').length;
  const winRate = completedMatches.length > 0 ? Math.round((won / completedMatches.length) * 100) : 0;
  const totalRuns = cricketStats.reduce((sum, s) => sum + s.batting_runs, 0);
  const totalWkts = cricketStats.reduce((sum, s) => sum + s.bowling_wickets, 0);
  const totalMOMs = Object.values(momCounts).reduce((s, n) => s + n, 0);

  return (
    <div>
      <Header title="About SCC" subtitle="The story of Sangria Cricket Club" />

      <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">

        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl shadow-2xl">
          <div className="absolute inset-0"
               style={{ background: 'radial-gradient(800px circle at 0% 0%, rgba(16,185,129,0.35), transparent 50%), radial-gradient(600px circle at 100% 100%, rgba(20,184,166,0.25), transparent 60%), linear-gradient(135deg, #061122 0%, #0a1019 100%)' }} />
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='40' cy='40' r='30' fill='none' stroke='white' stroke-width='1'/%3E%3Ccircle cx='40' cy='40' r='15' fill='none' stroke='white' stroke-width='1'/%3E%3Ccircle cx='40' cy='40' r='3' fill='white'/%3E%3C/svg%3E")`,
            backgroundSize: '80px 80px',
          }} />
          <div className="absolute inset-0 border border-emerald-500/20 rounded-3xl pointer-events-none" />

          <div className="relative p-6 lg:p-12 text-center">
            <img src="/scc-logo.jpg" alt="SCC"
                 className="w-24 h-24 lg:w-32 lg:h-32 rounded-3xl mx-auto mb-6 shadow-2xl shadow-emerald-500/30 border-2 border-emerald-400/30" />
            <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tight"
                style={{ background: 'linear-gradient(180deg, #fff 30%, #6ee7b7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Sangria Cricket Club
            </h1>
            <p className="text-emerald-300/80 text-sm lg:text-base font-bold uppercase tracking-[3px] mt-3">
              Pune · Est. 2024 · Champions Play Here
            </p>
            <p className="text-gray-400 text-base lg:text-lg max-w-2xl mx-auto mt-6 leading-relaxed">
              Where weekend warriors become legends. A community of passionate cricketers
              who play hard, support harder, and celebrate every boundary together.
            </p>

            {/* Quick stat strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              <StatPill value={members.length} label="Members" color="text-blue-300" />
              <StatPill value={completedMatches.length} label="Matches" color="text-emerald-300" />
              <StatPill value={`${winRate}%`} label="Win Rate" color="text-amber-300" />
              <StatPill value={totalMOMs} label="MOM Awards" color="text-rose-300" />
            </div>
          </div>
        </div>

        {/* ── OUR STORY ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 relative overflow-hidden rounded-2xl p-6 lg:p-7"
               style={{ background: 'linear-gradient(135deg, #064e3b 0%, #0a1019 100%)' }}>
            <div className="absolute inset-0 border border-emerald-500/25 rounded-2xl pointer-events-none" />
            <h2 className="text-emerald-300/80 text-[10px] font-bold uppercase tracking-[2px] flex items-center gap-2">
              <Heart className="w-3.5 h-3.5" fill="currentColor" />
              Our Story
            </h2>
            <h3 className="text-2xl lg:text-3xl font-black text-white mt-2 tracking-tight">Built by players, for players</h3>
            <div className="mt-4 space-y-3 text-gray-300 text-sm lg:text-base leading-relaxed">
              <p>
                Sangria Cricket Club started as a friendly gathering of colleagues who shared
                one obsession — cricket. What began with weekend matches at Pune's local
                grounds has grown into a thriving community of {members.length}+ active
                cricketers who live and breathe the game.
              </p>
              <p>
                We play in tennis-ball tournaments across Pune, post our scorecards on
                CricHeroes, and run a transparent club where every member has a voice — and a balance sheet.
                From <span className="text-emerald-300 font-semibold">match-day polls</span> to{' '}
                <span className="text-amber-300 font-semibold">Man of the Match awards</span>, this app
                is how we keep the team organized, the finances clean, and the rivalry friendly.
              </p>
              <p className="text-gray-400 italic">
                One team. Two squads (Dhurandars 🦁 vs Bazigars 🐅). Endless cricket.
              </p>
            </div>
          </div>

          {/* Values column */}
          <div className="space-y-3">
            <ValueCard icon={<Target className="w-4 h-4" />} label="Fair Play"
              text="Every member has equal standing. Decisions are transparent."
              gradient="linear-gradient(135deg, #1e3a8a 0%, #0a1019 100%)" border="rgba(59,130,246,0.3)" />
            <ValueCard icon={<Sparkles className="w-4 h-4" />} label="Spirit of Cricket"
              text="We win with grace, lose with respect, and celebrate every player."
              gradient="linear-gradient(135deg, #4c1d95 0%, #0a1019 100%)" border="rgba(139,92,246,0.3)" />
            <ValueCard icon={<TrendingUp className="w-4 h-4" />} label="Get Better Together"
              text="Stats, leaderboards, AI insights — data that helps everyone grow."
              gradient="linear-gradient(135deg, #78350f 0%, #0a1019 100%)" border="rgba(251,191,36,0.3)" />
          </div>
        </div>

        {/* ── BY THE NUMBERS ───────────────────────────────────────────────── */}
        <div>
          <h2 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            Season 2025–26 · By the numbers
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <BigStat icon={<Users className="w-4 h-4" />} value={activeCount} label="Active Members"
              gradient="linear-gradient(135deg, #1e3a8a 0%, #0a1019 100%)" border="rgba(59,130,246,0.3)" accent="text-blue-300" />
            <BigStat icon={<Calendar className="w-4 h-4" />} value={completedMatches.length} label="Matches Played"
              gradient="linear-gradient(135deg, #065f46 0%, #0a1019 100%)" border="rgba(16,185,129,0.3)" accent="text-emerald-300" />
            <BigStat icon={<Zap className="w-4 h-4" />} value={totalRuns} label="Total Runs Scored"
              gradient="linear-gradient(135deg, #78350f 0%, #0a1019 100%)" border="rgba(251,191,36,0.3)" accent="text-amber-300" />
            <BigStat icon={<Shield className="w-4 h-4" />} value={totalWkts} label="Total Wickets"
              gradient="linear-gradient(135deg, #7f1d1d 0%, #0a1019 100%)" border="rgba(239,68,68,0.3)" accent="text-red-300" />
          </div>
        </div>

        {/* ── WHAT THIS APP DOES ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6 lg:p-7 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary-500" />
            <span className="text-[10px] font-bold uppercase tracking-[2px] text-gray-400 dark:text-gray-500">
              The SCC App
            </span>
          </div>
          <h3 className="text-xl lg:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Everything a cricket club needs, in one place
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Built specifically for SCC. Auto-syncs with CricHeroes. Open-source vibes.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icon: '🏏', title: 'Match Tracking', text: 'Every match — external & internal — with squad polls, photos, and scorecards' },
              { icon: '👥', title: 'Member Management', text: 'Profiles, roles, jersey numbers, and contact info for every player' },
              { icon: '💰', title: 'Transparent Finances', text: 'Member balances, match fees, expenses, and online payments via Razorpay' },
              { icon: '🏆', title: 'Live Leaderboard', text: 'Batting, bowling, fielding stats — auto-synced from CricHeroes daily' },
              { icon: '👑', title: 'Hall of Fame', text: 'Club records, MOM tally, Player of the Month, and custom awards' },
              { icon: '🤖', title: 'AI Coach Chat', text: 'Ask the AI about player form, match analysis, or who to pick' },
            ].map(f => (
              <div key={f.title} className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                <div className="text-2xl mb-2">{f.icon}</div>
                <h4 className="font-bold text-gray-900 dark:text-white text-sm">{f.title}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── LEADERSHIP / VALUES PILLARS (3-col Bento) ──────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PillarCard icon={<Crown className="w-5 h-5" />} title="Captain"
            value="Avinash Singh" subtitle="Leading the pack since Day 1"
            gradient="linear-gradient(135deg, #78350f 0%, #0a1019 100%)" border="rgba(251,191,36,0.3)" accent="text-amber-300" />
          <PillarCard icon={<Star className="w-5 h-5" fill="currentColor" />} title="Home Ground"
            value="Four Star, Pune" subtitle="Where the magic happens"
            gradient="linear-gradient(135deg, #1e3a8a 0%, #0a1019 100%)" border="rgba(59,130,246,0.3)" accent="text-blue-300" />
          <PillarCard icon={<Award className="w-5 h-5" />} title="Format"
            value="Tennis Ball T15" subtitle="15-overs · weekend tournaments"
            gradient="linear-gradient(135deg, #065f46 0%, #0a1019 100%)" border="rgba(16,185,129,0.3)" accent="text-emerald-300" />
        </div>

        {/* ── JOIN BANNER ─────────────────────────────────────────────────── */}
        <Link to="/requests" className="block group">
          <div className="relative overflow-hidden rounded-2xl shadow-xl">
            <div className="absolute inset-0"
                 style={{ background: 'linear-gradient(135deg, #047857 0%, #065f46 50%, #022c22 100%)' }} />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
            <div className="absolute inset-0 border border-emerald-400/30 rounded-2xl pointer-events-none" />
            <div className="relative p-6 lg:p-8 flex items-center gap-5 flex-wrap">
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <Send className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-emerald-300 text-[10px] font-bold uppercase tracking-[2px]">Join SCC</p>
                <h3 className="text-xl lg:text-2xl font-black text-white mt-1">Want to play with us?</h3>
                <p className="text-emerald-100/70 text-sm mt-1">Submit a membership request — we'd love to have you on the squad.</p>
              </div>
              <ChevronRight className="w-6 h-6 text-white/70 group-hover:translate-x-1 transition-transform flex-shrink-0" />
            </div>
          </div>
        </Link>

        {/* ── SPONSOR ─────────────────────────────────────────────────────── */}
        {sponsors && sponsors.length > 0 && (
          <div>
            <h2 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[2px] mb-3 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-primary-500" />
              Powered By
            </h2>
            <div className="space-y-3">
              {sponsors.map(s => (
                <div key={s.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 bg-white dark:bg-gray-900 flex items-center gap-4">
                  {s.logo_url ? (
                    <img src={s.logo_url} alt={s.name} className="w-16 h-16 object-contain rounded-xl bg-gray-50 dark:bg-gray-800 p-2 flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-7 h-7 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-gray-900 dark:text-white text-base truncate">{s.name}</h3>
                    {s.tagline && <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{s.tagline}</p>}
                    {s.member && <p className="text-xs text-gray-400 mt-0.5">SCC Member · {s.member.name}</p>}
                  </div>
                  {s.website_url && (
                    <a href={s.website_url} target="_blank" rel="noopener noreferrer"
                       className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors flex-shrink-0">
                      <ExternalLink className="w-4 h-4 text-gray-500 hover:text-primary-500" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CONTACT & SOCIAL ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 bg-white dark:bg-gray-900">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[1.5px] mb-3 flex items-center gap-1.5">
              <Phone className="w-3 h-3" /> Reach Out
            </h3>
            <div className="space-y-2 text-sm">
              <a href="mailto:singhopstech@gmail.com" className="flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400">
                <Mail className="w-4 h-4 text-gray-400" />
                <span>singhopstech@gmail.com</span>
              </a>
              <a href="tel:+918888546860" className="flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400">
                <Phone className="w-4 h-4 text-gray-400" />
                <span>+91 88885 46860</span>
              </a>
              <a href="https://sangriacricket.club" target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400">
                <Globe className="w-4 h-4 text-gray-400" />
                <span>sangriacricket.club</span>
              </a>
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span>Pune, Maharashtra, India</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 bg-white dark:bg-gray-900">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[1.5px] mb-3 flex items-center gap-1.5">
              <Trophy className="w-3 h-3" /> Find Us On
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <a href="https://cricheroes.in/team-profile/7927431/sangria-cricket-club" target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                <span className="text-xl">🏏</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">CricHeroes</p>
                  <p className="text-[10px] text-gray-400">Live scorecards</p>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-400" />
              </a>
              <a href="https://www.instagram.com/sangriacricket" target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-pink-300 dark:hover:border-pink-700 transition-colors">
                <Instagram className="w-5 h-5 text-pink-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">@sangriacricket</p>
                  <p className="text-[10px] text-gray-400">Match highlights</p>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-400" />
              </a>
            </div>
          </div>
        </div>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <div className="text-center py-6">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            🏏 Made with passion for cricket
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
            Sangria Cricket Club · Est. 2024 · Pune, India
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatPill({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
      <p className={`text-2xl lg:text-3xl font-black tabular-nums leading-none ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1.5 font-bold">{label}</p>
    </div>
  );
}

function ValueCard({ icon, label, text, gradient, border }: { icon: React.ReactNode; label: string; text: string; gradient: string; border: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4" style={{ background: gradient }}>
      <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ border: `1px solid ${border}` }} />
      <div className="flex items-center gap-2 text-white relative">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[1.5px]">{label}</span>
      </div>
      <p className="relative text-sm text-gray-300 mt-2 leading-relaxed">{text}</p>
    </div>
  );
}

function BigStat({ icon, value, label, gradient, border, accent }: { icon: React.ReactNode; value: string | number; label: string; gradient: string; border: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5" style={{ background: gradient }}>
      <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ border: `1px solid ${border}` }} />
      <div className={`flex items-center gap-1.5 mb-2 relative ${accent}`}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[1.5px]">{label}</span>
      </div>
      <p className="text-3xl lg:text-4xl font-black text-white tabular-nums relative leading-none">{value}</p>
    </div>
  );
}

function PillarCard({ icon, title, value, subtitle, gradient, border, accent }: { icon: React.ReactNode; title: string; value: string; subtitle: string; gradient: string; border: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5" style={{ background: gradient }}>
      <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ border: `1px solid ${border}` }} />
      <div className={`flex items-center gap-1.5 mb-2 relative ${accent}`}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[1.5px]">{title}</span>
      </div>
      <p className="text-xl lg:text-2xl font-black text-white tracking-tight relative">{value}</p>
      <p className="text-xs text-gray-400 mt-1 relative">{subtitle}</p>
    </div>
  );
}

export default About;
