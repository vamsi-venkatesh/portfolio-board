// ~12.5 s sample film of "All seven live on one board": load (frames drop in, copy develops) → hover a frame →
// scroll flies the camera into 01, 02, 03. Real-time CDP screencast in Google Chrome (plays the H.264 loops) → H.264.
import { chromium } from '.';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const URL = 'http://127.0.0.1:4497/13-board/sample-board/', ROOT = '../13-board';
const TMP = '/private/tmp/claude-501/-Users-vamsiv-vvdex-vault/d2822e25-8cee-41f0-9e24-47d3bd5732db/scratchpad/filmboard';
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
// a drawn cursor that follows the real pointer events
await ctx.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const c = document.createElement('div'); c.style.cssText = 'position:fixed;z-index:99999;left:0;top:0;width:24px;height:24px;pointer-events:none;translate:-100px -100px'; const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('width', '24'); s.setAttribute('height', '24'); s.setAttribute('viewBox', '0 0 22 22'); const pth = document.createElementNS('http://www.w3.org/2000/svg', 'path'); pth.setAttribute('d', 'M3 2l15 8-6.5 1.8L8.6 18z'); pth.setAttribute('fill', '#161513'); pth.setAttribute('stroke', '#fff'); pth.setAttribute('stroke-width', '1.4'); s.appendChild(pth); c.appendChild(s); document.body.appendChild(c); addEventListener('pointermove', e => { c.style.translate = `${e.clientX - 3}px ${e.clientY - 2}px`; }, { capture: true, passive: true }); }); });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p); const frames = []; const marks = [];
cdp.on('Page.screencastFrame', async f => { const n = frames.length; fs.writeFileSync(`${TMP}/${String(n).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64')); frames.push(f.metadata.timestamp); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
const start = () => cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
// gentle sine glide: the page's own camera easing and damper shape the flight
const glide = (to, ms) => p.evaluate(([to, ms]) => new Promise(r => { const y0 = scrollY, t0 = performance.now(); const e = x => -(Math.cos(Math.PI * x) - 1) / 2; const f = n => { const k = Math.min(1, (n - t0) / ms); scrollTo({ top: y0 + (to - y0) * e(k), behavior: 'instant' }); k < 1 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }), [to, ms]);
const now = () => frames.length ? +(frames[frames.length - 1] - frames[0]).toFixed(2) : 0;

await p.goto('data:text/html,<body style="margin:0;background:%23f4f1ea"></body>'); await start(); // paper, not a white flash
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.mouse.move(1880, 1040);
await p.waitForTimeout(2200);
const bx = await (await p.$('.bw[data-i="1"] .frame')).boundingBox();
await p.mouse.move(bx.x + bx.width * 0.5, bx.y + bx.height * 0.55, { steps: 26 }); await p.waitForTimeout(650);
await p.mouse.move(1880, 1040, { steps: 16 });
for (const i of [0, 1, 2]) {
  // inside a hold the camera does not move, so the film skips straight to the hold's end, then scrolls the flight evenly
  if (i > 0) { await p.evaluate(y => scrollTo(0, y), await p.evaluate(i => window.__board.holdEndY(i - 1), i)); await p.waitForTimeout(120); }
  const y = await p.evaluate(i => window.__board.stopY(i), i);
  await glide(y, i === 0 ? 2000 : 1600); await p.waitForTimeout(1500);
  marks.push({ t: now(), ...(await p.evaluate(() => {
    const on = document.querySelector('.bp.on');
    return { name: on && on.querySelector('.sc-name').textContent, nums: on ? [...on.querySelectorAll('[data-count]')].map(e => e.textContent) : [],
      playing: [...document.querySelectorAll('.bw video')].filter(v => !v.paused && v.readyState >= 3).length };
  })) });
}
await cdp.send('Page.stopScreencast'); await b.close();

let list = '';
for (let i = 0; i < frames.length; i++) { const d = i < frames.length - 1 ? Math.max(0.001, frames[i + 1] - frames[i]) : 0.04; list += `file '${TMP}/${String(i).padStart(5, '0')}.jpg'\nduration ${d.toFixed(4)}\n`; }
fs.writeFileSync(`${TMP}/list.txt`, list);
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${TMP}/list.txt`, '-vf',
  'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xf4f1ea,fps=30,scale=in_range=pc:out_range=tv,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', '-an', `${ROOT}/sample-board/board-sample.mp4`]);
fs.mkdirSync(`${ROOT}/verify-board`, { recursive: true });
fs.writeFileSync(`${ROOT}/verify-board/film-marks.json`, JSON.stringify(marks, null, 1));
console.log('frames', frames.length, 'span', now(), 's');
console.log(JSON.stringify(marks));
