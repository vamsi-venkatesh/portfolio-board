// Frame-exact film of the v4 homepage (board hero → three flights → playground = frame 08) (immune to machine load): a virtual clock inside the page drives timers,
// requestAnimationFrame, performance.now and every CSS transition; the product loops are swapped for their own
// frames (extracted once with ffmpeg); one screenshot per frame at exactly 30 fps → H.264.
import { chromium } from '.';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PAGE = 'http://127.0.0.1:4497/13-board/', ROOT = '../13-board';
const S = '/private/tmp/claude-501/-Users-vamsiv-vvdex-vault/d2822e25-8cee-41f0-9e24-47d3bd5732db/scratchpad';
const VF = `${S}/vf`, OUTF = `${S}/vtframes`, FPS = 30;
const slugs = ['vvdex-platform', 'conxto', 'vvdex-engine', 'unboundpdf', 'conxfolio', 'forecasting', 'vvdex-trading'];
const counts = {};
for (const s of slugs) {
  const d = `${VF}/${s}`;
  if (!fs.existsSync(d)) { fs.mkdirSync(d, { recursive: true }); execFileSync('/opt/homebrew/bin/ffmpeg', ['-v', 'error', '-y', '-i', `${ROOT}/media/${s}.mp4`, '-vf', 'fps=30,scale=1040:-2', '-q:v', '3', `${d}/%04d.jpg`]); }
  counts[s] = fs.readdirSync(d).length;
}
fs.rmSync(OUTF, { recursive: true, force: true }); fs.mkdirSync(OUTF, { recursive: true });

const b = await chromium.launch({ channel: 'chrome', args: ['--hide-scrollbars'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
await ctx.route('**/_vf/**', r => r.fulfill({ path: path.join(VF, new URL(r.request().url()).pathname.replace(/^.*\/_vf\//, '')), contentType: 'image/jpeg' }));
await ctx.addInitScript(() => {
  let vt = 0; const T0 = Date.now(); const timers = new Map(); let tid = 1, rq = [], rid = 1; const seen = new WeakMap();
  performance.now = () => vt; Date.now = () => T0 + vt;
  window.setTimeout = (cb, d = 0, ...a) => { const id = tid++; timers.set(id, { at: vt + Math.max(0, +d || 0), cb, a }); return id; };
  window.clearTimeout = id => { timers.delete(id); };
  window.requestAnimationFrame = cb => { const id = rid++; rq.push([id, cb]); return id; };
  window.cancelAnimationFrame = id => { rq = rq.filter(x => x[0] !== id); };
  HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  window.__vt = {
    advance(to) {
      for (;;) {
        let best = null; for (const e of timers) if (e[1].at <= to && (!best || e[1].at < best[1].at)) best = e;
        if (!best) break; timers.delete(best[0]); vt = best[1].at;
        try { if (typeof best[1].cb === 'function') best[1].cb(...best[1].a); } catch (e) { console.error(e); }
      }
      vt = to; const q = rq; rq = []; for (const [, cb] of q) { try { cb(vt); } catch (e) { console.error(e); } }
      for (const an of document.getAnimations()) { if (!seen.has(an)) seen.set(an, vt); an.pause(); an.currentTime = Math.max(0, vt - seen.get(an)); }
    },
  };
  addEventListener('DOMContentLoaded', () => { const c = document.createElement('div'); c.style.cssText = 'position:fixed;z-index:99999;left:0;top:0;width:24px;height:24px;pointer-events:none;translate:-100px -100px'; const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('width', '24'); s.setAttribute('height', '24'); s.setAttribute('viewBox', '0 0 22 22'); const pth = document.createElementNS('http://www.w3.org/2000/svg', 'path'); pth.setAttribute('d', 'M3 2l15 8-6.5 1.8L8.6 18z'); pth.setAttribute('fill', '#161513'); pth.setAttribute('stroke', '#fff'); pth.setAttribute('stroke-width', '1.4'); s.appendChild(pth); c.appendChild(s); document.body.appendChild(c); addEventListener('pointermove', e => { c.style.translate = `${e.clientX - 3}px ${e.clientY - 2}px`; }, { capture: true, passive: true }); });
});
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(PAGE, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready.then(() => true));
await p.evaluate(() => { for (const v of document.querySelectorAll('.bw video')) { v.pause(); const slug = (v.dataset.src || v.getAttribute('src')).split('/').pop().replace('.mp4', ''); const img = document.createElement('img'); img.className = 'vtf'; img.dataset.slug = slug; img.alt = ''; img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top'; v.style.visibility = 'hidden'; v.parentNode.appendChild(img); } });

await p.waitForFunction(() => !!window.__board, null, { timeout: 15000 });
const st = await p.evaluate(() => ({ s: [0, 1, 2].map(i => window.__board.stopY(i)), h: [0, 1].map(i => window.__board.holdEndY(i)) }));
const ease = x => -(Math.cos(Math.PI * Math.min(1, Math.max(0, x))) - 1) / 2;
const seg = (t, a, b2) => (t - a) / (b2 - a);
const lerp2 = (A, B, k) => [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k];
const HOME = [1880, 1040], END = 19.6, TAPS = [16.0, 16.8, 17.6], marks = [];
let hoverTarget = null, buildY = null, notes = null, lastY = -1, lastM = '';
// scroll: fly into 01, 02, 03 (each flight scrolled evenly; inside a hold the camera does not move), then the page goes to the playground
const scrollAt = t => t < 4.4 ? 0 : t < 6.5 ? st.s[0] * ease(seg(t, 4.4, 6.5)) : t < 8.0 ? st.s[0]
  : t < 9.8 ? st.h[0] + (st.s[1] - st.h[0]) * ease(seg(t, 8.0, 9.8)) : t < 11.3 ? st.s[1]
  : t < 13.1 ? st.h[1] + (st.s[2] - st.h[1]) * ease(seg(t, 11.3, 13.1)) : t < 14.6 ? st.s[2] : buildY;
for (let f = 0; f <= Math.round(END * FPS); f++) {
  const t = f / FPS;
  if (t >= 2.4 && !hoverTarget) { const bb = await (await p.$('.bw-yours .yours')).boundingBox(); hoverTarget = [bb.x + bb.width * 0.5, bb.y + bb.height * 0.5]; }
  if (t >= 14.6 && buildY === null) buildY = await p.evaluate(() => Math.round(document.querySelector('#build').getBoundingClientRect().top + scrollY - 40));
  const y = Math.round(scrollAt(t));
  if (y !== lastY) { await p.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y); lastY = y; }
  let m = HOME;
  if (hoverTarget && t < 4.4) m = lerp2(HOME, hoverTarget, t < 3.3 ? ease(seg(t, 2.4, 3.3)) : t < 3.9 ? 1 : 1 - ease(seg(t, 3.9, 4.4)));
  if (t >= 15.2 && !notes) notes = await p.evaluate(() => [['idea', 0], ['when', 1], ['budget', 1]].map(([g, k]) => { const r = document.querySelectorAll(`.pnote[data-g="${g}"]`)[k].getBoundingClientRect(); return [r.x + r.width * 0.5, r.y + r.height * 0.5]; }));
  if (notes) {
    const legs = [[15.2, 16.0, HOME, notes[0]], [16.15, 16.8, notes[0], notes[1]], [16.95, 17.6, notes[1], notes[2]]];
    m = notes[2];
    for (const [a1, b1, from, to2] of legs) { if (t < a1) { m = from; break; } if (t < b1) { m = lerp2(from, to2, ease(seg(t, a1, b1))); break; } }
  }
  const mk = m.map(v => v.toFixed(1)).join(',');
  if (mk !== lastM) { await p.mouse.move(m[0], m[1]); lastM = mk; }
  if (TAPS.some(x => Math.abs(t - x) < 0.5 / FPS)) { await p.mouse.down(); await p.mouse.up(); }
  await p.evaluate(ms => window.__vt.advance(ms), t * 1000);
  await p.evaluate(async ({ t, counts }) => {
    await Promise.all([...document.querySelectorAll('img.vtf')].map(async im => {
      const n = counts[im.dataset.slug], k = (Math.floor(t * 30) % n) + 1;
      const src = `/_vf/${im.dataset.slug}/${String(k).padStart(4, '0')}.jpg`;
      if (im.getAttribute('src') !== src) { im.src = src; try { await im.decode(); } catch (e) {} }
    }));
  }, { t, counts });
  await p.screenshot({ path: `${OUTF}/${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 });
  if ([7.9, 11.2, 14.5].some(x => Math.abs(t - x) < 0.5 / FPS)) marks.push({ t: +t.toFixed(2), ...(await p.evaluate(() => { const on = document.querySelector('.bp.on'); return { name: on && on.querySelector('.sc-name').textContent, nums: on ? [...on.querySelectorAll('[data-count]')].map(e => e.textContent) : [] }; })) });
  if (Math.abs(t - 19.5) < 0.5 / FPS) marks.push({ t: 19.5, subject: await p.evaluate(() => document.querySelector('#d-subj').textContent), body: await p.evaluate(() => document.querySelector('#d-body').textContent) });
}
await b.close();
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${OUTF}/%05d.jpg`, '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-movflags', '+faststart', '-an', `${ROOT}/preview-v4.mp4`]);
fs.writeFileSync(`${ROOT}/verify4/film-marks.json`, JSON.stringify({ marks, errs }, null, 1));
console.log('frames', fs.readdirSync(OUTF).length, 'errors', errs.length ? errs.slice(0, 5) : 'none');
console.log(JSON.stringify(marks));
