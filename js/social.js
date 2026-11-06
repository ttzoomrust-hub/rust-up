/* RUST UP social pack (2026-11-06): the player's stats (#/stats), the showcase and public profiles (a tap on a player),
   the comeback gift, the referral contest of the month (#/refcontest), events from the admin panel (bar + multipliers)
   and the «Проверка честности» page (#/provably-fair) that recomputes every game with js/fair.js.
   Counted on the game server (bot/social.js, bot/progress.js, bot/game.js); uses window.RUSTUP_APP (js/app.js). */
(() => {
  'use strict';
  const R = window.RUSTUP_RULES, F = window.RUSTUP_FAIR, RM = R.REF_MONTH;
  const A = () => window.RUSTUP_APP;
  const S = () => A().S;
  const X = () => window.RUSTUP_EXTRAS;
  const page = html => { A().$('#page').innerHTML = html; };
  const API = () => window.RUSTUP_API.replace(/\/$/, '');
  const esc = s => A().esc(s);
  const DAY = 864e5, MSK = 3 * 3600e3;
  const rewardTxt = rub => A().coinInt(rub / A().rubPer());
  const plural = (n, a, b, c) => A().plural(n, a, b, c);
  // game → [name, icon of js/icons.js]
  const GAMES = { upgrade: ['Апгрейд', 'upgrade'], case: ['Кейсы', 'case'], crash: ['Ракетка', 'crash'], mines: ['Минёр', 'mines'], wheel: ['Колесо', 'wheel'],
    plinko: ['Плинко', 'plinko'], contract: ['Контракты', 'contract'], battle: ['Кейс-баттл', 'battle'] };
  const I = window.RUSTUP_ICONS;
  const gIco = (g, cls = '') => I.badge((GAMES[g] || [0, 'dice'])[1], cls);
  const multTxt = m => '×' + (Math.round(m * 100) / 100).toString().replace('.', ',');
  const dateTxt = t => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  function leftTxt(ms) {
    const m = Math.max(1, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    return d ? `${d} д ${h} ч` : h ? `${h} ч ${mm} мин` : `${mm} мин`;
  }
  const arrow = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // =====================================================================================
  // events from the admin panel (/api/feed events): a bar on the home and bonus pages
  // =====================================================================================
  let EVENTS = [];
  const activeEv = (now = Date.now()) => EVENTS.filter(e => e.start <= now && now < e.end);
  const evMult = kind => activeEv().filter(e => e.kind === kind).reduce((m, e) => Math.max(m, e.mult), 1);
  function setEvents(list) {
    const was = JSON.stringify(EVENTS);
    EVENTS = Array.isArray(list) ? list : [];
    if (was !== JSON.stringify(EVENTS)) paintEvents();
  }
  function evChips(now = Date.now()) {
    return EVENTS.filter(e => e.end > now).map(e => {
      const on = e.start <= now;
      return `<span class="ev-chip${on ? ' on' : ''}"><b>${I.glyph('bolt')}${multTxt(e.mult)}</b><span>${esc(R.EVENT_KINDS[e.kind] || e.kind)}${e.title ? ` · ${esc(e.title)}` : ''}</span>
        <small>${on ? `ещё ${leftTxt(e.end - now)}` : `через ${leftTxt(e.start - now)}`}</small></span>`;
    }).join('');
  }
  const eventsBar = () => `<div class="ev-bar" id="evBar"${EVENTS.some(e => e.end > Date.now()) ? '' : ' hidden'}>${evChips()}</div>`;
  function paintEvents() {
    const bar = document.getElementById('evBar');
    if (!bar) return;
    const has = EVENTS.some(e => e.end > Date.now());
    bar.hidden = !has;
    bar.innerHTML = has ? evChips() : '';
  }
  setInterval(() => { if (!document.hidden) paintEvents(); }, 30e3);

  // =====================================================================================
  // the comeback gift: shown once after loading when the server set it aside
  // =====================================================================================
  let cbShown = false;
  function onState(ready) {
    const c = S().comeback;
    if (!ready || cbShown || !c || !c.ready) return;
    cbShown = true;
    setTimeout(() => {
      A().modal('С возвращением!', `<div class="cb-box">
        ${I.badge('gift', 'xi-xl cb-ico')}
        <h3>Вас не было ${c.days} ${plural(c.days, 'день', 'дня', 'дней')}</h3>
        <p class="muted">Мы скучали — держите подарок за возвращение</p>
        <span class="cb-sum">+${rewardTxt(c.rub)}</span>
        <button class="btn btn-accent" id="cbGet" type="button">Забрать</button></div>`, m => {
        A().$('#cbGet', m).onclick = e => {
          e.currentTarget.disabled = true;
          A().api('comeback').then(d => {
            A().closeModal();
            if (!d.ok) return A().netToast(d);
            A().sfxWin(); A().haptic('success'); A().bumpBalance();
            A().toast(`Подарок за возвращение: +${rewardTxt(d.rub)}`, 'success');
            A().renderHeader();
          });
        };
      });
    }, 900);
  }

  // =====================================================================================
  // the player's stats (#/stats): totals and every game, counted on the server (s.gs)
  // =====================================================================================
  function totals() {
    const gs = S().gs || {}, list = Object.entries(gs).map(([g, x]) => ({ g, ...x })).filter(x => GAMES[x.g] && x.n > 0);
    const sum = k => list.reduce((a, x) => a + (x[k] || 0), 0);
    return { list: list.sort((a, b) => b.n - a.n), n: sum('n'), bet: sum('bet'), won: sum('won'), best: Math.max(S().stats.best || 0, ...list.map(x => x.best || 0)),
      bx: Math.max(0, ...list.map(x => x.bx || 0)) };
  }
  function statsPage() {
    if (!S().user) return page('<div class="page"><div class="w-glass pf-empty"><span class="muted">Откройте игру в Telegram</span></div></div>');
    const t = totals(), lv = X().myLevel(), st = S().stats, net = t.won - t.bet;
    const tile = (ico, k, v, sub = '') => `<div class="pf-stat w-glass">${I.badge(ico, 'xi-stat')}<span class="pf-k">${k}</span><b class="pf-v">${v}</b>${sub ? `<span class="pf-sub">${sub}</span>` : ''}</div>`;
    const maxN = Math.max(1, ...t.list.map(x => x.n));
    page(`<div class="page wallet-page stats-page">
      <h1 class="up-title">Статистика</h1>
      <div class="w-glass st-hero">
        <div><span>Ставок</span><b>${A().fmtInt(t.n)}</b></div>
        <div><span>Поставлено</span><b>${A().coin(t.bet)}</b></div>
        <div><span>Выиграно</span><b>${A().coin(t.won)}</b></div>
        <div><span>Итог</span><b class="${net >= 0 ? 'plus' : 'minus'}">${net >= 0 ? '+' : '−'}${A().coin(Math.abs(net))}</b></div>
      </div>
      <div class="pf-stats">
        ${tile('trophy', 'Лучший выигрыш', A().coin(t.best))}
        ${tile('trend', 'Лучший икс', t.bx ? multTxt(t.bx) : '—')}
        ${tile(t.list[0] ? GAMES[t.list[0].g][1] : 'game', 'Любимая игра', t.list[0] ? GAMES[t.list[0].g][0] : '—', t.list[0] ? `${A().fmtInt(t.list[0].n)} ${plural(t.list[0].n, 'ставка', 'ставки', 'ставок')}` : '')}
        ${tile('upgrade', 'Апгрейдов', A().fmtInt(st.upgrades), `${st.upgrades ? ((st.wins / st.upgrades) * 100).toFixed(1) : 0}% удачных`)}
        ${tile('fire', 'Рекорд огонька', `${(S().fire && S().fire.best) || 0} дн.`)}
        ${tile('star', 'Уровень', lv.l, `${(S().prizes || []).length} ${plural((S().prizes || []).length, 'приз', 'приза', 'призов')} в турнирах`)}
      </div>
      <div class="row-head"><h2 class="home-title">По играм</h2></div>
      ${t.list.length ? `<div class="w-glass st-games">${t.list.map(x => {
        const ret = x.bet > 0 ? Math.round((x.won / x.bet) * 100) : 0;
        return `<div class="st-game">${gIco(x.g, 'xi-row')}
          <span class="st-g-body"><b>${GAMES[x.g][0]}</b><span class="st-g-bar"><i style="width:${((x.n / maxN) * 100).toFixed(1)}%"></i></span>
            <small>${A().fmtInt(x.n)} ${plural(x.n, 'ставка', 'ставки', 'ставок')} · поставлено ${A().coin(x.bet)} · выиграно ${A().coin(x.won)}${x.bx ? ` · лучший ${multTxt(x.bx)}` : ''}</small></span>
          <span class="st-g-ret ${ret >= 100 ? 'plus' : ''}">${ret}%<small>возврат</small></span></div>`;
      }).join('')}</div>` : '<div class="w-glass pf-empty"><b>Пока пусто</b><span class="muted">Сыграйте в любую игру — статистика появится здесь</span><a class="btn btn-accent w-go" href="#/">Играть</a></div>'}
      <button class="btn btn-ghost st-pub" type="button" data-profile="${S().user.id}">Мой публичный профиль</button>
      <p class="w-note">Ставки и выигрыши по играм считаются на сервере с 6 ноября 2026. «Возврат» — сколько процентов от ставок вернулось выигрышами.</p>
    </div>`);
  }

  // =====================================================================================
  // showcase (own profile) and public profiles
  // =====================================================================================
  const MAX = R.SHOWCASE_MAX;
  function showcaseItems() {
    const inv = new Map(S().inventory.map(i => [i.uid, i]));
    return (S().showcase || []).map(u => inv.get(u)).filter(i => i && A().byName[i.name]);
  }
  function showcaseCard() {
    if (!S().user) return '';
    const items = showcaseItems();
    const slots = Array.from({ length: MAX }, (_, i) => items[i]
      ? `<div class="sc-slot filled">${A().card(A().byName[items[i].name], { static: true })}<button class="sc-x" type="button" data-sc-del="${items[i].uid}" aria-label="Убрать">×</button></div>`
      : `<button class="sc-slot empty" type="button" data-sc-add><span>+</span><small>Добавить</small></button>`).join('');
    return `<div class="row-head"><h2 class="home-title">Витрина</h2><button class="sc-look" type="button" data-profile="${S().user.id}">Как видят другие ${arrow}</button></div>
      <div class="sc-grid">${slots}</div>
      <p class="w-note sc-note">Лучшие предметы — их увидят все, кто нажмёт на вас в ленте или топе. Проданный предмет пропадёт с витрины.</p>`;
  }
  function saveShowcase(uids) {
    return A().api('showcase', { uids }).then(d => {
      if (!d.ok) return A().netToast(d);
      A().haptic('light');
      if (A().curPath() === '/profile') window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  }
  function pickShowcase() {
    const used = new Set(S().showcase || []);
    const seen = new Set();
    // the priciest first, one card per item name
    const list = S().inventory.filter(i => A().byName[i.name] && !used.has(i.uid)).sort((a, b) => A().byName[b.name].price - A().byName[a.name].price)
      .filter(i => (seen.has(i.name) ? false : seen.add(i.name))).slice(0, 60);
    if (!list.length) return A().toast('В инвентаре нет предметов для витрины', 'error');
    A().modal('Выберите предмет', `<div class="sc-pick">${list.map(i => `<button type="button" class="sc-pick-item" data-sc-pick="${i.uid}">${A().card(A().byName[i.name], { static: true })}</button>`).join('')}</div>`,
      m => m.addEventListener('click', e => {
        const b = e.target.closest('[data-sc-pick]');
        if (!b) return;
        A().closeModal();
        saveShowcase([...showcaseItems().map(i => i.uid), b.dataset.scPick].slice(0, MAX));
      }));
  }
  function openProfile(id) {
    id = Number(id);
    if (!id) return;
    A().modal('Профиль игрока', '<div class="pp"><div class="pp-load muted">Загружаем…</div></div>', () => {});
    fetch(`${API()}/api/profile?id=${id}`).then(r => r.json()).then(p => {
      const box = document.querySelector('.modal .pp');
      if (!box) return;
      if (!p.ok) { box.innerHTML = '<div class="pp-load muted">Профиль недоступен</div>'; return; }
      const me = S().user && S().user.id === id, st = p.stats;
      box.innerHTML = `
        <div class="pp-head"><span class="pp-ava">${A().avatarHtml(p.nick, p.color || '#e5383b', 'avatar', A().avaUrl(id))}${X().lvlBadge(p.lvl, 'on-ava')}</span>
          <span class="pp-who"><b>${esc(p.nick)}${me ? ' <i>вы</i>' : ''}</b><small>Уровень ${p.lvl} · в игре с ${dateTxt(p.since)}</small></span></div>
        <div class="pp-stats">
          <div><span>Ставок</span><b>${A().fmtInt(st.bets)}</b></div>
          <div><span>Лучший выигрыш</span><b>${A().moneyInt(st.best)}</b></div>
          <div><span>Лучший икс</span><b>${st.bx ? multTxt(st.bx) : '—'}</b></div>
          <div><span>Любимая игра</span><b>${st.fav && GAMES[st.fav] ? `${I.glyph(GAMES[st.fav][1])} ${GAMES[st.fav][0]}` : '—'}</b></div>
          <div><span>Рекорд огонька</span><b>${I.glyph('fire')} ${p.fire}</b></div>
          <div><span>Призов в турнирах</span><b>${I.glyph('trophy')} ${p.prizes}</b></div>
        </div>
        <h4 class="pp-h">Витрина</h4>
        ${p.showcase.length ? `<div class="pp-sc">${p.showcase.map(i => A().byName[i.name] ? A().card(A().byName[i.name], { static: true }) : '').join('')}</div>`
          : `<div class="pp-load muted">${me ? 'Витрина пуста — добавьте предметы в профиле' : 'Игрок пока ничего не выставил'}</div>`}
        ${me ? '<a class="btn btn-accent pp-btn" href="#/profile" data-close>Изменить витрину</a>' : ''}`;
    }).catch(() => { const box = document.querySelector('.modal .pp'); if (box) box.innerHTML = '<div class="pp-load muted">Нет связи с сервером</div>'; });
  }
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-profile]');
    if (p) { e.preventDefault(); e.stopPropagation(); document.querySelector('.react-menu')?.remove(); A().haptic('light'); return openProfile(p.dataset.profile); }
    if (e.target.closest('[data-sc-add]')) return pickShowcase();
    const del = e.target.closest('[data-sc-del]');
    if (del) return saveShowcase((S().showcase || []).filter(u => u !== del.dataset.scDel));
  }, true);

  // =====================================================================================
  // referral contest of the month (#/refcontest, server /api/refm)
  // =====================================================================================
  const MEDAL = ['#ffd166', '#c9d1dc', '#e0965a'];
  const monthName = t => new Date(t + MSK).toLocaleDateString('ru-RU', { month: 'long', timeZone: 'UTC' });
  const monthEnd = t => { const d = new Date(t + MSK); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - MSK; };
  const friendsTxt = n => `${A().fmtInt(n)} ${plural(n, 'друг', 'друга', 'друзей')}`;
  function contestPage() {
    const now = Date.now(), pool = RM.PRIZES_RUB.reduce((a, b) => a + b, 0);
    page(`<div class="page wallet-page refm-page">
      <div class="x-hero w-glass hs-refm">
        ${I.badge('users', 'xi-hero')}
        <div><span class="hero-kicker"><i class="dot-online"></i>Конкурс ${monthName(now).replace(/^./, c => c.toUpperCase())}</span><h1>Конкурс рефералов</h1>
        <p>Друг засчитывается, когда приходит по вашей ссылке и доходит до <b>${RM.LEVEL} уровня</b>. Топ-${RM.PRIZES_RUB.length} месяца делят <b>${rewardTxt(pool)}</b></p>
        <span class="x-timer">⏱ До конца месяца: <b>${leftTxt(monthEnd(now) - now)}</b></span></div>
      </div>
      <div class="x-prizes">${RM.PRIZES_RUB.map((p, i) => `<span class="x-prize${i < 3 ? ' p' + (i + 1) : ''}" ${i < 3 ? `style="--mc:${MEDAL[i]}"` : ''}><b>${i + 1}</b>${rewardTxt(p)}</span>`).join('')}</div>
      <div id="refmMe"></div>
      <div class="friend-steps refm-steps">
        <div class="friend-step"><span class="fs-num">1</span>${I.badge('link', 'xi-step')}<b>Отправьте ссылку</b><span>В чаты, сторис, под ролики</span></div>
        <div class="friend-step"><span class="fs-num">2</span>${I.badge('game', 'xi-step')}<b>Друг играет</b><span>XP идёт за каждую ставку</span></div>
        <div class="friend-step"><span class="fs-num">3</span>${I.badge('star', 'xi-step')}<b>${RM.LEVEL} уровень</b><span>Друг засчитан в конкурсе</span></div>
      </div>
      <div class="row-head"><h2 class="home-title">Таблица</h2></div>
      <div id="refmBody"><div class="w-glass pf-empty"><span class="muted">Загружаем…</span></div></div>
      <div id="refmLast"></div>
      <p class="w-note">Каждый друг засчитывается один раз. Твинки (второй аккаунт на том же устройстве) не считаются. Призы зачисляются автоматически 1-го числа в 00:00 МСК, от ${RM.MIN} друзей; итоги — в @${esc(R.TG_CHANNEL)}.</p>
    </div>`);
    const me = S().user && S().user.id;
    fetch(`${API()}/api/refm${me ? '?uid=' + me : ''}`).then(r => r.json()).then(d => {
      if (!d.ok || A().curPath() !== '/refcontest') return;
      A().$('#refmMe').innerHTML = `<div class="w-glass x-me"><span>Ваше место</span><b>${d.me ? d.me.place : '—'}</b><span>Друзей</span><b>${A().fmtInt(d.me ? d.me.pts : 0)}</b>
        <button class="btn btn-accent" type="button" data-refm-invite>Пригласить</button></div>`;
      const row = (p, i) => `<div class="top-row${p.uid === me ? ' me' : ''}" data-profile="${p.uid}">
        <span class="top-place">${i + 1}</span>
        <span class="x-ava">${A().avatarHtml(p.nick, p.color || '#e5383b', 'avatar', A().avaUrl(p.uid))}</span>
        <span class="top-who"><b>${esc(p.nick || 'Игрок')}${p.uid === me ? ' <i>вы</i>' : ''}</b><small>${friendsTxt(p.pts)}</small></span>
        <span class="top-won">${RM.PRIZES_RUB[i] ? rewardTxt(RM.PRIZES_RUB[i]) : ''}</span></div>`;
      A().$('#refmBody').innerHTML = d.top.length ? `<div class="tx-list w-glass top-list">${d.top.map(row).join('')}</div>`
        : '<div class="w-glass pf-empty"><b>Пока никого</b><span class="muted">Пригласите друга первым — и вы в таблице</span><button class="btn btn-accent w-go" type="button" data-refm-invite>Пригласить</button></div>';
      if (d.last && d.last.length) A().$('#refmLast').innerHTML = `<div class="row-head"><h2 class="home-title">Победители прошлого месяца</h2></div>
        <div class="tx-list w-glass top-list">${d.last.map(p => `<div class="top-row" data-profile="${p.uid}"><span class="top-place">${p.place}</span><span class="top-who"><b>${esc(p.nick || 'Игрок')}</b><small>${friendsTxt(p.pts)}</small></span><span class="top-won">${rewardTxt(p.rub)}</span></div>`).join('')}</div>`;
    }).catch(() => { const b = A().$('#refmBody'); if (b) b.innerHTML = '<div class="w-glass pf-empty"><span class="muted">Нет связи с сервером</span></div>'; });
  }
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-refm-invite]')) return;
    if (A().shareRef) A().shareRef(); else location.hash = '#/friends';
  });
  const contestBanner = () => `<a class="w-glass x-banner" href="#/refcontest">${I.badge('users', 'xi-banner')}<span><b>Конкурс</b><small>Друзья месяца</small></span></a>`;
  const contestCard = () => `<a class="w-glass pf-link refm-link" href="#/refcontest">${I.badge('users', 'xi-link')}<span class="refm-link-t"><b>Конкурс рефералов месяца</b><small>Топ-${RM.PRIZES_RUB.length} делят ${rewardTxt(RM.PRIZES_RUB.reduce((a, b) => a + b, 0))}</small></span>${arrow}</a>`;

  // =====================================================================================
  // «Проверка честности» (#/provably-fair): every game of the player and the shared rounds, recomputed here
  // =====================================================================================
  let FTAB = 'mine';
  const short = h => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '—');
  const revealed = () => {
    const sd = S().seeds || {}, m = new Map();
    if (sd.prev) m.set(sd.prev.serverHash, sd.prev.server);
    (sd.old || []).forEach(o => m.set(o.serverHash, o.server));
    return m;
  };
  const floatsFor = (server, f, k) => F.floatsOf(Array.from({ length: F.hashCount(k) }, (_, i) => window.hmacSha256(server, F.msg(f.c, f.n, i))));
  const caseName = id => { const c = A().caseById(id); return c ? c.name : id; };
  // recomputes a logged bet with the revealed server seed: { ok, txt }
  function verify(f, server) {
    if (window.sha256(server) !== f.h) return { ok: false, txt: 'хэш не совпадает' };
    switch (f.g) {
      case 'upgrade': {
        const roll = (parseInt(window.hmacSha256(server, `${f.c}:${f.n}`).slice(0, 8), 16) / 0x100000000) * 100;
        return { ok: Math.abs(roll - f.roll) < 1e-3, txt: `ролл ${roll.toFixed(4)} ${roll < f.chance ? '<' : '≥'} шанс ${f.chance}%` };
      }
      case 'case': {
        const c = A().caseById(f.id);
        if (!c) return { ok: false, txt: 'кейс больше не существует' };
        const items = A().caseItems(c).map(i => [i.skin.name, i.chance]);
        const w = F.caseWins(items, floatsFor(server, f, f.wins.length), f.wins.length);
        return { ok: w.join('|') === f.wins.join('|'), txt: w.map(n => (n.startsWith('RUB:') ? n.slice(4) + ' ₽' : n)).join(', ') };
      }
      case 'plinko': {
        const p = F.plinkoPath(R.PLINKO.ROWS, floatsFor(server, f, R.PLINKO.ROWS)), b = p.reduce((x, y) => x + y, 0);
        return { ok: b === f.bucket && R.PLINKO.RISK[f.risk][b] === f.mult, txt: `лунка ${b + 1} → ${multTxt(R.PLINKO.RISK[f.risk][b])}` };
      }
      case 'mines': {
        const m = F.minesSet(R.MINES.CELLS, f.m, floatsFor(server, f, R.MINES.CELLS - 1));
        return { ok: m.join() === f.set.join(), txt: `мины: ${m.map(x => x + 1).join(', ')}` };
      }
      case 'contract': {
        const m = F.contractMult(R.CONTRACT.MULTS, floatsFor(server, f, 2)[0]);
        return { ok: m === f.mult, txt: `множитель ${multTxt(m)}` };
      }
    }
    return { ok: false, txt: '—' };
  }
  function resultTxt(f) {
    switch (f.g) {
      case 'upgrade': return `${f.win ? 'победа' : 'проигрыш'} · шанс ${f.chance}% · ролл ${f.roll}`;
      case 'case': return `${esc(caseName(f.id))}: ${f.wins.map(n => esc(n.startsWith('RUB:') ? n.slice(4) + ' ₽' : n)).join(', ')}`;
      case 'plinko': return `${multTxt(f.mult)} · риск ${{ low: 'низкий', mid: 'средний', high: 'высокий' }[f.risk] || f.risk}`;
      case 'mines': return `${f.m} ${plural(f.m, 'мина', 'мины', 'мин')} · ${f.win ? 'забрал' : 'взрыв'}`;
      case 'contract': return `${multTxt(f.mult)} → ${esc(f.name || '')}`;
    }
    return '';
  }
  function fairPage() {
    const sd = S().seeds || {};
    const tabs = [['mine', 'Мои игры'], ['crash', 'Ракетка'], ['wheel', 'Колесо'], ['manual', 'Вручную']];
    page(`<div class="page wallet-page fair-page">
      <h1 class="up-title">Проверка честности</h1>
      <div class="x-hero w-glass hs-fair">${I.badge('shield', 'xi-hero')}
        <div><span class="hero-kicker">Provably Fair</span><h1>Каждую игру можно проверить</h1>
        <p>Результат зависит от секретного <b>server seed</b>, его хэш вы видите заранее, от вашего <b>client seed</b> и номера ставки <b>nonce</b>. Подменить исход после ставки нельзя — хэш бы не совпал.</p></div></div>
      <div class="fp-steps">
        <div><b>1</b><span>Сервер заранее показывает хэш своего сида</span></div>
        <div><b>2</b><span>Вы играете — каждая ставка с номером nonce</span></div>
        <div><b>3</b><span>Раскройте сид и проверьте любую игру в один тап</span></div>
      </div>
      <div class="w-glass fp-seeds">
        <div class="fp-f"><span>Хэш текущего server seed</span><code>${esc(sd.serverHash || '—')}</code></div>
        <div class="fp-f"><span>Client seed</span><div class="fp-row"><input id="cseed" class="text-input mono" value="${esc(sd.client || '')}" maxlength="64"><button class="btn btn-accent" id="saveSeed" type="button">OK</button></div></div>
        <div class="fp-f fp-inline"><span>Nonce (ставок с этим сидом)</span><b>${sd.nonce ?? 0}</b></div>
        <button class="btn btn-ghost fp-rotate" id="rotate" type="button">${I.glyph('unlock')} Раскрыть server seed и взять новый</button>
      </div>
      <div class="wallet-tabs fp-tabs">${tabs.map(([id, t]) => `<button type="button" class="wtab${FTAB === id ? ' on' : ''}" data-ftab="${id}">${t}</button>`).join('')}</div>
      <div id="fpBody"></div>
      <p class="w-note">Апгрейд, кейсы, Плинко, Минёр и Контракты считаются от ваших сидов, Ракетка и Колесо — от сида раунда (хэш виден до начала раунда). Кейс-баттлы пока используют криптографический генератор без такой проверки.</p>
    </div>`);
    A().$('#saveSeed').onclick = () => {
      const v = A().$('#cseed').value.trim();
      if (!v) return A().toast('Client seed не может быть пустым', 'error');
      A().api('seed', { client: v }).then(d => { if (!d.ok) return A().netToast(d); A().toast('Client seed сохранён, nonce сброшен', 'success'); fairPage(); });
    };
    A().$('#rotate').onclick = () => A().api('rotate').then(d => { if (!d.ok) return A().netToast(d); A().toast('Server seed раскрыт — теперь игры можно проверить', 'success'); fairPage(); });
    fairTab();
  }
  function fairTab() {
    const box = A().$('#fpBody');
    if (!box) return;
    if (FTAB === 'mine') {
      const list = S().fair || [], rv = revealed();
      if (!list.length) { box.innerHTML = '<div class="w-glass pf-empty"><b>Пока нет игр</b><span class="muted">Сыграйте — каждая ставка появится здесь</span><a class="btn btn-accent w-go" href="#/">Играть</a></div>'; return; }
      const locked = list.some(f => !rv.has(f.h));
      box.innerHTML = `${locked ? `<div class="w-glass fp-lock">${I.badge('lock', 'xi-sm')}<span>Часть игр ещё на текущем сиде — он секретный, пока вы его не раскроете. Нажмите «Раскрыть server seed» выше.</span></div>` : ''}
        <div class="w-glass fp-list">${list.map((f, i) => `<div class="fp-item" data-fi="${i}">
          ${gIco(f.g, 'xi-row')}
          <span class="fp-body"><b>${(GAMES[f.g] || [f.g])[0]} · nonce ${f.n}</b><small>${resultTxt(f)}</small><small class="fp-res" hidden></small></span>
          ${rv.has(f.h) ? `<button class="btn btn-accent fp-btn" type="button" data-fcheck="${i}">Проверить</button>` : `<span class="fp-wait">${I.glyph('lock')}</span>`}
        </div>`).join('')}</div>`;
      return;
    }
    if (FTAB === 'manual') {
      const sd = S().seeds || {};
      box.innerHTML = `<div class="w-glass fp-manual">
        <div class="fp-f"><span>Server seed</span><input id="vS" class="text-input mono" value="${sd.prev ? esc(sd.prev.server) : ''}"></div>
        <div class="fp-f"><span>Client seed</span><input id="vC" class="text-input mono" value="${sd.prev ? esc(sd.prev.client) : ''}"></div>
        <div class="fp-f"><span>Nonce</span><input id="vN" class="text-input mono" type="number" min="0" value="0"></div>
        <button class="btn btn-accent" id="verify" type="button">Посчитать</button>
        <div class="fp-out" id="vOut"></div></div>`;
      A().$('#verify').onclick = () => {
        const sv = A().$('#vS').value.trim(), c = A().$('#vC').value.trim(), n = +A().$('#vN').value || 0;
        if (!sv) return A().toast('Укажите server seed', 'error');
        const roll = (parseInt(window.hmacSha256(sv, `${c}:${n}`).slice(0, 8), 16) / 0x100000000) * 100;
        const u = F.floatsOf([window.hmacSha256(sv, F.msg(c, n, 0))]);
        A().$('#vOut').innerHTML = `<div><span>SHA-256(server seed)</span><code>${window.sha256(sv)}</code></div>
          <div><span>Апгрейд: ролл</span><b>${roll.toFixed(4)}</b></div>
          <div><span>Другие игры: числа ставки</span><code>${u.slice(0, 4).map(x => x.toFixed(6)).join(' · ')} …</code></div>`;
      };
      return;
    }
    box.innerHTML = '<div class="w-glass pf-empty"><span class="muted">Загружаем раунды…</span></div>';
    const game = FTAB;
    fetch(`${API()}/api/fair?game=${game}`).then(r => r.json()).then(d => {
      if (!d.ok || FTAB !== game || !A().$('#fpBody')) return;
      if (!d.rounds.length) { box.innerHTML = '<div class="w-glass pf-empty"><span class="muted">Раундов с сидом ещё не было</span></div>'; return; }
      box.innerHTML = `<div class="w-glass fp-list">${d.rounds.map(r => {
        if (r.open) return `<div class="fp-item">${gIco(game, 'xi-row')}<span class="fp-body"><b>Раунд #${r.id} · идёт</b><small>хэш ${short(r.hash)} · сид откроется после раунда</small></span><span class="fp-wait">${I.glyph('clock')}</span></div>`;
        const u = F.floatsOf([window.hmacSha256(r.seed, game)])[0];
        const ok = window.sha256(r.seed) === r.hash && (game === 'crash' ? F.crashPoint(R.CRASH, u) === r.point : F.wheelSeg(R.WHEEL.LAYOUT.length, u) === r.seg);
        const res = game === 'crash' ? multTxt(r.point) : (R.WHEEL.COLORS[R.WHEEL.LAYOUT[r.seg]] || {}).name;
        return `<div class="fp-item">${gIco(game, 'xi-row')}
          <span class="fp-body"><b>Раунд #${r.id} · ${esc(res)}</b><small>сид ${short(r.seed)} · хэш ${short(r.hash)}</small></span>
          <span class="fp-ok ${ok ? 'good' : 'bad'}">${I.glyph(ok ? 'check' : 'cross')}${ok ? 'честно' : 'не сходится'}</span></div>`;
      }).join('')}</div>`;
    }).catch(() => { box.innerHTML = '<div class="w-glass pf-empty"><span class="muted">Нет связи с сервером</span></div>'; });
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-ftab]');
    if (t) { FTAB = t.dataset.ftab; A().haptic('light'); document.querySelectorAll('[data-ftab]').forEach(x => x.classList.toggle('on', x === t)); return fairTab(); }
    const c = e.target.closest('[data-fcheck]');
    if (!c) return;
    const f = (S().fair || [])[+c.dataset.fcheck], server = revealed().get(f && f.h);
    if (!f || !server) return;
    const v = verify(f, server), res = c.closest('.fp-item').querySelector('.fp-res');
    res.hidden = false;
    res.className = 'fp-res ' + (v.ok ? 'good' : 'bad');
    res.innerHTML = I.glyph(v.ok ? 'check' : 'cross') + esc((v.ok ? 'Совпадает: ' : 'Не совпадает: ') + v.txt);
    c.outerHTML = `<span class="fp-ok ${v.ok ? 'good' : 'bad'}">${I.badge(v.ok ? 'check' : 'cross', 'xi-sm')}</span>`;
    A().haptic(v.ok ? 'success' : 'error');
  });

  window.RUSTUP_SOCIAL = {
    '/stats': statsPage, '/refcontest': contestPage, '/provably-fair': fairPage,
    setEvents, eventsBar, evMult, onState, showcaseCard, openProfile, contestBanner, contestCard
  };
})();
