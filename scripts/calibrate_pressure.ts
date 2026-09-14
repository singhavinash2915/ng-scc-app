/**
 * Re-fit the pressure engine on real balls — run each season:
 *   python3 scripts/sync_ch_balls.py --dry-run --all --dump /tmp/rebuilt.json
 *   npx esbuild scripts/calibrate_pressure.ts --bundle --platform=node --outfile=/tmp/cal.js && node /tmp/cal.js /tmp/rebuilt.json
 * Grid-searches alpha / chasePar / chaseSpread / luck by log-loss on every
 * chase ball, then prints how predicted chances compare with what happened.
 * Copy the winning values into CAL in src/lib/pressure.ts and re-run
 * scripts/test_pressure.mjs — the first-ball chase table must still hold.
 */
import { winProbability, CAL } from '../src/lib/pressure';
import { readFileSync } from 'fs';
const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
type Pt = { wp: number; won: number; phase: number; inn: number };
function points(): Pt[] {
  const pts: Pt[] = [];
  for (const m of d) {
    if (m.innings.length < 2 || m.quality === 'partial') continue;
    const overs = m.innings[0].match_overs || 16;
    const F = { oversPerInnings: overs, playersPerSide: 12 };
    const i1 = m.innings[0], i2 = m.innings[1];
    const target = i1.runs + 1;
    const chaseWon = i2.runs >= target ? 1 : 0;
    if (i2.runs === i1.runs) continue; // tie
    for (const inn of [1, 2]) {
      const balls = m.balls.filter((b: any) => b.innings === inn).sort((a: any, b: any) => a.seq - b.seq);
      let runs = 0, w = 0, legal = 0;
      for (const b of balls) {
        const st = { runs, wickets: w, legalBalls: legal, target: inn === 2 ? target : null };
        const wp = winProbability(st, F);
        pts.push({ wp, won: inn === 2 ? chaseWon : 1 - chaseWon, phase: legal / (overs * 6), inn });
        runs += b.runs_off_bat + b.extra_runs; if (b.wicket_type) w++; if (b.extra_type !== 'wd' && b.extra_type !== 'nb') legal++;
      }
    }
  }
  return pts;
}
const brier = (p: Pt[]) => p.reduce((a, x) => a + (x.wp - x.won) ** 2, 0) / p.length;
const ll = (p: Pt[]) => -p.reduce((a, x) => a + Math.log(Math.max(1e-6, x.won ? x.wp : 1 - x.wp)), 0) / p.length;
let best: any = null;
for (const alpha of [0.8, 1.0, 1.2, 1.5]) for (const cp of [1.0, 1.2, 1.4, 1.7, 2.0]) for (const sp of [0.8, 1.0, 1.2, 1.4]) for (const luck of [0.9, 1.3]) {
  Object.assign(CAL as any, { alpha, chasePar: cp, chaseSpread: sp, luck });
  const p2 = points().filter(x => x.inn === 2); const v = ll(p2);
  if (!best || v < best.v) best = { v, alpha, cp, sp, luck, brier: brier(p2) };
}
console.log('best', best);
Object.assign(CAL as any, { alpha: best.alpha, chasePar: best.cp, chaseSpread: best.sp, luck: best.luck });
const p1all = points().filter(x => x.inn === 1); console.log('first-innings ll with best alpha', ll(p1all).toFixed(3));

const p = points().filter(x => x.inn === 2);
const bins = Array.from({ length: 10 }, () => ({ n: 0, wp: 0, won: 0 }));
for (const x of p) { const i = Math.min(9, Math.floor(x.wp * 10)); bins[i].n++; bins[i].wp += x.wp; bins[i].won += x.won; }
console.log('chase reliability (current):'); bins.forEach((b, i) => b.n && console.log(`  ${i * 10}-${i * 10 + 10}%  predicted ${(100 * b.wp / b.n).toFixed(0)}%  actual ${(100 * b.won / b.n).toFixed(0)}%  n=${b.n}`));
const p1 = points().filter(x => x.inn === 1); const b1 = Array.from({ length: 10 }, () => ({ n: 0, wp: 0, won: 0 }));
for (const x of p1) { const i = Math.min(9, Math.floor(x.wp * 10)); b1[i].n++; b1[i].wp += x.wp; b1[i].won += x.won; }
console.log('first-innings reliability:'); b1.forEach((b, i) => b.n && console.log(`  ${i * 10}-${i * 10 + 10}%  predicted ${(100 * b.wp / b.n).toFixed(0)}%  actual ${(100 * b.won / b.n).toFixed(0)}%  n=${b.n}`));
