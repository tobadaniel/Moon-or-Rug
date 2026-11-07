// Simulation + behaviour tests for Moon or Rug.
// Run: node test/simulate.mjs   (seeded, reproducible)

import assert from 'node:assert';
import {
  createGame, stepTick, nextDay, finishDay, runToEnd,
  buy, sell, generateCoin, leaderboard, netWorth, holdingsValue,
  ACTORS, SEASON_DAYS, TICKS_PER_DAY, COINS_PER_DAY,
} from '../engine.js';

function mulberry32(seed) {
  return function next() {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1. An agent-only season (player idle) completes 14 days, prices sane.
{
  const rng = mulberry32(42);
  const s = createGame(rng);
  assert.equal(s.coins.length, COINS_PER_DAY, 'day 1 launches');
  runToEnd(s, rng);
  assert.ok(s.over, 'season ended');
  assert.equal(s.day, SEASON_DAYS, 'reached day 14');
  assert.equal(s.coins.length, COINS_PER_DAY * SEASON_DAYS, 'all launches happened');
  for (const c of s.coins) {
    assert.ok(Number.isFinite(c.price) && c.price >= 0, `price sane for $${c.symbol}`);
    for (const p of c.history) assert.ok(Number.isFinite(p) && p >= 0, 'history sane');
  }
  for (const a of ACTORS) {
    assert.ok(Number.isFinite(s.cash[a.id]), `cash finite for ${a.id}`);
  }
  console.log(`agent-only season done: trades ${s.trades}, coins ${s.coins.length}, rugged ${s.coins.filter((c) => c.rugged).length}`);
  console.log('final board:', leaderboard(s).map((b) => `${b.name} ${b.total}`).join(' | '));
}

// 2. Leaderboard totals equal cash + holdings value, for every actor.
{
  const rng = mulberry32(7);
  const s = createGame(rng);
  buy(s, 'player', s.coins[0].id, 20);
  for (let i = 0; i < 20; i++) stepTick(s, rng);
  const board = leaderboard(s);
  assert.equal(board.length, ACTORS.length);
  for (const row of board) {
    assert.ok(Math.abs(row.total - (row.cash + row.holdingsValue)) < 0.011, `total = cash + holdings for ${row.id}`);
    assert.ok(Math.abs(row.total - netWorth(s, row.id)) < 0.011, 'matches netWorth');
    assert.ok(Math.abs(row.holdingsValue - holdingsValue(s, row.id)) < 0.011, 'matches holdingsValue');
  }
  for (let i = 1; i < board.length; i++) assert.ok(board[i - 1].total >= board[i].total, 'sorted desc');
  console.log('leaderboard arithmetic: PASS');
}

// 3. A rug makes the coin unsellable and worth ~0.
{
  const rng = mulberry32(99);
  const s = createGame(rng);
  const coin = s.coins[0];
  const r = buy(s, 'player', coin.id, 30);
  assert.ok(r.ok, 'player bought in');
  // Force the hidden hand: this coin rugs on the very next tick.
  coin.fate = 'rug';
  coin.rugAbsTick = (s.day - 1) * TICKS_PER_DAY + s.tick + 1;
  stepTick(s, rng);
  assert.ok(coin.rugged, 'coin rugged at its tick');
  assert.ok(coin.price <= coin.launchPrice * 0.05, `post-rug price ~0 (got ${coin.price})`);
  const sellTry = sell(s, 'player', coin.id, 'all');
  assert.equal(sellTry.ok, false, 'rugged coin cannot be sold');
  assert.ok(holdingsValue(s, 'player') <= 30 * 0.06, 'position valued ~0');
  const buyTry = buy(s, 'player', coin.id, 5);
  assert.equal(buyTry.ok, false, 'rugged coin cannot be bought either');
  console.log('rug resolution: PASS');
}

// 4. The signals carry real information: locked liquidity rugs less.
//    Generate many coins with balanced other signals and compare rates.
{
  const rng = mulberry32(2026);
  let lockedN = 0; let lockedRugs = 0; let unlockedN = 0; let unlockedRugs = 0;
  for (let i = 0; i < 6000; i++) {
    const c = generateCoin(rng, i + 1, 1, 0);
    if (c.signals.locked) { lockedN++; if (c.fate === 'rug') lockedRugs++; } else { unlockedN++; if (c.fate === 'rug') unlockedRugs++; }
  }
  const lr = lockedRugs / lockedN;
  const ur = unlockedRugs / unlockedN;
  console.log(`rug rate: locked ${(lr * 100).toFixed(1)}% (n=${lockedN}) vs unlocked ${(ur * 100).toFixed(1)}% (n=${unlockedN})`);
  assert.ok(lr + 0.08 < ur, `locked rugs meaningfully less (margin 8pts): ${lr.toFixed(3)} vs ${ur.toFixed(3)}`);
  console.log('signal information: PASS');
}

// 5. Trade impact: a whale-size buy moves the price more than a small one.
{
  const rngA = mulberry32(5);
  const sA = createGame(rngA);
  const coinA = sA.coins[0];
  const beforeA = coinA.price;
  buy(sA, 'player', coinA.id, 5);
  const rngB = mulberry32(5);
  const sB = createGame(rngB);
  const coinB = sB.coins[0];
  buy(sB, 'player', coinB.id, 50);
  assert.ok(coinB.price > coinA.price && coinA.price > beforeA, 'bigger buy, bigger pump');
  console.log('price impact: PASS');
}

console.log('PASS: all Moon or Rug engine tests green.');
