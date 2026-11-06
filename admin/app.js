// RUST UP admin Mini App (@rustuperhelp_bot): overview with day-by-day charts, player search and card
// (give / take balance, ban), admin log. Server: bot/admin.js (/api/adm/*). ?demo=1 renders sample data for previews.
(() => {
  'use strict';
  const TG = window.Telegram && Telegram.WebApp && Telegram.WebApp.initData ? Telegram.WebApp : null;
  const DEMO = !TG && /[?&]demo=1/.test(location.search);
  const API = (window.ADMIN_API || '').replace(/\/$/, '');
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const int = n => Math.round(n || 0).toLocaleString('ru-RU');
  let RATE = 1.63;                          // ₽ per coin, from the server
  const rub = coins => int((coins || 0) * RATE) + ' ₽';
  const ago = t => {
    if (!t) return '—';
    const m = Math.round((Date.now() - t) / 60000);
    return m < 2 ? 'сейчас в игре' : m < 60 ? `${m} мин назад` : m < 1440 ? `${Math.round(m / 60)} ч назад` : new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };
  const ACT = { give: ['Выдача', 'ok'], deposit: ['Пополнение', 'ok'], take: ['Списание', 'bad'], ban: ['Бан', 'bad'], unban: ['Разбан', 'ok'], twin: ['Твинк', 'bad'], untwin: ['Не твинк', 'ok'], event: ['Событие', 'ok'], event_stop: ['Стоп события', 'bad'] };

  function toast(text, kind = '') {
    const li = document.createElement('li');
    li.className = 'toast ' + kind; li.textContent = text;
    $('#toasts').appendChild(li);
    setTimeout(() => li.classList.add('out'), 2600); setTimeout(() => li.remove(), 3000);
    try { if (TG && kind) TG.HapticFeedback.notificationOccurred(kind === 'error' ? 'error' : 'success'); } catch (e) { /* old client */ }
  }
  function api(path, body = {}) {
    if (DEMO) return Promise.resolve(demo(path, body));
    return fetch(API + '/api/adm/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: TG.initData, ...body }) })
      .then(r => r.json()).then(d => { if (d.rate) RATE = d.rate; return d; }).catch(() => ({ ok: false, error: 'net' }));
  }

  // ---------- overview ----------
  let tab = location.hash === '#economy' ? 'economy' : 'stats', days = 14, STATS = null, CUR = null;
  function chart(series, key, color, label) {
    const W = 340, H = 150, L = 30, B = 20, T = 8, w = W - L - 4, h = H - B - T;
    const max = Math.max(4, ...series.map(s => s[key]));
    const top = Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max)))) * Math.pow(10, Math.floor(Math.log10(max)));
    const bw = w / series.length, gap = Math.max(1.5, bw * .25), y = v => T + h - (v / top) * h;
    const every = series.length > 15 ? 5 : 2;
    return `<div class="chart-box glass"><div class="chart-head"><b>${label}</b><span>${int(series.reduce((a, s) => a + s[key], 0))} за ${series.length} дн.</span></div>
      <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${[0, .5, 1].map(f => `<line x1="${L}" x2="${W - 2}" y1="${y(top * f)}" y2="${y(top * f)}" class="g"/><text x="${L - 6}" y="${y(top * f) + 3.5}" class="yl">${int(top * f)}</text>`).join('')}
      ${series.map((s, i) => `<rect x="${L + i * bw + gap / 2}" y="${y(s[key])}" width="${bw - gap}" height="${Math.max(0, T + h - y(s[key]))}" rx="${Math.min(4, (bw - gap) / 3)}" fill="${color}"><title>${new Date(s.day).toLocaleDateString('ru-RU')}: ${int(s[key])}</title></rect>
        ${(series.length - 1 - i) % every === 0 ? `<text x="${L + i * bw + bw / 2}" y="${H - 5}" class="xl">${new Date(s.day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' })}</text>` : ''}`).join('')}
      </svg></div>`;
  }
  const who = r => `${esc(r.nick || r.name)}${r.username ? ` <small>@${esc(r.username)}</small>` : ''}`;
  function statsPage() {
    if (!STATS) { $('#page').innerHTML = '<div class="loading"><i></i><i></i><i></i></div>'; return; }
    const t = STATS.totals, d = STATS.today;
    const tile = (k, v, sub = '', cls = '') => `<div class="tile glass ${cls}"><span>${k}</span><b>${v}</b>${sub ? `<i>${sub}</i>` : ''}</div>`;
    $('#page').innerHTML = `
      <section class="tiles">
        ${tile('Онлайн сейчас', int(t.online), '', 'live')}
        ${tile('Всего в боте', int(t.users), `+${int(t.new24)} за сутки`)}
        ${tile('Хоть раз играли', int(t.players))}
        ${tile('По рефералкам', int(t.refs))}
        ${tile('Выигрышей за сутки', int(d.n), `${int(d.p)} игроков · ${rub(d.v)}`)}
        ${tile('Баланс у игроков', rub(t.balance))}
        ${tile('Заблокировано', int(t.banned), '', t.banned ? 'warn' : '')}
      </section>
      <div class="seg glass"><button class="${days === 14 ? 'on' : ''}" data-days="14">14 дней</button><button class="${days === 30 ? 'on' : ''}" data-days="30">30 дней</button></div>
      ${dayTable(STATS.series)}
      ${chart(STATS.series, 'peak', '#5aa9ff', 'Пик онлайна за день')}
      ${chart(STATS.series, 'returned', '#b07cff', 'Вернулись (заходили и раньше)')}
      ${chart(STATS.series, 'users', '#e5383b', 'Новые пользователи')}
      ${chart(STATS.series, 'players', '#ffd166', 'Игроков с выигрышами')}
      ${chart(STATS.series, 'drops', '#4fc27a', 'Выигрышей (апгрейды и кейсы)')}
      <section class="glass list"><h3>Топ по балансу</h3>${STATS.topBalance.map((r, i) => `<button class="row" data-user="${r.id}"><span class="n">${i + 1}</span><span class="w">${who(r)}</span><b>${rub(r.balance)}</b></button>`).join('') || '<p class="muted">Пусто</p>'}</section>
      <section class="glass list"><h3>Топ по приглашениям</h3>${STATS.topRefs.map((r, i) => `<button class="row" data-user="${r.id}"><span class="n">${i + 1}</span><span class="w">${who(r)}</span><b>${int(r.active)} / ${int(r.n)}</b></button>`).join('') || '<p class="muted">Пока никого</p>'}</section>
      <section class="glass list"><h3>Твинки <small class="muted">— без бонусов, не считаются друзьями</small></h3>${(STATS.twins || []).map(r => `<button class="row" data-user="${r.id}">
        <span class="w">${who(r)}<small class="sub">твинк ${esc(r.main_name || r.twin_of)}${r.main_username ? ` @${esc(r.main_username)}` : ''} · ${esc(r.twin_why || '')}</small></span><em class="ban">ТВИНК</em></button>`).join('') || '<p class="muted">Пока не найдено</p>'}</section>`;
  }
  // last 7 days: online peak, players, returned, retention of the newcomers (next day / in a week)
  function dayTable(series) {
    const rows = series.slice(-7).reverse();
    const p = v => (v == null ? '—' : v + '%');
    return `<section class="glass list days"><h3>По дням</h3>
      <div class="dt-row dt-head"><span>День</span><span>Пик онлайна</span><span>Играли</span><span>Вернулись</span><span>Новые</span><span>D1 / D7</span></div>
      ${rows.map(s => `<div class="dt-row"><span>${new Date(s.day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
        <b title="${s.peakAt ? new Date(s.peakAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}">${int(s.peak)}${s.peakAt ? `<small>${new Date(s.peakAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</small>` : ''}</b>
        <b>${int(s.active)}</b><b>${int(s.returned)}</b><b>${int(s.users)}</b><b>${p(s.d1)} / ${p(s.d7)}</b></div>`).join('')}
      <p class="muted">Вернулись — играли в этот день и заходили раньше. D1 / D7 — сколько новичков дня вернулось на следующий день / через неделю. Считается с момента обновления.</p></section>`;
  }
  function loadStats() {
    api('stats', { days }).then(d => {
      if (!d.ok) return denied(d);
      STATS = d;
      $('#me').textContent = d.me || '';
      if (tab === 'stats') statsPage();
      if (tab === 'log') logPage();
    });
  }
  function denied(d) {
    $('#page').innerHTML = `<div class="glass empty"><b>${d.error === 'forbidden' ? 'Нет доступа' : d.error === 'net' ? 'Нет связи с сервером' : 'Откройте админку из @' + esc(window.ADMIN_BOT || 'rustuperhelp_bot')}</b>
      <span class="muted">${d.error === 'forbidden' ? 'Ваш аккаунт не в списке админов. Добавить: /addadmin в @rustuper_bot.' : 'Попробуйте ещё раз.'}</span></div>`;
  }

  // ---------- players ----------
  let Q = '', USERS = null, searchTimer = null;
  function usersPage() {
    $('#page').innerHTML = `<div class="search glass"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5L20 20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
      <input id="q" placeholder="ID, @username, ник или имя" value="${esc(Q)}" autocomplete="off"></div>
      <section class="glass list" id="ulist">${USERS ? userRows() : '<div class="loading"><i></i><i></i><i></i></div>'}</section>`;
    $('#q').addEventListener('input', e => { Q = e.target.value; clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 300); });
    if (!USERS) runSearch();
  }
  const userRows = () => USERS.length ? USERS.map(u => `<button class="row" data-user="${u.id}">
      <span class="w">${who(u)}<small class="sub">ID ${u.id} · ${ago(u.last_app)}</small></span>${u.banned ? '<em class="ban">БАН</em>' : ''}<b>${u.balance != null ? rub(u.balance) : '—'}</b></button>`).join('')
    : '<p class="muted">Никого не нашли</p>';
  function runSearch() {
    api('search', { q: Q }).then(d => { if (!d.ok) return denied(d); USERS = d.users; const l = $('#ulist'); if (l) l.innerHTML = userRows(); });
  }
  function openUser(id) {
    $('#modal').innerHTML = '<div class="sheet-back" data-close></div><div class="sheet"><div class="loading"><i></i><i></i><i></i></div></div>';
    $('#modal').classList.add('open');
    api('user', { id }).then(d => {
      if (!d.ok) { closeSheet(); return toast('Игрок не найден', 'error'); }
      CUR = d;
      renderUser();
    });
  }
  function renderUser() {
    const { user: u, account: a, refs, drops, log } = CUR;
    const st = a ? a.stats : null;
    $('#modal .sheet').innerHTML = `
      <div class="sheet-head"><div><h2>${esc(a && a.nick || u.nick || u.name)} ${u.banned ? '<em class="ban">БАН</em>' : ''}</h2>
        <span class="muted">${u.username ? `@${esc(u.username)} · ` : ''}ID ${u.id} · ${ago(u.last_app)}</span></div><button class="x" data-close>×</button></div>
      <div class="kv">
        <div><span>Баланс</span><b>${a ? rub(a.balance) : '—'}</b></div>
        <div><span>Инвентарь</span><b>${a ? `${rub(a.itemsValue)} · ${int(a.items)} шт.` : '—'}</b></div>
        <div><span>Апгрейдов / побед</span><b>${st ? `${int(st.upgrades)} / ${int(st.wins)}` : '—'}</b></div>
        <div><span>Поставлено</span><b>${st ? rub(st.wagered) : '—'}</b></div>
        <div><span>Выигрышей в ленте</span><b>${int(drops.n)} · ${rub(drops.v)}</b></div>
        <div><span>Друзей (в игре / всего)</span><b>${int(refs.active)} / ${int(refs.n)}</b></div>
        <div><span>Пригласил</span><b>${u.ref_by ? `<button class="link" data-user="${u.ref_by.id}">${esc(u.ref_by.name)}</button>` : '—'}</b></div>
        <div><span>В боте с</span><b>${new Date(u.first_seen).toLocaleDateString('ru-RU')}</b></div>
      </div>
      <div class="adjust glass">
        <h3>Баланс</h3>
        <div class="row2"><input id="aRub" inputmode="decimal" placeholder="Сумма, ₽"><input id="aNote" placeholder="Комментарий (виден игроку)" maxlength="100"></div>
        <div class="row2"><button class="btn good" data-adj="1">+ Выдать</button><button class="btn ghost" data-adj="-1">− Списать</button></div>
        <button class="btn good dep-btn" data-adj="dep">💳 Пополнение (+10% пригласившему)</button>
        ${a ? '' : '<p class="muted">Игрок ещё не заходил в новую версию: выдача дойдёт, когда он откроет игру; списывать пока нечего.</p>'}
      </div>
      ${u.twin_of ? `<div class="twin glass ${u.twin_ok ? 'ok' : ''}"><b>${u.twin_ok ? 'Был отмечен как твинк — снято' : 'Твинк'}</b>
        <span>Второй аккаунт на одном ${esc(u.twin_why || 'устройстве')} с <button class="link" data-user="${u.twin_of}">ID ${u.twin_of}</button>. ${u.twin_ok ? '' : 'Не получает бонусы, не считается другом, вывод закрыт.'}</span>
        <button class="btn ${u.twin_ok ? 'ghost' : 'good'}" data-twin="${u.twin_ok ? 0 : 1}">${u.twin_ok ? 'Снова считать твинком' : 'Это не твинк'}</button></div>` : ''}
      <button class="btn ${u.banned ? 'good' : 'danger'} wide" data-ban="${u.banned ? 0 : 1}">${u.banned ? 'Разблокировать' : 'Заблокировать'}</button>
      ${a && a.topItems.length ? `<h3>Дорогие предметы</h3><div class="items">${a.topItems.map(i => `<span>${esc(i.name)} <b>${rub(i.price)}</b></span>`).join('')}</div>` : ''}
      <h3>Операции</h3>
      <div class="glass list">${a && a.tx.length ? a.tx.map(x => `<div class="row tx"><span class="w">${esc(x.title)}<small class="sub">${new Date(x.t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span>
        <b class="${x.amount > 0 ? 'plus' : x.amount < 0 ? 'minus' : ''}">${x.amount ? (x.amount > 0 ? '+' : '−') + rub(Math.abs(x.amount)) : '—'}</b></div>`).join('') : '<p class="muted">Операций нет</p>'}</div>
      ${log.length ? `<h3>Действия админов</h3><div class="glass list">${log.map(logRow).join('')}</div>` : ''}`;
  }
  function closeSheet() { $('#modal').classList.remove('open'); $('#modal').innerHTML = ''; CUR = null; }
  // sign: 1 give, -1 take, 'dep' — a deposit of the player (10% of it goes to the friend who invited them)
  function adjust(sign) {
    const deposit = sign === 'dep';
    if (deposit) sign = 1;
    const v = Number(($('#aRub').value || '').replace(',', '.').replace(/\s/g, ''));
    if (!(v > 0)) return toast('Укажите сумму в рублях', 'error');
    const note = $('#aNote').value.trim();
    if (!confirm(`${deposit ? 'Зачислить пополнение' : sign > 0 ? 'Выдать' : 'Списать'} ${int(v)} ₽ игроку ${CUR.user.nick || CUR.user.name}?${deposit && CUR.user.ref_by ? `\n10% (${int(v / 10)} ₽) получит ${CUR.user.ref_by.name}.` : ''}`)) return;
    api('adjust', { id: CUR.user.id, rub: sign * v, note, deposit: deposit ? 1 : 0 }).then(d => {
      if (!d.ok) return toast({ funds: 'На балансе меньше этой суммы', noacc: 'У игрока ещё нет аккаунта', amount: 'Неверная сумма' }[d.error] || 'Не удалось', 'error');
      toast(deposit ? `Пополнение ${int(v)} ₽ зачислено${d.refIncome ? ' · 10% ушло пригласившему' : ''}` : sign > 0 ? `Выдано ${int(v)} ₽` : `Списано ${int(v)} ₽`, 'success');
      openUser(CUR.user.id); USERS = null; loadStats();
    });
  }
  function ban(on) {
    const note = on ? prompt('Причина бана (видна только админам)', '') : '';
    if (on && note === null) return;
    api('ban', { id: CUR.user.id, ban: on, note: note || '' }).then(d => {
      if (!d.ok) return toast('Не удалось', 'error');
      toast(on ? 'Игрок заблокирован' : 'Игрок разблокирован', 'success');
      openUser(CUR.user.id); USERS = null; loadStats();
    });
  }

  // ---------- log ----------
  const logRow = l => { const [t, c] = ACT[l.action] || [l.action, '']; return `<div class="row tx"><span class="w"><span class="lg-head"><em class="tag ${c}">${t}</em>${l.user_id ? `<button class="link" data-user="${l.user_id}">ID ${l.user_id}</button>` : ''}</span>
    <small class="sub">${esc(l.admin)} · ${new Date(l.t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${l.note ? ` · ${esc(l.note)}` : ''}</small></span>
    <b>${l.amount ? (l.amount > 0 ? '+' : '−') + int(Math.abs(l.amount)) + ' ₽' : ''}</b></div>`; };
  function logPage() {
    $('#page').innerHTML = STATS ? `<section class="glass list"><h3>Последние действия</h3>${STATS.log.length ? STATS.log.map(logRow).join('') : '<p class="muted">Пока ничего</p>'}</section>`
      : '<div class="loading"><i></i><i></i><i></i></div>';
  }

  // ---------- support ----------
  let TST = 'open', TICKETS = null, TCUR = null;
  const tAgo = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'только что' : m < 60 ? `${m} мин` : m < 1440 ? `${Math.round(m / 60)} ч` : `${Math.round(m / 1440)} дн`; };
  function supportPage() {
    $('#page').innerHTML = `<div class="seg glass"><button class="${TST === 'open' ? 'on' : ''}" data-tst="open">Открытые</button><button class="${TST === 'closed' ? 'on' : ''}" data-tst="closed">Закрытые</button></div>
      <section class="glass list" id="tlist">${TICKETS ? ticketRows() : '<div class="loading"><i></i><i></i><i></i></div>'}</section>
      <p class="muted hint">Ответить можно здесь или прямо в боте — ответом (reply) на сообщение «Обращение #…».</p>`;
    if (!TICKETS) loadTickets();
  }
  const ticketRows = () => TICKETS.tickets.length ? TICKETS.tickets.map(t => `<button class="row" data-ticket="${t.id}">
      <span class="dot ${t.status === 'closed' ? 'off' : t.last_from === 'user' ? 'wait' : 'ok'}"></span>
      <span class="w">#${t.id} · ${esc(t.name || t.user_id)}${t.username ? ` <small>@${esc(t.username)}</small>` : ''}<small class="sub">${esc((t.last || '[вложение]').slice(0, 80))}</small></span>
      <b class="t-ago">${tAgo(t.updated)}</b></button>`).join('') : `<p class="muted">${TST === 'open' ? 'Открытых обращений нет 🎉' : 'Закрытых пока нет'}</p>`;
  function loadTickets() {
    api('tickets', { status: TST }).then(d => {
      if (!d.ok) return denied(d);
      TICKETS = d; setBadge(d.waiting);
      const l = $('#tlist'); if (l) l.innerHTML = ticketRows();
    });
  }
  function setBadge(n) {
    const b = $('[data-tab="support"]');
    if (b) b.innerHTML = `Поддержка${n ? `<span class="badge">${n}</span>` : ''}`;
  }
  function openTicket(id) {
    $('#modal').innerHTML = '<div class="sheet-back" data-close></div><div class="sheet"><div class="loading"><i></i><i></i><i></i></div></div>';
    $('#modal').classList.add('open');
    api('ticket', { id }).then(d => { if (!d.ok) { closeSheet(); return toast('Обращение не найдено', 'error'); } TCUR = d; renderTicket(); });
  }
  function renderTicket() {
    const { ticket: t, msgs } = TCUR;
    const media = m => m.media ? `<span class="att">📎 ${{ photo: 'фото', document: esc(m.media.name || 'файл'), video: 'видео', voice: 'голосовое', sticker: 'стикер' }[m.media.type] || 'вложение'} — открыть в боте</span>` : '';
    $('#modal .sheet').innerHTML = `
      <div class="sheet-head"><div><h2>Обращение #${t.id} ${t.status === 'closed' ? '<em class="tag">закрыто</em>' : ''}</h2>
        <span class="muted"><button class="link" data-user="${t.user_id}">${esc(t.name || t.user_id)}</button>${t.username ? ` · @${esc(t.username)}` : ''} · id ${t.user_id}${t.balance != null ? ` · ${rub(t.balance)}` : ''}</span></div><button class="x" data-close>×</button></div>
      <div class="chat">${msgs.map(m => `<div class="msg ${m.from_admin ? 'me' : ''}"><div class="bubble">${m.text ? esc(m.text).replace(/\n/g, '<br>') : ''}${media(m)}</div>
        <small>${m.from_admin ? esc(m.from_admin) + ' · ' : ''}${new Date(m.t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div>`).join('')}</div>
      <div class="reply glass"><textarea id="rText" rows="3" placeholder="Ответ игроку…" maxlength="3500"></textarea>
        <div class="row2"><button class="btn ghost" data-tclose ${t.status === 'closed' ? 'disabled' : ''}>✅ Закрыть</button><button class="btn danger" data-tsend>Отправить</button></div></div>`;
    const c = $('#modal .chat'); c.scrollTop = c.scrollHeight;
  }
  function sendReply() {
    const text = $('#rText').value.trim();
    if (!text) return toast('Напишите ответ', 'error');
    const b = $('[data-tsend]'); b.disabled = true;
    api('reply', { id: TCUR.ticket.id, text }).then(d => {
      b.disabled = false;
      if (!d.ok) return toast(d.error === 'blocked' ? 'Игрок заблокировал бота — ответ не доставлен' : 'Не удалось отправить', 'error');
      toast('Ответ отправлен', 'success'); TICKETS = null; openTicket(TCUR.ticket.id);
    });
  }
  function closeT() {
    api('close', { id: TCUR.ticket.id }).then(d => {
      if (!d.ok) return toast('Не удалось', 'error');
      toast('Обращение закрыто', 'success'); TICKETS = null; closeSheet(); if (tab === 'support') supportPage();
    });
  }

  // ---------- economy: bets and payouts per game (bot/admin.js economy) ----------
  let ECON = null, edays = 7;
  const GAME_NAMES = { upgrade: 'Апгрейд', case: 'Кейсы', crash: 'Ракетка', contract: 'Контракты', battle: 'Кейс-баттл', mines: 'Минёр', wheel: 'Колесо', plinko: 'Плинко',
    bonus: 'Бонусы игрокам', admin: 'Выдано админами' };
  function economyPage() {
    if (!ECON) { $('#page').innerHTML = '<div class="loading"><i></i><i></i><i></i></div>'; return loadEconomy(); }
    const t = ECON.total, pct = v => (v == null ? '—' : v.toString().replace('.', ',') + '%');
    const tile = (k, v, sub = '', cls = '') => `<div class="tile glass ${cls}"><span>${k}</span><b>${v}</b>${sub ? `<i>${sub}</i>` : ''}</div>`;
    $('#page').innerHTML = `
      <div class="seg glass">${[[1, 'Сегодня'], [7, '7 дней'], [30, '30 дней']].map(([d, l]) => `<button class="${edays === d ? 'on' : ''}" data-edays="${d}">${l}</button>`).join('')}</div>
      <section class="tiles">
        ${tile('Прибыль с игр', rub(t.profit), `${int(t.bets)} ставок`, t.profit >= 0 ? 'live' : 'warn')}
        ${tile('Отдача игрокам', pct(t.rtp), `поставили ${rub(t.wagered)} · выплачено ${rub(t.paid)}`)}
        ${tile('Бонусы игрокам', rub(t.gifts), 'подарки, кейсы, промо, огонёк, друзья, выдачи')}
        ${tile('Итого', rub(t.profit - t.gifts), 'прибыль с игр минус бонусы', t.profit - t.gifts >= 0 ? '' : 'warn')}
      </section>
      <section class="glass list econ"><h3>По играм</h3>
        <div class="ec-row ec-head"><span>Игра</span><span>Ставок</span><span>Поставили</span><span>Выплачено</span><span>Прибыль</span><span>Отдача</span></div>
        ${ECON.games.length ? ECON.games.map(g => `<div class="ec-row"><span>${GAME_NAMES[g.game] || esc(g.game)}</span><b>${int(g.bets)}</b><b>${rub(g.wagered)}</b><b>${rub(g.paid)}</b>
          <b class="${g.profit >= 0 ? 'plus' : 'minus'}">${g.profit >= 0 ? '+' : '−'}${rub(Math.abs(g.profit))}</b><b class="${g.rtp > 100 ? 'minus' : ''}">${pct(g.rtp)}</b></div>`).join('') : '<p class="muted">Ставок ещё не было</p>'}
        ${ECON.gifts.map(g => `<div class="ec-row gift"><span>${GAME_NAMES[g.game] || esc(g.game)}</span><b></b><b></b><b>${rub(g.paid)}</b><b class="minus">−${rub(g.paid)}</b><b></b></div>`).join('')}
        <p class="muted">Отдача — сколько процентов от ставок вернулось игрокам. Заложено около 95–96%; выше 100% — игра в минусе. Считается с момента обновления.</p></section>
      ${chart(ECON.series, 'profit', '#4fc27a', 'Прибыль с игр по дням')}
      ${chart(ECON.series, 'gifts', '#ffd166', 'Бонусы игрокам по дням')}
      <section class="glass list"><h3>Крупные выигрыши</h3>${ECON.wins.length ? ECON.wins.map(w => `<button class="row" data-user="${w.user_id}">
        <span class="w">${esc(w.nick)}<small class="sub">${esc(w.name)} · ${{ upgrade: 'апгрейд', case: 'кейс', contract: 'контракт', battle: 'баттл' }[w.src] || esc(w.src || '')}${w.chance && w.chance < 100 ? ` · шанс ${w.chance.toFixed(1)}%` : ''} · ${ago(w.t)}</small></span>
        <b>${rub(w.price)}</b></button>`).join('') : '<p class="muted">Пока нет</p>'}</section>`;
  }
  function loadEconomy() {
    api('economy', { days: edays }).then(d => { if (!d.ok) return denied(d); ECON = d; if (tab === 'economy') economyPage(); });
  }

  // ---------- events: a multiplier for a time, optionally announced in the channel (bot/social.js) ----------
  let EVENTS = null;
  const EV_STATE = { on: ['Идёт', 'ok'], soon: ['Запланировано', ''], done: ['Закончилось', ''], off: ['Остановлено', 'bad'] };
  const evWhen = t => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  function eventsPage() {
    if (!EVENTS) { $('#page').innerHTML = '<div class="loading"><i></i><i></i><i></i></div>'; return api('events').then(d => { if (!d.ok) return denied(d); EVENTS = d; if (tab === 'events') eventsPage(); }); }
    const K = EVENTS.kinds;
    $('#page').innerHTML = `
      <section class="adjust glass ev-form">
        <h3>Новое событие</h3>
        <label>Что усилить<select id="evKind">${Object.entries(K).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join('')}</select></label>
        <div class="row2"><label>Множитель<select id="evMult">${[1.5, 2, 3, 5].map(m => `<option value="${m}"${m === 2 ? ' selected' : ''}>×${String(m).replace('.', ',')}</option>`).join('')}</select></label>
          <label>Длительность<select id="evHours">${[[1, '1 час'], [3, '3 часа'], [6, '6 часов'], [12, '12 часов'], [24, 'Сутки'], [48, '2 дня'], [72, '3 дня'], [168, 'Неделя']].map(([h, t]) => `<option value="${h}"${h === 3 ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
        <div class="row2"><label>Начало<select id="evStart">${[[0, 'Сейчас'], [30, 'Через 30 мин'], [60, 'Через 1 час'], [180, 'Через 3 часа'], [720, 'Через 12 часов'], [1440, 'Завтра в это время']].map(([m, t]) => `<option value="${m}">${t}</option>`).join('')}</select></label>
          <label>Название (необязательно)<input id="evTitle" maxlength="60" placeholder="Например: Выходные"></label></div>
        <label class="ev-check"><input type="checkbox" id="evAnn" checked> Объявить в канале @up_rust, когда начнётся</label>
        <button class="btn good wide" data-ev-add>⚡ Запустить событие</button>
        <p class="muted">Игроки видят событие на главной и в «Бонусах» (за сутки до начала — как «скоро»). Множитель действует только на сервере и только в эти часы.</p>
      </section>
      <section class="glass list"><h3>События</h3>${EVENTS.events.length ? EVENTS.events.map(e => { const [st, c] = EV_STATE[e.state] || [e.state, '']; return `<div class="row tx">
        <span class="w"><span class="lg-head"><em class="tag ${c}">${st}</em><b>×${String(e.mult).replace('.', ',')} ${esc(K[e.kind] || e.kind)}</b></span>
          <small class="sub">${evWhen(e.start)} — ${evWhen(e.end)}${e.title ? ` · ${esc(e.title)}` : ''}${e.announce ? ' · 📣 в канале' : ''} · ${esc(e.by_admin || '')}</small></span>
        ${e.state === 'on' || e.state === 'soon' ? `<button class="btn ghost ev-stop" data-ev-stop="${e.id}">Стоп</button>` : ''}</div>`; }).join('') : '<p class="muted">Событий ещё не было</p>'}</section>`;
  }
  function addEvent() {
    const body = { kind: $('#evKind').value, mult: +$('#evMult').value, hours: +$('#evHours').value, startIn: +$('#evStart').value, title: $('#evTitle').value.trim(), announce: $('#evAnn').checked ? 1 : 0 };
    if (!confirm(`Запустить ×${body.mult} «${EVENTS.kinds[body.kind]}» на ${body.hours} ч${body.startIn ? ' (позже)' : ' прямо сейчас'}?`)) return;
    api('event_add', body).then(d => {
      if (!d.ok) return toast('Не удалось: ' + (d.error || ''), 'error');
      toast('Событие запущено', 'success'); EVENTS = null; eventsPage();
    });
  }

  function render() {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    tab === 'users' ? usersPage() : tab === 'log' ? logPage() : tab === 'support' ? supportPage() : tab === 'economy' ? economyPage() : tab === 'events' ? eventsPage() : statsPage();
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('button, [data-close]');
    if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; window.scrollTo(0, 0); return render(); }
    if (t.dataset.days) { days = +t.dataset.days; STATS = null; statsPage(); return loadStats(); }
    if (t.dataset.edays) { edays = +t.dataset.edays; ECON = null; return economyPage(); }
    if (t.dataset.user) return openUser(+t.dataset.user);
    if (t.dataset.ticket) return openTicket(+t.dataset.ticket);
    if (t.dataset.tst) { TST = t.dataset.tst; TICKETS = null; return supportPage(); }
    if ('tsend' in t.dataset) return sendReply();
    if ('tclose' in t.dataset) return closeT();
    if ('close' in t.dataset) return closeSheet();
    if ('evAdd' in t.dataset) return addEvent();
    if (t.dataset.evStop) return confirm('Остановить событие?') && api('event_stop', { id: +t.dataset.evStop }).then(d => { if (!d.ok) return toast('Не удалось', 'error'); toast('Событие остановлено', 'success'); EVENTS = null; eventsPage(); });
    if (t.dataset.adj) return adjust(t.dataset.adj === 'dep' ? 'dep' : +t.dataset.adj);
    if (t.dataset.ban) return ban(t.dataset.ban === '1');
    if (t.dataset.twin) return api('twin', { id: CUR.user.id, ok: t.dataset.twin === '1' }).then(d => {
      if (!d.ok) return toast('Не удалось', 'error');
      toast(t.dataset.twin === '1' ? 'Отмечен как не твинк' : 'Снова твинк', 'success');
      openUser(CUR.user.id); STATS = null; loadStats();
    });
  });

  // ---------- demo data for previews ----------
  function demo(path, body) {
    const now = Date.now(), day = 864e5;
    if (path === 'economy') {
      const g = (game, bets, wagered, paid) => ({ game, bets, wagered, paid, profit: wagered - paid, rtp: Math.round(paid / wagered * 1000) / 10 });
      const games = [g('upgrade', 4210, 812000, 771000), g('case', 1830, 395000, 352000), g('crash', 2650, 240000, 229500), g('plinko', 3100, 98000, 94400),
        g('mines', 990, 76000, 74100), g('wheel', 1400, 64000, 60200), g('battle', 120, 41000, 37900), g('contract', 210, 33000, 31500)];
      const wagered = games.reduce((a, x) => a + x.wagered, 0), paid = games.reduce((a, x) => a + x.paid, 0);
      return { ok: true, rate: 1.63, days: 7, games, gifts: [{ game: 'bonus', paid: 21000 }, { game: 'admin', paid: 3000 }],
        total: { bets: 14510, wagered, paid, profit: wagered - paid, rtp: Math.round(paid / wagered * 1000) / 10, gifts: 24000 },
        series: Array.from({ length: 14 }, (_, i) => ({ day: now - (13 - i) * day, profit: Math.round(5000 + 3000 * Math.sin(i / 1.7) + i * 300), gifts: Math.round(1500 + 500 * Math.sin(i)) })),
        wins: [{ user_id: 100, nick: 'Вася', name: '★ Karambit | Fade', price: 61000, chance: 4.2, src: 'upgrade', t: now - 3600e3 }, { user_id: 104, nick: 'Lena', name: 'Plush Pepe #1622', price: 38000, chance: null, src: 'case', t: now - 7200e3 }] };
    }
    if (path === 'events') return { ok: true, now, kinds: { xp: 'XP за ставки', tour: 'Очки турнира', season: 'Снежинки сезона', daily: 'Подарок дня', cashback: 'Кешбэк', quest: 'Награды заданий' }, events: [
      { id: 3, kind: 'tour', mult: 1.5, start: now + 3 * 3600e3, end: now + 9 * 3600e3, title: null, announce: 1, by_admin: '@NezoxFit', state: 'soon' },
      { id: 2, kind: 'xp', mult: 2, start: now - 3600e3, end: now + 2 * 3600e3, title: 'Выходные', announce: 1, by_admin: '@NezoxFit', state: 'on' },
      { id: 1, kind: 'daily', mult: 3, start: now - 3 * day, end: now - 2 * day, title: null, announce: 0, by_admin: '@NezoxFit', state: 'done' }] };
    if (path === 'stats') return { ok: true, rate: 1.63, me: '@NezoxFit',
      totals: { users: 1284, players: 803, online: 17, new24: 46, banned: 2, balance: 2450000, refs: 412 }, today: { n: 214, v: 380000, p: 61 },
      series: Array.from({ length: days }, (_, i) => ({ day: now - (days - 1 - i) * day, users: Math.round(30 + 25 * Math.sin(i / 2) + i * 2), players: Math.round(40 + 15 * Math.sin(i / 3 + 1) + i), drops: Math.round(150 + 60 * Math.sin(i / 2.5) + i * 4),
        peak: Math.round(18 + 8 * Math.sin(i / 1.7) + i), peakAt: now - (days - 1 - i) * day - 3 * 3600e3, active: Math.round(90 + 30 * Math.sin(i / 2) + i * 3), returned: Math.round(55 + 20 * Math.sin(i / 2.2) + i * 2), d1: i < days - 1 ? 30 + (i % 5) * 3 : null, d7: i < days - 7 ? 12 + (i % 4) : null })),
      twins: [{ id: 106, name: 'Вася 2', username: 'vasya_alt', twin_of: 100, twin_why: 'устройство', main_name: 'Вася', main_username: 'vasya' }],
      topBalance: [['Олег', 'oleg_rust', 920000], ['Neon', null, 615000], ['kotik', 'kotik_rust', 402000]].map(([nick, username, balance], i) => ({ id: 100 + i, nick, username, balance })),
      topRefs: [['Masha', 'masha', 48, 61], ['Ivan', 'ivan_rust', 22, 30]].map(([nick, username, active, n], i) => ({ id: 200 + i, nick, username, active, n })),
      log: [{ admin: '@NezoxFit', action: 'give', user_id: 100, amount: 5000, note: 'за конкурс', t: now - 3600e3 }, { admin: '@NezoxFit', action: 'ban', user_id: 105, amount: null, note: 'накрутка', t: now - 86e5 }] };
    if (path === 'search') return { ok: true, users: [{ id: 100, nick: 'Олег', name: 'Олег', username: 'oleg_rust', balance: 920000, last_app: now - 60e3, banned: 0 }, { id: 105, nick: 'cheater', name: 'Вася', username: null, balance: 12000, last_app: now - 5 * day, banned: 1 }] };
    if (path === 'user') return { ok: true, user: { id: 100, name: 'Олег', username: 'oleg_rust', nick: 'Олег', first_seen: now - 20 * day, last_app: now - 60e3, banned: false, ref_by: { id: 200, name: 'Masha' } },
      account: { balance: 920000, items: 14, itemsValue: 310000, nick: 'Олег', stats: { upgrades: 312, wins: 140, wagered: 2400000 }, topItems: [{ name: '★ Karambit | Fade', price: 120000 }, { name: 'Big Grin', price: 60741 }],
        tx: [{ t: now - 600e3, title: 'Апгрейд: выигрыш · Big Grin', amount: 60741 }, { t: now - 700e3, title: 'Апгрейд: ставка · шанс 38.20%', amount: -24000 }, { t: now - 3600e3, title: 'Зачисление от администрации · за конкурс', amount: 3067 }] },
      refs: { n: 6, active: 4 }, drops: { n: 58, v: 820000 }, log: [{ admin: '@NezoxFit', action: 'give', user_id: 100, amount: 5000, note: 'за конкурс', t: now - 3600e3 }] };
    if (path === 'tickets') return { ok: true, waiting: 2, tickets: [
      { id: 7, user_id: 100, name: 'Олег', username: 'oleg_rust', status: 'open', last_from: 'user', updated: now - 4 * 60e3, last: 'Не пришёл подарок за 10 друзей, прошло уже 2 дня' },
      { id: 6, user_id: 103, name: 'Neon', username: null, status: 'open', last_from: 'user', updated: now - 40 * 60e3, last: 'Промокод пишет «уже использован», а я его не вводил' },
      { id: 5, user_id: 104, name: 'kotik', username: 'kotik_rust', status: 'open', last_from: 'admin', updated: now - 3 * 3600e3, last: 'Проверили — подарок отправлен, загляните в профиль Telegram' }] };
    if (path === 'ticket') return { ok: true, ticket: { id: 7, user_id: 100, name: 'Олег', username: 'oleg_rust', status: 'open', balance: 920000 }, msgs: [
      { from_admin: null, text: 'Привет! Не пришёл подарок за 10 друзей, прошло уже 2 дня', t: now - 30 * 60e3 },
      { from_admin: null, text: '', media: { type: 'photo' }, t: now - 29 * 60e3 },
      { from_admin: '@NezoxFit', text: 'Здравствуйте! Проверяем, подарок отправим сегодня до вечера.', t: now - 10 * 60e3 },
      { from_admin: null, text: 'Спасибо, жду', t: now - 4 * 60e3 }] };
    return { ok: true };
  }

  if (TG) { TG.ready(); TG.expand(); try { TG.setHeaderColor('#08080a'); TG.setBackgroundColor('#08080a'); } catch (e) { /* old client */ } }
  if (!TG && !DEMO) { tab = 'stats'; denied({ error: 'auth' }); return; }
  const start = new URLSearchParams(location.search).get('tab');
  if (['stats', 'users', 'support', 'log', 'events', 'economy'].includes(start)) tab = start;
  render();
  loadStats();
  // the waiting-tickets badge on the tab, refreshed every half a minute
  api('tickets', { status: 'open' }).then(d => { if (d.ok) setBadge(d.waiting); });
  if (!DEMO) setInterval(() => { if (!document.hidden) api('tickets', { status: 'open' }).then(d => { if (d.ok) { setBadge(d.waiting); if (tab === 'support' && TST === 'open') { TICKETS = d; const l = $('#tlist'); if (l) l.innerHTML = ticketRows(); } } }); }, 30000);
  if (DEMO && /[?&]user=1/.test(location.search)) openUser(100);
  if (DEMO && /[?&]ticket=1/.test(location.search)) openTicket(7);
})();
