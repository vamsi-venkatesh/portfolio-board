// Mobile audit in WebKit (the engine iPhone Safari uses): iPhone 13 + iPhone SE. Full-page screenshots, overflow,
// errors, loops really playing, tap targets under 44 px, text under 4.5:1 contrast (3:1 for large text).
import { webkit, devices } from '.';
import fs from 'node:fs';
const OUT = process.env.OUT || '../13-board/verify-mobile';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:4497/13-board/';
const PAGES = [['home', ''], ['work', 'work/'], ['conxto', 'work/conxto/'], ['unboundpdf', 'work/unboundpdf/']];
const b = await webkit.launch();
const report = {};

const audit = () => {
  const vis = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const sel = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '');
  // tap targets (inline links inside running text are exempt)
  const small = [];
  for (const el of document.querySelectorAll('a[href], button, input, textarea, select, summary')) {
    if (!vis(el)) continue;
    if (el.tagName === 'A' && el.closest('p, li p, dd') && getComputedStyle(el).display === 'inline') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) small.push(`${sel(el)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 28)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  // contrast of visible text
  const rgb = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const bgOf = el => { const stack = []; for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } }
    let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) base = blend(stack[i], base); return base; };
  const fails = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.textContent.trim()) continue; const el = t.parentElement; if (!el || !vis(el) || el.closest('.sr, [aria-hidden="true"] .sr')) continue;
    const cs = getComputedStyle(el); const fg = rgb(cs.color); if (!fg) continue;
    const bg = bgOf(el), c = blend(fg, bg), L1 = lum(c), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = px >= 24 || (bold && px >= 18.66);
    if (ratio < (large ? 3 : 4.5)) { const k = `${cs.color} on ${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)} · ${px}px`; const e = fails.get(k) || { ratio: +ratio.toFixed(2), n: 0, eg: [] }; e.n++; if (e.eg.length < 3) e.eg.push(`${sel(el)} "${t.textContent.trim().slice(0, 24)}"`); fails.set(k, e); }
  }
  return { overflow: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight, smallTargets: small, contrast: [...fails].map(([k, v]) => ({ k, ...v })) };
};

for (const [dname, dev] of [['iphone13', devices['iPhone 13']], ['iphone12mini', devices['iPhone 12 Mini']], ['iphoneSE', devices['iPhone SE']]]) {
  const ctx = await b.newContext({ ...dev });
  for (const [name, path] of PAGES) {
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errs.push(m.text()); });
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await p.goto(BASE + path, { waitUntil: 'load' }); await p.waitForTimeout(1800);
    // scroll through once so lazy loops and reveals run, then measure
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += 500) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(120); }
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(600);
    let playing = null;
    if (name === 'home') {
      await p.evaluate(() => document.querySelector('.bp video, .bw video')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(1500);
      const t1 = await p.evaluate(() => { const v = [...document.querySelectorAll('video')].find(v => { const r = v.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }); return v ? v.currentTime : null; });
      await p.waitForTimeout(1200);
      playing = await p.evaluate(t1 => { const v = [...document.querySelectorAll('video')].find(v => { const r = v.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }); return v ? { src: (v.currentSrc || '').split('/').pop(), paused: v.paused, advanced: t1 !== null && v.currentTime > t1, error: v.error && v.error.code } : 'no video fully in view'; }, t1);
      await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
    }
    const a = await p.evaluate(audit);
    await p.screenshot({ path: `${OUT}/${dname}-${name}.png`, fullPage: true });
    report[`${dname} ${name}`] = { errs, playing, ...a };
    await p.close();
  }
  await ctx.close();
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
for (const [k, v] of Object.entries(report)) {
  console.log(`\n## ${k}: overflow ${v.overflow}px · height ${v.height}px · errors ${v.errs.length}${v.errs.length ? ' ' + JSON.stringify(v.errs.slice(0, 3)) : ''}${v.playing ? ' · video ' + JSON.stringify(v.playing) : ''}`);
  console.log(`   small targets (${v.smallTargets.length}): ${v.smallTargets.slice(0, 12).join(' | ')}`);
  console.log(`   contrast fails (${v.contrast.length}): ${v.contrast.slice(0, 8).map(c => `${c.ratio}:1 ×${c.n} [${c.k}] e.g. ${c.eg[0]}`).join(' | ')}`);
}
await b.close();
