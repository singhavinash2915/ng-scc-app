import { useState } from 'react';
import { Loader2, Zap, Activity, Flame } from 'lucide-react';
import { useMatchImpact } from '../hooks/useMatchImpact';
import { BAND_COLOR, bandOf, type ImpactGrade } from '../lib/pressure';
import { commentaryFor } from '../lib/liveMatch';
import type { Ball } from '../lib/cricketRules';

// ─── Match Centre → Impact ────────────────────────────────────────────────────
// Who actually moved this match, in the spirit of CricHeroes' MVP 2.0: every
// ball shifts the batting side's chance of winning, and each player is credited
// with the share they caused. A 20 in a tense chase outranks a 40 when the game
// was already won — which is the whole point of measuring it this way.
//
// Lives inside Match Centre's dark panel, so it is written for dark only.

const GRADE_TONE: Record<ImpactGrade, string> = {
  Exceptional: 'bg-amber-400 text-amber-950',
  Excellent:   'bg-emerald-400 text-emerald-950',
  'Very good': 'bg-sky-400 text-sky-950',
  Good:        'bg-violet-400 text-violet-950',
  Useful:      'bg-white/20 text-white',
  Marginal:    'bg-white/10 text-white/60',
};

export function MatchImpact({ chMatchId }: { chMatchId: string }) {
  const { impact, loading, sideName, playerName, isClub, source, quality } = useMatchImpact(chMatchId, true);
  const [both, setBoth] = useState(false);
  const [inn, setInn] = useState(0);

  const players = (impact?.players ?? []).filter(p => both || isClub(p.playerId));

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
        <p className="text-sm text-gray-500">Replaying every ball…</p>
      </div>
    );
  }

  if (!impact || !impact.innings.length) {
    return (
      <div className="text-center py-10 px-4">
        <Zap className="w-8 h-8 text-gray-600 mx-auto" />
        <p className="text-white font-black mt-3">Impact needs every ball</p>
        <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
          It is worked out from how each delivery moved the chance of winning.
          This match has no ball-by-ball yet — CricHeroes matches are rebuilt
          by the morning sync after their scorecard arrives.
        </p>
      </div>
    );
  }

  const max = Math.max(1, ...players.map(p => Math.abs(p.total)));
  const current = impact.innings[Math.min(inn, impact.innings.length - 1)];
  const names = (id: string | null) => (id ? playerName(id) : '—');

  return (
    <div className="space-y-4">
      {/* ── Top impact ─────────────────────────────────────────────────── */}
      <div className="relative r-card bg-white/5 border border-white/10 p-4 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-rose-400 to-purple-500" />
        <div className="flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-2 t-micro font-black uppercase tracking-[2px] text-amber-300">
            <Zap className="w-3.5 h-3.5" /> Impact
          </p>
          <button onClick={() => setBoth(b => !b)}
            className="t-micro font-black uppercase tracking-wider text-gray-400 hover:text-white">
            {both ? 'SCC only' : 'Both teams'}
          </button>
        </div>
        <p className="t-meta text-gray-400 mt-1">
          How far each player moved the result. Swinging a match by half ≈ 10.
        </p>
        {source === 'cricheroes' && quality !== 'exact' && (
          <p className="t-micro text-amber-300/80 mt-1">
            {quality === 'close'
              ? 'Rebuilt from CricHeroes — totals match the scorecard; a ball here or there may sit with the wrong batter.'
              : 'Rebuilt from CricHeroes with gaps the scorecard could not fill — treat as a rough guide.'}
          </p>
        )}

        <div className="mt-3 space-y-2">
          {players.slice(0, 12).map((p, i) => {
            const opp = !isClub(p.playerId);
            return (
              <div key={p.playerId} className={`flex items-center gap-3 ${opp ? 'opacity-60' : ''}`}>
                <span className={`w-6 text-center t-num text-sm ${i < 3 ? 'text-amber-300' : 'text-gray-500'}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-white truncate">{playerName(p.playerId)}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-1.5 py-0.5 rounded t-micro font-black uppercase ${GRADE_TONE[p.grade]}`}>{p.grade}</span>
                      <span className={`t-num text-base w-12 text-right ${p.total >= 0 ? 'text-white' : 'text-rose-300'}`}>
                        {p.total > 0 ? '+' : ''}{p.total.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  {/* Where it came from: bat · ball · field, to scale. */}
                  <div className="mt-1 flex h-1.5 gap-0.5 rounded-full overflow-hidden bg-white/5">
                    {([['batting', 'bg-emerald-400'], ['bowling', 'bg-sky-400'], ['fielding', 'bg-amber-400']] as const)
                      .map(([k, c]) => p[k] > 0 && (
                        <div key={k} className={c} style={{ width: `${(p[k] / max) * 100}%` }} />
                      ))}
                  </div>
                  <p className="t-micro text-gray-500 mt-0.5 tabular-nums">
                    {[['bat', p.batting], ['bowl', p.bowling], ['field', p.fielding]]
                      .filter(([, v]) => Math.abs(v as number) >= 0.05)
                      .map(([l, v]) => `${l} ${(v as number) > 0 ? '+' : ''}${(v as number).toFixed(1)}`).join(' · ') || '—'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-3 t-micro text-gray-500">
          <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-emerald-400" /> bat</span>
          <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-sky-400" /> bowl</span>
          <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-amber-400" /> field</span>
        </div>
      </div>

      {/* ── Pressure curve ─────────────────────────────────────────────── */}
      <div className="r-card bg-white/5 border border-white/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-2 t-micro font-black uppercase tracking-[2px] text-rose-300">
            <Activity className="w-3.5 h-3.5" /> Pressure
          </p>
          {impact.innings.length > 1 && (
            <div className="flex gap-1 bg-white/5 r-control p-0.5">
              {impact.innings.map((x, i) => (
                <button key={x.innings} onClick={() => setInn(i)}
                  className={`px-2 py-1 r-control t-micro font-black truncate max-w-[120px] ${
                    i === inn ? 'bg-white/15 text-white' : 'text-gray-400'}`}>
                  {sideName(x.battingKey)}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="t-meta text-gray-400 mt-1">
          On {sideName(current.battingKey)} before every ball. The line is their chance of winning.
          {current.peak && <> Peak <b className="text-white">{current.peak.index}</b> at {current.peak.label}.</>}
        </p>
        <PressureChart curve={current.curve} />
      </div>

      {/* ── Key moments ────────────────────────────────────────────────── */}
      <div className="r-card bg-white/5 border border-white/10 p-4">
        <p className="inline-flex items-center gap-2 t-micro font-black uppercase tracking-[2px] text-purple-300">
          <Flame className="w-3.5 h-3.5" /> Balls that swung it
        </p>
        <div className="mt-2 space-y-2">
          {current.moments.map(m => {
            const up = m.winProbAfter >= m.winProb;
            return (
              <div key={m.seq} className="flex items-start gap-3">
                <span className="w-10 flex-shrink-0 t-num text-xs text-gray-400 pt-0.5">{m.label}</span>
                <p className="flex-1 text-sm text-white/80 leading-snug">{commentaryFor(m.ball as Ball, names)}</p>
                <span className={`flex-shrink-0 t-num text-xs ${up ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {up ? '+' : '−'}{Math.round(m.swing * 100)}%
                </span>
              </div>
            );
          })}
        </div>
        <p className="t-micro text-gray-500 mt-3">
          Swing in {sideName(current.battingKey)}’s chance of winning on that ball.
        </p>
      </div>
    </div>
  );
}

function PressureChart({ curve }: { curve: Array<{ seq: number; index: number; winProbAfter: number; label: string }> }) {
  if (curve.length < 2) return null;
  const W = 320, H = 110;
  const w = W / curve.length;
  const line = curve.map((r, i) => `${i === 0 ? 'M' : 'L'} ${(i + 0.5) * w} ${H - r.winProbAfter * H}`).join(' ');
  // Over markers every 2 overs of legal balls, read from the labels.
  const ticks = curve.map((r, i) => ({ i, o: parseInt(r.label, 10), b: r.label.endsWith('.1') }))
    .filter(t => t.b && t.o % 2 === 0);
  return (
    <div className="mt-3">
      <svg width="100%" viewBox={`0 0 ${W} ${H + 14}`} preserveAspectRatio="none" className="block">
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
        {curve.map((r, i) => {
          const h = Math.max(1.5, (r.index / 100) * H);
          return <rect key={r.seq} x={i * w} y={H - h} width={Math.max(0.8, w - 0.4)} height={h}
            fill={BAND_COLOR[bandOf(r.index)]} opacity={0.55} />;
        })}
        <path d={line} fill="none" stroke="white" strokeWidth={1.6} strokeLinejoin="round" />
        {ticks.map(t => (
          <text key={t.i} x={t.i * w} y={H + 11} fill="rgba(255,255,255,0.4)" style={{ font: '700 8px Inter, sans-serif' }}>
            {t.o}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 t-micro text-gray-500">
        {(['Calm', 'Light', 'Moderate', 'High', 'Extreme'] as const).map(b => (
          <span key={b} className="inline-flex items-center gap-1">
            <i className="w-2 h-2 rounded-sm" style={{ background: BAND_COLOR[b] }} />{b}
          </span>
        ))}
      </div>
    </div>
  );
}

export default MatchImpact;
