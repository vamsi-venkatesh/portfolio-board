// Static site builder. Since v2 (5 Nov 2026) the source of truth is content.json (refreshed from the vault and the
// live public sites; sources table in NOTES.md). data/status.json (HTTP check) and data/heatmap.json (git log) as before.
// Output: index.html, work/<slug>/index.html, impressum/index.html.
import fs from 'node:fs';
const ROOT = '../13-board';
const C = JSON.parse(fs.readFileSync(`${ROOT}/content.json`, 'utf8'));
const tools = C.unboundpdf_tools;
const status = JSON.parse(fs.readFileSync(`${ROOT}/data/status.json`, 'utf8'));
const heat = JSON.parse(fs.readFileSync(`${ROOT}/data/heatmap.json`, 'utf8'));
const site = { about: C.about, principles: C.principles, withdrawn: C.withdrawn };
const P = C.person, products = C.products, clients = C.clients || [];
const ALL = [...products, ...clients];
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = n => WORDS[n] || String(n), Word = n => word(n).charAt(0).toUpperCase() + word(n).slice(1);
const RECORDED = C.recorded, DEMOS = C.demos || {};
const WITHDRAWN = { 'vvdex-trading': 0, 'vvdex-platform': 1 };
const RECORD_DATE = '5 Nov 2026';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = s => { const m = String(s).replace(/,/g, '').match(/^\d+$/); return m ? +m[0] : null; };
const pad2 = n => String(n).padStart(2, '0');
const isLive = p => p.status === 'Live';
const tint = p => `color-mix(in srgb, ${p.color} 30%, var(--paper))`;


// ---------- shared bits ----------
const head = (title, desc, base) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#f4f1ea" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121110" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="${base}assets/site.css">
<script>document.documentElement.classList.add('js');try{var t=localStorage.getItem('vv-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}</script>
</head>`;

const icon = {
  arrow: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 9 9 3M4 3h5v5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x=".5" y=".5" width="17" height="17" rx="5" fill="none" stroke="var(--accent)"/><path d="m5 9.2 2.6 2.6L13 6.4" fill="none" stroke="var(--accent)" stroke-width="1.6"/></svg>',
  moon: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path class="i-moon" d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><g class="i-sun" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1"/></g></svg>',
  grip: '<svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true"><g fill="currentColor"><circle cx="2.5" cy="2.5" r="1.2"/><circle cx="7.5" cy="2.5" r="1.2"/><circle cx="2.5" cy="7" r="1.2"/><circle cx="7.5" cy="7" r="1.2"/><circle cx="2.5" cy="11.5" r="1.2"/><circle cx="7.5" cy="11.5" r="1.2"/></g></svg>',
};

const header = (base, keysHint, active = '') => `<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap">
  <a class="brand" href="${base || './'}" aria-label="Vamsi Venkatesh, home"><span class="mark" aria-hidden="true">VV</span><span>Vamsi Venkatesh</span><small>/ AI product engineer</small></a>
  <div class="keys" aria-hidden="true">${keysHint}</div>
  <nav aria-label="Site">
    <a class="txt nav-work${active === 'work' ? ' on' : ''}" href="${base}work/"${active === 'work' ? ' aria-current="page"' : ''}>Work</a>
    <a class="txt hide-m" href="mailto:${P.email}">Email</a>
    <a class="txt hide-m" href="${P.linkedin}" rel="noopener">LinkedIn</a>
    <a class="txt hide-s" href="${P.github}" rel="noopener">GitHub</a>
    <button class="ibtn cmdk-btn" type="button" data-cmdk aria-label="Open the command bar (Ctrl+K)"><span class="k-mac">⌘K</span><span class="k-oth">Ctrl K</span></button>
    <button class="ibtn theme-btn" type="button" data-theme-toggle aria-label="Switch colour theme">${icon.moon}</button>
    <a class="pill sm" href="${base}#build">Contact</a>
  </nav>
</div></header>`;

const footer = base => `<footer class="foot"><div class="wrap">
  <span>© 2026 Vamsi Venkatesh · Magdeburg, Germany · <a href="${base}impressum/">Impressum</a></span>
  <span><a href="mailto:${P.email}">${P.email}</a> · <a href="${P.linkedin}" rel="noopener">LinkedIn</a> · <a href="${P.github}" rel="noopener">GitHub</a></span>
</div></footer>
<div class="cmdk" id="cmdk" hidden role="dialog" aria-modal="true" aria-label="Command bar">
  <div class="cmdk-box">
    <div class="cmdk-in"><span class="mono" aria-hidden="true">›</span><input id="cmdk-q" type="text" placeholder="Jump to a product, a section, email…" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list"><kbd>Esc</kbd></div>
    <ul id="cmdk-list" role="listbox"></ul>
    <div class="cmdk-foot mono"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span></div>
  </div>
</div>
<script type="application/json" id="cmdk-data">${JSON.stringify({
  base,
  items: [
    ...ALL.map((p, i) => ({ g: p.client ? 'Client work' : 'Products', t: p.name, s: p.kind + (isLive(p) ? ' · Live' : ' · ' + p.status), h: `${base}work/${p.slug}/`, k: String(i + 1) })),
    { g: 'Sections', t: 'Work index', s: `All ${ALL.length}: ${products.length} products + ${clients.length} client works`, h: `${base}work/` },
    ...[['Products, one by one', '#work'], ['Client work', '#clients'], ['End to end board', '#main'], ['How I build', '#how'], ['Proof of shipping', '#proof'], ['Recently shipped', '#shipped'], ['What should we build?', '#build'], ['Contact', '#contact']].map(([t, h]) => ({ g: 'Sections', t, s: 'Home', h: `${base}${h}` })),
    { g: 'Contact', t: 'Email Vamsi', s: P.email, h: `mailto:${P.email}` },
    { g: 'Contact', t: 'LinkedIn', s: 'linkedin.com/in/vamsivenkatesh', h: P.linkedin, ext: 1 },
    { g: 'Contact', t: 'GitHub', s: 'github.com/vamsi-venkatesh', h: P.github, ext: 1 },
    { g: 'Board', t: 'Switch dark / light', s: 'Theme', act: 'theme' },
    { g: 'Board', t: 'Reset the board', s: 'Put every note back', act: 'reset' },
    { g: 'Site', t: 'Impressum', s: 'Legal notice', h: `${base}impressum/` },
  ],
}).replace(/</g, '\\u003c')}</script>
<script src="${base}assets/site.js" defer></script>
</body></html>`;

// split a heading into masked words (screen readers get the plain text once)
const split = (text, html) => `<span class="sr">${esc(text)}</span><span class="split" aria-hidden="true">${(html || esc(text)).split(/ (?![^<]*>)/).map((w, i) => `<span class="w"><span style="--i:${i}">${w}</span></span>`).join(' ')}</span>`;

const chrome = (p, small) => `<div class="chrome" aria-hidden="true"><span class="tl"><i></i><i></i><i></i></span><span class="host">${p.url ? '🔒 ' : ''}${esc(p.url ? p.host : 'private client system')}</span>${isLive(p) ? '<span class="st status live"><i class="dot live"></i>Live</span>' : `<span class="st status other">${esc(p.status)}</span>`}</div>`;
const statusTag = p => isLive(p) ? '<span class="status live"><i class="dot live"></i>Live</span>' : `<span class="status other"><i class="dot"></i>${esc(p.status)}</span>`;
const mediaLabel = p => DEMOS[p.slug] ? 'real task recorded on the public site' : RECORDED[p.slug] ? 'screen recording of the public site' : 'real product screens';
const video = (p, base, cls = '', id = '') => `<video${id ? ` id="${id}"` : ''} class="${cls}" muted loop playsinline preload="none" poster="${base}media/${p.slug}.jpg" data-src="${base}media/${p.slug}.mp4" aria-label="${esc(p.name)}: ${mediaLabel(p)}"></video>`;

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
const routesHome = { cases: ALL.map(p => `work/${p.slug}/`) };
const fmtN = n => n.toLocaleString('en-US');
const fmtDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`; };

// end-to-end board: the lede as a system. ONE verified fact per card, read from content.json / data/status.json.
// No fact → no number (the Agents count in content.json was carried over from site.mjs and not re-checked).
const ubp = products.find(p => p.slug === 'unboundpdf');
const relCheck = (ubp.checks.find(c => /\d+ of \d+ public pages/.test(c)) || '').match(/(\d+) of (\d+) public pages answering 200 after the (.+) release/);
const okUrls = status.results.filter(r => r.code === 200).length;
// the human gate is stated in these products' checks: Conxto Copilot "you send every application", FarmQuick "A person confirms
// before anything moves", Forecasting "Nothing is issued without a person's approval". Conxto Autopilot is excluded on purpose.
const FLOW = [
  { id: 'product', k: 'Product', n: liveCount, of: products.length, label: 'products live on the public web', foot: `+ ${clients.length} run for clients`, href: '#work', go: 'See them ↓' },
  { id: 'agents', k: 'Agents', word: 'Human sign\u2011off', label: 'Agents draft and check; a person approves what goes out.', foot: 'Conxto Copilot · FarmQuick · Forecasting', href: '#how', go: 'How I build ↓' },
  { id: 'servers', k: 'Servers', n: okUrls, of: status.results.length, label: 'public URLs answered HTTP 200', foot: `one check · ${status.checked_utc.replace(/^2026-11-05/, '5 Nov 2026,')}`, href: '#proof', go: 'See the check ↓' },
  { id: 'tests', k: 'Tests', n: relCheck ? +relCheck[1] : null, of: relCheck ? +relCheck[2] : null, label: relCheck ? `UnboundPDF pages answered 200 after the ${relCheck[3]} release` : 'Release gates run before every deploy', foot: 'every public page, re-requested', href: 'work/unboundpdf/', go: 'UnboundPDF case →' },
];
const flowCard = (c, i) => `
        <article class="fcard drag" data-drag="flow-${c.id}" data-flow="${i}" aria-label="${pad2(i + 1)} ${c.k}">
          <button class="grip" type="button" aria-label="Move the ${c.k} card (arrow keys)">${icon.grip}</button>
          <div class="fc-k"><b>${pad2(i + 1)}</b>${c.k}</div>
          ${c.n != null ? `<strong class="fc-n"><span data-count="${c.n}">${c.n}</span><small>/${c.of}</small></strong>` : `<strong class="fc-n fc-w">${esc(c.word)}</strong>`}
          <p class="fc-l">${esc(c.label)}</p>
          <div class="fc-f"><span>${esc(c.foot)}</span><a href="${c.href}">${esc(c.go)}</a></div>
        </article>`;
const flowHTML = `
    <div class="flow develop" data-guide aria-label="End to end: the product, the agents, the servers and the tests">
      <div class="flow-head mono"><span><b>frame / end to end</b></span><span class="hide-s">the sentence on the left, as a system</span></div>
      <div class="flow-grid">${FLOW.map(flowCard).join('')}
      </div>
      <p class="flow-cap mono">Drag a card: the wiring follows. Each number is from a dated check; no check, no number.</p>
    </div>`;

// pinned showcase: one item per product (desktop: stacked in a sticky stage; phones: a plain list)
const showcase = products.map((p, i) => {
  const st = (p.stage || p.numbers || []).slice(0, 3);
  return `
      <article class="sc-item" data-i="${i}" style="--tint:${tint(p)}" aria-label="${esc(p.name)}">
        <div class="sc-text">
          <div class="eyebrow"><b>${pad2(i + 1)} / ${pad2(products.length)}</b>${esc(p.kind)} ${statusTag(p)}</div>
          <h3 class="sc-name">${esc(p.name)}</h3>
          <p class="sc-one">${esc(p.line)}</p>
          <div class="sc-nums">${st.map(([n, l]) => { const v = num(n); return `<div><strong${v !== null ? ` data-count="${v}"` : ''}>${esc(n)}</strong><span>${esc(l)}</span></div>`; }).join('')}</div>
          <div class="sc-links"><a class="pill sm" href="work/${p.slug}/" data-vt="${p.slug}">Case study →</a>${p.url ? `<a class="pill sm ghost" href="${esc(p.url)}" rel="noopener">${esc(p.host)} ↗</a>` : ''}</div>
        </div>
        <a class="sc-media frame-link" href="work/${p.slug}/" data-vt="${p.slug}" data-pill="Open case study →" aria-label="${esc(p.name)} case study">
          <div class="frame"><div class="screen">${chrome(p)}<div class="media">${video(p, '')}</div></div></div>
          <span class="sel" aria-hidden="true"><i></i><i></i><i></i><i></i><b>Frame · ${pad2(i + 1)} ${esc(p.slug)}</b></span>
        </a>
      </article>`;
}).join('');

const rail = products.map((p, i) => `<button type="button" data-go="${i}"><span>${pad2(i + 1)}</span><em>${esc(p.name)}</em></button>`).join('');

// client work: two wide cards with the same frame + loop language
const clientCards = clients.map((p, j) => { const i = products.length + j; const st = (p.stage || p.numbers || []).slice(0, 3);
  return `
      <article class="client" data-reveal style="--tint:${tint(p)};--d:${j * 80}ms">
        <a class="frame-link" href="work/${p.slug}/" data-vt="${p.slug}" data-pill="Case study →" aria-label="${esc(p.name)} case study">
          <div class="frame"><div class="screen" data-wipe>${chrome(p)}<div class="media">${video(p, '')}</div></div></div>
          <span class="sel" aria-hidden="true"><i></i><i></i><i></i><i></i><b>Client · ${pad2(i + 1)} ${esc(p.slug)}</b></span>
        </a>
        <div class="eyebrow" style="margin-top:20px"><b>Client work</b>${esc(p.kind.replace(' · client', ''))} ${statusTag(p)}</div>
        <h3><a href="work/${p.slug}/" data-vt="${p.slug}">${esc(p.name)}</a></h3>
        <p class="one">${esc(p.line)}</p>
        <div class="sc-nums">${st.map(([n, l]) => { const v = num(n); return `<div><strong${v !== null ? ` data-count="${v}"` : ''}>${esc(n)}</strong><span>${esc(l)}</span></div>`; }).join('')}</div>
      </article>`; }).join('');

const prodByUrl = Object.fromEntries(ALL.filter(p => p.url).map(p => [p.url, p]));
const uptime = status.results.map(r => { const p = prodByUrl[r.url]; const ok = r.code === 200; const live = p && isLive(p);
  return `<li><i class="dot ${ok && live ? 'live' : ''}" aria-hidden="true"></i><a href="${esc(r.url)}" rel="noopener">${esc(new URL(r.url).host)}</a><em>${ok ? 'HTTP 200' : 'HTTP ' + r.code} · ${r.ms} ms${p && !live ? ' · ' + esc(p.status) : ''}</em></li>`; }).join('');

const W = site.withdrawn;
const wdCard = w => `<article class="wd" data-reveal><div class="eyebrow"><b>Withdrawn</b>by me, on the record</div><h4>${esc(w.title)}</h4><div class="nums">${w.numbers.map(([n, l]) => `<div><strong>${esc(n)}</strong><span>${esc(l)}</span></div>`).join('')}</div><p>${esc(w.what)}</p><p style="margin-top:14px"><a class="txtlink" href="${esc(w.link[1])}" rel="noopener">${esc(w.link[0])} ↗</a></p></article>`;

const shipped = (C.shipped || []).slice(0, 8).map(([d, prod, what, slug], i) => `
          <li data-reveal style="--d:${i * 50}ms"><time datetime="${d}">${fmtDate(d)}</time><a href="work/${slug}/" class="sh-prod">${esc(prod)}</a><p>${esc(what)}</p></li>`).join('');

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

// the three stat notes (used at the top AND returned to the bottom board)
const STATS = [
  ['products', products.length, `products, built and run · ${liveCount} live · + ${clients.length} for clients`],
  ['unboundpdf', tools.length, 'tools in UnboundPDF, all in the browser'],
  ['vvdex-platform', 417, 'graded AI attempts, published'],
];
const statNote = ([id, n, label], k) => `<div class="stat drag" data-drag="stat-${id}" data-frame="stat / ${id}"><button class="grip" type="button" aria-label="Move the ${id} note (arrow keys)">${icon.grip}</button><strong data-count="${n}">${n}</strong><span>${esc(label)}</span></div>`;

const NOTES = {
  idea: ['What is it?', ['An AI agent for my business', 'An evaluation of our models or agents', 'A web product, end to end', 'Automating a manual workflow', 'Hiring: an AI engineering role']],
  when: ['When?', ['This month', 'In 1–3 months', 'Exploring, no date yet']],
  budget: ['Budget', ['Under €2k', '€2k–10k', '€10k+', 'A salaried role']],
};
const palette = Object.entries(NOTES).map(([g, [title, list]]) => `
          <div class="pal-group"><h4>${esc(title)}</h4><div class="pal-notes">${list.map(t => `<button type="button" class="pnote" data-g="${g}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`).join('');

const home = `${head('Vamsi Venkatesh — AI product engineer', P.lede, '')}
<body data-page="home">
${header('', `<span>Press</span><kbd>1</kbd><span>–</span><kbd>${ALL.length}</kbd><span>to open a case study</span>`)}
<main id="main">
<section class="hero" aria-label="Introduction">
  <div class="guides" aria-hidden="true"></div>
  <div class="wrap"><div class="board" id="board" data-board>
    <div class="board-bar" aria-label="Board controls">
      <span class="mono"><b>board / home</b><span class="hide-s"> · drag the notes and the cards · resize my name</span><span class="show-s"> · drag ${icon.grip}</span></span>
      <button class="reset" type="button" data-reset disabled>↺ Reset board</button>
    </div>
    <div class="board-ov" aria-hidden="true"></div>
    <svg class="wires" aria-hidden="true" focusable="false"><defs><marker id="wire-end" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker><marker id="wire-loop" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse" style="color:var(--faint)"><path d="M1 1 9 5 1 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs><g class="w-base"></g><g class="w-flow"></g><g class="w-dots"></g><g class="w-tags"></g></svg>
    <div class="hero-grid">
    <div class="develop">
      <div class="select namebox" data-guide>
        <span class="h" data-rs="nw"></span><span class="h" data-rs="ne"></span><span class="h" data-rs="sw"></span><span class="h" data-rs="se"></span>
        <span class="tag" data-scramble="AI PRODUCT ENGINEER" aria-hidden="true">AI PRODUCT ENGINEER</span>
        <h1 class="name"><span class="sr">Vamsi Venkatesh, AI product engineer. </span><span aria-hidden="true">Vamsi Venkatesh</span></h1>
        <span class="dim" aria-hidden="true"></span>
      </div>
      <p class="lede" data-guide>${esc(P.lede).replace('end to end', '<mark>end to end</mark>')}</p>
      <p class="open"><i class="dot accent" aria-hidden="true"></i>Open to work · ${esc(P.city)} · updated ${fmtDate(C.content_updated)}</p>
      <div class="stats" data-guide>${STATS.map(statNote).join('')}</div>
      <div class="ctas"><a class="pill" href="#work">See the products ↓</a><a class="pill ghost" href="#build">What should we build?</a></div>
    </div>
${flowHTML}
    </div>
  </div></div>
</section>

<section class="sec showcase-sec" id="work" aria-labelledby="work-h">
  <div class="wrap">
    <div class="sec-head" data-inspect><div><div class="eyebrow"><b>02</b>Selected products</div><h2 id="work-h" data-reveal>${split(`${Word(products.length)} products I designed, built and run end to end.`)}</h2></div><p data-reveal>Scroll: each product moves into focus with its outcome and numbers. The loops are real: two are a task and a run recorded on the public sites, the rest are recordings of them.</p></div>
  </div>
  <div class="showcase" style="--n:${products.length}">
    <div class="sc-sticky"><div class="wrap">
      <div class="sc-stage">${showcase}
      </div>
      <nav class="sc-rail" aria-label="Products in this showcase">${rail}<i class="sc-bar" aria-hidden="true"></i></nav>
    </div></div>
  </div>
</section>

<section class="sec" id="clients" aria-labelledby="clients-h" style="padding-top:40px">
  <div class="wrap">
    <div class="sec-head" data-inspect><div><div class="eyebrow"><b>03</b>Client work</div><h2 id="clients-h" data-reveal>${split(`Built and run for ${word(clients.length)} clients.`)}</h2></div><p data-reveal>Systems I designed and run for businesses: the work is mine, the business is theirs. Details stay at what each client has made public.</p></div>
    <div class="clients">${clientCards}
    </div>
    <a class="allwork" href="work/"><span class="mono">Index</span><b>All ${word(ALL.length)} in one list</b><em>${Word(products.length)} products and ${word(clients.length)} client works: kind, status and a line each</em><i aria-hidden="true">→</i></a>
  </div>
</section>

<section class="sec" id="how" aria-labelledby="how-h" style="padding-top:40px">
  <div class="wrap">
    <div class="sec-head" data-inspect><div><div class="eyebrow"><b>04</b>How I build</div><h2 id="how-h" data-reveal>${split('From a one-line problem to a product that keeps its receipts.')}</h2></div></div>
    <div class="cols">
      <article class="col" data-reveal data-inspect><div class="step"><span><b>01</b> · Idea</span><span>problem → plan</span></div><h3>Rules first, a model second.</h3><p>Each product starts as one problem and one plan. What can be written as a rule stays a rule; a model is used only where rules cannot answer.</p><ul><li>PitchRadar: no model in the score</li><li>FarmQuick: leads scored by written rules</li><li>Conxfolio: nine deterministic résumé specialists</li></ul><span class="arrow" aria-hidden="true"></span></article>
      <article class="col" data-reveal data-inspect style="--d:80ms"><div class="step"><span><b>02</b> · Ship</span><span>gate → deploy</span></div><h3>Nothing ships past a failing gate.</h3><p>Large automated suites and release gates run before a deploy. On UnboundPDF the live page is checked again after it.</p><ul><li>1,429 tests on VVDex Engine</li><li>620 on PitchRadar · 550 on VVDex Platform</li><li>UnboundPDF: audit in 3 browser engines + checksum sweep</li></ul><span class="arrow" aria-hidden="true"></span></article>
      <article class="col" data-reveal data-inspect style="--d:160ms"><div class="step"><span><b>03</b> · Operate</span><span>run → prove</span></div><h3>Run it, and keep the receipts.</h3><p>The live products run on servers I administer. People keep the final say, and every run leaves a record anyone can check.</p><ul><li>Engine runs sealed under one SHA-256 digest</li><li>Platform runs carry an Ed25519-signed receipt</li><li>Copilot: you send every application</li></ul></article>
    </div>
  </div>
</section>

<section class="sec" id="proof" aria-labelledby="proof-h" style="padding-top:40px">
  <div class="wrap">
    <div class="sec-head" data-inspect><div><div class="eyebrow"><b>05</b>Proof of shipping</div><h2 id="proof-h" data-reveal>${split('Shipped, running, and checked.')}</h2></div></div>
    <div class="proof">
      <article class="panel" data-reveal data-inspect>
        <div class="panel-head"><h3>Commit activity, last 26 weeks</h3><span class="mono" style="color:var(--mute)">${H.from} – ${H.to}</span></div>
        <div class="kv"><div><strong class="big" data-count="${H.total}">${fmtN(H.total)}</strong><span>commits</span></div><div><strong class="big" data-count="${H.active}">${H.active}</strong><span>active days</span></div><div><strong class="big" data-count="${heat.repos_with_commits}">${heat.repos_with_commits}</strong><span>repositories</span></div></div>
        <div class="heat-wrap" aria-hidden="true">
          <div class="heat-days"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span>Sun</span></div>
          <div><div class="months">${H.months.map(m => `<span>${m}</span>`).join('')}</div><div class="heat">${H.grid}</div></div>
        </div>
        <div class="legend" aria-hidden="true">fewer <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> more</div>
        <p class="note">What this counts: unique commits (deduplicated across worktrees and branches) authored under my git identity in ${heat.repos_with_commits} of my local repositories, read with <code>git log</code> on 5 Nov 2026. Third-party clones and my notes vault are excluded. It includes commits made by the agents I direct under my identity.</p>
      </article>
      <article class="panel" data-reveal data-inspect style="--d:80ms">
        <div class="panel-head"><h3>Public URLs, right now</h3><span class="mono" style="color:var(--mute)">checked ${esc(status.checked_utc)}</span></div>
        <ul class="uptime">${uptime}</ul>
        <p class="note">One HTTP check from one location at build time, not an uptime history. Green dot: a Live product answering 200.</p>
      </article>
    </div>
    <article class="panel shipped" id="shipped" data-inspect>
      <div class="panel-head"><h3>Recently shipped</h3><span class="mono" style="color:var(--mute)">from my build log · newest first</span></div>
      <ol class="feed">${shipped}
      </ol>
    </article>
    <div class="withdrawn">${W.map(wdCard).join('')}</div>
  </div>
</section>

<section class="sec" id="build" aria-labelledby="build-h">
  <div class="wrap">
    <div class="sec-head" data-inspect><div><div class="eyebrow"><b>06</b>Playground</div><h2 id="build-h" data-reveal>${split('What should we build?')}</h2></div><p data-reveal>Drag notes onto the board, or tap them. It writes a plain email you can read before you send it. Nothing is stored or sent by this page; your email app does the sending.</p></div>
    <div class="buildgrid">
      <div class="palette" data-reveal>${palette}
          <div class="pal-group"><h4>Anything else</h4><label class="sr" for="freenote">A free-text note</label><textarea id="freenote" rows="3" maxlength="400" placeholder="One line is enough: the problem, a link, your team…"></textarea><button type="button" class="pnote free" data-g="free">Pin this note →</button></div>
      </div>
      <div class="bboard-wrap" data-reveal style="--d:80ms">
        <div class="bboard" id="bboard" data-board aria-label="Project board" tabindex="-1">
          <div class="board-ov" aria-hidden="true"></div>
          <p class="bb-empty">Drop notes here.<br><span>Idea · when · budget · anything else</span></p>
          <div class="ghosts" aria-hidden="true">
            ${STATS.map(([id, n, label], k) => `<div class="ghost g${k}"><b>${n}</b><span>${esc(label.split(' · ')[0])}</span></div>`).join('')}
            <div class="ghost gname"><span class="gtag">AI PRODUCT ENGINEER</span><b>Vamsi Venkatesh</b></div>
          </div>
        </div>
        <div class="draft" aria-live="polite">
          <div class="chrome"><span class="tl"><i></i><i></i><i></i></span><span class="host">New message · draft</span><span class="st status other">Not sent</span></div>
          <dl><div><dt>To</dt><dd>${esc(P.email)}</dd></div><div><dt>Subject</dt><dd id="d-subj">Project idea</dd></div></dl>
          <pre id="d-body"></pre>
          <div class="draft-ctl"><a class="pill" id="d-send" href="mailto:${P.email}">Open in my email app ↗</a><button type="button" class="pill ghost" id="d-copy">Copy text</button><button type="button" class="pill ghost" data-clear>Clear board</button></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="sec" id="contact" aria-labelledby="contact-h" style="padding-top:40px">
  <div class="wrap"><div class="contact">
    <div data-reveal>
      <div class="eyebrow"><b>07</b>Contact</div>
      <h2 id="contact-h">Hiring for an AI role? <em>Let’s talk.</em></h2>
      <p>${esc(P.wants)}</p>
      <div class="ctas"><a class="pill" href="mailto:${P.email}">${P.email}</a><a class="pill ghost" href="${P.linkedin}" rel="noopener">LinkedIn ↗</a><a class="pill ghost" href="${P.github}" rel="noopener">GitHub ↗</a></div>
    </div>
    <div class="code" data-reveal data-inspect><div class="chrome"><span class="tl"><i></i><i></i><i></i></span><span class="host">contact.json</span><span class="st status other" style="color:#8a847a">JSON</span></div><pre data-type aria-label="Contact details as JSON">${jsonHTML}</pre></div>
  </div></div>
</section>
</main>
<script type="application/json" id="routes">${JSON.stringify(routesHome)}</script>
<script type="application/json" id="mail">${JSON.stringify({ to: P.email })}</script>
${footer('')}`;
fs.writeFileSync(`${ROOT}/index.html`, home);

// ---------- impressum (stub: the address is a marked placeholder, never invented) ----------
const imp = `${head('Impressum · Vamsi Venkatesh', 'Legal notice (Impressum) for vamsivenkatesh.com.', '../')}
<body data-page="legal">
${header('../', '')}
<main id="main"><div class="wrap legal">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="../">← Home</a><span>Legal notice</span></nav>
  <div class="select" style="margin-top:44px"><span class="h"></span><span class="h"></span><span class="h"></span><span class="h"></span><span class="tag">§ 5 DDG</span><h1 class="title">Impressum</h1></div>
  <div class="legal-body">
    <h2>Angaben gemäß § 5 DDG</h2>
    <p>${esc(P.name)}<br><span class="ph" role="note">[ADDRESS PLACEHOLDER — street and house number, postcode Magdeburg. To be filled in by Vamsi before this page goes live.]</span><br>Germany</p>
    <h2>Kontakt</h2>
    <p>E-Mail: <a href="mailto:${P.email}">${P.email}</a><br><span class="ph" role="note">[Optional second contact channel — to be decided by Vamsi.]</span></p>
    <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
    <p>${esc(P.name)}, address as above.</p>
    <h2>Haftung für Links</h2>
    <p>This site links to products I build and to external websites. I have no influence on the content of external sites and accept no liability for it; the respective provider is responsible.</p>
    <h2>Datenschutz</h2>
    <p>This site sets no cookies and runs no analytics. Fonts load from Google Fonts. The colour theme you pick is kept in your own browser only. The “What should we build?” board stores and sends nothing; it opens your own email app.</p>
    <p class="note">Draft stub, 5 Nov 2026 — not legal advice; to be reviewed before publishing.</p>
  </div>
</div></main>
${footer('../')}`;
fs.mkdirSync(`${ROOT}/impressum`, { recursive: true });
fs.writeFileSync(`${ROOT}/impressum/index.html`, imp);


// ---------- work index (v3): every product and client work in one list ----------
{
  const base = '../';
  const row = (p, i) => `
        <li data-reveal style="--d:${(i % 7) * 40}ms"><a class="wi-row" href="${p.slug}/" style="--tint:${tint(p)}">
          <span class="wi-n">${pad2(i + 1)}</span>
          <span class="wi-name"><b>${esc(p.name)}</b><em>${esc(p.one)}</em></span>
          <span class="wi-kind"><span>${esc(p.kind.replace(' · client', ''))}</span><small>${esc(p.url ? p.host : 'private client system')}</small></span>
          <span class="wi-st">${statusTag(p)}</span>
          <span class="wi-go">Case study <i aria-hidden="true">→</i></span>
        </a></li>`;
  const group = (id, n, title, sub, list, off) => `
    <section class="wi-group" aria-labelledby="${id}">
      <div class="wi-head"><div class="eyebrow"><b>${n}</b><span id="${id}">${title}</span></div><span class="mono">${sub}</span></div>
      <div class="wi-cols mono" aria-hidden="true"><span>#</span><span>Name</span><span>Kind · where</span><span>Status</span><span></span></div>
      <ol class="wi-list">${list.map((p, k) => row(p, off + k)).join('')}
      </ol>
    </section>`;
  const html = `${head('Work — Vamsi Venkatesh', `${Word(products.length)} products and ${word(clients.length)} client works by Vamsi Venkatesh, AI product engineer.`, base)}
<body data-page="index">
${header(base, `<kbd>1</kbd><span>–</span><kbd>${ALL.length}</kbd><span>open a case study</span>`, 'work')}
<main id="main"><div class="wrap work-index">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${base}">← Home</a><span>Work · ${ALL.length}</span></nav>
  <header class="case-top">
    <div class="select"><span class="h"></span><span class="h"></span><span class="h"></span><span class="h"></span><span class="tag">INDEX · ${products.length} + ${clients.length}</span><h1 class="title">Work</h1><span class="dim" aria-hidden="true"></span></div>
    <p class="outcome">${Word(products.length)} products I designed, built and run end to end, ${word(liveCount)} of them live, and ${word(clients.length)} systems I built and run for clients. Each row opens its case study.</p>
  </header>${group('wi-p', '01', 'Products', `${products.length} · ${liveCount} live`, products, 0)}${group('wi-c', '02', 'Client work', `${clients.length} · the business is theirs, the build is mine`, clients, products.length)}
  <div class="cta-strip"><h3>Hiring for an AI role?</h3><div class="ctas"><a class="pill" href="mailto:${P.email}">Email me</a><a class="pill ghost" href="${base}#build">What should we build?</a></div></div>
</div></main>
<script type="application/json" id="routes">${JSON.stringify({ cases: ALL.map(q => `${q.slug}/`), home: base })}</script>
${footer(base)}`;
  fs.mkdirSync(`${ROOT}/work`, { recursive: true });
  fs.writeFileSync(`${ROOT}/work/index.html`, html);
}
// ---------- case pages ----------
const cats = [...new Set(tools.map(t => t.category))];
const toolsHTML = `<div class="toolfilter"><label class="sr" for="toolq">Filter tools</label><input id="toolq" type="search" placeholder="Filter ${tools.length} tools, e.g. “sign” or “word”" autocomplete="off"><span id="toolcount" class="mono" style="color:var(--mute)">${tools.length} of ${tools.length} tools</span></div>
<div class="tools">${cats.map(c => { const ts = tools.filter(t => t.category === c); return `<div class="cat"><h4><span>${esc(c)}</span><span>${ts.length}</span></h4><ul>${ts.map(t => `<li data-q="${esc((t.name + ' ' + t.slug.replace(/-/g, ' ') + ' ' + c).toLowerCase())}"><a href="${esc(t.url)}" rel="noopener" title="${esc(t.desc)}">${esc(t.name)}<span>↗</span></a></li>`).join('')}</ul></div>`; }).join('')}</div>`;

ALL.forEach((p, i) => {
  const base = '../../', prev = ALL[(i - 1 + ALL.length) % ALL.length], next = ALL[(i + 1) % ALL.length];
  const rec = RECORDED[p.slug];
  const nums = p.numbers.map(([n, l]) => { const v = num(n); return `<div><strong${v !== null ? ` data-count="${v}"` : ''}>${esc(n)}</strong><span>${esc(l)}</span></div>`; }).join('');
  const built = p.built.map((b, k) => { const [key, cap] = p.shots[k] || p.shots[0]; return `
        <div class="bitem" data-reveal>
          <div class="btxt"><span class="num">${pad2(k + 1)} / ${pad2(p.built.length)}</span><h3>${esc(b)}</h3></div>
          <figure><div class="shot" data-wipe>${chrome(p)}<img data-depth src="${base}assets/shots/${key}-1800.jpg" srcset="${base}assets/shots/${key}-900.jpg 900w, ${base}assets/shots/${key}-1800.jpg 1800w" sizes="(max-width: 820px) 100vw, 720px" width="1800" height="1125" loading="lazy" decoding="async" alt="${esc(p.name)}: ${esc(cap)}"></div><figcaption>Fig. ${k + 1} — ${esc(cap)}</figcaption></figure>
        </div>`; }).join('');
  const hasT = p.slug === 'unboundpdf'; const nL = pad2(hasT ? 6 : 5), nW = pad2(hasT ? 7 : 6);
  const wd = WITHDRAWN[p.slug] !== undefined ? `
      <div class="block"><div class="lab" data-reveal><div class="eyebrow"><b>${nW}</b></div><h2>What I withdrew</h2></div><div class="withdrawn" style="margin-top:0;grid-template-columns:1fr">${wdCard(W[WITHDRAWN[p.slug]])}</div></div>` : '';
  const toolsBlock = p.slug === 'unboundpdf' ? `
      <div class="block"><div class="lab" data-reveal><div class="eyebrow"><b>05</b></div><h2>All ${tools.length} tools</h2><p class="note">Each opens the live tool on unboundpdf.com.</p></div><div data-reveal>${toolsHTML}</div></div>` : '';
  const routes = { cases: ALL.map(q => `${base}work/${q.slug}/`), prev: `${base}work/${prev.slug}/`, next: `${base}work/${next.slug}/`, home: base };
  const html = `${head(`${p.name} — case study · Vamsi Venkatesh`, p.one, base)}
<body data-page="case">
${header(base, '<kbd>←</kbd><kbd>→</kbd><span>products</span><kbd>H</kbd><span>home</span>')}
<main id="main">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${base}work/">← All work</a><span>${pad2(i + 1)} / ${pad2(ALL.length)} · ${p.client ? 'Client work · ' : ''}${esc(p.kind.replace(' · client', ''))}</span></nav>
    <header class="case-top">
      <div class="select"><span class="h"></span><span class="h"></span><span class="h"></span><span class="h"></span><span class="tag">${p.client ? 'CLIENT WORK · ' : ''}${esc(p.kind.replace(' · client', '').toUpperCase())}</span><h1 class="title" data-vt-title>${esc(p.name)}</h1><span class="dim" aria-hidden="true"></span></div>
      <p class="outcome">${esc(p.one)}</p>
      <dl class="meta">
        <div><dt>${p.client ? 'Client work' : 'Kind'}</dt><dd>${esc(p.kind.replace(' · client', ''))}</dd></div>
        <div><dt>Status</dt><dd>${statusTag(p)}</dd></div>
        <div><dt>${p.url ? 'Where' : 'Access'}</dt><dd>${p.url ? `<a href="${esc(p.url)}" rel="noopener">${esc(p.host)} ↗</a>` : esc(p.host)}</dd></div>
        <div><dt>Role</dt><dd>${p.client ? 'Designed, built and run for a client' : 'Designed, built and run end to end'}</dd></div>
        ${p.url ? `<div class="visit"><a class="pill sm" href="${esc(p.url)}" rel="noopener">Visit ${isLive(p) ? 'live' : 'site'} ↗</a></div>` : ''}
      </dl>
      <div class="impact" data-reveal><div><div class="eyebrow">Impact</div><p>${esc(p.line)}</p></div><div class="nums">${nums}</div></div>
    </header>
    <figure class="hero-media" style="margin-left:0;margin-right:0">
      <div class="frame" data-vt-media style="--tint:${tint(p)}"><div class="screen">${chrome(p)}<div class="media">${video(p, base, '', 'herovid')}</div></div></div>
      <figcaption class="figcap"><span>${DEMOS[p.slug] ? esc(DEMOS[p.slug]) + ` Recorded ${RECORD_DATE}. Muted loop.` : rec ? `Screen recording of the public site${rec.length > 1 ? 's' : ''} ${rec.map(u => esc(u.replace('https://', '').replace(/\/$/, ''))).join(' and ')}, ${RECORD_DATE}. Muted loop.` : `Built from three real product screens. ${esc(p.name)} runs for a client and has no public UI. Muted loop.`}</span><button class="playbtn" type="button" data-playtoggle="#herovid">❚❚ Pause</button></figcaption>
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
      <a href="${base}work/${prev.slug}/"><img src="${base}media/${prev.slug}.jpg" alt="" loading="lazy" width="1200" height="750"><div><small>← Previous${prev.client ? ' · client work' : ''}</small><b>${esc(prev.name)}</b><span>${esc(prev.kind)}</span></div></a>
      <a class="next" href="${base}work/${next.slug}/"><img src="${base}media/${next.slug}.jpg" alt="" loading="lazy" width="1200" height="750"><div><small>${next.client ? 'Client work · ' : ''}Next →</small><b>${esc(next.name)}</b><span>${esc(next.kind)}</span></div></a>
    </nav>
    <div class="cta-strip"><h3>Hiring for an AI role?</h3><div class="ctas"><a class="pill" href="mailto:${P.email}">Email me</a><a class="pill ghost" href="${base}work/">All work</a></div></div>
  </div>
</main>
<script type="application/json" id="routes">${JSON.stringify(routes)}</script>
${footer(base)}`;
  fs.mkdirSync(`${ROOT}/work/${p.slug}`, { recursive: true });
  fs.writeFileSync(`${ROOT}/work/${p.slug}/index.html`, html);
});
console.log('built home, work index, impressum +', ALL.length, 'case pages; heat', H.total, 'commits', H.active, 'days');
