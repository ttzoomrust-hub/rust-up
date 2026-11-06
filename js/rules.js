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
  // one shared round for everybody: BET_MS to place bets, the flight, PAUSE_MS showing the result, then the next round starts by itself
  CRASH: { RTP: 0.96, K: 0.0001, MAX: 1000, MIN_BET: 1, MAX_BET: 50000, BET_MS: 10000, PAUSE_MS: 3000 },
  // contracts: MIN..MAX items of one game → one item worth (inputs value × multiplier); [multiplier, chance %], ~95% on average
  CONTRACT: { MIN: 3, MAX: 10, MULTS: [[0.3, 30], [0.6, 25], [1, 20], [1.5, 15], [2.5, 7.5], [4, 2.5]] },
  // «огонёк» streak rewards, once per streak when it reaches the day: rubles to the balance or an item
  FIRE_REWARDS: [[3, { rub: 10 }], [7, { rub: 30 }], [14, { rub: 75 }], [30, { item: 'Алмаз' }]],
  // «Минёр»: 5×5, MIN..MAX mines; the n-th safe cell pays RTP × C(25, n) / C(25 − mines, n)
  MINES: { CELLS: 25, MIN: 1, MAX: 24, RTP: 0.96, MIN_BET: 1, MAX_BET: 50000 },
  // «Колесо»: shared spins — BET_MS of bets, SPIN_MS of the spin; LAYOUT is the 54 segments clockwise
  // (y gold ×50, b blue ×5, r red ×3, g gray ×2: 1/10/17/26 segments, 92.6–96.3% back)
  WHEEL: { BET_MS: 15000, SPIN_MS: 6000, MIN_BET: 1, MAX_BET: 50000,
    COLORS: { g: { x: 2, name: 'Серый' }, r: { x: 3, name: 'Красный' }, b: { x: 5, name: 'Синий' }, y: { x: 50, name: 'Золото' } },
    LAYOUT: 'ygrbgrgbgrgrgbgrgrgbgrgrgbgrgbgrgrgbgrgrgbgrgbrgrgbgrg' },
  // «Плинко»: 12 rows, the ball goes left or right at each; buckets 0..12 pay these multipliers (~96% back)
  PLINKO: { ROWS: 12, MIN_BET: 1, MAX_BET: 50000,
    RISK: { low: [9, 2.9, 1.5, 1.3, 1.1, 0.97, 0.5, 0.97, 1.1, 1.3, 1.5, 2.9, 9], mid: [30, 10, 3.8, 1.9, 1.1, 0.6, 0.3, 0.6, 1.1, 1.9, 3.8, 10, 30],
      high: [160, 23, 7.8, 1.9, 0.7, 0.2, 0.2, 0.2, 0.7, 1.9, 7.8, 23, 160] } },
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
  // ---------- progress (2026-11-06): levels, quests, the weekly tournament, the season (server: bot/progress.js) ----------
  // Every bet of every game counts: XP = XP_PLAY + 1 per ruble of the bet (a free case of the day gives XP_PLAY).
  // Level L → L+1 needs round(BASE × L^1.5) XP; reaching level L pays min(RUB_MAX, RUB_PER × L) ₽, plus ITEMS[L] if set.
  LEVELS: { XP_PLAY: 2, BASE: 60, RUB_PER: 2, RUB_MAX: 100, ITEMS: { 10: 'Мишка', 20: 'Букет', 30: 'Кубок', 40: 'Кольцо', 50: 'Алмаз' },
    // badge of the level: [from level, title, color]
    TIERS: [[1, 'Новичок', '#9aa0aa'], [5, 'Бывалый', '#4fc27a'], [10, 'Охотник', '#4f86e8'], [20, 'Мастер', '#a46cf0'], [30, 'Легенда', '#ffd166'], [50, 'Бог апгрейда', '#ff4d4f']] },
  // quests: N of each list are picked for the Moscow day / the week (Mon–Sun) the same for everybody.
  // t: play — any bet · wager — rubles bet · win — upgrade won · upgrade|case|crash|mines|wheel|plinko|contract|battle — bets there ·
  // dailycase — a case of the day. Reward: rub ₽ + XP + season snowflakes (SEASON_*); every daily quest done → +DAILY_ALL_RUB ₽.
  QUESTS: { DAILY_N: 3, WEEKLY_N: 3, DAILY_ALL_RUB: 10, XP_D: 30, XP_W: 150, SEASON_D: 25, SEASON_W: 120,
    DAILY: [
      { id: 'd-play', t: 'play', n: 5, rub: 5, title: 'Сыграйте 5 раз в любые игры' },
      { id: 'd-up', t: 'upgrade', n: 3, rub: 5, title: 'Сделайте 3 апгрейда' },
      { id: 'd-win', t: 'win', n: 1, rub: 8, title: 'Выиграйте апгрейд' },
      { id: 'd-case', t: 'case', n: 2, rub: 6, title: 'Откройте 2 платных кейса' },
      { id: 'd-crash', t: 'crash', n: 3, rub: 5, title: 'Сделайте 3 ставки в Ракетке' },
      { id: 'd-mines', t: 'mines', n: 2, rub: 5, title: 'Сыграйте 2 раунда в Минёре' },
      { id: 'd-wheel', t: 'wheel', n: 3, rub: 5, title: 'Сделайте 3 ставки в Колесе' },
      { id: 'd-plinko', t: 'plinko', n: 10, rub: 5, title: 'Бросьте 10 шаров в Плинко' },
      { id: 'd-wager', t: 'wager', n: 100, rub: 7, title: 'Поставьте в сумме 100 ₽' },
      { id: 'd-day', t: 'dailycase', n: 1, rub: 3, title: 'Откройте кейс дня' },
      { id: 'd-contract', t: 'contract', n: 1, rub: 6, title: 'Заключите контракт' }
    ],
    WEEKLY: [
      { id: 'w-play', t: 'play', n: 60, rub: 40, title: 'Сыграйте 60 раз в любые игры' },
      { id: 'w-wager', t: 'wager', n: 2000, rub: 60, title: 'Поставьте в сумме 2 000 ₽' },
      { id: 'w-win', t: 'win', n: 10, rub: 50, title: 'Выиграйте 10 апгрейдов' },
      { id: 'w-case', t: 'case', n: 15, rub: 40, title: 'Откройте 15 платных кейсов' },
      { id: 'w-battle', t: 'battle', n: 3, rub: 30, title: 'Сыграйте 3 кейс-баттла' },
      { id: 'w-crash', t: 'crash', n: 25, rub: 35, title: 'Сделайте 25 ставок в Ракетке' },
      { id: 'w-day', t: 'dailycase', n: 5, rub: 25, title: 'Откройте кейс дня 5 раз' }
    ] },
  // weekly tournament (Mon 00:00 – Sun 24:00 MSK): 1 point per ruble bet in any game; places 1..10 get PRIZES_RUB ₽ at the end
  // of the week (MIN_PTS points at least), the results go to the bot and the @up_rust channel
  TOUR: { PRIZES_RUB: [1000, 600, 400, 250, 200, 150, 120, 100, 80, 60], MIN_PTS: 100 },
  // the season: snowflakes ❄ = 1 per ruble bet + quests; every STEP snowflakes is a level of the season pass, its reward is taken
  // by hand (also CLAIM_MS after the end); the season top gets TOP_RUB ₽ at the end. Dates are ms (00:00 MSK).
  SEASON: { id: 'winter26', name: 'Зимний сезон', start: 1793912400000, end: 1799960400000, STEP: 300, CLAIM_MS: 7 * 24 * 60 * 60 * 1000, MIN_PTS: 300,
    TOP_RUB: [5000, 3000, 2000, 1000, 1000, 500, 500, 500, 500, 500],
    PASS: [{ rub: 5 }, { rub: 10 }, { item: 'Сердце' }, { rub: 15 }, { item: 'Роза' }, { rub: 20 }, { item: 'Подарок' }, { rub: 25 }, { item: 'Торт' }, { rub: 40 },
      { item: 'Шампанское' }, { rub: 50 }, { item: 'Ракета' }, { rub: 60 }, { item: 'Мишка' }, { rub: 75 }, { item: 'Букет' }, { rub: 100 }, { item: 'Кубок' }, { item: 'Алмаз' }] },
  // a player back after DAYS days or more without the app gets RUB ₽ once (claimed in the app), at most once in EVERY_DAYS;
  // the bot reminds about it. Not for twins, and only for accounts that have played before.
  COMEBACK: { DAYS: 5, RUB: 25, EVERY_DAYS: 30 },
  // referral contest of the month (MSK): a friend who came by the player's link counts once, in the month they reach LEVEL;
  // the top gets PRIZES_RUB ₽ on the 1st of the next month (MIN friends at least)
  REF_MONTH: { LEVEL: 5, PRIZES_RUB: [2000, 1000, 500, 300, 200], MIN: 3 },
  // events an admin starts from the panel (bot/social.js): what a multiplier applies to
  EVENT_KINDS: { xp: 'XP за ставки', tour: 'Очки турнира', season: 'Снежинки сезона', daily: 'Подарок дня', cashback: 'Кешбэк', quest: 'Награды заданий' },
  SHOWCASE_MAX: 3,
  // free every 15 minutes, no conditions: cheap loot from all three games, nothing above 500 coins; per-game item count in a 'mix' tier
  TIMER_CASE: { id: 'quarter', game: 'mix', name: 'Кейс 15 минут', color: '#4fc27a', timer: true, tiers: [[1, 15, 3, 72], [15, 60, 2, 22], [60, 300, 1, 5.5], [300, 500.01, 1, 0.5]] }
};
