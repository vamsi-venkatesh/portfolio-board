// Live build board — interactions. Vanilla JS, no dependencies. Nothing here blocks scrolling.
(() => {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const page = document.body.dataset.page;

  // header hairline
  const top = $('.top');
  const onScroll = () => top && top.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

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
    dedupe(ys).forEach(y => { const l = document.createElement('i'); l.className = 'h'; l.style.top = y + 'px'; l.style.transitionDelay = (i++ * 12) + 'ms'; g.appendChild(l); });
    dedupe(xs).forEach(x => { const l = document.createElement('i'); l.className = 'v'; l.style.left = x + 'px'; l.style.transitionDelay = (i++ * 12) + 'ms'; g.appendChild(l); });
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
      for (let k = 0; k < final.length; k++) {
        const ch = final[k];
        if (ch === ' ' || k < Math.floor(p * final.length)) out += ch;
        else out += glyphs[(Math.random() * glyphs.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step); else el.textContent = final;
    };
    requestAnimationFrame(step);
  }

  // ---------- count up ----------
  const fmt = n => n.toLocaleString('en-US');
  function countUp(el) {
    const to = +el.dataset.count; if (!isFinite(to)) return;
    const pre = el.dataset.pre || '', post = el.dataset.post || '';
    if (RM || to === 0) { el.textContent = pre + fmt(to) + post; return; }
    const start = performance.now(), dur = 1100 + Math.min(700, to);
    const step = now => {
      const p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + fmt(Math.round(to * e)) + post;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- reveal + counters on view ----------
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target; io.unobserve(el);
    if (el.hasAttribute('data-reveal')) el.classList.add('in');
    if (el.hasAttribute('data-count')) countUp(el);
    if (el.hasAttribute('data-type')) typeCode(el);
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  $$('[data-reveal]').forEach(el => io.observe(el));
  $$('[data-count]').forEach(el => { if (!el.closest('.hero')) io.observe(el); });

  // ---------- videos: play only while in view ----------
  const vio = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting && !v.dataset.paused) { if (!v.src && v.dataset.src) { v.src = v.dataset.src; } if (!RM || v.dataset.force) v.play().catch(() => {}); }
    else v.pause();
  }), { threshold: 0.25 });
  $$('video[data-src]').forEach(v => { if (!v.closest('.slide')) vio.observe(v); });

  $$('[data-playtoggle]').forEach(btn => {
    const v = $(btn.dataset.playtoggle);
    const sync = () => { btn.textContent = v.paused ? '▶ Play' : '❚❚ Pause'; btn.setAttribute('aria-pressed', String(!v.paused)); };
    btn.addEventListener('click', () => { if (v.paused) { delete v.dataset.paused; v.dataset.force = '1'; if (!v.src) v.src = v.dataset.src; v.play(); } else { v.dataset.paused = '1'; v.pause(); } sync(); });
    v.addEventListener('play', sync); v.addEventListener('pause', sync); sync();
  });

  // ---------- hero deck ----------
  function deck() {
    const root = $('.deck'); if (!root) return;
    const slides = $$('.slide', root), n = slides.length;
    const cur = $('.count b', root), live = $('.livelink', root), bar = $('.progress i', root);
    let i = 0, timer = null, hover = false, visible = true;
    const DUR = 6500;
    const show = (k, dir = 1) => {
      const prev = i; i = (k + n) % n;
      slides.forEach((s, j) => {
        const rel = (j - i + n) % n;
        let pos = rel === 0 ? '0' : rel === 1 ? '1' : rel === 2 ? '2' : 'hide';
        if (j === prev && j !== i && dir > 0) pos = 'out';
        s.dataset.pos = pos; s.setAttribute('aria-hidden', String(rel !== 0));
        const v = $('video', s);
        if (rel === 0) { if (!v.src) v.src = v.dataset.src; v.currentTime = 0; if (visible) v.play().catch(() => {}); }
        else v.pause();
        if (pos === 'out') setTimeout(() => { if (s.dataset.pos === 'out') s.dataset.pos = 'hide'; }, 600);
      });
      const s = slides[i];
      cur.textContent = String(i + 1).padStart(2, '0');
      if (s.dataset.url) { live.href = s.dataset.url; live.hidden = false; $('span.lbl', live).textContent = s.dataset.live === '1' ? 'Live' : 'Open'; $('.dot', live).className = 'dot' + (s.dataset.live === '1' ? ' live' : ''); }
      else { live.href = s.dataset.case; $('span.lbl', live).textContent = 'Case study'; $('.dot', live).className = 'dot'; }
      restart();
    };
    const restart = () => {
      clearTimeout(timer);
      if (bar) { bar.style.transition = 'none'; bar.style.transform = 'scaleX(0)'; }
      if (RM || hover || !visible) return;
      requestAnimationFrame(() => { if (bar) { bar.style.transition = `transform ${DUR}ms linear`; bar.style.transform = 'scaleX(1)'; } });
      timer = setTimeout(() => show(i + 1), DUR);
    };
    $('[data-prev]', root).addEventListener('click', () => show(i - 1, -1));
    $('[data-next]', root).addEventListener('click', () => show(i + 1));
    root.addEventListener('pointerenter', () => { hover = true; restart(); });
    root.addEventListener('pointerleave', () => { hover = false; restart(); });
    root.addEventListener('focusin', () => { hover = true; restart(); });
    root.addEventListener('focusout', () => { hover = false; restart(); });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; const v = $('video', slides[i]); if (visible) v.play().catch(() => {}); else v.pause(); restart(); }, { threshold: 0.2 }).observe(root);
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; restart(); });
    show(0);
  }

  // ---------- cursor pill ----------
  function pill() {
    if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    const p = document.createElement('div'); p.className = 'cpill'; p.setAttribute('aria-hidden', 'true'); document.body.appendChild(p);
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0;
    const loop = () => { x += (tx - x) * 0.22; y += (ty - y) * 0.22; p.style.left = x + 'px'; p.style.top = y + 'px'; raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(loop) : 0; };
    $$('[data-pill]').forEach(el => {
      el.addEventListener('pointerenter', e => { p.textContent = el.dataset.pill; tx = x = e.clientX; ty = y = e.clientY; p.classList.add('on'); });
      el.addEventListener('pointerleave', () => p.classList.remove('on'));
      el.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; if (RM) { x = tx; y = ty; p.style.left = x + 'px'; p.style.top = y + 'px'; } else if (!raf) raf = requestAnimationFrame(loop); });
    });
  }

  // ---------- keyboard shortcuts ----------
  const routes = JSON.parse(($('#routes') || {}).textContent || '{}');
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (/^[1-8]$/.test(e.key) && routes.cases) { location.href = routes.cases[+e.key - 1]; }
    else if (page === 'case' && e.key === 'ArrowLeft' && routes.prev) location.href = routes.prev;
    else if (page === 'case' && e.key === 'ArrowRight' && routes.next) location.href = routes.next;
    else if (page === 'case' && (e.key === 'h' || e.key === 'Escape') && routes.home) location.href = routes.home;
  });

  // ---------- contact.json types itself ----------
  function typeCode(pre) {
    const spans = $$('[data-t]', pre);
    const texts = spans.map(s => s.textContent);
    if (RM) return;
    spans.forEach(s => { s.textContent = ''; });
    const caret = document.createElement('span'); caret.className = 'caret'; caret.setAttribute('aria-hidden', 'true');
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
  $$('[data-type]').forEach(el => io.observe(el));

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

  // ---------- boot ----------
  const boot = () => {
    intro();
    setTimeout(() => $$('[data-scramble]').forEach(scramble), RM ? 0 : 300);
    setTimeout(() => $$('.hero [data-count]').forEach(countUp), RM ? 0 : 450);
    deck(); pill();
    // live dimension label on the selection box (measured, not typed)
    $$('.select .dim').forEach(d => { const r = d.parentElement.getBoundingClientRect(); d.textContent = Math.round(r.width) + ' × ' + Math.round(r.height); });
  };
  if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 900))]).then(boot); else boot();
})();
