// Checks the board sample: stills at the overview, close-ups, mid-flight and after the board; console errors;
// horizontal overflow; whether every loop is really playing. Runs the installed Google Chrome (H.264).
import { chromium, devices } from '.';
import fs from 'node:fs';
const OUT = '../13-board/verify-board';
fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://127.0.0.1:4497/13-board/sample-board/';
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'] });
const report = {};
const vidState = p => p.evaluate(() => [...document.querySelectorAll('.bw video')].map(v => ({ rs: v.readyState, t: +v.currentTime.toFixed(2), paused: v.paused, err: v.error && v.error.code })));
const shot = (p, f) => p.screenshot({ path: `${OUT}/${f}.jpg`, quality: 82 });
const to = (p, y) => p.evaluate(y => scrollTo(0, y), y);

for (const [name, opt] of [['d1920', { viewport: { width: 1920, height: 1080 } }], ['d1440', { viewport: { width: 1440, height: 900 } }]]) {
  const ctx = await b.newContext(opt); const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(2600);
  await shot(p, `${name}-0-overview`);
  const v1 = await vidState(p); await p.waitForTimeout(1000); const v2 = await vidState(p);
  const playing = v2.map((v, i) => v.t > v1[i].t && !v.paused);
  const stops = [];
  for (const i of [0, 1, 3, 6]) {
    await to(p, await p.evaluate(i => window.__board.stopY(i), i)); await p.waitForTimeout(1800);
    await shot(p, `${name}-stop${i}`);
    stops.push(await p.evaluate(() => { const on = document.querySelector('.bp.on'); return on && { name: on.querySelector('.sc-name').textContent, nums: [...on.querySelectorAll('[data-count]')].map(e => e.textContent) }; }));
  }
  const y0 = await p.evaluate(() => window.__board.stopY(0)), y1 = await p.evaluate(() => window.__board.stopY(1));
  await to(p, y0); await p.waitForTimeout(300); await to(p, y0 + (y1 - y0) * 0.5); await p.waitForTimeout(500);
  await shot(p, `${name}-mid01`);
  const yEnd = await p.evaluate(() => { const s = document.querySelector('.bd'); return s.offsetTop + s.offsetHeight - 120; });
  await to(p, yEnd); await p.waitForTimeout(1300); await shot(p, `${name}-after`);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  report[name] = { errs, playing, firstVideo: v2[0], stops, overflow };
  await ctx.close();
}
{
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await shot(p, 'm-0-top');
  await to(p, 900); await p.waitForTimeout(700); await shot(p, 'm-1-first');
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  report.iphone13 = { errs, overflow, flat: await p.evaluate(() => window.__board.flat) };
  await ctx.close();
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await b.close();
