import { useRef } from 'react';
import { Share2, Star, Zap, Target } from 'lucide-react';
import type { Member, MemberCricketStats } from '../types';

interface CricketIdentityCardProps {
  member: Member;
  stats: MemberCricketStats | null;
  dnaInsight: string | null;
  loading?: boolean;
}

function parseDNA(insight: string | null) {
  if (!insight) return null;
  const lines = insight.split('\n').filter(l => l.trim());
  const get = (keyword: string) => {
    const line = lines.find(l => l.toLowerCase().includes(keyword.toLowerCase()));
    if (!line) return '';
    return line.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').replace(new RegExp(keyword + '[:\\s]*', 'i'), '').trim();
  };
  return {
    dnaType: get('Cricket DNA Type') || get('DNA Type') || 'Cricket Warrior',
    signature: get('Signature Move') || '',
    personality: get('Cricket Personality') || '',
    strengths: lines.filter(l => l.includes('•') || (l.trim().startsWith('-') && !l.toLowerCase().includes('level'))).slice(0, 3).map(l => l.replace(/^[•\-]\s*/, '').replace(/\*\*/g, '').trim()),
    levelUp: get('Level Up') || '',
    wisdom: get('Cricket Wisdom') || '',
    legend: get('Comparable Legend') || '',
  };
}

const GRADIENT_STYLES = [
  'from-emerald-500 via-teal-600 to-cyan-700',
  'from-purple-600 via-violet-600 to-indigo-700',
  'from-orange-500 via-amber-500 to-yellow-600',
  'from-rose-500 via-pink-600 to-purple-700',
  'from-blue-600 via-cyan-600 to-teal-600',
];

export function CricketIdentityCard({ member, stats, dnaInsight, loading = false }: CricketIdentityCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const gradientIdx = member.name.charCodeAt(0) % GRADIENT_STYLES.length;
  const gradient = GRADIENT_STYLES[gradientIdx];
  const dna = parseDNA(dnaInsight);

  const handleShare = async () => {
    const text = `Cricket DNA Card - ${member.name}\n\n${dnaInsight || ''}\n\n— SCC Cricket Club`;
    if (navigator.share) {
      await navigator.share({ title: `${member.name}'s Cricket DNA`, text });
    } else {
      await navigator.clipboard.writeText(text);
      alert('Cricket DNA copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${gradient} p-6 text-white shadow-xl min-h-64`}>
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-white/20 rounded w-3/4" />
          <div className="h-4 bg-white/20 rounded w-1/2" />
          <div className="h-24 bg-white/10 rounded mt-4" />
        </div>
        <p className="absolute bottom-4 left-0 right-0 text-center text-white/60 text-sm">Analyzing cricket DNA...</p>
      </div>
    );
  }

  return (
    <div ref={cardRef} className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${gradient} shadow-xl text-white`}>
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {member.avatar_url ? (
              <img src={member.avatar_url} alt={member.name} className="w-14 h-14 rounded-full border-2 border-white/50 object-cover shadow-lg" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold border-2 border-white/30">
                {member.name.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold leading-tight">{member.name}</h3>
              {dna?.personality && <p className="text-white/80 text-sm">{dna.personality}</p>}
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-3 h-3 text-yellow-300 fill-yellow-300" />
                <span className="text-xs text-white/80">{member.matches_played} matches played</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-2 text-center border border-white/20">
              <p className="text-xs text-white/60 uppercase tracking-wide">Season</p>
              <p className="font-bold text-sm">2025-26</p>
            </div>
          </div>
        </div>

        {dna?.dnaType && (
          <div className="mt-3 bg-white/15 backdrop-blur-sm rounded-xl p-3 border border-white/20">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-300" />
              <span className="text-xs text-white/70 uppercase tracking-wider">Cricket DNA</span>
            </div>
            <p className="text-base font-bold mt-0.5">{dna.dnaType}</p>
            {dna.signature && <p className="text-xs text-white/70 mt-1">{dna.signature}</p>}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="px-5 py-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Runs', value: stats.batting_runs, sub: `Avg ${stats.batting_average.toFixed(1)}` },
              { label: 'Wickets', value: stats.bowling_wickets, sub: stats.bowling_best_figures },
              { label: 'Catches', value: stats.fielding_catches + stats.fielding_stumpings + stats.fielding_run_outs, sub: 'Fielding' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 rounded-xl p-2 text-center border border-white/10">
                <p className="text-2xl font-bold leading-none">{stat.value}</p>
                <p className="text-xs text-white/80 mt-0.5">{stat.label}</p>
                <p className="text-xs text-white/50 mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DNA Insights */}
      {dna && (
        <div className="px-5 py-3 space-y-2">
          {dna.strengths.length > 0 && (
            <div className="bg-white/10 rounded-xl p-3 border border-white/10">
              <div className="flex items-center gap-1 mb-1.5">
                <Target className="w-3.5 h-3.5 text-yellow-300" />
                <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Strengths</span>
              </div>
              {dna.strengths.map((s, i) => (
                <p key={i} className="text-xs text-white/80 leading-relaxed">- {s}</p>
              ))}
            </div>
          )}
          {dna.wisdom && (
            <div className="bg-white/10 rounded-xl p-3 border border-white/10">
              <p className="text-xs text-white/60 italic">"{dna.wisdom}"</p>
            </div>
          )}
          {dna.legend && (
            <p className="text-xs text-white/60 text-center">Plays like: {dna.legend}</p>
          )}
        </div>
      )}

      {!dnaInsight && !loading && (
        <div className="px-5 py-4 text-center">
          <p className="text-white/60 text-sm">Generate AI analysis to reveal cricket DNA</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 bg-black/20 border-t border-white/10">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-xs">C</span>
          </div>
          <span className="text-xs text-white/60 font-medium">SCC Cricket Club</span>
        </div>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-3 py-1.5 text-xs font-medium border border-white/20"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
      </div>
    </div>
  );
}
