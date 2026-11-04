/* RUST UP game modes: «Ракетка» (crash), «Контракты», «Кейс-баттлы». Everything is played on the game server
   (bot/modes.js); these pages only show it. Uses the app's helpers through window.RUSTUP_APP (js/app.js), loaded after this file. */
(() => {
  'use strict';
  const R = window.RUSTUP_RULES, CR = R.CRASH, CT = R.CONTRACT, BT = R.BATTLE;
  const A = () => window.RUSTUP_APP;
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
      { href: '#/crash', cls: 'gc-crash', title: 'Ракетка', share: 0.08, badge: 'NEW', cover: 'crash', art: ROCKET },
      { href: '#/contract', cls: 'gc-contract', title: 'Контракты', share: 0.05, cover: 'contract', art: skins.map((s, i) => `<img class="gc-mini m${i}" src="${s.img}" alt="" draggable="false">`).join('') },
      { href: '#/battles', cls: 'gc-battle', title: 'Кейс-баттл', share: 0.06, badge: 'PvP', cover: 'battle', art: `${cases.map((c, i) => { const s = A().caseItems(c)[0].skin; return `<img class="gc-bt b${i}${A().imgCls(s)}" src="${s.img}" alt="" draggable="false">`; }).join('')}<b class="gc-vs">VS</b>` }
    ];
  }

  // =====================================================================================
  // «Ракетка»
  // =====================================================================================
  const CRASH_BETS = [10, 50, 100, 500, 1000];   // quick bets in coins
  const C = { bet: 50, auto: '', phase: 'idle', t0: 0, mult: 1, point: 0, cashed: null, busy: false, peekAt: 0 };
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
    const { S, coin } = A();
    const hist = (S.crashLast || []).map(h => `<span class="cr-chip ${h.point >= 5 ? 'hi' : h.point >= 2 ? 'mid' : ''}">${x2(h.point)}</span>`).join('');
    page(`<div class="page crash-page">
      ${back}
      <div class="cr-top"><div class="cr-hist">${hist}</div><button class="cr-ico" data-crash-help aria-label="Правила">?</button></div>
      <div class="cr-stage" id="crashStage">
        <div class="cr-stars"></div><div class="cr-stars s2"></div>
        <div class="cr-mult" id="crashMult">1,00×</div>
        <div class="cr-sub" id="crashStatus">Сделайте ставку — ракета взлетит</div>
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
        <div id="crList"><div class="cr-empty">Здесь появятся ставки игроков</div></div>
      </div>
    </div>`);
    const bet = A().$('#crashBet'), auto = A().$('#crashAuto');
    bet.addEventListener('input', () => { C.bet = toCoins(numIn(bet)); paintBtn(); });
    auto.addEventListener('input', () => { C.auto = auto.value.replace(',', '.'); });
    A().$('#crashBtn').onclick = crashClick;
    document.querySelectorAll('[data-bet],[data-bet-set]').forEach(b => { b.onclick = () => {
      const S = A().S;
      if (b.dataset.betSet) C.bet = +b.dataset.betSet;
      else if (b.dataset.bet === 'half') C.bet = Math.max(CR.MIN_BET, C.bet / 2);
      else if (b.dataset.bet === 'x2') C.bet = Math.min(CR.MAX_BET, C.bet * 2);
      else C.bet = Math.min(CR.MAX_BET, Math.floor(S.balance * 100) / 100);
      bet.value = fmtIn(C.bet); paintBtn();
    }; });
    A().$('[data-crash-help]').onclick = crashHelp;
    // a round that is still flying (the app was reopened): ask the server how far it got
    if (A().S.crash && C.phase !== 'fly') {
      C.phase = 'sync';
      A().api('crash_peek').then(d => {
        if (d.ok && d.crashed === false) startFlight(d.elapsed, A().S.crash.bet);
        else { C.phase = 'idle'; if (d.ok && d.point) endFlight(d.point, d.win ? d.mult : null, d.amount); }
      });
    } else if (C.phase === 'fly') { const st = A().$('#crashStage'); if (st) st.classList.add('flying'); }
    paintBtn(); draw();
    loadCrashFeed();
    every(() => { if (!document.hidden) loadCrashFeed(); }, 3000);
  }
  // the bets of all players: the last finished rounds
  function loadCrashFeed() {
    A().api('crash_feed').then(d => {
      const list = A().$('#crList');
      if (!list || !d.ok) return;
      const { coin, esc, avatarHtml, avaUrl } = A();
      A().$('#crPlayers').textContent = d.players;
      A().$('#crBank').innerHTML = coin(d.bank);
      list.innerHTML = d.rounds.length ? d.rounds.map(r => `<div class="cr-pl${r.mult ? ' win' : ''}">
        ${avatarHtml(r.nick, r.color || '#e5383b', 'cr-ava', avaUrl(r.user_id))}
        <span class="cr-who"><b>${esc(r.nick)}</b>${coin(r.bet)}</span>
        <span class="cr-x">${r.mult ? x2(r.mult) : `💥 ${x2(r.point)}`}</span>
        <span class="cr-win">${r.mult ? coin(r.amount) : '—'}</span></div>`).join('')
        : '<div class="cr-empty">Пока никто не играл — будьте первым!</div>';
    });
  }
  function crashHelp() {
    A().modal('Ракетка', `<div class="free-help"><b>Забери выигрыш до взрыва</b><ol>
      <li>Сделайте ставку — ракета взлетает, множитель растёт: 1,00×, 1,50×, 2,00×…</li>
      <li>Нажмите «Забрать» в любой момент — ставка умножится на текущий множитель.</li>
      <li>Ракета взрывается в случайный момент. Не успели — ставка сгорает.</li>
      <li>Автовывод забирает сам на выбранном множителе — даже если закрыть игру.</li>
      <li>Точка взрыва выбирается сервером до взлёта и не меняется.</li></ol>
      <button class="btn btn-accent" id="chOk">Понятно</button></div>`, m => { A().$('#chOk', m).onclick = A().closeModal; });
  }
  function paintBtn() {
    const b = A().$('#crashBtn');
    if (!b) return;
    const { coin } = A();
    b.classList.toggle('cash', C.phase === 'fly' && !C.cashed);
    if (C.phase === 'fly' && !C.cashed) { b.disabled = C.busy; b.innerHTML = `<b>Забрать ${coin(C.bet * C.mult)}</b><small>${x2(C.mult)}</small>`; }
    else if (C.phase === 'fly' || C.phase === 'sync' || C.busy) { b.disabled = true; b.innerHTML = C.cashed ? `<b>Забрано ${x2(C.cashed)}</b><small>ракета летит дальше…</small>` : '<b>Ракета летит…</b>'; }
    else { b.disabled = false; b.innerHTML = `<b>Сделать ставку</b><small>${coin(C.bet)}${Number(C.auto) >= 1.01 ? ` · автовывод ${x2(Number(C.auto))}` : ''}</small>`; }
    // the player's own bet rides next to the rocket
    const me = A().$('#crashMe');
    if (me) me.innerHTML = C.phase === 'fly' ? `${A().avatarHtml(A().S.user ? A().S.user.name : '', (A().S.user && A().S.user.color) || '#e5383b', 'cr-ava', A().S.user && A().avaUrl(A().S.user.id))}<span>${coin(C.cashed ? C.amount : C.bet)}</span>` : '';
    if (me) me.classList.toggle('won', !!C.cashed);
  }
  function crashClick() {
    if (C.phase === 'fly' && !C.cashed) return cashOut();
    if (C.phase !== 'idle' || C.busy) return;
    A().requireLogin(() => {
      const bet = Math.round(C.bet * 100) / 100, auto = Number(C.auto) || 0;
      if (!(bet >= CR.MIN_BET)) return A().toast(`Минимальная ставка ${A().money(CR.MIN_BET)}`, 'error');
      if (bet > A().S.balance) return A().toast('Недостаточно средств', 'error');
      if (C.auto && auto < 1.01) return A().toast('Автовывод — от 1,01×', 'error');
      C.busy = true; paintBtn();
      A().api('crash_start', { bet, auto: auto || undefined }).then(d => {
        C.busy = false;
        if (!d.ok) { paintBtn(); return A().netToast(d); }
        A().haptic('medium');
        startFlight(0, bet, auto || null);
      });
    });
  }
  function startFlight(elapsed, bet, auto) {
    C.phase = 'fly'; C.bet = bet; C.cashed = null; C.point = 0; C.autoX = auto || (A().S.crash && A().S.crash.auto) || null;
    C.t0 = performance.now() - (elapsed || 0); C.peekAt = 0;
    const st = A().$('#crashStage'); if (st) { st.classList.remove('boom', 'won'); st.classList.add('flying'); }
    status('Забирайте до взрыва!');
    let lastBeep = 1;
    cancelAnimationFrame(raf);
    const frame = () => {
      if (C.phase !== 'fly') return;
      const ms = performance.now() - C.t0;
      C.mult = multAt(ms);
      // after a cash-out we know the point: fly up to it and explode there
      if (C.point && C.mult >= C.point) { C.mult = C.point; return endFlight(C.point, C.cashed, C.amount); }
      if (C.mult - lastBeep >= 0.1) { lastBeep = C.mult; A().beep(300 + C.mult * 60, 0.02, 'sine', 0.015); }
      if (C.autoX && !C.cashed && !C.busy && C.mult >= C.autoX) cashOut();
      // the server says when it crashed
      if (!C.point && !C.busy && ms - C.peekAt > 700) { C.peekAt = ms; peek(); }
      draw(ms); paintBtn();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    paintBtn();
  }
  function peek() {
    A().api('crash_peek').then(d => {
      if (C.phase !== 'fly' || C.point || !d.ok || d.crashed === false) return;
      // crashed (an auto cash-out may have paid on the server)
      if (d.none) return endFlight(C.mult, C.cashed, C.amount);
      C.point = d.point;
      if (d.win && !C.cashed) { C.cashed = d.mult; C.amount = d.amount; }
      if (C.mult >= C.point) endFlight(C.point, C.cashed, C.amount);
    });
  }
  function cashOut() {
    if (C.busy || C.cashed) return;
    C.busy = true; paintBtn();
    A().api('crash_cash').then(d => {
      C.busy = false;
      if (!d.ok) { if (d.error === 'noround') return; return A().netToast(d); }
      C.point = d.point;
      if (d.win) {
        C.cashed = d.mult; C.amount = d.amount;
        A().sfxWin(); A().haptic('success');
        A().toast(`Забрали на ${x2(d.mult)}: +${A().money(d.amount)}`, 'success');
        const st = A().$('#crashStage'); if (st) st.classList.add('won');
        status(`Вы забрали ${x2(d.mult)} — ракета летит дальше`);
      }
      // a late press: it had already exploded
      if (!d.win || C.mult >= C.point) endFlight(C.point, C.cashed, C.amount);
      paintBtn();
    });
  }
  function endFlight(point, cashed, amount) {
    cancelAnimationFrame(raf);
    C.phase = 'idle'; C.mult = point; C.point = 0;
    const st = A().$('#crashStage');
    if (st) { st.classList.remove('flying'); st.classList.add('boom'); }
    A().beep(110, 0.35, 'sawtooth', 0.05);
    const m = A().$('#crashMult'); if (m) m.textContent = x2(point);
    status(cashed ? `Улетела на ${x2(point)} · вы забрали ${x2(cashed)} (+${A().money(amount)})` : `Улетела на ${x2(point)}${C.bet ? ' · ставка сгорела' : ''}`);
    A().renderHeader();
    loadCrashFeed();
    setTimeout(() => { if (A().curPath() === '/crash' && C.phase === 'idle') crashPage(); }, 2200);
    C.cashed = null;
    paintBtn();
  }
  const status = t => { const el = A().$('#crashStatus'); if (el) el.textContent = t; };
  // the rocket climbs from the lower left to the middle in the first seconds, then the sky moves past it
  function draw(ms = 0) {
    const ship = A().$('#crashRocket'), mult = A().$('#crashMult');
    if (!ship) return;
    const p = C.phase === 'fly' ? Math.min(1, ms / 2600) : 0, e = 1 - Math.pow(1 - p, 3);
    ship.style.left = (26 + 24 * e) + '%';
    ship.style.top = (76 - 26 * e) + '%';
    if (C.phase === 'fly') { mult.textContent = x2(C.mult || 1); mult.classList.toggle('hot', C.mult >= 2); }
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
    if (w.id === me) { A().sfxWin(); A().haptic('success'); }
    A().modal(w.id === me ? 'Вы победили!' : w.bot ? 'Победил бот' : `Победил ${esc(w.name)}`, `
      <div class="bt-result">${seatAva(w)}<b>${esc(w.name)}</b><span>${coin(res.totals[res.winner])}</span></div>
      <p class="note" style="text-align:center">${w.id === me ? `Все предметы на ${coin(sum)} — в вашем инвентаре.` : 'В этот раз не повезло — попробуйте ещё.'}</p>
      <a class="btn btn-accent" href="#/battles" id="btNext" style="height:48px">К баттлам</a>`, m => { A().$('#btNext', m).addEventListener('click', A().closeModal); });
    showRoom(b);
  }

  window.RUSTUP_MODES = {
    tiles,
    // called by the router with the new path: polls always stop; the rocket keeps flying only while its page is open
    leave: path => {
      timers.forEach(clearInterval); timers.clear();
      if (path !== '/crash') { cancelAnimationFrame(raf); raf = 0; if (C.phase !== 'idle') { C.phase = 'idle'; C.busy = false; } }
    },
    '/crash': crashPage, '/contract': contractPage, '/battles': battlesPage, battle: battlePage
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
