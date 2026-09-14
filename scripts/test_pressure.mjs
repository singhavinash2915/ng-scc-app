/**
 * Pressure engine checks — run with: node scripts/test_pressure.mjs
 *
 * Two kinds of case. The chase table is the calibration: the model must still
 * reproduce how often SCC have actually chased each target, or every number on
 * the gauge is decoration. The rest are moments any cricketer can judge by feel —
 * if the engine calls "1 off the last ball" moderate, it is wrong whatever the
 * maths says.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'pressure-'));
writeFileSync(join(dir, 'in.ts'), readFileSync('src/lib/pressure.ts', 'utf8'));
execSync(`npx esbuild ${join(dir, 'in.ts')} --format=esm --outfile=${join(dir, 'p.mjs')}`, { stdio: 'pipe' });
const P = await import(join(dir, 'p.mjs'));

let pass = 0, fail = 0;
const check = (label, ok, detail) => {
  if (ok) { pass++; console.log(`  ✓ ${label}  (${detail})`); }
  else { fail++; console.log(`  ✗ ${label}  (${detail})`); }
};
const F = { oversPerInnings: 16, playersPerSide: 12 };
const chase = (target, runs, wickets, legalBalls) => ({ target, runs, wickets, legalBalls });
const pct = (x) => `${Math.round(x * 100)}%`;

console.log('\nCalibration — chase success at the first ball vs SCC history');
for (const [target, actual] of [[90, 0.91], [110, 0.58], [130, 0.42], [150, 0.21], [170, 0.06]]) {
  const wp = P.winProbability(chase(target, 0, 0, 0), F);
  check(`target ${target}`, Math.abs(wp - actual) <= 0.12, `model ${pct(wp)}, actual ${pct(actual)}`);
}

console.log('\nWin probability by feel');
const wpc = (label, s, lo, hi) => {
  const wp = P.winProbability(s, F);
  check(label, wp >= lo && wp <= hi, pct(wp));
};
wpc('6 off 6, 6 wickets in hand is comfortable', chase(130, 124, 5, 90), 0.7, 1);
wpc('60 off 6 is gone', chase(130, 70, 3, 90), 0, 0.03);
wpc('5 off 30 with 9 in hand is won', chase(130, 125, 2, 66), 0.9, 1);
wpc('par first innings start is a coin flip', { runs: 0, wickets: 0, legalBalls: 0 }, 0.4, 0.6);
wpc('first innings 40/5 after 8 is behind', { runs: 40, wickets: 5, legalBalls: 48 }, 0, 0.35);
wpc('first innings 90/1 after 8 is well ahead', { runs: 90, wickets: 1, legalBalls: 48 }, 0.75, 1);

console.log('\nPressure by feel');
const pi = (label, s, m, band) => {
  const r = P.pressureIndex(s, F, m);
  const bands = Array.isArray(band) ? band : [band];
  check(label, bands.includes(r.band), `${r.index} ${r.band}`);
  return r.index;
};
const a = pi('35 off 15, 4 down', chase(130, 95, 4, 81), { recentDots: 4, recentLegal: 12, recentWickets: 0 }, ['High', 'Extreme']);
const b = pi('…two boundaries later', chase(130, 103, 4, 83), { recentDots: 3, recentLegal: 12, recentWickets: 0 }, ['Moderate', 'High']);
const c = pi('…then a wicket', chase(130, 103, 5, 84), { recentDots: 3, recentLegal: 12, recentWickets: 1 }, ['High', 'Extreme']);
check('boundaries ease it, the wicket brings it back', b < a && c > b, `${a} → ${b} → ${c}`);
pi('1 off the last ball', chase(130, 129, 6, 95), undefined, 'Extreme');
pi('60 off 6', chase(130, 70, 6, 90), undefined, 'Calm');
pi('5 off 30, 2 down', chase(130, 125, 2, 66), undefined, 'Calm');
pi('150 off 12', chase(150, 0, 3, 84), undefined, 'Calm');
pi('start of a level chase', chase(120, 0, 0, 0), undefined, ['Calm', 'Light']);
pi('first innings collapse, 30/4 after 5', { runs: 30, wickets: 4, legalBalls: 30 },
   { recentDots: 7, recentLegal: 12, recentWickets: 2 }, ['High', 'Moderate']);

console.log('\nImpact');
let seq = 0;
const ball = (o) => ({ seq: seq++, over_no: 0, ball_no: 0, striker_id: 'bat', non_striker_id: 'ns', bowler_id: 'bowl',
  runs_off_bat: 0, extra_type: null, extra_runs: 0, wicket_type: null, dismissed_id: null, fielder_id: null, ...o });
// 85/5 after 15 overs chasing 97: 12 off the last over, and the batter hits 6, 6.
const pre = Array.from({ length: 90 }, (_, i) => ball({ striker_id: 'other', bowler_id: 'other-bowl',
  runs_off_bat: i < 5 ? 0 : 1, wicket_type: i < 5 ? 'bowled' : null, dismissed_id: i < 5 ? 'other' : null }));
const all = [...pre, ball({ runs_off_bat: 6 }), ball({ runs_off_bat: 6 })].map((x, i) => ({ ...x, seq: i }));
const full = P.inningsImpact(all, F, 97, {});
const finisher = full.get('bat');
check('a finish swings impact to the batter', finisher && finisher.batting > 3, finisher ? `${finisher.batting}` : 'none');
check('and away from the bowler', full.get('bowl')?.bowling < -3, `${full.get('bowl')?.bowling}`);
check('impact is zero-sum on legal runs', Math.abs((finisher?.batting ?? 0) + (full.get('bowl')?.bowling ?? 0)) < 0.01, 'bat + bowl');
check('grades use the CricHeroes bands', P.gradeOf(10) === 'Exceptional' && P.gradeOf(1) === 'Marginal', 'ok');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
