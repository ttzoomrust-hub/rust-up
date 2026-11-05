/* RUST UP game modes: «Ракетка» (crash), «Контракты», «Кейс-баттлы». Everything is played on the game server
   (bot/modes.js); these pages only show it. Uses the app's helpers through window.RUSTUP_APP (js/app.js), loaded after this file. */
(() => {
  'use strict';
  const R = window.RUSTUP_RULES, CR = R.CRASH, CT = R.CONTRACT, BT = R.BATTLE;
  const A = () => window.RUSTUP_APP;
  // «Похвастаться» after a good win (js/extras.js)
  const brag = o => window.RUSTUP_EXTRAS && window.RUSTUP_EXTRAS.brag(o);
  const page = html => { A().$('#page').innerHTML = html; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const timers = new Set();
  const every = (fn, ms) => { const t = setInterval(fn, ms); timers.add(t); return t; };
  let raf = 0;
  const back = `<a class="back-link" href="#/">${'<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'}<span>Все игры</span></a>`;
  // bets are typed in the player's currency and sent in coins
  const toCoins = v => v / A().perCoin();
  const fromCoins = c => c * A().perCoin();
  const numIn = el => Number(String(el.value || '').replace(',', '.').replace(/\s/g, '')) || 0;
  const fmtIn = c => { const v = fromCoins(c); return String(Math.round(v * 100) / 100); };

  // ---------- home tiles ----------
  const ROCKET = `<svg class="gc-rocket" viewBox="0 0 64 64"><defs><linearGradient id="rk" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9ced6"/></linearGradient></defs>
    <path d="M40 8c8 0 14 2 16 4 2 2 4 8 4 16-6 6-14 12-22 16l-14-14C28 22 34 14 40 8z" fill="url(#rk)"/><circle cx="44" cy="20" r="5" fill="#2f7cf6" stroke="#1b4fae" stroke-width="2"/>
    <path d="M24 30l-10 2-6 8 12 2zM34 40l-2 10-8 6-2-12z" fill="#e5383b"/><path d="M20 40c-4 2-8 8-10 14 6-2 12-6 14-10z" fill="#ffb340"/><path d="M19 43c-2 1-4 4-5 7 3-1 6-3 7-5z" fill="#fff3c4"/></svg>`;
  function tiles() {
    const skins = Object.values(A().byName).filter(s => s.game === 'cs2' && s.price > 300 && s.price < 3000).slice(0, 3);
    const cases = A().PAID_CASES.slice(0, 2);
    return [
      { href: '#/crash', cls: 'gc-crash', title: 'Ракетка', on: 'crash', badge: 'HOT', cover: 'crash', art: ROCKET },
      { href: '#/contract', cls: 'gc-contract', title: 'Контракты', on: 'contract', cover: 'contract', art: skins.map((s, i) => `<img class="gc-mini m${i}" src="${s.img}" alt="" draggable="false">`).join('') },
      { href: '#/mines', cls: 'gc-mines', title: 'Минёр', on: 'mines', badge: 'NEW', cover: 'mines', art: '' },
      { href: '#/wheel', cls: 'gc-wheel', title: 'Колесо', on: 'wheel', badge: 'NEW', cover: 'wheel', art: '' },
      { href: '#/plinko', cls: 'gc-plinko', title: 'Плинко', on: 'plinko', badge: 'NEW', cover: 'plinko', art: '' },
      { href: '#/battles', cls: 'gc-battle', title: 'Кейс-баттл', on: 'battle', badge: 'PvP', cover: 'battle', art: `${cases.map((c, i) => { const s = A().caseItems(c)[0].skin; return `<img class="gc-bt b${i}${A().imgCls(s)}" src="${s.img}" alt="" draggable="false">`; }).join('')}<b class="gc-vs">VS</b>` }
    ];
  }

  // =====================================================================================
  // «Ракетка»
  // =====================================================================================
  const CRASH_BETS = [10, 50, 100, 500, 1000];   // quick bets in coins
  // one shared round for everybody (bot/modes.js crash_state): R.CRASH.BET_MS for bets, the flight, a short pause, the next round
  const C = { bet: 50, auto: '', phase: 'idle', st: null, off: 0, round: 0, me: null, cashed: null, amount: 0, busy: false, queued: false, boomed: 0 };
  const multAt = ms => Math.min(CR.MAX, Math.floor(Math.exp(CR.K * Math.max(0, ms)) * 100) / 100);
  const x2 = n => n.toFixed(2).replace('.', ',') + '×';
  // the rocket of the page: side view, nose to the right, a flickering flame
  const SHIP = `<svg class="cr-svg" viewBox="0 0 400 200">
    <defs><linearGradient id="crb" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#e7e9ef"/><stop offset="1" stop-color="#a9afbd"/></linearGradient>
      <linearGradient id="crf" x1="1" x2="0"><stop offset="0" stop-color="#fff6c4"/><stop offset=".35" stop-color="#ffb23a"/><stop offset=".75" stop-color="#ff4a2e"/><stop offset="1" stop-color="#ff4a2e" stop-opacity="0"/></linearGradient>
      <radialGradient id="crw" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#bfe3ff"/><stop offset=".6" stop-color="#3b8cff"/><stop offset="1" stop-color="#1b3f9e"/></radialGradient></defs>
    <g class="cr-flame"><path d="M118 100 C80 60 20 70 0 100 C20 130 80 140 118 100Z" fill="url(#crf)"/><path d="M118 100 C95 84 60 86 46 100 C60 114 95 116 118 100Z" fill="#fff6c4" opacity=".9"/></g>
    <path d="M150 62 L118 30 L170 52Z M150 138 L118 170 L170 148Z" fill="#e5383b" stroke="#7a0c0f" stroke-width="4" stroke-linejoin="round"/>
    <path d="M120 80 Q120 62 150 60 L300 60 Q370 70 392 100 Q370 130 300 140 L150 140 Q120 138 120 120Z" fill="url(#crb)" stroke="#3a3f4d" stroke-width="5"/>
    <path d="M300 60 Q370 70 392 100 Q370 130 300 140 Q322 100 300 60Z" fill="#e5383b" stroke="#3a3f4d" stroke-width="5"/>
    <rect x="170" y="60" width="18" height="80" fill="#e5383b"/><rect x="196" y="60" width="8" height="80" fill="#e5383b"/>
    <circle cx="250" cy="100" r="24" fill="url(#crw)" stroke="#3a3f4d" stroke-width="6"/><circle cx="242" cy="92" r="7" fill="#fff" opacity=".8"/>
    <text x="150" y="133" font-family="Montserrat, Arial Black" font-weight="900" font-size="15" fill="#3a3f4d">RUST UP</text></svg>`;

  function crashPage() {
    const { coin } = A();
    page(`<div class="page crash-page">
      ${back}
      <div class="cr-top"><div class="cr-hist" id="crHist"></div><button class="cr-ico" data-crash-help aria-label="Правила">?</button></div>
      <div class="cr-stage" id="crashStage">
        <div class="cr-stars"></div><div class="cr-stars s2"></div>
        <div class="cr-mult" id="crashMult">…</div>
        <div class="cr-sub" id="crashStatus">Подключаемся…</div>
        <div class="cr-timer" id="crTimer"><i></i></div>
        <div class="cr-ship" id="crashRocket"><i class="cr-puff p1"></i><i class="cr-puff p2"></i><i class="cr-puff p3"></i><div class="cr-me" id="crashMe"></div>${SHIP}</div>
        <div class="cr-clouds c1"></div><div class="cr-clouds c2"></div>
      </div>
      <button class="cr-btn" id="crashBtn"></button>
      <div class="cr-bet w-glass">
        <div class="cr-row"><span>Ставка, ${A().curSym()}</span><span>Автовывод</span></div>
        <div class="cr-row">
          <div class="cr-amount"><button data-bet="half">½</button><input id="crashBet" inputmode="decimal" value="${fmtIn(C.bet)}"><button data-bet="x2">×2</button></div>
          <div class="cr-auto"><input id="crashAuto" inputmode="decimal" placeholder="выкл" value="${C.auto}"><i>×</i></div>
        </div>
        <div class="cr-quick">${CRASH_BETS.map(b => `<button data-bet-set="${b}">${coin(b)}</button>`).join('')}<button data-bet="max">Макс</button></div>
      </div>
      <div class="cr-players">
        <div class="cr-ph">Игроков <b id="crPlayers">0</b> · банк <b id="crBank">${coin(0)}</b></div>
        <div id="crList"><div class="cr-empty">Ставок пока нет — будьте первым!</div></div>
      </div>
    </div>`);
    const bet = A().$('#crashBet'), auto = A().$('#crashAuto');
    bet.addEventListener('input', () => { C.bet = toCoins(numIn(bet)); paintBtn(); });
    auto.addEventListener('input', () => { C.auto = auto.value.replace(',', '.'); paintBtn(); });
    A().$('#crashBtn').onclick = crashClick;
    document.querySelectorAll('[data-bet],[data-bet-set]').forEach(b => { b.onclick = () => {
      if (b.dataset.betSet) C.bet = +b.dataset.betSet;
      else if (b.dataset.bet === 'half') C.bet = Math.max(CR.MIN_BET, C.bet / 2);
      else if (b.dataset.bet === 'x2') C.bet = Math.min(CR.MAX_BET, C.bet * 2);
      else C.bet = Math.min(CR.MAX_BET, Math.floor(A().S.balance * 100) / 100);
      bet.value = fmtIn(C.bet); paintBtn();
    }; });
    A().$('[data-crash-help]').onclick = crashHelp;
    C.phase = 'live';
    poll();
    every(() => { if (!document.hidden) poll(); }, 500);
    cancelAnimationFrame(raf);
    const frame = () => { if (A().curPath() !== '/crash') return; tick(); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
  }
  function crashHelp() {
    A().modal('Ракетка', `<div class="free-help"><b>Забери выигрыш до взрыва</b><ol>
      <li>Раунды идут сами, один за другим. Перед каждым стартом — ${CR.BET_MS / 1000} секунд на ставки.</li>
      <li>Ракета взлетает, множитель растёт: 1,00×, 1,50×, 2,00×… Все игроки летят в одном раунде.</li>
      <li>Нажмите «Забрать» в любой момент — ставка умножится на текущий множитель.</li>
      <li>Ракета взрывается в случайный момент. Не успели — ставка сгорает.</li>
      <li>Автовывод забирает сам на выбранном множителе — даже если закрыть игру.</li>
      <li>Опоздали к старту — нажмите «Ставка на следующий раунд», и она сделается сама.</li></ol>
      <button class="btn btn-accent" id="chOk">Понятно</button></div>`, m => { A().$('#chOk', m).onclick = A().closeModal; });
  }
  const serverNow = () => Date.now() + C.off;
  const phaseOf = r => (!r ? 'wait' : r.crashed ? 'crashed' : serverNow() < r.launch_at ? 'bet' : 'fly');
  function poll() {
    const t0 = Date.now();
    A().api('crash_state').then(d => {
      if (!d.ok || A().curPath() !== '/crash') return;
      C.off = d.now - (t0 + Date.now()) / 2;
      const r = d.round;
      if (r.id !== C.round) {
        // a new round: reset the stage
        C.round = r.id; C.cashed = null; C.amount = 0; C.boomed = 0;
        const st = A().$('#crashStage'); if (st) st.classList.remove('boom', 'won', 'flying');
      }
      C.st = d; C.me = d.me || (C.me && C.me.round === r.id ? C.me : null);
      if (d.me) C.me = { ...d.me, round: r.id };
      if (d.settled && d.settled.win) { A().sfxWin(); A().toast(`Автовывод на ${x2(d.settled.mult)}: +${A().money(d.settled.amount)}`, 'success'); brag({ value: d.settled.amount, mult: d.settled.mult, game: 'Ракетка', title: 'РАКЕТКА' }); }
      // the bet the player asked for while the rocket was flying goes in as soon as bets open
      if (C.queued && !C.me && !C.busy && phaseOf(r) === 'bet') { C.queued = false; placeBet(); }
      if (r.crashed && C.boomed !== r.id) boom(r);
      renderRound(d);
    });
  }
  function boom(r) {
    C.boomed = r.id;
    const st = A().$('#crashStage');
    if (st) { st.classList.remove('flying'); st.classList.add('boom'); }
    A().beep(110, 0.35, 'sawtooth', 0.05);
    const mine = C.me && C.me.round === r.id;
    status(mine && C.cashed ? `Улетела на ${x2(r.point)} · вы забрали ${x2(C.cashed)} (+${A().money(C.amount)})` : mine && !(C.me.auto && C.me.auto < r.point) ? `Улетела на ${x2(r.point)} · ставка сгорела` : `Улетела на ${x2(r.point)}`);
    if (mine) setTimeout(() => A().api('load'), 600);
  }
  function renderRound(d) {
    const { coin, esc, avatarHtml, avaUrl } = A();
    const hist = A().$('#crHist');
    if (hist) hist.innerHTML = d.history.map(p => `<span class="cr-chip ${p >= 5 ? 'hi' : p >= 2 ? 'mid' : ''}">${x2(p)}</span>`).join('');
    const pl = A().$('#crPlayers'), bank = A().$('#crBank'), list = A().$('#crList');
    if (!list) return;
    pl.textContent = d.players; bank.innerHTML = coin(d.bank);
    const crashed = d.round.crashed;
    list.innerHTML = d.bets.length ? d.bets.map(b => `<div class="cr-pl${b.mult ? ' win' : crashed ? ' lost' : ''}">
      ${avatarHtml(b.nick, b.color || '#e5383b', 'cr-ava', avaUrl(b.id))}
      <span class="cr-who"><b>${esc(b.nick)}</b>${coin(b.bet)}</span>
      <span class="cr-x">${b.mult ? x2(b.mult) : crashed ? '💥' : '—'}</span>
      <span class="cr-win">${b.mult ? coin(b.amount) : ''}</span></div>`).join('')
      : '<div class="cr-empty">Ставок пока нет — будьте первым!</div>';
  }
  // every frame: the countdown, the multiplier, the rocket, the button
  function tick() {
    const d = C.st;
    if (!d) return;
    const r = d.round, ph = phaseOf(r), t = serverNow();
    const st = A().$('#crashStage'), mult = A().$('#crashMult'), timer = A().$('#crTimer');
    if (!st) return;
    st.classList.toggle('betting', ph === 'bet');
    if (ph === 'bet') {
      const left = Math.max(0, r.launch_at - t);
      mult.textContent = (left / 1000).toFixed(1).replace('.', ',') + ' c';
      mult.classList.remove('hot');
      status('Приём ставок — ракета стартует через');
      timer.firstElementChild.style.width = (100 * left / CR.BET_MS) + '%';
      draw(0);
    } else if (ph === 'fly') {
      if (!st.classList.contains('flying')) { st.classList.add('flying'); A().haptic('light'); }
      const m = multAt(t - r.launch_at);
      mult.textContent = x2(m); mult.classList.toggle('hot', m >= 2);
      const mine = C.me && C.me.round === r.id;
      status(mine && !C.cashed ? 'Забирайте до взрыва!' : mine ? `Вы забрали ${x2(C.cashed)} — летим дальше` : 'Ракета летит!');
      if (mine && !C.cashed && !C.busy && C.me.auto && m >= C.me.auto) cashOut();
      draw(t - r.launch_at);
      C.mult = m;
    } else if (ph === 'crashed') {
      mult.textContent = x2(r.point); mult.classList.remove('hot');
    }
    paintBtn();
  }
  function paintBtn() {
    const b = A().$('#crashBtn'), d = C.st;
    if (!b) return;
    const { coin } = A();
    const r = d && d.round, ph = phaseOf(r), mine = r && C.me && C.me.round === r.id;
    const auto = Number(C.auto) >= 1.01 ? ` · автовывод ${x2(Number(C.auto))}` : '';
    let cls = '', html, dis = C.busy;
    if (!d) { html = '<b>Подключаемся…</b>'; dis = true; }
    else if (ph === 'fly' && mine && !C.cashed) { cls = 'cash'; html = `<b>Забрать ${coin(C.me.bet * (C.mult || 1))}</b><small>${x2(C.mult || 1)}</small>`; }
    else if (mine && (C.cashed || ph === 'crashed') && C.queued) { cls = 'queued'; html = `<b>Ставка на следующий раунд ✓</b><small>${coin(C.bet)} · нажмите, чтобы отменить</small>`; }
    else if (mine && (C.cashed || ph === 'crashed')) html = `<b>Сделать ставку</b><small>на следующий раунд · ${coin(C.bet)}</small>`;
    else if (mine) { html = `<b>Ставка принята</b><small>${coin(C.me.bet)}${C.me.auto ? ` · автовывод ${x2(C.me.auto)}` : ''}</small>`; dis = true; }
    else if (ph === 'bet') html = `<b>Сделать ставку</b><small>${coin(C.bet)}${auto}</small>`;
    else if (C.queued) { cls = 'queued'; html = `<b>Ставка на следующий раунд ✓</b><small>${coin(C.bet)} · нажмите, чтобы отменить</small>`; }
    else html = `<b>Сделать ставку</b><small>на следующий раунд · ${coin(C.bet)}</small>`;
    b.className = 'cr-btn' + (cls ? ' ' + cls : '');
    if (b.dataset.h !== html) { b.innerHTML = html; b.dataset.h = html; }
    b.disabled = !!dis;
    // the player's own bet rides next to the rocket
    const me = A().$('#crashMe');
    if (me) {
      const show = mine && (ph === 'fly' || ph === 'bet' || C.cashed);
      const h = show ? `${A().avatarHtml(A().S.user ? A().S.user.name : '', (A().S.user && A().S.user.color) || '#e5383b', 'cr-ava', A().S.user && A().avaUrl(A().S.user.id))}<span>${coin(C.cashed ? C.amount : C.me.bet)}</span>` : '';
      if (me.dataset.h !== h) { me.innerHTML = h; me.dataset.h = h; }
      me.classList.toggle('won', !!C.cashed);
    }
  }
  function crashClick() {
    const d = C.st;
    if (!d || C.busy) return;
    const ph = phaseOf(d.round), mine = C.me && C.me.round === d.round.id;
    if (ph === 'fly' && mine && !C.cashed) return cashOut();
    if (mine && !C.cashed && ph !== 'crashed') return;
    A().requireLogin(() => {
      if (ph === 'bet') return placeBet();
      // flying or the pause: the bet goes into the next round
      C.queued = !C.queued;
      A().haptic('light');
      paintBtn();
    });
  }
  function placeBet() {
    const bet = Math.round(C.bet * 100) / 100, auto = Number(C.auto) || 0;
    if (!(bet >= CR.MIN_BET)) return A().toast(`Минимальная ставка ${A().money(CR.MIN_BET)}`, 'error');
    if (bet > A().S.balance) return A().toast('Недостаточно средств', 'error');
    if (C.auto && auto < 1.01) return A().toast('Автовывод — от 1,01×', 'error');
    C.busy = true; paintBtn();
    A().api('crash_bet', { bet, auto: auto || undefined }).then(d => {
      C.busy = false;
      if (!d.ok) {
        if (d.error === 'late') { C.queued = true; A().toast('Старт уже был — ставка уйдёт в следующий раунд', 'success'); }
        else A().netToast(d);
        return paintBtn();
      }
      C.me = { bet, auto: auto || null, round: d.round };
      A().haptic('medium');
      poll();
    });
  }
  function cashOut() {
    if (C.busy || C.cashed) return;
    C.busy = true; paintBtn();
    A().api('crash_cash').then(d => {
      C.busy = false;
      if (!d.ok) { if (d.error !== 'noround' && d.error !== 'wait') A().netToast(d); return; }
      if (d.win) {
        C.cashed = d.mult; C.amount = d.amount;
        A().sfxWin(); A().haptic('success');
        A().toast(`Забрали на ${x2(d.mult)}: +${A().money(d.amount)}`, 'success');
        brag({ value: d.amount, mult: d.mult, game: 'Ракетка', title: 'РАКЕТКА' });
        const st = A().$('#crashStage'); if (st) st.classList.add('won');
      }
      paintBtn();
    });
  }
  const status = t => { const el = A().$('#crashStatus'); if (el && el.textContent !== t) el.textContent = t; };
  // the rocket waits low on the left while bets are taken, climbs to the middle in the first seconds, then the sky moves past it
  function draw(ms = 0) {
    const ship = A().$('#crashRocket');
    if (!ship) return;
    const p = Math.min(1, ms / 2600), e = 1 - Math.pow(1 - p, 3);
    ship.style.left = (26 + 24 * e) + '%';
    ship.style.top = (76 - 26 * e) + '%';
  }

  // =====================================================================================
  // Контракты
  // =====================================================================================
  const K = { game: 'cs2', sel: [], busy: false };
  function contractPage() {
    const { S, GAMES, card, coin, byName, esc } = A();
    if (!GAMES.some(g => g.id === K.game)) K.game = GAMES[0].id;
    K.sel = K.sel.filter(u => { const i = A().invItem(u); return i && byName[i.name].game === K.game; });
    const items = S.inventory.filter(i => byName[i.name] && byName[i.name].game === K.game).map(i => ({ ...i, skin: byName[i.name] })).sort((a, b) => b.skin.price - a.skin.price);
    const chosen = K.sel.map(u => A().invItem(u)).filter(Boolean).map(i => byName[i.name]);
    const value = chosen.reduce((a, s) => a + s.price, 0);
    const minX = CT.MULTS[0][0], maxX = CT.MULTS[CT.MULTS.length - 1][0];
    page(`<div class="page contract-page">
      ${back}
      <div class="mode-head"><h1 class="up-title">Контракты</h1><button class="pp-help" data-ct-help aria-label="Правила">?</button></div>
      <div class="game-switch">${GAMES.map(g => `<button type="button" class="game-tab${g.id === K.game ? ' active' : ''}" data-ct-game="${g.id}"><span class="game-text"><b>${g.name}</b></span></button>`).join('')}</div>
      <div class="ct-box w-glass">
        <div class="ct-slots">${Array.from({ length: CT.MAX }, (_, i) => chosen[i]
          ? `<div class="ct-slot full" data-ct-del="${K.sel[i]}">${card(chosen[i], { static: true })}</div>`
          : `<div class="ct-slot${i < CT.MIN ? ' need' : ''}"><span>${i + 1}</span></div>`).join('')}</div>
        <div class="ct-sum">
          <div><span>Вклад</span><b>${coin(value)}</b></div>
          <div><span>Получите</span><b>${value ? `${coin(value * minX)} – ${coin(value * maxX)}` : '—'}</b></div>
        </div>
        <button class="btn btn-accent ct-btn" id="ctGo" ${chosen.length >= CT.MIN && !K.busy ? '' : 'disabled'}>${chosen.length >= CT.MIN ? `Подписать контракт · ${chosen.length} шт.` : `Выберите ещё ${CT.MIN - chosen.length} ${A().plural(CT.MIN - chosen.length, 'предмет', 'предмета', 'предметов')}`}</button>
      </div>
      <div class="row-head"><h2 class="home-title">Ваши предметы</h2><span class="muted">${items.length}</span></div>
      ${items.length ? `<div class="ct-inv">${items.map(i => card(i.skin, { selected: K.sel.includes(i.uid), attrs: `data-ct-add="${esc(i.uid)}"` })).join('')}</div>`
        : `<div class="panel cases-empty"><b>Нет предметов ${esc((GAMES.find(g => g.id === K.game) || {}).name || '')}</b><span class="muted">Откройте кейс или выиграйте в апгрейде</span><a class="btn btn-accent" href="#/cases">К кейсам</a></div>`}
    </div>`);
    A().$('#ctGo').onclick = signContract;
    A().$('[data-ct-help]').onclick = () => A().modal('Контракты', `<div class="free-help"><b>Обменяйте ${CT.MIN}–${CT.MAX} предметов на один</b><ol>
      <li>Выберите от ${CT.MIN} до ${CT.MAX} предметов одной игры.</li>
      <li>Взамен придёт один предмет той же игры стоимостью от ${Math.round(minX * 100)}% до ${Math.round(maxX * 100)}% от вклада.</li>
      ${CT.MULTS.map(([x, ch]) => `<li>x${x} — шанс ${ch}%</li>`).join('')}</ol><button class="btn btn-accent" id="ctOk">Понятно</button></div>`,
      m => { A().$('#ctOk', m).onclick = A().closeModal; });
  }
  function signContract() {
    if (K.busy || K.sel.length < CT.MIN) return;
    K.busy = true;
    const btn = A().$('#ctGo'); btn.disabled = true; btn.textContent = 'Подписываем…';
    A().api('contract', { uids: K.sel }, true).then(async d => {
      if (!d.ok) { K.busy = false; contractPage(); return A().netToast(d); }
      // a short shuffle of the game's items, then the result
      const pool = Object.values(A().byName).filter(s => s.game === K.game);
      A().modal('Контракт', `<div class="ct-reveal"><div class="ct-spin" id="ctSpin"></div></div>`);
      for (let i = 0; i < 14; i++) {
        const el = document.getElementById('ctSpin'); if (!el) break;
        const s = pool[Math.floor(Math.random() * pool.length)];
        el.innerHTML = `<img src="${s.img}" alt="">`; A().beep(900 + i * 40, 0.02, 'square', 0.02);
        await wait(60 + i * 12);
      }
      K.busy = false; K.sel = [];
      A().closeModal();
      const s = A().byName[d.name];
      A().applyState(d.state);
      A().sfxWin(); A().haptic('success');
      if (d.mult >= 1) brag({ value: s.price, name: d.name, mult: d.mult, title: 'КОНТРАКТ' });
      A().modal(d.mult >= 1 ? 'Контракт в плюс!' : 'Контракт выполнен', `
        <div class="case-win">${A().card(s, { static: true })}</div>
        <p class="note" style="text-align:center">Вклад ${A().coin(d.value)} → <b>${A().coin(s.price)}</b> (x${d.mult.toFixed(2)}). Предмет уже в инвентаре.</p>
        <div class="row"><button class="btn btn-ghost" id="ctAgain" style="flex:1">Ещё контракт</button><a class="btn btn-accent" href="#/upgrade" id="ctUp" style="flex:1">В апгрейд</a></div>`,
      m => { A().$('#ctAgain', m).onclick = A().closeModal; A().$('#ctUp', m).addEventListener('click', A().closeModal); });
      contractPage();
    });
  }

  // =====================================================================================
  // Кейс-баттлы
  // =====================================================================================
  const B = { size: 2, rounds: 1, caseId: null, list: null, shown: {} };
  const seatAva = p => (p.bot ? '<span class="bt-ava bot">🤖</span>' : A().avatarHtml(p.name, p.color || '#e5383b', 'bt-ava', A().avaUrl(p.id)));
  function battlesPage() {
    page(`<div class="page battles-page">
      ${back}
      <div class="mode-head"><h1 class="up-title">Кейс-баттлы</h1><button class="pp-help" data-bt-help aria-label="Правила">?</button></div>
      <button class="btn btn-accent bt-create" id="btCreate">+ Создать баттл</button>
      <div id="btList"><div class="w-glass pf-empty"><span class="muted">Загружаем…</span></div></div>
    </div>`);
    A().$('#btCreate').onclick = () => A().requireLogin(createModal);
    A().$('[data-bt-help]').onclick = () => A().modal('Кейс-баттлы', `<div class="free-help"><b>Кто выбьет дороже — заберёт всё</b><ol>
      <li>Создайте баттл: кейс, число игроков (2–4) и раундов (1–${BT.ROUNDS}).</li>
      <li>Каждый игрок платит цену кейсов и открывает их одновременно с остальными.</li>
      <li>У кого сумма выпавших предметов больше — забирает все предметы всех игроков.</li>
      <li>Не хотите ждать — нажмите «Позвать ботов». Если победит бот, предметы сгорают.</li>
      <li>Если за ${Math.round(BT.OPEN_MS / 60000)} минут никто не пришёл — баттл отменяется, деньги возвращаются.</li></ol>
      <button class="btn btn-accent" id="btOk">Понятно</button></div>`, m => { A().$('#btOk', m).onclick = A().closeModal; });
    loadBattles();
    every(() => { if (!document.hidden) loadBattles(); }, 4000);
  }
  function loadBattles() {
    A().api('battle_list').then(d => {
      const box = A().$('#btList');
      if (!box || !d.ok) return;
      const me = A().S.user && A().tgUser() ? A().tgUser().id : null;
      const row = b => {
        const c = A().caseById(b.case);
        if (!c) return '';
        const mine = b.players.some(p => p.id === me);
        const res = b.result, win = res ? b.players[res.winner] : null;
        return `<a class="bt-row w-glass ${b.status}" href="#/battle/${b.id}">
          <span class="bt-case case-art">${A().caseArt(c)}</span>
          <span class="bt-info"><b>${A().esc(c.name)} · ${b.rounds} ${A().plural(b.rounds, 'раунд', 'раунда', 'раундов')}</b>
            <span class="bt-seats">${Array.from({ length: b.size }, (_, i) => b.players[i] ? seatAva(b.players[i]) : '<span class="bt-ava empty">+</span>').join('')}</span></span>
          <span class="bt-cost">${b.status === 'open' ? `${A().coin(b.cost)}<em>${mine ? 'Ваш' : 'Войти'}</em>`
            : b.status === 'done' ? `<small>${win && win.id === me ? 'Победа' : 'Победил'}</small><b>${A().esc(win ? win.name : '')}</b>` : '<small>Отменён</small>'}</span></a>`;
      };
      box.innerHTML = `<div class="row-head"><h2 class="home-title">Открытые</h2><span class="muted">${d.open.length}</span></div>
        ${d.open.length ? d.open.map(row).join('') : '<div class="w-glass pf-empty"><span class="muted">Пока никого — создайте свой баттл</span></div>'}
        ${d.mine.length ? `<div class="row-head"><h2 class="home-title">Мои баттлы</h2></div>${d.mine.map(row).join('')}` : ''}`;
    });
  }
  function createModal() {
    const { PAID_CASES, caseArt, casePrice, coin, esc } = A();
    if (!B.caseId) B.caseId = PAID_CASES[0].id;
    const render = m => {
      const c = A().caseById(B.caseId), cost = casePrice(c) * B.rounds;
      m.querySelector('.bt-form').innerHTML = `
        <div class="bt-cases">${PAID_CASES.map(x => `<button class="bt-pick${x.id === B.caseId ? ' on' : ''}" data-pick="${x.id}"><span class="case-art">${caseArt(x)}</span><b>${esc(x.name)}</b>${coin(casePrice(x))}</button>`).join('')}</div>
        <div class="bt-opt"><span>Игроков</span><div class="dep-seg">${BT.SIZES.map(n => `<button class="${n === B.size ? 'on' : ''}" data-size="${n}">${n}</button>`).join('')}</div></div>
        <div class="bt-opt"><span>Раундов</span><div class="dep-seg">${Array.from({ length: BT.ROUNDS }, (_, i) => i + 1).map(n => `<button class="${n === B.rounds ? 'on' : ''}" data-rounds="${n}">${n}</button>`).join('')}</div></div>
        <p class="note" style="text-align:center">Вход: <b>${coin(cost)}</b> · банк до ${coin(cost * B.size)}</p>
        <button class="btn btn-accent" id="btGo" style="height:48px" ${A().S.balance >= cost ? '' : 'disabled'}>${A().S.balance >= cost ? `Создать за ${coin(cost)}` : 'Недостаточно средств'}</button>`;
      m.querySelectorAll('[data-pick]').forEach(b => { b.onclick = () => { B.caseId = b.dataset.pick; render(m); }; });
      m.querySelectorAll('[data-size]').forEach(b => { b.onclick = () => { B.size = +b.dataset.size; render(m); }; });
      m.querySelectorAll('[data-rounds]').forEach(b => { b.onclick = () => { B.rounds = +b.dataset.rounds; render(m); }; });
      A().$('#btGo', m).onclick = e => {
        e.currentTarget.disabled = true;
        A().api('battle_create', { case: B.caseId, size: B.size, rounds: B.rounds }).then(d => {
          if (!d.ok) { render(m); return A().netToast(d); }
          A().closeModal();
          location.hash = '#/battle/' + d.battle.id;
        });
      };
    };
    A().modal('Новый баттл', '<div class="bt-form"></div>', render);
  }

  // ---------- the battle room ----------
  let roomId = null;
  function battlePage(id) {
    roomId = +id;
    page(`<div class="page battle-page"><a class="back-link" href="#/battles">${'<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'}<span>Все баттлы</span></a>
      <div id="btRoom"><div class="w-glass pf-empty"><span class="muted">Загружаем…</span></div></div></div>`);
    const pull = () => A().api('battle_get', { id: roomId }).then(d => {
      if (A().curPath() !== '/battle/' + id) return;
      if (!d.ok) { A().$('#btRoom').innerHTML = '<div class="w-glass pf-empty"><b>Баттл не найден</b></div>'; return; }
      showRoom(d.battle);
    });
    pull();
    every(() => { if (!document.hidden && !B.playing) pull(); }, 2000);
  }
  function showRoom(b) {
    const { coin, esc, caseById, caseArt } = A();
    const c = caseById(b.case), me = A().tgUser() ? A().tgUser().id : null;
    const mine = b.players.some(p => p.id === me), owner = b.creator === me;
    // a finished battle is played once on screen (fresh ones), older ones show the result at once
    if (b.status === 'done' && !B.shown[b.id] && Date.now() - b.done_at < 60000) { B.shown[b.id] = true; return playBattle(b); }
    const res = b.result;
    A().$('#btRoom').innerHTML = `
      <div class="bt-head w-glass"><span class="case-art">${caseArt(c)}</span><span><b>${esc(c.name)}</b><small>${b.rounds} ${A().plural(b.rounds, 'раунд', 'раунда', 'раундов')} · вход ${coin(b.cost)} · #${b.id}</small></span>
        <span class="bt-bank"><small>Банк</small>${coin(b.cost * b.size)}</span></div>
      <div class="bt-cols s${b.size}">${Array.from({ length: b.size }, (_, i) => {
        const p = b.players[i];
        if (!p) return `<div class="bt-col empty w-glass"><span class="bt-ava empty">+</span><b>Ждём игрока…</b></div>`;
        const tot = res ? res.totals[i] : null, won = res && res.winner === i;
        return `<div class="bt-col w-glass${won ? ' winner' : ''}${res && !won ? ' lost' : ''}">${seatAva(p)}<b>${esc(p.name)}</b>
          ${res ? `<span class="bt-total">${coin(tot)}</span><div class="bt-drops">${res.rolls[i].map(n => A().card(A().byName[n], { static: true })).join('')}</div>` : '<span class="muted">Готов</span>'}
          ${won ? '<span class="bt-crown">👑 Победитель</span>' : ''}</div>`;
      }).join('')}</div>
      ${b.status === 'open' ? `<div class="bt-actions">${mine
        ? `${owner ? `<button class="btn btn-accent" id="btBots">🤖 Позвать ботов</button><button class="btn btn-ghost" id="btCancel">Отменить и вернуть ${coin(b.cost)}</button>` : '<p class="note">Ждём остальных игроков…</p>'}`
        : `<button class="btn btn-accent" id="btJoin">Войти за ${coin(b.cost)}</button>`}</div>` : ''}
      ${b.status === 'cancel' ? '<p class="note" style="text-align:center">Баттл отменён — вход вернулся на баланс.</p>' : ''}
      ${b.status === 'done' ? '<a class="btn btn-accent" href="#/battles" style="height:48px">К баттлам</a>' : ''}`;
    const act = (sel, action) => { const el = A().$(sel); if (el) el.onclick = () => A().requireLogin(() => {
      el.disabled = true;
      A().api(action, { id: b.id }).then(d => { if (!d.ok) { el.disabled = false; return A().netToast(d); } showRoom(d.battle); });
    }); };
    act('#btJoin', 'battle_join'); act('#btBots', 'battle_bots'); act('#btCancel', 'battle_cancel');
  }
  // rounds one by one: every column spins its reel and stops on its item, totals grow; then the winner
  async function playBattle(b) {
    B.playing = true;
    const { coin, esc, caseById, caseArt, card, byName } = A();
    const c = caseById(b.case), res = b.result, me = A().tgUser() ? A().tgUser().id : null;
    const pool = A().caseItems(c).map(i => i.skin);
    A().$('#btRoom').innerHTML = `
      <div class="bt-head w-glass"><span class="case-art">${caseArt(c)}</span><span><b>${esc(c.name)}</b><small id="btRound">Раунд 1 из ${b.rounds}</small></span>
        <span class="bt-bank"><small>Банк</small>${coin(b.cost * b.size)}</span></div>
      <div class="bt-cols s${b.size}">${b.players.map((p, i) => `<div class="bt-col w-glass" id="btc${i}">${seatAva(p)}<b>${esc(p.name)}</b>
        <span class="bt-total" id="btt${i}">${coin(0)}</span><div class="bt-reel" id="btr${i}"></div><div class="bt-drops" id="btd${i}"></div></div>`).join('')}</div>`;
    const totals = b.players.map(() => 0);
    for (let r = 0; r < b.rounds; r++) {
      if (!A().$('#btRound')) { B.playing = false; return; }
      A().$('#btRound').textContent = `Раунд ${r + 1} из ${b.rounds}`;
      for (let k = 0; k < 12; k++) {
        b.players.forEach((_, i) => { const el = A().$('#btr' + i); if (el) { const s = pool[Math.floor(Math.random() * pool.length)]; el.innerHTML = `<img class="${A().imgCls(s).trim()}" src="${s.img}" alt="">`; } });
        A().beep(1200, 0.012, 'square', 0.015);
        await wait(55 + k * 14);
      }
      b.players.forEach((_, i) => {
        const s = byName[res.rolls[i][r]];
        totals[i] += s.price;
        const reel = A().$('#btr' + i), drops = A().$('#btd' + i), tot = A().$('#btt' + i);
        if (reel) reel.innerHTML = `<img class="hit ${A().imgCls(s).trim()}" src="${s.img}" alt="">`;
        if (drops) drops.insertAdjacentHTML('beforeend', card(s, { static: true }));
        if (tot) tot.innerHTML = coin(totals[i]);
      });
      A().beep(700, 0.08, 'triangle', 0.04);
      await wait(900);
    }
    b.players.forEach((_, i) => { const col = A().$('#btc' + i); if (col) col.classList.add(i === res.winner ? 'winner' : 'lost'); });
    B.playing = false;
    const w = b.players[res.winner], sum = res.totals.reduce((a, t) => a + t, 0);
    A().api('load');
    if (w.id === me) { A().sfxWin(); A().haptic('success'); setTimeout(() => brag({ value: sum, game: 'Кейс-баттл', title: 'КЕЙС-БАТТЛ' }), 1500); }
    A().modal(w.id === me ? 'Вы победили!' : w.bot ? 'Победил бот' : `Победил ${esc(w.name)}`, `
      <div class="bt-result">${seatAva(w)}<b>${esc(w.name)}</b><span>${coin(res.totals[res.winner])}</span></div>
      <p class="note" style="text-align:center">${w.id === me ? `Все предметы на ${coin(sum)} — в вашем инвентаре.` : 'В этот раз не повезло — попробуйте ещё.'}</p>
      <a class="btn btn-accent" href="#/battles" id="btNext" style="height:48px">К баттлам</a>`, m => { A().$('#btNext', m).addEventListener('click', A().closeModal); });
    showRoom(b);
  }

  // =====================================================================================
  // «Минёр»
  // =====================================================================================
  const MN = R.MINES;
  const comb = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
  const minesMult = (m, k) => (k ? Math.floor(MN.RTP * (comb(MN.CELLS, k) / comb(MN.CELLS - m, k)) * 100) / 100 : 1);
  const MI = { bet: 50, m: 3, busy: false, end: null };
  const GEM = '<svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9z" fill="#5ee3a0" stroke="#1d7a4c" stroke-width="1.5"/><path d="M2 9h20M8 3l4 6 4-6M12 9v12" stroke="#1d7a4c" stroke-width="1.2" fill="none"/></svg>';
  const BOMB = '<svg viewBox="0 0 24 24"><circle cx="11" cy="13" r="8" fill="#2b2d36" stroke="#000" stroke-width="1.5"/><path d="M15 6l3-3M17 3l2 2" stroke="#ffb340" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="10" r="2" fill="#fff" opacity=".5"/></svg>';
  function minesPage() {
    const { coin } = A(), g = A().S.mines;
    const open = g ? g.open : [], m = g ? g.m : MI.m, k = open.length;
    const end = MI.end;   // the last finished round, to show where the mines were
    page(`<div class="page mines-page">
      ${back}
      <div class="mode-head"><h1 class="up-title">Минёр</h1><button class="pp-help" data-mn-help aria-label="Правила">?</button></div>
      <div class="mn-info w-glass">
        <div><span>${g ? 'Сейчас' : 'Мин'}</span><b>${g ? x2(minesMult(m, k)) : m}</b></div>
        <div><span>Следующая</span><b>${x2(minesMult(m, k + 1))}</b></div>
        <div><span>${g ? 'Выигрыш' : 'Ставка'}</span><b>${coin(g ? g.bet * minesMult(m, k) : MI.bet)}</b></div>
      </div>
      <div class="mn-grid${g ? ' live' : ''}" id="mnGrid">${Array.from({ length: MN.CELLS }, (_, i) => {
        const isOpen = open.includes(i), wasMine = end && end.mines.includes(i), wasOpen = end && end.open.includes(i);
        const cls = isOpen || wasOpen ? 'gem' : wasMine ? (end.boom === i ? 'bomb hit' : 'bomb') : '';
        return `<button class="mn-cell ${cls}" data-mn="${i}" ${g && !isOpen ? '' : 'disabled'}>${isOpen || wasOpen ? GEM : wasMine ? BOMB : ''}</button>`;
      }).join('')}</div>
      ${g ? `<button class="cr-btn cash" id="mnCash" ${k ? '' : 'disabled'}><b>${k ? `Забрать ${coin(g.bet * minesMult(m, k))}` : 'Откройте клетку'}</b><small>${k ? x2(minesMult(m, k)) : `ставка ${coin(g.bet)}`}</small></button>`
        : `<button class="cr-btn" id="mnStart"><b>Играть</b><small>${coin(MI.bet)} · ${MI.m} ${A().plural(MI.m, 'мина', 'мины', 'мин')}</small></button>
      <div class="cr-bet w-glass">
        <div class="cr-row"><span>Ставка, ${A().curSym()}</span><span>Мин</span></div>
        <div class="cr-row">
          <div class="cr-amount"><button data-mbet="half">½</button><input id="mnBet" inputmode="decimal" value="${fmtIn(MI.bet)}"><button data-mbet="x2">×2</button></div>
          <div class="cr-amount"><button data-mm="-1">−</button><input id="mnM" inputmode="numeric" value="${MI.m}"><button data-mm="1">+</button></div>
        </div>
        <div class="cr-quick">${[1, 3, 5, 10, 24].map(n => `<button data-mset="${n}" class="${n === MI.m ? 'on' : ''}">${n} ${A().plural(n, 'мина', 'мины', 'мин')}</button>`).join('')}</div>
      </div>`}
    </div>`);
    A().$('[data-mn-help]').onclick = () => A().modal('Минёр', `<div class="free-help"><b>Открывайте клетки и не попадите на мину</b><ol>
      <li>Выберите ставку и сколько мин спрятать на поле 5×5 — от ${MN.MIN} до ${MN.MAX}.</li>
      <li>Каждая открытая безопасная клетка увеличивает множитель. Больше мин — быстрее растёт.</li>
      <li>Нажмите «Забрать» в любой момент. Попали на мину — ставка сгорает.</li>
      <li>Где мины, решает сервер в начале раунда — и не меняет.</li></ol><button class="btn btn-accent" id="mnOk">Понятно</button></div>`, mm => { A().$('#mnOk', mm).onclick = A().closeModal; });
    if (g) {
      A().$('#mnCash').onclick = minesCash;
      document.querySelectorAll('[data-mn]').forEach(b => { b.onclick = () => minesOpen(+b.dataset.mn); });
      return;
    }
    const bet = A().$('#mnBet'), mi = A().$('#mnM');
    bet.addEventListener('change', () => { MI.bet = Math.max(MN.MIN_BET, toCoins(numIn(bet))); minesPage(); });
    mi.addEventListener('change', () => { MI.m = Math.max(MN.MIN, Math.min(MN.MAX, Math.round(numIn(mi)) || 3)); minesPage(); });
    document.querySelectorAll('[data-mbet]').forEach(b => { b.onclick = () => { MI.bet = b.dataset.mbet === 'half' ? Math.max(MN.MIN_BET, MI.bet / 2) : Math.min(MN.MAX_BET, MI.bet * 2); minesPage(); }; });
    document.querySelectorAll('[data-mm]').forEach(b => { b.onclick = () => { MI.m = Math.max(MN.MIN, Math.min(MN.MAX, MI.m + +b.dataset.mm)); minesPage(); }; });
    document.querySelectorAll('[data-mset]').forEach(b => { b.onclick = () => { MI.m = +b.dataset.mset; minesPage(); }; });
    A().$('#mnStart').onclick = () => A().requireLogin(() => {
      if (MI.busy) return;
      const b = Math.round(MI.bet * 100) / 100;
      if (b > A().S.balance) return A().toast('Недостаточно средств', 'error');
      MI.busy = true;
      A().api('mines_start', { bet: b, mines: MI.m }).then(d => {
        MI.busy = false;
        if (!d.ok) return A().netToast(d);
        MI.end = null; A().haptic('medium'); minesPage();
      });
    });
  }
  function minesOpen(cell) {
    if (MI.busy) return;
    MI.busy = true;
    const el = document.querySelector(`[data-mn="${cell}"]`); if (el) el.classList.add('wait');
    A().api('mines_open', { cell }).then(d => {
      MI.busy = false;
      if (!d.ok) { if (el) el.classList.remove('wait'); return A().netToast(d); }
      if (d.boom) {
        MI.end = { mines: d.mines, open: d.open, boom: cell };
        A().beep(110, 0.35, 'sawtooth', 0.05); A().haptic('error');
        A().toast('Мина! Ставка сгорела', 'error');
      } else if (d.all) {
        MI.end = { mines: d.mines, open: d.open };
        A().sfxWin(); A().toast(`Все клетки открыты: +${A().money(d.amount)}`, 'success');
        brag({ value: d.amount, mult: d.mult, game: 'Минёр', title: 'МИНЁР' });
      } else { A().beep(900 + d.open.length * 40, 0.05, 'triangle', 0.04); A().haptic('light'); }
      minesPage();
    });
  }
  function minesCash() {
    if (MI.busy) return;
    MI.busy = true;
    A().api('mines_cash').then(d => {
      MI.busy = false;
      if (!d.ok) return A().netToast(d);
      MI.end = { mines: d.mines, open: d.open };
      A().sfxWin(); A().haptic('success');
      A().toast(`Забрали ${x2(d.mult)}: +${A().money(d.amount)}`, 'success');
      brag({ value: d.amount, mult: d.mult, game: 'Минёр', title: 'МИНЁР' });
      minesPage();
    });
  }

  // =====================================================================================
  // «Колесо»: shared spins, bets on colours
  // =====================================================================================
  const WH = R.WHEEL, SEGS = WH.LAYOUT.length, SEG_DEG = 360 / SEGS;
  const WCOL = { g: '#4a5161', r: '#e5383b', b: '#3b82f6', y: '#ffc23a' };
  const W = { bet: 50, st: null, off: 0, round: 0, angle: 0, spun: 0, busy: false };
  function wheelSvg() {
    const seg = i => {
      const a0 = (i * SEG_DEG - 90) * Math.PI / 180, a1 = ((i + 1) * SEG_DEG - 90) * Math.PI / 180;
      const p = (a, r) => `${(100 + r * Math.cos(a)).toFixed(2)} ${(100 + r * Math.sin(a)).toFixed(2)}`;
      return `<path d="M${p(a0, 96)} A96 96 0 0 1 ${p(a1, 96)} L${p(a1, 70)} A70 70 0 0 0 ${p(a0, 70)}Z" fill="${WCOL[WH.LAYOUT[i]]}" stroke="#0b0c10" stroke-width=".8"/>`;
    };
    return `<svg viewBox="0 0 200 200" class="wh-svg"><g id="whRot">${Array.from({ length: SEGS }, (_, i) => seg(i)).join('')}<circle cx="100" cy="100" r="70" fill="#14151c"/></g>
      <circle cx="100" cy="100" r="97" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/></svg>`;
  }
  function wheelPage() {
    const { coin } = A();
    page(`<div class="page wheel-page">
      ${back}
      <div class="cr-top"><div class="cr-hist" id="whHist"></div><button class="cr-ico" data-wh-help aria-label="Правила">?</button></div>
      <div class="wh-stage w-glass">
        <div class="wh-pointer"></div>
        <div class="wh-wrap">${wheelSvg()}<div class="wh-center"><b id="whBig">…</b><small id="whSub">Подключаемся…</small></div></div>
      </div>
      <div class="cr-bet w-glass">
        <div class="cr-row"><span>Ставка, ${A().curSym()}</span><span></span></div>
        <div class="cr-amount"><button data-wbet="half">½</button><input id="whBet" inputmode="decimal" value="${fmtIn(W.bet)}"><button data-wbet="x2">×2</button></div>
      </div>
      <div class="wh-colors">${Object.entries(WH.COLORS).map(([c, v]) => `<button class="wh-col c-${c}" data-wc="${c}"><b>${v.x}×</b><span>${v.name}</span><small id="whT-${c}">${coin(0)}</small><em id="whM-${c}"></em></button>`).join('')}</div>
      <div class="cr-players"><div class="cr-ph">Игроков <b id="whPlayers">0</b></div><div id="whList"><div class="cr-empty">Ставок пока нет — будьте первым!</div></div></div>
    </div>`);
    const bet = A().$('#whBet');
    bet.addEventListener('input', () => { W.bet = toCoins(numIn(bet)); });
    document.querySelectorAll('[data-wbet]').forEach(b => { b.onclick = () => { W.bet = b.dataset.wbet === 'half' ? Math.max(WH.MIN_BET, W.bet / 2) : Math.min(WH.MAX_BET, W.bet * 2); bet.value = fmtIn(W.bet); }; });
    document.querySelectorAll('[data-wc]').forEach(b => { b.onclick = () => wheelBet(b.dataset.wc); });
    A().$('[data-wh-help]').onclick = () => A().modal('Колесо', `<div class="free-help"><b>Угадайте цвет</b><ol>
      <li>Колесо крутится само каждые ${(WH.BET_MS + WH.SPIN_MS) / 1000} секунд — ${WH.BET_MS / 1000} секунд на ставки.</li>
      <li>Ставьте на один или несколько цветов: серый ×2, красный ×3, синий ×5, золото ×50.</li>
      <li>Чем выше множитель, тем меньше таких секторов на колесе.</li>
      <li>Где остановится колесо, сервер решает до ставок и не меняет.</li></ol><button class="btn btn-accent" id="whOk">Понятно</button></div>`, mm => { A().$('#whOk', mm).onclick = A().closeModal; });
    W.spun = 0;
    wheelPoll();
    every(() => { if (!document.hidden) wheelPoll(); }, 700);
    cancelAnimationFrame(raf);
    const frame = () => { if (A().curPath() !== '/wheel') return; wheelTick(); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
  }
  const wNow = () => Date.now() + W.off;
  function wheelPoll() {
    const t0 = Date.now();
    A().api('wheel_state').then(d => {
      if (!d.ok || A().curPath() !== '/wheel') return;
      W.off = d.now - (t0 + Date.now()) / 2;
      W.st = d;
      if (d.settled && d.settled.win) { A().sfxWin(); A().haptic('success'); A().toast(`Колесо: ${WH.COLORS[d.settled.color].name} — +${A().money(d.settled.amount)}`, 'success'); brag({ value: d.settled.amount, mult: WH.COLORS[d.settled.color].x, game: 'Колесо', title: 'КОЛЕСО' }); }
      const { coin, esc, avatarHtml, avaUrl } = A();
      const hist = A().$('#whHist'); if (hist) hist.innerHTML = d.history.map(c => `<span class="wh-dot c-${c}">${WH.COLORS[c].x}×</span>`).join('');
      Object.keys(WH.COLORS).forEach(c => {
        const t = A().$('#whT-' + c), m = A().$('#whM-' + c);
        if (t) t.innerHTML = coin(d.totals[c] || 0);
        if (m) m.innerHTML = d.me && d.me[c] ? `Ваша: ${coin(d.me[c])}` : '';
      });
      const pl = A().$('#whPlayers'), list = A().$('#whList');
      if (pl) pl.textContent = d.players;
      if (list) list.innerHTML = d.bets.length ? d.bets.map(b => `<div class="cr-pl${b.win ? ' win' : b.win === 0 ? ' lost' : ''}">
        ${avatarHtml(b.nick, b.ucolor || '#e5383b', 'cr-ava', avaUrl(b.id))}<span class="cr-who"><b>${esc(b.nick)}</b>${coin(b.bet)}</span>
        <span class="wh-dot c-${b.color}">${WH.COLORS[b.color].x}×</span><span class="cr-win">${b.win ? coin(b.win) : ''}</span></div>`).join('')
        : '<div class="cr-empty">Ставок пока нет — будьте первым!</div>';
    });
  }
  // the wheel turns to the drawn segment in the spin time; the pointer is at the top
  function wheelTick() {
    const d = W.st, rot = A().$('#whRot');
    if (!d || !rot) return;
    const r = d.round, t = wNow(), big = A().$('#whBig'), sub = A().$('#whSub');
    if (r.id !== W.round) { W.round = r.id; W.spun = 0; }
    if (t < r.spin_at) {
      big.textContent = Math.ceil((r.spin_at - t) / 1000) + '';
      sub.textContent = 'Приём ставок';
      document.querySelectorAll('[data-wc]').forEach(b => { b.disabled = false; });
      rot.style.transform = `rotate(${W.angle}deg)`;
    } else if (r.seg != null) {
      document.querySelectorAll('[data-wc]').forEach(b => { b.disabled = true; });
      const target = Math.ceil(W.angle / 360) * 360 + 360 * 5 - (r.seg + 0.5) * SEG_DEG;
      if (W.spun !== r.id) { W.spun = r.id; W.from = W.angle; W.to = target; }
      const dur = WH.SPIN_MS - 1500, p = Math.min(1, (t - r.spin_at) / dur), e = 1 - Math.pow(1 - p, 4);
      const a = W.from + (W.to - W.from) * e;
      rot.style.transform = `rotate(${a}deg)`;
      if (p >= 1) {
        W.angle = W.to % 360;
        const c = WH.LAYOUT[r.seg];
        big.textContent = WH.COLORS[c].x + '×'; big.style.color = WCOL[c] === '#4a5161' ? '#c9ced8' : WCOL[c];
        sub.textContent = WH.COLORS[c].name;
      } else { big.textContent = '…'; big.style.color = ''; sub.textContent = 'Крутится'; }
    }
  }
  function wheelBet(color) {
    if (W.busy) return;
    A().requireLogin(() => {
      const bet = Math.round(W.bet * 100) / 100;
      if (!(bet >= WH.MIN_BET)) return A().toast(`Минимальная ставка ${A().money(WH.MIN_BET)}`, 'error');
      if (bet > A().S.balance) return A().toast('Недостаточно средств', 'error');
      W.busy = true;
      A().api('wheel_bet', { color, bet }).then(d => {
        W.busy = false;
        if (!d.ok) return A().toast(d.error === 'late' ? 'Ставки на этот спин закрыты — дождитесь следующего' : A().gameErr(d), 'error');
        A().haptic('medium');
        wheelPoll();
      });
    });
  }

  // =====================================================================================
  // «Плинко»
  // =====================================================================================
  const PL = R.PLINKO;
  const P = { bet: 50, risk: 'mid', balls: 0 };
  const bucketColor = m => (m >= 10 ? '#e5383b' : m >= 3 ? '#ff7a3d' : m >= 1.5 ? '#ffb340' : m >= 1 ? '#ffd166' : '#5aa9ff');
  function plinkoPage() {
    const { coin } = A();
    const rows = PL.ROWS, mults = PL.RISK[P.risk];
    page(`<div class="page plinko-page">
      ${back}
      <div class="mode-head"><h1 class="up-title">Плинко</h1><button class="pp-help" data-pl-help aria-label="Правила">?</button></div>
      <div class="pl-board w-glass" id="plBoard">
        ${Array.from({ length: rows }, (_, r) => Array.from({ length: r + 3 }, (_, i) => `<i class="pl-peg" style="left:${50 + (i - (r + 2) / 2) * (100 / (rows + 2))}%;top:${6 + r * (80 / rows)}%"></i>`).join('')).join('')}
        <div class="pl-buckets">${mults.map((m, i) => `<span class="pl-b" id="plb${i}" style="--bc:${bucketColor(m)}">${m}×</span>`).join('')}</div>
      </div>
      <button class="cr-btn" id="plGo"><b>Бросить шарик</b><small>${coin(P.bet)}</small></button>
      <div class="cr-bet w-glass">
        <div class="cr-row"><span>Ставка, ${A().curSym()}</span><span>Риск</span></div>
        <div class="cr-row">
          <div class="cr-amount"><button data-pbet="half">½</button><input id="plBet" inputmode="decimal" value="${fmtIn(P.bet)}"><button data-pbet="x2">×2</button></div>
          <div class="dep-seg pl-risk">${[['low', 'Низкий'], ['mid', 'Средний'], ['high', 'Высокий']].map(([k, l]) => `<button class="${P.risk === k ? 'on' : ''}" data-risk="${k}">${l}</button>`).join('')}</div>
        </div>
      </div>
    </div>`);
    const bet = A().$('#plBet');
    bet.addEventListener('input', () => { P.bet = toCoins(numIn(bet)); A().$('#plGo small').innerHTML = coin(P.bet); });
    document.querySelectorAll('[data-pbet]').forEach(b => { b.onclick = () => { P.bet = b.dataset.pbet === 'half' ? Math.max(PL.MIN_BET, P.bet / 2) : Math.min(PL.MAX_BET, P.bet * 2); bet.value = fmtIn(P.bet); A().$('#plGo small').innerHTML = coin(P.bet); }; });
    document.querySelectorAll('[data-risk]').forEach(b => { b.onclick = () => { if (P.balls) return A().toast('Дождитесь, пока шарики упадут', 'error'); P.risk = b.dataset.risk; plinkoPage(); }; });
    A().$('#plGo').onclick = plinkoDrop;
    A().$('[data-pl-help]').onclick = () => A().modal('Плинко', `<div class="free-help"><b>Шарик падает — множитель решает удача</b><ol>
      <li>Шарик проходит ${rows} рядов штырьков, на каждом уходит влево или вправо.</li>
      <li>Внизу ячейки с множителями: по краям — крупные, в центре — мелкие.</li>
      <li>Риск меняет множители: на высоком края до ${PL.RISK.high[0]}×, но центр — ${PL.RISK.high[6]}×.</li>
      <li>Можно бросать несколько шариков подряд.</li></ol><button class="btn btn-accent" id="plOk">Понятно</button></div>`, mm => { A().$('#plOk', mm).onclick = A().closeModal; });
  }
  function plinkoDrop() {
    A().requireLogin(() => {
      const bet = Math.round(P.bet * 100) / 100;
      if (!(bet >= PL.MIN_BET)) return A().toast(`Минимальная ставка ${A().money(PL.MIN_BET)}`, 'error');
      if (bet > A().S.balance) return A().toast('Недостаточно средств', 'error');
      P.balls++;
      A().api('plinko', { bet, risk: P.risk }, true).then(async d => {
        if (!d.ok) { P.balls--; return A().netToast(d); }
        // the bet leaves the header at once; the payout comes when the ball lands
        const S = A().S; S.balance = Math.round((S.balance - bet) * 100) / 100; A().renderHeader();
        await dropBall(d.path);
        P.balls--;
        A().applyState(d.state);
        const b = A().$('#plb' + d.bucket);
        if (b) { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }
        if (d.mult >= 1) A().beep(700 + Math.min(d.mult, 30) * 30, 0.08, 'triangle', 0.04); else A().beep(260, 0.06, 'sine', 0.03);
        if (d.mult >= 3) { A().sfxWin(); A().toast(`Плинко ${d.mult}×: +${A().money(d.amount)}`, 'success'); brag({ value: d.amount, bet: d.bet, mult: d.mult, game: 'Плинко', title: 'ПЛИНКО' }); }
      });
    });
  }
  // the ball goes down the pegs: one row at a time, left or right by the server's path
  async function dropBall(path) {
    const board = A().$('#plBoard');
    if (!board) return;
    const ball = document.createElement('i');
    ball.className = 'pl-ball';
    board.appendChild(ball);
    const rows = PL.ROWS, step = 100 / (rows + 2);
    let x = 50;
    ball.style.left = x + '%'; ball.style.top = '0%';
    await wait(30);
    for (let r = 0; r < rows; r++) {
      x += (path[r] ? 0.5 : -0.5) * step;
      ball.style.left = x + '%'; ball.style.top = (6 + r * (80 / rows) + 80 / rows / 2) + '%';
      if (document.hidden || !ball.isConnected) break;
      A().beep(1600 + r * 30, 0.008, 'square', 0.01);
      await wait(110);
    }
    ball.style.top = '92%';
    await wait(140);
    ball.remove();
  }

  window.RUSTUP_MODES = {
    tiles,
    // called by the router with the new path: polls always stop; the rocket keeps flying only while its page is open
    leave: path => {
      timers.forEach(clearInterval); timers.clear();
      if (path !== '/crash' && path !== '/wheel') { cancelAnimationFrame(raf); raf = 0; if (C.phase !== 'idle') { C.phase = 'idle'; C.busy = false; } C.queued = false; C.st = null; }
    },
    '/crash': crashPage, '/contract': contractPage, '/battles': battlesPage, battle: battlePage,
    '/mines': minesPage, '/wheel': wheelPage, '/plinko': plinkoPage
  };
  // contract slots: add from the inventory, remove from a slot; game switch
  document.addEventListener('click', e => {
    const t = e.target;
    const add = t.closest('[data-ct-add]'), del = t.closest('[data-ct-del]'), g = t.closest('[data-ct-game]');
    if (!add && !del && !g) return;
    if (K.busy) return;
    if (g) { K.game = g.dataset.ctGame; K.sel = []; }
    else if (del) K.sel = K.sel.filter(u => u !== del.dataset.ctDel);
    else {
      const u = add.dataset.ctAdd;
      if (K.sel.includes(u)) K.sel = K.sel.filter(x => x !== u);
      else if (K.sel.length >= CT.MAX) return A().toast(`Не больше ${CT.MAX} предметов`, 'error');
      else K.sel.push(u);
    }
    A().haptic('light');
    contractPage();
  });
})();
