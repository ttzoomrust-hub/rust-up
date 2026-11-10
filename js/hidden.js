// Games hidden from the site (owner's decision 2026-11-11: only the upgrade and the cases stay).
// The servers still know them; here they are only taken out of the home page, routes, «Удача дня» and the quest list.
window.RUSTUP_HIDDEN = new Set(['crash', 'mines', 'wheel', 'plinko', 'contract', 'battle']);
window.RUSTUP_HIDDEN_ROUTE = path => ['/crash', '/mines', '/wheel', '/plinko', '/contract', '/battles'].includes(path) || path.startsWith('/battle/');
