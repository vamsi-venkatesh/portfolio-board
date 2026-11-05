// Live build board — interactions (v3, 5 Nov 2026: end-to-end board replaces the product deck). Vanilla JS, no dependencies.
// Nothing here hijacks scrolling: touch drags start only on grips/handles, everything else scrolls normally.
(() => {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const page = document.body.dataset.page;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const root = document.documentElement;
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) root.classList.add('notmac');

  // ---------- theme (system by default, remembered when chosen) ----------
  const sysDark = matchMedia('(prefers-color-scheme: dark)');
  const effTheme = () => root.dataset.theme || (sysDark.matches ? 'dark' : 'light');
  function toggleTheme() {
    const next = effTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('vv-theme', next); } catch (e) { /* storage blocked: still works for this visit */ }
  }
  $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', toggleTheme));

  const top = $('.top');

  // ---------- hero intro: guide lines draw, page sharpens (skippable, ≤ ~0.7 s) ----------
  const hero = $('.hero');
  function intro() {
    if (!hero) return;
    const finish = () => { hero.classList.add('sharp'); const g = $('.guides', hero); if (g) g.classList.add('on', 'rest'); };
    if (RM) { finish(); return; }
    const g = $('.guides', hero); const hr = hero.getBoundingClientRect();
    const xs = new Set(), ys = new Set();
    $$('[data-guide]', hero).forEach(el => {
      const r = el.getBoundingClientRect();
      [r.left, r.right].forEach(x => xs.add(Math.round(x - hr.left)));
      [r.top, r.bottom].forEach(y => ys.add(Math.round(y - hr.top)));
    });
    const dedupe = a => [...a].sort((p, q) => p - q).filter((v, i, arr) => i === 0 || v - arr[i - 1] > 6);
    let i = 0;
    dedupe(ys).forEach(y => { const l = mk('i', 'h'); l.style.top = y + 'px'; l.style.transitionDelay = (i++ * 12) + 'ms'; g.appendChild(l); });
    dedupe(xs).forEach(x => { const l = mk('i', 'v'); l.style.left = x + 'px'; l.style.transitionDelay = (i++ * 12) + 'ms'; g.appendChild(l); });
    requestAnimationFrame(() => requestAnimationFrame(() => g.classList.add('on')));
    const t1 = setTimeout(() => hero.classList.add('sharp'), 260);
    const t2 = setTimeout(() => g.classList.add('rest'), 900);
    const skip = () => { clearTimeout(t1); clearTimeout(t2); finish(); };
    addEventListener('pointerdown', skip, { once: true }); addEventListener('keydown', skip, { once: true }); addEventListener('wheel', skip, { once: true, passive: true });
  }

  // ---------- scramble ----------
  function scramble(el) {
    const final = el.dataset.scramble; if (!final) return;
    if (RM) { el.textContent = final; return; }
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#<>_*';
    const start = performance.now(), dur = 900;
    const step = now => {
      const p = Math.min(1, (now - start) / dur);
      let out = '';
      for (let k = 0; k < final.length; k++) { const ch = final[k]; out += ch === ' ' || k < Math.floor(p * final.length) ? ch : glyphs[(Math.random() * glyphs.length) | 0]; }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step); else el.textContent = final;
    };
    requestAnimationFrame(step);
  }

  // ---------- count up (ends on the exact original text, e.g. "394,928") ----------
  const fmt = n => n.toLocaleString('en-US');
  // Numbers are shown as they are. No count-up: it is a stock template effect (the founder's design research lists it as AI slop).
  function countUp(el) { if (el) el.dataset.counted = '1'; }

  // ---------- reveal / wipe / counters on view (run once) ----------
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target; io.unobserve(el);
    if (el.hasAttribute('data-reveal') || el.hasAttribute('data-wipe')) el.classList.add('in');
    if (el.hasAttribute('data-count')) countUp(el);
    if (el.hasAttribute('data-type')) typeCode(el);
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  // [data-wipe] opens when its revealed ancestor gets .in (a fully clipped box never reports as intersecting)
  $$('[data-reveal],[data-type]').forEach(el => io.observe(el));
  $$('[data-count]').forEach(el => { if (!el.closest('.hero') && !el.closest('.sc-item') && !el.closest('.bp')) io.observe(el); });

  // ---------- videos: play only while in view ----------
  const loadPlay = v => { if (!v) return; if (!v.src && v.dataset.src) v.src = v.dataset.src; if (!v.dataset.paused && (!RM || v.dataset.force)) v.play().catch(() => {}); };
  const vio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) loadPlay(e.target); else e.target.pause(); }), { threshold: 0.25 });
  $$('video[data-src]').forEach(v => { if (!v.closest('.sc-item')) vio.observe(v); });
  $$('[data-playtoggle]').forEach(btn => {
    const v = $(btn.dataset.playtoggle);
    const sync = () => { btn.textContent = v.paused ? '▶ Play' : '❚❚ Pause'; btn.setAttribute('aria-pressed', String(!v.paused)); };
    btn.addEventListener('click', () => { if (v.paused) { delete v.dataset.paused; v.dataset.force = '1'; loadPlay(v); } else { v.dataset.paused = '1'; v.pause(); } sync(); });
    v.addEventListener('play', sync); v.addEventListener('pause', sync); sync();
  });

  // ---------- cursor pill ----------
  function pill() {
    if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    const p = mk('div', 'cpill'); p.setAttribute('aria-hidden', 'true'); document.body.appendChild(p);
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0;
    const loop = () => { x += (tx - x) * 0.22; y += (ty - y) * 0.22; p.style.left = x + 'px'; p.style.top = y + 'px'; raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(loop) : 0; };
    $$('[data-pill]').forEach(el => {
      el.addEventListener('pointerenter', e => { p.textContent = el.dataset.pill; tx = x = e.clientX; ty = y = e.clientY; p.classList.add('on'); });
      el.addEventListener('pointerleave', () => p.classList.remove('on'));
      el.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; if (RM) { x = tx; y = ty; p.style.left = x + 'px'; p.style.top = y + 'px'; } else if (!raf) raf = requestAnimationFrame(loop); });
    });
    addEventListener('scroll', () => p.classList.remove('on'), { passive: true });
  }

  // ---------- contact.json types itself ----------
  function typeCode(pre) {
    const spans = $$('[data-t]', pre);
    const texts = spans.map(s => s.textContent);
    if (RM) return;
    spans.forEach(s => { s.textContent = ''; });
    const caret = mk('span', 'caret'); caret.setAttribute('aria-hidden', 'true');
    let si = 0, ci = 0; const total = texts.join('').length; const per = Math.max(4, 2200 / total);
    let last = performance.now(), acc = 0;
    const step = now => {
      acc += (now - last) / per; last = now;
      while (acc >= 1 && si < spans.length) {
        acc -= 1; ci++;
        if (ci > texts[si].length) { si++; ci = 0; continue; }
        spans[si].textContent = texts[si].slice(0, ci);
        spans[si].after(caret);
      }
      if (si < spans.length) requestAnimationFrame(step);
      else { spans.forEach((s, k) => s.textContent = texts[k]); pre.appendChild(caret); }
    };
    requestAnimationFrame(step);
  }

  // ---------- tool filter (UnboundPDF case page) ----------
  const tf = $('#toolq');
  if (tf) {
    const items = $$('.tools li'), cats = $$('.tools .cat'), out = $('#toolcount');
    tf.addEventListener('input', () => {
      const q = tf.value.trim().toLowerCase(); let shown = 0;
      items.forEach(li => { const ok = !q || li.dataset.q.includes(q); li.hidden = !ok; if (ok) shown++; });
      cats.forEach(c => { c.hidden = !$$('li:not([hidden])', c).length; });
      out.textContent = shown + ' of ' + items.length + ' tools';
    });
  }

  // =====================================================================================
  // Board engine: drag with snapping guides + live distance labels (Figma-like)
  // =====================================================================================
  const SNAP = 6;
  let suppressClick = false;
  addEventListener('click', e => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; } }, true);
  function makeBoard(board, opts) {
    const ov = $('.board-ov', board);
    const draw = (lines, gaps) => {
      ov.textContent = '';
      const br = board.getBoundingClientRect();
      lines.forEach(l => { const d = mk('i', 'gl ' + l.t); if (l.t === 'v') { d.style.left = (l.x - br.left) + 'px'; d.style.top = (l.a - br.top) + 'px'; d.style.height = (l.b - l.a) + 'px'; } else { d.style.top = (l.y - br.top) + 'px'; d.style.left = (l.a - br.left) + 'px'; d.style.width = (l.b - l.a) + 'px'; } ov.appendChild(d); });
      gaps.forEach(g => {
        const d = mk('i', 'gap ' + g.t), lb = mk('span', 'lbl', Math.round(g.len));
        if (g.t === 'x') { d.style.left = (g.a - br.left) + 'px'; d.style.top = (g.y - br.top) + 'px'; d.style.width = g.len + 'px'; lb.style.left = ((g.a + g.len / 2) - br.left) + 'px'; lb.style.top = (g.y - br.top - 10) + 'px'; }
        else { d.style.top = (g.a - br.top) + 'px'; d.style.left = (g.x - br.left) + 'px'; d.style.height = g.len + 'px'; lb.style.top = ((g.a + g.len / 2) - br.top) + 'px'; lb.style.left = (g.x - br.left + 20) + 'px'; }
        ov.appendChild(d); ov.appendChild(lb);
      });
    };
    const off = el => [el._dx || 0, el._dy || 0];
    const setOff = (el, dx, dy) => { el._dx = dx; el._dy = dy; el.style.translate = (dx || dy) ? `${dx}px ${dy}px` : ''; };

    function begin(el, e) {
      const [dx0, dy0] = off(el), sx = e.clientX, sy = e.clientY;
      const r0 = el.getBoundingClientRect(); const base = { l: r0.left - dx0, t: r0.top - dy0, w: r0.width, h: r0.height };
      const others = opts.targets().filter(o => o !== el).map(o => o.getBoundingClientRect());
      const br = board.getBoundingClientRect();
      const lim = opts.limit ? opts.limit(base, br) : null;
      let moved = false;
      const mv = ev => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
        let nx = dx0 + ev.clientX - sx, ny = dy0 + ev.clientY - sy;
        if (!moved) { moved = true; el.classList.add('dragging'); }
        ev.preventDefault();
        if (lim) { nx = clamp(nx, lim.x0, lim.x1); ny = clamp(ny, lim.y0, lim.y1); }
        const c = { l: base.l + nx, t: base.t + ny }; c.r = c.l + base.w; c.b = c.t + base.h; c.cx = c.l + base.w / 2; c.cy = c.t + base.h / 2;
        const lines = [], gaps = [];
        let bx = null;
        const tx = others.map(o => [[o.left, o], [o.left + o.width / 2, o], [o.right, o]]).flat();
        tx.push([br.left + (opts.pad || 0), null], [br.left + br.width / 2, null], [br.right - (opts.pad || 0), null]);
        [c.l, c.cx, c.r].forEach(v => tx.forEach(([t, o]) => { const d = t - v; if (Math.abs(d) <= SNAP && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, t, o }; }));
        if (bx) { nx += bx.d; lines.push({ t: 'v', x: bx.t, a: Math.min(c.t, bx.o ? bx.o.top : br.top), b: Math.max(c.b, bx.o ? bx.o.bottom : br.bottom) }); }
        let by = null;
        const ty = others.map(o => [[o.top, o], [o.top + o.height / 2, o], [o.bottom, o]]).flat();
        [c.t, c.cy, c.b].forEach(v => ty.forEach(([t, o]) => { const d = t - v; if (Math.abs(d) <= SNAP && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, t, o }; }));
        if (by) { ny += by.d; lines.push({ t: 'h', y: by.t, a: Math.min(c.l, by.o.left), b: Math.max(c.r, by.o.right) }); }
        const f = { l: base.l + nx, t: base.t + ny }; f.r = f.l + base.w; f.b = f.t + base.h;
        let gx = null, gy = null;
        others.forEach(o => {
          const ovY = Math.min(f.b, o.bottom) - Math.max(f.t, o.top), ovX = Math.min(f.r, o.right) - Math.max(f.l, o.left);
          if (ovY > 0) { const right = o.left >= f.r, g = right ? o.left - f.r : f.l >= o.right ? f.l - o.right : -1; if (g > 0 && (!gx || g < gx.len)) gx = { t: 'x', len: g, a: right ? f.r : o.right, y: Math.max(f.t, o.top) + ovY / 2 }; }
          if (ovX > 0) { const below = o.top >= f.b, g = below ? o.top - f.b : f.t >= o.bottom ? f.t - o.bottom : -1; if (g > 0 && (!gy || g < gy.len)) gy = { t: 'y', len: g, a: below ? f.b : o.bottom, x: Math.max(f.l, o.left) + ovX / 2 }; }
        });
        if (gx) gaps.push(gx); if (gy) gaps.push(gy);
        setOff(el, nx, ny); draw(lines, gaps); if (opts.onMove) opts.onMove(el);
        board.dataset.snapped = String(lines.length);
      };
      const up = () => {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
        el.classList.remove('dragging'); ov.textContent = '';
        if (moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); if (opts.onDrop) opts.onDrop(el); }
      };
      addEventListener('pointermove', mv, { passive: false }); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    }
    function attach(el, { whole = true } = {}) {
      el.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        const onGrip = !!e.target.closest('.grip');
        if (!onGrip && e.target.closest('a,button,textarea,input,video,.h')) return;
        if (!onGrip && (e.pointerType !== 'mouse' || !whole)) return;
        e.preventDefault();
        begin(el, e);
      });
      const g = $('.grip', el);
      if (g) g.addEventListener('keydown', e => {
        const k = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[e.key]; if (!k) return;
        e.preventDefault(); const [dx, dy] = off(el); setOff(el, dx + k[0], dy + k[1]); if (opts.onMove) opts.onMove(el); if (opts.onDrop) opts.onDrop(el);
      });
    }
    return { attach, setOff, off };
  }

  // ---------- end-to-end board: SVG connectors between the four cards, redrawn live while dragging ----------
  function wires(board) {
    const svg = $('.wires', board), cards = $$('.fcard', board);
    if (!svg || !cards.length) return { draw() {}, follow() {} };
    const empty = { draw() {}, follow() {} };
    if (!svg || cards.length < 2) return empty;
    const NS = 'http://www.w3.org/2000/svg', gBase = $('.w-base', svg), gFlow = $('.w-flow', svg), gDots = $('.w-dots', svg);
    const make = (g, tag, cls) => { const e = document.createElementNS(NS, tag); if (cls) e.setAttribute('class', cls); g.appendChild(e); return e; };
    // Product → Agents → Servers → Tests, plus a dashed loop: the tests prove the product works
    const pairs = cards.slice(1).map((_, k) => [k, k + 1]).concat([[cards.length - 1, 0]]);
    const segs = pairs.map(([i, j], k) => {
      const loop = k === pairs.length - 1, c = loop ? ' loop' : '';
      const s = { i, j, loop, base: make(gBase, 'path', 'w-b' + c), flow: make(gFlow, 'path', 'w-f' + c), a: make(gDots, 'circle', 'w-a' + c), z: make(gDots, 'circle', 'w-z' + c) };
      s.base.setAttribute('marker-end', `url(#${loop ? 'wire-loop' : 'wire-end'})`); s.a.setAttribute('r', '3.5'); s.z.setAttribute('r', '2.5');
      if (loop) { s.tag = make($('.w-tags', svg), 'text'); s.tag.textContent = 'proves it works'; s.tag.setAttribute('text-anchor', 'middle'); s.tag.setAttribute('dominant-baseline', 'middle'); }
      return s;
    });
    // anchor on the side facing the other card; the axis with the larger gap wins
    const side = (r, o) => {
      const dx = (o.left + o.width / 2) - (r.left + r.width / 2), dy = (o.top + o.height / 2) - (r.top + r.height / 2);
      const gx = Math.max(o.left - r.right, r.left - o.right), gy = Math.max(o.top - r.bottom, r.top - o.bottom);
      if (gx >= gy) return dx >= 0 ? [r.right, r.top + r.height / 2, 1, 0] : [r.left, r.top + r.height / 2, -1, 0];
      return dy >= 0 ? [r.left + r.width / 2, r.bottom, 0, 1] : [r.left + r.width / 2, r.top, 0, -1];
    };
    const draw = () => {
      const br = board.getBoundingClientRect();
      const rs = cards.map(c => { const r = c.getBoundingClientRect(); return { left: r.left - br.left, top: r.top - br.top, right: r.right - br.left, bottom: r.bottom - br.top, width: r.width, height: r.height }; });
      segs.forEach(s => {
        const A = rs[s.i], Z = rs[s.j];
        const [x1, y1, ax, ay] = side(A, Z), [x2, y2, zx, zy] = side(Z, A);
        const d = Math.hypot(x2 - x1, y2 - y1), h = clamp(d * 0.45, 24, 140);
        const ex = x2 + zx * 7, ey = y2 + zy * 7; // stop short so the arrowhead sits on the card edge
        const p = `M${x1.toFixed(1)} ${y1.toFixed(1)} C${(x1 + ax * h).toFixed(1)} ${(y1 + ay * h).toFixed(1)} ${(ex + zx * h).toFixed(1)} ${(ey + zy * h).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
        s.base.setAttribute('d', p); s.flow.setAttribute('d', p);
        s.a.setAttribute('cx', x1.toFixed(1)); s.a.setAttribute('cy', y1.toFixed(1));
        s.z.setAttribute('cx', x2.toFixed(1)); s.z.setAttribute('cy', y2.toFixed(1));
        if (s.tag) { // label at the curve's midpoint (cubic at t = .5)
          const c1x = x1 + ax * h, c1y = y1 + ay * h, c2x = ex + zx * h, c2y = ey + zy * h;
          s.tag.setAttribute('x', ((x1 + 3 * c1x + 3 * c2x + ex) / 8).toFixed(1)); s.tag.setAttribute('y', ((y1 + 3 * c1y + 3 * c2y + ey) / 8).toFixed(1));
        }
      });
      board.dataset.wired = String(segs.length);
    };
    let raf = 0;
    const queue = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
    // follow a CSS transition (reset glides the cards home) by redrawing every frame for `ms`
    const follow = ms => { const t0 = performance.now(); const f = now => { draw(); if (now - t0 < ms) requestAnimationFrame(f); }; requestAnimationFrame(f); };
    if ('ResizeObserver' in window) new ResizeObserver(queue).observe(board);
    addEventListener('resize', queue);
    if (!RM) follow(700); // the intro un-blurs and settles the layout
    return { draw, follow };
  }

  // ---------- hero board ----------
  function heroBoard() {
    const board = $('.hero [data-board]'); if (!board) return null;
    const items = $$('.drag', board), reset = $('[data-reset]', board), nb = $('.namebox', board);
    const dirty = () => { reset.disabled = false; };
    const W = wires(board);
    const B = makeBoard(board, {
      targets: () => [...items, nb],
      limit: (base, br) => ({ x0: br.left - base.l - 8, x1: br.right - base.l - base.w + 8, y0: br.top - base.t, y1: br.bottom - base.t - base.h + 40 }),
      onMove: el => { if (el.matches('.fcard')) W.draw(); },
      onDrop: dirty,
    });
    items.forEach(el => B.attach(el));
    // resizable name box: E/W handles change the width (the name reflows), N/S handles scale the type
    const dim = $('.dim', nb);
    const measure = () => { const r = nb.getBoundingClientRect(); dim.textContent = Math.round(r.width) + ' × ' + Math.round(r.height); };
    $$('.h', nb).forEach(h => h.addEventListener('pointerdown', e => {
      if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
      const side = h.dataset.rs, r0 = nb.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
      const ns0 = parseFloat(nb.style.getPropertyValue('--ns')) || 1, maxW = board.getBoundingClientRect().width;
      try { h.setPointerCapture(e.pointerId); } catch (_) {}
      nb.classList.add('resizing');
      const mv = ev => {
        const dx = (ev.clientX - sx) * (side.includes('e') ? 1 : -1), dy = (ev.clientY - sy) * (side.includes('s') ? 1 : -1);
        nb.style.width = clamp(r0.width + dx, 150, maxW) + 'px';
        nb.style.setProperty('--ns', clamp(ns0 + dy / 260, 0.55, 1.3).toFixed(3));
        measure();
      };
      const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); nb.classList.remove('resizing'); dirty(); };
      h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    }));
    const doReset = () => {
      items.forEach(el => B.setOff(el, 0, 0));
      nb.style.width = ''; nb.style.removeProperty('--ns'); setTimeout(measure, 460);
      reset.disabled = true; W.follow(520);
    };
    reset.addEventListener('click', doReset);
    measure(); addEventListener('resize', measure); W.draw();
    return { reset: doReset, wires: W };
  }

  // =====================================================================================
  // Pinned showcase: scroll moves each product into focus, then hands over (sticky, no hijack)
  // =====================================================================================
  function showcase() {
    const sc = $('.showcase'); if (!sc) return null;
    const items = $$('.sc-item', sc), rail = $$('.sc-rail button', sc), n = items.length;
    const mq = matchMedia('(min-width: 901px) and (min-height: 621px)');
    let cur = -1, stageOn = false;
    const vids = items.map(it => $('video', it));
    const activate = k => {
      const prev = cur; cur = k;
      items.forEach((it, j) => { it.classList.toggle('on', j === k); if (j !== prev) it.classList.remove('past'); });
      if (prev >= 0 && prev !== k) { items[prev].classList.add('past'); setTimeout(() => { if (cur !== prev) items[prev].classList.remove('past'); }, 750); }
      rail.forEach((b, j) => { b.classList.toggle('on', j === k); b.setAttribute('aria-current', j === k ? 'true' : 'false'); });
      $$('[data-count]', items[k]).forEach(countUp);
      vids.forEach((v, j) => { if (j === k && stageOn) loadPlay(v); else v.pause(); });
      const nx = vids[k + 1]; if (nx && !nx.src) { nx.preload = 'metadata'; nx.src = nx.dataset.src; }
    };
    const update = () => {
      if (!mq.matches) return;
      const r = sc.getBoundingClientRect(), total = r.height - innerHeight;
      const was = stageOn; stageOn = r.top < innerHeight && r.bottom > 0;
      const k = Math.floor(clamp(-r.top / Math.max(1, total), 0, 0.9999) * n);
      if (k !== cur) activate(k);
      else if (stageOn !== was) vids.forEach((v, j) => { if (j === cur && stageOn) loadPlay(v); else v.pause(); });
    };
    rail.forEach((b, j) => b.addEventListener('click', () => {
      const r = sc.getBoundingClientRect(), total = r.height - innerHeight;
      scrollTo({ top: scrollY + r.top + total * (j + 0.5) / n, behavior: RM ? 'auto' : 'smooth' });
    }));
    const mio = new IntersectionObserver(es => es.forEach(e => {
      if (mq.matches) return;
      const it = e.target, v = $('video', it);
      if (e.isIntersecting) { it.classList.add('seen'); $$('[data-count]', it).forEach(countUp); loadPlay(v); } else v.pause();
    }), { threshold: 0.2 });
    items.forEach(it => mio.observe(it));
    const mode = () => { if (mq.matches) { cur = -1; update(); } else items.forEach(it => it.classList.remove('on', 'past')); };
    mq.addEventListener('change', mode); mode();
    return { update };
  }

  // =====================================================================================
  // Design-tool inspector: a selection box + measurement line that snaps to the block in view
  // =====================================================================================
  function inspector() {
    const targets = $$('[data-inspect]'); if (!targets.length || !matchMedia('(hover:hover) and (min-width:1081px)').matches) return;
    const box = mk('div', 'inspector'); box.setAttribute('aria-hidden', 'true');
    for (let k = 0; k < 4; k++) box.appendChild(mk('i'));
    const msWrap = mk('span', 'ms'), ms = mk('em'), lab = mk('b'); msWrap.appendChild(ms); box.append(msWrap, lab);
    document.body.appendChild(box);
    const inBand = new Set(); let curEl = null;
    if (RM) box.style.transition = 'none';
    const place = el => {
      const r = el.getBoundingClientRect(), x = r.left + scrollX - 6, y = r.top + scrollY - 6;
      box.style.transform = `translate(${x}px,${y}px)`; box.style.width = (r.width + 12) + 'px'; box.style.height = (r.height + 12) + 'px';
      const name = el.dataset.inspect || (el.classList.contains('sec-head') ? 'section-head' : el.classList[0] || el.tagName.toLowerCase());
      lab.textContent = `${name} · ${Math.round(r.width)} × ${Math.round(r.height)}`; ms.textContent = Math.round(r.width);
    };
    const pick = () => {
      if (!inBand.size) { box.classList.remove('on'); curEl = null; return; }
      const mid = innerHeight * 0.45; let best = null, bd = 1e9;
      inBand.forEach(el => { const r = el.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - mid); if (d < bd) { bd = d; best = el; } });
      if (best !== curEl) { curEl = best; place(best); }
      box.classList.add('on');
    };
    const bio = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) inBand.add(e.target); else inBand.delete(e.target); }); pick(); }, { rootMargin: '-38% 0px -48% 0px' });
    targets.forEach(t => bio.observe(t));
    addEventListener('resize', () => { if (curEl) place(curEl); });
  }

  // ---------- slight scroll depth on images (translate only, in-view only) ----------
  const depthEls = new Set();
  if (!RM) {
    const dio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) depthEls.add(e.target); else depthEls.delete(e.target); }), { rootMargin: '10% 0px' });
    $$('[data-depth]').forEach(el => dio.observe(el));
  }
  const depth = () => { const vh = innerHeight; depthEls.forEach(el => { const r = el.getBoundingClientRect(); const o = clamp((r.top + r.height / 2 - vh / 2) / vh, -1, 1); el.style.translate = `0 ${(-o * 12).toFixed(1)}px`; }); };

  // =====================================================================================
  // Bottom playground: "What should we build?" — composes a readable email; stores and sends nothing
  // =====================================================================================
  function buildBoard() {
    const board = $('#bboard'); if (!board) return;
    const to = JSON.parse(($('#mail') || {}).textContent || '{}').to || '';
    const subjEl = $('#d-subj'), bodyEl = $('#d-body'), send = $('#d-send'), copy = $('#d-copy'), free = $('#freenote');
    const gripSvg = $('.grip svg');
    const notes = {};
    const ORDER = ['idea', 'when', 'budget', 'free'], LABEL = { idea: 'What', when: 'When', budget: 'Budget', free: 'Note' };
    const B = makeBoard(board, {
      targets: () => [...$$('.bnote', board), ...$$('.ghost', board).filter(g => g.offsetParent)],
      limit: (base, br) => ({ x0: br.left - base.l + 4, x1: br.right - base.l - base.w - 4, y0: br.top - base.t + 4, y1: br.bottom - base.t - base.h - 4 }),
      pad: 16,
    });
    const slot = (g, w) => {
      const W = board.clientWidth, small = W < 520, pad = small ? 12 : 20, gap = small ? 12 : 22;
      const cols = Math.max(1, Math.floor((W - pad * 2 + gap) / (w + gap)));
      const k = ORDER.indexOf(g), col = k % cols, row = Math.floor(k / cols);
      return [pad + col * (w + gap), (small ? 74 : 84) + row * (small ? 96 : 110)];
    };
    const compose = () => {
      const v = g => notes[g] ? notes[g].dataset.t : '';
      const idea = v('idea'), when = v('when'), budget = v('budget'), note = v('free');
      const hiring = /^Hiring/.test(idea);
      const subject = idea ? (hiring ? 'An AI engineering role' : idea) + ' · via your portfolio' : 'Project idea · via your portfolio';
      const lines = ['Hi Vamsi,', ''];
      lines.push(hiring ? "We're hiring for an AI engineering role and I'd like to talk." : idea ? `I'd like to talk about this: ${idea.charAt(0).toLowerCase() + idea.slice(1)}.` : "I'd like to talk about a project.");
      if (when || budget) lines.push('');
      if (when) lines.push('Timeline: ' + when);
      if (budget) lines.push('Budget: ' + budget);
      if (note) lines.push('', note);
      lines.push('', 'Best,', '[your name]');
      const body = lines.join('\n');
      subjEl.textContent = subject; bodyEl.textContent = body;
      send.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      board.classList.toggle('has', Object.keys(notes).length > 0);
      $$('.pnote[data-g]').forEach(p => p.classList.toggle('used', !!notes[p.dataset.g] && notes[p.dataset.g].dataset.t === p.dataset.t));
      return { subject, body };
    };
    const remove = g => { if (notes[g]) { notes[g].remove(); delete notes[g]; } };
    const add = (g, t, at) => {
      if (!t) return;
      let el = notes[g];
      if (!el) {
        el = mk('div', 'bnote'); el.dataset.g = g;
        el.style.setProperty('--r', (Math.random() * 4 - 2).toFixed(2) + 'deg');
        const gl = mk('span', 'bn-g', LABEL[g]), tx = mk('span', 'bn-t', t);
        const grip = mk('button', 'grip'); grip.type = 'button'; grip.setAttribute('aria-label', 'Move this note (arrow keys)'); if (gripSvg) grip.appendChild(gripSvg.cloneNode(true));
        const x = mk('button', 'bn-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove note');
        x.addEventListener('click', () => { remove(g); compose(); });
        el.append(gl, tx, grip, x); board.appendChild(el); notes[g] = el; B.attach(el);
        const w = el.offsetWidth, h = el.offsetHeight; let [lx, ly] = slot(g, w);
        // avoid landing on a note that was dropped by hand: walk the slots until one is free
        const hit = (x, y) => Object.values(notes).some(o => o !== el && x < o.offsetLeft + (o._dx || 0) + o.offsetWidth && x + w > o.offsetLeft + (o._dx || 0) && y < o.offsetTop + (o._dy || 0) + o.offsetHeight && y + h > o.offsetTop + (o._dy || 0));
        for (let k = 0; k < 8 && hit(lx, ly); k++) [lx, ly] = slot(ORDER[k % 4], w).map((v, i) => i ? v + Math.floor(k / 4) * 110 : v);
        if (at) { const br = board.getBoundingClientRect(); lx = clamp(at[0] - br.left - w / 2, 6, board.clientWidth - w - 6); ly = clamp(at[1] - br.top - 30, 6, board.clientHeight - el.offsetHeight - 6); }
        el.style.left = lx + 'px'; el.style.top = ly + 'px';
      } else if (!RM) el.animate([{ scale: 1.06 }, { scale: 1 }], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
      el.dataset.t = t; $('.bn-t', el).textContent = t;
      compose();
    };
    $$('.pnote[data-g]').forEach(p => {
      p.addEventListener('click', () => { if (p.dataset.g === 'free') { const t = free.value.trim(); if (!t) { free.focus(); return; } add('free', t.slice(0, 400)); } else add(p.dataset.g, p.dataset.t); });
      if (p.dataset.g === 'free') return;
      p.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        const sx = e.clientX, sy = e.clientY; let ghost = null;
        const inside = ev => { const br = board.getBoundingClientRect(); return ev.clientX > br.left && ev.clientX < br.right && ev.clientY > br.top && ev.clientY < br.bottom; };
        const mv = ev => {
          if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
          if (!ghost) { ghost = p.cloneNode(true); Object.assign(ghost.style, { position: 'fixed', left: 0, top: 0, zIndex: 90, pointerEvents: 'none', margin: 0, rotate: '-2deg', boxShadow: 'var(--shadow-lg)' }); document.body.appendChild(ghost); }
          ghost.style.translate = `${ev.clientX - 30}px ${ev.clientY - 20}px`;
          board.classList.toggle('over', inside(ev));
        };
        const up = ev => {
          removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
          if (!ghost) return; ghost.remove(); board.classList.remove('over');
          if (inside(ev)) { remove(p.dataset.g); add(p.dataset.g, p.dataset.t, [ev.clientX, ev.clientY]); }
          suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
        };
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      });
    });
    $('[data-clear]').addEventListener('click', () => { ORDER.forEach(remove); compose(); });
    copy.addEventListener('click', async () => { const { subject, body } = compose(); try { await navigator.clipboard.writeText(`To: ${to}\nSubject: ${subject}\n\n${body}`); copy.textContent = 'Copied ✓'; } catch (e) { copy.textContent = 'Copy blocked'; } setTimeout(() => { copy.textContent = 'Copy text'; }, 1600); });
    compose();
  }

  // =====================================================================================
  // ⌘K / Ctrl+K command bar
  // =====================================================================================
  let heroApi = null;
  function commandBar() {
    const dlg = $('#cmdk'), data = JSON.parse(($('#cmdk-data') || {}).textContent || '{"items":[]}');
    if (!dlg) return;
    const q = $('#cmdk-q'), list = $('#cmdk-list'); let sel = 0, shown = [], lastFocus = null;
    const close = () => { if (dlg.hidden) return; dlg.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); };
    const run = it => {
      close();
      if (it.act === 'theme') toggleTheme();
      else if (it.act === 'reset') { if (heroApi) { heroApi.reset(); hero.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); } else location.href = data.base || './'; }
      else if (it.ext) window.open(it.h, '_blank', 'noopener');
      else location.href = it.h;
    };
    const mark = () => { $$('[role="option"]', list).forEach(li => li.setAttribute('aria-selected', String(li.id === 'cmd-' + sel))); const a = $('#cmd-' + sel); if (a) { a.scrollIntoView({ block: 'nearest' }); q.setAttribute('aria-activedescendant', a.id); } };
    const render = () => {
      const s = q.value.trim().toLowerCase();
      shown = data.items.filter(it => !s || (it.t + ' ' + it.s + ' ' + it.g).toLowerCase().includes(s));
      sel = clamp(sel, 0, Math.max(0, shown.length - 1));
      list.textContent = '';
      if (!shown.length) { list.appendChild(mk('li', 'none', 'Nothing matches. Try “conxto”, “email” or “dark”.')); q.removeAttribute('aria-activedescendant'); return; }
      let g = '';
      shown.forEach((it, k) => {
        if (it.g !== g) { g = it.g; const h = mk('li', 'grp', g); h.setAttribute('role', 'presentation'); list.appendChild(h); }
        const li = mk('li'); li.id = 'cmd-' + k; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(k === sel));
        li.append(mk('span', '', it.t), mk('small', '', it.k ? `${it.s} · ${it.k}` : it.s));
        li.addEventListener('click', () => run(it)); li.addEventListener('pointermove', () => { if (sel !== k) { sel = k; mark(); } });
        list.appendChild(li);
      });
      mark();
    };
    const open = () => { lastFocus = document.activeElement; dlg.hidden = false; q.value = ''; sel = 0; render(); q.focus(); };
    q.addEventListener('input', () => { sel = 0; render(); });
    q.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, shown.length); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(1, shown.length); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (shown[sel]) run(shown[sel]); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') e.preventDefault();
    });
    dlg.addEventListener('pointerdown', e => { if (e.target === dlg) close(); });
    $$('[data-cmdk]').forEach(b => b.addEventListener('click', open));
    addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); dlg.hidden ? open() : close(); } });
  }


  // =====================================================================================
  // The board (v4): the hero and the seven products are one board under one camera. The camera follows the scroll
  // through a damper and flies into each frame in turn; a product's copy appears only up close. Frame 08 is the
  // visitor's (the playground). Phones and reduced motion get a plain list, no camera.
  // =====================================================================================
  function boardCamera() {
    const sec = $('.bd'); if (!sec) return null;
    const stage = $('.bd-stage', sec), world = $('.bd-world', sec), introEl = $('.bd-intro', sec), copy = $('.bd-copy', sec);
    const scrim = $('.bd-scrim', sec), edges = $('.bd-edges', sec), hint = $('.bd-hint', sec), ct = $('.bd-rail .ct', sec);
    const all = $$('.bw', sec), yours = $('.bw-yours', sec), wins = all.filter(w => w !== yours);
    const panels = $$('.bp', sec), rail = $$('.bd-rail button', sec), links = wins.map(w => $('.frame', w)), N = wins.length;
    const R = all.map(w => ({ x: +w.dataset.x, y: +w.dataset.y, w: +w.dataset.w, h: 0 }));
    const U_OV = 0.4, U_FLY = 1, U_HOLD = 0.9, SEG = U_FLY + U_HOLD, TOTAL = U_OV + N * SEG, VH_PER_UNIT = 0.6;
    const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2, lerp = (a, b, t) => a + (b - a) * t;
    const t0 = performance.now();
    let H = 0, OV = null, F = [], scrollLen = 1, secTop = 0, flat = null, lastCur = -2, lastPan = -2, lastPill = -2;
    let su = null, lastNow = 0, lastBg = '', lastCover = '', lastTf = '', running = false, grid = null;

    // grid colours come from the theme (light or dark)
    const rgba = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(',').map(x => +x.trim()); return { rgb: v.slice(0, 3).join(','), a: v.length > 3 ? v[3] : 1 }; };
    const readGrid = () => { const cs = getComputedStyle(document.documentElement);
      grid = { maj: rgba(cs.getPropertyValue('--grid-major')) || { rgb: '22,21,19', a: .075 }, min: rgba(cs.getPropertyValue('--grid')) || { rgb: '22,21,19', a: .045 } };
      lastBg = ''; kick(); };

    const setFlat = on => {
      if (on === flat) return; flat = on; sec.classList.toggle('flat', on);
      if (on) { wins.forEach((w, i) => { w.style.opacity = ''; w.classList.remove('pre', 'focus'); panels[i].appendChild(w); });
        panels.forEach(p => p.classList.remove('on', 'past')); introEl.style.opacity = ''; introEl.style.translate = ''; introEl.style.visibility = ''; }
      else { wins.forEach(w => world.insertBefore(w, yours)); lastCur = -2; lastPan = -2; lastPill = -2; }
    };

    const measure = () => {
      const HDR = top ? top.offsetHeight : 0; H = innerHeight - HDR;
      document.documentElement.style.setProperty('--hdr', HDR + 'px');
      setFlat(innerWidth < 900 || RM);
      if (flat) { sec.style.height = ''; return; }
      sec.style.height = Math.round(H + TOTAL * VH_PER_UNIT * innerHeight) + 'px';
      secTop = sec.getBoundingClientRect().top + scrollY - HDR;
      scrollLen = Math.max(1, sec.offsetHeight - H);
      all.forEach((w, i) => { R[i].h = w.offsetHeight; });
      const keep = introEl.style.translate; introEl.style.translate = ''; const ir = copy.getBoundingClientRect(); introEl.style.translate = keep;
      // overview: the whole board fits right of the copy
      const x0 = ir.right + 56, x1 = innerWidth - 28, y0 = 40, y1 = H - 64;
      const bx0 = Math.min(...R.map(r => r.x)), by0 = Math.min(...R.map(r => r.y)) - 40;
      const bx1 = Math.max(...R.map(r => r.x + r.w)), by1 = Math.max(...R.map(r => r.y + r.h));
      OV = { px: (bx0 + bx1) / 2, py: (by0 + by1) / 2, ax: (x0 + x1) / 2, ay: (y0 + y1) / 2, s: Math.min((x1 - x0) / (bx1 - bx0), (y1 - y0) / (by1 - by0)) };
      // close-up: each product frame fills the space right of the copy column
      const pr = panels[0].getBoundingClientRect().right;
      stage.style.setProperty('--scrim-w', Math.round(pr + 50) + 'px');
      F = R.slice(0, N).map(r => { const ww = Math.min(innerWidth * 0.54, innerWidth - pr - 56 - 36), s = Math.min(ww / r.w, (H * 0.8) / r.h);
        return { px: r.x + r.w / 2, py: r.y + r.h / 2, ax: pr + 56 + (r.w * s) / 2, ay: H * 0.52, s }; });
      lastBg = ''; lastTf = ''; kick();
    };

    const state = u => {
      if (u <= U_OV) return { ...OV, cur: -1, pan: -1, phase: 'ov' };
      u -= U_OV;
      const i = Math.min(N - 1, Math.floor(u / SEG)), r = u - i * SEG;
      if (r >= U_FLY || u >= N * SEG) return { ...F[i], cur: i, pan: i, phase: 'hold', i };
      const t = r / U_FLY, e = ease(t), A = i === 0 ? OV : F[i - 1], B = F[i], bump = i === 0 ? 0 : 0.4;
      const s = Math.exp(lerp(Math.log(A.s), Math.log(B.s), e)) * (1 - bump * Math.sin(Math.PI * e));
      // the copy leaves early and arrives late, so the middle of every flight is the board alone
      return { px: lerp(A.px, B.px, e), py: lerp(A.py, B.py, e), ax: lerp(A.ax, B.ax, e), ay: lerp(A.ay, B.ay, e), s,
        cur: t < 0.55 ? i - 1 : i, pan: t < 0.15 ? i - 1 : (t > 0.78 ? i : -1), phase: 'fly', i, t, e };
    };

    const render = now => {
      if (flat || !OV) { running = false; return; }
      const target = clamp((scrollY - secTop) / scrollLen, 0, 1) * TOTAL;
      const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
      if (su === null) su = target; else su += (target - su) * (1 - Math.exp(-dt / 0.2));
      if (Math.abs(target - su) < 1e-4) su = target;
      const st = state(su), settling = now - t0 < 1800;
      let s = st.s;
      if (st.phase === 'ov' && settling) s *= 1 + 0.07 * (1 - ease(clamp((now - t0) / 1700, 0, 1))); // the camera settles on load
      const tx = st.ax - st.px * s, ty = st.ay - st.py * s;
      const tf = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${s.toFixed(5)})`;
      if (tf !== lastTf) { lastTf = tf; world.style.transform = tf; world.style.setProperty('--inv', (1 / s).toFixed(4)); }

      // the graph paper belongs to the board: it zooms and pans with the camera
      const maj = 120 * s, mi = 24 * s;
      const aMaj = (grid.maj.a * clamp((maj - 20) / 40, 0.45, 1)).toFixed(4), aMin = (grid.min.a * clamp((mi - 6) / 12, 0, 1)).toFixed(4);
      const g = (c, a) => `linear-gradient(rgba(${c},${a}) 1px,transparent 1px),linear-gradient(90deg,rgba(${c},${a}) 1px,transparent 1px)`;
      const m = (v, d) => (((v % d) + d) % d).toFixed(2);
      const bgI = `${g(grid.maj.rgb, aMaj)},${g(grid.min.rgb, aMin)}`, bgS = `${maj}px ${maj}px,${maj}px ${maj}px,${mi}px ${mi}px,${mi}px ${mi}px`;
      const bgP = `${m(tx, maj)}px ${m(ty, maj)}px,${m(tx, maj)}px ${m(ty, maj)}px,${m(tx, mi)}px ${m(ty, mi)}px,${m(tx, mi)}px ${m(ty, mi)}px`;
      if (bgI + bgS + bgP !== lastBg) { lastBg = bgI + bgS + bgP; for (const el of [stage, scrim, edges]) { el.style.backgroundImage = bgI; el.style.backgroundSize = bgS; el.style.backgroundPosition = bgP; } }
      // paper behind the copy and at the edges in close-ups; nearly gone mid-flight so the leaving frame stays crisp
      const cover = (st.phase === 'ov' ? 0 : st.phase === 'hold' ? 1 : st.i === 0 ? st.e : 1 - 0.9 * Math.sin(Math.PI * st.e)).toFixed(3);
      if (cover !== lastCover) { lastCover = cover; scrim.style.opacity = cover; edges.style.opacity = cover; }

      // the hero copy steps aside as the camera leaves the overview
      const k = st.phase === 'ov' ? 0 : (st.phase === 'fly' && st.i === 0 ? st.t : 1), io = 1 - clamp(k / 0.4, 0, 1);
      introEl.style.opacity = io.toFixed(3); introEl.style.translate = `${(-80 * (1 - io)).toFixed(1)}px 0`;
      introEl.style.visibility = io < 0.01 ? 'hidden' : '';
      hint.style.opacity = st.phase === 'ov' ? 1 : 0;

      // the frame in view stays bright; the rest of the board recedes (and lifts during a flight)
      all.forEach((w, j) => {
        let o = 1;
        if (st.phase === 'hold') o = j === st.cur ? 1 : 0.16;
        else if (st.phase === 'fly') {
          if (st.i === 0) o = j === 0 ? 1 : lerp(1, 0.16, st.e);
          else o = (j === st.i || j === st.i - 1) ? 1 : lerp(0.16, 0.8, Math.sin(Math.PI * st.e));
        }
        w.style.opacity = o.toFixed(3);
        const near = st.phase === 'hold' ? j === st.cur : st.phase === 'fly' && ((st.t > 0.82 && j === st.i) || (st.t < 0.18 && j === st.i - 1));
        w.classList.toggle('focus', !!near);
      });

      if (st.pan !== lastPan) {
        if (lastPan >= 0) { const old = panels[lastPan]; old.classList.remove('on'); old.classList.add('past'); setTimeout(() => old.classList.remove('past'), 450); }
        if (st.pan >= 0) { const pn = panels[st.pan]; pn.classList.remove('past'); pn.classList.add('on'); $$('[data-count]', pn).forEach(countUp); }
        lastPan = st.pan;
      }
      if (st.cur !== lastCur) {
        rail.forEach((b, j) => { b.classList.toggle('on', j === st.cur); b.setAttribute('aria-current', j === st.cur ? 'true' : 'false'); });
        ct.textContent = st.cur >= 0 ? `${pad(st.cur + 1)} / ${pad(N)}` : `— / ${pad(N)}`;
        lastCur = st.cur;
      }
      const held = st.phase === 'hold' ? st.cur : -1;
      if (held !== lastPill) { links.forEach((a, j) => { a.dataset.pill = j === held ? 'Open case study →' : 'Fly in →'; }); lastPill = held; }

      if (su !== target || settling) requestAnimationFrame(render); else running = false;
    };
    const pad = n => String(n).padStart(2, '0');
    function kick() { if (running || flat || !OV) return; running = true; requestAnimationFrame(t => { lastNow = t; render(t); }); }

    const stopY = i => secTop + ((U_OV + i * SEG + U_FLY + U_HOLD * 0.35) / TOTAL) * scrollLen;
    const holdEndY = i => secTop + ((U_OV + i * SEG + U_FLY + U_HOLD * 0.97) / TOTAL) * scrollLen;
    const go = i => scrollTo({ top: stopY(i), behavior: RM ? 'auto' : 'smooth' });
    links.forEach((a, i) => {
      // far away: fly to it; already close: open the case study
      a.addEventListener('click', e => { if (flat) return; const st = state(su === null ? 0 : su); if (st.phase === 'hold' && st.cur === i) return; e.preventDefault(); go(i); });
      a.addEventListener('focus', () => { if (!flat && a.matches(':focus-visible')) go(i); });
    });
    all.forEach(w => { w.addEventListener('pointerenter', () => w.classList.add('hover')); w.addEventListener('pointerleave', () => w.classList.remove('hover')); });
    rail.forEach((b, i) => b.addEventListener('click', () => go(i)));
    $$('a[href="#work"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); if (flat) panels[0].scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); else go(0); }));

    readGrid(); measure();
    addEventListener('resize', measure); addEventListener('scroll', kick, { passive: true });
    new MutationObserver(readGrid).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readGrid);
    // the frames drop onto the board one by one; each flashes its selection as it lands
    all.forEach((w, i) => setTimeout(() => {
      w.classList.remove('pre');
      if (!RM && !flat) { w.classList.add('flash'); setTimeout(() => w.classList.remove('flash'), 520); }
    }, RM || flat ? 0 : 160 + i * 95));
    window.__board = { stopY, holdEndY, N, get flat() { return flat; } };
    return { measure };
  }

  // ---------- keyboard shortcuts ----------
  const routes = JSON.parse(($('#routes') || {}).textContent || '{}');
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const dlg = $('#cmdk'); if (dlg && !dlg.hidden) return;
    if (/^[1-9]$/.test(e.key) && routes.cases && routes.cases[+e.key - 1]) {
      location.href = routes.cases[+e.key - 1];
    }
    else if (page === 'case' && e.key === 'ArrowLeft' && routes.prev) location.href = routes.prev;
    else if (page === 'case' && e.key === 'ArrowRight' && routes.next) location.href = routes.next;
    else if (page === 'case' && (e.key === 'h' || e.key === 'Escape') && routes.home) location.href = routes.home;
  });

  // ---------- card → case hero: name the clicked media/title for a cross-document view transition ----------
  const clearVT = () => $$('.vt-on').forEach(el => { el.style.viewTransitionName = ''; el.classList.remove('vt-on'); });
  addEventListener('pageshow', clearVT);
  if (page === 'home') document.addEventListener('click', e => {
    const a = e.target.closest('a[data-vt]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || RM) return;
    clearVT();
    const host = a.closest('.sc-item, .client, .bp, .bw');
    let media = null, title = null;
    if (host && host.matches('.bp, .bw')) { media = $(`.bw[data-i="${host.dataset.i}"] .frame`); title = $(`.bp[data-i="${host.dataset.i}"] .sc-name`); }
    else if (host) { media = $('.frame', host) || $('.media', host); title = $('.sc-name, h3', host); }
    if (media) { media.style.viewTransitionName = 'vt-media'; media.classList.add('vt-on'); }
    if (title) { title.style.viewTransitionName = 'vt-title'; title.classList.add('vt-on'); }
  });

  // ---------- one rAF-throttled scroll loop ----------
  let sc = null, ticking = false;
  const frame = () => { ticking = false; if (top) top.classList.toggle('scrolled', scrollY > 8); if (sc) sc.update(); depth(); };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);

  // ---------- boot ----------
  const boot = () => {
    intro();
    setTimeout(() => $$('[data-scramble]').forEach(scramble), RM ? 0 : 300);
    setTimeout(() => $$('.hero [data-count]').forEach(countUp), RM ? 0 : 450);
    pill(); heroApi = heroBoard(); sc = showcase(); boardCamera(); inspector(); buildBoard(); commandBar();
    $$('.select .dim').forEach(d => { const r = d.parentElement.getBoundingClientRect(); if (!d.textContent) d.textContent = Math.round(r.width) + ' × ' + Math.round(r.height); });
    frame();
  };
  if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 900))]).then(boot); else boot();
})();
