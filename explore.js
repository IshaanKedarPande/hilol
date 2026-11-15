/* Trend Explorer: pick a record, then chart + verdict, driven by data/results.json and data/content.json. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtMonth = ym => { const [y, m] = ym.split('-'); return `${MONTHS[+m - 1]} ${y}`; };
  const COLORS = { data: '#6aa8ff', trend: '#ff8a4c', overlay: ['#c49bff', '#4fd1c5', '#ff7ab6'] };

  // background weather scene for each variable (assets/weather.js)
  const WEATHER = {
    AirTemperature: 'heat', NearSurfaceAirTemperature: 'heat', CloudAmount: 'cloud', RelativeHumidity: 'mist',
    RootZoneSoil: 'rain', SurfaceSoilWetness: 'rain', TotalPrecipitationRate: 'rain', SurfaceWindSpeed: 'wind', SurfacePressure: 'clear',
  };
  const state = { cat: null, variable: null, series: null, view: 'anomaly', overlays: [] };
  let DATA, CONTENT, BY_ID, chart;

  const ICON_CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor"/><path d="M4.5 8.2 7 10.6l4.6-5" stroke="#0b1220" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_DASH = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 8h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  TD.load().then(({ results, content }) => {
    DATA = results; CONTENT = content;
    BY_ID = Object.fromEntries(results.map(r => [r.id, r]));
    const fromUrl = new URLSearchParams(location.search).get('series');
    const initial = BY_ID[fromUrl] ? fromUrl : 'NearSurfaceAirTemperature_Furnace';
    select(initial, false);
  }).catch(err => {
    $('#app').innerHTML = `<div class="error" role="alert">Could not load the data files (${esc(err.message)}). If you opened this page straight from your computer, run a local web server instead. See README_WEBSITE.md.</div>`;
  });

  function varsInCat(cat) {
    return Object.keys(CONTENT.variables).filter(v => CONTENT.variables[v].category === cat && DATA.some(r => r.variable === v));
  }
  function seriesForVar(v) { return DATA.filter(r => r.variable === v); }
  function placeOf(id) { return CONTENT.locations[id]?.place || BY_ID[id].location; }
  function overlayColor(primaryId, id) {
    const others = seriesForVar(BY_ID[primaryId].variable).filter(o => o.id !== primaryId);
    return COLORS.overlay[Math.max(0, others.findIndex(o => o.id === id)) % COLORS.overlay.length];
  }

  function select(seriesId, push = true) {
    const r = BY_ID[seriesId];
    state.overlays = state.variable === r.variable ? state.overlays.filter(x => x !== seriesId) : [];
    state.series = seriesId;
    state.variable = r.variable;
    state.cat = CONTENT.variables[r.variable].category;
    if (push) history.replaceState(null, '', `?series=${encodeURIComponent(seriesId)}`);
    if (window.TDWeather) TDWeather.set(WEATHER[r.variable] || 'clear', CONTENT.variables[r.variable].short);
    renderChips();
    renderResult();
  }

  function chip(label, pressed, onClick, extra = '') {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip';
    b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    b.innerHTML = esc(label) + (extra ? ` <small>${esc(extra)}</small>` : '');
    b.addEventListener('click', onClick);
    return b;
  }

  function renderChips() {
    const cats = $('#cat-chips'); cats.innerHTML = '';
    CONTENT.categories.forEach(c => cats.appendChild(chip(c.label, c.id === state.cat, () => {
      const v = varsInCat(c.id)[0];
      select(seriesForVar(v)[0].id);
    })));
    const cq = CONTENT.categories.find(c => c.id === state.cat);
    cats.title = cq ? cq.question : '';

    const vars = $('#var-chips'); vars.innerHTML = '';
    varsInCat(state.cat).forEach(v => vars.appendChild(chip(CONTENT.variables[v].short, v === state.variable, () => select(seriesForVar(v)[0].id))));

    const locs = $('#loc-chips'); locs.innerHTML = '';
    seriesForVar(state.variable).forEach(r => locs.appendChild(chip(placeOf(r.id), r.id === state.series, () => select(r.id), CONTENT.locations[r.id]?.region || '')));
  }

  function plainSummary(r, v) {
    const years = (r.series.date.length > 1)
      ? ((new Date(r.end + '-01') - new Date(r.start + '-01')) / (365.25 * 864e5)) : 0;
    const total = r.slope_per_year * years;
    const ciIncludesZero = r.ci95_per_year[0] <= 0 && r.ci95_per_year[1] >= 0;
    const dir = TD.direction(r);
    let s = `<p>From ${fmtMonth(r.start)} to ${fmtMonth(r.end)}, with the seasons taken out, the fitted line for <strong>${esc(v.short.toLowerCase())}</strong> at <strong>${esc(placeOf(r.id))}</strong> changes by <strong>${TD.fmtRate(r.slope_per_year, esc(v.unit))}</strong>. Over the ${years.toFixed(0)}-year record that adds up to about <strong>${TD.fmtNum(total, 2, true)} ${esc(v.unit)}</strong>.</p>`;
    if (r.significant) {
      s += `<p>The p-value is ${TD.fmtP(r.p_value)}, below 0.05, so this <strong>${esc(dir)} trend is statistically significant</strong>: random month-to-month noise alone would be unlikely to give a slope this steep. The 95% confidence interval (${TD.fmtNum(r.ci95_per_year[0], 2, true)} to ${TD.fmtNum(r.ci95_per_year[1], 2, true)} ${esc(v.unit)}/year) ${ciIncludesZero ? 'still touches zero, so treat the direction with caution' : 'does not include zero, so the direction of change is clear'}.</p>`;
    } else {
      s += `<p>The p-value is ${TD.fmtP(r.p_value)}, above 0.05, so the trend is <strong>not statistically significant</strong>. The line leans slightly ${r.slope_per_year > 0 ? 'upward' : 'downward'}, but a slope this size could easily come from natural variability. The 95% confidence interval (${TD.fmtNum(r.ci95_per_year[0], 2, true)} to ${TD.fmtNum(r.ci95_per_year[1], 2, true)} ${esc(v.unit)}/year) includes zero. That doesn't prove nothing is changing; a longer record might show a trend.</p>`;
    }
    if (r.n_missing_fill / r.n_rows_in_file > 0.05) {
      const mbm = r.missing_by_calendar_month || {};
      const often = Object.keys(mbm).filter(m => mbm[m] >= 5).map(m => MONTHS[m - 1]);
      s += `<p><strong>Caution:</strong> ${r.n_missing_fill} of the ${r.n_rows_in_file} months in this record were missing${often.length ? `, mostly in ${often.join(', ')}` : ''}. When the same part of the year is missing again and again, the record mainly reflects the other seasons, and gaps of one or two months were filled in by interpolation. Treat this result as weaker evidence than the others.</p>`;
    }
    s += `<p class="muted" style="font-size:.9rem">The straight line explains ${(r.r_squared * 100).toFixed(1)}% of the month-to-month variation (R² = ${r.r_squared.toFixed(3)}). Most of the wiggle is natural variability around the trend.</p>`;
    return s;
  }

  function renderResult() {
    const r = BY_ID[state.series];
    const v = CONTENT.variables[r.variable];
    const loc = CONTENT.locations[r.id] || {};
    const notes = CONTENT.notes[r.id];
    const missingNote = r.n_missing_fill > 0
      ? `${r.n_missing_fill} of ${r.n_rows_in_file} months in the source file were flagged as missing (−9999); ${r.n_months} months were used after filling short gaps.`
      : `All ${r.n_months} months in the source file had valid values.`;

    const badge = r.significant
      ? `<span class="badge sig">${ICON_CHECK} Significant trend</span>`
      : `<span class="badge notsig">${ICON_DASH} No significant trend</span>`;

    const compareRows = seriesForVar(r.variable).map(o => {
      const isCur = o.id === r.id;
      const col = isCur ? COLORS.data : overlayColor(r.id, o.id);
      const on = isCur || state.overlays.includes(o.id);
      return `
      <tr class="${isCur ? 'current' : ''}">
        <td><span class="ov">${isCur
          ? `<span class="swatch" style="background:${col}" title="On the chart"></span>`
          : `<input type="checkbox" data-overlay="${esc(o.id)}" ${on ? 'checked' : ''} style="accent-color:${col}" aria-label="Draw ${esc(placeOf(o.id))} on the chart">`}</span>${isCur
          ? `<strong>${esc(placeOf(o.id))}</strong>`
          : `<button type="button" data-go="${esc(o.id)}">${esc(placeOf(o.id))}</button>`}</td>
        <td>${TD.fmtNum(o.slope_per_year, 3, true)}</td>
        <td>${o.significant ? '<strong>Yes</strong>, ' + esc(TD.direction(o)) : 'No'}<br><span class="muted" style="font-size:.8rem">p ${o.p_value < 0.0001 ? '&lt; 0.0001' : '= ' + o.p_value.toFixed(4)}</span></td>
      </tr>`;
    }).join('');

    $('#app').innerHTML = `
      <div class="result-grid">
        <article class="panel" aria-labelledby="res-title">
          <div class="headline">
            <div>
              <h2 id="res-title">${esc(v.name)} at ${esc(placeOf(r.id))}</h2>
              <div class="where">${loc.region ? esc(loc.region) + ' · ' : ''}${fmtMonth(r.start)} – ${fmtMonth(r.end)} · monthly data</div>
            </div>
            ${badge}
          </div>

          <div class="stats">
            <div class="stat"><div class="k">Rate of change</div><div class="v">${TD.fmtNum(r.slope_per_year, 3, true)}</div><div class="s">${esc(v.unit)} per year (${TD.fmtNum(r.slope_per_decade, 3, true)} per decade)</div></div>
            <div class="stat"><div class="k">95% confidence interval</div><div class="v" style="font-size:1.05rem">${TD.fmtNum(r.ci95_per_year[0], 2, true)} to ${TD.fmtNum(r.ci95_per_year[1], 2, true)}</div><div class="s">${esc(v.unit)} per year</div></div>
            <div class="stat"><div class="k">p-value (t-test on slope)</div><div class="v">${TD.fmtP(r.p_value)}</div><div class="s">${r.significant ? 'below' : 'above'} the 0.05 threshold</div></div>
          </div>

          <div class="toolbar">
            <div class="seg" role="group" aria-label="Chart view">
              <button type="button" data-view="anomaly" aria-pressed="${state.view === 'anomaly'}">Seasons removed</button>
              <button type="button" data-view="value" aria-pressed="${state.view === 'value'}">Raw monthly values</button>
            </div>
          </div>
          <div id="chart"></div>
          <p class="chart-caption" id="chart-caption"></p>

          <div class="plain">
            <h3>In short</h3>
            ${plainSummary(r, v)}
          </div>

          ${notes ? `
          <h3 style="margin-top:24px">What we noticed looking at the chart</h3>
          <p class="muted" style="font-size:.9rem">These are our notes from reading the seasons-removed chart by eye. A gentle trend can be statistically significant even when it's hard to see under big month-to-month swings.</p>
          <dl class="notes">
            <dt>Overview</dt><dd>${esc(notes.overview)}</dd>
            <dt>Pattern over time</dt><dd>${esc(notes.pattern)}</dd>
            <dt>Extremes (${esc(v.unit)}, relative to normal)</dt><dd>${esc(notes.extremes)}</dd>
          </dl>` : `
          <h3 style="margin-top:24px">What we noticed looking at the chart</h3>
          <p class="muted"><em>[Placeholder] No written notes for this location yet.</em></p>`}

          <details class="data-table">
            <summary>Show the data as a table (${r.n_months} months)</summary>
            <div class="table-scroll">
              <table class="compare">
                <caption class="sr-only">Monthly ${esc(v.name)} at ${esc(placeOf(r.id))}</caption>
                <thead><tr><th scope="col">Month</th><th scope="col">Value (${esc(v.unit)})</th><th scope="col">Anomaly (${esc(v.unit)})</th></tr></thead>
                <tbody>${r.series.date.map((d, i) => `<tr><td>${fmtMonth(d)}</td><td>${TD.fmtNum(r.series.value[i], 4)}</td><td>${TD.fmtNum(r.series.anomaly[i], 3, true)}</td></tr>`).join('')}</tbody>
              </table>
            </div>
          </details>
        </article>

        <aside>
          <div class="panel">
            <p class="eyebrow">The variable</p>
            <h3>${esc(v.name)}</h3>
            <p>${esc(v.definition)}</p>
            <p><strong>How NASA measures it:</strong> ${esc(v.howMeasured)}</p>
            <span class="unit-chip">Unit: ${esc(v.unitLong)}</span>
          </div>
          <div class="panel">
            <p class="eyebrow">The place</p>
            <h3>${esc(placeOf(r.id))}${loc.region ? `<span class="muted" style="font-weight:400;font-size:.95rem"> · ${esc(loc.region)}</span>` : ''}</h3>
            <p>${loc.why ? esc(loc.why) : '<em>[Placeholder] No description has been provided for this location yet.</em>'}</p>
            <p class="muted" style="font-size:.88rem">${esc(missingNote)}</p>
          </div>
          <div class="panel">
            <p class="eyebrow">Compare places</p>
            <h3>${esc(v.short)}: every location</h3>
            <p style="font-size:.88rem">The same variable can trend in different directions in different places. Tick a box to draw that place on the chart as well. Rates are in ${esc(v.unit)} per year.</p>
            <div class="table-scroll">
              <table class="compare">
                <thead><tr><th scope="col">Place</th><th scope="col">Rate per year</th><th scope="col">Significant?</th></tr></thead>
                <tbody>${compareRows}</tbody>
              </table>
            </div>
          </div>
        </aside>
      </div>`;

    $('#app').querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => select(b.dataset.go)));
    $('#app').querySelectorAll('[data-overlay]').forEach(cb => cb.addEventListener('change', () => {
      const id = cb.dataset.overlay;
      state.overlays = state.overlays.filter(x => x !== id);
      if (cb.checked) state.overlays.push(id);
      drawChart(r, v, true);
    }));
    $('#app').querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      state.view = b.dataset.view;
      $('#app').querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      drawChart(r, v, true);
    }));
    chart = TDChart($('#chart'), { height: 360 });
    drawChart(r, v, false);
  }

  /* ---------------- Chart data (drawing and zoom live in assets/chart.js) ---------------- */
  function drawChart(r, v, keepView) {
    const isAnom = state.view === 'anomaly';
    const pick = s => (isAnom ? s.series.anomaly : s.series.value);
    const ends = s => [s.series.date[0], s.series.date[s.series.date.length - 1]];
    const tEnds = s => [s.series.trend[0], s.series.trend[s.series.trend.length - 1]];
    const kind = isAnom ? 'anomaly' : 'value';
    const ov = state.overlays.filter(id => BY_ID[id] && BY_ID[id].variable === r.variable && id !== r.id);
    const multi = ov.length > 0;

    const lines = [{ id: r.id, label: placeOf(r.id), color: COLORS.data, width: 1.7, dates: r.series.date, ys: pick(r), csvLabel: `${placeOf(r.id)} ${kind} (${v.unit})` }];
    const trends = isAnom ? [{ id: 'trend:' + r.id, label: multi ? `Trend, ${placeOf(r.id)}` : 'Linear trend', color: COLORS.trend, dates: ends(r), y: tEnds(r) }] : [];
    ov.forEach(id => {
      const o = BY_ID[id], c = overlayColor(r.id, id);
      lines.push({ id, label: placeOf(id), color: c, width: 1.4, dates: o.series.date, ys: pick(o), csvLabel: `${placeOf(id)} ${kind} (${v.unit})` });
      if (isAnom) trends.push({ id: 'trend:' + id, label: `Trend, ${placeOf(id)}`, color: c, width: 2, dates: ends(o), y: tEnds(o) });
    });

    const ys = pick(r), place = placeOf(r.id);
    const label = isAnom ? `Anomaly (${v.unit})` : `${v.short} (${v.unit})`;
    const desc = isAnom
      ? `Line chart of monthly ${v.short.toLowerCase()} anomalies at ${place}, ${fmtMonth(r.start)} to ${fmtMonth(r.end)}, ranging from ${TD.fmtNum(Math.min(...ys), 3)} to ${TD.fmtNum(Math.max(...ys), 3)} ${v.unit}. Dashed trend line slopes ${r.slope_per_year > 0 ? 'upward' : 'downward'} at ${TD.fmtRate(r.slope_per_year, v.unit)}.`
      : `Line chart of monthly ${v.short.toLowerCase()} at ${place}, ${fmtMonth(r.start)} to ${fmtMonth(r.end)}, ranging from ${TD.fmtNum(Math.min(...ys), 4)} to ${TD.fmtNum(Math.max(...ys), 4)} ${v.unit}, showing the seasonal cycle.`;

    chart.update({
      lines, trends, zero: isAnom, symmetric: isAnom, signed: isAnom, unit: v.unit, yLabel: label,
      title: `${label} at ${[place].concat(ov.map(placeOf)).join(', ')}`,
      desc: desc + (multi ? ` Also shown: ${ov.map(placeOf).join(', ')}.` : ''),
      csvName: `${r.id}_${kind}`,
    }, { keepView });

    $('#chart-caption').textContent = isAnom
      ? `Each point is how far that month was above or below its usual value for that time of year. Above zero means higher than normal.${r.n_missing_fill > 0 ? ' Shaded bands are months with no data.' : ''}`
      : `Raw monthly values. The regular up-and-down pattern is the seasonal cycle, which is removed before testing for a trend.${r.n_missing_fill > 0 ? ' Shaded bands are months with no data.' : ''}`;
  }
})();
