// Cash-out requests: talks to the separate withdraw Worker (withdraw/worker.js). The wallet page (js/app.js) calls it.
// The server debits the balance, sends the request with the details to the admins and keeps the status.
(() => {
  const API = 'https://rustup-withdraw.ttzoomrust.workers.dev';
  const TG = window.Telegram && Telegram.WebApp && Telegram.WebApp.initData ? Telegram.WebApp : null;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rub = n => Math.round(n).toLocaleString('ru-RU') + ' ₽';
  const STATUS = { wait: ['На проверке', 'wait'], paid: ['Выплачено', 'ok'], rejected: ['Отклонено', 'bad'] };
  const ERRORS = {
    disabled: 'На данный момент такой возможности нет', auth: 'Откройте RUST UP через бота', min: 'Сумма меньше минимальной',
    max: 'Слишком большая сумма за один раз', details: 'Проверьте реквизиты', balance: 'Недостаточно средств на балансе',
    open: 'Дождитесь решения по прошлой заявке', banned: 'Аккаунт заблокирован', twin: 'Вывод недоступен для этого аккаунта',
    busy: 'Сервер занят, попробуйте ещё раз', net: 'Нет связи с сервером', server: 'Ошибка сервера, попробуйте позже'
  };
  let data = null, loading = false;

  const post = (path, body = {}) => fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: TG ? TG.initData : '', ...body }) })
    .then(r => r.json()).catch(() => ({ ok: false, error: 'net' }));

  // the list under «Заявки на вывод»; redraws #wdMoney when it arrives
  function load() {
    if (loading || !TG) return;
    loading = true;
    post('/wd/info').then(d => { loading = false; if (d.ok) { data = d; const box = document.getElementById('wdMoney'); if (box) box.innerHTML = html(); } });
  }
  const html = () => (data && data.requests.length ? data.requests.map(r => `<div class="w-req"><span class="w-req-ico"><svg viewBox="0 0 20 20"><path d="M10 13V3M5.5 7.5L10 3l4.5 4.5M4 17h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <span class="w-req-body"><b>${rub(r.payoutRub)} ${r.method === 'card' ? 'на карту' : 'в USDT'} · ${esc(r.to)}</b><small>#${r.id} · ${new Date(r.t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}${r.status === 'rejected' && r.note ? ' · ' + esc(r.note) : ''}</small></span>
      <span class="w-req-st ${STATUS[r.status] ? STATUS[r.status][1] : 'wait'}">${STATUS[r.status] ? STATUS[r.status][0] : esc(r.status)}</span></div>`).join('') : '');

  // client checks only for quick hints; the server checks everything again
  const luhn = d => { let s = 0; for (let i = 0; i < d.length; i++) { let n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } s += n; } return s % 10 === 0; };
  function check(method, details) {
    const v = String(details || '').trim();
    if (method === 'card') { const d = v.replace(/[\s-]/g, ''); return /^\d{16,19}$/.test(d) && luhn(d); }
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v) || /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v);
  }
  function send(method, amountRub, details) {
    if (!TG) return Promise.resolve({ ok: false, error: 'auth' });
    if (!check(method, details)) return Promise.resolve({ ok: false, error: 'details' });
    return post('/wd/create', { method, amountRub, details }).then(d => { if (d.ok) { data = null; load(); } return d; });
  }

  window.RUSTUP_WD = { load, html, send, error: e => ERRORS[e] || ERRORS.server };
})();
