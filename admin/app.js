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
  const ACT = { give: ['Выдача', 'ok'], deposit: ['Пополнение', 'ok'], take: ['Списание', 'bad'], ban: ['Бан', 'bad'], unban: ['Разбан', 'ok'], twin: ['Твинк', 'bad'], untwin: ['Не твинк', 'ok'] };

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
  let tab = 'stats', days = 14, STATS = null, CUR = null;
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

  function render() {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    tab === 'users' ? usersPage() : tab === 'log' ? logPage() : tab === 'support' ? supportPage() : statsPage();
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('button, [data-close]');
    if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; window.scrollTo(0, 0); return render(); }
    if (t.dataset.days) { days = +t.dataset.days; STATS = null; statsPage(); return loadStats(); }
    if (t.dataset.user) return openUser(+t.dataset.user);
    if (t.dataset.ticket) return openTicket(+t.dataset.ticket);
    if (t.dataset.tst) { TST = t.dataset.tst; TICKETS = null; return supportPage(); }
    if ('tsend' in t.dataset) return sendReply();
    if ('tclose' in t.dataset) return closeT();
    if ('close' in t.dataset) return closeSheet();
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
  if (['stats', 'users', 'support', 'log'].includes(start)) tab = start;
  render();
  loadStats();
  // the waiting-tickets badge on the tab, refreshed every half a minute
  api('tickets', { status: 'open' }).then(d => { if (d.ok) setBadge(d.waiting); });
  if (!DEMO) setInterval(() => { if (!document.hidden) api('tickets', { status: 'open' }).then(d => { if (d.ok) { setBadge(d.waiting); if (tab === 'support' && TST === 'open') { TICKETS = d; const l = $('#tlist'); if (l) l.innerHTML = ticketRows(); } } }); }, 30000);
  if (DEMO && /[?&]user=1/.test(location.search)) openUser(100);
  if (DEMO && /[?&]ticket=1/.test(location.search)) openTicket(7);
})();
