import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FOLLOW_UPS,
  decideSettingAction,
  nextFollowUps,
  type SettingInputs,
} from './settingsLogic.ts';

const base: SettingInputs = {
  wasSent: false,
  sentValue: undefined,
  local: 'x',
  stillPending: false,
  remoteSet: false,
  remoteValue: undefined,
  accountWins: false,
  alreadyTriedAdopt: false,
};
const act = (over: Partial<SettingInputs>) => decideSettingAction({ ...base, ...over });

test('a pushed setting that is still current is settled', () => {
  assert.equal(act({ wasSent: true, sentValue: 'x', local: 'x', remoteSet: true, remoteValue: 'x' }), 'settled');
});

test('a pushed setting changed meanwhile, or pending but not sent, asks for another round', () => {
  assert.equal(act({ wasSent: true, sentValue: 'x', local: 'y' }), 'again');
  assert.equal(act({ stillPending: true }), 'again');
});

test('the account value replaces a different local one', () => {
  assert.equal(act({ remoteSet: true, remoteValue: 'acct', local: 'x' }), 'adopt-remote');
});

test('first sync with the same value both sides clears the mark; otherwise nothing', () => {
  assert.equal(act({ remoteSet: true, remoteValue: 'x', local: 'x', accountWins: true }), 'clear-same');
  assert.equal(act({ remoteSet: true, remoteValue: 'x', local: 'x' }), 'none');
});

test('the account never chose and this phone did: adopt ours, but only once', () => {
  assert.equal(act({ remoteSet: false, local: 'x' }), 'adopt-local');
  assert.equal(act({ remoteSet: false, local: 'x', alreadyTriedAdopt: true }), 'none');
  assert.equal(act({ remoteSet: false, local: null }), 'none'); // phone never chose either
});

test('nextFollowUps ends the chain when nothing more is needed', () => {
  assert.deepEqual(nextFollowUps(2, false), { followUps: 0, schedule: false });
});

test('nextFollowUps schedules up to the limit and then stops', () => {
  let n = 0;
  let scheduled = 0;
  for (let i = 0; i < 20; i++) {
    const r = nextFollowUps(n, true);
    n = r.followUps;
    if (r.schedule) scheduled += 1;
  }
  assert.equal(scheduled, MAX_FOLLOW_UPS);
});

// --- the bug, reproduced ---------------------------------------------------
// A server that does not store two settings. Model one sync round per call, the
// way applyAuxResponse + runRound use the decisions above.
type Name = 'a' | 'b';
function simulate({
  guardAdopt,
  guardChain,
  initialPending = [],
}: {
  guardAdopt: boolean;
  guardChain: boolean;
  initialPending?: Name[];
}) {
  const local: Record<Name, string> = { a: 'va', b: 'vb' };
  const pending = new Set<Name>(initialPending);
  const tried = new Map<Name, string>();
  let followUps = 0;
  let rounds = 0;

  // first round is triggered by a normal event (app open); then follow-ups chain
  let runNext = true;
  while (runNext && rounds < 200) {
    rounds += 1;
    const sent = new Map<Name, string>();
    for (const n of ['a', 'b'] as Name[]) if (pending.has(n)) sent.set(n, local[n]);
    const stillPending = new Set(pending);

    let needsAnotherRound = false;
    for (const n of ['a', 'b'] as Name[]) {
      const action = decideSettingAction({
        wasSent: sent.has(n),
        sentValue: sent.get(n),
        local: local[n],
        stillPending: !sent.has(n) && stillPending.has(n),
        remoteSet: false, // the server never returns it
        remoteValue: undefined,
        accountWins: false,
        alreadyTriedAdopt: guardAdopt && tried.get(n) === local[n],
      });
      if (action === 'settled') pending.delete(n);
      if (action === 'again') needsAnotherRound = true;
      if (action === 'adopt-local') {
        tried.set(n, local[n]);
        pending.add(n);
        needsAnotherRound = true;
      }
    }

    if (guardChain) {
      const r = nextFollowUps(followUps, needsAnotherRound);
      followUps = r.followUps;
      runNext = r.schedule;
    } else {
      runNext = needsAnotherRound;
    }
  }
  return rounds;
}

// The student just changed setting `a` (pending), while `b` is another setting the
// server does not keep. They are one round out of step, so they take turns:
// a is pushed while b is re-marked, then b is pushed while a is re-marked, ...
const staggered = { initialPending: ['a'] as Name[] };

test('REPRO: one setting changed by the student + another the server drops loops forever', () => {
  assert.equal(simulate({ guardAdopt: false, guardChain: false, ...staggered }), 200); // hit the safety cap
});

test('if both start un-synced together the old logic happens to stop (why it only loops sometimes)', () => {
  assert.equal(simulate({ guardAdopt: false, guardChain: false }), 2);
});

test('adopt-once alone ends the staggered loop within a few rounds', () => {
  assert.ok(simulate({ guardAdopt: true, guardChain: false, ...staggered }) <= 3);
});

test('the follow-up limit alone also ends it (defence in depth)', () => {
  assert.ok(simulate({ guardAdopt: false, guardChain: true, ...staggered }) <= MAX_FOLLOW_UPS + 1);
});

test('both guards together end it fast', () => {
  assert.ok(simulate({ guardAdopt: true, guardChain: true, ...staggered }) <= 3);
});
