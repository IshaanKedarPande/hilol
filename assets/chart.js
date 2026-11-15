/* SI disclosure: this file was generated with the help of Claude (Anthropic), a Super Intelligence tool, and reviewed by team Hilol. */
/* Interactive monthly time-series chart (plain SVG, no library).
   - Drag a box on the chart to zoom (sideways swipe on touch screens).
   - Shift-drag, or switch to Pan mode, to move around. Ctrl/⌘ + scroll or pinch zooms too.
   - Double-click or Reset to see the whole record again.
   - Overview strip underneath: drag the window or its edges.
   - Keyboard: ←/→ read months, Shift+←/→ pan, + / − zoom, 0 reset.
   - Click a legend item to hide or show that line. CSV downloads the months in view.
   Usage: const c = TDChart(element, options); c.update(data, { keepView }) */
(function () {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const NS = 'http://www.w3.org/2000/svg';
  const mIdx = ym => { const [y, m] = ym.split('-').map(Number); return y * 12 + (m - 1); };
  const split = i => { i = Math.round(i); const y = Math.floor(i / 12); return [y, i - y * 12]; };
  const mLabel = (i, short) => { const [y, m] = split(i); return short ? `${MONTHS[m]} '${String(y).slice(2)}` : `${MONTHS[m]} ${y}`; };
  const ymOf = i => { const [y, m] = split(i); return `${y}-${String(m + 1).padStart(2, '0')}`; };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const fmt = (v, signed) => (window.TD ? TD.fmtNum(v, 3, signed) : (+v).toPrecision(3));
  let uid = 0;

  function niceTicks(min, max, count) {
    const span = max - min || Math.abs(max) || 1;
    const raw = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= count) || 10 * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = []; for (let t = lo; t <= hi + step / 2; t += step) ticks.push(+t.toPrecision(12));
    return ticks;
  }

  function TDChart(box, opts) {
    const o = Object.assign({ height: 360, zoom: true, overview: true, legend: true, csv: true }, opts || {});
    const id = 'tdc' + (++uid);
    box.classList.add('tdc');
    box.innerHTML = `
      ${o.legend || o.zoom ? `<div class="tdc-bar">
        ${o.legend ? '<div class="tdc-legend" role="group" aria-label="Lines on the chart (click to hide or show)"></div>' : '<span></span>'}
        ${o.zoom ? `<div class="tdc-tools" role="toolbar" aria-label="Zoom controls">
          <div class="seg seg-sm" role="group" aria-label="What dragging on the chart does">
            <button type="button" data-mode="zoom" aria-pressed="true" title="Drag a box on the chart to zoom in">Box zoom</button>
            <button type="button" data-mode="pan" aria-pressed="false" title="Drag the chart to move around">Pan</button>
          </div>
          <button type="button" class="tbtn" data-act="out" aria-label="Zoom out" title="Zoom out (−)">−</button>
          <button type="button" class="tbtn" data-act="in" aria-label="Zoom in" title="Zoom in (+)">+</button>
          <button type="button" class="tbtn" data-act="reset" title="Show the whole record (0)">Reset</button>
          ${o.csv ? '<button type="button" class="tbtn" data-act="csv" title="Download the months currently in view as a CSV file">CSV</button>' : ''}
        </div>` : ''}
      </div>` : ''}
      <div class="tdc-plot">
        <svg class="tdc-main" role="img" tabindex="0" aria-labelledby="${id}-t ${id}-d"></svg>
        <div class="tooltip" aria-hidden="true"></div>
      </div>
      ${o.zoom && o.overview ? '<svg class="tdc-over" aria-hidden="true"></svg>' : ''}
      ${o.zoom ? `<div class="tdc-status"><span class="tdc-range"></span><span class="tdc-hint">${coarse
        ? 'Swipe sideways across the chart to zoom in. Drag the strip below to move.'
        : 'Drag a box on the chart to zoom in. Double-click or Reset to zoom out. Shift-drag to pan.'}</span></div>
      <p class="sr-only" aria-live="polite"></p>` : ''}`;

    const svg = box.querySelector('.tdc-main'), plot = box.querySelector('.tdc-plot'), tip = box.querySelector('.tooltip');
    const over = box.querySelector('.tdc-over'), legendEl = box.querySelector('.tdc-legend');
    const rangeEl = box.querySelector('.tdc-range'), live = box.querySelector('[aria-live]');

    let D = null, full = null, G = null, mode = 'zoom', cur = -1, drag = null, lastW = 0;
    const view = { x0: null, x1: null, y: null };
    const hidden = new Set();

    const vx = () => [view.x0 ?? full.x0, view.x1 ?? full.x1];
    const zoomed = () => view.x0 !== null || view.y !== null;
    const trendAt = (t, i) => t.y[0] + (t.y[1] - t.y[0]) * (i - t.x[0]) / ((t.x[1] - t.x[0]) || 1);
    const fmtVal = v => `${fmt(v, D.signed)} ${D.unit || ''}`.trim();

    /* ---------- data ---------- */
    function update(d, { keepView = false } = {}) {
      const lines = d.lines.map(l => {
        const xs = l.dates.map(mIdx), byX = new Map();
        xs.forEach((x, k) => { const v = l.ys[k]; if (v !== null && v !== undefined && isFinite(v)) byX.set(x, v); });
        return Object.assign({}, l, { xs, byX });
      });
      const trends = (d.trends || []).map(t => Object.assign({}, t, { x: t.dates.map(mIdx) }));
      D = Object.assign({}, d, { lines, trends });
      const ends = lines.flatMap(l => [l.xs[0], l.xs[l.xs.length - 1]]);
      const nf = { x0: Math.min(...ends), x1: Math.max(...ends) };
      if (!keepView || !full || nf.x0 !== full.x0 || nf.x1 !== full.x1) { view.x0 = view.x1 = null; }
      view.y = null;
      full = nf;
      if (cur >= lines[0].xs.length) cur = -1;
      buildLegend();
      render();
    }

    function buildLegend() {
      if (!legendEl) return;
      const P = D.lines[0];
      const hasGaps = P.xs.some((x, k) => k > 0 && x - P.xs[k - 1] > 1);
      const items = D.lines.map(l => ({ id: l.id, label: l.label, sw: `<i style="border-top:2px solid ${l.color}"></i>` }))
        .concat(D.trends.map(t => ({ id: t.id, label: t.label, sw: `<i style="border-top:2.5px dashed ${t.color}"></i>` })));
      legendEl.innerHTML = items.map(it =>
        `<button type="button" class="lg" data-id="${esc(it.id)}" aria-pressed="${!hidden.has(it.id)}">${it.sw}${esc(it.label)}</button>`).join('')
        + (D.zero ? '<span class="lg static"><i class="zero"></i>Normal (0)</span>' : '')
        + (hasGaps ? '<span class="lg static"><i class="gapsw"></i>No data</span>' : '');
      legendEl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        const lid = b.dataset.id;
        if (hidden.has(lid)) hidden.delete(lid);
        else {
          const isLine = D.lines.some(l => l.id === lid);
          if (isLine && D.lines.filter(l => !hidden.has(l.id)).length === 1) return; // keep at least one line
          hidden.add(lid);
        }
        b.setAttribute('aria-pressed', String(!hidden.has(lid)));
        render();
      }));
    }

    /* ---------- drawing ---------- */
    function render() {
      if (!D) return;
      const W = Math.max(280, Math.round(plot.clientWidth || 760)); lastW = W;
      const narrow = W < 520;
      const H = narrow ? Math.min(o.height, 280) : o.height;
      const M = { t: 12, r: narrow ? 12 : 18, b: 30, l: narrow ? 56 : 68 };
      const pw = W - M.l - M.r, ph = H - M.t - M.b;
      const [x0, x1] = vx();
      const lines = D.lines.filter(l => !hidden.has(l.id));
      const trends = D.trends.filter(t => !hidden.has(t.id));

      // y range: fit what is visible
      let lo = Infinity, hi = -Infinity;
      lines.forEach(l => l.xs.forEach((x, k) => {
        if (x < x0 - 1 || x > x1 + 1) return;
        const v = l.ys[k]; if (v === null || v === undefined) return;
        if (v < lo) lo = v; if (v > hi) hi = v;
      }));
      trends.forEach(t => [Math.max(x0, t.x[0]), Math.min(x1, t.x[1])].forEach(i => { const v = trendAt(t, i); lo = Math.min(lo, v); hi = Math.max(hi, v); }));
      if (!isFinite(lo)) { lo = -1; hi = 1; }
      if (D.symmetric && view.x0 === null) { const a = Math.max(Math.abs(lo), Math.abs(hi)); lo = -a; hi = a; }
      if (hi - lo < 1e-12) { const a = Math.abs(hi) * 0.1 || 1; lo -= a; hi += a; }
      let yMin, yMax, yt;
      if (view.y) {
        [yMin, yMax] = view.y;
        const e = (yMax - yMin) * 1e-9;
        yt = niceTicks(yMin, yMax, narrow ? 4 : 5).filter(t => t >= yMin - e && t <= yMax + e);
      } else {
        const pad = (hi - lo) * 0.03;
        yt = niceTicks(lo - pad, hi + pad, narrow ? 4 : 5); yMin = yt[0]; yMax = yt[yt.length - 1];
      }
      const X = i => M.l + (i - x0) / (x1 - x0) * pw;
      const Y = v => M.t + (1 - (v - yMin) / (yMax - yMin)) * ph;
      G = { W, H, M, pw, ph, x0, x1, yMin, yMax, X, Y };

      // x ticks adapt to the zoom level: years, then quarters, then months
      const span = x1 - x0, maxT = Math.max(2, Math.floor(pw / (narrow ? 66 : 92)));
      const step = [1, 2, 3, 6, 12, 24, 36, 60, 120].find(s => span / s <= maxT) || 120;
      let xt = '';
      for (let i = Math.ceil(x0 / step - 1e-9) * step; i <= x1 + 1e-9; i += step) {
        const px = X(i).toFixed(1);
        xt += `<line class="tick" x1="${px}" x2="${px}" y1="${M.t + ph}" y2="${M.t + ph + 5}"/><text x="${px}" y="${M.t + ph + 19}" text-anchor="middle">${step >= 12 ? split(i)[0] : mLabel(i, narrow)}</text>`;
      }
      const yTicks = yt.map(t => `<line class="grid" x1="${M.l}" x2="${M.l + pw}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/><text x="${M.l - 8}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end">${fmt(t, D.signed)}</text>`).join('');

      // shaded gaps (months with no data in the main line)
      const P = D.lines[0];
      let gaps = '';
      for (let k = 1; k < P.xs.length; k++) {
        if (P.xs[k] - P.xs[k - 1] <= 1) continue;
        const a = X(P.xs[k - 1]), b = X(P.xs[k]);
        if (b > M.l && a < M.l + pw) gaps += `<rect x="${a.toFixed(1)}" y="${M.t}" width="${(b - a).toFixed(1)}" height="${ph}" fill="url(#${id}-h)"/>`;
      }

      // lines: draw every month as a dot once there is room to see them
      const nVis = P.xs.filter(x => x >= x0 && x <= x1).length;
      const allDots = nVis > 0 && nVis < pw / 9;
      const paths = lines.slice().reverse().map(l => {
        let d = '', dots = '', prev = null;
        for (let k = 0; k < l.xs.length; k++) {
          const x = l.xs[k], v = l.ys[k];
          if (x < x0 - 2 || x > x1 + 2 || v === null || v === undefined) { prev = null; continue; }
          const brk = prev === null || x - prev > 1;
          const px = X(x).toFixed(1), py = Y(v).toFixed(1);
          d += (brk ? 'M' : 'L') + px + ',' + py;
          const isolated = brk && (k === l.xs.length - 1 || l.xs[k + 1] - x > 1);
          if (allDots || isolated) dots += `<circle cx="${px}" cy="${py}" r="${allDots ? 2.6 : 2.2}" fill="${l.color}"/>`;
          prev = x;
        }
        return `<path d="${d}" fill="none" stroke="${l.color}" stroke-width="${l.width || 1.6}" stroke-linejoin="round"/>${dots}`;
      }).join('');

      const tr = trends.map(t => {
        const a = Math.max(x0, t.x[0]), b = Math.min(x1, t.x[1]);
        if (b <= a) return '';
        return `<path d="M${X(a).toFixed(1)},${Y(trendAt(t, a)).toFixed(1)}L${X(b).toFixed(1)},${Y(trendAt(t, b)).toFixed(1)}" stroke="${t.color}" stroke-width="${t.width || 2.4}" stroke-dasharray="7 5" fill="none"/>`;
      }).join('');
      const zero = D.zero && yMin < 0 && yMax > 0 ? `<line class="zero" x1="${M.l}" x2="${M.l + pw}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}"/>` : '';

      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = `<title id="${id}-t">${esc(D.title)}</title>
        <desc id="${id}-d">${esc(D.desc)} ${o.zoom ? 'Use the left and right arrow keys to read individual months, plus and minus to zoom, Shift with the arrow keys to move, and 0 to reset.' : 'Use the left and right arrow keys to read individual months.'}</desc>
        <defs>
          <clipPath id="${id}-c"><rect x="${M.l}" y="${M.t - 1}" width="${pw}" height="${ph + 2}"/></clipPath>
          <pattern id="${id}-h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.5" height="6" fill="#1f2a42"/></pattern>
        </defs>
        <g class="axis">${yTicks}${xt}
          <line class="base" x1="${M.l}" x2="${M.l + pw}" y1="${M.t + ph}" y2="${M.t + ph}"/>
          <text class="ylab" transform="translate(13 ${M.t + ph / 2}) rotate(-90)" text-anchor="middle">${esc(D.yLabel)}</text>
        </g>
        <g clip-path="url(#${id}-c)">${gaps}${zero}${paths}${tr}</g>
        <g class="hover" style="display:none"><line class="hx" y1="${M.t}" y2="${M.t + ph}"/></g>
        <rect class="sel" style="display:none"/>
        <rect class="hit" x="${M.l}" y="${M.t}" width="${pw}" height="${ph}" fill="transparent"/>`;
      tip.style.opacity = 0;

      if (over) renderOverview();
      status();
    }

    function renderOverview() {
      const { W, M, pw, x0, x1 } = G, OH = 42, P = D.lines[0];
      const ox = i => M.l + (i - full.x0) / (full.x1 - full.x0) * pw;
      let lo = Infinity, hi = -Infinity;
      P.ys.forEach(v => { if (v !== null && v !== undefined) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
      if (hi - lo < 1e-12) { hi += 1; lo -= 1; }
      const oy = v => 4 + (1 - (v - lo) / (hi - lo)) * (OH - 8);
      let d = '';
      P.xs.forEach((x, k) => { d += (k === 0 || x - P.xs[k - 1] > 1 ? 'M' : 'L') + ox(x).toFixed(1) + ',' + oy(P.ys[k]).toFixed(1); });
      const a = ox(x0), b = ox(x1);
      over.setAttribute('viewBox', `0 0 ${W} ${OH}`);
      over.innerHTML = `<rect class="o-bg" x="${M.l}" y="0" width="${pw}" height="${OH}"/>
        <path class="o-line" d="${d}"/>
        <rect class="o-dim" x="${M.l}" y="0" width="${Math.max(0, a - M.l)}" height="${OH}"/>
        <rect class="o-dim" x="${b}" y="0" width="${Math.max(0, M.l + pw - b)}" height="${OH}"/>
        <rect class="o-win" x="${a}" y="0.5" width="${Math.max(2, b - a)}" height="${OH - 1}"/>
        <rect class="o-h" x="${a - 4}" y="${OH / 2 - 10}" width="8" height="20" rx="2"/>
        <rect class="o-h" x="${b - 4}" y="${OH / 2 - 10}" width="8" height="20" rx="2"/>`;
      G.ox = ox;
    }

    function status() {
      if (!rangeEl) return;
      const [x0, x1] = vx(), xs = D.lines[0].xs.filter(x => x >= x0 - 1e-9 && x <= x1 + 1e-9);
      rangeEl.textContent = xs.length
        ? `${zoomed() ? 'Zoomed in:' : 'Whole record:'} ${mLabel(xs[0])} – ${mLabel(xs[xs.length - 1])} · ${xs.length} month${xs.length === 1 ? '' : 's'}`
        : 'No data in this range';
    }
    function announce() { if (live && rangeEl) live.textContent = rangeEl.textContent; }

    /* ---------- tooltip ---------- */
    function hideTip() {
      tip.style.opacity = 0;
      const hg = svg.querySelector('.hover'); if (hg) hg.style.display = 'none';
    }
    function show(k) {
      const P = D && D.lines[0];
      if (!G || !P || k < 0 || k >= P.xs.length) return;
      cur = k;
      const xi = P.xs[k];
      if (xi < G.x0 || xi > G.x1) return hideTip();
      const px = G.X(xi), hg = svg.querySelector('.hover');
      hg.style.display = '';
      hg.querySelectorAll('circle').forEach(c => c.remove());
      const hx = hg.querySelector('.hx'); hx.setAttribute('x1', px); hx.setAttribute('x2', px);
      let rows = '', topY = Infinity;
      D.lines.forEach(l => {
        if (hidden.has(l.id)) return;
        const v = l.byX.get(xi); if (v === undefined) return;
        const py = G.Y(v);
        if (py >= G.M.t - 1 && py <= G.M.t + G.ph + 1) {
          const c = document.createElementNS(NS, 'circle');
          c.setAttribute('cx', px); c.setAttribute('cy', py); c.setAttribute('r', 4.5);
          c.setAttribute('fill', l.color); c.setAttribute('stroke', '#0d1526'); c.setAttribute('stroke-width', 2);
          hg.appendChild(c); topY = Math.min(topY, py);
        }
        rows += `<div><i style="background:${l.color}"></i>${esc(l.label)}: <b>${esc(fmtVal(v))}</b></div>`;
      });
      D.trends.forEach(t => {
        if (hidden.has(t.id) || xi < t.x[0] || xi > t.x[1]) return;
        rows += `<div><i class="dash" style="border-color:${t.color}"></i>${esc(t.label)}: ${esc(fmtVal(trendAt(t, xi)))}</div>`;
      });
      tip.innerHTML = `<b>${mLabel(xi)}</b>${rows}`;
      const r = svg.getBoundingClientRect(), sc = r.width / G.W;
      const ty = (isFinite(topY) ? topY : G.M.t + G.ph / 2) * sc;
      const half = Math.min(tip.offsetWidth / 2 + 4, r.width / 2);
      tip.style.left = clamp(px * sc, half, r.width - half) + 'px';
      tip.style.top = ty + 'px';
      tip.classList.toggle('below', ty < tip.offsetHeight + 16);
      tip.style.opacity = 1;
    }
    function nearestK(px) {
      const i = G.x0 + (px - G.M.l) / G.pw * (G.x1 - G.x0), xs = D.lines[0].xs;
      let lo = 0, hi = xs.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] < i) lo = m; else hi = m; }
      return Math.abs(xs[lo] - i) <= Math.abs(xs[hi] - i) ? lo : hi;
    }

    /* ---------- zoom state ---------- */
    function setX(a, b) {
      const fs = full.x1 - full.x0;
      let span = b - a;
      if (span >= fs - 1e-9) { view.x0 = view.x1 = null; return; }
      if (span < 3) { const c = (a + b) / 2; a = c - 1.5; b = c + 1.5; span = 3; }
      if (a < full.x0) { a = full.x0; b = a + span; }
      if (b > full.x1) { b = full.x1; a = b - span; }
      view.x0 = a; view.x1 = b;
    }
    function zoomBy(f, center) {
      const [x0, x1] = vx(), P = D.lines[0];
      const c = center ?? ((cur >= 0 && P.xs[cur] >= x0 && P.xs[cur] <= x1) ? P.xs[cur] : (x0 + x1) / 2);
      setX(c - (c - x0) * f, c + (x1 - c) * f);
      view.y = null; render(); announce();
    }
    function reset() { view.x0 = view.x1 = view.y = null; render(); announce(); }

    /* ---------- pointer: box zoom / pan / hover ---------- */
    const pt = e => { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * G.W, y: (e.clientY - r.top) / r.height * G.H }; };
    function selBox(d) {
      const { M, pw, ph } = G;
      const xa = clamp(Math.min(d.sx, d.x), M.l, M.l + pw), xb = clamp(Math.max(d.sx, d.x), M.l, M.l + pw);
      const xOnly = d.touch || Math.abs(d.y - d.sy) < 14;
      const ya = xOnly ? M.t : clamp(Math.min(d.sy, d.y), M.t, M.t + ph);
      const yb = xOnly ? M.t + ph : clamp(Math.max(d.sy, d.y), M.t, M.t + ph);
      return { xa, xb, ya, yb, xOnly };
    }

    svg.addEventListener('pointerdown', e => {
      if (!o.zoom || !G || (e.pointerType === 'mouse' && e.button !== 0) || !e.target.classList.contains('hit')) return;
      const p = pt(e);
      drag = { pan: (mode === 'pan') !== e.shiftKey, touch: e.pointerType !== 'mouse', sx: p.x, sy: p.y, x: p.x, y: p.y,
               x0: G.x0, x1: G.x1, y0: G.yMin, y1: G.yMax, moved: false };
      try { svg.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      if (e.pointerType === 'mouse') e.preventDefault();
    });
    svg.addEventListener('pointermove', e => {
      if (!G) return;
      const p = pt(e);
      if (!drag) { show(nearestK(p.x)); return; }
      drag.x = p.x; drag.y = p.y;
      if (!drag.moved && (Math.abs(p.x - drag.sx) > 4 || Math.abs(p.y - drag.sy) > 4)) {
        drag.moved = true; box.classList.add('dragging'); hideTip();
      }
      if (!drag.moved) return;
      if (drag.pan) {
        const di = -(p.x - drag.sx) / G.pw * (drag.x1 - drag.x0);
        setX(drag.x0 + di, drag.x1 + di);
        if (view.y) { const dv = (p.y - drag.sy) / G.ph * (drag.y1 - drag.y0); view.y = [drag.y0 + dv, drag.y1 + dv]; }
        render();
      } else {
        const s = selBox(drag), r = svg.querySelector('.sel');
        r.style.display = '';
        r.setAttribute('x', s.xa); r.setAttribute('width', Math.max(0, s.xb - s.xa));
        r.setAttribute('y', s.ya); r.setAttribute('height', Math.max(0, s.yb - s.ya));
      }
    });
    function endDrag(cancel) {
      if (!drag) return;
      const d = drag; drag = null; box.classList.remove('dragging');
      const r = svg.querySelector('.sel'); if (r) r.style.display = 'none';
      if (cancel) return;
      if (!d.moved) { if (d.touch) show(nearestK(d.sx)); return; }
      if (d.pan) { announce(); return; }
      const s = selBox(d);
      if (s.xb - s.xa < 6) return;
      const ix = px => G.x0 + (px - G.M.l) / G.pw * (G.x1 - G.x0);
      const iy = py => G.yMin + (1 - (py - G.M.t) / G.ph) * (G.yMax - G.yMin);
      const ny = s.xOnly ? null : [iy(s.yb), iy(s.ya)];
      setX(ix(s.xa), ix(s.xb));
      view.y = ny;
      render(); announce();
    }
    svg.addEventListener('pointerup', () => endDrag(false));
    svg.addEventListener('pointercancel', () => endDrag(true));
    svg.addEventListener('pointerleave', () => { if (!drag) hideTip(); });
    svg.addEventListener('blur', hideTip);
    svg.addEventListener('dblclick', () => { if (o.zoom) reset(); });
    if (o.zoom) svg.addEventListener('wheel', e => {
      if (!(e.ctrlKey || e.metaKey) || !G) return; // plain scrolling keeps scrolling the page
      e.preventDefault();
      const p = pt(e), [x0, x1] = vx();
      zoomBy(Math.exp(clamp(e.deltaY, -60, 60) * 0.01), x0 + clamp((p.x - G.M.l) / G.pw, 0, 1) * (x1 - x0));
    }, { passive: false });

    /* ---------- keyboard ---------- */
    svg.addEventListener('keydown', e => {
      const P = D && D.lines[0]; if (!P) return;
      const k = e.key, [x0, x1] = vx();
      if (o.zoom && e.shiftKey && (k === 'ArrowRight' || k === 'ArrowLeft')) {
        e.preventDefault();
        const dd = (x1 - x0) * 0.2 * (k === 'ArrowRight' ? 1 : -1);
        setX(x0 + dd, x1 + dd); render(); announce(); return;
      }
      if (o.zoom && (k === '+' || k === '=')) { e.preventDefault(); zoomBy(0.5); return; }
      if (o.zoom && (k === '-' || k === '_')) { e.preventDefault(); zoomBy(2); return; }
      if (o.zoom && (k === '0' || k === 'Escape') && zoomed()) { e.preventDefault(); reset(); return; }
      let n = null;
      const firstVis = () => Math.max(0, P.xs.findIndex(x => x >= x0));
      if (k === 'ArrowRight') n = cur < 0 ? firstVis() : cur + 1;
      else if (k === 'ArrowLeft') n = cur < 0 ? firstVis() : cur - 1;
      else if (k === 'Home') n = 0;
      else if (k === 'End') n = P.xs.length - 1;
      if (n === null) return;
      e.preventDefault();
      n = clamp(n, 0, P.xs.length - 1);
      const xi = P.xs[n];
      if (xi < x0 || xi > x1) { const s = x1 - x0; setX(xi - s / 2, xi + s / 2); render(); }
      show(n);
    });

    /* ---------- toolbar ---------- */
    box.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      mode = b.dataset.mode;
      box.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      box.classList.toggle('pan', mode === 'pan');
    }));
    box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'in') zoomBy(0.5); else if (a === 'out') zoomBy(2); else if (a === 'reset') reset(); else if (a === 'csv') csv();
    }));

    function csv() {
      const [x0, x1] = vx(), months = new Set();
      D.lines.forEach(l => l.xs.forEach(x => { if (x >= x0 - 1e-9 && x <= x1 + 1e-9) months.add(x); }));
      const sorted = [...months].sort((a, b) => a - b);
      if (!sorted.length) return;
      const q = s => `"${String(s).replace(/"/g, '""')}"`;
      const head = ['month'].concat(D.lines.map(l => q(l.csvLabel || l.label)));
      const rows = sorted.map(x => [ymOf(x)].concat(D.lines.map(l => { const v = l.byX.get(x); return v === undefined ? '' : v; })).join(','));
      const blob = new Blob([head.join(',') + '\n' + rows.join('\n') + '\n'], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${D.csvName || 'data'}_${ymOf(sorted[0])}_to_${ymOf(sorted[sorted.length - 1])}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    /* ---------- overview strip ---------- */
    if (over) {
      let od = null;
      const opx = e => { const r = over.getBoundingClientRect(); return (e.clientX - r.left) / r.width * G.W; };
      const oinv = px => full.x0 + (px - G.M.l) / G.pw * (full.x1 - full.x0);
      over.addEventListener('pointerdown', e => {
        if (!G || (e.pointerType === 'mouse' && e.button !== 0)) return;
        const px = opx(e), [x0, x1] = vx(), a = G.ox(x0), b = G.ox(x1);
        let kind;
        if (Math.abs(px - a) <= 9 && px <= (a + b) / 2) kind = 'l';
        else if (Math.abs(px - b) <= 9) kind = 'r';
        else if (px > a && px < b && zoomed()) kind = 'move';
        else if (zoomed()) { const s = x1 - x0, c = oinv(px); setX(c - s / 2, c + s / 2); render(); kind = 'move'; }
        else kind = 'brush';
        const [nx0, nx1] = vx();
        od = { kind, sx: px, x0: nx0, x1: nx1 };
        try { over.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        e.preventDefault();
      });
      over.addEventListener('pointermove', e => {
        if (!od) return;
        const px = opx(e), di = (px - od.sx) / G.pw * (full.x1 - full.x0);
        if (od.kind === 'move') setX(od.x0 + di, od.x1 + di);
        else if (od.kind === 'l') setX(clamp(od.x0 + di, full.x0, od.x1 - 3), od.x1);
        else if (od.kind === 'r') setX(od.x0, clamp(od.x1 + di, od.x0 + 3, full.x1));
        else { if (Math.abs(px - od.sx) < 4) return; setX(oinv(Math.min(px, od.sx)), oinv(Math.max(px, od.sx))); }
        render();
      });
      const oend = () => { if (od) { od = null; announce(); } };
      over.addEventListener('pointerup', oend);
      over.addEventListener('pointercancel', oend);
    }

    if ('ResizeObserver' in window) {
      new ResizeObserver(() => { const w = Math.round(plot.clientWidth); if (D && w && Math.abs(w - lastW) > 1) render(); }).observe(plot);
    } else {
      window.addEventListener('resize', () => render());
    }

    return { update, reset, zoomBy };
  }

  window.TDChart = TDChart;
})();
