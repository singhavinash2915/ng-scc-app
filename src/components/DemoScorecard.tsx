import { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Radio } from 'lucide-react';

// ─── Demo Scorecard ────────────────────────────────────────────────────────────
// A realistic, self-ticking preview of what members see UNDER the live video
// during a real match (when the stream is paired with a CricHeroes match, the
// real LiveScorecard renders instead of this). Used for testing/demos so you
// can see the full "video + score" experience before a real fixture.

const BATTERS = [
  { name: 'Avinash Singh', runs: 63, balls: 38, fours: 5, sixes: 3, onStrike: true },
  { name: 'Shaan', runs: 41, balls: 29, fours: 4, sixes: 1, onStrike: false },
];
const OUT = [
  { name: 'Soumyaranjan', runs: 18, balls: 12, how: 'c Patil b Verma' },
  { name: 'Raushan Kumar', runs: 9, balls: 7, how: 'b Sharma' },
];
const BOWLERS = [
  { name: 'Sushil Yadav', overs: '3.2', maidens: 0, runs: 26, wkts: 2 },
  { name: 'Akash Jadhav', overs: '4.0', maidens: 0, runs: 31, wkts: 1 },
];

export function DemoScorecard() {
  const [runs, setRuns] = useState(148);
  const [balls, setBalls] = useState(98);
  const [striker, setStriker] = useState(BATTERS[0]);
  const [lastBalls, setLastBalls] = useState<string[]>(['1', '4', '0', '6', '1', '2']);

  // Tick a fake ball every few seconds so the preview feels alive
  useEffect(() => {
    const outcomes = ['0', '1', '2', '4', '1', '6', '0', '1'];
    const id = setInterval(() => {
      const o = outcomes[Math.floor(Math.random() * outcomes.length)];
      const r = parseInt(o, 10);
      setRuns(v => v + r);
      setBalls(b => b + 1);
      setStriker(s => ({ ...s, runs: s.runs + r, balls: s.balls + 1 }));
      setLastBalls(prev => [...prev.slice(-5), o]);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const overs = `${Math.floor(balls / 6)}.${balls % 6}`;
  const crr = (runs / (balls / 6)).toFixed(2);
  const target = 171;
  const need = Math.max(0, target - runs);
  const ballsLeft = Math.max(0, 120 - balls);

  return (
    <Card className="bg-white/5 border-white/10 overflow-hidden">
      {/* Demo notice */}
      <div className="bg-amber-500/15 border-b border-amber-500/25 px-4 py-2 flex items-center gap-2">
        <span className="t-micro font-black uppercase tracking-widest text-amber-300 bg-amber-500/25 px-2 py-0.5 rounded">
          Demo
        </span>
        <span className="t-meta text-amber-200/80 font-medium">
          Sample data — a real match pulls the live CricHeroes score here
        </span>
      </div>

      {/* Score header */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 bg-rose-600 text-white t-micro font-black uppercase tracking-widest px-2 py-0.5 rounded">
            <Radio className="w-2.5 h-2.5 animate-pulse" /> Live
          </span>
          <span className="text-xs font-bold text-gray-300">SCC vs Tinsel County</span>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="t-num text-4xl text-white leading-none">
            {runs}<span className="text-2xl text-gray-400">/4</span>
          </div>
          <div className="text-sm text-gray-400 font-semibold pb-1">({overs} ov)</div>
          <div className="ml-auto text-right pb-1">
            <p className="t-micro uppercase tracking-wider text-gray-500 font-bold">Run rate</p>
            <p className="t-num text-lg text-emerald-400">{crr}</p>
          </div>
        </div>
        <p className="text-xs text-amber-300 font-semibold mt-2">
          🎯 Need {need} off {ballsLeft} balls to win
        </p>
        {/* This over */}
        <div className="flex items-center gap-1.5 mt-3">
          <span className="t-micro uppercase tracking-wider text-gray-500 font-bold mr-1">This over</span>
          {lastBalls.map((b, i) => (
            <span
              key={i}
              className={`w-6 h-6 rounded-full flex items-center justify-center t-micro font-black ${
                b === '4' ? 'bg-emerald-500 text-white'
                : b === '6' ? 'bg-violet-500 text-white'
                : b === '0' ? 'bg-white/10 text-gray-400'
                : 'bg-white/15 text-gray-200'
              }`}
            >
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* Batting */}
      <div className="px-4 py-3 border-b border-white/10">
        <p className="t-micro uppercase tracking-wider text-gray-500 font-bold mb-2">Batting</p>
        <div className="space-y-1.5">
          {[{ ...striker, onStrike: true }, BATTERS[1]].map(b => (
            <div key={b.name} className="flex items-center gap-2 text-sm">
              <span className={`flex-1 truncate ${b.onStrike ? 'text-emerald-400 font-bold' : 'text-gray-200 font-medium'}`}>
                {b.name}{b.onStrike ? ' *' : ''}
              </span>
              <span className="t-num text-white w-10 text-right">{b.runs}</span>
              <span className="text-gray-500 text-xs tabular-nums w-10 text-right">{b.balls}b</span>
              <span className="text-gray-600 t-meta tabular-nums w-14 text-right">{b.fours}×4 {b.sixes}×6</span>
            </div>
          ))}
          {OUT.map(b => (
            <div key={b.name} className="flex items-center gap-2 text-sm opacity-50">
              <span className="flex-1 truncate text-gray-400">
                {b.name} <span className="t-micro text-gray-600">{b.how}</span>
              </span>
              <span className="t-num text-gray-300 w-10 text-right">{b.runs}</span>
              <span className="text-gray-600 text-xs tabular-nums w-10 text-right">{b.balls}b</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bowling */}
      <div className="px-4 py-3">
        <p className="t-micro uppercase tracking-wider text-gray-500 font-bold mb-2">Bowling</p>
        <div className="space-y-1.5">
          {BOWLERS.map((b, i) => (
            <div key={b.name} className="flex items-center gap-2 text-sm">
              <span className={`flex-1 truncate ${i === 0 ? 'text-white font-bold' : 'text-gray-300 font-medium'}`}>
                {b.name}{i === 0 ? ' *' : ''}
              </span>
              <span className="text-gray-500 text-xs tabular-nums w-10 text-right">{b.overs}</span>
              <span className="text-gray-500 text-xs tabular-nums w-8 text-right">{b.runs}r</span>
              <span className="t-num text-emerald-400 w-8 text-right">{b.wkts}w</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
