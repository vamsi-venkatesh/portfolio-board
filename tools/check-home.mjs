// v4 homepage check (the board): desktop 1920 + 1440, dark mode, reduced motion, iPhone 13, plus every other page.
// Console errors, horizontal overflow, loops playing, the numbers at each stop, frame 08 → playground, the playground
// draft, keys 1–9, ⌘K. Runs the installed Google Chrome (plays the H.264 loops). Stills go to verify4/.
import { chromium, devices } from '.';
import fs from 'node:fs';
const OUT = '../13-board/verify4';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:4497/13-board/';
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'] });
const report = {};
const watch = p => { const errs = []; p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); }); p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errs.push(r.status() + ' ' + r.url()); }); return errs; };
const shot = (p, f) => p.screenshot({ path: `${OUT}/${f}.jpg`, quality: 80 });
const to = (p, y) => p.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y);
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const panel = p => p.evaluate(() => { const on = document.querySelector('.bp.on'); return on && { name: on.querySelector('.sc-name').textContent, nums: [...on.querySelectorAll('[data-count]')].map(e => e.textContent) }; });

for (const [name, opt] of [['d1920', { viewport: { width: 1920, height: 1080 } }], ['d1440', { viewport: { width: 1440, height: 900 } }]]) {
  const ctx = await b.newContext(opt); const p = await ctx.newPage(); const errs = watch(p);
  await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(3000);
  await shot(p, `${name}-0-overview`);
  const t1 = await p.evaluate(() => [...document.querySelectorAll('.bw video')].map(v => v.currentTime)); await p.waitForTimeout(1000);
  const playing = await p.evaluate(t1 => [...document.querySelectorAll('.bw video')].map((v, i) => !v.paused && v.currentTime > t1[i]), t1);
  const stops = [];
  for (const i of [0, 1, 3, 6]) { await to(p, await p.evaluate(i => window.__board.stopY(i), i)); await p.waitForTimeout(1900); await shot(p, `${name}-stop${i}`); stops.push(await panel(p)); }
  const y0 = await p.evaluate(() => window.__board.stopY(0)), y1 = await p.evaluate(() => window.__board.holdEndY(0)), y2 = await p.evaluate(() => window.__board.stopY(1));
  await to(p, y0); await p.waitForTimeout(1200); await to(p, y1); await p.waitForTimeout(900); await to(p, y1 + (y2 - y1) * 0.45); await p.waitForTimeout(260); await shot(p, `${name}-mid01`);
  // frame 08 → the playground
  await to(p, 0); await p.waitForTimeout(1600);
  const yb = await (await p.$('.bw-yours .yours')).boundingBox();
  await p.mouse.click(yb.x + yb.width / 2, yb.y + yb.height / 2); await p.waitForTimeout(1800);
  const buildTop = await p.evaluate(() => Math.round(document.querySelector('#build').getBoundingClientRect().top));
  await p.click('.pnote[data-g="idea"]'); await p.waitForTimeout(400);
  const subj = await p.evaluate(() => document.querySelector('#d-subj').textContent);
  await shot(p, `${name}-playground`);
  const ov = await overflow(p);
  // keys and command bar
  await to(p, 0); await p.waitForTimeout(600);
  await p.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k'); await p.waitForTimeout(300);
  const cmdk = await p.evaluate(() => !document.querySelector('#cmdk').hidden); await p.keyboard.press('Escape');
  await p.keyboard.press('1'); await p.waitForTimeout(1500);
  const key1 = p.url().replace(BASE, '');
  report[name] = { errs, playing, stops, frame08_buildTop: buildTop, draftSubject: subj, overflow: ov, cmdk, key1 };
  await ctx.close();
}
{ // dark mode
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.addInitScript(() => { try { localStorage.setItem('vv-theme', 'dark'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = watch(p);
  await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(3000); await shot(p, 'dark-overview');
  await to(p, await p.evaluate(() => window.__board.stopY(2))); await p.waitForTimeout(1900); await shot(p, 'dark-stop2');
  report.dark = { errs, theme: await p.evaluate(() => document.documentElement.dataset.theme), grid: await p.evaluate(() => getComputedStyle(document.querySelector('.bd-stage')).backgroundImage.slice(0, 60)) };
  await ctx.close();
}
{ // reduced motion: no camera
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); const errs = watch(p);
  await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1500); await shot(p, 'rm-top');
  report.reducedMotion = { errs, flat: await p.evaluate(() => window.__board.flat), overflow: await overflow(p) };
  await ctx.close();
}
{ // iPhone 13
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage(); const errs = watch(p);
  await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1500); await shot(p, 'm-top');
  await p.evaluate(() => document.querySelector('.bp').scrollIntoView()); await p.waitForTimeout(800); await shot(p, 'm-first');
  report.iphone13 = { errs, flat: await p.evaluate(() => window.__board.flat), overflow: await overflow(p) };
  await ctx.close();
}
{ // every other page
  const pages = ['work/', ...JSON.parse(fs.readFileSync('../13-board/content.json', 'utf8')).products.map(p => `work/${p.slug}/`),
    ...(JSON.parse(fs.readFileSync('../13-board/content.json', 'utf8')).clients || []).map(p => `work/${p.slug}/`)];
  report.pages = {};
  for (const [name, opt] of [['d1440', { viewport: { width: 1440, height: 900 } }], ['iphone13', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opt);
    for (const pg of pages) { const p = await ctx.newPage(); const errs = watch(p); const r = await p.goto(BASE + pg, { waitUntil: 'load' }); await p.waitForTimeout(500);
      report.pages[`${name} ${pg}`] = { status: r.status(), errs: errs.length, overflow: await overflow(p) }; await p.close(); }
    await ctx.close();
  }
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
const bad = Object.entries(report.pages).filter(([, v]) => v.status !== 200 || v.errs || v.overflow > 0);
console.log(JSON.stringify({ ...report, pages: `${Object.keys(report.pages).length} page loads, ${bad.length} with a problem${bad.length ? ': ' + JSON.stringify(bad) : ''}` }, null, 1));
await b.close();
