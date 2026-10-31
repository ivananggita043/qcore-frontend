import { hourSlots } from "../config/sections.js";

/* ---------- profil data tiap section (satuan: check per hari) ---------- */
const SECTION_PROFILE = {
  cutting:   { perDay: [110, 160], passRate: [90, 98],   lines: 3, qc: [4, 6] },
  sewing:    { perDay: [100, 150], passRate: [84, 96],   lines: 8, qc: [14, 20] },
  washing:   { perDay: [90, 130],  passRate: [86, 97],   lines: 3, qc: [5, 8] },
  finishing: { perDay: [100, 140], passRate: [90, 98],   lines: 5, qc: [9, 13] },
  packing:   { perDay: [110, 160], passRate: [89, 98],   lines: 4, qc: [8, 12] },
  final:     { perDay: [110, 150], passRate: [88, 97],   lines: 2, qc: [4, 6] }, // 1 check = 1 carton (40 pcs)
};

const DEFECTS = {
  cutting:   ["Salah ukuran", "Bergerigi", "Pola miring", "Kain cacat", "Notch salah"],
  sewing:    ["Skip Stitch", "Broken Stitch", "Uneven Hem", "Puckering", "Ukuran tidak sesuai"],
  washing:   ["Noda", "Warna belang", "Penyusutan", "Bau kimia", "Tekstur kasar"],
  finishing: ["Benang sisa", "Kotor/noda", "Setrika kurang", "Label salah", "Kancing lepas"],
  packing:   ["Wrong carton count", "Missing label", "Wrong size sticker", "Torn polybag", "Damaged carton"],
  final:     ["Visible stain", "Out of tolerance", "Loose thread", "Wrong assortment", "Misaligned print"],
};

const NAMES = { cutting: "Cutting", sewing: "Sewing", washing: "Washing", finishing: "Finishing", packing: "Packing", final: "Final" };
const PCS_PER_CHECK = 40; // 1 check = 40 pcs

/* ---------- helper ---------- */
const pad2 = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const asDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
const pctChange = (a, b) => (b ? +(((a - b) / b) * 100).toFixed(1) : 0);

// pseudo-random stabil berdasarkan seed (tanggal + section)
function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const between = (r, [a, b]) => a + r() * (b - a);

/* ---------- inti: statistik satu section pada satu hari ---------- */
function sectionStats(section, date) {
  const p = SECTION_PROFILE[section];
  const r = rng(`${dayKey(date)}:${section}`);
  const weekend = [0, 6].includes(date.getDay());

  const inspections = Math.round(between(r, p.perDay) * (weekend ? 0.55 : 1)); // jumlah check
  const targetPass = between(r, p.passRate);
  const defects = Math.min(inspections, Math.round(inspections * (1 - targetPass / 100)));
  const passRate = inspections ? +(((inspections - defects) / inspections) * 100).toFixed(1) : 0;
  const activeQc = Math.max(1, Math.round(between(r, p.qc) * (weekend ? 0.5 : 1)));

  // bagi defect ke jenis-jenisnya (jumlah total = defects)
  const types = DEFECTS[section];
  const weights = types.map((_, i) => (types.length - i) * (0.7 + r() * 0.6));
  const wSum = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.floor((defects * w) / wSum));
  let rest = defects - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0; i = (i + 1) % counts.length, rest--) counts[i]++;
  const topDefects = types
    .map((name, i) => ({ name, count: counts[i] }))
    .sort((a, b) => b.count - a.count);

  return { section, inspections, passRate, defects, activeQc, lines: p.lines, topDefects };
}

function overview(date) {
  const keys = Object.keys(SECTION_PROFILE);
  const today = keys.map((k) => sectionStats(k, date));
  const yest = keys.map((k) => sectionStats(k, new Date(date.getTime() - 864e5)));
  const sum = (arr, f) => arr.reduce((a, s) => a + s[f], 0);

  const total = (arr) => {
    const inspections = sum(arr, "inspections");
    const defects = sum(arr, "defects");
    return {
      inspections,
      defects,
      activeQc: sum(arr, "activeQc"),
      passRate: inspections ? +(((inspections - defects) / inspections) * 100).toFixed(1) : 0,
    };
  };

  const t = total(today);
  const y = total(yest);
  const merged = {};
  today.forEach((s) =>
    s.topDefects.forEach((d) => (merged[d.name] = (merged[d.name] || 0) + d.count))
  );

  return {
    ...t,
    prev: y,
    delta: { passRate: +(t.passRate - y.passRate).toFixed(1) },
    sections: today,
    topDefects: Object.entries(merged)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/* ================= adapter untuk tiap dashboard (parameter: "YYYY-MM-DD") ================= */

// Super admin
export function superDay(iso) {
  const t = overview(asDate(iso));
  return {
    kpi: {
      inspections: { value: t.inspections, delta: pctChange(t.inspections, t.prev.inspections) },
      passRate:    { value: t.passRate, delta: t.delta.passRate },
      defects:     { value: t.defects, delta: pctChange(t.defects, t.prev.defects) },
      activeQc:    { value: t.activeQc, delta: pctChange(t.activeQc, t.prev.activeQc) },
    },
    sections: t.sections.map((s) => ({
      key: s.section,
      name: NAMES[s.section],
      pct: Math.round(s.passRate),
      inspections: s.inspections,
      defects: s.defects,
    })),
    topDefects: t.topDefects.slice(0, 3),
  };
}

// Admin (satu section)
export function adminDay(section, iso) {
  const key = SECTION_PROFILE[section] ? section : "sewing";
  const s = sectionStats(key, asDate(iso));
  const lines = Array.from({ length: s.lines }, (_, i) => {
    const r = rng(`${iso}:${key}:line${i}`);
    const pct = Math.min(99, Math.round(s.passRate - 6 + r() * 9));
    return { name: `Line ${pad2(i + 1)}`, pct };
  });
  return {
    overview: {
      inspections: s.inspections,
      defect: s.defects,
      passRate: Math.round(s.passRate),
      total: s.inspections * PCS_PER_CHECK,
    },
    lines,
  };
}

const STYLE_CODES = ["VS-2401", "VS-2402", "VS-2405", "CK-1101", "CK-1107", "EF-330", "EF-342", "EF-351", "LB-710", "LB-715"];

// User QC (daftar check per jam)
export function userDay(section, iso) {
  const key = SECTION_PROFILE[section] ? section : "sewing";
  const s = sectionStats(key, asDate(iso));
  const r = rng(`${iso}:${key}:user`);
  const isToday = iso === dayKey(new Date());
  const nowH = new Date().getHours();

  const checks = [];
  hourSlots()
    .filter((h) => !isToday || h <= nowH)
    .forEach((h) => {
      const n = r() < 0.15 ? 0 : r() < 0.3 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const min = Math.floor(r() * 60);
        checks.push({
          id: `DR-${2380 + Math.floor(r() * 90)}`,
          hour: h,
          time: `${pad2(h)}.${pad2(min)}`,
          status: r() < 0.2 ? "Finish" : "Pass",
          style: STYLE_CODES[Math.floor(r() * STYLE_CODES.length)],
          qty: PCS_PER_CHECK,
        });
      }
    });
  checks.sort((a, b) => b.hour - a.hour || b.time.localeCompare(a.time));

  const inspections = checks.length;
  const defect = Math.min(inspections, Math.round(inspections * (1 - s.passRate / 100)));
  return {
    summary: {
      inspections,
      defect,
      defectPct: inspections ? +((defect / inspections) * 100).toFixed(1) : 0,
      qty: inspections * PCS_PER_CHECK,
    },
    checks,
  };
}

// Statistik satu section pada satu hari (untuk halaman QC Records)
export function sectionDay(section, iso) {
  const key = SECTION_PROFILE[section] ? section : "sewing";
  const s = sectionStats(key, asDate(iso));
  return {
    section: key,
    name: NAMES[key],
    inspections: s.inspections,
    defects: s.defects,
    passRate: s.passRate,
    activeQc: s.activeQc,
    topDefects: s.topDefects,
  };
}

/* ================= performa per buyer & style (data tiruan) ================= */
const BUYERS = [
  { name: "Victoria's Secret", styles: ["VS-2401", "VS-2402", "VS-2405"] },
  { name: "Calvin Klein",      styles: ["CK-1101", "CK-1107"] },
  { name: "Eileen Fisher",     styles: ["EF-330", "EF-342", "EF-351"] },
  { name: "L.L.Bean",          styles: ["LB-710", "LB-715"] },
];

function buyerRaw(sections, iso) {
  const date = asDate(iso);
  const acc = {}; // "buyer|style" -> { inspections, defects }
  sections
    .filter((sec) => SECTION_PROFILE[sec])
    .forEach((sec) => {
      const s = sectionStats(sec, date);
      const r = rng(`${iso}:${sec}:buyers`);
      const items = [];
      BUYERS.forEach((b) => {
        const buyerBias = 0.5 + r() * 1.2;
        b.styles.forEach((st) =>
          items.push({ buyer: b.name, style: st, w: 0.3 + r(), bias: buyerBias * (0.8 + r() * 0.5) })
        );
      });
      const wSum = items.reduce((a, it) => a + it.w, 0);
      items.forEach((it) => {
        it.insp = Math.round((s.inspections * it.w) / wSum);
      });
      // each style gets its own defect rate around the section rate
      const secRate = s.inspections ? s.defects / s.inspections : 0;
      const bsum = items.reduce((a, it) => a + it.insp * it.bias, 0) || 1;
      const isum = items.reduce((a, it) => a + it.insp, 0) || 1;
      items.forEach((it) => {
        const rate = Math.min(0.6, (secRate * it.bias * isum) / bsum);
        const key = `${it.buyer}|${it.style}`;
        const a = (acc[key] ||= { buyer: it.buyer, style: it.style, inspections: 0, defects: 0 });
        a.inspections += it.insp;
        a.defects += Math.min(it.insp, Math.max(it.insp >= 10 ? 1 : 0, Math.round(it.insp * rate)));
      });
    });
  return acc;
}

const rateOf = (d, i) => (i ? +((d / i) * 100).toFixed(1) : 0);

// Hasil: [{ name, inspections, defects, rate, delta, styles: [{ name, inspections, defects, rate, delta }] }]
// rate = defect rate (%), delta = selisih poin vs hari sebelumnya (positif = memburuk)
export function buyerPerformance(sections, iso) {
  const today = buyerRaw(sections, iso);
  const yest = buyerRaw(sections, dayKey(new Date(asDate(iso).getTime() - 864e5)));

  const yBuyer = {};
  Object.values(yest).forEach((x) => {
    const b = (yBuyer[x.buyer] ||= { i: 0, d: 0 });
    b.i += x.inspections;
    b.d += x.defects;
  });

  return BUYERS.map((b) => {
    const styles = Object.values(today)
      .filter((x) => x.buyer === b.name && x.inspections > 0)
      .map((x) => {
        const y = yest[`${x.buyer}|${x.style}`];
        const rate = rateOf(x.defects, x.inspections);
        return {
          name: x.style,
          inspections: x.inspections,
          defects: x.defects,
          rate,
          delta: y && y.inspections ? +(rate - rateOf(y.defects, y.inspections)).toFixed(1) : 0,
        };
      });
    const inspections = styles.reduce((a, s) => a + s.inspections, 0);
    const defects = styles.reduce((a, s) => a + s.defects, 0);
    const rate = rateOf(defects, inspections);
    const y = yBuyer[b.name];
    return {
      name: b.name,
      inspections,
      defects,
      rate,
      delta: y && y.i ? +(rate - rateOf(y.d, y.i)).toFixed(1) : 0,
      styles,
    };
  }).filter((b) => b.inspections > 0);
}

/* ================= data untuk halaman Statistik (data tiruan) ================= */
const HOURLY = ["sewing", "washing"]; // section yang dicek per jam

const isoList = (endISO, days) =>
  Array.from({ length: days }, (_, i) =>
    dayKey(new Date(asDate(endISO).getTime() - (days - 1 - i) * 864e5))
  );
const validSecs = (sections) => sections.filter((s) => SECTION_PROFILE[s]);
const rateFrom = (d, i) => (i ? +((d / i) * 100).toFixed(1) : 0);

// 1. Tren defect rate per section
export function statsTrend(sections, endISO, days) {
  const dates = isoList(endISO, days);
  let inspections = 0;
  let defects = 0;
  const series = validSecs(sections).map((sec) => ({
    section: sec,
    name: NAMES[sec],
    values: dates.map((iso) => {
      const s = sectionStats(sec, asDate(iso));
      inspections += s.inspections;
      defects += s.defects;
      return rateFrom(s.defects, s.inspections);
    }),
  }));
  return { dates, series, totals: { inspections, defects, rate: rateFrom(defects, inspections) } };
}

// 2. Defect rate per jam (hanya section yang dicek per jam)
export function statsHourly(sections, endISO, days) {
  const secs = validSecs(sections).filter((s) => HOURLY.includes(s));
  const hours = hourSlots();
  const acc = hours.map((h) => ({ hour: h, inspections: 0, defects: 0 }));
  isoList(endISO, days).forEach((iso) =>
    secs.forEach((sec) => {
      const s = sectionStats(sec, asDate(iso));
      const r = rng(`${iso}:${sec}:hourly`);
      const w = hours.map(() => 0.7 + r() * 0.6);
      const wSum = w.reduce((a, b) => a + b, 0);
      const base = s.defects / Math.max(1, s.inspections);
      hours.forEach((h, i) => {
        const insp = (s.inspections * w[i]) / wSum;
        const bias = i === 0 ? 0.85 : h >= 13 && h <= 14 ? 1.35 : i === hours.length - 1 ? 1.3 : 1;
        acc[i].inspections += insp;
        acc[i].defects += insp * base * bias;
      });
    })
  );
  return {
    applicable: secs.length > 0,
    hours: acc.map((a) => ({
      hour: a.hour,
      inspections: Math.round(a.inspections),
      defects: Math.round(a.defects),
      rate: a.inspections ? +((a.defects / a.inspections) * 100).toFixed(1) : 0,
    })),
  };
}

// 3. Jenis defect terbanyak (Pareto)
export function statsDefects(sections, endISO, days) {
  const m = {};
  isoList(endISO, days).forEach((iso) =>
    validSecs(sections).forEach((sec) =>
      sectionStats(sec, asDate(iso)).topDefects.forEach(
        (d) => (m[d.name] = (m[d.name] || 0) + d.count)
      )
    )
  );
  const list = Object.entries(m)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const total = list.reduce((a, b) => a + b.count, 0);
  let cum = 0;
  return {
    total,
    rows: list.slice(0, 8).map((r) => {
      cum += r.count;
      return {
        ...r,
        share: total ? +((r.count / total) * 100).toFixed(1) : 0,
        cum: total ? Math.round((cum / total) * 100) : 0,
      };
    }),
  };
}

// 4. Perbandingan: satu section -> per line, banyak section -> per section
export function statsLines(sections, endISO, days) {
  const secs = validSecs(sections);
  const dates = isoList(endISO, days);
  if (secs.length > 1) {
    return {
      kind: "section",
      rows: secs
        .map((sec) => {
          let i = 0;
          let d = 0;
          dates.forEach((iso) => {
            const s = sectionStats(sec, asDate(iso));
            i += s.inspections;
            d += s.defects;
          });
          return { name: NAMES[sec], rate: rateFrom(d, i), inspections: i };
        })
        .sort((a, b) => b.rate - a.rate),
    };
  }
  const sec = secs[0] ?? "sewing";
  const n = SECTION_PROFILE[sec].lines;
  const bias = Array.from({ length: n }, (_, k) => 0.6 + rng(`${sec}:line${k}:bias`)() * 0.9);
  const rows = bias
    .map((b, k) => {
      let sum = 0;
      dates.forEach((iso) => {
        const s = sectionStats(sec, asDate(iso));
        const j = 0.9 + rng(`${iso}:${sec}:line${k}`)() * 0.2;
        sum += rateFrom(s.defects, s.inspections) * b * j;
      });
      return { name: `Line ${pad2(k + 1)}`, rate: +(sum / dates.length).toFixed(1) };
    })
    .sort((a, b) => b.rate - a.rate);
  return { kind: "line", rows };
}

// 5. Volume inspeksi per hari (jumlah check)
export function statsVolume(sections, endISO, days) {
  const dates = isoList(endISO, days);
  return {
    dates,
    values: dates.map((iso) =>
      validSecs(sections).reduce((a, sec) => a + sectionStats(sec, asDate(iso)).inspections, 0)
    ),
  };
}

// nama buyer dari kode style (dipakai halaman History)
export function buyerOfStyle(style) {
  return BUYERS.find((b) => b.styles.includes(style))?.name ?? "-";
}

// Manpower = active QC accounts per section (mock; later from the users list)
const MANPOWER = { cutting: 12, sewing: 48, washing: 10, finishing: 16, packing: 14, final: 6 };
const MP_NAMES = { cutting: "Cutting", sewing: "Sewing", washing: "Washing", finishing: "Finishing", packing: "Packing", final: "Final" };
export const statsManpower = (secs) => {
  const rows = secs.map((s) => ({ section: s, name: MP_NAMES[s] ?? s, count: MANPOWER[s] ?? 0 }));
  return { total: rows.reduce((n, r) => n + r.count, 0), rows };
};

/* ================= statistik per buyer & style (data tiruan) ================= */
export function statsBuyerStyle(section, endISO, days) {
  const end = asDate(endISO);
  const dates = [];
  for (let i = days - 1; i >= 0; i--) dates.push(dayKey(new Date(end.getTime() - i * 864e5)));

  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const rate = (d, n) => (n ? +((d / n) * 100).toFixed(1) : 0);
  const zeros = () => Array(days).fill(0);
  const series = (def, insp) => insp.map((n, i) => (n ? rate(def[i], n) : null));

  const acc = {};
  const secDef = {};
  dates.forEach((iso, di) => {
    Object.values(buyerRaw([section], iso)).forEach((x) => {
      const o = (acc[`${x.buyer}|${x.style}`] ||= {
        buyer: x.buyer, style: x.style, insp: zeros(), def: zeros(),
      });
      o.insp[di] = x.inspections;
      o.def[di] = x.defects;
    });
    sectionStats(section, asDate(iso)).topDefects.forEach((d) => {
      secDef[d.name] = (secDef[d.name] || 0) + d.count;
    });
  });

  const items = Object.values(acc).filter((o) => sum(o.insp) > 0);
  const secTotal = sum(Object.values(secDef)) || 1;
  const topOf = (defects) =>
    Object.entries(secDef)
      .map(([name, c]) => ({ name, count: Math.round((c * defects) / secTotal) }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

  const pack = (name, list, extra = {}) => {
    const insp = list.reduce((a, o) => a.map((v, i) => v + o.insp[i]), zeros());
    const def = list.reduce((a, o) => a.map((v, i) => v + o.def[i]), zeros());
    const inspections = sum(insp);
    const defects = sum(def);
    return {
      name, inspections, defects,
      rate: rate(defects, inspections),
      series: series(def, insp),
      topDefects: topOf(defects),
      ...extra,
    };
  };

  const styles = items.map((o) => pack(o.style, [o], { buyer: o.buyer }));
  const buyers = [...new Set(items.map((o) => o.buyer))].map((b) => {
    const list = items.filter((o) => o.buyer === b);
    return pack(b, list, { styles: list.map((o) => pack(o.style, [o], { buyer: b })) });
  });

  return { dates, section: pack(NAMES[section] ?? section, items), buyers, styles };
}

// Top defect per line (data tiruan). Dipakai kartu "Top 3 defects per line" di halaman Statistics.
export function statsLineDefects(section, endISO, days) {
  const key = SECTION_PROFILE[section] ? section : "sewing";
  const n = SECTION_PROFILE[key].lines;
  const types = DEFECTS[key];
  const dates = isoList(endISO, days);

  // tiap line punya kecenderungan defect sendiri (tetap, tidak berubah tiap render)
  const bias = Array.from({ length: n }, (_, k) => 0.6 + rng(`${key}:line${k}:bias`)() * 0.9);
  const weights = Array.from({ length: n }, (_, k) =>
    types.map((_, t) => (types.length - t) * (0.5 + rng(`${key}:line${k}:type${t}`)() * 1.5))
  );

  const acc = Array.from({ length: n }, () => ({
    inspections: 0,
    defects: 0,
    byType: types.map(() => 0),
  }));

  dates.forEach((iso) => {
    const s = sectionStats(key, asDate(iso));
    const baseRate = s.inspections ? s.defects / s.inspections : 0;
    acc.forEach((a, k) => {
      const r = rng(`${iso}:${key}:line${k}:ld`);
      const insp = Math.round((s.inspections / n) * (0.85 + r() * 0.3));
      const def = Math.min(insp, Math.round(insp * baseRate * bias[k] * (0.9 + r() * 0.2)));
      const wSum = weights[k].reduce((x, y) => x + y, 0);
      a.inspections += insp;
      a.defects += def;
      weights[k].forEach((w, t) => (a.byType[t] += (def * w) / wSum));
    });
  });

  return acc
    .map((a, k) => ({
      name: `Line ${pad2(k + 1)}`,
      inspections: a.inspections,
      defects: a.defects,
      rate: rateFrom(a.defects, a.inspections),
      top: types
        .map((name, t) => ({ name, count: Math.round(a.byType[t]) }))
        .filter((d) => d.count > 0)
        .sort((x, y) => y.count - x.count)
        .slice(0, 3),
    }))
    .sort((x, y) => y.rate - x.rate);
}

