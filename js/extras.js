/* RUST UP progress and social bits (2026-11-06): levels and XP, quests (#/quests), the weekly tournament (#/tour),
   the season (#/season), reactions to wins in the LIVE strip, the win card («Похвастаться») and the season snow.
   Everything is counted on the game server (bot/progress.js, rules in js/rules.js); these pages only show it.
   Uses the app's helpers through window.RUSTUP_APP (js/app.js), loaded after this file. */
(() => {
  'use strict';
  const R = window.RUSTUP_RULES, LV = R.LEVELS, QS = R.QUESTS, TR = R.TOUR, SN = R.SEASON;
  const A = () => window.RUSTUP_APP;
  const I = window.RUSTUP_ICONS, SNOW = I.glyph('snow');   // js/icons.js
  const page = html => { A().$('#page').innerHTML = html; };
  const API = () => window.RUSTUP_API.replace(/\/$/, '');
  const DAY = 864e5, MSK = 3 * 3600e3;

  // ---------- the same formulas as bot/progress.js ----------
  const mskDay = t => Math.floor((t + MSK) / DAY);
  const weekOf = t => Math.floor((mskDay(t) + 3) / 7);
  const weekEndMs = wk => ((wk + 1) * 7 - 3) * DAY - MSK;
  const dayEndMs = t => (mskDay(t) + 1) * DAY - MSK;
  const xpNeed = l => Math.round(LV.BASE * Math.pow(l, 1.5));
  function levelOf(xp) {
    let l = 1, left = Math.max(0, xp || 0);
    while (left >= xpNeed(l) && l < 999) { left -= xpNeed(l); l++; }
    return { l, in: left, need: xpNeed(l) };
  }
  const hash = (seed, i) => { let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i + 1, 0xc2b2ae35); h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2f); return (h ^ (h >>> 16)) >>> 0; };
  const pickN = (list, n, seed) => list.map((q, i) => [hash(seed, i), q]).sort((a, b) => a[0] - b[0]).slice(0, n).map(x => x[1]);
  const dailyQuests = t => pickN(QS.DAILY, QS.DAILY_N, mskDay(t));
  const weeklyQuests = t => pickN(QS.WEEKLY, QS.WEEKLY_N, weekOf(t) * 31 + 7);
  const seasonOn = (t = Date.now()) => t >= SN.start && t < SN.end;
  const seasonClaimable = (t = Date.now()) => t >= SN.start && t <= SN.end + SN.CLAIM_MS;

  const tierOf = l => [...LV.TIERS].reverse().find(t => l >= t[0]) || LV.TIERS[0];
  const lvlBadge = (l, cls = '') => (l ? `<span class="lvl-badge ${cls}" style="--lc:${tierOf(l)[2]}" title="Уровень ${l} · ${tierOf(l)[1]}">${l}</span>` : '');
  const S = () => A().S;
  const myLevel = () => levelOf((S().lvl || {}).xp || 0);
  // rewards are set in rubles and paid in coins: shown in the player's currency like every other amount
  const rubCoins = rub => rub / A().rubPer();
  const rewardTxt = rub => A().coinInt(rubCoins(rub));
  const plural = (n, a, b, c) => A().plural(n, a, b, c);
  function leftTxt(ms) {
    const m = Math.max(1, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    return d ? `${d} д ${h} ч` : h ? `${h} ч ${mm} мин` : `${mm} мин`;
  }
  const levelReward = l => ({ rub: Math.min(LV.RUB_MAX, LV.RUB_PER * l), item: LV.ITEMS[l] || null });
  const itemImg = name => (A().byName[name] || {}).img || '';

  // quests of now with progress and state: claim | done | wait
  function questRows(now = Date.now()) {
    const q = S().q || {};
    const today = q.d === mskDay(now), week = q.w === weekOf(now);
    const row = (x, daily) => {
      const p = daily ? (today ? (q.dp || {})[x.id] || 0 : 0) : (week ? (q.wp || {})[x.id] || 0 : 0);
      const got = daily ? today && (q.dc || []).includes(x.id) : week && (q.wc || []).includes(x.id);
      return { ...x, daily, p: Math.min(p, x.n), state: got ? 'done' : p >= x.n ? 'claim' : 'wait' };
    };
    return { daily: dailyQuests(now).map(x => row(x, true)), weekly: weeklyQuests(now).map(x => row(x, false)), all: today && q.all };
  }
  const claimable = () => {
    if (!S().user) return 0;
    const r = questRows();
    const se = S().season && S().season.id === SN.id ? S().season : { pts: 0, got: [] };
    const pass = seasonClaimable() ? SN.PASS.filter((_, i) => se.pts >= (i + 1) * SN.STEP && !se.got.includes(i + 1)).length : 0;
    return [...r.daily, ...r.weekly].filter(x => x.state === 'claim').length + pass;
  };

  // ---------- the state changed (js/app.js applyState): a quest that became done ----------
  // the first state after loading is only remembered: nothing is announced for what happened before.
  // A new level is not announced (owner's decision 2026-11-06: the window got in the way) — its reward is credited silently,
  // the level card and the header badge show it.
  let lastClaim = null;
  function onState(ready) {
    if (!ready) return;
    const r = questRows(), now = Date.now();
    const claim = new Set([...r.daily, ...r.weekly].filter(x => x.state === 'claim').map(x => `${x.daily ? mskDay(now) : weekOf(now)}:${x.id}`));
    if (lastClaim) [...r.daily, ...r.weekly].forEach(x => {
      if (x.state === 'claim' && !lastClaim.has(`${x.daily ? mskDay(now) : weekOf(now)}:${x.id}`))
        setTimeout(() => A().toast(` Задание выполнено: <b>${A().esc(x.title)}</b> — заберите награду в «Заданиях»`, 'success'), 1800);
    });
    lastClaim = claim;
  }

  // ---------- level card (profile, quests page) ----------
  function levelCard() {
    const lv = myLevel(), [, title, color] = tierOf(lv.l), next = levelReward(lv.l + 1);
    const pct = Math.min(100, (lv.in / lv.need) * 100);
    return `<a class="lvl-card w-glass" href="#/quests" style="--lc:${color}">
      <span class="lvl-card-badge"><b>${lv.l}</b><small>ур.</small></span>
      <span class="lvl-card-body">
        <span class="lvl-card-top"><b>${title}</b><small>${A().fmtInt(lv.in)} / ${A().fmtInt(lv.need)} XP</small></span>
        <span class="lvl-bar"><i style="width:${pct.toFixed(1)}%"></i></span>
        <small class="muted">Уровень ${lv.l + 1}: ${rewardTxt(next.rub)}${next.item ? ` + ${A().esc(next.item)}` : ''} · XP за каждую ставку</small>
      </span></a>`;
  }

  // =====================================================================================
  // quests
  // =====================================================================================
  function questsPage() {
    const r = questRows(), now = Date.now();
    const row = x => `<div class="q-row ${x.state}">
        ${I.badge(x.state === 'done' ? 'check' : x.daily ? 'sun' : 'calendar', 'xi-row q-ico')}
        <span class="q-body"><b>${A().esc(x.title)}</b>
          <span class="q-bar"><i style="width:${((x.p / x.n) * 100).toFixed(1)}%"></i></span>
          <small>${x.t === 'wager' ? `${A().fmtInt(x.p)} / ${A().fmtInt(x.n)} ₽` : `${A().fmtInt(x.p)} / ${x.n}`} · ${rewardTxt(x.rub)} · +${x.daily ? QS.XP_D : QS.XP_W} XP${seasonOn() ? ` · ${SNOW}${x.daily ? QS.SEASON_D : QS.SEASON_W}` : ''}</small></span>
        ${x.state === 'claim' ? `<button class="btn btn-accent q-btn" data-quest="${x.id}">Забрать</button>` : x.state === 'done' ? '<span class="q-got">Получено</span>' : '<span class="q-wait">В процессе</span>'}
      </div>`;
    const allDone = r.daily.every(x => x.state === 'done');
    page(`<div class="page wallet-page quests-page">
      <h1 class="up-title">Задания</h1>
      ${levelCard()}
      <div class="row-head"><h2 class="home-title">Задания дня</h2><span class="q-timer">⏱ ${leftTxt(dayEndMs(now) - now)}</span></div>
      <div class="w-glass q-list">${r.daily.map(row).join('')}
        <div class="q-all${r.all ? ' done' : allDone ? ' done' : ''}"><span>${I.glyph('gift')} Выполните все задания дня</span><b>${r.all ? 'Получено' : '+' + rewardTxt(QS.DAILY_ALL_RUB)}</b></div></div>
      <div class="row-head"><h2 class="home-title">Задания недели</h2><span class="q-timer">⏱ ${leftTxt(weekEndMs(weekOf(now)) - now)}</span></div>
      <div class="w-glass q-list">${r.weekly.map(row).join('')}</div>
      <div class="x-links">
        <a class="w-glass pf-link" href="#/tour">${I.badge('trophy', 'xi-link')}<b>Турнир недели</b><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
        ${seasonClaimable() ? `<a class="w-glass pf-link" href="#/season">${I.badge('snow', 'xi-link')}<b>${SN.name}</b><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></a>` : ''}
      </div>
      <p class="w-note">Задания дня меняются в 00:00 МСК, задания недели — в понедельник. Прогресс считается в любых играх на сервере.</p>
    </div>`);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-quest]');
    if (!b) return;
    b.disabled = true;
    A().api('quest', { id: b.dataset.quest }).then(d => {
      if (!d.ok) { b.disabled = false; return A().netToast(d); }
      A().sfxWin(); A().haptic('success'); A().bumpBalance();
      A().toast(`Задание выполнено: +${rewardTxt(d.rub)}${d.allDone ? ` и бонус за все задания дня +${rewardTxt(QS.DAILY_ALL_RUB)}` : ''}`, 'success');
      if (A().curPath() === '/quests') questsPage();
      A().renderHeader();
    });
  });

  // =====================================================================================
  // weekly tournament
  // =====================================================================================
  const MEDAL = ['#ffd166', '#c9d1dc', '#e0965a'];
  const boardRow = (p, i, me, prize) => `<div class="top-row${p.uid === me ? ' me' : ''}" data-profile="${p.uid}">
      <span class="top-place">${i + 1}</span>
      <span class="x-ava">${A().avatarHtml(p.nick, p.color || '#e5383b', 'avatar', A().avaUrl(p.uid))}${lvlBadge(p.lvl, 'on-ava')}</span>
      <span class="top-who"><b>${A().esc(p.nick)}${p.uid === me ? ' <i>вы</i>' : ''}</b><small>${A().fmtInt(p.pts)} ${plural(Math.round(p.pts), 'очко', 'очка', 'очков')}</small></span>
      <span class="top-won">${prize ? rewardTxt(prize) : ''}</span></div>`;
  function tourPage() {
    const now = Date.now();
    page(`<div class="page wallet-page tour-page">
      <div class="x-hero w-glass hs-tour">
        ${I.badge('trophy', 'xi-hero')}
        <div><span class="hero-kicker"><i class="dot-online"></i>Идёт сейчас</span><h1>Турнир недели</h1>
        <p>Очки за каждую ставку в любой игре: <b>1 ₽ = 1 очко</b>. Топ-10 делят <b>${rewardTxt(TR.PRIZES_RUB.reduce((a, b) => a + b, 0))}</b></p>
        <span class="x-timer">⏱ До конца: <b id="tourLeft">${leftTxt(weekEndMs(weekOf(now)) - now)}</b></span></div>
      </div>
      <div class="x-prizes">${TR.PRIZES_RUB.map((p, i) => `<span class="x-prize${i < 3 ? ' p' + (i + 1) : ''}" ${i < 3 ? `style="--mc:${MEDAL[i]}"` : ''}><b>${i + 1}</b>${rewardTxt(p)}</span>`).join('')}</div>
      <div id="tourMe"></div>
      <div class="row-head"><h2 class="home-title">Таблица</h2></div>
      <div id="tourBody"><div class="w-glass pf-empty"><span class="muted">Загружаем…</span></div></div>
      <div id="tourLast"></div>
      <p class="w-note">Призы зачисляются на баланс автоматически в понедельник в 00:00 МСК (от ${TR.MIN_PTS} очков), итоги публикуются в @${A().esc(R.TG_CHANNEL)}.</p>
    </div>`);
    const me = S().user && S().user.id;
    fetch(`${API()}/api/tour${me ? '?uid=' + me : ''}`).then(r => r.json()).then(d => {
      if (!d.ok || A().curPath() !== '/tour') return;
      const box = A().$('#tourBody');
      A().$('#tourMe').innerHTML = `<div class="w-glass x-me"><span>Ваше место</span><b>${d.me ? d.me.place : '—'}</b><span>Очки</span><b>${A().fmtInt(d.me ? d.me.pts : 0)}</b>
        <a class="btn btn-accent" href="#/">Играть</a></div>`;
      box.innerHTML = d.top.length ? `<div class="tx-list w-glass top-list">${d.top.map((p, i) => boardRow(p, i, me, TR.PRIZES_RUB[i])).join('')}</div>`
        : '<div class="w-glass pf-empty"><b>Пока никого</b><span class="muted">Сделайте первую ставку — и вы в таблице</span><a class="btn btn-accent w-go" href="#/">Играть</a></div>';
      if (d.last && d.last.length) A().$('#tourLast').innerHTML = `<div class="row-head"><h2 class="home-title">Победители прошлой недели</h2></div>
        <div class="tx-list w-glass top-list">${d.last.map(p => `<div class="top-row"><span class="top-place">${p.place}</span><span class="top-who"><b>${A().esc(p.nick || 'Игрок')}</b><small>${A().fmtInt(p.pts)} очков</small></span><span class="top-won">${rewardTxt(p.rub)}</span></div>`).join('')}</div>`;
    }).catch(() => { const box = A().$('#tourBody'); if (box) box.innerHTML = '<div class="w-glass pf-empty"><span class="muted">Нет связи с сервером</span></div>'; });
  }

  // =====================================================================================
  // the season
  // =====================================================================================
  const passArt = rw => (rw.item ? `<img src="${itemImg(rw.item)}" alt="">` : `<span class="sp-rub">₽</span>`);
  const passName = rw => (rw.item ? A().esc(rw.item) : rewardTxt(rw.rub));
  function seasonPage() {
    const now = Date.now();
    const se = S().season && S().season.id === SN.id ? S().season : { pts: 0, got: [] };
    const reached = Math.min(SN.PASS.length, Math.floor(se.pts / SN.STEP));
    const inLvl = se.pts - reached * SN.STEP;
    const over = now >= SN.end, date = t => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });
    page(`<div class="page wallet-page season-page">
      <div class="x-hero w-glass hs-season">
        ${I.badge('snow', 'xi-hero')}
        <div><span class="hero-kicker">${date(SN.start)} — ${date(SN.end - 1)}</span><h1>${SN.name}</h1>
        <p>Снежинки ${SNOW} за каждую ставку (1 ₽ = 1 ${SNOW}) и за задания. Каждые ${SN.STEP} ${SNOW} — новый уровень пропуска с наградой.</p>
        <span class="x-timer">${over ? 'Сезон завершён' : `⏱ До конца: <b>${leftTxt(SN.end - now)}</b>`}</span></div>
      </div>
      <div class="w-glass x-me sp-me"><span>Снежинки</span><b>${SNOW} ${A().fmtInt(se.pts)}</b><span>Уровень пропуска</span><b>${reached} / ${SN.PASS.length}</b>
        <span class="lvl-bar sp-bar"><i style="width:${reached >= SN.PASS.length ? 100 : ((inLvl / SN.STEP) * 100).toFixed(1)}%"></i></span></div>
      <div class="row-head"><h2 class="home-title">Зимний пропуск</h2><span class="q-timer">бесплатно для всех</span></div>
      <div class="sp-grid">${SN.PASS.map((rw, i) => {
        const l = i + 1, got = se.got.includes(l), ok = se.pts >= l * SN.STEP;
        const st = got ? 'got' : ok && seasonClaimable() ? 'claim' : 'lock';
        return `<div class="sp-cell ${st}"><span class="sp-l">${l}</span><span class="sp-art">${passArt(rw)}</span><b>${passName(rw)}</b>
          ${st === 'claim' ? `<button class="btn btn-accent sp-btn" data-season="${l}">Забрать</button>` : st === 'got' ? `<span class="sp-st">${I.glyph('check')} Получено</span>` : `<span class="sp-st">${SNOW} ${A().fmtInt(l * SN.STEP)}</span>`}</div>`;
      }).join('')}</div>
      <div class="row-head"><h2 class="home-title">Топ сезона</h2></div>
      <div class="x-prizes">${SN.TOP_RUB.map((p, i) => `<span class="x-prize${i < 3 ? ' p' + (i + 1) : ''}" ${i < 3 ? `style="--mc:${MEDAL[i]}"` : ''}><b>${i + 1}</b>${rewardTxt(p)}</span>`).join('')}</div>
      <div id="seasonBody"><div class="w-glass pf-empty"><span class="muted">Загружаем…</span></div></div>
      <p class="w-note">Награды пропуска забираются вручную, даже после конца сезона (ещё 7 дней). Призы топа зачисляются автоматически в конце сезона.</p>
    </div>`);
    const me = S().user && S().user.id;
    fetch(`${API()}/api/season${me ? '?uid=' + me : ''}`).then(r => r.json()).then(d => {
      if (!d.ok || A().curPath() !== '/season') return;
      A().$('#seasonBody').innerHTML = d.top.length
        ? `<div class="tx-list w-glass top-list">${d.top.map((p, i) => boardRow(p, i, me, SN.TOP_RUB[i]).replace(/очк(ов|о|а)/, SNOW)).join('')}</div>${d.me && d.me.place > d.top.length ? `<p class="w-note">Ваше место: <b>${d.me.place}</b></p>` : ''}`
        : '<div class="w-glass pf-empty"><b>Пока никого</b><span class="muted">Играйте — снежинки копятся с каждой ставки</span></div>';
    }).catch(() => {});
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-season]');
    if (!b) return;
    b.disabled = true;
    A().api('season_claim', { lvl: +b.dataset.season }).then(d => {
      if (!d.ok) { b.disabled = false; return A().netToast(d); }
      A().sfxWin(); A().haptic('success'); A().bumpBalance();
      A().toast(`${SN.name}: уровень ${d.lvl} — ${d.reward.item ? A().esc(d.reward.item) + ' в инвентаре' : '+' + rewardTxt(d.reward.rub)}`, 'success');
      if (A().curPath() === '/season') seasonPage();
      A().renderHeader();
    });
  });

  // ---------- entry points on other pages ----------
  function heroSlides() {
    const out = [`<a class="hero-slide hs-tourney" href="#/tour">
        <span class="hero-text"><span class="hero-kicker"><i class="dot-online"></i>Каждую неделю</span><b class="hero-title">Турнир<br>недели</b><span class="hero-sub">Топ-10 делят ${rewardTxt(TR.PRIZES_RUB.reduce((a, b) => a + b, 0))}</span><span class="hero-btn">Участвовать ›</span></span>
        <span class="hero-art">${I.badge('trophy', 'xi-art')}</span></a>`];
    if (seasonClaimable()) out.unshift(`<a class="hero-slide hs-season" href="#/season">
        <span class="hero-text"><span class="hero-kicker">${SNOW} Новый сезон</span><b class="hero-title">${SN.name.replace(' ', '<br>')}</b><span class="hero-sub">${SN.PASS.length} наград пропуска · топ сезона ${rewardTxt(SN.TOP_RUB[0])}</span><span class="hero-btn">Открыть ›</span></span>
        <span class="hero-art"><img class="hs-gift g0" src="${itemImg('Шампанское')}" alt=""><img class="hs-gift g1" src="${itemImg('Торт')}" alt=""><img class="hs-gift g2" src="${itemImg('Мишка')}" alt=""></span></a>`);
    return out;
  }
  function homeBanners() {
    const n = claimable(), SO = window.RUSTUP_SOCIAL;
    return `${SO ? SO.eventsBar() + SO.luckyCard() : ''}<div class="x-banners">
      <a class="w-glass x-banner" href="#/quests">${I.badge('target', 'xi-banner')}<span><b>Задания</b><small>${n ? `Можно забрать: ${n}` : 'Награды каждый день'}</small></span>${n ? `<i class="x-dot">${n}</i>` : ''}</a>
      <a class="w-glass x-banner" href="#/tour">${I.badge('trophy', 'xi-banner')}<span><b>Турнир</b><small>Призы каждую неделю</small></span></a>
      ${seasonClaimable() ? `<a class="w-glass x-banner" href="#/season">${I.badge('snow', 'xi-banner')}<span><b>Сезон</b><small>Зимний пропуск</small></span></a>` : ''}
      ${SO ? SO.contestBanner() : ''}
    </div>`;
  }

  // =====================================================================================
  // the win card: «Похвастаться» — the app draws it, the bot sends it and opens Telegram's share dialog
  // =====================================================================================
  let bragData = null, bragTimer = 0;
  const RUB_MIN = 30;   // a chip after a win worth at least this many rubles (a case modal has its own button)
  function brag(o, direct = false) {
    if (o && o.value > 0 && !direct && window.RUSTUP_SOCIAL) window.RUSTUP_SOCIAL.rusya('win', o);   // Руся cheers a win
    if (!o || !(o.value > 0) || !window.Telegram || !window.Telegram.WebApp || !window.Telegram.WebApp.initData) return;
    if (direct) return shareWin(o);
    if (o.value * A().rubPer() < RUB_MIN) return;
    bragData = o;
    clearTimeout(bragTimer);
    document.querySelector('.brag-chip')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="brag-chip"><button type="button" class="brag-go">${I.glyph('camera')} ${canStory() ? 'Похвастаться' : 'Похвастаться выигрышем'}</button>`
      + (canStory() ? `<button type="button" class="brag-go brag-story">${I.glyph('star')} В сторис</button>` : '') + `<button type="button" class="brag-x" aria-label="Закрыть">×</button></div>`);
    const el = document.querySelector('.brag-chip');
    el.querySelector('.brag-go').onclick = () => { el.remove(); shareWin(bragData); };
    if (el.querySelector('.brag-story')) el.querySelector('.brag-story').onclick = () => { el.remove(); storyWin(bragData); };
    el.querySelector('.brag-x').onclick = () => el.remove();
    bragTimer = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 12000);
  }
  const loadImg = src => new Promise(res => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  async function drawCard(o) {
    const W = 720, H = 900, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    try { await document.fonts.load('900 40px Montserrat'); } catch (e) { /* system font */ }
    const F = (w, s) => `${w} ${s}px Montserrat, Arial, sans-serif`;
    // background: dark with red light, like the app
    c.fillStyle = '#0b0b0e'; c.fillRect(0, 0, W, H);
    let g = c.createRadialGradient(W * 0.5, H * 0.42, 40, W * 0.5, H * 0.42, 520);
    g.addColorStop(0, 'rgba(229,56,59,.55)'); g.addColorStop(0.5, 'rgba(120,10,18,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 24; i++) { c.save(); c.translate(W / 2, H * 0.42); c.rotate((i / 24) * Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.035)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(600, -40); c.lineTo(600, 40); c.closePath(); c.fill(); c.restore(); }
    // logo
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.font = F(900, 54); c.textAlign = 'left';
    const lw = c.measureText('RUST').width, uw = c.measureText('UP').width, lx = (W - lw - uw - 12) / 2;
    c.fillStyle = '#fff'; c.fillText('RUST', lx, 92);
    c.fillStyle = '#e5383b'; c.fillText('UP', lx + lw + 12, 92);
    c.textAlign = 'center';
    c.font = F(700, 22); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillText(o.title || 'МОЙ ВЫИГРЫШ', W / 2, 140);
    // the item or the multiplier
    const skin = o.name && A().byName[o.name];
    const im = skin ? await loadImg(skin.img) : null;
    if (im) {
      const box = 380, k = Math.min(box / im.width, box / im.height), w = im.width * k, h = im.height * k;
      c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 40; c.shadowOffsetY = 18;
      if (skin.img.includes('assets/nft/')) { rrect(c, (W - w) / 2, 380 - h / 2, w, h, 40); c.clip(); }
      c.drawImage(im, (W - w) / 2, 380 - h / 2, w, h); c.restore();
      c.font = F(800, 30); c.fillStyle = '#fff';
      let nm = o.name; while (c.measureText(nm).width > W - 80 && nm.length > 4) nm = nm.slice(0, -2);
      c.fillText(nm === o.name ? nm : nm + '…', W / 2, 628);
    } else if (o.mult) {
      c.font = F(900, 170); c.fillStyle = '#ffd166'; c.shadowColor = 'rgba(255,170,60,.55)'; c.shadowBlur = 40;
      c.fillText(o.mult.toFixed(2).replace('.', ',') + '×', W / 2, 440); c.shadowBlur = 0;
      if (o.game) { c.font = F(800, 30); c.fillStyle = '#fff'; c.fillText(o.game, W / 2, 520); }
    }
    // the sum
    const sum = A().moneyInt(o.value);
    c.font = F(900, 76);
    const sw = c.measureText(sum).width + 80;
    g = c.createLinearGradient(0, 660, 0, 760); g.addColorStop(0, '#ff6b5d'); g.addColorStop(1, '#c42a2d');
    c.fillStyle = g; rrect(c, (W - sw) / 2, 660, sw, 100, 50); c.fill();
    c.fillStyle = '#fff'; c.fillText(sum, W / 2, 736);
    if (o.mult && im) { c.font = F(800, 26); c.fillStyle = '#ffd166'; c.fillText(`×${o.mult.toFixed(2).replace('.', ',')} к ставке`, W / 2, 796); }
    // the player
    const lv = myLevel().l, [, tier, color] = tierOf(lv), nick = (S().user && S().user.name) || 'Игрок';
    c.font = F(800, 28); const nw = c.measureText(nick).width;
    const bx = W / 2 - (nw + 64) / 2;
    c.fillStyle = color; c.beginPath(); c.arc(bx + 22, 840, 22, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#111'; c.font = F(900, 20); c.fillText(String(lv), bx + 22, 847);
    c.textAlign = 'left'; c.fillStyle = '#fff'; c.font = F(800, 28); c.fillText(nick, bx + 56, 850);
    c.textAlign = 'center'; c.font = F(600, 20); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillText(`${tier} · @${window.RUSTUP_BOT || 'rustuper_bot'}`, W / 2, 884);
    return cv.toDataURL('image/jpeg', 0.86);
  }
  // ---------- Telegram stories: the same card as a story, with the referral link (a widget for Premium users) ----------
  const TGW = () => window.Telegram && window.Telegram.WebApp;
  const canStory = () => !!(TGW() && TGW().initData && TGW().shareToStory && TGW().isVersionAtLeast && TGW().isVersionAtLeast('7.8'));
  // img — a jpeg data URL; extra goes to the server check (kind 'win' needs { value, bet } of a real win, 'month' a played month)
  async function toStory(img, kind, extra = {}) {
    const d = await A().api('story', { img, kind, ...extra });
    if (!d.ok) return A().netToast(d);
    const premium = !!(TGW().initDataUnsafe && TGW().initDataUnsafe.user && TGW().initDataUnsafe.user.is_premium);
    TGW().shareToStory(d.url, { text: `Играю в RUST UP — апгрейды, кейсы и бесплатные бонусы. Заходи: @${window.RUSTUP_BOT || 'rustuper_bot'}`.slice(0, 200),
      ...(premium ? { widget_link: { url: d.link, name: 'Играть в RUST UP' } } : {}) });
  }
  async function storyWin(o) {
    if (sharing || !canStory()) return;
    sharing = true;
    A().toast('Готовим сторис…');
    try { await toStory(await drawCard(o), 'win', { value: o.value, bet: o.bet || 0 }); } finally { sharing = false; }
  }
  let sharing = false;
  async function shareWin(o) {
    if (sharing) return;
    sharing = true;
    A().toast('Готовим карточку…');
    try {
      const img = await drawCard(o);
      const d = await A().api('brag', { img, value: o.value, bet: o.bet || 0, name: o.name || '', mult: o.mult || 0 });
      if (!d.ok) return A().netToast(d);
      const TG = window.Telegram.WebApp;
      if (d.id && TG.shareMessage && TG.isVersionAtLeast && TG.isVersionAtLeast('8.0')) TG.shareMessage(d.id, ok => ok && A().toast('Карточка отправлена 🔥', 'success'));
      else A().toast('Карточка уже в чате с ботом — перешлите её друзьям', 'success');
    } finally { sharing = false; }
  }

  // =====================================================================================
  // reactions to wins in the LIVE strip
  // =====================================================================================
  const REACTS = ['🔥', '😱', '👏', '💎', '😂'];
  const reacts = {};     // drop id → { emoji: count } from /api/feed
  let mine = {};         // drop id → my emoji (this device)
  try { mine = JSON.parse(localStorage.getItem('rustup_reacts') || '{}'); } catch (e) { /* none */ }
  const saveMine = () => { const k = Object.keys(mine); if (k.length > 200) k.slice(0, k.length - 200).forEach(x => delete mine[x]); try { localStorage.setItem('rustup_reacts', JSON.stringify(mine)); } catch (e) { /* ignore */ } };
  function reactHtml(id) {
    const r = reacts[id] || {};
    const top = Object.entries(r).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 2);
    return `<span class="drop-reacts" data-rid="${id}">${top.map(([e, n]) => `<i${mine[id] === e ? ' class="me"' : ''}>${e}${n > 1 ? n : ''}</i>`).join('')}</span>`;
  }
  function setReacts(map) {
    Object.entries(map || {}).forEach(([id, r]) => { reacts[id] = r; });
    document.querySelectorAll('.drop-reacts[data-rid]').forEach(el => { if (map && map[el.dataset.rid]) el.outerHTML = reactHtml(el.dataset.rid); });
  }
  function closeReactMenu() { document.querySelector('.react-menu')?.remove(); }
  function reactMenu(el) {
    closeReactMenu();
    const id = el.dataset.id, own = S().user && +el.dataset.uid === S().user.id;
    const r = reacts[id] || {}, total = Object.values(r).reduce((a, b) => a + b, 0);
    document.body.insertAdjacentHTML('beforeend', `<div class="react-menu" role="menu">
      ${own ? `<span class="rm-own">Ваш выигрыш${total ? ` · реакций: ${total}` : ''}</span>` : REACTS.map(e => `<button type="button" class="rm-e${mine[id] === e ? ' on' : ''}" data-react="${e}">${e}<small>${r[e] || ''}</small></button>`).join('')}
      <span class="rm-links"><button type="button" class="rm-go" data-profile="${el.dataset.uid}">Профиль</button><a class="rm-go" href="${el.getAttribute('href')}">Играть ›</a></span></div>`);
    const m = document.querySelector('.react-menu'), b = el.getBoundingClientRect();
    const w = m.offsetWidth;
    m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, b.left + b.width / 2 - w / 2)) + 'px';
    m.style.top = (b.bottom + 8) + 'px';
    m.addEventListener('click', e => {
      const x = e.target.closest('[data-react]');
      if (e.target.closest('.rm-go')) return closeReactMenu();
      if (!x) return;
      A().haptic('light');
      fetch(`${API()}/api/react`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: window.Telegram.WebApp.initData, id: +id, e: x.dataset.react }) })
        .then(res => res.json()).then(d => {
          if (!d.ok) return A().toast(A().gameErr(d), 'error');
          reacts[id] = d.counts;
          if (d.mine) mine[id] = d.mine; else delete mine[id];
          saveMine();
          document.querySelectorAll(`.drop-reacts[data-rid="${id}"]`).forEach(c => { c.outerHTML = reactHtml(id); });
          closeReactMenu();
        }).catch(() => A().toast('Нет связи с сервером', 'error'));
    });
  }
  // a tap on a win in the strip opens the reactions (Telegram only; the link still works elsewhere)
  document.addEventListener('click', e => {
    const d = e.target.closest('#drops .drop[data-id], #bestDrop .drop[data-id]');
    if (!d) { if (!e.target.closest('.react-menu')) closeReactMenu(); return; }
    if (!window.Telegram || !window.Telegram.WebApp || !window.Telegram.WebApp.initData) return;
    e.preventDefault();
    reactMenu(d);
  });
  window.addEventListener('scroll', closeReactMenu, { passive: true });

  // ---------- season snow: a few flakes, transforms only ----------
  function snow() {
    if (!seasonOn() || document.querySelector('.snow')) return;
    const flakes = Array.from({ length: 18 }, () => {
      const s = (2 + Math.random() * 4).toFixed(1), x = (Math.random() * 100).toFixed(1), dur = (9 + Math.random() * 10).toFixed(1), del = (-Math.random() * 18).toFixed(1), dx = Math.round(-30 + Math.random() * 60);
      return `<i style="--s:${s}px;--x:${x}vw;--d:${dur}s;--dl:${del}s;--dx:${dx}px"></i>`;
    }).join('');
    document.body.insertAdjacentHTML('beforeend', `<div class="snow" aria-hidden="true">${flakes}</div>`);
  }

  window.RUSTUP_EXTRAS = {
    '/quests': questsPage, '/tour': tourPage, '/season': seasonPage,
    levelOf, myLevel, lvlBadge, levelCard, claimable, onState, heroSlides, homeBanners, brag, reactHtml, setReacts, snow, seasonClaimable, canStory, toStory, storyWin, rrect, loadImg
  };
})();
