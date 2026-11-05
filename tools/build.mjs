// Static site builder. Facts come ONLY from portfolio-inside/src/content/site.mjs, the UnboundPDF tools.json,
// data/heatmap-days (git log), and data/status.json (HTTP check). Output: content.json, index.html, work/<slug>/index.html.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const ROOT = '../13-board';
const site = await import('.');
const tools = JSON.parse(fs.readFileSync('../11-light/glass/gallery/tools.json', 'utf8'));
const status = JSON.parse(fs.readFileSync(`${ROOT}/data/status.json`, 'utf8'));
const heat = JSON.parse(fs.readFileSync(`${ROOT}/data/heatmap.json`, 'utf8'));
const P = site.person, products = site.products;
const RECORDED = { 'vvdex-platform': ['https://vvdexops.com/'], 'vvdex-engine': ['https://lab.vvdexops.com/'], unboundpdf: ['https://unboundpdf.com/', 'https://unboundpdf.com/tools/merge-pdf/'], conxfolio: ['https://conxfolio.com/'], farmquick: ['https://farmquick.in/'], conxto: ['https://conxto.com/'], 'vvdex-trading': ['https://trading.vvdexops.com/'] };
const WITHDRAWN = { 'vvdex-trading': 0, 'vvdex-platform': 1 };
const RECORD_DATE = '5 Nov 2026';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = s => { const m = String(s).replace(/,/g, '').match(/^\d+$/); return m ? +m[0] : null; };
const pad2 = n => String(n).padStart(2, '0');
const isLive = p => p.status === 'Live';
const tint = p => `color-mix(in srgb, ${p.color} 30%, #f4f1ea)`;

fs.writeFileSync(`${ROOT}/content.json`, JSON.stringify({ person: P, about: site.about, principles: site.principles, withdrawn: site.withdrawn, products, unboundpdf_tools: tools, status, heatmap: heat, recorded: RECORDED }, null, 1));

// ---------- shared bits ----------
const head = (title, desc, base) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#f4f1ea">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="${base}assets/site.css">
<script>document.documentElement.classList.add('js')</script>
</head>`;

const icon = {
  arrow: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 9 9 3M4 3h5v5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x=".5" y=".5" width="17" height="17" rx="5" fill="none" stroke="#e5481c"/><path d="m5 9.2 2.6 2.6L13 6.4" fill="none" stroke="#e5481c" stroke-width="1.6"/></svg>',
};

const header = (base, keysHint) => `<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap">
  <a class="brand" href="${base || './'}" aria-label="Vamsi Venkatesh, home"><span class="mark" aria-hidden="true">VV</span><span>Vamsi Venkatesh</span><small>/ AI product engineer</small></a>
  <div class="keys" aria-hidden="true">${keysHint}</div>
  <nav aria-label="Contact">
    <a class="txt hide-m" href="mailto:${P.email}">Email</a>
    <a class="txt hide-m" href="${P.linkedin}" rel="noopener">LinkedIn</a>
    <a class="txt" href="${P.github}" rel="noopener">GitHub</a>
    <a class="pill sm" href="${base}#contact">Contact</a>
  </nav>
</div></header>`;

const footer = base => `<footer class="foot"><div class="wrap">
  <span>© 2026 Vamsi Venkatesh · Magdeburg, Germany</span>
  <span><a href="mailto:${P.email}">${P.email}</a> · <a href="${P.linkedin}" rel="noopener">LinkedIn</a> · <a href="${P.github}" rel="noopener">GitHub</a></span>
</div></footer>
<script src="${base}assets/site.js" defer></script>
</body></html>`;

const chrome = (p, small) => `<div class="chrome" aria-hidden="true"><span class="tl"><i></i><i></i><i></i></span><span class="host">${p.url ? '🔒 ' : ''}${esc(p.url ? p.host : 'private client system')}</span>${isLive(p) ? '<span class="st status live"><i class="dot live"></i>Live</span>' : `<span class="st status other">${esc(p.status)}</span>`}</div>`;
const statusTag = p => isLive(p) ? '<span class="status live"><i class="dot live"></i>Live</span>' : `<span class="status other"><i class="dot"></i>${esc(p.status)}</span>`;
const video = (p, base, cls = '', id = '') => `<video${id ? ` id="${id}"` : ''} class="${cls}" muted loop playsinline preload="none" poster="${base}media/${p.slug}.jpg" data-src="${base}media/${p.slug}.mp4" aria-label="${esc(p.name)}: ${RECORDED[p.slug] ? 'screen recording of the public site' : 'real product screens'}"></video>`;

// ---------- heatmap ----------
function heatmapHTML() {
  const today = new Date(heat.until + 'T00:00:00Z');
  const dow = (today.getUTCDay() + 6) % 7; // Monday=0
  const start = new Date(today); start.setUTCDate(today.getUTCDate() - dow - 25 * 7);
  const iso = d => d.toISOString().slice(0, 10);
  const cells = []; let total = 0, active = 0;
  const vals = [];
  for (let k = 0; k < 26 * 7; k++) {
    const d = new Date(start); d.setUTCDate(start.getUTCDate() + k);
    const key = iso(d), n = d > today ? null : (heat.days[key] || 0);
    cells.push({ d, key, n }); if (n) { total += n; active++; vals.push(n); }
  }
  vals.sort((a, b) => a - b);
  const q = f => vals[Math.floor((vals.length - 1) * f)];
  const t1 = q(.25), t2 = q(.5), t3 = q(.75);
  const lvl = n => !n ? 0 : n <= t1 ? 1 : n <= t2 ? 2 : n <= t3 ? 3 : 4;
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtD = d => `${d.getUTCDate()} ${mon[d.getUTCMonth()]}`;
  const months = []; let lastM = -1;
  for (let w = 0; w < 26; w++) { const d = cells[w * 7].d; const m = d.getUTCMonth(); months.push(m !== lastM && (w > 0 || d.getUTCDate() <= 7) ? mon[m] : ''); lastM = m; }
  const grid = cells.map(c => c.n === null ? '<i class="pad"></i>' : `<i data-l="${lvl(c.n)}" title="${fmtD(c.d)}: ${c.n} commit${c.n === 1 ? '' : 's'}"></i>`).join('');
  return { total, active, from: fmtD(cells[0].d) + ' 2026', to: fmtD(today) + ' 2026', months, grid, legend: [t1, t2, t3] };
}
const H = heatmapHTML();

// ---------- home ----------
const liveCount = products.filter(isLive).length;
const caseHref = (p, base) => `${base}work/${p.slug}/`;
const routesHome = { cases: products.map(p => `work/${p.slug}/`) };
const fmtN = n => n.toLocaleString('en-US');

const slides = products.map((p, i) => `
      <article class="slide" data-pos="${i === 0 ? 0 : i === 1 ? 1 : i === 2 ? 2 : 'hide'}" data-url="${esc(p.url)}" data-live="${isLive(p) ? 1 : 0}" data-case="work/${p.slug}/" aria-roledescription="slide" aria-label="${i + 1} of ${products.length}: ${esc(p.name)}">
        ${chrome(p)}
        <div class="media">${video(p, '')}</div>
        <div class="slide-body"><div><div class="eyebrow"><b>${pad2(i + 1)}</b>${esc(p.kind)}</div><h3>${esc(p.name)}</h3><p>${esc(p.one)}</p></div><a class="txtlink" href="work/${p.slug}/">Case study →</a></div>
      </article>`).join('');

const cards = products.map((p, i) => `
    <article class="card" data-reveal style="--tint:${tint(p)}">
      <a class="frame-link" href="work/${p.slug}/" data-pill="Case study →" aria-label="${esc(p.name)} case study">
        <div class="frame"><div class="screen">${chrome(p)}<div class="media">${video(p, '')}</div></div></div>
        <span class="sel" aria-hidden="true"><i></i><i></i><i></i><i></i><b>Frame · ${pad2(i + 1)} ${esc(p.slug)}</b></span>
      </a>
      <div class="card-meta"><div><h3><a href="work/${p.slug}/" style="text-decoration:none">${esc(p.name)}</a></h3><p class="one">${esc(p.one)}</p></div><kbd title="Press ${i + 1} to open">${i + 1}</kbd></div>
      <div class="row"><span>${esc(p.kind)}</span>${statusTag(p)}${p.url ? `<a class="cardlink" href="${esc(p.url)}" rel="noopener">${esc(p.host)} ↗</a>` : `<span>${esc(p.host)}</span>`}<a class="go cardlink" style="border:0;color:var(--ink)" href="work/${p.slug}/">Case study <span>→</span></a></div>
    </article>`).join('');

const byName = Object.fromEntries(products.map(p => [p.name, p]));
const prodByUrl = Object.fromEntries(products.filter(p => p.url).map(p => [p.url, p]));
const uptime = status.results.map(r => { const p = prodByUrl[r.url]; const ok = r.code === 200; const live = p && isLive(p);
  return `<li><i class="dot ${ok && live ? 'live' : ''}" aria-hidden="true"></i><a href="${esc(r.url)}" rel="noopener">${esc(new URL(r.url).host)}</a><em>${ok ? 'HTTP 200' : 'HTTP ' + r.code} · ${r.ms} ms${p && !live ? ' · ' + esc(p.status) : ''}</em></li>`; }).join('');

const W = site.withdrawn;
const wdCard = w => `<article class="wd" data-reveal><div class="eyebrow"><b>Withdrawn</b>by me, on the record</div><h4>${esc(w.title)}</h4><div class="nums">${w.numbers.map(([n, l]) => `<div><strong>${esc(n)}</strong><span>${esc(l)}</span></div>`).join('')}</div><p>${esc(w.what)}</p><p style="margin-top:14px"><a class="txtlink" href="${esc(w.link[1])}" rel="noopener">${esc(w.link[0])} ↗</a></p></article>`;

const json = [
  ['name', P.name], ['role', P.role], ['based', P.city],
  ['open_to', P.roles], ['work', 'Remote, or on-site in Germany'], ['visa', 'German residence permit, no sponsorship needed'],
  ['email', P.email, 'mailto:' + P.email], ['linkedin', 'linkedin.com/in/vamsivenkatesh', P.linkedin], ['github', 'github.com/vamsi-venkatesh', P.github],
];
const jsonHTML = `<span class="ln"><span class="p" data-t>{</span></span>` + json.map(([k, v, href], i) => {
  const comma = i < json.length - 1 ? ',' : '';
  let val;
  if (Array.isArray(v)) val = `<span class="p" data-t>[</span>${v.map((x, j) => `<span class="s" data-t>"${esc(x)}"</span>${j < v.length - 1 ? '<span class="p" data-t>, </span>' : ''}`).join('')}<span class="p" data-t>]</span>`;
  else if (href) val = `<a href="${esc(href)}" data-t${href.startsWith('http') ? ' rel="noopener"' : ''}>"${esc(v)}"</a>`;
  else val = `<span class="s" data-t>"${esc(v)}"</span>`;
  return `<span class="ln"><span class="k" data-t>  "${k}"</span><span class="p" data-t>: </span>${val}<span class="p" data-t>${comma}</span></span>`;
}).join('') + `<span class="ln"><span class="p" data-t>}</span></span>`;

const home = `${head('Vamsi Venkatesh — AI product engineer', P.lede, '')}
<body data-page="home">
${header('', '<span>Press</span><kbd>1</kbd><span>–</span><kbd>8</kbd><span>to open a product</span>')}
<main id="main">
<section class="hero" aria-label="Introduction">
  <div class="guides" aria-hidden="true"></div>
  <div class="wrap"><div class="hero-grid">
    <div class="develop">
      <div class="select" data-guide>
        <span class="h"></span><span class="h"></span><span class="h"></span><span class="h"></span>
        <span class="tag" data-scramble="AI PRODUCT ENGINEER" aria-hidden="true">AI PRODUCT ENGINEER</span>
        <h1 class="name"><span class="sr">Vamsi Venkatesh, AI product engineer. </span><span aria-hidden="true">Vamsi<br>Venkatesh</span></h1>
        <span class="dim" aria-hidden="true"></span>
      </div>
      <p class="lede" data-guide>${esc(P.lede).replace('end to end', '<mark>end to end</mark>')}</p>
      <p class="open"><i class="dot accent" aria-hidden="true"></i>Open to work · ${esc(P.city)}</p>
      <div class="stats" data-guide>
        <div class="stat" data-frame="stat / products"><strong data-count="${products.length}">${products.length}</strong><span>products, designed, built and run · ${liveCount} live</span></div>
        <div class="stat" data-frame="stat / unboundpdf"><strong data-count="${tools.length}">${tools.length}</strong><span>tools in UnboundPDF, all in the browser</span></div>
        <div class="stat" data-frame="stat / vvdex-platform"><strong data-count="417">417</strong><span>graded AI attempts, published</span></div>
      </div>
      <div class="ctas"><a class="pill" href="#work">See the products ↓</a><a class="pill ghost" href="mailto:${P.email}">Email me</a></div>
    </div>
    <div class="deck develop" data-guide aria-roledescription="carousel" aria-label="Product recordings">
      <div class="deck-stage">${slides}
      </div>
      <div class="deck-ctl">
        <div class="deck-nav"><button class="rbtn" data-prev aria-label="Previous product">‹</button><span class="count" aria-live="polite"><b>01</b> / ${pad2(products.length)}</span><button class="rbtn" data-next aria-label="Next product">›</button></div>
        <a class="livelink" href="${esc(products[0].url)}" rel="noopener"><i class="dot live"></i><span class="lbl">Live</span> ↗</a>
      </div>
      <div class="progress" aria-hidden="true"><i></i></div>
    </div>
  </div></div>
</section>

<section class="sec" id="work" aria-labelledby="work-h" style="padding-top:72px">
  <div class="wrap">
    <div class="sec-head" data-reveal><div><div class="eyebrow"><b>02</b>Selected products</div><h2 id="work-h">Eight products I designed, built and run end to end.</h2></div><p>Every card plays a muted loop: seven are recordings of the public sites, one is built from real screens of a private client system. Keys <kbd>1</kbd>–<kbd>8</kbd> open the case studies.</p></div>
    <div class="grid">${cards}
    </div>
  </div>
</section>

<section class="sec" id="how" aria-labelledby="how-h" style="padding-top:40px">
  <div class="wrap">
    <div class="sec-head" data-reveal><div><div class="eyebrow"><b>03</b>How I build</div><h2 id="how-h">From a one-line problem to a product that keeps its receipts.</h2></div></div>
    <div class="cols">
      <article class="col" data-reveal><div class="step"><span><b>01</b> · Idea</span><span>problem → plan</span></div><h3>Rules first, a model second.</h3><p>Each product starts as one problem and one plan. What can be written as a rule stays a rule; a model is used only where rules cannot answer.</p><ul><li>PitchRadar: no model in the score</li><li>FarmQuick: leads scored by written rules</li><li>Conxfolio: nine deterministic résumé specialists</li></ul><span class="arrow" aria-hidden="true"></span></article>
      <article class="col" data-reveal><div class="step"><span><b>02</b> · Ship</span><span>gate → deploy</span></div><h3>Nothing ships past a failing gate.</h3><p>Large automated suites and release gates run before a deploy. On UnboundPDF the live page is checked again after it.</p><ul><li>1,429 tests on VVDex Engine</li><li>620 on PitchRadar · 550 on VVDex Platform</li><li>UnboundPDF: audit in 3 browser engines + checksum sweep</li></ul><span class="arrow" aria-hidden="true"></span></article>
      <article class="col" data-reveal><div class="step"><span><b>03</b> · Operate</span><span>run → prove</span></div><h3>Run it, and keep the receipts.</h3><p>The live products run on servers I administer. People keep the final say, and every run leaves a record anyone can check.</p><ul><li>Engine runs sealed under one SHA-256 digest</li><li>Platform runs carry an Ed25519-signed receipt</li><li>Copilot: you send every application</li></ul></article>
    </div>
  </div>
</section>

<section class="sec" id="proof" aria-labelledby="proof-h" style="padding-top:40px">
  <div class="wrap">
    <div class="sec-head" data-reveal><div><div class="eyebrow"><b>04</b>Proof of shipping</div><h2 id="proof-h">Shipped, running, and checked.</h2></div></div>
    <div class="proof">
      <article class="panel" data-reveal>
        <div class="panel-head"><h3>Commit activity, last 26 weeks</h3><span class="mono" style="color:var(--mute)">${H.from} – ${H.to}</span></div>
        <div class="kv"><div><strong class="big" data-count="${H.total}">${fmtN(H.total)}</strong><span>commits</span></div><div><strong class="big" data-count="${H.active}">${H.active}</strong><span>active days</span></div><div><strong class="big" data-count="${heat.repos_with_commits}">${heat.repos_with_commits}</strong><span>repositories</span></div></div>
        <div class="heat-wrap" aria-hidden="true">
          <div class="heat-days"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span>Sun</span></div>
          <div><div class="months">${H.months.map(m => `<span>${m}</span>`).join('')}</div><div class="heat">${H.grid}</div></div>
        </div>
        <div class="legend" aria-hidden="true">fewer <i style="background:rgba(22,21,19,.06)"></i><i style="background:rgba(229,72,28,.22)"></i><i style="background:rgba(229,72,28,.45)"></i><i style="background:rgba(229,72,28,.72)"></i><i style="background:var(--accent-ink)"></i> more</div>
        <p class="note">What this counts: unique commits (deduplicated across worktrees and branches) authored under my git identity in ${heat.repos_with_commits} of my local repositories, read with <code>git log</code> on 5 Nov 2026. Third-party clones and my notes vault are excluded. It includes commits made by the agents I direct under my identity.</p>
      </article>
      <article class="panel" data-reveal>
        <div class="panel-head"><h3>Public URLs, right now</h3><span class="mono" style="color:var(--mute)">checked ${esc(status.checked_utc)}</span></div>
        <ul class="uptime">${uptime}</ul>
        <p class="note">One HTTP check from one location at build time, not an uptime history. Green dot: a Live product answering 200.</p>
      </article>
    </div>
    <div class="withdrawn">${W.map(wdCard).join('')}</div>
  </div>
</section>

<section class="sec" id="contact" aria-labelledby="contact-h">
  <div class="wrap"><div class="contact">
    <div data-reveal>
      <div class="eyebrow"><b>05</b>Contact</div>
      <h2 id="contact-h">Hiring for an AI role? <em>Let’s talk.</em></h2>
      <p>${esc(P.wants)}</p>
      <div class="ctas"><a class="pill" href="mailto:${P.email}">${P.email}</a><a class="pill ghost" href="${P.linkedin}" rel="noopener">LinkedIn ↗</a><a class="pill ghost" href="${P.github}" rel="noopener">GitHub ↗</a></div>
    </div>
    <div class="code" data-reveal><div class="chrome"><span class="tl"><i></i><i></i><i></i></span><span class="host">contact.json</span><span class="st status other" style="color:#8a847a">JSON</span></div><pre data-type aria-label="Contact details as JSON">${jsonHTML}</pre></div>
  </div></div>
</section>
</main>
<script type="application/json" id="routes">${JSON.stringify(routesHome)}</script>
${footer('')}`;
fs.writeFileSync(`${ROOT}/index.html`, home);

// ---------- case pages ----------
const cats = [...new Set(tools.map(t => t.category))];
const toolsHTML = `<div class="toolfilter"><label class="sr" for="toolq">Filter tools</label><input id="toolq" type="search" placeholder="Filter ${tools.length} tools, e.g. “sign” or “word”" autocomplete="off"><span id="toolcount" class="mono" style="color:var(--mute)">${tools.length} of ${tools.length} tools</span></div>
<div class="tools">${cats.map(c => { const ts = tools.filter(t => t.category === c); return `<div class="cat"><h4><span>${esc(c)}</span><span>${ts.length}</span></h4><ul>${ts.map(t => `<li data-q="${esc((t.name + ' ' + t.slug.replace(/-/g, ' ') + ' ' + c).toLowerCase())}"><a href="${esc(t.url)}" rel="noopener" title="${esc(t.desc)}">${esc(t.name)}<span>↗</span></a></li>`).join('')}</ul></div>`; }).join('')}</div>`;

products.forEach((p, i) => {
  const base = '../../', prev = products[(i - 1 + products.length) % products.length], next = products[(i + 1) % products.length];
  const rec = RECORDED[p.slug];
  const nums = p.numbers.map(([n, l]) => { const v = num(n); return `<div><strong${v !== null ? ` data-count="${v}"` : ''}>${esc(n)}</strong><span>${esc(l)}</span></div>`; }).join('');
  const built = p.built.map((b, k) => { const [key, cap] = p.shots[k] || p.shots[0]; return `
        <div class="bitem" data-reveal>
          <div class="btxt"><span class="num">${pad2(k + 1)} / ${pad2(p.built.length)}</span><h3>${esc(b)}</h3></div>
          <figure><div class="shot">${chrome(p)}<img src="${base}assets/shots/${key}-1800.jpg" srcset="${base}assets/shots/${key}-900.jpg 900w, ${base}assets/shots/${key}-1800.jpg 1800w" sizes="(max-width: 820px) 100vw, 720px" width="1800" height="1125" loading="lazy" decoding="async" alt="${esc(p.name)}: ${esc(cap)}"></div><figcaption>Fig. ${k + 1} — ${esc(cap)}</figcaption></figure>
        </div>`; }).join('');
  const hasT = p.slug === 'unboundpdf'; const nL = pad2(hasT ? 6 : 5), nW = pad2(hasT ? 7 : 6);
  const wd = WITHDRAWN[p.slug] !== undefined ? `
      <div class="block"><div class="lab" data-reveal><div class="eyebrow"><b>${nW}</b></div><h2>What I withdrew</h2></div><div class="withdrawn" style="margin-top:0;grid-template-columns:1fr">${wdCard(W[WITHDRAWN[p.slug]])}</div></div>` : '';
  const toolsBlock = p.slug === 'unboundpdf' ? `
      <div class="block"><div class="lab" data-reveal><div class="eyebrow"><b>05</b></div><h2>All ${tools.length} tools</h2><p class="note">Each opens the live tool on unboundpdf.com.</p></div><div data-reveal>${toolsHTML}</div></div>` : '';
  const routes = { cases: products.map(q => `${base}work/${q.slug}/`), prev: `${base}work/${prev.slug}/`, next: `${base}work/${next.slug}/`, home: base };
  const html = `${head(`${p.name} — case study · Vamsi Venkatesh`, p.one, base)}
<body data-page="case">
${header(base, '<kbd>←</kbd><kbd>→</kbd><span>products</span><kbd>H</kbd><span>home</span>')}
<main id="main">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${base}#work">← All products</a><span>${pad2(i + 1)} / ${pad2(products.length)} · ${esc(p.kind)}</span></nav>
    <header class="case-top">
      <div class="select"><span class="h"></span><span class="h"></span><span class="h"></span><span class="h"></span><span class="tag">${esc(p.kind.toUpperCase())}</span><h1 class="title">${esc(p.name)}</h1><span class="dim" aria-hidden="true"></span></div>
      <p class="outcome">${esc(p.one)}</p>
      <dl class="meta">
        <div><dt>Kind</dt><dd>${esc(p.kind)}</dd></div>
        <div><dt>Status</dt><dd>${statusTag(p)}</dd></div>
        <div><dt>${p.url ? 'Where' : 'Access'}</dt><dd>${p.url ? `<a href="${esc(p.url)}" rel="noopener">${esc(p.host)} ↗</a>` : esc(p.host)}</dd></div>
        <div><dt>Role</dt><dd>Designed, built and run end to end</dd></div>
        ${p.url ? `<div class="visit"><a class="pill sm" href="${esc(p.url)}" rel="noopener">Visit ${isLive(p) ? 'live' : 'site'} ↗</a></div>` : ''}
      </dl>
      <div class="impact" data-reveal><div><div class="eyebrow">Impact</div><p>${esc(p.line)}</p></div><div class="nums">${nums}</div></div>
    </header>
    <figure class="hero-media" data-reveal style="margin-left:0;margin-right:0">
      <div class="frame" style="--tint:${tint(p)}"><div class="screen">${chrome(p)}<div class="media">${video(p, base, '', 'herovid')}</div></div></div>
      <figcaption class="figcap"><span>${rec ? `Screen recording of the public site${rec.length > 1 ? 's' : ''} ${rec.map(u => esc(u.replace('https://', '').replace(/\/$/, ''))).join(' and ')}, ${RECORD_DATE}. Muted loop.` : `Built from three real product screens. ${esc(p.name)} runs for a client and has no public UI. Muted loop.`}</span><button class="playbtn" type="button" data-playtoggle="#herovid">❚❚ Pause</button></figcaption>
    </figure>
    <article>
      <div class="block"><div class="lab" data-reveal><div class="eyebrow"><b>01</b></div><h2>The problem</h2></div><p class="statement" data-reveal>${esc(p.problem)}</p></div>
      <div class="block"><div class="lab" data-reveal><div class="eyebrow"><b>02</b></div><h2>The plan</h2></div><p class="statement" data-reveal>${esc(p.plan)}</p></div>
      <div class="block wide"><div class="lab" data-reveal><div class="eyebrow"><b>03</b></div><h2>What I built</h2></div><div class="built">${built}
      </div></div>
      <div class="block"><div class="lab" data-reveal><div class="eyebrow"><b>04</b></div><h2>How I know it works</h2></div><div data-reveal><div class="checks">${p.checks.map(c => `<div class="check">${icon.check}<span>${esc(c)}</span></div>`).join('')}</div>
        <div class="stage">${p.stage ? p.stage.map(([n, l]) => `<div><strong>${esc(n)}</strong><span>${esc(l)}</span></div>`).join('') : ''}</div></div></div>${toolsBlock}
      <div class="block"><div class="lab" data-reveal><div class="eyebrow"><b>${nL}</b></div><h2>Links</h2></div><div class="links" data-reveal>${p.links.map(([l, u], k) => `<a class="pill ${k ? 'ghost' : ''}" href="${esc(u)}" rel="noopener">${esc(l)} ↗</a>`).join('')}</div></div>${wd}
    </article>
    <nav class="pn" aria-label="More products">
      <a href="${base}work/${prev.slug}/"><img src="${base}media/${prev.slug}.jpg" alt="" loading="lazy" width="1200" height="750"><div><small>← Previous</small><b>${esc(prev.name)}</b><span>${esc(prev.kind)}</span></div></a>
      <a class="next" href="${base}work/${next.slug}/"><img src="${base}media/${next.slug}.jpg" alt="" loading="lazy" width="1200" height="750"><div><small>Next →</small><b>${esc(next.name)}</b><span>${esc(next.kind)}</span></div></a>
    </nav>
    <div class="cta-strip"><h3>Hiring for an AI role?</h3><div class="ctas"><a class="pill" href="mailto:${P.email}">Email me</a><a class="pill ghost" href="${base}">Back to all products</a></div></div>
  </div>
</main>
<script type="application/json" id="routes">${JSON.stringify(routes)}</script>
${footer(base)}`;
  fs.mkdirSync(`${ROOT}/work/${p.slug}`, { recursive: true });
  fs.writeFileSync(`${ROOT}/work/${p.slug}/index.html`, html);
});
console.log('built', products.length, 'case pages; heat', H.total, 'commits', H.active, 'days');
