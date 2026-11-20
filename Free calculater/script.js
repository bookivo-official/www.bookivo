/* =====================================================================
   BOOKIVO Financial Calculators — script.js
   Vanilla JavaScript. No libraries, no network calls.

   Sections
   1. Constants & shared formatting utilities
   2. Pure financial functions (no DOM)
   3. Tax rules configuration (by financial year) & tax functions
   4. Chart rendering (native Canvas)
   5. Field factories & calculator definitions (inputs, results, education)
   6. Panel controller (inputs, validation, results rendering)
   7. Sharing, clipboard & PDF / print
   8. Application initialisation & calculator navigation
   ===================================================================== */
(function () {
  'use strict';

  /* ===================================================================
     1. CONSTANTS & SHARED UTILITIES
     =================================================================== */
  const COLORS = {
    navy: '#0B1F3A', royal: '#1B4F8A', bright: '#168FE5', sky: '#8CC4F2', ice: '#BFDDF8',
    success: '#16A36A', danger: '#DC3545', warning: '#E69A28', muted: '#64748B', grid: '#E3EEF9', text: '#334155'
  };
  const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const SERIF = '"Playfair Display", Georgia, "Times New Roman", serif';
  const GREENS = ['#0E7A50', '#16A36A', '#3FBF8A', '#7AD3AC', '#A8E3C8', '#0B5E3E', '#5FB892', '#CFF0E0'];
  const MAX_AMOUNT = 1e11; // ₹10,000 crore upper bound for free-form amounts

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const safe = (n) => (Number.isFinite(n) ? n : 0);
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const roundTo = (n, d) => { const p = Math.pow(10, d); return Math.round(n * p) / p; };

  const nfCache = {};
  function fmtNum(n, d) {
    d = d || 0;
    if (!nfCache[d]) nfCache[d] = new Intl.NumberFormat('en-IN', { maximumFractionDigits: d, minimumFractionDigits: 0 });
    return nfCache[d].format(safe(n));
  }
  /** Indian currency: ₹1,00,000 */
  function inr(n) {
    let r = Math.round(safe(n));
    if (r === 0) r = 0; // avoid "-₹0"
    return (r < 0 ? '-' : '') + '₹' + fmtNum(Math.abs(r), 0);
  }
  function trimDec(n, d) { return String(parseFloat(safe(n).toFixed(d))); }
  /** Compact Indian currency: ₹12.5 L, ₹3.2 Cr */
  function inrShort(n) {
    n = safe(n);
    const a = Math.abs(n), s = n < 0 ? '-' : '';
    if (a >= 1e12) return s + '₹' + trimDec(a / 1e12, 2) + ' Lakh Cr';
    if (a >= 1e7) return s + '₹' + trimDec(a / 1e7, 2) + ' Cr';
    if (a >= 1e5) return s + '₹' + trimDec(a / 1e5, 2) + ' L';
    if (a >= 1e3) return s + '₹' + trimDec(a / 1e3, 1) + 'K';
    return s + '₹' + Math.round(a);
  }
  const pct = (n, d) => fmtNum(n, d === undefined ? 1 : d) + '%';
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  function fmtDuration(months) {
    months = Math.max(0, Math.round(safe(months)));
    const y = Math.floor(months / 12), m = months % 12;
    if (!y) return plural(m, 'month');
    if (!m) return plural(y, 'year');
    return plural(y, 'year') + ' ' + plural(m, 'month');
  }
  function addMonths(date, m) { const d = new Date(date.getTime()); d.setMonth(d.getMonth() + m); return d; }
  const fmtMonthYear = (d) => d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  /** Parse a user-typed number ("1,50,000", "₹ 500", "7.5"). Returns NaN if invalid. */
  function parseNum(raw) {
    const s = String(raw).replace(/[₹,\s]/g, '');
    if (s === '' || s === '.' || !/^\d*\.?\d*$/.test(s)) return NaN;
    return parseFloat(s);
  }
  /** Tiny DOM builder. */
  function el(tag, props, children) {
    const n = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v === false || v === null || v === undefined) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    (children || []).filter(Boolean).forEach((c) => n.append(c));
    return n;
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ===================================================================
     2. PURE FINANCIAL FUNCTIONS (no DOM access)
     =================================================================== */
  const Fin = {
    /**
     * Month-by-month SIP simulation. `step` is the annual step-up % applied
     * at every anniversary. begin=true => annuity-due (invest at start of month).
     * Returns year-end arrays (index 0 = start).
     */
    sipSeries({ monthly, rate, years, step = 0, begin = true }) {
      const r = rate / 12 / 100, n = Math.round(years * 12);
      let bal = 0, inv = 0, c = monthly;
      const value = [0], invested = [0];
      for (let m = 1; m <= n; m++) {
        if (m > 1 && (m - 1) % 12 === 0) c *= 1 + step / 100;
        if (begin) { bal += c; bal *= 1 + r; } else { bal *= 1 + r; bal += c; }
        inv += c;
        if (m % 12 === 0) { value.push(bal); invested.push(inv); }
      }
      return { value, invested, finalValue: bal, totalInvested: inv, lastMonthly: c };
    },

    /** Value of `principal` after t years, compounding m times a year. */
    compoundValue(principal, ratePct, t, m) {
      const i = ratePct / 100 / m;
      return principal * Math.pow(1 + i, m * t);
    },
    compoundSeries(principal, ratePct, years, m) {
      const out = [];
      for (let t = 0; t <= years; t++) out.push(Fin.compoundValue(principal, ratePct, t, m));
      return out;
    },
    simpleSeries(principal, ratePct, years) {
      const out = [];
      for (let t = 0; t <= years; t++) out.push(principal * (1 + (ratePct / 100) * t));
      return out;
    },

    /**
     * SWP simulation (monthly). Returns monthly arrays (index 0 = start).
     * Balance never goes below zero; the last withdrawal is partial if the corpus runs out.
     */
    swp({ corpus, withdrawal, rate, years, begin }) {
      const r = rate / 12 / 100, n = Math.round(years * 12);
      let bal = corpus, withdrawn = 0, exhaustedAt = null, partialLast = false;
      const balance = [bal], cumulative = [0];
      for (let m = 1; m <= n; m++) {
        if (bal > 0) {
          if (begin) {
            const w = Math.min(bal, withdrawal);
            if (w < withdrawal) partialLast = true;
            bal -= w; withdrawn += w; bal *= 1 + r;
          } else {
            bal *= 1 + r;
            const w = Math.min(bal, withdrawal);
            if (w < withdrawal) partialLast = true;
            bal -= w; withdrawn += w;
          }
          if (bal < 0.5) { bal = 0; exhaustedAt = m; }
        }
        balance.push(bal); cumulative.push(withdrawn);
      }
      return { balance, cumulative, finalBalance: bal, withdrawn, exhaustedAt, partialLast, months: n };
    },

    futureCost(amount, infPct, years) { return amount * Math.pow(1 + infPct / 100, years); },
    presentValue(future, infPct, years) { return future / Math.pow(1 + infPct / 100, years); },

    emi(principal, annualRatePct, months) {
      if (months <= 0) return 0;
      const r = annualRatePct / 1200;
      if (r === 0) return principal / months;
      const p = Math.pow(1 + r, months);
      return (principal * r * p) / (p - 1);
    },
    /** Monthly amortisation with optional extra monthly payment and annual lump-sum (end of every 12th month). */
    amortize(principal, annualRatePct, years, extra = 0, lump = 0) {
      const n = Math.round(years * 12), r = annualRatePct / 1200;
      const emi = Fin.emi(principal, annualRatePct, n);
      let bal = principal, interest = 0, paid = 0, m = 0;
      const yearly = [principal];
      while (bal > 0.005 && m < n + 1) {
        m++;
        const i = bal * r;
        let princ = emi - i + extra;
        if (m % 12 === 0) princ += lump;
        if (m >= n || princ >= bal) princ = bal;
        bal -= princ; interest += i; paid += i + princ;
        if (bal < 0.005) bal = 0;
        if (m % 12 === 0) yearly.push(bal);
      }
      while (yearly.length < years + 1) yearly.push(0);
      return { emi, months: m, interest, paid, yearly };
    }
  };

  /* ===================================================================
     3. TAX RULES (by financial year) & TAX FUNCTIONS
     Keep all statutory numbers in this configuration. To add a new year,
     copy a block, edit the values and add it to TAX_RULES.
     Slab format: [upper limit of slab, rate]. Surcharge format: [income above, rate].
     =================================================================== */
  const TAX_COMMON = {
    cess: 0.04,
    new: {
      standardDeduction: 75000,
      slabs: [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]],
      rebate: { incomeLimit: 1200000, max: 60000, marginalRelief: true },
      surcharge: [[5000000, 0.10], [10000000, 0.15], [20000000, 0.25]] // capped at 25% in the new regime
    },
    old: {
      standardDeduction: 50000,
      slabsByAge: {
        below60: [[250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]],
        senior: [[300000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]],
        superSenior: [[500000, 0], [1000000, 0.20], [Infinity, 0.30]]
      },
      rebate: { incomeLimit: 500000, max: 12500, marginalRelief: false },
      surcharge: [[5000000, 0.10], [10000000, 0.15], [20000000, 0.25], [50000000, 0.37]],
      limits: { s80C: 150000, s80D: 100000, s80CCD1B: 50000, homeLoanInterest: 200000 }
    }
  };
  const TAX_RULES = {
    '2026-27': Object.assign({ label: 'FY 2026-27 (AY 2027-28)',
      source: 'Slab structure of Budget 2025 continues; Union Budget 2026-27 (1 Feb 2026) made no change to slabs, rebate, surcharge or cess.' }, TAX_COMMON),
    '2025-26': Object.assign({ label: 'FY 2025-26 (AY 2026-27)',
      source: 'Slab structure introduced by Budget 2025.' }, TAX_COMMON)
  };

  function slabTax(income, slabs) {
    let prev = 0, tax = 0;
    const rows = [];
    for (const [upto, rate] of slabs) {
      if (income > prev) {
        const part = Math.min(income, upto) - prev;
        rows.push({ from: prev, to: upto, rate, amount: part, tax: part * rate });
        tax += part * rate;
      }
      prev = upto;
      if (income <= upto) break;
    }
    return { tax, rows };
  }
  /** Rebate (section 87A equivalent), after slab tax. */
  function rebateFor(rule, taxable, tax) {
    if (taxable <= rule.incomeLimit) return Math.min(tax, rule.max);
    if (rule.marginalRelief) return Math.max(0, tax - (taxable - rule.incomeLimit));
    return 0;
  }
  /** Surcharge with marginal relief. `taxFn(income)` returns tax after rebate at that income. */
  function surchargeFor(income, taxAfterRebate, tiers, taxFn) {
    let rate = 0, idx = -1;
    tiers.forEach((t, i) => { if (income > t[0]) { rate = t[1]; idx = i; } });
    if (!rate) return 0;
    let sur = taxAfterRebate * rate;
    const th = tiers[idx][0], prevRate = idx > 0 ? tiers[idx - 1][1] : 0;
    const cap = taxFn(th) * (1 + prevRate) + (income - th);
    if (taxAfterRebate + sur > cap) sur = Math.max(0, cap - taxAfterRebate);
    return sur;
  }
  function assembleTax(rules, regime, slabs, taxable, summary) {
    const rule = rules[regime];
    const base = slabTax(taxable, slabs);
    const rebate = rebateFor(rule.rebate, taxable, base.tax);
    const afterRebate = base.tax - rebate;
    const taxFn = (inc) => { const b = slabTax(inc, slabs).tax; return b - rebateFor(rule.rebate, inc, b); };
    const surcharge = surchargeFor(taxable, afterRebate, rule.surcharge, taxFn);
    const cess = (afterRebate + surcharge) * rules.cess;
    const total = Math.round(afterRebate + surcharge + cess);
    return Object.assign({}, summary, {
      taxable, slabTax: base.tax, rows: base.rows, rebate, surcharge, cess, total,
      effective: summary.gross > 0 ? (total / summary.gross) * 100 : 0, monthly: total / 12
    });
  }
  function calcNewRegime(rules, inp) {
    const r = rules.new;
    const std = Math.min(r.standardDeduction, inp.salary);
    const gross = inp.salary + inp.other + Math.max(0, inp.hp);
    const taxable = Math.max(0, gross - std);
    return assembleTax(rules, 'new', r.slabs, taxable, { gross, deductions: std, notes: [] });
  }
  function calcOldRegime(rules, inp) {
    const o = rules.old, L = o.limits, notes = [];
    const std = Math.min(o.standardDeduction, inp.salary);
    const hra = Math.min(inp.hra, Math.max(0, inp.salary - std));
    const hli = Math.min(inp.hli, L.homeLoanInterest);
    const c80 = Math.min(inp.s80c, L.s80C), d80 = Math.min(inp.s80d, L.s80D), nps = Math.min(inp.s80ccd1b, L.s80CCD1B);
    if (inp.s80c > L.s80C) notes.push('80C is capped at ' + inr(L.s80C) + ' (you entered ' + inr(inp.s80c) + ').');
    if (inp.s80d > L.s80D) notes.push('80D is capped at ' + inr(L.s80D) + ' in this calculator.');
    if (inp.s80ccd1b > L.s80CCD1B) notes.push('80CCD(1B) is capped at ' + inr(L.s80CCD1B) + '.');
    if (inp.hli > L.homeLoanInterest) notes.push('Home loan interest (self-occupied) is capped at ' + inr(L.homeLoanInterest) + '.');
    if (inp.hra > inp.salary - std) notes.push('HRA exemption cannot exceed your salary after standard deduction.');
    const chapter6 = c80 + d80 + nps + inp.otherDed;
    const hpNet = inp.hp - hli; // a negative value is a house-property loss (max set-off is the capped interest)
    const gross = inp.salary + inp.other + Math.max(0, inp.hp);
    const total = inp.salary - std - hra + inp.other + hpNet;
    const taxable = Math.max(0, total - chapter6);
    const slabs = o.slabsByAge[inp.age] || o.slabsByAge.below60;
    return assembleTax(rules, 'old', slabs, taxable, { gross, deductions: std + hra + hli + chapter6, notes });
  }

  /* ===================================================================
     4. CHART RENDERING (native Canvas, hover tooltips)
     =================================================================== */
  function niceScale(max, ticks) {
    ticks = ticks || 4;
    if (!(max > 0)) return { step: 1, max: ticks };
    const raw = max / ticks, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    return { step, max: Math.ceil(max / step - 1e-9) * step };
  }
  function xTicks(xmin, xmax) {
    const range = xmax - xmin;
    if (range <= 0) return [xmin];
    const raw = range / 6, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    let step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
    step = Math.max(1, step);
    const out = [];
    for (let v = Math.ceil(xmin / step) * step; v <= xmax + 1e-9; v += step) out.push(v);
    return out;
  }
  function pathLabelFit(ctx, text, maxW, startPx, minPx, weight, family) {
    let px = startPx;
    do { ctx.font = weight + ' ' + px + 'px ' + family; px -= 1; } while (ctx.measureText(text).width > maxW && px >= minPx);
  }

  function paintLine(ctx, w, h, spec, hover) {
    const xs = spec.x, n = xs.length, series = spec.series;
    let maxY = 0;
    series.forEach((s) => s.values.forEach((v) => { if (v > maxY) maxY = v; }));
    const sc = niceScale(maxY, 4), tickCount = Math.round(sc.max / sc.step);
    ctx.font = '12px ' + FONT;
    let labelW = 0;
    for (let i = 0; i <= tickCount; i++) labelW = Math.max(labelW, ctx.measureText(inrShort(i * sc.step)).width);
    const pad = { l: Math.ceil(labelW) + 14, r: 16, t: 14, b: spec.xTitle ? 44 : 30 };
    const pw = Math.max(10, w - pad.l - pad.r), ph = Math.max(10, h - pad.t - pad.b);
    const xmin = xs[0], xmax = xs[n - 1];
    const X = (v) => pad.l + (xmax === xmin ? 0 : ((v - xmin) / (xmax - xmin)) * pw);
    const Y = (v) => pad.t + ph - (v / sc.max) * ph;

    ctx.lineWidth = 1; ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; ctx.fillStyle = COLORS.muted;
    for (let i = 0; i <= tickCount; i++) {
      const v = i * sc.step, y = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = COLORS.grid; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillText(inrShort(v), pad.l - 8, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    xTicks(xmin, xmax).forEach((v) => {
      ctx.fillStyle = COLORS.muted; ctx.fillText(spec.xLabel ? spec.xLabel(v) : String(v), X(v), pad.t + ph + 8);
    });
    if (spec.xTitle) { ctx.textAlign = 'right'; ctx.fillText(spec.xTitle, w - pad.r, h - 16); }

    series.forEach((s) => {
      if (s.area) {
        const g = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
        g.addColorStop(0, 'rgba(22,143,229,.22)'); g.addColorStop(1, 'rgba(22,143,229,0)');
        ctx.beginPath(); ctx.moveTo(X(xs[0]), Y(0));
        s.values.forEach((v, i) => ctx.lineTo(X(xs[i]), Y(v)));
        ctx.lineTo(X(xs[n - 1]), Y(0)); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      }
      ctx.beginPath();
      s.values.forEach((v, i) => (i ? ctx.lineTo(X(xs[i]), Y(v)) : ctx.moveTo(X(xs[i]), Y(v))));
      ctx.strokeStyle = s.color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.setLineDash(s.dashed ? [6, 5] : []); ctx.stroke(); ctx.setLineDash([]);
    });
    (spec.markers || []).forEach((mk) => {
      const x = X(mk.x);
      ctx.strokeStyle = mk.color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = mk.color; ctx.font = '600 12px ' + FONT; ctx.textBaseline = 'top';
      ctx.textAlign = x > w * 0.6 ? 'right' : 'left';
      ctx.fillText(mk.label, x + (x > w * 0.6 ? -6 : 6), pad.t + 4);
    });
    if (hover !== null && hover !== undefined) {
      const x = X(xs[hover]);
      ctx.strokeStyle = COLORS.sky; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke();
      series.forEach((s) => {
        ctx.beginPath(); ctx.arc(x, Y(s.values[hover]), 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = s.color; ctx.stroke();
      });
    }
    return {
      hit(px) {
        if (px < pad.l - 6 || px > w - pad.r + 6 || n < 1) return null;
        const v = xmin + ((px - pad.l) / pw) * (xmax - xmin);
        const idx = clamp(Math.round(((v - xmin) / (xmax - xmin || 1)) * (n - 1)), 0, n - 1);
        return {
          index: idx, y: 8,
          info: {
            title: spec.xTip ? spec.xTip(xs[idx]) : String(xs[idx]),
            rows: series.map((s) => ({ color: s.color, label: s.name, value: inr(s.values[idx]) }))
          }
        };
      }
    };
  }

  function paintDonut(ctx, w, h, spec, hover) {
    const segs = spec.segments.filter((s) => s.value > 0);
    const total = segs.reduce((a, s) => a + s.value, 0);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 12, thick = Math.max(18, R * 0.3), rMid = R - thick / 2;
    const arcs = [];
    ctx.lineCap = 'butt';
    if (!total) {
      ctx.beginPath(); ctx.arc(cx, cy, rMid, 0, Math.PI * 2); ctx.lineWidth = thick; ctx.strokeStyle = COLORS.grid; ctx.stroke();
    } else {
      let a = -Math.PI / 2;
      const gap = segs.length > 1 ? 0.03 : 0;
      segs.forEach((s, i) => {
        const sweep = (s.value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, rMid + (hover === i ? 3 : 0), a + gap / 2, a + sweep - gap / 2);
        ctx.lineWidth = thick + (hover === i ? 5 : 0); ctx.strokeStyle = s.color; ctx.stroke();
        arcs.push({ a0: a, a1: a + sweep, s });
        a += sweep;
      });
    }
    if (spec.center) {
      const maxW = (R - thick) * 1.7;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '12px ' + FONT; ctx.fillStyle = COLORS.muted;
      ctx.fillText(spec.center.label, cx, cy - 14);
      pathLabelFit(ctx, spec.center.value, maxW, 22, 11, '700', SERIF);
      ctx.fillStyle = COLORS.navy; ctx.fillText(spec.center.value, cx, cy + 10);
    }
    return {
      hit(px, py) {
        const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy);
        if (!total || d < R - thick - 4 || d > R + 8) return null;
        let ang = Math.atan2(dy, dx);
        if (ang < -Math.PI / 2) ang += Math.PI * 2;
        const idx = arcs.findIndex((x) => ang >= x.a0 && ang < x.a1);
        if (idx < 0) return null;
        const s = arcs[idx].s;
        return { index: idx, info: { title: s.label, rows: [{ color: s.color, label: 'Amount', value: inr(s.value) }, { label: 'Share', value: pct((s.value / total) * 100, 1) }] } };
      }
    };
  }

  function paintBars(ctx, w, h, spec, hover) {
    const bars = spec.bars;
    const maxV = Math.max(0, ...bars.map((b) => b.value)), minV = Math.min(0, ...bars.map((b) => b.value));
    const sc = niceScale(maxV - minV, 4);
    const yMax = Math.ceil(maxV / sc.step - 1e-9) * sc.step || sc.step;
    const yMin = Math.floor(minV / sc.step + 1e-9) * sc.step;
    ctx.font = '12px ' + FONT;
    const ticks = [];
    for (let v = yMin; v <= yMax + 1e-9; v += sc.step) ticks.push(v);
    let labelW = 0;
    ticks.forEach((v) => { labelW = Math.max(labelW, ctx.measureText(inrShort(v)).width); });
    const pad = { l: Math.ceil(labelW) + 14, r: 16, t: 14, b: 34 };
    const pw = Math.max(10, w - pad.l - pad.r), ph = Math.max(10, h - pad.t - pad.b);
    const Y = (v) => pad.t + ph - ((v - yMin) / (yMax - yMin)) * ph;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
    ticks.forEach((v) => {
      const y = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = v === 0 ? '#B9CCE2' : COLORS.grid; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillStyle = COLORS.muted; ctx.fillText(inrShort(v), pad.l - 8, y);
    });
    const band = pw / bars.length, bw = Math.min(84, band * 0.55), rects = [];
    bars.forEach((b, i) => {
      const x = pad.l + band * i + (band - bw) / 2, y0 = Y(0), y1 = Y(b.value);
      const top = Math.min(y0, y1), hh = Math.max(2, Math.abs(y1 - y0));
      ctx.fillStyle = b.color; ctx.globalAlpha = hover === null || hover === undefined || hover === i ? 1 : 0.55;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, top, bw, hh, 6); else ctx.rect(x, top, bw, hh);
      ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.text; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(b.label, x + bw / 2, pad.t + ph + 10);
      rects.push({ x: pad.l + band * i, w: band, top, b });
    });
    return {
      hit(px) {
        const idx = rects.findIndex((r) => px >= r.x && px < r.x + r.w);
        if (idx < 0) return null;
        const b = rects[idx].b;
        return { index: idx, info: { title: b.label, rows: [{ color: b.color, label: 'Amount', value: inr(b.value) }] } };
      }
    };
  }
  const PAINTERS = { line: paintLine, donut: paintDonut, bar: paintBars };

  function createChart() {
    const fig = el('figure', { class: 'card chart-card' });
    const title = el('h3', { class: 'card-title' });
    const sub = el('p', { class: 'chart-sub' });
    const wrap = el('div', { class: 'chart-wrap' });
    const canvas = el('canvas', { role: 'img' });
    const tip = el('div', { class: 'chart-tip', role: 'presentation' });
    const legend = el('div', { class: 'legend' });
    wrap.append(canvas, tip);
    fig.append(title, sub, wrap, legend);
    let spec = null, hover = null, geom = null, lastW = 0, ro = null;

    function renderLegend() {
      legend.replaceChildren();
      (spec.legend || []).forEach((it) => {
        const s = el('span');
        s.append(it.line
          ? el('i', { class: 'line-dash' + (it.dashed ? ' dashed' : ''), style: 'border-top-color:' + it.color })
          : el('i', { class: 'dot', style: 'background:' + it.color }));
        s.append(document.createTextNode(it.label));
        if (it.value) s.append(el('span', { class: 'legend-val', text: it.value }));
        legend.append(s);
      });
    }
    function draw() {
      if (!spec) return;
      const w = wrap.clientWidth;
      if (!w) return;
      const h = spec.height || 300, dpr = window.devicePixelRatio || 1;
      const ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      geom = PAINTERS[spec.type](ctx, w, h, spec, hover);
      lastW = w;
    }
    function showTip(hit, x, y) {
      tip.innerHTML = '<strong>' + esc(hit.info.title) + '</strong>' + hit.info.rows.map((r) =>
        '<div>' + (r.color ? '<span class="dot" style="background:' + r.color + '"></span>' : '') + esc(r.label) + ': ' + esc(r.value) + '</div>').join('');
      tip.style.display = 'block';
      const tw = tip.offsetWidth, W = wrap.clientWidth;
      let left = x + 14;
      if (left + tw > W - 4) left = x - tw - 14;
      tip.style.left = Math.max(4, left) + 'px';
      tip.style.top = Math.max(4, (hit.y !== undefined ? hit.y : y - 10)) + 'px';
    }
    function onMove(e) {
      if (!geom) return;
      const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const hit = geom.hit(x, y);
      hover = hit ? hit.index : null;
      draw();
      if (hit) showTip(hit, x, y); else tip.style.display = 'none';
    }
    function onLeave() { hover = null; tip.style.display = 'none'; draw(); }
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { if (wrap.clientWidth !== lastW) draw(); });
      ro.observe(wrap);
    }
    return {
      el: fig,
      update(s) {
        spec = s; hover = null; tip.style.display = 'none';
        title.textContent = s.title; sub.textContent = s.sub || '';
        canvas.setAttribute('aria-label', s.title + (s.alt ? '. ' + s.alt : ''));
        renderLegend(); draw();
      },
      redraw: draw,
      destroy() { if (ro) ro.disconnect(); fig.remove(); }
    };
  }
  function syncCharts(container, store, specs) {
    const ids = specs.map((s) => s.id);
    Object.keys(store).forEach((id) => { if (!ids.includes(id)) { store[id].destroy(); delete store[id]; } });
    specs.forEach((s) => {
      if (!store[s.id]) store[s.id] = createChart();
      if (store[s.id].el.parentNode !== container) container.append(store[s.id].el);
      store[s.id].update(s);
    });
  }

  /* Chart spec helpers */
  function lineSpec(o) {
    return Object.assign({
      type: 'line', height: 300, xTitle: 'Years', xLabel: (v) => String(v), xTip: (v) => 'Year ' + v,
      legend: o.series.map((s) => ({ color: s.color, label: s.name, line: true, dashed: s.dashed }))
    }, o);
  }
  function donutSpec(o) {
    const total = o.segments.reduce((a, s) => a + Math.max(0, s.value), 0);
    return Object.assign({
      type: 'donut', height: 270,
      legend: o.segments.filter((s) => s.value > 0).map((s) => ({ color: s.color, label: s.label, value: inr(s.value) + ' · ' + pct(total ? (s.value / total) * 100 : 0, 1) }))
    }, o);
  }
  const range = (n) => Array.from({ length: n + 1 }, (_, i) => i);

  /* ===================================================================
     5. FIELD FACTORIES & CALCULATOR DEFINITIONS
     =================================================================== */
  const money = (id, label, o) => Object.assign({ kind: 'money', id, label, prefix: '₹', decimals: 0, slider: true, scale: 'linear' }, o);
  const pctF = (id, label, o) => Object.assign({ kind: 'percent', id, label, suffix: '%', decimals: 2, slider: true, scale: 'linear' }, o);
  const yrsF = (id, label, o) => Object.assign({ kind: 'years', id, label, suffix: 'Years', decimals: 0, slider: true, scale: 'linear' }, o);
  const selF = (id, label, options, def, o) => Object.assign({ kind: 'select', id, label, options, def }, o);

  const CALCS = {};
  const ORDER = ['sip', 'stepup', 'lumpsum', 'networth', 'swp', 'inflation', 'compound', 'emi', 'tax'];
  const TIMING = [{ v: 'begin', label: 'Beginning of month' }, { v: 'end', label: 'End of month' }];

  /* ---- 1. SIP ---------------------------------------------------- */
  CALCS.sip = {
    id: 'sip', title: 'SIP Calculator',
    desc: 'Estimate the future value of a monthly Systematic Investment Plan (SIP) with monthly compounding.',
    fields: [
      money('amount', 'Monthly investment', { min: 500, max: 500000, step: 500, def: 25000, tip: 'The fixed amount you invest every month through your SIP.' }),
      pctF('rate', 'Expected annual return', { min: 1, max: 30, step: 0.5, def: 12, tip: 'The yearly return you expect from the fund. Actual market returns vary and are never guaranteed.' }),
      yrsF('years', 'Investment duration', { min: 1, max: 50, step: 1, def: 10, tip: 'How many years you plan to keep investing.' }),
      selF('timing', 'Contribution timing', TIMING, 'begin', { tip: 'Beginning of month assumes each instalment is invested on day 1 and earns that month’s return (annuity-due).' })
    ],
    run(v) {
      const begin = v.timing === 'begin';
      const s = Fin.sipSeries({ monthly: v.amount, rate: v.rate, years: v.years, begin });
      const gain = s.finalValue - s.totalInvested;
      const ret = s.totalInvested ? (gain / s.totalInvested) * 100 : 0;
      return {
        main: { label: 'Estimated final corpus', value: inr(s.finalValue), sub: inrShort(s.finalValue) + ' after ' + plural(v.years, 'year') + ' of ' + inr(v.amount) + ' per month' },
        stats: [
          { label: 'Total invested amount', value: inr(s.totalInvested) },
          { label: 'Estimated wealth gained', value: inr(gain), tone: 'good' },
          { label: 'Investment return', value: pct(ret, 1) },
          { label: 'Wealth multiple', value: trimDec(s.totalInvested ? s.finalValue / s.totalInvested : 0, 2) + 'x' }
        ],
        notes: [
          'Assumes each instalment is invested at the ' + (begin ? 'beginning' : 'end') + ' of the month, with returns compounded monthly (annual return ÷ 12).',
          'Returns are estimates, are not guaranteed, and are shown before taxes and fund expenses.'
        ],
        charts: [
          donutSpec({ id: 'split', title: 'Invested amount vs estimated returns', sub: 'Share of your final corpus', center: { label: 'Final corpus', value: inrShort(s.finalValue) },
            alt: 'Invested ' + inr(s.totalInvested) + ', returns ' + inr(gain),
            segments: [{ label: 'Invested amount', value: s.totalInvested, color: COLORS.royal }, { label: 'Estimated returns', value: Math.max(0, gain), color: COLORS.sky }] }),
          lineSpec({ id: 'growth', title: 'Year-wise investment growth', sub: 'Amounts in ₹ (hover to see each year)', x: range(v.years),
            alt: 'Corpus grows from ₹0 to ' + inr(s.finalValue),
            series: [{ name: 'Estimated corpus', color: COLORS.bright, values: s.value, area: true }, { name: 'Invested amount', color: COLORS.royal, values: s.invested, dashed: true }] })
        ]
      };
    },
    edu: {
      what: 'A SIP calculator estimates how much wealth a fixed monthly investment can build over time, for example in a mutual fund.',
      how: 'Each month’s instalment earns a monthly return, and earlier returns also earn returns. This is compounding.',
      formula: 'FV = P × [((1 + r)^n − 1) / r] × (1 + r), where r = annual return ÷ 12 ÷ 100 and n = years × 12. The final (1 + r) is dropped if investing at month end.',
      interpret: 'Compare “Invested amount” with the “Estimated corpus”. The gap is your estimated return. Longer durations make compounding far more powerful.',
      assume: 'Constant return every month, no exit load, expense ratio, inflation or tax. Real returns fluctuate.'
    },
    faq: [
      ['What is a SIP?', 'A Systematic Investment Plan lets you invest a fixed amount at regular intervals, usually monthly, in a mutual fund.'],
      ['What return should I assume?', 'Equity funds have historically varied widely. A conservative assumption is safer than an optimistic one, and no return is guaranteed.'],
      ['Does the timing of the instalment matter?', 'Slightly. Investing at the beginning of the month gives each instalment one extra month of growth compared with month end.'],
      ['Does this include tax or expense ratio?', 'No. Taxes on gains and fund charges will reduce your actual outcome.']
    ]
  };

  /* ---- 2. Step-Up SIP ---------------------------------------------- */
  CALCS.stepup = {
    id: 'stepup', title: 'Step-Up SIP Calculator',
    desc: 'See how increasing your SIP every year can multiply your wealth compared with a regular SIP.',
    fields: [
      money('amount', 'Initial monthly SIP', { min: 500, max: 500000, step: 500, def: 10000, tip: 'Your SIP amount in the first year.' }),
      pctF('rate', 'Expected annual return', { min: 1, max: 30, step: 0.5, def: 12, tip: 'The yearly return you expect. It is an estimate, not a guarantee.' }),
      yrsF('years', 'Investment duration', { min: 1, max: 50, step: 1, def: 15, tip: 'Number of years you will invest.' }),
      selF('stepPreset', 'Annual step-up', [{ v: '5', label: '5% every year' }, { v: '10', label: '10% every year' }, { v: '15', label: '15% every year' }, { v: '20', label: '20% every year' }, { v: 'custom', label: 'Custom percentage' }], '10',
        { tip: 'Your SIP amount rises by this percentage on every anniversary, for example when your salary grows.' }),
      pctF('stepCustom', 'Custom step-up percentage', { min: 0, max: 50, step: 1, def: 8, slider: false, showIf: (v) => v.stepPreset === 'custom', tip: 'Enter any yearly increase between 0% and 50%.' })
    ],
    run(v) {
      const step = v.stepPreset === 'custom' ? Number(v.stepCustom) : Number(v.stepPreset);
      const su = Fin.sipSeries({ monthly: v.amount, rate: v.rate, years: v.years, step, begin: true });
      const reg = Fin.sipSeries({ monthly: v.amount, rate: v.rate, years: v.years, step: 0, begin: true });
      const gain = su.finalValue - su.totalInvested, extra = su.finalValue - reg.finalValue;
      return {
        main: { label: 'Final estimated corpus (Step-Up SIP)', value: inr(su.finalValue), sub: 'With a ' + trimDec(step, 2) + '% yearly step-up over ' + plural(v.years, 'year') },
        stats: [
          { label: 'Total invested amount', value: inr(su.totalInvested) },
          { label: 'Estimated returns', value: inr(gain), tone: 'good' },
          { label: 'Initial monthly SIP', value: inr(v.amount) },
          { label: 'Final-year monthly SIP', value: inr(su.lastMonthly) },
          { label: 'Regular SIP corpus', value: inr(reg.finalValue) },
          { label: 'Additional wealth vs regular SIP', value: inr(extra), tone: 'good' }
        ],
        notes: [
          'The monthly SIP is held constant within a year and increased by the step-up percentage at each anniversary. Instalments are assumed at the beginning of each month.',
          'The regular SIP in the comparison uses the same starting amount, return and duration with no step-up.'
        ],
        charts: [
          lineSpec({ id: 'compare', title: 'Regular SIP vs Step-Up SIP', sub: 'Estimated corpus in ₹ by year', x: range(v.years),
            alt: 'Step-up SIP ends at ' + inr(su.finalValue) + ' versus ' + inr(reg.finalValue) + ' for regular SIP',
            series: [{ name: 'Step-Up SIP', color: COLORS.bright, values: su.value, area: true }, { name: 'Regular SIP', color: COLORS.royal, values: reg.value, dashed: true }] }),
          donutSpec({ id: 'split', title: 'Step-Up SIP: invested vs returns', sub: 'Share of your final corpus', center: { label: 'Final corpus', value: inrShort(su.finalValue) },
            segments: [{ label: 'Invested amount', value: su.totalInvested, color: COLORS.royal }, { label: 'Estimated returns', value: Math.max(0, gain), color: COLORS.sky }] })
        ]
      };
    },
    edu: {
      what: 'A Step-Up SIP increases your monthly investment by a fixed percentage every year, matching your growing income.',
      how: 'The calculator simulates every month, raises the instalment at each anniversary, and compounds returns monthly.',
      formula: 'Instalment in year k = P × (1 + step%)^(k − 1). Each month: balance = (balance + instalment) × (1 + r), r = annual return ÷ 12 ÷ 100.',
      interpret: 'Look at “Additional wealth vs regular SIP”. It shows what the yearly increase adds on top of a flat SIP.',
      assume: 'Constant returns, step-up applied on each anniversary, no taxes or charges. Make sure future instalments are affordable.'
    },
    faq: [
      ['Why use a Step-Up SIP?', 'Your income usually grows over time. Raising the SIP in line keeps your investing in step with your earnings.'],
      ['What step-up percentage is realistic?', 'Many investors choose 5–10%, similar to expected salary growth. Pick a number you can sustain.'],
      ['Is the step-up applied monthly?', 'No. It is applied once a year at each anniversary of the first instalment.'],
      ['Are returns guaranteed?', 'No. Both lines on the chart are estimates based on a constant assumed return.']
    ]
  };

  /* ---- 3. Lumpsum --------------------------------------------------- */
  const FREQ_BASIC = [{ v: '12', label: 'Monthly' }, { v: '4', label: 'Quarterly' }, { v: '2', label: 'Half-yearly' }, { v: '1', label: 'Annually' }];
  CALCS.lumpsum = {
    id: 'lumpsum', title: 'Lumpsum Calculator',
    desc: 'Calculate how a one-time investment can grow with compounding.',
    fields: [
      money('amount', 'Initial investment amount', { min: 1000, max: 100000000, step: 1000, def: 500000, scale: 'log', tip: 'The one-time amount you invest today.' }),
      pctF('rate', 'Expected annual return', { min: 1, max: 30, step: 0.5, def: 12, tip: 'The yearly return you expect, before tax. Not guaranteed.' }),
      yrsF('years', 'Investment duration', { min: 1, max: 50, step: 1, def: 10, tip: 'How long the money stays invested.' }),
      selF('freq', 'Compounding frequency', FREQ_BASIC, '1', { tip: 'How often returns are added to your balance. More frequent compounding gives slightly higher returns.' })
    ],
    run(v) {
      const m = Number(v.freq);
      const series = Fin.compoundSeries(v.amount, v.rate, v.years, m);
      const final = series[v.years], gain = final - v.amount;
      const simple = Fin.simpleSeries(v.amount, v.rate, v.years)[v.years];
      return {
        main: { label: 'Final investment value', value: inr(final), sub: inrShort(final) + ' after ' + plural(v.years, 'year') },
        stats: [
          { label: 'Initial investment', value: inr(v.amount) },
          { label: 'Estimated returns', value: inr(gain), tone: 'good' },
          { label: 'Total growth', value: pct(v.amount ? (gain / v.amount) * 100 : 0, 1) },
          { label: 'Wealth multiple', value: trimDec(v.amount ? final / v.amount : 0, 2) + 'x' }
        ],
        extra: '<div class="callout">Your original principal of <strong>' + inr(v.amount) + '</strong> earns <strong>' + inr(gain) + '</strong>. Without compounding (simple interest) you would earn ' + inr(simple - v.amount) + '; compounding adds <strong>' + inr(final - simple) + '</strong> more, because returns also earn returns.</div>',
        notes: ['Compounded ' + FREQ_BASIC.find((f) => f.v === v.freq).label.toLowerCase() + ' at a constant rate. Results are estimates, not guarantees, and exclude tax.'],
        charts: [
          lineSpec({ id: 'growth', title: 'Growth of your investment', sub: 'Value in ₹ at the end of each year', x: range(v.years),
            alt: inr(v.amount) + ' grows to ' + inr(final),
            series: [{ name: 'Investment value', color: COLORS.bright, values: series, area: true }, { name: 'Initial investment', color: COLORS.royal, values: series.map(() => v.amount), dashed: true }] }),
          donutSpec({ id: 'split', title: 'Principal vs estimated returns', sub: 'Share of the final value', center: { label: 'Final value', value: inrShort(final) },
            segments: [{ label: 'Initial investment', value: v.amount, color: COLORS.royal }, { label: 'Estimated returns', value: Math.max(0, gain), color: COLORS.sky }] })
        ]
      };
    },
    edu: {
      what: 'A lumpsum calculator shows what a single, one-time investment may be worth in the future.',
      how: 'The balance grows by the periodic rate each compounding period, and each period’s growth is added to the balance.',
      formula: 'A = P × (1 + r/m)^(m × t), where r is the annual rate, m the compounding periods per year and t the years.',
      interpret: 'The difference between the final value and your initial investment is the estimated return. Time matters more than most people expect.',
      assume: 'One constant annual return, no additional investments or withdrawals, no tax or inflation.'
    },
    faq: [
      ['Lumpsum or SIP, which is better?', 'It depends on your cash flow and market timing. Lumpsum puts all money to work at once; SIP spreads the entry over time.'],
      ['Does compounding frequency matter?', 'A little. Monthly compounding gives a slightly higher result than annual compounding at the same rate.'],
      ['Is this return guaranteed?', 'No. Market-linked investments can gain or lose value.']
    ]
  };

  /* ---- 4. Assets vs Liabilities (custom UI) --------------------------- */
  let nwId = 0;
  const nwItem = (name, amount, custom) => ({ id: 'nw' + (++nwId), name, amount, custom: !!custom });
  CALCS.networth = {
    id: 'networth', title: 'Assets vs Liabilities (Net Worth)',
    desc: 'List what you own and what you owe to see your net worth and asset allocation.',
    custom: true,
    defaults() {
      return {
        assets: [nwItem('Bank savings', 200000), nwItem('Fixed deposits', 300000), nwItem('Mutual funds', 500000), nwItem('Stocks', 100000), nwItem('Gold', 200000),
          nwItem('Real estate', 4000000), nwItem('EPF / PPF / NPS', 600000), nwItem('Other assets', 0)],
        liabs: [nwItem('Home loan', 2500000), nwItem('Car loan', 0), nwItem('Personal loan', 0), nwItem('Credit card debt', 0), nwItem('Education loan', 0), nwItem('Other liabilities', 0)]
      };
    },
    run(v) {
      const sum = (a) => a.reduce((t, i) => t + safe(i.amount), 0);
      const ta = sum(v.assets), tl = sum(v.liabs), nw = ta - tl;
      const label = (i) => i.name.trim() || 'Unnamed';
      const top = v.assets.slice().sort((a, b) => b.amount - a.amount)[0];
      const debtRatio = ta ? (tl / ta) * 100 : 0;
      return {
        main: { label: 'Net worth', value: inr(nw), sub: nw >= 0 ? 'Total assets − total liabilities = ' + inrShort(nw) : 'Your liabilities currently exceed your assets by ' + inrShort(-nw) },
        stats: [
          { label: 'Total assets', value: inr(ta), tone: 'good' },
          { label: 'Total liabilities', value: inr(tl), tone: tl > 0 ? 'bad' : '' },
          { label: 'Liabilities as % of assets', value: ta ? pct(debtRatio, 1) : '—', tone: debtRatio > 60 ? 'warn' : '' },
          { label: 'Largest asset', value: top && top.amount > 0 ? label(top) : '—' }
        ],
        notes: [
          'Net Worth = Total Assets − Total Liabilities. Enter current market values for assets and outstanding balances for loans.',
          nw < 0 ? 'A negative net worth is common early in a career or after a large loan. Reducing high-interest debt first usually helps most.' : 'Review your asset mix regularly to keep it aligned with your goals and risk comfort.'
        ],
        charts: [
          { id: 'compare', type: 'bar', height: 280, title: 'Assets vs liabilities', sub: 'Amounts in ₹', alt: 'Assets ' + inr(ta) + ', liabilities ' + inr(tl) + ', net worth ' + inr(nw),
            bars: [{ label: 'Assets', value: ta, color: COLORS.success }, { label: 'Liabilities', value: tl, color: COLORS.danger }, { label: 'Net worth', value: nw, color: COLORS.royal }],
            legend: [{ color: COLORS.success, label: 'Assets' }, { color: COLORS.danger, label: 'Liabilities' }, { color: COLORS.royal, label: 'Net worth' }] },
          donutSpec({ id: 'alloc', title: 'Asset allocation', sub: 'Share of total assets by category', center: { label: 'Total assets', value: inrShort(ta) },
            segments: v.assets.filter((i) => i.amount > 0).map((i, k) => ({ label: label(i), value: i.amount, color: GREENS[k % GREENS.length] })) })
        ],
        copyExtra: ['Assets:'].concat(v.assets.map((i) => '  ' + label(i) + ': ' + inr(i.amount)), ['Liabilities:'], v.liabs.map((i) => '  ' + label(i) + ': ' + inr(i.amount)))
      };
    },
    inputLines(v) { return []; },
    edu: {
      what: 'This tool compares everything you own (assets) with everything you owe (liabilities) to show your net worth.',
      how: 'Add up all asset values and all loan balances. The difference is your net worth. The charts show the balance and how your assets are spread.',
      formula: 'Net Worth = Total Assets − Total Liabilities.',
      interpret: 'A rising net worth over time is a sign of progress. A high liabilities-to-assets ratio means debt is heavy relative to what you own.',
      assume: 'Values are as entered by you. Illiquid assets such as property may not be sellable at the value you enter.'
    },
    faq: [
      ['What counts as an asset?', 'Savings, deposits, investments, gold, property and retirement funds like EPF, PPF or NPS.'],
      ['What counts as a liability?', 'Loans and dues you owe: home, car, personal and education loans, and credit card balances.'],
      ['Should I include my home?', 'Include its estimated market value as an asset and the outstanding home loan as a liability for a full picture.'],
      ['Is my data stored?', 'No. Everything stays in your browser and is lost when you close or refresh the page.']
    ]
  };

  /* ---- 5. SWP -------------------------------------------------------- */
  CALCS.swp = {
    id: 'swp', title: 'SWP Calculator',
    desc: 'See how long an investment corpus lasts when you withdraw a fixed amount every month.',
    fields: [
      money('corpus', 'Initial investment corpus', { min: 10000, max: 500000000, step: 10000, def: 5000000, scale: 'log', tip: 'The amount invested at the start of your Systematic Withdrawal Plan.' }),
      money('withdrawal', 'Monthly withdrawal amount', { min: 500, max: 5000000, step: 500, def: 40000, scale: 'log', tip: 'The fixed amount you withdraw every month.' }),
      pctF('rate', 'Expected annual return', { min: 1, max: 30, step: 0.5, def: 10, tip: 'The yearly return you expect on the remaining corpus. Not guaranteed.' }),
      yrsF('years', 'Withdrawal duration', { min: 1, max: 50, step: 1, def: 20, tip: 'How many years you plan to withdraw.' }),
      selF('timing', 'Withdrawal timing', TIMING, 'begin', { tip: 'Beginning of month: you withdraw first, then the rest earns the month’s return. End of month: the corpus earns first.' })
    ],
    run(v) {
      const s = Fin.swp({ corpus: v.corpus, withdrawal: v.withdrawal, rate: v.rate, years: v.years, begin: v.timing === 'begin' });
      const returns = s.finalBalance + s.withdrawn - v.corpus;
      const exhausted = s.exhaustedAt !== null;
      const r = v.rate / 1200, perpetual = (v.corpus - (v.timing === 'begin' ? v.withdrawal : 0)) * r >= v.withdrawal;
      const xs = s.balance.map((_, i) => i / 12);
      const status = exhausted ? 'Corpus exhausted' : 'Corpus lasts';
      return {
        main: { label: 'Remaining corpus', value: inr(s.finalBalance), sub: exhausted ? 'Your money runs out in about ' + fmtDuration(s.exhaustedAt) : 'After ' + plural(v.years, 'year') + ' of withdrawals' },
        stats: [
          { label: 'Initial investment', value: inr(v.corpus) },
          { label: 'Total amount withdrawn', value: inr(s.withdrawn) },
          { label: 'Estimated returns earned', value: inr(returns), tone: 'good' },
          { label: 'Corpus status', value: status, tone: exhausted ? 'bad' : 'good' },
          { label: 'Money lasts', value: exhausted ? fmtDuration(s.exhaustedAt) : (perpetual ? 'Indefinitely at this return' : 'Beyond ' + plural(v.years, 'year')), tone: exhausted ? 'warn' : 'good' }
        ],
        extra: exhausted ? '<div class="callout warn">At these settings the corpus reaches zero after ' + fmtDuration(s.exhaustedAt) + (s.partialLast ? ' (the last withdrawal is only partial).' : '.') + ' Consider a smaller withdrawal, a bigger corpus, or a shorter duration.</div>' : '',
        notes: ['Calculated month by month with monthly compounding, withdrawing at the ' + (v.timing === 'begin' ? 'beginning' : 'end') + ' of each month. The balance never goes below zero.', 'Tax on withdrawn gains, exit loads and changing returns are not included.'],
        charts: [
          lineSpec({ id: 'swp', title: 'Remaining corpus vs cumulative withdrawals', sub: 'Amounts in ₹ by year', x: xs, height: 320,
            alt: exhausted ? 'Corpus reaches zero after ' + fmtDuration(s.exhaustedAt) : 'Corpus remaining ' + inr(s.finalBalance),
            xLabel: (v2) => String(Math.round(v2)), xTip: (v2) => 'Year ' + trimDec(v2, 2),
            markers: exhausted ? [{ x: s.exhaustedAt / 12, color: COLORS.danger, label: 'Corpus reaches zero' }] : [],
            series: [{ name: 'Remaining corpus', color: COLORS.bright, values: s.balance, area: true }, { name: 'Cumulative withdrawals', color: COLORS.royal, values: s.cumulative, dashed: true }] })
        ]
      };
    },
    edu: {
      what: 'A Systematic Withdrawal Plan (SWP) lets you take a fixed amount from an investment regularly while the rest stays invested.',
      how: 'Every month the corpus earns a return and the withdrawal is deducted. The calculator tracks the balance until the end, or until it hits zero.',
      formula: 'Beginning of month: B = (B − W) × (1 + r). End of month: B = B × (1 + r) − W. Here r = annual return ÷ 12 ÷ 100 and W = monthly withdrawal.',
      interpret: 'If the corpus is still positive at the end, your withdrawals were sustainable for that period. If the line hits zero, the money has run out.',
      assume: 'Constant return, fixed withdrawals (not inflation-adjusted), and no tax. Real markets fluctuate, so leave a safety margin.'
    },
    faq: [
      ['What is an SWP?', 'A plan that withdraws a fixed sum from your mutual fund investment at regular intervals, often used for retirement income.'],
      ['How much can I withdraw safely?', 'It depends on returns and duration. Lower withdrawals relative to the corpus last longer. Test several values here.'],
      ['Does the withdrawal rise with inflation?', 'Not in this calculator. Your costs probably will, so plan for that separately.'],
      ['What happens when the corpus runs out?', 'The chart shows the point it reaches zero, and withdrawals stop. The balance is never shown as negative.']
    ]
  };

  /* ---- 6. Inflation -------------------------------------------------- */
  CALCS.inflation = {
    id: 'inflation', title: 'Inflation Calculator',
    desc: 'Understand how rising prices change what today’s money can buy in the future.',
    presets: [{ label: '₹10 lakh today', values: { amount: 1000000 } }, { label: '₹25 lakh today', values: { amount: 2500000 } }, { label: '₹50 lakh today', values: { amount: 5000000 } }, { label: '₹1 crore today', values: { amount: 10000000 } }],
    fields: [
      money('amount', 'Current cost / amount', { min: 1000, max: 1000000000, step: 1000, def: 1000000, scale: 'log', tip: 'The cost of something today, or an amount of money you have today.' }),
      pctF('rate', 'Annual inflation rate', { min: 0, max: 20, step: 0.5, def: 6, tip: 'The average yearly rise in prices. Long-run Indian consumer inflation has varied; it is only an estimate.' }),
      yrsF('years', 'Number of years', { min: 1, max: 50, step: 1, def: 10, tip: 'How many years into the future you want to look.' }),
      money('futureAmt', 'Future amount', { min: 1000, max: 1000000000, step: 1000, def: 1000000, scale: 'log', slider: false,
        group: { title: 'Reverse calculator', desc: 'What will a future amount be worth in today’s money? Uses the inflation rate and years above.' },
        tip: 'An amount you expect to have in the future, for example a maturity value.' })
    ],
    run(v) {
      const future = Fin.futureCost(v.amount, v.rate, v.years);
      const power = Fin.presentValue(v.amount, v.rate, v.years);
      const todayWorth = Fin.presentValue(v.futureAmt, v.rate, v.years);
      const fx = [], px = [];
      for (let t = 0; t <= v.years; t++) { fx.push(Fin.futureCost(v.amount, v.rate, t)); px.push(Fin.presentValue(v.amount, v.rate, t)); }
      return {
        main: { label: 'Estimated future cost', value: inr(future), sub: 'What costs ' + inr(v.amount) + ' today may cost about ' + inrShort(future) + ' in ' + plural(v.years, 'year') },
        stats: [
          { label: 'Current amount', value: inr(v.amount) },
          { label: 'Additional amount required', value: inr(future - v.amount), tone: 'warn' },
          { label: 'Percentage increase', value: pct(v.amount ? ((future - v.amount) / v.amount) * 100 : 0, 1) },
          { label: 'Purchasing power of ' + inrShort(v.amount) + ' after ' + v.years + ' yrs', value: inr(power), tone: 'bad' }
        ],
        extra: '<div class="extra-block"><p class="section-title">Reverse calculator</p><div class="callout"><strong>' + inr(v.futureAmt) + '</strong> received ' + plural(v.years, 'year') + ' from now would have roughly the purchasing power of <strong>' + inr(todayWorth) + '</strong> today, at ' + trimDec(v.rate, 2) + '% yearly inflation.</div></div>',
        notes: ['All figures are estimates. Actual inflation differs by year and by the type of expense (education and healthcare often rise faster).', 'Future cost = Current cost × (1 + inflation)^years.'],
        copyExtra: ['Reverse: ' + inr(v.futureAmt) + ' in the future ≈ ' + inr(todayWorth) + ' in today’s money'],
        charts: [
          lineSpec({ id: 'infl', title: 'Future cost vs purchasing power', sub: 'In ₹, year by year (estimates)', x: range(v.years),
            alt: 'Future cost rises to ' + inr(future) + ' while purchasing power falls to ' + inr(power),
            series: [{ name: 'Future cost of what ' + inrShort(v.amount) + ' buys today', color: COLORS.danger, values: fx }, { name: 'Purchasing power of ' + inrShort(v.amount), color: COLORS.bright, values: px, area: true }] })
        ]
      };
    },
    edu: {
      what: 'Inflation is the steady rise in prices. This calculator shows how much more you may need in future to buy the same things.',
      how: 'Today’s cost is increased by the inflation rate each year. The reverse mode does the opposite and shrinks a future amount back to today’s money.',
      formula: 'Future cost = Current cost × (1 + i)^n. Present purchasing power = Future amount ÷ (1 + i)^n.',
      interpret: 'Use the future cost to set realistic savings goals. The purchasing-power line shows how the same money buys less over time.',
      assume: 'A constant inflation rate across all years. These are estimates only.'
    },
    faq: [
      ['What inflation rate should I use?', 'Many planners use 5–7% for general expenses in India, and higher for education or healthcare. Treat it as an assumption.'],
      ['Why does my money buy less over time?', 'Prices rise, so each rupee purchases fewer goods and services.'],
      ['How does inflation affect investing?', 'Your investment return needs to beat inflation to grow your real purchasing power.'],
      ['Is the reverse calculator accurate?', 'It is exact for the rate and years you enter, but the inflation assumption itself is uncertain.']
    ]
  };

  /* ---- 7. Compound interest ------------------------------------------- */
  CALCS.compound = {
    id: 'compound', title: 'Compound Interest Calculator',
    desc: 'Discover how interest earning interest grows your money, and compare it with simple interest.',
    fields: [
      money('principal', 'Initial principal', { min: 1000, max: 100000000, step: 1000, def: 100000, scale: 'log', tip: 'The amount you start with.' }),
      pctF('rate', 'Annual interest rate', { min: 1, max: 30, step: 0.1, def: 8, tip: 'The yearly interest rate. For a bank deposit this is the quoted rate.' }),
      yrsF('years', 'Investment duration', { min: 1, max: 50, step: 1, def: 10, tip: 'How many years the money stays invested.' }),
      selF('freq', 'Compounding frequency', [{ v: '365', label: 'Daily' }, { v: '12', label: 'Monthly' }, { v: '4', label: 'Quarterly' }, { v: '2', label: 'Half-yearly' }, { v: '1', label: 'Annually' }], '4',
        { tip: 'How often interest is added to the principal. Bank FDs usually compound quarterly.' })
    ],
    run(v) {
      const m = Number(v.freq);
      const comp = Fin.compoundSeries(v.principal, v.rate, v.years, m);
      const simp = Fin.simpleSeries(v.principal, v.rate, v.years);
      const final = comp[v.years], interest = final - v.principal;
      return {
        main: { label: 'Final amount', value: inr(final), sub: inrShort(final) + ' after ' + plural(v.years, 'year') + ' at ' + trimDec(v.rate, 2) + '% p.a.' },
        stats: [
          { label: 'Principal amount', value: inr(v.principal) },
          { label: 'Compound interest earned', value: inr(interest), tone: 'good' },
          { label: 'Total growth', value: pct(v.principal ? (interest / v.principal) * 100 : 0, 1) },
          { label: 'Simple interest (same inputs)', value: inr(simp[v.years] - v.principal) },
          { label: 'Extra earned by compounding', value: inr(final - simp[v.years]), tone: 'good' }
        ],
        notes: ['Simple interest = P × r × t on the same principal, rate and duration. Compound interest also earns interest on previously earned interest.', 'Estimates only. Tax on interest is not included.'],
        charts: [
          lineSpec({ id: 'ci', title: 'Compound vs simple interest', sub: 'Value in ₹ at the end of each year', x: range(v.years),
            alt: 'Compound ends at ' + inr(final) + ', simple interest ends at ' + inr(simp[v.years]),
            series: [{ name: 'Compound interest', color: COLORS.bright, values: comp, area: true }, { name: 'Simple interest', color: COLORS.royal, values: simp, dashed: true }] })
        ]
      };
    },
    edu: {
      what: 'Compound interest means you earn interest on your original money and also on the interest already earned.',
      how: 'Interest is added to the balance at each compounding interval, so the next interval earns on a bigger amount.',
      formula: 'A = P × (1 + r/n)^(n × t). Simple interest: A = P × (1 + r × t).',
      interpret: 'The gap between the two lines is the extra money compounding creates. It widens with time and with higher rates.',
      assume: 'A fixed rate for the whole period, no deposits or withdrawals, and no tax.'
    },
    faq: [
      ['Simple vs compound interest?', 'Simple interest is earned only on the principal. Compound interest is earned on the principal plus accumulated interest.'],
      ['Does more frequent compounding help?', 'Yes, but only slightly. Rate and time matter far more than frequency.'],
      ['Which compounding do FDs use?', 'Most bank fixed deposits in India compound quarterly, but check your bank’s terms.'],
      ['What is the Rule of 72?', 'Divide 72 by the annual rate to roughly estimate how many years it takes to double your money.']
    ]
  };

  /* ---- 8. Home loan EMI ------------------------------------------------ */
  CALCS.emi = {
    id: 'emi', title: 'Home Loan EMI Calculator',
    desc: 'Work out your EMI, total interest and how prepayments can shorten your loan.',
    fields: [
      money('loan', 'Home loan amount', { min: 100000, max: 100000000, step: 50000, def: 5000000, scale: 'log', tip: 'The amount you borrow from the lender (the principal).' }),
      pctF('rate', 'Annual interest rate', { min: 0, max: 20, step: 0.05, def: 8.5, tip: 'The yearly interest rate on your loan. Zero is allowed.' }),
      yrsF('years', 'Loan tenure', { min: 1, max: 30, step: 1, def: 20, tip: 'The number of years over which you repay the loan.' }),
      money('down', 'Down payment (optional)', { min: 0, max: 100000000, step: 50000, def: 1250000, slider: false, tip: 'Money you pay upfront from your own funds. Property value is taken as loan + down payment, which gives the loan-to-value ratio.' }),
      money('extra', 'Additional monthly payment', { min: 0, max: 1000000, step: 1000, def: 0, slider: false, group: { title: 'Prepayment comparison', desc: 'See how extra payments can shorten your loan and save interest.' }, tip: 'An extra amount paid every month over and above your EMI, applied fully to principal.' }),
      money('lump', 'Annual lump-sum prepayment (optional)', { min: 0, max: 100000000, step: 10000, def: 0, slider: false, tip: 'A one-time prepayment made at the end of every 12th month.' })
    ],
    run(v) {
      const n = v.years * 12;
      const base = Fin.amortize(v.loan, v.rate, v.years, 0, 0);
      const pre = Fin.amortize(v.loan, v.rate, v.years, v.extra, v.lump);
      const emi = base.emi, interest = base.paid - v.loan, total = base.paid;
      const value = v.loan + v.down, ltv = v.down > 0 && value > 0 ? (v.loan / value) * 100 : null;
      const hasPre = v.extra > 0 || v.lump > 0;
      const saved = base.interest - pre.interest, monthsSaved = base.months - pre.months;
      const closure = addMonths(new Date(), pre.months);
      const row = (a, b, c, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + a + '</td><td>' + b + '</td><td>' + c + '</td></tr>';
      const table = '<div class="extra-block"><p class="section-title">Prepayment comparison</p><div class="table-scroll"><table><thead><tr><th></th><th>Original</th><th>With prepayment</th></tr></thead><tbody>' +
        row('Loan duration', fmtDuration(base.months), fmtDuration(pre.months)) +
        row('Total interest', inr(base.interest), inr(pre.interest)) +
        row('Total repayment', inr(base.paid), inr(pre.paid)) +
        row('Interest saved', '—', inr(saved), 'total-row') +
        row('Closes earlier by', '—', hasPre ? fmtDuration(monthsSaved) : '—', 'total-row') +
        '</tbody></table></div><div class="callout' + (hasPre ? '' : ' warn') + '" style="margin-top:12px">' +
        (hasPre ? 'With your prepayments the loan could close around <strong>' + fmtMonthYear(closure) + '</strong>, <strong>' + fmtDuration(monthsSaved) + '</strong> earlier, saving about <strong>' + inr(saved) + '</strong> in interest (assuming EMIs start next month).'
          : 'Enter an additional monthly payment or an annual lump sum to see how much interest and time you can save.') + '</div></div>';
      return {
        main: { label: 'Monthly EMI', value: inr(emi), sub: 'For ' + inr(v.loan) + ' over ' + plural(v.years, 'year') + ' at ' + trimDec(v.rate, 2) + '% p.a.' },
        stats: [
          { label: 'Principal amount', value: inr(v.loan) },
          { label: 'Total interest payable', value: inr(interest), tone: 'warn' },
          { label: 'Total repayment amount', value: inr(total) },
          { label: 'Loan-to-value ratio', value: ltv === null ? 'Add a down payment' : pct(ltv, 1), tone: ltv !== null && ltv > 80 ? 'warn' : '' }
        ],
        extra: table,
        notes: ['EMI = P × r × (1 + r)^n ÷ ((1 + r)^n − 1), where r is the monthly rate. At 0% interest the EMI is simply principal ÷ months.', 'Prepayments are applied to the principal in a month-by-month schedule. Lenders may charge prepayment fees or round differently, so your actual figures can vary.', 'Property value for the loan-to-value ratio = loan amount + down payment.'],
        copyExtra: ['Original duration: ' + fmtDuration(base.months), 'Revised duration: ' + fmtDuration(pre.months), 'Interest saved: ' + inr(saved)],
        charts: [
          donutSpec({ id: 'split', title: 'Principal vs total interest', sub: 'Share of total repayment', center: { label: 'Total repayment', value: inrShort(total) },
            segments: [{ label: 'Loan principal', value: v.loan, color: COLORS.royal }, { label: 'Total interest', value: Math.max(0, interest), color: COLORS.sky }] }),
          lineSpec({ id: 'bal', title: 'Outstanding loan balance', sub: 'In ₹ at the end of each year', x: range(v.years),
            alt: 'Loan balance falls to zero over ' + plural(v.years, 'year') + (hasPre ? ' or sooner with prepayments' : ''),
            series: hasPre ? [{ name: 'Original schedule', color: COLORS.royal, values: base.yearly, dashed: true }, { name: 'With prepayments', color: COLORS.bright, values: pre.yearly, area: true }] : [{ name: 'Outstanding balance', color: COLORS.bright, values: base.yearly, area: true }] })
        ]
      };
    },
    edu: {
      what: 'An EMI (Equated Monthly Instalment) is the fixed amount you pay your lender every month until the home loan is repaid.',
      how: 'Each EMI covers interest on the outstanding balance plus part of the principal. Early EMIs are mostly interest; later ones are mostly principal.',
      formula: 'EMI = P × r × (1 + r)^n ÷ ((1 + r)^n − 1), P = loan, r = annual rate ÷ 12 ÷ 100, n = months.',
      interpret: 'Total interest shows the real cost of the loan. Even small prepayments early on can cut years and a large amount of interest.',
      assume: 'Fixed interest rate for the full tenure, EMIs start one month after disbursal, and no fees or insurance. Floating rates change EMI or tenure.'
    },
    faq: [
      ['How do prepayments help?', 'They reduce the outstanding principal sooner, so less interest builds up and the loan ends earlier.'],
      ['What is the loan-to-value ratio?', 'It is the loan amount as a percentage of the property value. Lenders often finance up to about 75–90% depending on the loan size.'],
      ['Is the interest rate fixed?', 'This calculator assumes it is. For floating-rate loans, results will change when your rate changes.'],
      ['Is my EMI the same as the bank’s figure?', 'It should be very close. Small differences can come from rounding, fees or day-count methods.']
    ]
  };

  /* ---- 9. Income tax ------------------------------------------------------ */
  const taxFmtRate = (r) => trimDec(r * 100, 2) + '%';
  CALCS.tax = {
    id: 'tax', title: 'Income Tax Calculator (India)',
    desc: 'Estimate your income tax under the New and Old regimes and see which one costs less for your inputs.',
    fields: [
      selF('fy', 'Financial year', Object.keys(TAX_RULES).map((k) => ({ v: k, label: TAX_RULES[k].label })), '2026-27', { tip: 'The tax rules used. FY 2026-27 is also called tax year 2026-27 under the Income-tax Act, 2025.' }),
      selF('regime', 'Regime to show in detail', [{ v: 'new', label: 'New tax regime (default)' }, { v: 'old', label: 'Old tax regime' }], 'new', { tip: 'Both regimes are always compared below. This choice sets the headline result.' }),
      selF('age', 'Age group', [{ v: 'below60', label: 'Below 60 years' }, { v: 'senior', label: '60–79 years (senior citizen)' }, { v: 'superSenior', label: '80 years and above' }], 'below60', { tip: 'Age changes the basic exemption limit under the old regime only.' }),
      money('salary', 'Annual salary income', { min: 0, max: 50000000, step: 50000, def: 1500000, scale: 'sqrt', tip: 'Gross salary or pension for the year, before the standard deduction.' }),
      money('other', 'Income from other sources', { min: 0, max: 50000000, step: 1000, def: 0, slider: false, tip: 'Interest, dividends and other regular income. Capital gains taxed at special rates are not covered.' }),
      money('hp', 'House property income', { min: 0, max: 50000000, step: 1000, def: 0, slider: false, tip: 'Net rental income after the 30% standard deduction, if any. Enter 0 if you have none.' }),
      money('s80c', 'Section 80C', { min: 0, max: MAX_AMOUNT, step: 1000, def: 150000, slider: false,
        group: { title: 'Old regime deductions', desc: 'Used only for the old regime (and the comparison). The new regime does not allow these.' }, tip: 'EPF, PPF, ELSS, life insurance premium, tuition fees and similar. Limit ₹1,50,000.' }),
      money('s80d', 'Section 80D (health insurance)', { min: 0, max: MAX_AMOUNT, step: 1000, def: 25000, slider: false, tip: 'Health insurance premiums for self, family and parents. This tool caps the total at ₹1,00,000; your actual limit depends on ages.' }),
      money('s80ccd1b', 'Section 80CCD(1B) (NPS)', { min: 0, max: MAX_AMOUNT, step: 1000, def: 0, slider: false, tip: 'Additional NPS contribution. Limit ₹50,000.' }),
      money('hra', 'Eligible HRA exemption', { min: 0, max: MAX_AMOUNT, step: 1000, def: 0, slider: false, tip: 'Enter the HRA exemption you have already worked out (least of actual HRA, rent paid minus 10% of salary, or 40/50% of salary). This tool does not compute it.' }),
      money('hli', 'Home loan interest (self-occupied)', { min: 0, max: MAX_AMOUNT, step: 1000, def: 0, slider: false, tip: 'Interest paid on a self-occupied home loan. Limit ₹2,00,000 under Section 24(b).' }),
      money('otherDed', 'Other deductions', { min: 0, max: MAX_AMOUNT, step: 1000, def: 0, slider: false, tip: 'Anything else you are eligible for, such as 80E, 80G or 80TTA. Applied as entered, with no limit checks.' })
    ],
    run(v) {
      const rules = TAX_RULES[v.fy] || TAX_RULES['2026-27'];
      const nw = calcNewRegime(rules, v), od = calcOldRegime(rules, v);
      const sel = v.regime === 'old' ? od : nw, selName = v.regime === 'old' ? 'Old regime' : 'New regime';
      const diff = Math.abs(od.total - nw.total);
      const better = od.total === nw.total ? null : (od.total < nw.total ? 'old' : 'new');
      const rowsDef = [['Gross annual income', 'gross'], ['Total eligible deductions', 'deductions'], ['Taxable income', 'taxable'], ['Tax on slabs', 'slabTax'], ['Rebate / marginal relief', 'rebate'], ['Surcharge', 'surcharge'], ['Health & education cess (4%)', 'cess'], ['Total tax liability', 'total']];
      const cell = (key, r, which) => '<td' + (better === which && key === 'total' ? ' class="best"' : '') + '>' + (key === 'rebate' && r[key] > 0 ? '− ' : '') + inr(r[key]) + '</td>';
      const compare = '<div class="extra-block"><p class="section-title">Old vs New regime</p><div class="table-scroll"><table><thead><tr><th></th><th' + (better === 'old' ? ' class="best"' : '') + '>Old regime</th><th' + (better === 'new' ? ' class="best"' : '') + '>New regime</th></tr></thead><tbody>' +
        rowsDef.map(([l, k]) => '<tr' + (k === 'total' ? ' class="total-row"' : '') + '><td>' + l + '</td>' + cell(k, od, 'old') + cell(k, nw, 'new') + '</tr>').join('') +
        '</tbody></table></div><div class="callout" style="margin-top:12px">' +
        (better ? '<strong>' + (better === 'new' ? 'New' : 'Old') + ' regime</strong> shows the lower estimated tax by <strong>' + inr(diff) + '</strong> per year (about ' + inr(diff / 12) + ' a month).' : 'Both regimes give the same estimated tax for these inputs.') +
        ' This is based only on the figures and assumptions you supplied.</div></div>';
      const slabRows = sel.rows.map((r) => '<tr><td>' + (r.to === Infinity ? 'Above ' + inr(r.from) : inr(r.from) + ' – ' + inr(r.to)) + '</td><td>' + taxFmtRate(r.rate) + '</td><td>' + inr(r.amount) + '</td><td>' + inr(r.tax) + '</td></tr>').join('');
      const slabs = '<div class="extra-block"><p class="section-title">Slab-wise tax: ' + selName + '</p><div class="table-scroll"><table><thead><tr><th>Slab</th><th>Rate</th><th>Income in slab</th><th>Tax</th></tr></thead><tbody>' +
        (slabRows || '<tr><td colspan="4">No taxable income</td></tr>') + '</tbody></table></div></div>';
      const takeHome = Math.max(0, sel.gross - sel.total);
      const notes = [
        'Rules used: ' + rules.label + '. ' + rules.source,
        'Assumes a resident individual with income taxed at normal slab rates. Capital gains, ESOPs, business income, TDS credits and advance tax are not included.',
        'New regime: standard deduction ₹' + fmtNum(rules.new.standardDeduction) + ' and rebate up to ₹' + fmtNum(rules.new.rebate.max) + ' for taxable income up to ' + inr(rules.new.rebate.incomeLimit) + ', with marginal relief just above it. Old regime: standard deduction ₹' + fmtNum(rules.old.standardDeduction) + ' and rebate up to ₹' + fmtNum(rules.old.rebate.max) + ' for taxable income up to ' + inr(rules.old.rebate.incomeLimit) + '.',
        'HRA exemption and other deductions are taken as you enter them. This tool cannot verify eligibility, rent receipts or investment proofs.',
        'Sections are quoted by their familiar Income-tax Act, 1961 numbers. The Income-tax Act, 2025 renumbers them from 1 April 2026 without changing these rates. Confirm with incometax.gov.in or a tax professional before filing.'
      ].concat(od.notes);
      const statList = [
        { label: 'Gross annual income', value: inr(sel.gross) },
        { label: 'Total eligible deductions', value: inr(sel.deductions) },
        { label: 'Taxable income', value: inr(sel.taxable) },
        { label: 'Estimated income tax (slabs)', value: inr(sel.slabTax) },
        { label: 'Applicable rebate', value: inr(sel.rebate), tone: sel.rebate > 0 ? 'good' : '' }
      ];
      if (sel.surcharge > 0) statList.push({ label: 'Surcharge', value: inr(sel.surcharge), tone: 'warn' });
      statList.push({ label: 'Health & education cess', value: inr(sel.cess) }, { label: 'Effective tax rate', value: pct(sel.effective, 2) }, { label: 'Monthly tax equivalent', value: inr(sel.monthly) });
      return {
        main: { label: 'Total tax liability (' + selName + ')', value: inr(sel.total), sub: 'Taxable income ' + inr(sel.taxable) + ' · ' + rules.label },
        stats: statList,
        extra: compare + slabs,
        notes,
        copyExtra: ['Old regime tax: ' + inr(od.total), 'New regime tax: ' + inr(nw.total), better ? 'Lower estimated tax: ' + (better === 'new' ? 'New' : 'Old') + ' regime (by ' + inr(diff) + ')' : 'Both regimes: same tax'],
        charts: [
          { id: 'cmp', type: 'bar', height: 280, title: 'Total tax: Old vs New regime', sub: 'Estimated yearly tax in ₹', alt: 'Old ' + inr(od.total) + ', New ' + inr(nw.total),
            bars: [{ label: 'Old regime', value: od.total, color: COLORS.royal }, { label: 'New regime', value: nw.total, color: COLORS.bright }],
            legend: [{ color: COLORS.royal, label: 'Old regime' }, { color: COLORS.bright, label: 'New regime' }] },
          donutSpec({ id: 'split', title: 'Where your income goes (' + selName.toLowerCase() + ')', sub: 'Share of gross annual income', center: { label: 'Gross income', value: inrShort(sel.gross) },
            segments: [{ label: 'Take-home (before other deductions)', value: takeHome, color: COLORS.bright }, { label: 'Income tax + surcharge', value: Math.max(0, sel.total - Math.round(sel.cess)), color: COLORS.navy }, { label: 'Health & education cess', value: Math.round(sel.cess), color: COLORS.sky }] })
        ]
      };
    },
    edu: {
      what: 'This calculator estimates your yearly income tax in India under both the New and Old regimes and tells you which is lower for your inputs.',
      how: 'It subtracts the standard deduction (and, for the old regime, the deductions you enter), applies slab rates, then the rebate, any surcharge and 4% cess.',
      formula: 'Tax = slab tax − rebate + surcharge (with marginal relief) + 4% cess on (tax + surcharge). Taxable income = income − permitted deductions.',
      interpret: 'The regime with the lower total is cheaper for the exact figures you entered. Change your deductions to see where the break-even point lies.',
      assume: 'Resident individual, normal slab-rate income only, deductions as entered (with caps on 80C, 80D, 80CCD(1B) and home loan interest). Not tax advice.'
    },
    faq: [
      ['Which regime is better for me?', 'The new regime has lower rates and fewer deductions. The old regime can win if your eligible deductions are large. The comparison table shows your numbers.'],
      ['Is income up to ₹12 lakh really tax-free?', 'Under the new regime, taxable income up to ₹12 lakh gets a rebate that cancels the tax. With the ₹75,000 standard deduction, salaried income up to ₹12.75 lakh can result in nil tax.'],
      ['Why is HRA not calculated?', 'HRA exemption depends on your rent, city and salary structure. Enter the figure you have already computed.'],
      ['Are these the final tax rules?', 'They follow the published slabs for the selected year, but laws can change. Verify on the official income tax portal before filing.'],
      ['Does this cover capital gains?', 'No. Special-rate income such as capital gains is not included and is not eligible for the rebate.']
    ]
  };

  /* ===================================================================
     6. PANEL CONTROLLER (inputs, validation, results rendering)
     =================================================================== */
  const panels = {};

  function fieldDisplay(f, v) {
    if (f.kind === 'money') return fmtNum(v, 0);
    return String(parseFloat(safe(v).toFixed(f.decimals)));
  }
  function fieldDefaults(calc) {
    const d = {};
    calc.fields.forEach((f) => { d[f.id] = f.def; });
    return d;
  }
  function boundsMessage(f) {
    if (f.kind === 'money') return 'Enter an amount between ' + inr(f.min) + ' and ' + (f.max >= MAX_AMOUNT ? 'a realistic value' : inr(f.max)) + '.';
    if (f.kind === 'percent') return 'Enter a rate between ' + f.min + '% and ' + f.max + '%.';
    return 'Enter between ' + f.min + ' and ' + f.max + ' years.';
  }
  function toPos(f, v) {
    v = clamp(v, f.min, f.max);
    if (f.scale === 'log') return (1000 * Math.log(v / f.min)) / Math.log(f.max / f.min);
    if (f.scale === 'sqrt') return 1000 * Math.sqrt((v - f.min) / (f.max - f.min));
    return v;
  }
  function fromPos(f, p) {
    let v;
    if (f.scale === 'log') v = f.min * Math.pow(f.max / f.min, p / 1000);
    else if (f.scale === 'sqrt') v = f.min + (f.max - f.min) * Math.pow(p / 1000, 2);
    else return p;
    if (v <= f.min) return f.min;
    if (v >= f.max) return f.max;
    const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
    return clamp(Math.round(v / mag) * mag, f.min, f.max);
  }
  function setSliderFill(sl) {
    const span = sl.max - sl.min || 1;
    sl.style.setProperty('--p', ((sl.value - sl.min) / span) * 100 + '%');
  }
  function tipBlock(id, text) {
    return [
      el('button', { type: 'button', class: 'tip', 'aria-label': 'About: ' + text, 'aria-describedby': id }, [document.createTextNode('?')]),
      el('span', { class: 'tip-bubble', role: 'tooltip', id, text })
    ];
  }

  function mountFields(ctx) {
    const { calc, refs, state } = ctx;
    refs.fields.replaceChildren();
    ctx.inputs = {};
    calc.fields.forEach((f) => {
      if (f.group) refs.fields.append(el('div', { class: 'field-group' }, [el('h4', { text: f.group.title }), f.group.desc ? el('p', { text: f.group.desc }) : null]));
      const uid = calc.id + '-' + f.id;
      const wrap = el('div', { class: 'field', 'data-field': f.id });
      const top = el('div', { class: 'field-top' }, [el('label', { for: uid, text: f.label })].concat(f.tip ? tipBlock(uid + '-tip', f.tip) : []));
      wrap.append(top);
      const input = { f, wrap };
      if (f.kind === 'select') {
        const sel = el('select', { id: uid }, f.options.map((o) => el('option', { value: o.v, text: o.label })));
        sel.addEventListener('change', () => { state.values[f.id] = sel.value; ctx.recalc(); });
        wrap.append(sel); input.select = sel;
      } else {
        const inp = el('input', { id: uid, type: 'text', inputmode: f.decimals ? 'decimal' : 'numeric', autocomplete: 'off', 'aria-describedby': uid + '-err' });
        const box = el('div', { class: 'input-wrap' }, [f.prefix ? el('span', { class: 'affix pre', text: f.prefix, 'aria-hidden': 'true' }) : null, inp, f.suffix ? el('span', { class: 'affix', text: f.suffix, 'aria-hidden': 'true' }) : null]);
        const err = el('div', { class: 'field-error', id: uid + '-err', role: 'alert', hidden: true });
        wrap.append(box);
        if (f.slider) {
          const sl = el('input', { type: 'range', 'aria-label': f.label + ' slider' });
          if (f.scale === 'linear') { sl.min = f.min; sl.max = f.max; sl.step = f.step || 1; } else { sl.min = 0; sl.max = 1000; sl.step = 1; }
          sl.addEventListener('input', () => {
            const val = roundTo(fromPos(f, Number(sl.value)), f.decimals);
            state.values[f.id] = val; inp.value = fieldDisplay(f, val);
            err.hidden = true; box.classList.remove('invalid'); setSliderFill(sl); ctx.recalc();
          });
          wrap.append(sl); input.slider = sl;
        }
        wrap.append(err);
        inp.addEventListener('focus', () => { inp.value = String(state.values[f.id]); inp.select(); });
        inp.addEventListener('input', () => {
          const clean = inp.value.replace(/[^\d.,]/g, '');
          if (clean !== inp.value) inp.value = clean;
          const n = parseNum(clean);
          if (Number.isNaN(n)) { err.textContent = 'Please enter a valid number.'; err.hidden = false; box.classList.add('invalid'); return; }
          if (n < f.min || n > f.max) { err.textContent = boundsMessage(f); err.hidden = false; box.classList.add('invalid'); return; }
          err.hidden = true; box.classList.remove('invalid');
          state.values[f.id] = roundTo(n, f.decimals);
          if (input.slider) { input.slider.value = toPos(f, state.values[f.id]); setSliderFill(input.slider); }
          ctx.recalc();
        });
        inp.addEventListener('blur', () => {
          const n = parseNum(inp.value);
          if (!Number.isNaN(n)) state.values[f.id] = roundTo(clamp(n, f.min, f.max), f.decimals);
          err.hidden = true; box.classList.remove('invalid');
          inp.value = fieldDisplay(f, state.values[f.id]);
          if (input.slider) { input.slider.value = toPos(f, state.values[f.id]); setSliderFill(input.slider); }
          ctx.recalc();
        });
        input.input = inp;
      }
      if (f.hint) wrap.append(el('p', { class: 'field-hint', text: f.hint }));
      refs.fields.append(wrap);
      ctx.inputs[f.id] = input;
    });
    syncFields(ctx);
  }
  function syncFields(ctx) {
    const { calc, state } = ctx;
    calc.fields.forEach((f) => {
      const i = ctx.inputs[f.id], val = state.values[f.id];
      if (f.kind === 'select') i.select.value = val;
      else {
        i.input.value = fieldDisplay(f, val);
        i.wrap.querySelector('.input-wrap').classList.remove('invalid');
        i.wrap.querySelector('.field-error').hidden = true;
        if (i.slider) { i.slider.value = toPos(f, val); setSliderFill(i.slider); }
      }
    });
    updateVisibility(ctx);
  }
  function updateVisibility(ctx) {
    ctx.calc.fields.forEach((f) => { if (f.showIf) ctx.inputs[f.id].wrap.hidden = !f.showIf(ctx.state.values); });
  }

  /* ---- Net-worth custom input UI ----------------------------------- */
  function mountNetWorth(ctx) {
    const { refs, state } = ctx;
    const v = state.values;
    refs.fields.replaceChildren();
    refs.presets.replaceChildren(el('span', { class: 'presets-label', text: 'Quick action:' }));
    const clear = el('button', { type: 'button', class: 'chip', text: 'Clear all entries' });
    clear.addEventListener('click', () => {
      v.assets = v.assets.filter((i) => !i.custom); v.liabs = v.liabs.filter((i) => !i.custom);
      v.assets.concat(v.liabs).forEach((i) => { i.amount = 0; });
      mountNetWorth(ctx); ctx.recalc(); toast('All entries cleared');
    });
    refs.presets.append(clear); refs.presets.hidden = false;

    function section(key, title, cls, addLabel, newName) {
      const box = el('div', { class: 'nw-section' });
      const add = el('button', { type: 'button', class: 'chip nw-add', text: addLabel });
      box.append(el('div', { class: 'nw-title ' + cls }, [el('span', { text: title }), add]));
      const rows = el('div', { class: 'nw-section', 'data-rows': key });
      box.append(rows);
      function draw() {
        rows.replaceChildren();
        v[key].forEach((item) => rows.append(row(item)));
        if (!v[key].length) rows.append(el('p', { class: 'field-hint', text: 'No entries. Use the button above to add one.' }));
      }
      function row(item) {
        const r = el('div', { class: 'nw-row' });
        const nameId = item.id + '-name', amtId = item.id + '-amt';
        if (item.custom) {
          const ni = el('input', { class: 'nw-name-input', id: nameId, type: 'text', maxlength: '40', value: item.name, 'aria-label': 'Name of entry' });
          ni.addEventListener('input', () => { item.name = ni.value; ctx.recalc(); });
          r.append(ni);
        } else r.append(el('label', { class: 'nw-name', for: amtId, text: item.name }));
        const ai = el('input', { id: amtId, type: 'text', inputmode: 'numeric', autocomplete: 'off', value: fmtNum(item.amount, 0), 'aria-label': item.name + ' amount in rupees' });
        const wrap = el('div', { class: 'input-wrap nw-amount' }, [el('span', { class: 'affix pre', text: '₹', 'aria-hidden': 'true' }), ai]);
        const err = el('div', { class: 'field-error', role: 'alert', hidden: true });
        ai.addEventListener('focus', () => { ai.value = String(item.amount); ai.select(); });
        ai.addEventListener('input', () => {
          const clean = ai.value.replace(/[^\d.,]/g, ''); if (clean !== ai.value) ai.value = clean;
          const n = parseNum(clean);
          if (Number.isNaN(n) || n < 0 || n > MAX_AMOUNT) { err.textContent = 'Enter an amount between ₹0 and a realistic value.'; err.hidden = false; wrap.classList.add('invalid'); return; }
          err.hidden = true; wrap.classList.remove('invalid'); item.amount = Math.round(n); ctx.recalc();
        });
        ai.addEventListener('blur', () => {
          const n = parseNum(ai.value);
          if (!Number.isNaN(n)) item.amount = Math.round(clamp(n, 0, MAX_AMOUNT));
          err.hidden = true; wrap.classList.remove('invalid'); ai.value = fmtNum(item.amount, 0); ctx.recalc();
        });
        const rm = el('button', { type: 'button', class: 'icon-btn nw-remove', 'aria-label': 'Remove ' + item.name, title: 'Remove', text: '×' });
        rm.addEventListener('click', () => { v[key] = v[key].filter((i) => i !== item); draw(); ctx.recalc(); });
        r.append(wrap, rm, err);
        return r;
      }
      add.addEventListener('click', () => {
        if (v[key].length >= 30) { toast('You can add up to 30 entries'); return; }
        const it = nwItem(newName, 0, true); v[key].push(it); draw(); ctx.recalc();
        const f = $('#' + it.id + '-name', rows); if (f) { f.focus(); f.select(); }
      });
      draw();
      return box;
    }
    refs.fields.append(section('assets', 'Assets', 'assets', '+ Add asset', 'Custom asset'), section('liabs', 'Liabilities', 'liabs', '+ Add liability', 'Custom liability'));
  }

  function inputLinesFor(ctx) {
    const { calc, state } = ctx;
    if (calc.custom) return [];
    const out = [];
    calc.fields.forEach((f) => {
      if (f.showIf && !f.showIf(state.values)) return;
      const val = state.values[f.id];
      let txt;
      if (f.kind === 'select') txt = (f.options.find((o) => o.v === val) || {}).label;
      else if (f.kind === 'money') txt = inr(val);
      else if (f.kind === 'percent') txt = trimDec(val, 2) + '%';
      else txt = plural(val, 'year');
      out.push(f.label + ': ' + txt);
    });
    return out;
  }

  function createPanel(calc, section) {
    const tpl = $('#calc-template').content.cloneNode(true);
    const root = tpl.querySelector('.calc');
    const refs = {};
    $$('[data-ref]', root).forEach((n) => { refs[n.dataset.ref] = n; });
    refs.title.textContent = calc.title;
    refs.desc.textContent = calc.desc;
    refs.printMeta.textContent = calc.title + ' · ' + new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    section.append(root);

    const ctx = { calc, refs, root, charts: {}, inputs: {}, last: null, state: { values: calc.custom ? calc.defaults() : fieldDefaults(calc) } };
    ctx.recalc = function recalc() {
      const out = calc.run(ctx.state.values);
      ctx.last = out;
      updateVisibility(ctx);
      renderResults(ctx, out);
    };
    ctx.reset = function reset() {
      ctx.state.values = calc.custom ? calc.defaults() : fieldDefaults(calc);
      if (calc.custom) mountNetWorth(ctx); else syncFields(ctx);
      ctx.recalc();
    };

    refs.fields.addEventListener('submit', (e) => e.preventDefault());
    if (calc.custom) mountNetWorth(ctx); else mountFields(ctx);

    if (calc.presets) {
      refs.presets.append(el('span', { class: 'presets-label', text: 'Quick examples:' }));
      calc.presets.forEach((p) => {
        const b = el('button', { type: 'button', class: 'chip', text: p.label });
        b.addEventListener('click', () => { Object.assign(ctx.state.values, p.values); syncFields(ctx); ctx.recalc(); });
        refs.presets.append(b);
      });
      refs.presets.hidden = false;
    }

    // Education & FAQ
    const e = calc.edu;
    [['What is this calculator?', e.what], ['How does it work?', e.how], ['Which formula is used?', e.formula, 'formula'], ['How to interpret the results', e.interpret], ['Important assumptions and limitations', e.assume]]
      .forEach(([h, p, cls]) => refs.edu.append(el('div', { class: 'edu-item' + (cls ? ' ' + cls : '') }, [el('h4', { text: h }), el('p', { text: p })])));
    calc.faq.forEach(([q, a], i) => refs.faq.append(el('details', { open: false }, [el('summary', { text: q }), el('p', { text: a })])));

    // Buttons
    refs.reset.addEventListener('click', () => { ctx.reset(); toast('Inputs reset'); });
    refs.recalc.addEventListener('click', () => { ctx.recalc(); toast('Results updated'); });
    refs.copy.addEventListener('click', async () => { const ok = await copyToClipboard(summaryText(ctx)); toast(ok ? 'Results copied to clipboard' : 'Could not copy. Please copy manually.'); });
    refs.share.addEventListener('click', () => shareResults(ctx));
    refs.pdf.addEventListener('click', () => printResults(ctx));

    ctx.recalc();
    return ctx;
  }

  function renderResults(ctx, out) {
    const { refs } = ctx;
    refs.mainLabel.textContent = out.main.label;
    refs.mainValue.textContent = out.main.value;
    refs.mainSub.textContent = out.main.sub || '';
    refs.stats.replaceChildren(...out.stats.map((s) => el('div', { class: 'stat' + (s.tone ? ' tone-' + s.tone : '') }, [el('p', { class: 'stat-label', text: s.label }), el('p', { class: 'stat-value', text: s.value })])));
    refs.extra.innerHTML = out.extra || '';
    refs.notes.replaceChildren(...out.notes.map((n) => el('li', { text: n })));
    syncCharts(refs.charts, ctx.charts, out.charts);
  }

  /* ===================================================================
     7. SHARING, CLIPBOARD & PDF / PRINT
     =================================================================== */
  function summaryText(ctx) {
    const { calc, last } = ctx;
    const lines = ['BOOKIVO – ' + calc.title, ''];
    const inputs = inputLinesFor(ctx);
    if (inputs.length) lines.push('Inputs', ...inputs.map((l) => '• ' + l), '');
    lines.push('Results', '• ' + last.main.label + ': ' + last.main.value);
    last.stats.forEach((s) => lines.push('• ' + s.label + ': ' + s.value));
    if (last.copyExtra) lines.push('', ...last.copyExtra);
    lines.push('', 'Estimates only, not financial, investment or tax advice.');
    if (/^https?:/.test(location.protocol)) lines.push(location.href.split('#')[0] + '#' + calc.id);
    return lines.join('\n');
  }
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* fall through to legacy path */ }
    try {
      const ta = el('textarea', { 'aria-hidden': 'true', readonly: true });
      ta.value = text; ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      document.body.append(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }
  async function shareResults(ctx) {
    const text = summaryText(ctx), title = 'BOOKIVO – ' + ctx.calc.title;
    if (navigator.share) {
      try { await navigator.share({ title, text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const ok = await copyToClipboard(text);
    toast(ok ? 'Sharing is not available here, so results were copied instead' : 'Sharing is not available on this device');
  }
  function redrawCharts(ctx) { Object.values(ctx.charts).forEach((c) => c.redraw()); }
  function printResults(ctx) {
    redrawCharts(ctx);
    const prev = document.title;
    document.title = 'BOOKIVO – ' + ctx.calc.title;
    const restore = () => { document.title = prev; window.removeEventListener('afterprint', restore); redrawCharts(ctx); };
    window.addEventListener('afterprint', restore);
    toast('Choose “Save as PDF” in the print dialog');
    setTimeout(() => window.print(), 150);
  }
  window.addEventListener('beforeprint', () => { const c = panels[activeId]; if (c) redrawCharts(c); });

  /* ===================================================================
     8. APPLICATION INITIALISATION & CALCULATOR NAVIGATION
     =================================================================== */
  let activeId = null;

  function activate(id, opts) {
    opts = opts || {};
    if (!CALCS[id]) id = 'sip';
    activeId = id;
    $$('.tab').forEach((t) => {
      const on = t.dataset.calc === id;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on) {
        if (opts.focus) t.focus();
        const bar = t.parentElement;
        if (bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: t.offsetLeft - (bar.clientWidth - t.offsetWidth) / 2, behavior: 'smooth' });
      }
    });
    $$('.panel').forEach((p) => { p.hidden = p.dataset.calc !== id; });
    if (!panels[id]) panels[id] = createPanel(CALCS[id], $('#panel-' + id));
    else redrawCharts(panels[id]);
    // Charts need a visible container to measure, so draw once more after layout.
    requestAnimationFrame(() => redrawCharts(panels[id]));
    if (opts.updateHash !== false) history.replaceState(null, '', '#' + id);
  }

  function init() {
    const tabs = $$('.tab');
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => activate(t.dataset.calc));
      t.addEventListener('keydown', (e) => {
        let j = null;
        if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = tabs.length - 1;
        if (j !== null) { e.preventDefault(); activate(tabs[j].dataset.calc, { focus: true }); }
      });
    });
    window.addEventListener('hashchange', () => {
      const id = location.hash.slice(1);
      if (CALCS[id] && id !== activeId) activate(id, { updateHash: false });
    });
    const start = location.hash.slice(1);
    activate(CALCS[start] ? start : ORDER[0], { updateHash: !!CALCS[start] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // Exposed only for automated testing of the pure calculation functions.
  window.BookivoCalc = { Fin, TAX_RULES, calcNewRegime, calcOldRegime, CALCS, inr, inrShort };
})();