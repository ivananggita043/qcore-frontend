import { hourSlots } from "../config/sections.js";

/* ---------- profil data tiap section (satuan: check per hari) ---------- */
const SECTION_PROFILE = {
  cutting:   { perDay: [30, 50],   passRate: [93, 98.5], lines: 3, qc: [4, 6] },
  sewing:    { perDay: [100, 150], passRate: [84, 96],   lines: 8, qc: [14, 20] },
  washing:   { perDay: [40, 70],   passRate: [86, 97],   lines: 3, qc: [5, 8] },
  finishing: { perDay: [60, 90],   passRate: [90, 98],   lines: 5, qc: [9, 13] },
};

const DEFECTS = {
  cutting:   ["Salah ukuran", "Bergerigi", "Pola miring", "Kain cacat", "Notch salah"],
  sewing:    ["Skip Stitch", "Broken Stitch", "Uneven Hem", "Puckering", "Ukuran tidak sesuai"],
  washing:   ["Noda", "Warna belang", "Penyusutan", "Bau kimia", "Tekstur kasar"],
  finishing: ["Benang sisa", "Kotor/noda", "Setrika kurang", "Label salah", "Kancing lepas"],
};

const NAMES = { cutting: "Cutting", sewing: "Sewing", washing: "Washing", finishing: "Finishing" };
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
          style: r() < 0.5 ? "EL" : "VS",
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
  { name: "Elle",   styles: ["EL-2401", "EL-2402", "EL-2405"] },
  { name: "Vessa",  styles: ["VS-1101", "VS-1107"] },
  { name: "Nordic", styles: ["NR-330", "NR-342", "NR-351"] },
  { name: "Aruna",  styles: ["AR-710", "AR-715"] },
  { name: "Kobo",   styles: ["KB-908", "KB-912", "KB-920"] },
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
        it.raw = it.insp * it.bias;
      });
      const k = s.defects / (items.reduce((a, it) => a + it.raw, 0) || 1);
      items.forEach((it) => {
        const key = `${it.buyer}|${it.style}`;
        const a = (acc[key] ||= { buyer: it.buyer, style: it.style, inspections: 0, defects: 0 });
        a.inspections += it.insp;
        a.defects += Math.min(it.insp, Math.round(it.raw * k));
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