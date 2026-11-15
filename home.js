/* Landing page: step-by-step method demo, filterable grid of all records, starting-point verdicts. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtMonth = ym => { const [y, m] = ym.split('-'); return `${MONTHS[+m - 1]} ${y}`; };
  const mi = ym => { const [y, m] = ym.split('-').map(Number); return y * 12 + (m - 1); };
  const C = { data: '#6aa8ff', trend: '#ff8a4c', ns: '#8d9bb5' };
  const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  TD.load().then(({ results, content }) => {
    const BY = Object.fromEntries(results.map(r => [r.id, r]));
    const place = id => content.locations[id]?.place || BY[id].location;
    const V = r => content.variables[r.variable];
    const order = content.categories.flatMap(c => Object.keys(content.variables).filter(v => content.variables[v].category === c.id));

    /* ---- headline facts (all computed from results.json) ---- */
    const nSig = results.filter(r => r.significant).length;
    const y0 = results.map(r => r.start).sort()[0].slice(0, 4);
    const y1 = results.map(r => r.end).sort().pop().slice(0, 4);
    $('#facts').innerHTML = `${results.length} records · ${new Set(results.map(r => r.variable)).size} variables · ${y0}–${y1} · <strong>${nSig} of ${results.length} show a significant trend</strong>`;
    document.querySelectorAll('[data-fact="series"]').forEach(el => { el.textContent = results.length; });

    /* ---- method demo ---- */
    const sel = $('#demo-series');
    order.forEach(vid => {
      const rs = results.filter(r => r.variable === vid); if (!rs.length) return;
      const g = document.createElement('optgroup'); g.label = content.variables[vid].short;
      rs.forEach(r => g.appendChild(new Option(place(r.id), r.id)));
      sel.appendChild(g);
    });
    sel.value = BY.NearSurfaceAirTemperature_Furnace ? 'NearSurfaceAirTemperature_Furnace' : results[0].id;

    const chart = TDChart($('#demo-chart'), { height: 320, zoom: false, overview: false, legend: false });
    let step = 1, shown = 0, raf = 0;

    function dataAt(r, t) {
      const v = V(r), anom = t > 0.5;
      const ys = r.series.value.map((x, k) => x + (r.series.anomaly[k] - x) * t);
      return {
        lines: [{ id: 'd', label: anom ? 'Anomaly' : 'Value', color: C.data, width: 1.6, dates: r.series.date, ys }],
        trends: step === 3 && t === 1 ? [{ id: 't', label: 'Fitted line', color: r.significant ? C.trend : C.ns, width: 2.6,
          dates: [r.series.date[0], r.series.date[r.series.date.length - 1]], y: [r.series.trend[0], r.series.trend[r.series.trend.length - 1]] }] : [],
        zero: t === 1, signed: anom, unit: v.unit,
        yLabel: anom ? `Anomaly (${v.unit})` : `${v.short} (${v.unit})`,
        title: `${v.short} at ${place(r.id)}, ${['raw monthly values', 'seasons removed', 'seasons removed with fitted trend line'][step - 1]}`,
        desc: captionText(r),
      };
    }

    function captionText(r) {
      const v = V(r), p = place(r.id), u = v.unit, s = r.series;
      const n = (x, signed) => TD.fmtNum(x, 3, signed);
      const years = Math.round((new Date(r.end + '-01') - new Date(r.start + '-01')) / (365.25 * 864e5));
      let t;
      if (step === 1) {
        t = `${v.short} at ${p}, one value per month from ${fmtMonth(r.start)} to ${fmtMonth(r.end)}. It ranges from ${n(Math.min(...s.value))} to ${n(Math.max(...s.value))} ${u}. Before looking for a trend, the yearly cycle of seasons has to come out.`;
      } else if (step === 2) {
        t = `For each calendar month we subtract its ${years}-year average: every January minus the average January, and so on. What's left is the anomaly, how unusual each month was. It runs from ${n(Math.min(...s.anomaly), true)} to ${n(Math.max(...s.anomaly), true)} ${u}.`;
      } else {
        const dir = r.slope_per_year > 0 ? 'rises' : 'falls';
        const pv = r.p_value < 0.0001 ? 'p < 0.0001' : `p = ${r.p_value.toFixed(3)}`;
        t = r.significant
          ? `The best-fit line ${dir} by ${TD.fmtRate(r.slope_per_year, u)} (${pv}). Random month-to-month noise would rarely give a slope that steep, so we count it as a significant ${TD.direction(r)} trend.`
          : `The best-fit line ${dir} by ${TD.fmtRate(r.slope_per_year, u)}, but ${pv} is above 0.05. Noise alone could easily give a slope like that, so we don't call it a trend.`;
      }
      if (r.n_missing_fill / r.n_rows_in_file > 0.05) t += ` Note: ${r.n_missing_fill} of the ${r.n_rows_in_file} months in this record are missing (the shaded gaps).`;
      return t;
    }

    function draw(animate) {
      const r = BY[sel.value], target = step === 1 ? 0 : 1;
      cancelAnimationFrame(raf);
      $('#demo-caption').textContent = captionText(r);
      $('#demo-open').href = 'explore.html?series=' + encodeURIComponent(r.id);
      if (!animate || reduceMotion || shown === target) { shown = target; chart.update(dataAt(r, shown)); return; }
      const from = shown, t0 = performance.now(), dur = 900;
      const tick = now => {
        const q = Math.min(1, (now - t0) / dur), e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
        shown = q < 1 ? from + (target - from) * e : target;
        chart.update(dataAt(r, shown));
        if (q < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    function setStep(s) {
      step = s;
      document.querySelectorAll('[data-step]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.step === s)));
      $('#demo-next').textContent = s < 3 ? 'Next step' : 'Start again';
      draw(true);
    }
    document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => setStep(+b.dataset.step)));
    $('#demo-next').addEventListener('click', () => setStep(step < 3 ? step + 1 : 1));
    sel.addEventListener('change', () => draw(false));
    draw(false);

    /* ---- all records grid ---- */
    let filter = 'all', sort = 'topic';
    const counts = { all: results.length, sig: nSig, ns: results.length - nSig };
    const fl = $('#filter');
    [['all', 'All'], ['sig', 'Significant'], ['ns', 'Not significant']].forEach(([k, label]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.f = k; b.setAttribute('aria-pressed', String(k === filter));
      b.textContent = `${label} (${counts[k]})`;
      b.addEventListener('click', () => { filter = k; fl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderTiles(); });
      fl.appendChild(b);
    });
    $('#sort').addEventListener('change', e => { sort = e.target.value; renderTiles(); });

    function spark(r) {
      const Wd = 200, Hd = 52, s = r.series, xs = s.date.map(mi), x0 = xs[0], x1 = xs[xs.length - 1];
      const a = Math.max(...s.anomaly.map(Math.abs)) || 1;
      const X = i => ((i - x0) / (x1 - x0) * Wd).toFixed(1), Y = v => (Hd / 2 - v / a * (Hd / 2 - 3)).toFixed(1);
      let d = '';
      xs.forEach((x, k) => { d += (k === 0 || x - xs[k - 1] > 1 ? 'M' : 'L') + X(x) + ',' + Y(s.anomaly[k]); });
      return `<svg viewBox="0 0 ${Wd} ${Hd}" preserveAspectRatio="none" aria-hidden="true">
        <line class="sp-zero" x1="0" x2="${Wd}" y1="${Hd / 2}" y2="${Hd / 2}"/>
        <path class="sp-line" d="${d}"/>
        <path class="sp-trend${r.significant ? ' sig' : ''}" d="M0,${Y(s.trend[0])}L${Wd},${Y(s.trend[s.trend.length - 1])}"/></svg>`;
    }
    function tile(r) {
      const v = V(r), loc = content.locations[r.id] || {};
      return `<li class="tile${r.significant ? ' sig' : ''}"><a href="explore.html?series=${encodeURIComponent(r.id)}">
        <span class="t-var">${esc(v.short)}</span>
        <span class="t-place">${esc(place(r.id))}</span>
        <span class="t-region">${esc(loc.region || '')}</span>
        ${spark(r)}
        <span class="t-foot"><span class="t-rate">${TD.fmtRate(r.slope_per_year, esc(v.unit))}</span>
        <span class="t-verdict">${r.significant ? 'Significant, ' + esc(TD.direction(r)) : 'Not significant'}</span></span>
      </a></li>`;
    }
    function renderTiles() {
      let list = results.slice();
      if (filter === 'sig') list = list.filter(r => r.significant);
      if (filter === 'ns') list = list.filter(r => !r.significant);
      if (sort === 'p') list.sort((a, b) => a.p_value - b.p_value);
      else if (sort === 'place') list.sort((a, b) => place(a.id).localeCompare(place(b.id)));
      else list.sort((a, b) => order.indexOf(a.variable) - order.indexOf(b.variable) || place(a.id).localeCompare(place(b.id)));
      $('#tiles').innerHTML = list.map(tile).join('');
      $('#tiles-count').textContent = `Showing ${list.length} of ${results.length} records.`;
    }
    renderTiles();

    /* ---- starting points ---- */
    document.querySelectorAll('[data-case]').forEach(el => {
      el.innerHTML = el.dataset.case.split(',').map(id => {
        const r = BY[id]; if (!r) return '';
        return `<strong>${esc(place(id))}:</strong> ${TD.fmtRate(r.slope_per_year, esc(V(r).unit))}, ${esc(TD.verdictText(r))}`;
      }).join('<br>');
    });
  }).catch(err => {
    $('#facts').textContent = '';
    $('#demo-chart').innerHTML = `<div class="error" role="alert">Could not load the data files (${esc(err.message)}). If you opened this page straight from your computer, run a local web server instead. See README_WEBSITE.md.</div>`;
  });
})();
