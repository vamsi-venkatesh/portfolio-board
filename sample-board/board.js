// Sample — all seven live on one board. One camera over one board: the hero is the board zoomed out,
// scrolling flies the camera into each frame in turn, and the copy appears only up close.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sec = $('.bd'), stage = $('.bd-stage'), world = $('.bd-world'), intro = $('.bd-copy'), scrim = $('.bd-scrim'), edges = $('.bd-edges');
  const wins = $$('.bw'), panels = $$('.bp'), rail = $$('.bd-rail button'), ct = $('.bd-rail .ct'), hint = $('.bd-hint');
  const N = wins.length;
  const R = wins.map(w => ({ x: +w.dataset.x, y: +w.dataset.y, w: +w.dataset.w, h: 0 }));
  // scroll timeline in units: overview, then per product a flight and a hold
  const U_OV = 0.4, U_FLY = 1, U_HOLD = 0.9, SEG = U_FLY + U_HOLD, TOTAL = U_OV + N * SEG, VH_PER_UNIT = 0.6;
  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t;
  let W = 0, H = 0, HDR = 0, OV = null, F = [], scrollLen = 1, secTop = 0, flat = null, lastCur = -2, lastPan = -2;
  const t0 = performance.now();

  // count-up: same timing as the homepage (900 ms + up to 600 ms)
  const fmt = n => n.toLocaleString('en-US');
  function countUp(el) {
    if (el.dataset.counted) return; el.dataset.counted = '1';
    const to = +el.dataset.count; if (!isFinite(to) || RM || to === 0) return;
    const final = el.textContent, start = performance.now(), dur = 900 + Math.min(600, to);
    const step = now => {
      const p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? fmt(Math.round(to * e)) : final;
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = '0'; requestAnimationFrame(step);
  }

  function setFlat(on) {
    if (on === flat) return; flat = on;
    sec.classList.toggle('flat', on);
    if (on) wins.forEach((w, i) => { w.style.opacity = ''; w.classList.remove('pre'); panels[i].appendChild(w); });
    else wins.forEach(w => world.appendChild(w));
  }

  function measure() {
    W = innerWidth; HDR = $('.top') ? $('.top').offsetHeight : 0; H = innerHeight - HDR;
    document.documentElement.style.setProperty('--hdr', HDR + 'px');
    setFlat(W < 900);
    if (flat) { sec.style.height = ''; return; }
    sec.style.height = Math.round(H + TOTAL * VH_PER_UNIT * innerHeight) + 'px';
    secTop = sec.getBoundingClientRect().top + scrollY - HDR;
    scrollLen = Math.max(1, sec.offsetHeight - H);
    wins.forEach((w, i) => { R[i].h = w.offsetHeight; });
    // overview: the whole board fits right of the hero copy, bleeding a little off the right edge
    const keep = intro.style.translate; intro.style.translate = '';
    const ir = intro.getBoundingClientRect(); intro.style.translate = keep;
    const x0 = ir.right + 56, x1 = W - 28, y0 = 40, y1 = H - 64; // all seven fully in view
    const bx0 = Math.min(...R.map(r => r.x)), by0 = Math.min(...R.map(r => r.y)) - 40;
    const bx1 = Math.max(...R.map(r => r.x + r.w)), by1 = Math.max(...R.map(r => r.y + r.h));
    OV = { px: (bx0 + bx1) / 2, py: (by0 + by1) / 2, ax: (x0 + x1) / 2, ay: (y0 + y1) / 2,
      s: Math.min((x1 - x0) / (bx1 - bx0), (y1 - y0) / (by1 - by0)) };
    // close-up: each frame fills the space right of the copy column
    const pr = panels[0].getBoundingClientRect().right;
    stage.style.setProperty('--scrim-w', Math.round(pr + 50) + 'px');
    F = R.map(r => {
      const ww = Math.min(W * 0.54, W - pr - 56 - 36);
      const s = Math.min(ww / r.w, (H * 0.8) / r.h);
      return { px: r.x + r.w / 2, py: r.y + r.h / 2, ax: pr + 56 + (r.w * s) / 2, ay: H * 0.52, s };
    });
    const nb = $('.namebox'), dim = nb && $('.dim', nb);
    if (dim) dim.textContent = `${Math.round(nb.offsetWidth)} × ${Math.round(nb.offsetHeight)}`;
  }

  function state(u) {
    if (u <= U_OV) return { ...OV, cur: -1, phase: 'ov' };
    u -= U_OV;
    const i = Math.min(N - 1, Math.floor(u / SEG)), r = u - i * SEG;
    if (r >= U_FLY || u >= N * SEG) return { ...F[i], cur: i, phase: 'hold', i };
    const t = r / U_FLY, e = ease(t), A = i === 0 ? OV : F[i - 1], B = F[i], bump = i === 0 ? 0 : 0.4;
    const s = Math.exp(lerp(Math.log(A.s), Math.log(B.s), e)) * (1 - bump * Math.sin(Math.PI * e));
    // the copy leaves early and arrives late, so the middle of every flight is the board alone
    return { px: lerp(A.px, B.px, e), py: lerp(A.py, B.py, e), ax: lerp(A.ax, B.ax, e), ay: lerp(A.ay, B.ay, e), s,
      cur: t < 0.55 ? i - 1 : i, pan: t < 0.15 ? i - 1 : (t > 0.78 ? i : -1), phase: 'fly', i, t, e };
  }

  // the camera follows the scroll through a damper, so even a fast flick plays as a flight, never a jump
  let su = null, lastNow = 0, lastBg = '', lastCover = '', lastTf = '';
  function render(now) {
    if (flat || !OV) return;
    const target = clamp((scrollY - secTop) / scrollLen, 0, 1) * TOTAL;
    const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
    if (su === null || RM) su = target; else su += (target - su) * (1 - Math.exp(-dt / 0.2));
    if (Math.abs(target - su) < 1e-4) su = target;
    const st = state(su);
    let s = st.s;
    if (st.phase === 'ov' && !RM) s *= 1 + 0.07 * (1 - ease(clamp((now - t0) / 1700, 0, 1))); // camera settles on load
    const tx = st.ax - st.px * s, ty = st.ay - st.py * s;
    const tf = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${s.toFixed(5)})`;
    if (tf !== lastTf) { lastTf = tf; world.style.transform = tf; world.style.setProperty('--inv', (1 / s).toFixed(4)); }

    // the graph paper belongs to the board: it zooms and pans with the camera
    const maj = 120 * s, mi = 24 * s;
    const aMaj = (0.075 * clamp((maj - 20) / 40, 0.45, 1)).toFixed(4), aMin = (0.045 * clamp((mi - 6) / 12, 0, 1)).toFixed(4);
    const g = a => `linear-gradient(rgba(22,21,19,${a}) 1px,transparent 1px),linear-gradient(90deg,rgba(22,21,19,${a}) 1px,transparent 1px)`;
    const m = (v, d) => (((v % d) + d) % d).toFixed(2);
    const bgI = `${g(aMaj)},${g(aMin)}`, bgS = `${maj}px ${maj}px,${maj}px ${maj}px,${mi}px ${mi}px,${mi}px ${mi}px`;
    const bgP = `${m(tx, maj)}px ${m(ty, maj)}px,${m(tx, maj)}px ${m(ty, maj)}px,${m(tx, mi)}px ${m(ty, mi)}px,${m(tx, mi)}px ${m(ty, mi)}px`;
    const key = bgI + bgS + bgP;
    if (key !== lastBg) { lastBg = key; for (const el of [stage, scrim, edges]) { el.style.backgroundImage = bgI; el.style.backgroundSize = bgS; el.style.backgroundPosition = bgP; } }
    const cover = (st.phase === 'ov' ? 0 : st.phase === 'hold' ? 1
      : st.i === 0 ? st.e : 1 - 0.9 * Math.sin(Math.PI * st.e)).toFixed(3); // nearly gone mid-flight: the leaving frame stays crisp
    if (cover !== lastCover) { lastCover = cover; scrim.style.opacity = cover; edges.style.opacity = cover; }

    // hero copy steps aside as the camera leaves the overview
    const k = st.phase === 'ov' ? 0 : (st.phase === 'fly' && st.i === 0 ? st.t : 1);
    const io = 1 - clamp(k / 0.4, 0, 1);
    intro.style.opacity = io.toFixed(3);
    intro.style.translate = `${(-80 * (1 - io)).toFixed(1)}px 0`;
    intro.style.visibility = io < 0.01 ? 'hidden' : '';
    hint.style.opacity = st.phase === 'ov' ? 1 : 0;

    // focus: the frame in view stays bright, the rest of the board recedes (and lifts during a flight)
    wins.forEach((w, j) => {
      let o = 1;
      if (st.phase === 'hold') o = j === st.cur ? 1 : 0.16;
      else if (st.phase === 'fly') {
        if (st.i === 0) o = j === 0 ? 1 : lerp(1, 0.16, st.e);
        else o = (j === st.i || j === st.i - 1) ? 1 : lerp(0.16, 0.8, Math.sin(Math.PI * st.e));
      }
      w.style.opacity = o.toFixed(3);
      const near = st.phase === 'hold' ? j === st.cur
        : st.phase === 'fly' && ((st.t > 0.82 && j === st.i) || (st.t < 0.18 && j === st.i - 1));
      w.classList.toggle('focus', !!near);
    });

    const pan = st.phase === 'hold' ? st.cur : st.phase === 'fly' ? st.pan : -1;
    if (pan !== lastPan) {
      if (lastPan >= 0) { const old = panels[lastPan]; old.classList.remove('on'); old.classList.add('past'); setTimeout(() => old.classList.remove('past'), 450); }
      if (pan >= 0) { const pn = panels[pan]; pn.classList.remove('past'); pn.classList.add('on'); $$('[data-count]', pn).forEach(countUp); }
      lastPan = pan;
    }
    if (st.cur !== lastCur) {
      rail.forEach((b, j) => b.classList.toggle('on', j === st.cur));
      ct.textContent = st.cur >= 0 ? `${String(st.cur + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}` : `— / ${String(N).padStart(2, '0')}`;
      lastCur = st.cur;
    }
  }

  const stopY = i => secTop + ((U_OV + i * SEG + U_FLY + U_HOLD * 0.35) / TOTAL) * scrollLen;
  const holdEndY = i => secTop + ((U_OV + i * SEG + U_FLY + U_HOLD * 0.97) / TOTAL) * scrollLen;
  wins.forEach((w, i) => {
    w.addEventListener('pointerenter', () => w.classList.add('hover'));
    w.addEventListener('pointerleave', () => w.classList.remove('hover'));
    w.addEventListener('click', e => { if (flat) return; e.preventDefault(); scrollTo({ top: stopY(i), behavior: RM ? 'auto' : 'smooth' }); });
  });
  rail.forEach((b, i) => b.addEventListener('click', () => scrollTo({ top: stopY(i), behavior: RM ? 'auto' : 'smooth' })));
  $$('a[href="#work"]').forEach(a => a.addEventListener('click', e => { if (flat) return; e.preventDefault(); scrollTo({ top: stopY(0), behavior: RM ? 'auto' : 'smooth' }); }));

  // reveals below the board (the homepage's own classes)
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
  $$('[data-reveal],[data-wipe]').forEach(el => io.observe(el));
  $$('[data-count]').forEach(el => { if (!el.closest('.bp') && !el.closest('.develop')) io.observe(el); });

  // live loops: every frame plays at once
  $$('video').forEach(v => { v.muted = true; v.playsInline = true; const go = () => v.play().catch(() => {}); go(); v.addEventListener('canplay', go, { once: true }); });

  measure();
  addEventListener('resize', measure);
  // the hero copy "develops" from blur to sharp, as on the homepage
  setTimeout(() => $('.bd-intro').classList.add('sharp'), RM ? 0 : 250);
  if (document.fonts) document.fonts.ready.then(measure);
  // frames drop onto the board one by one; each flashes its selection as it lands
  wins.forEach((w, i) => setTimeout(() => {
    w.classList.remove('pre');
    if (!RM) { w.classList.add('flash'); setTimeout(() => w.classList.remove('flash'), 520); }
  }, RM ? 0 : 160 + i * 95));
  $$('.develop [data-count]').forEach(el => setTimeout(() => countUp(el), RM ? 0 : 450));
  const loop = now => { render(now); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  window.__board = { stopY, holdEndY, N, get flat() { return flat; } };
})();
