/**
 * Score one complete pseudo match through the real stack, then check the
 * generated scorecard against the ball list it came from.
 *
 *   node scripts/pseudo_match.mjs           # score + verify + clean up
 *   node scripts/pseudo_match.mjs --keep    # leave it in the database to look at
 *
 * The point isn't that a script can insert rows — it's that the rules engine and
 * buildScorecard agree with each other over a whole innings, including the
 * awkward deliveries. A wrong maiden or a mis-credited wicket only shows up at
 * this length.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1wYWF0eWRobGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4Mjc4ODM0N30.kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg';
const BASE = 'https://zrrmpaatydhlkntfpcmw.supabase.co/rest/v1';
const MATCH = '03a51fb6-f6ab-43a0-b7a9-366dc97aef01';   // 1 Oct Brahmos v Agni
const KEEP = process.argv.includes('--keep');

const api = async (method, path, body) => {
  const r = await fetch(`${BASE}/${path}`, {
    method,
    headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${r.status} ${method} ${path}: ${(await r.text()).slice(0, 200)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};

// Bundle the TS so we exercise the same code the app runs.
const dir = mkdtempSync(join(tmpdir(), 'pm-'));
writeFileSync(join(dir, 'e.ts'),
  `export * from '${process.cwd()}/src/lib/cricketRules';
   export { buildScorecard, cricHeroesSheet } from '${process.cwd()}/src/lib/buildScorecard';`);
execSync(`npx esbuild ${join(dir, 'e.ts')} --bundle --format=esm --platform=neutral --outfile=${join(dir, 'b.mjs')}`,
  { stdio: 'pipe' });
const L = await import(join(dir, 'b.mjs'));

const members = await api('GET', 'members?select=id,name&status=eq.active&limit=24');
const FMT = { oversPerInnings: 16, playersPerSide: 12, maxOversPerBowler: 4 };

/** A believable 16-over innings: boundaries, extras, wickets, a maiden. */
function scriptInnings(bat, bowl, seed) {
  const balls = [];
  let seq = 0, striker = bat[0], nonStriker = bat[1], nextBat = 2, wkts = 0;
  const rand = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };

  for (let over = 0; over < FMT.oversPerInnings; over++) {
    const bowler = bowl[over % bowl.length];
    let legal = 0;
    while (legal < 6) {
      const roll = rand(100);
      const b = {
        match_id: MATCH, innings: seq === 0 && balls.length === 0 ? 1 : 1,
        over_no: over, ball_no: legal, seq: seq++,
        striker_id: striker, non_striker_id: nonStriker, bowler_id: bowler,
        runs_off_bat: 0, extra_type: null, extra_runs: 0,
        wicket_type: null, dismissed_id: null, fielder_id: null,
      };
      // Over 7 is deliberately left a maiden to exercise that path.
      const maidenOver = over === 7;
      if (!maidenOver && roll < 6) { b.extra_type = 'wd'; b.extra_runs = 1; }
      else if (!maidenOver && roll < 9) { b.extra_type = 'nb'; b.extra_runs = 1; b.runs_off_bat = rand(3); }
      else if (!maidenOver && roll < 12) { b.extra_type = 'lb'; b.extra_runs = 1 + rand(2); legal++; }
      else if (!maidenOver && roll < 18 && wkts < FMT.playersPerSide - 2) {
        const types = ['bowled', 'caught', 'lbw', 'run_out', 'stumped'];
        b.wicket_type = types[rand(types.length)];
        b.dismissed_id = b.wicket_type === 'run_out' && rand(2) ? nonStriker : striker;
        b.fielder_id = bowl[rand(bowl.length)];
        legal++; wkts++;
      } else {
        b.runs_off_bat = maidenOver ? 0 : [0, 0, 1, 1, 2, 3, 4, 6][rand(8)];
        legal++;
      }
      balls.push(b);

      // Apply the same rotation rules the app uses.
      const { strikerId, nonStrikerId } = L.nextStrikers({
        ...b, ball_no: b.ball_no,
      });
      striker = strikerId; nonStriker = nonStrikerId;
      // Replace whoever just got out.
      if (b.wicket_type && b.dismissed_id && nextBat < bat.length) {
        const incoming = bat[nextBat++];
        if (striker === b.dismissed_id) striker = incoming; else nonStriker = incoming;
      }
      if (wkts >= FMT.playersPerSide - 1) return balls;
    }
  }
  return balls;
}

console.log('\n─── Scoring a pseudo match ───────────────────────────────\n');
await api('DELETE', `scc_ball_by_ball?match_id=eq.${MATCH}`);

const batting = members.slice(0, 12).map(m => m.id);
const bowling = members.slice(12, 18).map(m => m.id);
const balls = scriptInnings(batting, bowling, 42);

// Write them the way the app does.
for (let i = 0; i < balls.length; i += 40) {
  await api('POST', 'scc_ball_by_ball', balls.slice(i, i + 40));
}
const stored = await api('GET', `scc_ball_by_ball?select=*&match_id=eq.${MATCH}&innings=eq.1&order=seq`);
console.log(`stored ${stored.length} balls (${JSON.stringify(stored).length} bytes)`);

// ── Verify: the engine's view vs the raw balls ──────────────────────────
const st = L.inningsState(stored, FMT);
const bat = L.battingCard(stored);
const bowl = L.bowlingCard(stored);

let pass = 0, fail = 0;
const chk = (label, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok ? '' : `  got ${got}, want ${want}`}`);
};

console.log(`\nscore ${st.runs}/${st.wickets} in ${st.overs}  RR ${st.runRate}\n`);

const rawRuns = stored.reduce((n, b) => n + b.runs_off_bat + b.extra_runs, 0);
chk('team total equals the sum of every ball', st.runs, rawRuns);

const batRuns = [...bat.values()].reduce((n, l) => n + l.runs, 0);
chk('batters runs + extras = team total', batRuns + st.extras.total, st.runs);

const rawWkts = stored.filter(b => b.wicket_type && b.wicket_type !== 'retired').length;
chk('wickets match the ball list', st.wickets, rawWkts);
chk('batters marked out = wickets', [...bat.values()].filter(l => l.out).length, rawWkts);

const bowlerWkts = [...bowl.values()].reduce((n, l) => n + l.wickets, 0);
const creditable = stored.filter(b => L.isBowlerWicket(b.wicket_type)).length;
chk('bowler wickets exclude run outs', bowlerWkts, creditable);

const legal = stored.filter(L.isLegalDelivery).length;
chk('legal balls = sum of bowlers’ balls',
    [...bowl.values()].reduce((n, l) => n + l.legalBalls, 0), legal);

const conceded = [...bowl.values()].reduce((n, l) => n + l.runs, 0);
chk('bowler runs = total minus byes and leg-byes',
    conceded, st.runs - st.extras.b - st.extras.lb);

// ── The scorecard the rest of the app will read ─────────────────────────
const card = L.buildScorecard(MATCH, { balls: stored, teamName: 'SCC Brahmos' }, null, members, FMT);
chk('scorecard total matches the innings', card.innings1_summary.total_run, st.runs);
chk('scorecard wickets match', card.innings1_summary.total_wicket, st.wickets);
chk('every batter has a card row', card.innings1_batting.length >= bat.size, true);
chk('no unnamed players on the card',
    card.innings1_batting.every(r => r.name && r.name !== ''), true);
chk('bowling card has every bowler used', card.innings1_bowling.length, bowl.size);

console.log('\n─── CricHeroes entry sheet (first lines) ─────────────────\n');
console.log(L.cricHeroesSheet({ balls: stored, teamName: 'SCC Brahmos' }, null, members, FMT)
  .split('\n').slice(0, 12).map(l => '  ' + l).join('\n'));

if (!KEEP) {
  await api('DELETE', `scc_ball_by_ball?match_id=eq.${MATCH}`);
  console.log('\ntest balls removed');
} else {
  console.log('\nkept in the database (--keep)');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
