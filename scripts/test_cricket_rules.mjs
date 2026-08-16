/**
 * Rules engine checks — run with: node scripts/test_cricket_rules.mjs
 *
 * These are the scoring rules people argue about, not the easy ones. A bug here
 * is invisible for months and then somebody's average is wrong, so each case is
 * one that hand-scoring commonly gets wrong.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Transpile the TS source to plain JS so node can import it without a build.
const dir = mkdtempSync(join(tmpdir(), 'rules-'));
const src = readFileSync('src/lib/cricketRules.ts', 'utf8');
writeFileSync(join(dir, 'in.ts'), src);
execSync(`npx esbuild ${join(dir, 'in.ts')} --format=esm --outfile=${join(dir, 'rules.mjs')}`,
         { stdio: 'pipe' });
const R = await import(join(dir, 'rules.mjs'));

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`); }
};

const A = 'batter-a', B = 'batter-b', BOWL = 'bowler-1', BOWL2 = 'bowler-2';
let seq = 0;
const ball = (o) => ({
  seq: seq++, over_no: 0, ball_no: 0,
  striker_id: A, non_striker_id: B, bowler_id: BOWL,
  runs_off_bat: 0, extra_type: null, extra_runs: 0,
  wicket_type: null, dismissed_id: null, fielder_id: null, ...o,
});
const FMT = { oversPerInnings: 16, playersPerSide: 12, maxOversPerBowler: 4 };

console.log('\nBall classification');
eq('wide is not a legal delivery', R.isLegalDelivery({ extra_type: 'wd' }), false);
eq('no-ball is not a legal delivery', R.isLegalDelivery({ extra_type: 'nb' }), false);
eq('leg-bye IS a legal delivery', R.isLegalDelivery({ extra_type: 'lb' }), true);
eq('bye IS a legal delivery', R.isLegalDelivery({ extra_type: 'b' }), true);
eq('wide is not a ball faced', R.isBallFaced({ extra_type: 'wd' }), false);
eq('no-ball IS a ball faced', R.isBallFaced({ extra_type: 'nb' }), true);

console.log('\nRuns charged to the bowler');
eq('wide charged to bowler',
   R.runsAgainstBowler({ runs_off_bat: 0, extra_type: 'wd', extra_runs: 1 }), 1);
eq('no-ball + 4 off the bat all charged',
   R.runsAgainstBowler({ runs_off_bat: 4, extra_type: 'nb', extra_runs: 1 }), 5);
eq('byes NOT charged to bowler',
   R.runsAgainstBowler({ runs_off_bat: 0, extra_type: 'b', extra_runs: 4 }), 0);
eq('leg-byes NOT charged to bowler',
   R.runsAgainstBowler({ runs_off_bat: 0, extra_type: 'lb', extra_runs: 2 }), 0);

console.log('\nWicket credit');
eq('bowled credited to bowler', R.isBowlerWicket('bowled'), true);
eq('stumped credited to bowler', R.isBowlerWicket('stumped'), true);
eq('RUN OUT not credited to bowler', R.isBowlerWicket('run_out'), false);
eq('retired not a bowler wicket', R.isBowlerWicket('retired'), false);

console.log('\nStrike rotation');
eq('1 run mid-over swaps strike',
   R.nextStrikers(ball({ runs_off_bat: 1, ball_no: 2 })).strikerId, B);
eq('2 runs mid-over keeps strike',
   R.nextStrikers(ball({ runs_off_bat: 2, ball_no: 2 })).strikerId, A);
eq('dot at end of over swaps strike',
   R.nextStrikers(ball({ runs_off_bat: 0, ball_no: 5 })).strikerId, B);
// The classic: single off the last ball means the SAME batter keeps strike.
eq('1 run off LAST ball of over keeps the same batter on strike',
   R.nextStrikers(ball({ runs_off_bat: 1, ball_no: 5 })).strikerId, A);
eq('wide does not end the over (no swap on ball_no 5)',
   R.nextStrikers(ball({ extra_type: 'wd', extra_runs: 1, ball_no: 5 })).strikerId, A);
eq('2 leg-byes keep strike',
   R.nextStrikers(ball({ extra_type: 'lb', extra_runs: 2, ball_no: 1 })).strikerId, A);
eq('1 leg-bye swaps strike',
   R.nextStrikers(ball({ extra_type: 'lb', extra_runs: 1, ball_no: 1 })).strikerId, B);

console.log('\nInnings totals');
seq = 0;
const over = [
  ball({ ball_no: 0, runs_off_bat: 4 }),
  ball({ ball_no: 1, runs_off_bat: 0 }),
  ball({ ball_no: 1, extra_type: 'wd', extra_runs: 1 }),
  ball({ ball_no: 1, runs_off_bat: 6 }),
  ball({ ball_no: 2, runs_off_bat: 1 }),
  ball({ ball_no: 3, extra_type: 'lb', extra_runs: 2 }),
  ball({ ball_no: 4, runs_off_bat: 0, wicket_type: 'bowled', dismissed_id: A }),
  ball({ ball_no: 5, runs_off_bat: 2 }),
];
const st = R.inningsState(over, FMT);
eq('runs total (4+0+1wd+6+1+2lb+0+2)', st.runs, 16);
eq('wickets', st.wickets, 1);
eq('legal balls (8 deliveries − 1 wide)', st.legalBalls, 7);
eq('overs display', st.overs, '1.1');
eq('extras split', st.extras, { wd: 1, nb: 0, b: 0, lb: 2, total: 3 });

console.log('\nBatting card');
const bat = R.battingCard(over);
eq('striker runs (4+6+1+2, byes excluded)', bat.get(A).runs, 13);
eq('balls faced excludes the wide', bat.get(A).balls, 7);
eq('fours', bat.get(A).fours, 1);
eq('sixes', bat.get(A).sixes, 1);
eq('marked out', bat.get(A).out, true);
eq('bowler credited on the card', bat.get(A).bowlerId, BOWL);

console.log('\nBowling card');
const bowl = R.bowlingCard(over);
eq('runs conceded excludes leg-byes (4+1wd+6+1+2)', bowl.get(BOWL).runs, 14);
eq('wickets', bowl.get(BOWL).wickets, 1);
eq('wides counted', bowl.get(BOWL).wides, 1);

console.log('\nMaiden over — an over of byes is STILL a maiden');
seq = 0;
const maiden = [
  ball({ over_no: 3, ball_no: 0 }), ball({ over_no: 3, ball_no: 1 }),
  ball({ over_no: 3, ball_no: 2, extra_type: 'b', extra_runs: 4 }),
  ball({ over_no: 3, ball_no: 3 }), ball({ over_no: 3, ball_no: 4 }),
  ball({ over_no: 3, ball_no: 5 }),
];
eq('maiden despite 4 byes', R.bowlingCard(maiden).get(BOWL).maidens, 1);
eq('byes still count to the team total', R.inningsState(maiden, FMT).runs, 4);

console.log('\nNot a maiden when a wide is bowled');
seq = 0;
const notMaiden = [
  ball({ over_no: 4, ball_no: 0 }), ball({ over_no: 4, ball_no: 1 }),
  ball({ over_no: 4, ball_no: 1, extra_type: 'wd', extra_runs: 1 }),
  ball({ over_no: 4, ball_no: 2 }), ball({ over_no: 4, ball_no: 3 }),
  ball({ over_no: 4, ball_no: 4 }), ball({ over_no: 4, ball_no: 5 }),
];
eq('wide spoils the maiden', R.bowlingCard(notMaiden).get(BOWL).maidens, 0);

console.log('\nRun out dismisses the NON-striker');
seq = 0;
const ro = [ball({ runs_off_bat: 1, wicket_type: 'run_out', dismissed_id: B, fielder_id: BOWL2 })];
const roCard = R.battingCard(ro);
eq('non-striker marked out', roCard.get(B).out, true);
eq('no bowler credited for a run out', roCard.get(B).bowlerId, null);
eq('fielder recorded', roCard.get(B).fielderId, BOWL2);

console.log('\nInnings completion');
eq('all out at players-1 wickets',
   R.inningsState(Array.from({ length: 11 }, (_, i) =>
     ball({ ball_no: i % 6, wicket_type: 'bowled', dismissed_id: A })), FMT).completeReason, 'allout');
eq('chase ends when target passed',
   R.inningsState([ball({ runs_off_bat: 6 })], FMT, 5).completeReason, 'target');
seq = 0;
const full = Array.from({ length: 96 }, (_, i) =>
  ball({ over_no: Math.floor(i / 6), ball_no: i % 6, runs_off_bat: 1 }));
eq('16 overs completes the innings', R.inningsState(full, FMT).completeReason, 'overs');

console.log('\nBowler eligibility');
seq = 0;
const oneOver = Array.from({ length: 6 }, (_, i) => ball({ over_no: 0, ball_no: i }));
eq('cannot bowl consecutive overs',
   R.nextBallContext(oneOver, FMT).ineligibleBowlers.includes(BOWL), true);
seq = 0;
const quota = Array.from({ length: 24 }, (_, i) =>
  ball({ over_no: Math.floor(i / 6), ball_no: i % 6 }));
eq('capped at max overs per bowler',
   R.nextBallContext(quota, FMT).ineligibleBowlers.includes(BOWL), true);

console.log('\nFree hit');
eq('free hit follows a no-ball',
   R.isFreeHit([ball({ extra_type: 'nb', extra_runs: 1 })]), true);
eq('no free hit after a normal ball', R.isFreeHit([ball({})]), false);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
