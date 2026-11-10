// Bonuses of the extra server (withdraw/worker.js): the daily wheel (bonuses page), the +50% first deposit offer
// (wallet + bonuses page, with a countdown) and personal comeback codes BACK… (the usual promo field falls back here).
// Uses the app through window.RUSTUP_APP (set by js/app.js); every amount is checked and credited by the server.
(() => {
  const API = 'https://rustup-withdraw.ttzoomrust.workers.dev';
  const TG = window.Telegram && Telegram.WebApp && Telegram.WebApp.initData ? Telegram.WebApp : null;
  const A = () => window.RUSTUP_APP;
  const post = (path, body = {}) => fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: TG ? TG.initData : '', ...body }) })
    .then(r => r.json()).catch(() => ({ ok: false, error: 'net' }));
  const ERR = { done: 'Колесо уже крутили сегодня', twin: 'Бонус недоступен для этого аккаунта', banned: 'Аккаунт заблокирован', noacc: 'Сначала откройте игру',
    auth: 'Откройте RUST UP через бота', not_yours: 'Это личный промокод другого игрока', used: 'Промокод уже использован', expired: 'Срок промокода истёк',
    not_found: 'Промокод не найден', busy: 'Сервер занят, попробуйте ещё раз', net: 'Нет связи с сервером', server: 'Ошибка сервера, попробуйте позже' };
  const errText = e => ERR[e] || ERR.server;
  const left = t => { const s = Math.max(0, t - Date.now()), d = Math.floor(s / 864e5), h = Math.floor(s % 864e5 / 3600e3), m = Math.floor(s % 3600e3 / 60e3);
    return d ? `${d} д ${h} ч` : h ? `${h} ч ${m} мин` : `${m} мин`; };
  const css = `
  .wheel-tile .bt-art{width:96px;height:96px}
  .dw{position:relative;width:96px;height:96px}
  .dw svg{width:100%;height:100%;display:block;transition:transform 4.2s cubic-bezier(.17,.84,.2,1);filter:drop-shadow(0 6px 12px rgba(0,0,0,.45))}
  .dw::after{content:'';position:absolute;left:50%;top:-4px;margin-left:-8px;border:8px solid transparent;border-top:14px solid #fff;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6))}
  .dw-hub{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#ffd166 45%,#c98a12);box-shadow:0 2px 6px rgba(0,0,0,.5)}
  .fd-banner{display:flex;align-items:center;gap:12px;width:100%;margin:0 0 12px;padding:12px 14px;border-radius:18px;border:1.5px solid rgba(255,209,102,.55);
    background:linear-gradient(120deg,rgba(255,209,102,.22),rgba(229,56,59,.18) 60%,rgba(20,20,26,.6));color:#fff;text-align:left;font:inherit;cursor:pointer}
  .fd-banner .fd-pct{flex-shrink:0;min-width:64px;height:52px;padding:0 10px;border-radius:14px;display:grid;place-items:center;font-weight:900;font-size:22px;color:#2a1d00;background:linear-gradient(135deg,#ffe08a,#e5a500)}
  .fd-banner b{display:block;font-size:15px}.fd-banner small{display:block;color:#d9d2c0;font-size:12px;margin-top:2px}.fd-banner .fd-left{color:#ffd166;font-weight:800}`;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);

  // ---------- the daily wheel ----------
  let W = null, spinning = false;
  const COLORS = ['#e5383b', '#2a2d34', '#ffb703', '#2a2d34', '#3a86ff', '#2a2d34', '#9b5de5'];
  function wheelSvg(prizes) {
    const n = prizes.length, seg = 360 / n, R = 50;
    const p = a => [50 + R * Math.sin(a * Math.PI / 180), 50 - R * Math.cos(a * Math.PI / 180)];
    return `<svg viewBox="0 0 100 100" id="dwSvg">${prizes.map((r, i) => {
      const [x0, y0] = p(i * seg), [x1, y1] = p((i + 1) * seg), mid = (i + 0.5) * seg;
      return `<path d="M50 50 L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z" fill="${COLORS[i % COLORS.length]}" stroke="#14151a" stroke-width="1"/>
        <text x="50" y="16" transform="rotate(${mid} 50 50)" text-anchor="middle" font-size="8.5" font-weight="900" fill="#fff" font-family="Montserrat,Rubik,Arial">${r}₽</text>`;
    }).join('')}<circle cx="50" cy="50" r="49" fill="none" stroke="#ffd166" stroke-width="2"/></svg>`;
  }
  // a tile for the «Ежедневные» grid; filled in by mount()
  const wheelTile = () => `<div class="bonus-tile wheel-tile" id="dwTile"><span class="bt-art"><span class="dw">${wheelSvg([1, 2, 3, 5, 10, 25, 100])}<span class="dw-hub"></span></span></span>
    <span class="bt-body"><b class="bt-title">Колесо дня</b><span class="bt-value">до 100 ₽</span><span class="bt-text">Один бесплатный спин каждый день</span></span>
    <button class="btn btn-ghost bt-btn" id="dwBtn" disabled>…</button></div>`;
  function paintWheel() {
    const b = document.getElementById('dwBtn');
    if (!b || !W) return;
    b.className = `btn ${W.ready ? 'btn-accent' : 'btn-ghost'} bt-btn`;
    b.disabled = !W.ready || spinning;
    b.textContent = W.ready ? 'Крутить' : `Через ${left(W.nextAt)}`;
  }
  function mountWheel() {
    if (!document.getElementById('dwTile')) return;
    if (!TG) { const b = document.getElementById('dwBtn'); if (b) b.textContent = 'В боте'; return; }
    post('/wd/wheel/info').then(d => { if (d.ok) { W = d; const box = document.querySelector('#dwTile .dw'); if (box) box.innerHTML = wheelSvg(d.prizes) + '<span class="dw-hub"></span>'; paintWheel(); } });
    document.getElementById('dwBtn').onclick = () => A().requireLogin(spin);
  }
  function spin() {
    if (spinning || !W || !W.ready) return;
    spinning = true; paintWheel();
    post('/wd/wheel/spin').then(d => {
      if (!d.ok) { spinning = false; if (d.error === 'done') { W.ready = false; W.nextAt = d.nextAt || W.nextAt; } paintWheel(); return A().toast(errText(d.error), 'error'); }
      const svg = document.getElementById('dwSvg'), n = W.prizes.length, seg = 360 / n;
      const deg = 360 * 6 + (360 - (d.index + 0.5) * seg) + (Math.random() - 0.5) * seg * 0.6;
      const done = () => {
        spinning = false; W.ready = false; W.nextAt = d.nextAt; paintWheel();
        A().sfxWin(); A().haptic('success');
        A().toast(`Колесо дня: +${d.rub} ₽`, 'success');
        A().api('load').then(() => A().bumpBalance());
      };
      if (svg) { svg.style.transform = `rotate(${deg}deg)`; svg.addEventListener('transitionend', done, { once: true }); setTimeout(() => spinning && done(), 4600); } else done();
      try { A().beep && A().beep(); } catch (e) { /* no sound */ }
    });
  }

  // ---------- +50% to the first deposit ----------
  let FD = null, fdAt = 0;
  function firstDep() {
    if (!TG) return Promise.resolve(null);
    if (FD && Date.now() - fdAt < 60e3) return Promise.resolve(FD);
    return post('/wd/firstdep').then(d => { if (d.ok) { FD = d; fdAt = Date.now(); } return FD; });
  }
  const bannerHtml = d => `<button type="button" class="fd-banner" data-fd-go><span class="fd-pct">+${d.pct}%</span>
    <span><b>Бонус к первому пополнению</b><small>До ${Math.round(d.maxRub).toLocaleString('ru-RU')} ₽ сверху · осталось <span class="fd-left">${left(d.endsAt)}</span></small></span></button>`;
  // puts the banner on top of `box` (the wallet body or the bonuses page) when the offer is active
  function mountBanner(box, onGo) {
    if (!box) return;
    firstDep().then(d => {
      if (!d || !d.active || !box.isConnected || box.querySelector('.fd-banner')) return;
      box.insertAdjacentHTML('afterbegin', bannerHtml(d));
      box.querySelector('[data-fd-go]').onclick = onGo || (() => { location.hash = '#/wallet?tab=deposit'; });
    });
  }

  // ---------- personal comeback codes ----------
  const redeem = code => post('/wd/code', { code });

  window.RUSTUP_B2 = { wheelTile, mountWheel, mountBanner, redeem, errText, resetFirstDep: () => { FD = null; } };
})();
