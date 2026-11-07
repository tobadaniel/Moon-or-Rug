// app.js — the Moon or Rug UI. All rules live in engine.js; this file
// only renders state and forwards clicks.

import {
  SEASON_DAYS, TICKS_PER_DAY, START_CASH,
  createGame, stepTick, finishDay, nextDay,
  buy, sell, leaderboard, netWorth, holdingsValue, positionPnl, rankFor,
} from './engine.js';

const SAVE_KEY = 'moon-or-rug-save-v1';
const $ = (id) => document.getElementById(id);

let state;
let busy = false;

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* play unsaved */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data.coins || !data.cash) return false;
    state = data;
    return true;
  } catch { return false; }
}
function newGame() {
  state = createGame();
  $('season-banner').classList.add('hidden');
  toast('New season. Fresh launches, fresh rugs. Good luck out there.');
  save();
  render();
}
function toast(msg, bad = false) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('bad', bad);
}

// ------------------------------------------------------------- rendering ---

function drawSpark(canvas, values, color) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth * 2 || 300;
  const h = canvas.height = 68;
  ctx.clearRect(0, 0, w, h);
  if (values.length < 2) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * (w - 8) + 4;
    const y = h - 6 - ((v - min) / span) * (h - 12);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function chipsFor(coin) {
  const s = coin.signals;
  const chips = [];
  chips.push(s.locked
    ? '<span class="chip good">🔒 liquidity locked</span>'
    : '<span class="chip bad">⚠️ liquidity unlocked</span>');
  chips.push(`<span class="chip ${s.devPct >= 25 ? 'bad' : ''}">👨‍💻 dev holds ${s.devPct}%</span>`);
  chips.push(`<span class="chip ${s.holderGrowth >= 40 ? 'hot' : ''}">👥 holders +${s.holderGrowth}% (${coin.holders})</span>`);
  chips.push(`<span class="chip ${s.memeScore >= 80 ? 'hot' : ''}">🔥 meme score ${s.memeScore}</span>`);
  if (s.devLaunches > 0) {
    chips.push(`<span class="chip ${s.devRugs >= 2 ? 'bad' : ''}">📜 dev: ${s.devLaunches} launches, ${s.devRugs} rugs</span>`);
  } else {
    chips.push('<span class="chip">📜 dev: first launch</span>');
  }
  return chips.join('');
}

function coinCard(coin) {
  const held = state.holdings.player[coin.id] || 0;
  const pnl = positionPnl(state, 'player', coin.id);
  const chg = ((coin.price - coin.launchPrice) / coin.launchPrice) * 100;
  const mooning = !coin.rugged && coin.price >= coin.launchPrice * 3;
  const card = document.createElement('article');
  card.className = `coin${coin.rugged ? ' rugged' : ''}${mooning ? ' mooning' : ''}`;
  card.innerHTML = `
    ${coin.rugged ? '<div class="stamp rug">RUGGED</div>' : mooning ? '<div class="stamp moon">MOONING</div>' : ''}
    <header>
      <div class="emoji">${coin.emoji}</div>
      <div>
        <div class="sym">$${coin.symbol}</div>
        <div class="cname">${coin.name} · day ${coin.bornDay} launch</div>
      </div>
    </header>
    <div class="price-row">
      <span class="price">${coin.price.toFixed(3)}</span>
      <span class="chg ${chg >= 0 ? 'up' : 'down'}">${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(0)}% vs launch</span>
    </div>
    <canvas></canvas>
    <div class="chips">${chipsFor(coin)}</div>
    <p class="position">${held > 0
      ? `🎒 You hold ${held.toFixed(1)} ($${coin.symbol}) · worth ${(held * coin.price).toFixed(2)} NEAR${pnl !== null ? ` · ${pnl >= 0 ? '+' : ''}${Math.round(pnl * 100)}%` : ''}`
      : '🎒 No position'}</p>
    <div class="trade-btns">
      ${[5, 10, 25].map((amt) => `<button class="buy" data-act="buy" data-c="${coin.id}" data-amt="${amt}" ${coin.rugged || state.over ? 'disabled' : ''}>Buy ${amt}</button>`).join('')}
      <button class="sell" data-act="sellhalf" data-c="${coin.id}" ${held <= 0 || coin.rugged || state.over ? 'disabled' : ''}>Sell half</button>
      <button class="sell" data-act="sellall" data-c="${coin.id}" ${held <= 0 || coin.rugged || state.over ? 'disabled' : ''}>Sell all</button>
    </div>`;
  drawSpark(card.querySelector('canvas'), coin.history.slice(-40), coin.rugged ? '#ff4040' : chg >= 0 ? '#00ffa3' : '#ff3d8a');
  card.querySelectorAll('button[data-act]').forEach((b) => { b.onclick = () => onTrade(b.dataset); });
  return card;
}

function renderCoins() {
  const today = $('coins-today'); const older = $('coins-older'); const dead = $('coins-dead');
  today.innerHTML = ''; older.innerHTML = ''; dead.innerHTML = '';
  for (const coin of state.coins) {
    const card = coinCard(coin);
    if (coin.rugged) dead.appendChild(card);
    else if (coin.bornDay === state.day) today.appendChild(card);
    else older.appendChild(card);
  }
}

function renderHeader() {
  const board = leaderboard(state);
  const meIdx = board.findIndex((b) => b.id === 'player');
  $('stat-day').textContent = `${state.day} / ${SEASON_DAYS}`;
  $('stat-tick').textContent = `${state.tick} / ${TICKS_PER_DAY}`;
  $('stat-cash').textContent = `${state.cash.player.toFixed(2)} NEAR`;
  $('stat-bags').textContent = `${holdingsValue(state, 'player').toFixed(2)} NEAR`;
  $('stat-worth').textContent = `${netWorth(state, 'player').toFixed(2)} NEAR`;
  $('stat-rank').textContent = `#${meIdx + 1} of ${board.length}`;
  $('leaderboard').innerHTML = board.map((b, i) => `
    <tr class="${b.id === 'player' ? 'me' : ''}">
      <td>${i + 1}. ${b.emoji} ${b.name}</td>
      <td>${b.total.toFixed(2)}</td>
    </tr>`).join('');
  $('feed').innerHTML = state.feed.map((line) => `<li>${line}</li>`).join('');
  $('btn-tick').disabled = busy || state.over;
  $('btn-day').disabled = busy || state.over;
  $('btn-next-day').disabled = busy || state.over;
  $('btn-ff').disabled = busy || state.over;
  if (state.over) showSeasonEnd(board);
}

function showSeasonEnd(board) {
  const me = board.find((b) => b.id === 'player');
  const myRank = board.findIndex((b) => b.id === 'player') + 1;
  const el = $('season-banner');
  el.innerHTML = `🏁 <strong>Season over.</strong> You finished <strong>#${myRank} of ${board.length}</strong> with
    <strong>${me.total.toFixed(2)} NEAR</strong> — rank: <strong>${rankFor(me.total)}</strong>.
    The crown goes to ${board[0].emoji} ${board[0].name} with ${board[0].total.toFixed(2)} NEAR.
    <button class="small" id="btn-again">Run it back</button>`;
  el.classList.remove('hidden');
  $('btn-again').onclick = newGame;
}

function render() { renderHeader(); renderCoins(); }

// -------------------------------------------------------------- actions ---

function onTrade(ds) {
  if (busy) return;
  const coinId = Number(ds.c);
  let r;
  if (ds.act === 'buy') r = buy(state, 'player', coinId, Number(ds.amt));
  else if (ds.act === 'sellall') r = sell(state, 'player', coinId, 'all');
  else {
    const held = state.holdings.player[coinId] || 0;
    r = sell(state, 'player', coinId, held / 2);
  }
  toast(r.msg, !r.ok);
  save();
  render();
}

function afterStep() { save(); render(); }

$('btn-tick').onclick = () => { if (!busy) { stepTick(state); afterStep(); } };
$('btn-day').onclick = () => { if (!busy) { finishDay(state); afterStep(); } };
$('btn-next-day').onclick = () => {
  if (busy) return;
  finishDay(state);
  const r = nextDay(state);
  if (!r.ok && !state.over) toast(r.msg, true);
  afterStep();
};
$('btn-ff').onclick = () => {
  if (busy) return;
  busy = true;
  render();
  toast('Fast-forwarding. The degens do not sleep, and now neither do you.');
  const timer = setInterval(() => {
    if (state.tick < TICKS_PER_DAY) stepTick(state);
    else nextDay(state);
    afterStep();
    if (state.over) {
      clearInterval(timer);
      busy = false;
      render();
    }
  }, 260);
};
$('btn-reset').onclick = () => {
  if (confirm('Start a fresh season? This one will be replaced.')) newGame();
};

if (!load()) state = createGame();
render();
