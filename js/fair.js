/* RUST UP provably fair formulas (2026-11-06) — the same file runs on the site and on the game server
   (tools/build-server-data.js copies it to bot/fairlib.js), so a result checked on the «Проверка честности» page
   is computed exactly like the server did it.
   A bet of a player takes floats in [0, 1): HMAC_SHA256(server seed, `${client seed}:${nonce}:${k}`) for k = 0, 1, …,
   every hash gives 8 floats (8 hex digits each / 2^32); the nonce goes up by one after every bet.
   (The upgrade keeps its older formula: HMAC_SHA256(server seed, `${client seed}:${nonce}`), first 8 hex digits.)
   The shared rounds of «Ракетка» and «Колесо» have their own seed, its SHA-256 is shown before the round:
   HMAC_SHA256(round seed, 'crash' | 'wheel') → the first float. */
window.RUSTUP_FAIR = (() => {
  const floatsOf = hashes => hashes.flatMap(h => Array.from({ length: 8 }, (_, i) => parseInt(h.slice(i * 8, i * 8 + 8), 16) / 0x100000000));
  const hashCount = n => Math.ceil(n / 8);
  const msg = (client, nonce, k) => `${client}:${nonce}:${k}`;
  // [[value, chance %], …] → the value whose chance range holds u × 100
  const pick = (list, u) => { const r = u * 100; let acc = 0; return (list.find(([, ch]) => (acc += ch) > r) || list[list.length - 1])[0]; };
  return {
    floatsOf, hashCount, msg, pick,
    // floats a game takes
    need: { case: n => n, plinko: rows => rows, mines: cells => cells - 1, contract: () => 2 },
    caseWins: (items, u, n) => Array.from({ length: n }, (_, i) => pick(items, u[i])),
    plinkoPath: (rows, u) => u.slice(0, rows).map(x => (x < 0.5 ? 0 : 1)),
    // Fisher–Yates over the cells, the first m are the mines
    minesSet(cells, m, u) {
      const c = Array.from({ length: cells }, (_, i) => i);
      for (let i = cells - 1, k = 0; i > 0; i--, k++) { const j = Math.floor(u[k] * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
      return c.slice(0, m).sort((a, b) => a - b);
    },
    contractMult: (mults, u) => pick(mults, u),
    // P(point ≥ x) = RTP / x
    crashPoint: (cr, u) => Math.min(cr.MAX, Math.max(1, Math.floor((cr.RTP / Math.max(1e-9, 1 - u)) * 100) / 100)),
    wheelSeg: (segs, u) => Math.floor(u * segs)
  };
})();
