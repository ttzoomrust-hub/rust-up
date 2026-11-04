// Game rules shared by the site (js/app.js) and the server (bot/gamedata.js is generated from this file and the catalogs
// by tools/build-server-data.js — run it after changing anything here or in js/items*.js).
window.RUSTUP_RULES = {
  RTP: 0.95,              // payout ratio built into the upgrade chance
  MAX_CHANCE: 75,
  MIN_CHANCE: 1,
  MAX_SLOTS: 6,           // items in one upgrade stake
  TG_CHANNEL: 'up_rust',
  TG_BONUS_RUB: 50,       // one-time reward in rubles for subscribing to all SUB_CHANNELS (credited in coins at the CBR rate)
  PROMOS: { RUSTUP: 50, WIPE: 30, DEMO: 20 },   // in rubles (20–50 ₽), credited in coins at the CBR rate
  DAILY_MS: 24 * 60 * 60 * 1000,
  // daily gift in rubles: day 1 of the streak gives DAILY_RUB, each next day in a row +DAILY_GROWTH (compound) for DAILY_DAYS days,
  // then (or after a missed day) it starts again from day 1
  DAILY_RUB: 15,
  DAILY_GROWTH: 0.02,
  DAILY_DAYS: 7,
  // «Ракетка» (crash): the multiplier grows as e^(K·ms) from the start; the crash point is RTP / u (u uniform 0..1),
  // so cashing out at any x pays RTP on average. Bets in coins.
  CRASH: { RTP: 0.96, K: 0.0001, MAX: 1000, MIN_BET: 1, MAX_BET: 50000 },
  // contracts: MIN..MAX items of one game → one item worth (inputs value × multiplier); [multiplier, chance %], ~95% on average
  CONTRACT: { MIN: 3, MAX: 10, MULTS: [[0.3, 30], [0.6, 25], [1, 20], [1.5, 15], [2.5, 7.5], [4, 2.5]] },
  // case battles: 2–4 players open the same paid case for ROUNDS rounds, the biggest total takes every item; empty seats → bots
  BATTLE: { SIZES: [2, 3, 4], ROUNDS: 5, OPEN_MS: 15 * 60 * 1000 },
  CASHBACK: 0.02,         // share of a lost upgrade stake / of a paid case that paid out less than its price
  CASE_RTP: 0.9,          // average win is 90% of a paid case's price
  TIMER_MS: 15 * 60 * 1000,
  SUB_CHANNELS: [
    { id: 'up_rust', name: 'RUST UP', sub: 'Новости, промокоды, розыгрыши' },
    { id: 'rustuper', name: 'RUST UP · Отзывы', sub: 'Отзывы игроков о выводах' },
    { id: 'rustuptiktok', name: 'RUST UP · Заработок', sub: 'Заработок на роликах в TikTok' }
  ],
  // tiers: [min price, max price, items, chance % of the whole tier]; the items are taken from the catalog by price
  CASES: [
    { id: 'rust', game: 'rust', name: 'Rust-кейс', color: '#e5383b', tiers: [[20, 80, 6, 70], [80, 300, 3, 22], [300, 800, 2, 7], [1000, Infinity, 1, 1]] },
    { id: 'cs2', game: 'cs2', name: 'CS-кейс', color: '#f0a030', tiers: [[10, 60, 6, 70], [60, 400, 3, 22], [400, 2500, 2, 7], [8000, 30000, 1, 1]] },
    { id: 'nft', game: 'nft', name: 'NFT-кейс', color: '#2ea6e0', tiers: [[0, 100, 6, 70], [300, 450, 3, 22], [450, 1500, 2, 7], [1500, 5000, 1, 1]] }
  ],
  // free cases above: once a day; the prize waits until FREE_FRIENDS friends came by the player's link and spun a free case,
  // then it goes to the inventory or is sold; the next spin opens FREE_COOLDOWN after that
  FREE_FRIENDS: 5,
  FREE_COOLDOWN: 24 * 60 * 60 * 1000,
  // cases of the day: once in 24 hours, the prize is the player's at once. money: [rubles, chance %] go to the balance,
  // tiers add cheap items (prices in coins; 60 coins ≈ 100 ₽). Mostly +1 / +3 / +5 / +15 ₽.
  DAILY_CASES: [
    { id: 'rust-day', game: 'rust', name: 'Скин дня', color: '#ff7a45', daily: true, money: [[1, 38], [3, 26], [5, 17], [15, 9]], tiers: [[5, 60, 6, 10]] },
    { id: 'cs2-day', game: 'cs2', name: 'CS-кейс дня', color: '#f5b84d', daily: true, money: [[1, 38], [3, 26], [5, 17], [15, 9]], tiers: [[3, 60, 6, 10]] },
    { id: 'nft-day', game: 'nft', name: 'Подарок дня', color: '#e86bd8', daily: true, money: [[1, 38], [3, 26], [5, 17], [15, 9]], tiers: [[5, 60, 6, 10]] }
  ],
  // paid cases: opened any number of times; the price follows from the contents
  PAID_CASES: [
    { id: 'rust-wood', game: 'rust', name: 'Дерево', color: '#c8833a', tiers: [[5, 30, 6, 70], [30, 90, 3, 22], [90, 250, 2, 7], [250, 800, 1, 1]] },
    { id: 'rust-metal', game: 'rust', name: 'Металл', color: '#8fa3b8', tiers: [[30, 100, 6, 70], [100, 300, 3, 22], [300, 800, 2, 7], [800, Infinity, 1, 1]] },
    { id: 'rust-hqm', game: 'rust', name: 'МВК', color: '#e5383b', tiers: [[100, 300, 6, 70], [300, 700, 3, 22], [700, 1200, 2, 7], [1200, Infinity, 1, 1]] },
    { id: 'cs2-recruit', game: 'cs2', name: 'Новобранец', color: '#4f86e8', tiers: [[3, 40, 6, 70], [40, 200, 3, 22], [200, 1000, 2, 7], [1000, 5000, 1, 1]] },
    { id: 'cs2-assault', game: 'cs2', name: 'Штурм', color: '#f0a030', tiers: [[200, 1000, 6, 70], [1000, 4000, 3, 22], [4000, 12000, 2, 7], [12000, 40000, 1, 1]] },
    { id: 'cs2-elite', game: 'cs2', name: 'Элита', color: '#d84ae6', tiers: [[2000, 6000, 6, 70], [6000, 15000, 3, 22], [15000, 40000, 2, 7], [40000, Infinity, 1, 1]] },
    { id: 'nft-gifts', game: 'nft', name: 'Подарки', color: '#4fc27a', tiers: [[0, 40, 6, 70], [40, 100, 3, 22], [300, 400, 2, 7], [400, 900, 1, 1]] },
    { id: 'nft-collector', game: 'nft', name: 'Коллекционер', color: '#2ea6e0', tiers: [[300, 500, 6, 70], [500, 1500, 3, 22], [1500, 5000, 2, 7], [5000, 20000, 1, 1]] },
    { id: 'nft-fragment', game: 'nft', name: 'Fragment', color: '#ffd166', tiers: [[1000, 4000, 6, 70], [4000, 15000, 3, 22], [15000, 60000, 2, 7], [60000, 300000, 1, 1]] }
  ],
  // free every 15 minutes, no conditions: cheap loot from all three games, nothing above 500 coins; per-game item count in a 'mix' tier
  TIMER_CASE: { id: 'quarter', game: 'mix', name: 'Кейс 15 минут', color: '#4fc27a', timer: true, tiers: [[1, 15, 3, 72], [15, 60, 2, 22], [60, 300, 1, 5.5], [300, 500.01, 1, 0.5]] }
};
