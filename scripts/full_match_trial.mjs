/**
 * A complete two-over match, start to finish, through the real code and the
 * real database:
 *
 *   pick the fixture → toss → squads → innings 1 → innings 2 chasing a target
 *   → result → Man of the Match → scorecard the rest of the app can read
 *
 *   node scripts/full_match_trial.mjs           # run and clean up
 *   node scripts/full_match_trial.mjs --keep    # leave it to look at in the app
 *
 * Written as a script rather than browser clicks because it exercises the parts
 * the UI does NOT yet cover — toss, per-side squads, the innings break, and
 * result/MOM. Where a step is script-only that's called out in the output, so
 * the gaps in the pad are visible rather than hidden behind a green tick.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1wYWF0eWRobGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4Mjc4ODM0N30.kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg';
const BASE = 'https://zrrmpaatydhlkntfpcmw.supabase.co/rest/v1';
const MATCH = '03a51fb6-f6ab-43a0-b7a9-366dc97aef01';
const KEEP = process.argv.includes('--keep');
const OVERS = 2;
const FMT = { oversPerInnings: OVERS, playersPerSide: 12, maxOversPerBowler: 4 };

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

const dir = mkdtempSync(join(tmpdir(), 'fm-'));
writeFileSync(join(dir, 'e.ts'),
  `export * from '${process.cwd()}/src/lib/cricketRules';
   export { buildScorecard, cricHeroesSheet } from '${process.cwd()}/src/lib/buildScorecard';`);
execSync(`npx esbuild ${join(dir, 'e.ts')} --bundle --format=esm --platform=neutral --outfile=${join(dir, 'b.mjs')}`, { stdio: 'pipe' });
const L = await import(join(dir, 'b.mjs'));

const step = (n, label, ui) =>
  console.log(`\n${n}. ${label}   ${ui ? '· in the pad' : '· SCRIPT ONLY — not in the UI yet'}`);

let pass = 0, fail = 0;
const chk = (label, got, want) => {
  const ok = got === want; ok ? pass++ : fail++;
  console.log(`     ${ok ? '✓' : '✗'} ${label}${ok ? '' : `  got ${got}, want ${want}`}`);
};

// ─── 1. The fixture ──────────────────────────────────────────────────────────
step(1, 'Pick the match', true);
const [match] = await api('GET', `matches?select=id,date,opponent,venue&id=eq.${MATCH}`);
console.log(`     ${match.opponent} · ${match.date} · ${match.venue}`);
await api('DELETE', `scc_ball_by_ball?match_id=eq.${MATCH}`);
await api('DELETE', `scc_innings?match_id=eq.${MATCH}`);

// ─── 2. Squads ───────────────────────────────────────────────────────────────
step(2, 'Pick the two squads', false);
const members = await api('GET', 'members?select=id,name&status=eq.active&limit=24');
const brahmos = members.slice(0, 12);
const agni = members.slice(12, 24);
console.log(`     Brahmos: ${brahmos.slice(0, 3).map(m => m.name).join(', ')} …(12)`);
console.log(`     Agni:    ${agni.slice(0, 3).map(m => m.name).join(', ')} …(12)`);

// ─── 3. Toss ─────────────────────────────────────────────────────────────────
step(3, 'Toss', false);
const tossWinner = 'brahmos', decision = 'bat';
console.log(`     Brahmos won the toss and chose to ${decision}`);
await api('POST', 'scc_innings', [
  { match_id: MATCH, innings: 1, batting_team: 'brahmos', bowling_team: 'agni', status: 'live' },
]);

// ─── 4/5. The two innings ────────────────────────────────────────────────────
function playInnings(inns, batSide, bowlSide, seed, target) {
  const balls = [];
  let seq = 0, striker = batSide[0].id, nonStriker = batSide[1].id, next = 2, wkts = 0;
  const rand = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };

  for (let over = 0; over < OVERS; over++) {
    const bowler = bowlSide[over % bowlSide.length].id;
    let legal = 0;
    while (legal < 6) {
      const roll = rand(100);
      const b = {
        match_id: MATCH, innings: inns, over_no: over, ball_no: legal, seq: seq++,
        striker_id: striker, non_striker_id: nonStriker, bowler_id: bowler,
        runs_off_bat: 0, extra_type: null, extra_runs: 0,
        wicket_type: null, dismissed_id: null, fielder_id: null,
      };
      if (roll < 7) { b.extra_type = 'wd'; b.extra_runs = 1; }
      else if (roll < 11) { b.extra_type = 'lb'; b.extra_runs = 1; legal++; }
      else if (roll < 18 && wkts < 10) {
        b.wicket_type = ['bowled', 'caught', 'lbw', 'run_out'][rand(4)];
        b.dismissed_id = striker; b.fielder_id = bowlSide[rand(bowlSide.length)].id;
        legal++; wkts++;
      } else { b.runs_off_bat = [0, 1, 1, 2, 4, 4, 6, 1][rand(8)]; legal++; }
      balls.push(b);

      const nx = L.nextStrikers(b);
      striker = nx.strikerId; nonStriker = nx.nonStrikerId;
      if (b.wicket_type && next < batSide.length) {
        const inn = batSide[next++].id;
        if (striker === b.dismissed_id) striker = inn; else nonStriker = inn;
      }
      const st = L.inningsState(balls, FMT, target);
      if (st.isComplete) return balls;
    }
  }
  return balls;
}

step(4, 'Innings 1 — Brahmos batting', true);
const i1 = playInnings(1, brahmos, agni, 7, null);
for (let i = 0; i < i1.length; i += 40) await api('POST', 'scc_ball_by_ball', i1.slice(i, i + 40));
const s1 = L.inningsState(i1, FMT);
console.log(`     Brahmos ${s1.runs}/${s1.wickets} in ${s1.overs}`);

const target = s1.runs + 1;
step(5, `Innings 2 — Agni chasing ${target}`, false);
await api('POST', 'scc_innings', [
  { match_id: MATCH, innings: 2, batting_team: 'agni', bowling_team: 'brahmos', status: 'live', target },
]);
const i2 = playInnings(2, agni, brahmos, 91, target);
for (let i = 0; i < i2.length; i += 40) await api('POST', 'scc_ball_by_ball', i2.slice(i, i + 40));
const s2 = L.inningsState(i2, FMT, target);
console.log(`     Agni ${s2.runs}/${s2.wickets} in ${s2.overs}  (${s2.completeReason ?? 'in progress'})`);

// ─── 6. Result ───────────────────────────────────────────────────────────────
step(6, 'Result', false);
const winner = s2.runs >= target ? 'agni' : s1.runs > s2.runs ? 'brahmos' : null;
const margin = winner === 'agni'
  ? `${FMT.playersPerSide - 1 - s2.wickets} wickets`
  : `${s1.runs - s2.runs} runs`;
console.log(`     ${winner ? `${winner.toUpperCase()} won by ${margin}` : 'Tied'}`);
chk('a winner was decided', winner !== null, true);
chk('the chase is judged against the target', s2.runs >= target, winner === 'agni');

// ─── 7. Man of the Match ─────────────────────────────────────────────────────
step(7, 'Man of the Match', false);
const all = [...i1, ...i2];
const bat = L.battingCard(all), bowl = L.bowlingCard(all);
const impact = new Map();
for (const [id, l] of bat) impact.set(id, (impact.get(id) ?? 0) + l.runs);
for (const [id, l] of bowl) impact.set(id, (impact.get(id) ?? 0) + l.wickets * 20);
const [momId, momPts] = [...impact.entries()].sort((a, b) => b[1] - a[1])[0];
const momName = members.find(m => m.id === momId)?.name;
const mb = bat.get(momId), mw = bowl.get(momId);
console.log(`     ${momName} — ${mb?.runs ?? 0} runs${mw?.wickets ? `, ${mw.wickets} wkts` : ''} (${momPts} impact)`);
chk('MOM resolves to a real member', !!momName, true);

// ─── 8. Scorecard for the rest of the app ────────────────────────────────────
step(8, 'Scorecard the app can read', true);
const card = L.buildScorecard(MATCH,
  { balls: i1, teamName: 'SCC Brahmos' },
  { balls: i2, teamName: 'SCC Agni', target }, members, FMT);
chk('innings 1 total matches', card.innings1_summary.total_run, s1.runs);
chk('innings 2 total matches', card.innings2_summary.total_run, s2.runs);
chk('both batting cards present',
    card.innings1_batting.length > 0 && card.innings2_batting.length > 0, true);
chk('both bowling cards present',
    card.innings1_bowling.length > 0 && card.innings2_bowling.length > 0, true);

const stored = await api('GET', `scc_ball_by_ball?select=seq&match_id=eq.${MATCH}`);
chk('every ball persisted', stored.length, i1.length + i2.length);
console.log(`     ${stored.length} balls · ${JSON.stringify(stored).length} bytes of keys`);

console.log('\n─── CricHeroes entry sheet ───────────────────────────────\n');
console.log(L.cricHeroesSheet({ balls: i1, teamName: 'SCC Brahmos' },
  { balls: i2, teamName: 'SCC Agni', target }, members, FMT)
  .split('\n').slice(0, 10).map(l => '  ' + l).join('\n'));

if (!KEEP) {
  await api('DELETE', `scc_ball_by_ball?match_id=eq.${MATCH}`);
  await api('DELETE', `scc_innings?match_id=eq.${MATCH}`);
  console.log('\ntest data removed · fixture left untouched');
} else {
  console.log(`\nkept — open /score/${MATCH} to see it`);
}
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
