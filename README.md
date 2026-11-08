# Moon or Rug

**A memecoin survival arcade. Fourteen days, fifty-six launches, four agent degens, and one rule that never changes: after the rug, there is no exit.**

Built for **NEAR HACKATHON 2026 — Games With Real Economies** (secondary tag: Agent Economy).

Every day brings 4 fresh memecoin launches. Each coin has a hidden fate —
moon, bleed, or rug — and a set of public signals that genuinely lean on
that fate (the exact odds are published below, in this README and in
`engine.js`). Prices move tick by tick, 8 ticks a day. Four agent traders
bet their own bankrolls in public, each with a strategy you can read in
the code, and every trade — theirs and yours — moves the price. You start
with 100 NEAR, same as them. On day 14, the leaderboard is the truth.

## Play it

- **Instant:** open `dist/moon-or-rug.html` in any browser. The whole game
  in one file, no server.
- **From source:** `python3 -m http.server 8902` here, then open
  `http://localhost:8902/`.

## Try it like a judge (do X, see Y)

1. Read today's 4 coin cards. See the signal chips: 🔒 locked or ⚠️
   unlocked, dev %, holder growth, meme score, the dev's past record.
2. Click **Buy 10** on a locked coin with a small dev bag. See your buy
   nudge its price up on the sparkline — that is your own market impact.
3. Click **Next tick** a few times. See prices walk, and watch the agent
   feed: Andy aping launches blind, Bram's 25 NEAR whale buys bending
   candles, Lisa refusing anything unlocked.
4. Click **Finish day**, then **Next day**. See 4 new launches join the
   board while yesterday's coins keep trading in "Still trading".
5. Keep ticking until a coin stamps **RUGGED**. Try to sell it. See the
   refusal: after the rug tick, the coin cannot be sold at any price.
   That sting is the game.
6. Ride a coin past 3x and see the **MOONING** stamp — then decide if you
   sell into strength or hold for the stall. Moons run out of steam.
7. Click **Fast-forward**. See the whole season resolve: who read the
   market, who held souvenirs, and where you rank.

## The odds (published, and enforced by the code)

Fate is rolled from the coin's signals when it launches:

| Signal | Effect on fate |
| --- | --- |
| Liquidity **locked** | moon 35% · bleed 50% · rug **15%** |
| Liquidity **unlocked** | moon 25% · bleed 40% · rug **35%** |
| Dev wallet ≥ 25% | rug +10pts, moon −10pts |
| Dev rugged ≥ 2 past coins | rug +10pts, bleed −10pts |
| Meme score ≥ 80 | moon +8pts, bleed −8pts |

Locked liquidity cuts rug odds roughly in half — the test suite proves
it statistically (`test/simulate.mjs` generates 6,000 coins and asserts
the gap). Holder growth is only a tendency: moons usually grow holders
faster, but rug coins fake growth too. No single signal is a tell; the
table, read whole, is the edge.

**Fates, per tick:** moons pump hard in early stages, then taper, then
stall after 10–21 hot ticks and drift down. Bleeds grind down slowly.
Rugs pump a little — they have to look tempting — then at a hidden tick
(3+ ticks after launch, within ~4 days) the price is cut to ~1–3% and
the coin is unsellable forever.

**Market impact:** a buy pushes the price up and a sell pushes it down,
in proportion to trade size vs the coin's liquidity depth (capped at
25% per trade). Bram the whale does not get a special rule; his cheques
are just bigger.

## The agents (all strategies are readable functions in `engine.js`)

| Agent | Strategy | Personality leak |
| --- | --- | --- |
| 🦍 **Ape Andy** (degen) | Apes fresh launches at the open with ~45% probability, 8 NEAR, no signal reading. Sells +80%, dumps stale losers after 2 days. | Buys rugs at the top, regularly. |
| 🎯 **Dip Dana** (sniper) | Never buys the open. Buys coins that dipped 30%+ AND are bouncing off their low, only with a story (locked or meme ≥ 60), max 2/day, stop-loss −35%, takes +60%. | Learned the bounce rule after the old system took her to ~5 NEAR a season. |
| 🔒 **Lock Lisa** (cautious) | Only locked liquidity and dev < 20%. One modest 6 NEAR buy per coin, takes a tidy +40%. | Boring, and usually solvent. |
| 🐋 **Big Bram** (whale) | Once a day, drops 25 NEAR into one of today's launches; his buy visibly moves the price. Dumps at +150% or after ~3 days. | Sometimes he IS the exit liquidity. |

In seeded agent-only seasons the board spreads characterfully: Bram
swings between broke and 300+, Andy hovers 100–190, Lisa sits near her
start, Dana trails — the market punishes dip-buying, and the code shows
its work.

## How it is built

| Piece | File | What it does |
| --- | --- | --- |
| Engine | `engine.js` | Every rule: coin generation from the odds table, tick price paths by fate, the four agent strategies, trades with price impact, rug resolution, valuation, leaderboard, season end and ranks. Pure, seeded-RNG friendly, fully serializable state. |
| UI | `app.js`, `index.html`, `style.css` | Neon arcade rendering: coin cards, live sparklines, signal chips, MOONING/RUGGED stamps, agent feed, leaderboard. No rules live here. |
| Tests | `test/simulate.mjs` | Seeded: a full agent-only season completes, prices stay finite and ≥ 0, rugged coins are unsellable and worth ~0, locked coins rug statistically less (8pt margin), leaderboard totals equal cash + holdings. Run `node test/simulate.mjs`. |
| Single-file build | `build-single.mjs` | Inlines everything into `dist/moon-or-rug.html`. |

Pure HTML/CSS/JS + Node tests. Zero dependencies, no network calls,
nothing to install.

## NEAR mapping (honest scope)

The demo is a fully local simulation — that is the scope, stated plainly.
The production mapping is direct: each memecoin is an **NEP-141** token
on NEAR; each agent trader is a **NEAR agent account** holding its own
funds and trading through **function-call access keys** scoped to the
market contract with allowance limits; player and agent trades settle
against a shared liquidity contract, which is where the price-impact
rule lives on-chain. The game loop itself never needs a wallet popup,
per the Games track's "players never notice the chain" bonus.

## Same builder, other NEAR HACKATHON projects

This project was built during NEAR HACKATHON 2026 but is **not one of
my two submitted projects**. My submitted projects are:

- **NEAR, On The Evidence** — a reproducible NEAR investment-thesis dashboard (Investment Thesis track).
- **Pump Rider** — a one-button memecoin chart-riding arcade game (Games With Real Economies track).

Also built by me during this hackathon, but not submitted:

- **STREAK** — a memecoin with a daily streak mechanic (Memecoins track).

## Rules of the build

- Code written inside the hackathon window (announcement Oct 19, 2026 →
  deadline Nov 14, 2026, 23:59 UTC).
- License: MIT (see `LICENSE`).
