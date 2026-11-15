/* SI disclosure: this file was generated with the help of Claude (Anthropic), a Super Intelligence tool, and reviewed by team Hilol. */
/* Animated weather sky behind the page (decorative, aria-hidden).
   Home page:   each <section data-weather="..."> names a scene and the sky blends between them as you scroll.
   Other pages: call TDWeather.set('rain', 'Total precipitation') to switch scene (it cross-fades).
   Scenes: heat, cloud, rain, wind, mist, snow, clear. */
(function () {
  const sections = [...document.querySelectorAll('[data-weather]')];
  const scrollMode = sections.length > 0;
  // <body data-sky="calm">: fewer particles, softer effects, and the sky reacts gently to scrolling
  const calm = document.body.dataset.sky === 'calm';
  const I = calm ? 0.5 : 1;

  const canvas = document.createElement('canvas');
  canvas.id = 'sky'; canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  const chip = document.createElement('div');
  chip.className = 'wx-chip'; chip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(chip);

  const reduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  const KEYS = ['sun', 'heat', 'cloud', 'dark', 'rain', 'wind', 'mist', 'snow', 'stars', 'moon', 'aurora', 'flash'];
  const base = o => { const s = Object.assign({}, o); KEYS.forEach(k => { if (s[k] === undefined) s[k] = 0; }); return s; };
  const SCENES = {
    heat:  base({ label: 'Heat',            top: [92, 38, 30],  mid: [46, 26, 40], bot: [12, 16, 30], ground: [22, 14, 20], sun: 1, heat: 1, stars: 0.15 }),
    cloud: base({ label: 'Cloud cover',     top: [34, 46, 70],  mid: [22, 32, 52], bot: [10, 16, 30], ground: [12, 18, 30], cloud: 1, moon: 0.5, stars: 0.25 }),
    rain:  base({ label: 'Rain',            top: [26, 34, 50],  mid: [18, 24, 38], bot: [9, 13, 24],  ground: [8, 12, 20],  cloud: 1, dark: 0.7, rain: 1, wind: 0.25, flash: 1 }),
    wind:  base({ label: 'Wind',            top: [20, 50, 58],  mid: [16, 32, 44], bot: [9, 16, 28],  ground: [10, 20, 26], cloud: 0.45, wind: 1, stars: 0.35, moon: 0.3 }),
    mist:  base({ label: 'Humidity & mist', top: [40, 52, 60],  mid: [26, 34, 44], bot: [12, 18, 28], ground: [16, 22, 30], cloud: 0.2, mist: 1, moon: 0.3 }),
    snow:  base({ label: 'Cold & snow',     top: [10, 32, 58],  mid: [10, 22, 44], bot: [8, 14, 30],  ground: [26, 36, 54], snow: 1, aurora: 1, stars: 1, cloud: 0.15, wind: 0.15 }),
    clear: base({ label: 'Clear night',     top: [18, 24, 56],  mid: [12, 18, 40], bot: [8, 12, 26],  ground: [10, 14, 26], stars: 1, moon: 1 }),
  };
  const ICONS = {
    heat: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7z"/>',
    rain: '<path d="M7 14h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 7a3.5 3.5 0 0 0 1 7z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
    mist: '<path d="M3 8h18M5 12h14M3 16h18M7 20h10"/>',
    snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2 3-2M9 20l3-2 3 2"/>',
    clear: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  };

  const mix = (a, b, t) => a + (b - a) * t;
  const mixC = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
  const mixScene = (a, b, t) => {
    const s = { top: mixC(a.top, b.top, t), mid: mixC(a.mid, b.mid, t), bot: mixC(a.bot, b.bot, t), ground: mixC(a.ground, b.ground, t) };
    KEYS.forEach(k => { s[k] = mix(a[k], b[k], t); });
    return s;
  };
  const rgb = c => `rgb(${c.map(Math.round).join(',')})`;
  const rgba = (c, a) => `rgba(${c.map(Math.round).join(',')},${a})`;
  const smooth = t => t * t * (3 - 2 * t);

  /* ---------- which scene ---------- */
  let manual = { key: 'clear', label: '' };
  window.TDWeather = { set(key, label) { if (SCENES[key]) manual = { key, label: label || '' }; } };

  function target() {
    if (!scrollMode) return { s: SCENES[manual.key], key: manual.key, label: manual.label };
    const mid = innerHeight * 0.5;
    const cs = sections.map(el => { const r = el.getBoundingClientRect(); return { c: r.top + r.height / 2, k: el.dataset.weather }; });
    if (mid <= cs[0].c) return { s: SCENES[cs[0].k], key: cs[0].k };
    const last = cs[cs.length - 1];
    if (mid >= last.c) return { s: SCENES[last.k], key: last.k };
    for (let i = 0; i < cs.length - 1; i++) {
      if (mid < cs[i + 1].c) {
        const raw = (mid - cs[i].c) / (cs[i + 1].c - cs[i].c);
        const t = smooth(Math.min(1, Math.max(0, (raw - 0.2) / 0.6)));
        return { s: mixScene(SCENES[cs[i].k], SCENES[cs[i + 1].k], t), key: t < 0.5 ? cs[i].k : cs[i + 1].k };
      }
    }
  }

  /* ---------- particles ---------- */
  let W = 0, H = 0, dpr = 1, P = null;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function ridge(seed, amp, base) {
    // smooth mountain line built from a few sine waves
    const f = [rnd(0.6, 1.2), rnd(1.5, 2.6), rnd(3, 5)], ph = [rnd(0, 6), rnd(0, 6), rnd(0, 6)], a = [1, 0.45, 0.18];
    return x => base - amp * (a[0] * Math.sin(x * f[0] + ph[0]) + a[1] * Math.sin(x * f[1] + ph[1]) + a[2] * Math.sin(x * f[2] + ph[2]) + 1.6) / 3.2;
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = Math.max(0.35, Math.min(1.4, (W * H) / (1440 * 900))) * (calm ? 0.35 : 1);
    P = {
      stars: Array.from({ length: Math.round(220 * (calm ? k * 2 : k)) }, () => ({ x: rnd(0, W), y: rnd(0, H * 0.75), r: rnd(0.4, 1.5), tw: rnd(0.5, 2.2), ph: rnd(0, 6.28) })),
      drops: Array.from({ length: Math.round(280 * k) }, () => ({ x: rnd(0, W * 1.3), y: rnd(-H, H), len: rnd(12, 26), spd: rnd(700, 1000) })),
      flakes: Array.from({ length: Math.round(170 * k) }, () => ({ x: rnd(0, W), y: rnd(-H, H), r: rnd(1, 3.2), spd: rnd(25, 75), ph: rnd(0, 6.28) })),
      streaks: Array.from({ length: Math.round(36 * k) + 6 }, () => ({ x: rnd(-W, W), y: rnd(0, H * 0.85), len: rnd(80, 240), spd: rnd(500, 950), amp: rnd(4, 14) })),
      clouds: Array.from({ length: calm ? 4 : 9 }, () => ({ x: rnd(-200, W), y: rnd(0.04, 0.5) * H, s: rnd(0.7, 1.6), spd: rnd(6, 16) })),
      bands: Array.from({ length: 6 }, (_, i) => ({ y: (i + 0.5) / 6 * H, h: rnd(60, 150), spd: rnd(8, 20), off: rnd(0, W) })),
      // calm mode: taller, deeper mountains so the sun can set into a valley
      far: calm ? ridge(1, H * 0.34, H * 0.93) : ridge(1, H * 0.16, H * 0.94),
      near: calm ? ridge(2, H * 0.14, H * 1.03) : ridge(2, H * 0.12, H * 1.0),
    };
    // lowest point of the far ridge on the right-hand side: where the sun sets
    P.valley = { x: W * 0.75, y: -1 };
    for (let x = W * 0.55; x <= W * 0.9; x += 6) { const y = P.far(x / 260); if (y > P.valley.y) P.valley = { x, y }; }
  }

  function drawCloud(c, alpha, dark) {
    const col = mixC([84, 100, 128], [36, 44, 60], dark);
    const s = c.s * Math.min(1, W / 900 + 0.3);
    const puffs = [[0, 0, 46], [42, -18, 54], [92, -4, 44], [130, 8, 34], [60, 16, 40], [-34, 12, 32]];
    ctx.fillStyle = rgba(col, alpha);
    ctx.beginPath();
    puffs.forEach(([dx, dy, r]) => { ctx.moveTo(c.x + dx * s + r * s, c.y + dy * s); ctx.arc(c.x + dx * s, c.y + dy * s, r * s, 0, Math.PI * 2); });
    ctx.fill();
    // light rim on top
    ctx.fillStyle = rgba([200, 215, 240], alpha * 0.08 * (1 - dark));
    ctx.beginPath(); ctx.arc(c.x + 42 * s, c.y - 26 * s, 40 * s, 0, Math.PI * 2); ctx.fill();
  }

  let cur = null, last = performance.now(), labelKey = '', labelText = '', flashT = 0, nextFlash = 4;
  function frame(now) {
    const dt = reduce.matches ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    const tg = target();
    cur = cur ? mixScene(cur, tg.s, reduce.matches ? 1 : 1 - Math.exp(-dt * 4)) : tg.s;
    const lbl = tg.label ? `${SCENES[tg.key].label} · ${tg.label}` : SCENES[tg.key].label;
    if (tg.key !== labelKey || lbl !== labelText) {
      labelKey = tg.key; labelText = lbl;
      chip.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[labelKey]}</svg><span>${lbl}</span>`;
      chip.dataset.scene = labelKey;
    }
    const s = cur, t = now / 1000;
    const sy = window.scrollY || 0;
    // calm mode: how far down the page we are (0 to 1); the sun/moon sink and the sky deepens as you scroll
    const prog = calm ? Math.min(1, sy / Math.max(1, document.documentElement.scrollHeight - innerHeight)) : 0;
    const lift = prog * H * 0.3;
    const dusk = calm ? 1 - prog : 0; // 1 = sun up, 0 = sun gone

    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (calm) {
      // dusk sky: warm near the horizon at first, deep night once the sun is down
      g.addColorStop(0, rgb(mixC(mixC(s.top, [40, 30, 60], 0.5), [6, 10, 26], prog)));
      g.addColorStop(0.6, rgb(mixC(mixC(s.mid, [120, 60, 60], 0.45 * dusk), [10, 14, 30], prog * 0.8)));
      g.addColorStop(1, rgb(mixC(mixC(s.bot, [210, 110, 60], 0.55 * dusk), [8, 12, 26], prog * 0.6)));
    } else {
      g.addColorStop(0, rgb(s.top)); g.addColorStop(0.55, rgb(s.mid)); g.addColorStop(1, rgb(s.bot));
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // stars (come out after sunset and drift slowly as you scroll in calm mode)
    const starA = calm ? Math.max(s.stars * 0.5, prog) : s.stars;
    if (starA > 0.01) {
      const span = H * 0.75;
      P.stars.forEach(st => {
        const y = calm ? ((st.y - sy * 0.05) % span + span) % span : st.y;
        const a = starA * (0.35 + 0.65 * Math.abs(Math.sin(t * st.tw + st.ph))) * (1 - y / (H * 0.9)) * (calm ? 0.8 : 1);
        ctx.fillStyle = `rgba(235,242,255,${a})`;
        ctx.fillRect(st.x, y, st.r, st.r);
      });
    }

    // aurora: three soft curtains
    if (s.aurora > 0.01) {
      const cols = [[79, 209, 197], [120, 230, 150], [150, 120, 255]];
      cols.forEach((c, i) => {
        const yb = x => H * (0.16 + i * 0.07) + Math.sin(x / 210 + t * 0.35 + i * 1.7) * 34 + Math.sin(x / 85 + t * 0.6 + i) * 10;
        const h = H * (0.16 - i * 0.03);
        const gr = ctx.createLinearGradient(0, H * 0.06, 0, H * 0.5);
        gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(0.45, rgba(c, 0.28 * s.aurora * I)); gr.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = gr;
        ctx.beginPath();
        for (let x = 0; x <= W + 20; x += 20) { const y = yb(x); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        for (let x = W + 20; x >= 0; x -= 20) ctx.lineTo(x, yb(x) + h);
        ctx.closePath(); ctx.fill();
      });
    }

    // moon
    if (s.moon > 0.01 && !calm) {
      const mx = W * 0.82, my = H * 0.17 + lift;
      const gl = ctx.createRadialGradient(mx, my, 0, mx, my, 160);
      gl.addColorStop(0, `rgba(220,230,255,${0.22 * s.moon})`); gl.addColorStop(1, 'rgba(220,230,255,0)');
      ctx.fillStyle = gl; ctx.fillRect(mx - 160, my - 160, 320, 320);
      ctx.fillStyle = `rgba(240,236,220,${0.95 * s.moon})`;
      ctx.beginPath(); ctx.arc(mx, my, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(190,186,170,${0.35 * s.moon})`;
      [[-9, -6, 6], [8, 7, 5], [5, -11, 3.5]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, Math.PI * 2); ctx.fill(); });
    }

    // setting sun with glow and slowly turning rays
    if (s.sun > 0.01 || calm) {
      // calm mode: the sun always sets into the mountain valley as you scroll down
      const sunA = calm ? 1 : s.sun;
      const cx = calm ? P.valley.x : W * 0.8;
      const cy = calm ? mix(H * 0.24, P.valley.y + 85, prog) : H * 0.34;
      const R = Math.max(W, H) * 0.6, gA = calm ? 0.6 * dusk : 0.55 * s.sun;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      glow.addColorStop(0, `rgba(255,160,70,${gA})`); glow.addColorStop(0.35, `rgba(220,90,60,${gA * 0.33})`); glow.addColorStop(1, 'rgba(220,90,60,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      if (!calm) ctx.save();
      if (!calm) { ctx.translate(cx, cy); ctx.rotate(t * 0.04);
      ctx.strokeStyle = `rgba(255,190,100,${0.25 * s.sun})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 16; i++) { ctx.rotate(Math.PI * 2 / 16); ctx.beginPath(); ctx.moveTo(78, 0); ctx.lineTo(78 + 30 + 14 * Math.sin(t * 1.3 + i), 0); ctx.stroke(); }
      ctx.restore();
      }
      const disc = ctx.createRadialGradient(cx - 14, cy - 14, 4, cx, cy, 60);
      disc.addColorStop(0, `rgba(255,236,170,${sunA})`); disc.addColorStop(1, calm ? `rgba(240,110,50,${sunA})` : `rgba(245,150,60,${sunA})`);
      ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI * 2); ctx.fill();
    }

    // clouds (faster when windy, darker when rainy) + gentle lightning glow
    if (s.flash > 0.5 && !calm && !reduce.matches) {
      nextFlash -= dt;
      if (nextFlash <= 0) { flashT = 1; nextFlash = rnd(5, 11); }
    }
    flashT = Math.max(0, flashT - dt * 2.5);
    if (s.cloud > 0.01) {
      P.clouds.forEach(c => {
        c.x += c.spd * (1 + s.wind * 5) * dt;
        if (c.x > W + 220) { c.x = -260; c.y = rnd(0.04, 0.5) * H; }
        drawCloud(c, 0.85 * s.cloud * I, Math.max(0, s.dark - flashT * 0.5));
      });
    }
    if (flashT > 0 && s.flash > 0.5) { ctx.fillStyle = `rgba(190,210,255,${0.07 * flashT * s.flash})`; ctx.fillRect(0, 0, W, H); }

    // mist
    if (s.mist > 0.01) {
      P.bands.forEach(b => {
        b.off += b.spd * dt;
        const y = b.y + Math.sin(t * 0.3 + b.off / 200) * 20;
        const gr = ctx.createLinearGradient(0, y - b.h, 0, y + b.h);
        gr.addColorStop(0, 'rgba(200,215,225,0)'); gr.addColorStop(0.5, `rgba(200,215,225,${0.13 * s.mist * I})`); gr.addColorStop(1, 'rgba(200,215,225,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, y - b.h, W, b.h * 2);
      });
    }

    // mountains (slight parallax with scroll)
    const farPar = calm ? 0 : 0.04; // in calm mode the far ridge stays put so the sun sinks into its valley
    [[P.far, farPar, mixC(s.ground, s.mid, 0.45)], [P.near, calm ? 0.05 : 0.09, s.ground]].forEach(([fn, par, col], li) => {
      const off = sy * par;
      ctx.fillStyle = rgb(col);
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, fn((x + off) / 260));
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      if (calm && li === 0 && dusk > 0.01) { // sunlit rim on the far ridge
        ctx.strokeStyle = `rgba(255,170,90,${0.35 * dusk})`; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= W + 20; x += 20) { const y = fn((x + off) / 260); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
    });
    if (s.snow > 0.01) { // snow caps on the far ridge
      ctx.strokeStyle = `rgba(230,240,255,${0.35 * s.snow})`; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= W + 20; x += 20) { const y = P.far((x + sy * farPar) / 260); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }

    // heat shimmer above the ground
    if (s.heat > 0.01 && !calm) {
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const y0 = H * (0.66 + i * 0.045);
        ctx.strokeStyle = `rgba(255,140,80,${0.12 * s.heat})`;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 16) { const y = y0 + Math.sin(x / 60 + t * 2 + i) * 4; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
    }

    // wind streaks
    if (s.wind > 0.01 && !reduce.matches) {
      ctx.strokeStyle = `rgba(150,215,225,${0.32 * s.wind * I})`; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      P.streaks.forEach(w => {
        w.x += w.spd * dt;
        if (w.x > W + 50) { w.x = rnd(-W * 0.6, -w.len); w.y = rnd(0, H * 0.85); }
        ctx.beginPath(); ctx.moveTo(w.x, w.y);
        ctx.quadraticCurveTo(w.x + w.len / 2, w.y - w.amp, w.x + w.len, w.y + Math.sin(t * 3 + w.y) * w.amp * 0.5);
        ctx.stroke();
      });
    }

    // rain
    if (s.rain > 0.01 && !reduce.matches) {
      const slant = 0.12 + s.wind * 0.5;
      ctx.strokeStyle = `rgba(160,195,235,${0.4 * s.rain * I})`; ctx.lineWidth = 1.2;
      ctx.beginPath();
      P.drops.forEach(d => {
        d.y += d.spd * dt; d.x -= d.spd * slant * dt;
        if (d.y > H + 20 || d.x < -20) { d.y = rnd(-80, -10); d.x = rnd(0, W * 1.3); }
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.len * slant, d.y - d.len);
      });
      ctx.stroke();
    }

    // snow
    if (s.snow > 0.01) {
      ctx.fillStyle = `rgba(240,246,255,${0.9 * s.snow * (calm ? 0.7 : 1)})`;
      P.flakes.forEach(f => {
        f.y += f.spd * dt; f.x += (Math.sin(t + f.ph) * 18 + s.wind * 40) * dt;
        if (f.y > H + 10) { f.y = -10; f.x = rnd(0, W); }
        if (f.x > W + 10) f.x = -10;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      });
    }

    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
})();
