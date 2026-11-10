import { useEffect, useState } from "react";
import { fetchMyInspections, loadDefectTypes } from "./inspections.js";
import { SECTIONS, hourSlots } from "../config/sections.js";

/* Statistik section inspeksi (sewing, washing, finishing, packing).
   Data diunduh sekali, lalu semua angka dihitung di frontend. */

const pad2 = (n) => String(n).padStart(2, "0");
const isoOfDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const rateOf = (d, i) => (i ? +((d / i) * 100).toFixed(1) : 0);
const nice = (c) => String(c ?? "").replace(/^DEFECT_/, "").replace(/_/g, " ");

// "10.00 – 11.00" -> 10
const hourOfSlot = (slot) => {
  const m = /^(\d{1,2})[.:]/.exec(slot ?? "");
  return m ? Number(m[1]) : null;
};

// nama defect; "OTHER" tetap terpisah per kategori
function defectName(t) {
  const name = (t?.name ?? "Defect").trim();
  const other = /^OTHERS?$/i.test(name);
  return {
    key: other ? `${name.toUpperCase()}|${t?.category ?? ""}` : name.toUpperCase(),
    label: other && t?.category ? `${name} (${nice(t.category)})` : name,
  };
}

const addDefects = (map, x, typesById) =>
  (x.defects ?? []).forEach((d) => {
    const { key, label } = defectName(typesById[d.defectTypeId]);
    const cur = map.get(key) ?? { name: label, count: 0 };
    cur.count += d.quantity || 0;
    map.set(key, cur);
  });

const topOf = (map, limit) =>
  [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);

// unduh sekali: daftar inspeksi section + daftar defect type
export function useInspectionStatsData(section, enabled) {
  const [state, setState] = useState({ list: null, types: {}, loading: enabled, error: "" });

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setState({ list: null, types: {}, loading: true, error: "" });
    Promise.all([
      fetchMyInspections(section, ctrl.signal),
      loadDefectTypes().catch(() => []),
    ])
      .then(([list, types]) =>
        setState({
          list,
          types: Object.fromEntries(types.map((t) => [t.id, t])),
          loading: false,
          error: "",
        }),
      )
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setState({
          list: null,
          types: {},
          loading: false,
          error: e.message || "Failed to load statistics.",
        });
      });
    return () => ctrl.abort();
  }, [section, enabled]);

  return state;
}

// semua inspeksi pada rentang tanggal -> kumpulan agregat
function collect(list, typesById, endISO, days) {
  const [y, m, d] = endISO.split("-").map(Number);
  const dates = [];
  for (let k = days - 1; k >= 0; k--) dates.push(isoOfDate(new Date(y, m - 1, d - k)));
  const idx = Object.fromEntries(dates.map((iso, i) => [iso, i]));

  const day = dates.map(() => ({ checks: 0, insp: 0, def: 0 }));
  const hours = new Map(hourSlots().map((h) => [h, { checks: 0, insp: 0, def: 0 }]));
  const lines = new Map();
  const types = new Map();

  list.forEach((x) => {
    if (!x.createdAt) return;
    const i = idx[isoOfDate(new Date(x.createdAt))];
    if (i === undefined) return;
    const insp = x.inspectQuantity || 0;
    const def = x.totalDefect || 0;

    day[i].checks += 1;
    day[i].insp += insp;
    day[i].def += def;

    const h = hours.get(hourOfSlot(x.inspectionTimeSlot));
    if (h) {
      h.checks += 1;
      h.insp += insp;
      h.def += def;
    }

    const ln = (x.lineName || "-").trim();
    const l = lines.get(ln.toUpperCase()) ?? { name: ln, checks: 0, insp: 0, def: 0, types: new Map() };
    l.checks += 1;
    l.insp += insp;
    l.def += def;
    addDefects(l.types, x, typesById);
    lines.set(ln.toUpperCase(), l);

    addDefects(types, x, typesById);
  });

  return { dates, day, hours, lines, types };
}

// bentuk sama dengan fungsi mock di halaman Statistics
export function buildInspectionStats(list, typesById, endISO, days, section) {
  const { dates, day, hours, lines, types } = collect(list, typesById, endISO, days);
  const sum = (k) => day.reduce((a, r) => a + r[k], 0);
  const insp = sum("insp");
  const def = sum("def");

  const typeList = [...types.values()].sort((a, b) => b.count - a.count);
  const typeTotal = typeList.reduce((a, b) => a + b.count, 0);
  let cum = 0;

  return {
    trend: {
      dates,
      series: [
        {
          section,
          name: SECTIONS[section]?.label ?? section,
          values: day.map((r) => rateOf(r.def, r.insp)),
        },
      ],
      totals: { inspections: sum("checks"), defects: def, rate: rateOf(def, insp) },
    },
    hourly: {
      applicable: SECTIONS[section]?.frequency === "hourly",
      hours: [...hours.entries()].map(([hour, h]) => ({
        hour,
        inspections: h.checks,
        defects: h.def,
        rate: rateOf(h.def, h.insp),
      })),
    },
    defects: {
      total: typeTotal,
      rows: typeList.slice(0, 8).map((r) => {
        cum += r.count;
        return {
          ...r,
          share: typeTotal ? +((r.count / typeTotal) * 100).toFixed(1) : 0,
          cum: typeTotal ? Math.round((cum / typeTotal) * 100) : 0,
        };
      }),
    },
    lines: {
      kind: "line",
      rows: [...lines.values()]
        .map((l) => ({ name: l.name, rate: rateOf(l.def, l.insp), inspections: l.checks }))
        .sort((a, b) => b.rate - a.rate),
    },
    volume: { dates, values: day.map((r) => r.checks) },
  };
}

// top 3 defect untuk tiap line -> bentuk sama dengan statsLineDefects()
export function buildLineDefects(list, typesById, endISO, days) {
  const { lines } = collect(list, typesById, endISO, days);
  return [...lines.values()]
    .map((l) => ({
      name: l.name,
      inspections: l.checks,
      defects: l.def,
      rate: rateOf(l.def, l.insp),
      top: topOf(l.types, 3),
    }))
    .sort((a, b) => b.rate - a.rate || b.inspections - a.inspections);
}