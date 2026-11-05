// Builds sample-board/index.html — "All seven live on one board" (hero sample, 2026-11-05).
// The hero is the board zoomed out; scrolling flies one camera into each product frame; copy appears only up close.
// Copy, numbers and frames are lifted from the built homepage (index.html), so nothing is retyped.
import fs from 'node:fs';

const ROOT = '../13-board';
const src = fs.readFileSync(`${ROOT}/index.html`, 'utf8');
const pick = (re, what) => { const m = src.match(re); if (!m) throw new Error('not found: ' + what); return m; };
const fix = s => s
  .replace(/(href|src|poster|data-src)="(work|media|assets|impressum|data)\//g, '$1="../$2/')
  .replace(/href="\.\/"/g, 'href="../"');

const head = pick(/<head>[\s\S]*?<\/head>/, 'head')[0]
  .replace('href="assets/site.css">', 'href="../assets/site.css">\n<link rel="stylesheet" href="board.css">')
  .replace(/<title>[^<]*<\/title>/, '<title>Vamsi Venkatesh — board sample</title>');
const header = fix(pick(/<header class="top">[\s\S]*?<\/header>/, 'header')[0]);
const develop = fix(pick(/<div class="develop">[\s\S]*?<div class="ctas">[\s\S]*?<\/div>\s*<\/div>/, 'hero copy')[0]);
const clients = fix(pick(/<section class="sec" id="clients"[\s\S]*?<\/section>/, 'clients')[0])
  .replace(/preload="none"/g, 'preload="metadata" autoplay')
  .replace(/data-src="/g, 'src="');

const items = [...src.matchAll(/<article class="sc-item" data-i="(\d)" style="--tint:([^"]*)" aria-label="([^"]*)">([\s\S]*?)<\/article>/g)]
  .map(m => {
    const body = m[4];
    const text = body.match(/<div class="sc-text">([\s\S]*?)<\/div>\s*<a class="sc-media/);
    const frame = body.match(/<div class="frame">[\s\S]*?<\/video><\/div><\/div><\/div>/);
    if (!text || !frame) throw new Error('item parse failed: ' + m[3]);
    return {
      i: +m[1], tint: m[2], name: m[3], live: /status live/.test(body),
      text: fix(text[1]),
      frame: fix(frame[0]).replace('preload="none"', 'preload="auto" autoplay').replace('data-src="', 'src="'),
    };
  });
if (items.length !== 7) throw new Error('expected 7 products, got ' + items.length);

// Board layout in world pixels: [x, y, width]. Varied sizes, no grid; the camera route runs 1 → 7.
// Compact (2480 x 2100) so the overview frames are large; the route is an S: top row, middle row back, bottom row.
const L = [
  [0, 50, 1080],     // 01 VVDex Platform
  [1180, 0, 900],    // 02 Conxto
  [1300, 700, 1000], // 03 VVDex Engine
  [120, 860, 900],   // 04 UnboundPDF
  [0, 1560, 740],    // 05 Conxfolio
  [840, 1560, 760],  // 06 Forecasting
  [1700, 1460, 780], // 07 VVDex Trading
];
const pad2 = n => String(n).padStart(2, '0');

const wins = items.map((it, i) => {
  const [x, y, w] = L[i];
  return `      <figure class="bw pre" data-i="${i}" data-x="${x}" data-y="${y}" data-w="${w}" style="--x:${x};--y:${y};--w:${w};--tint:${it.tint}">
        <div class="bw-in">
          <div class="bw-tag"><b>${pad2(i + 1)}</b>${it.name}<i class="dot${it.live ? ' live' : ''}" aria-hidden="true"></i></div>
          ${it.frame}
          <div class="bw-sel" aria-hidden="true"><i></i><i></i><i></i><i></i><span class="bw-dim">1440 × 900</span></div>
        </div>
      </figure>`;
}).join('\n');

const panels = items.map((it, i) => `      <div class="bp" data-i="${i}"><div class="sc-text">${it.text}</div></div>`).join('\n');
const rail = items.map((it, i) => `<button type="button" aria-label="Fly to ${it.name}"></button>`).join('');

const html = `<!doctype html>
<html lang="en">
${head}
<body data-page="home">
<a class="skip" href="#main">Skip to content</a>
${header}
<main id="main">
<section class="bd" id="work" aria-label="Introduction and products">
  <div class="bd-stage">
    <div class="bd-world">
${wins}
    </div>
    <div class="bd-edges" aria-hidden="true"></div>
    <div class="bd-scrim" aria-hidden="true"></div>
    <div class="bd-intro"><div class="wrap"><div class="bd-copy">
      ${develop}
    </div></div></div>
    <div class="bd-panels"><div class="wrap">
${panels}
    </div></div>
    <div class="bd-foot"><div class="wrap">
      <div class="bd-rail"><span class="ct mono">— / 07</span>${rail}</div>
      <span class="bd-hint mono">scroll to fly in · click a frame</span>
    </div></div>
  </div>
</section>
${clients}
<div style="height:24vh"></div>
</main>
<script src="board.js"></script>
</body>
</html>
`;

fs.mkdirSync(`${ROOT}/sample-board`, { recursive: true });
fs.writeFileSync(`${ROOT}/sample-board/index.html`, html);
console.log('sample-board/index.html', html.length, 'bytes;', items.map(it => it.name + (it.live ? '' : ' (research)')).join(', '));
