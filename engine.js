// engine.js — ALL the rules of Moon or Rug, in one pure ES module.
//
// A 14-day season. Every day, 4 fresh memecoins launch. Each coin has a
// hidden fate and public-but-noisy signals. Prices move 8 ticks a day.
// Four agent traders bet their own bankrolls in public, with strategies
// you can read below, and their trades move prices. Rugged coins go to
// ~zero and cannot be sold after the rug tick. Survive to day 14 and be
// scored against the agents.
//
// ---------------------------------------------------------------------
// THE ODDS TABLE (published in the README too — the signals are real)
//
// Fate is rolled from the coin's signals, in this order:
//
//   Base fate by liquidity lock:
//     liquidity LOCKED:    moon 35% · bleed 50% · rug 15%
//     liquidity UNLOCKED:  moon 25% · bleed 40% · rug 35%
//
//   Adjustments (applied before the roll):
//     dev wallet >= 25% of supply:  rug +10%, moon -10%
//     dev rugged >= 2 past coins:   rug +10%, bleed -10%
//     meme score >= 80:             moon +8%, bleed -8%
//
//   Locked liquidity genuinely cuts rug odds roughly in half. The other
//   signals are noisier: holder growth is only a tendency (moon coins
//   usually grow holders faster, but rug coins fake growth too), and the
//   meme score nudges fate rather than deciding it. Reading the table
//   well beats reading any single signal.
//
// Fates, per tick (8 ticks per day):
//   moon:  strong upward drift, in stages, with the odd dip
//   bleed: slow grind down
//   rug:   pumps a little, looks tempting, then at a hidden tick
//          (3+ ticks after launch, within ~4 days) the price is cut
//          to ~1-3% and the coin becomes unsellable forever.
// ---------------------------------------------------------------------

export const SEASON_DAYS = 14;
export const TICKS_PER_DAY = 8;
export const COINS_PER_DAY = 4;
export const START_CASH = 100;

export const ACTORS = [
  { id: 'player', name: 'You', emoji: '🧑‍🚀' },
  { id: 'andy', name: 'Ape Andy', emoji: '🦍', style: 'degen' },
  { id: 'dana', name: 'Dip Dana', emoji: '🎯', style: 'sniper' },
  { id: 'lisa', name: 'Lock Lisa', emoji: '🔒', style: 'cautious' },
  { id: 'bram', name: 'Big Bram', emoji: '🐋', style: 'whale' },
];

const NAME_A = ['Turbo', 'Baby', 'Giga', 'Soggy', 'Based', 'Cosmic', 'Degen', 'Wif', 'Sleepy', 'Turbo', 'Laser', 'Midnight', 'Golden', 'Rabid', 'Pocket'];
const NAME_B = ['Frog', 'Cat', 'Doge', 'Banana', 'Wizard', 'Potato', 'Rocket', 'Hamster', 'Ghost', 'Noodle', 'Capybara', 'Wizard', 'Toaster', 'Moonbag', 'Goblin'];
const EMOJIS = ['🐸', '🐱', '🐶', '🍌', '🧙', '🥔', '🚀', '🐹', '👻', '🍜', '🦫', '🍞', '🦖', '🦄', '🐙', '🍕'];

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
export function round2(v) { return Math.round(v * 100) / 100; }
function round4(v) { return Math.round(v * 10000) / 10000; }
export function absTick(state) { return (state.day - 1) * TICKS_PER_DAY + state.tick; }

// ------------------------------------------------------------ coin birth ---

export function generateCoin(rng, id, day, bornAbsTick) {
  // Signals first — fate is rolled FROM them, per the odds table above.
  const locked = rng() < 0.5;
  const devPct = Math.round(2 + Math.pow(rng(), 2) * 38); // skewed low, tails to 40
  const memeScore = Math.round(rng() * 100);
  const devLaunches = Math.floor(rng() * 7); // 0..6 past coins
  const devRugs = devLaunches === 0 ? 0 : Math.floor(rng() * (Math.min(devLaunches, 3) + 1));

  let pMoon = locked ? 0.35 : 0.25;
  let pBleed = locked ? 0.50 : 0.40;
  let pRug = locked ? 0.15 : 0.35;
  if (devPct >= 25) { pRug += 0.10; pMoon -= 0.10; }
  if (devRugs >= 2) { pRug += 0.10; pBleed -= 0.10; }
  if (memeScore >= 80) { pMoon += 0.08; pBleed -= 0.08; }
  pMoon = clamp(pMoon, 0.02, 0.9); pBleed = clamp(pBleed, 0.02, 0.9); pRug = clamp(pRug, 0.01, 0.9);

  const roll = rng();
  const fate = roll < pMoon ? 'moon' : roll < pMoon + pBleed ? 'bleed' : 'rug';

  // Holder growth: a tendency, not a tell. Moons grow, bleeds stall,
  // rugs often fake fast growth early.
  const holderGrowth = fate === 'moon' ? Math.round(25 + rng() * 65)
    : fate === 'bleed' ? Math.round(-10 + rng() * 35)
      : Math.round(5 + rng() * 55);

  const name = `${NAME_A[Math.floor(rng() * NAME_A.length)]} ${NAME_B[Math.floor(rng() * NAME_B.length)]}`;
  const symbol = name.split(' ').map((w) => w[0]).join('') + name.split(' ')[1].slice(1, 3).toUpperCase();
  const launchPrice = round2(0.2 + rng() * 1.6);

  return {
    id,
    name,
    symbol: symbol.toUpperCase(),
    emoji: EMOJIS[Math.floor(rng() * EMOJIS.length)],
    bornDay: day,
    bornAbsTick,
    launchPrice,
    price: launchPrice,
    peak: launchPrice,
    low: launchPrice,
    dipped: false,
    history: [launchPrice],
    fate,
    // A moon runs in stages, then runs out of steam: 10-21 hot ticks,
    // after which the coin drifts like a bleed. Knowing when the music
    // stops is the whole game.
    moonTicks: fate === 'moon' ? 10 + Math.floor(rng() * 12) : 0,
    stalled: false,
    rugAbsTick: fate === 'rug' ? bornAbsTick + 3 + Math.floor(rng() * TICKS_PER_DAY * 4) : null,
    rugged: false,
    depth: Math.round(250 + rng() * 450 + (locked ? 150 : 0)), // NEAR of liquidity depth
    holders: 40 + Math.floor(rng() * 300),
    signals: { locked, devPct, holderGrowth, memeScore, devLaunches, devRugs },
  };
}

// ----------------------------------------------------------------- state ---

export function createGame(rng = Math.random) {
  const state = {
    day: 1,
    tick: 0,
    over: false,
    coins: [],
    cash: {},
    holdings: {}, // actorId -> { coinId: qty }
    costBasis: {}, // actorId -> { coinId: avg price paid }
    agentState: {},
    feed: [],
    trades: 0,
    nextCoinId: 1,
  };
  for (const a of ACTORS) {
    state.cash[a.id] = START_CASH;
    state.holdings[a.id] = {};
    state.costBasis[a.id] = {};
    state.agentState[a.id] = { bought: {}, dipDay: {}, whaleDay: 0 };
  }
  spawnDay(state, rng);
  pushFeed(state, `🌅 Season starts. ${COINS_PER_DAY} fresh launches on the board. 100 NEAR each. May your bags be ever moonward.`);
  return state;
}

function spawnDay(state, rng) {
  for (let i = 0; i < COINS_PER_DAY; i++) {
    const coin = generateCoin(rng, state.nextCoinId++, state.day, absTick(state));
    state.coins.push(coin);
    pushFeed(state, `${coin.emoji} $${coin.symbol} (${coin.name}) launched at ${coin.price.toFixed(2)} NEAR. ${coin.signals.locked ? '🔒 Liquidity locked.' : '⚠️ Liquidity NOT locked.'} Dev holds ${coin.signals.devPct}%. Meme score ${coin.signals.memeScore}.`);
  }
}

export function coinById(state, id) { return state.coins.find((c) => c.id === id); }

function pushFeed(state, line) {
  state.feed = [line, ...state.feed].slice(0, 160);
}

// ---------------------------------------------------------------- trades ---

function applyImpact(coin, nearAmount, direction) {
  // Buys push the price up, sells push it down. Bigger money vs the
  // coin's liquidity depth moves it more. The whale is the whale
  // because his cheques are bigger, not because he gets a special rule.
  const impact = Math.min(0.25, (nearAmount / coin.depth) * 0.6);
  coin.price = round4(Math.max(0.001, coin.price * (1 + direction * impact)));
  coin.peak = Math.max(coin.peak, coin.price);
}

export function buy(state, actor, coinId, nearAmount) {
  const coin = coinById(state, coinId);
  if (!coin) return { ok: false, msg: 'No such coin.' };
  if (state.over) return { ok: false, msg: 'The season is over.' };
  if (coin.rugged) return { ok: false, msg: `$${coin.symbol} rugged. There is no liquidity left to buy.` };
  if (nearAmount <= 0) return { ok: false, msg: 'Pick an amount.' };
  if (state.cash[actor] < nearAmount) return { ok: false, msg: `Not enough NEAR (has ${state.cash[actor].toFixed(2)}).` };
  const qty = nearAmount / coin.price;
  const held = state.holdings[actor][coinId] || 0;
  const prevCost = state.costBasis[actor][coinId] || coin.price;
  state.costBasis[actor][coinId] = held > 0
    ? (prevCost * held + coin.price * qty) / (held + qty)
    : coin.price;
  state.holdings[actor][coinId] = held + qty;
  state.cash[actor] = round2(state.cash[actor] - nearAmount);
  applyImpact(coin, nearAmount, +1);
  state.trades += 1;
  return { ok: true, msg: `Bought ${qty.toFixed(1)} $${coin.symbol} for ${nearAmount} NEAR.`, qty };
}

export function sell(state, actor, coinId, qtyOrAll) {
  const coin = coinById(state, coinId);
  if (!coin) return { ok: false, msg: 'No such coin.' };
  if (coin.rugged) return { ok: false, msg: `$${coin.symbol} RUGGED. Nobody is buying. It is a souvenir now.` };
  const held = state.holdings[actor][coinId] || 0;
  const qty = qtyOrAll === 'all' ? held : Math.min(qtyOrAll, held);
  if (qty <= 0) return { ok: false, msg: `No $${coin.symbol} held.` };
  const proceeds = round2(qty * coin.price);
  state.holdings[actor][coinId] = held - qty;
  if (state.holdings[actor][coinId] <= 0.0001) {
    delete state.holdings[actor][coinId];
    delete state.costBasis[actor][coinId];
  }
  state.cash[actor] = round2(state.cash[actor] + proceeds);
  applyImpact(coin, proceeds, -1);
  state.trades += 1;
  return { ok: true, msg: `Sold ${qty.toFixed(1)} $${coin.symbol} for ${proceeds} NEAR.`, proceeds };
}

export function positionPnl(state, actor, coinId) {
  const coin = coinById(state, coinId);
  const held = state.holdings[actor][coinId] || 0;
  const basis = state.costBasis[actor][coinId];
  if (!coin || held <= 0 || !basis) return null;
  return (coin.price - basis) / basis;
}

// --------------------------------------------------------------- scoring ---

export function holdingsValue(state, actor) {
  let v = 0;
  for (const [coinId, qty] of Object.entries(state.holdings[actor] || {})) {
    const coin = coinById(state, Number(coinId));
    if (coin) v += qty * coin.price;
  }
  return round2(v);
}

export function netWorth(state, actor) {
  return round2(state.cash[actor] + holdingsValue(state, actor));
}

export function leaderboard(state) {
  return ACTORS
    .map((a) => ({
      id: a.id, name: a.name, emoji: a.emoji,
      cash: round2(state.cash[a.id]),
      holdingsValue: holdingsValue(state, a.id),
      total: netWorth(state, a.id),
    }))
    .sort((x, y) => y.total - x.total);
}

export function rankFor(worth) {
  if (worth >= 220) return 'Moon Walker 👑';
  if (worth >= 160) return 'Certified Degen';
  if (worth >= 120) return 'Degen Survivor';
  if (worth >= 95) return 'Barely Breathing';
  if (worth >= 55) return 'Exit Liquidity';
  return 'Rugged To Zero 💀';
}

// --------------------------------------------------------- price movement ---

function priceStep(state, coin, rng) {
  if (coin.rugged) return;
  const now = absTick(state);
  if (coin.fate === 'rug' && now >= coin.rugAbsTick) {
    coin.price = round4(Math.max(0.001, coin.price * (0.01 + rng() * 0.02)));
    coin.rugged = true;
    coin.history.push(coin.price);
    pushFeed(state, `💥💥 $${coin.symbol} RUGGED on day ${state.day}. Liquidity vanished. Bags are souvenirs now.`);
    return;
  }
  let fateNow = coin.fate;
  if (fateNow === 'moon' && now - coin.bornAbsTick > coin.moonTicks) {
    fateNow = 'bleed';
    if (!coin.stalled) {
      coin.stalled = true;
      pushFeed(state, `📉 $${coin.symbol} ran out of steam. The moon crowd is drifting to newer shiny things.`);
    }
  }
  let change;
  if (fateNow === 'moon') {
    // Moon drift decays by stage: violent early, tamer later. A whole
    // moon tops out around a 5-15x, not a 500x.
    const ageTicks = now - coin.bornAbsTick;
    const drift = ageTicks <= 5 ? 0.18 + rng() * 0.26
      : ageTicks <= 11 ? 0.08 + rng() * 0.16
        : 0.02 + rng() * 0.10;
    change = rng() < 0.15 ? -(0.04 + rng() * 0.08) : drift;
  } else if (fateNow === 'bleed') {
    change = rng() < 0.20 ? 0.02 + rng() * 0.05 : -(0.03 + rng() * 0.10);
  } else {
    // rug, pre-rug: a tempting little pump with nervous wiggles
    change = 0.02 + rng() * 0.13 - (rng() < 0.3 ? 0.07 : 0);
  }
  coin.price = round4(Math.max(0.001, coin.price * (1 + change)));
  coin.peak = Math.max(coin.peak, coin.price);
  coin.low = Math.min(coin.low, coin.price);
  if (coin.price <= coin.peak * 0.7) coin.dipped = true;
  coin.holders = Math.max(1, Math.round(coin.holders * (1 + (coin.signals.holderGrowth / 100) * 0.06 * (rng() * 0.6 + 0.7))));
  coin.history.push(coin.price);
  if (coin.price >= coin.launchPrice * 3 && !coin.moonStamped) {
    coin.moonStamped = true;
    pushFeed(state, `🚀 $${coin.symbol} is MOONING, ${Math.round((coin.price / coin.launchPrice) * 100) / 100}x from launch.`);
  }
}

// ---------------------------------------------------------------- agents ---
// Each strategy is one small readable function. They all trade through
// the same buy()/sell() the player uses, against the same prices.

function agentBuy(state, agent, coin, amount, reason) {
  const r = buy(state, agent.id, coin.id, Math.min(amount, state.cash[agent.id]));
  if (r.ok) {
    state.agentState[agent.id].bought[coin.id] = true;
    pushFeed(state, `${agent.emoji} ${agent.name} aped ${amount} NEAR into $${coin.symbol}. ${reason}`);
  }
  return r;
}

function agentSellAll(state, agent, coin, reason) {
  const held = state.holdings[agent.id][coin.id] || 0;
  if (held <= 0) return;
  const r = sell(state, agent.id, coin.id, 'all');
  if (r.ok) pushFeed(state, `${agent.emoji} ${agent.name} dumped $${coin.symbol} for ${r.proceeds} NEAR. ${reason}`);
  else if (coin.rugged) pushFeed(state, `${agent.emoji} ${agent.name} tried to sell $${coin.symbol}... rugged. Bag held forever.`);
}

const STRATEGIES = {
  // Degen: apes fresh launches at the open, no research. Sells euphoric
  // tops and dumps stale losers after two days.
  degen(state, agent, rng) {
    for (const coin of state.coins) {
      const age = absTick(state) - coin.bornAbsTick;
      if (coin.bornDay === state.day && age <= 1 && !state.agentState[agent.id].bought[coin.id]) {
        if (rng() < 0.45 && state.cash[agent.id] >= 8) {
          agentBuy(state, agent, coin, 8, 'Fresh launch, zero research, all vibes.');
        }
      }
      const pnl = positionPnl(state, agent.id, coin.id);
      if (pnl !== null) {
        if (pnl >= 0.8) agentSellAll(state, agent, coin, 'Up big. Even Andy takes profit sometimes.');
        else if (age > TICKS_PER_DAY * 2 && pnl < 0) agentSellAll(state, agent, coin, 'Dead bag. Rotating into the next shiny thing.');
      }
    }
  },
  // Sniper: never buys the open. Waits for a coin to fall 30%+ from its
  // peak AND bounce off its low, then buys — only dips with a story
  // (locked liquidity or a strong meme), at most 2 a day, with a
  // stop-loss. Even snipers learned about falling knives. Eventually.
  sniper(state, agent, rng) {
    const mem = state.agentState[agent.id];
    if (mem.dipCountDay !== state.day) { mem.dipCountDay = state.day; mem.dipCount = 0; }
    for (const coin of state.coins) {
      if (coin.rugged) continue;
      const pnl = positionPnl(state, agent.id, coin.id);
      if (pnl !== null && pnl >= 0.6) { agentSellAll(state, agent, coin, 'Dip bought, rip sold. Textbook.'); continue; }
      if (pnl !== null && pnl <= -0.35) { agentSellAll(state, agent, coin, 'Stop-loss. Even Dana has rules now.'); continue; }
      const age = absTick(state) - coin.bornAbsTick;
      const hasStory = coin.signals.locked || coin.signals.memeScore >= 60;
      // The bounce rule: the coin must have dipped 30%+ AND already be
      // recovering off its low. Catching a falling knife is how the old
      // Dana went broke; this Dana waits for the bounce to prove itself.
      const bouncing = coin.dipped && coin.price >= coin.low * 1.15 && coin.price < coin.peak * 0.85;
      if (age >= 2 && age <= TICKS_PER_DAY * 5 && hasStory && bouncing && mem.dipDay[coin.id] !== state.day) {
        if (state.cash[agent.id] >= 8 && mem.dipCount < 2) {
          mem.dipDay[coin.id] = state.day;
          mem.dipCount += 1;
          agentBuy(state, agent, coin, 8, `Dipped ${Math.round((1 - coin.price / coin.peak) * 100)}% and bouncing off the low. That is not a knife, that is a sale.`);
        }
      }
    }
  },
  // Cautious: only locked liquidity and a dev under 20%. Buys once,
  // modest size, takes a tidy 40%.
  cautious(state, agent, rng) {
    for (const coin of state.coins) {
      const pnl = positionPnl(state, agent.id, coin.id);
      if (pnl !== null && pnl >= 0.4) { agentSellAll(state, agent, coin, 'Forty percent, locked liquidity, no drama. Lisa sleeps fine.'); continue; }
      const age = absTick(state) - coin.bornAbsTick;
      if (!coin.rugged && age >= 2 && age <= 4 && !state.agentState[agent.id].bought[coin.id]) {
        if (coin.signals.locked && coin.signals.devPct < 20 && state.cash[agent.id] >= 6) {
          agentBuy(state, agent, coin, 6, 'Locked liquidity, small dev bag. The only two sentences Lisa reads.');
        }
      }
    }
  },
  // Whale: once a day, picks one of today's coins and buys HEAVY. His
  // own buy moves the price. Exits a few days later, in no hurry.
  whale(state, agent, rng) {
    const mem = state.agentState[agent.id];
    for (const coin of state.coins) {
      const pnl = positionPnl(state, agent.id, coin.id);
      const age = absTick(state) - coin.bornAbsTick;
      if (pnl !== null && pnl >= 1.5) {
        agentSellAll(state, agent, coin, 'Up 150%+. The whale dumps on schedule, and the schedule is greed.');
      } else if (pnl !== null && age >= TICKS_PER_DAY * 3 && rng() < 0.5) {
        agentSellAll(state, agent, coin, 'The whale surfaces, takes his plankton tax, and dives.');
      }
    }
    if (mem.whaleDay !== state.day && state.cash[agent.id] >= 25) {
      const todays = state.coins.filter((c) => c.bornDay === state.day && !c.rugged);
      if (todays.length) {
        const pick = todays[Math.floor(rng() * todays.length)];
        mem.whaleDay = state.day;
        agentBuy(state, agent, pick, 25, 'Watch the candle. That green wick is one wallet.');
      }
    }
  },
};

// ------------------------------------------------------------------ flow ---

export function stepTick(state, rng = Math.random) {
  if (state.over) return;
  state.tick += 1;
  for (const coin of state.coins) priceStep(state, coin, rng);
  for (const a of ACTORS) {
    if (a.id === 'player') continue;
    STRATEGIES[a.style](state, a, rng);
  }
  if (state.day === SEASON_DAYS && state.tick === TICKS_PER_DAY) {
    state.over = true;
    const board = leaderboard(state);
    const me = board.find((b) => b.id === 'player');
    pushFeed(state, `🏁 Season over. You finished on ${me.total.toFixed(2)} NEAR: ${rankFor(me.total)}. Winner: ${board[0].emoji} ${board[0].name} with ${board[0].total.toFixed(2)} NEAR.`);
  }
}

// Run the rest of the current day without further player input.
export function finishDay(state, rng = Math.random) {
  while (!state.over && state.tick < TICKS_PER_DAY) stepTick(state, rng);
}

export function nextDay(state, rng = Math.random) {
  if (state.over) return { ok: false, msg: 'Season over.' };
  if (state.tick < TICKS_PER_DAY) return { ok: false, msg: 'Finish the day first (or run the remaining ticks).' };
  state.day += 1;
  state.tick = 0;
  spawnDay(state, rng);
  pushFeed(state, `🌅 Day ${state.day} of ${SEASON_DAYS}. ${COINS_PER_DAY} new launches smell blood in the water.`);
  return { ok: true };
}

// Fast-forward the whole season (agents keep trading; the player idles).
export function runToEnd(state, rng = Math.random) {
  let guard = 0;
  while (!state.over && guard++ < SEASON_DAYS * TICKS_PER_DAY + 20) {
    if (state.tick < TICKS_PER_DAY) stepTick(state, rng);
    else nextDay(state, rng);
  }
}
