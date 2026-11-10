import { useEffect, useState } from "react";
import { fetchCuttingReport } from "./cutting.js";
import { fetchInspectionDaily } from "./inspectionReports.js";

/* Ringkasan Super Admin: laporan harian tiap section untuk tanggal terpilih
   dan hari sebelumnya (untuk delta "vs yesterday").
   Final belum punya endpoint, jadi tetap data tiruan (diisi dari superDay). */

export const LIVE_SECTIONS = ["cutting", "sewing", "washing", "finishing", "packing"];
export const SECTION_NAME = {
  cutting: "Cutting",
  sewing: "Sewing",
  washing: "Washing",
  finishing: "Finishing",
  packing: "Packing",
};

const pad2 = (n) => String(n).padStart(2, "0");
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dayBefore = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d - 1));
};

const pctChange = (a, b) => (b ? +(((a - b) / b) * 100).toFixed(1) : 0);
const passOf = (qty, def) => (qty ? +(100 - (def / qty) * 100).toFixed(1) : 0);

// laporan backend -> { inspections (jumlah check), qty (pcs), defects (pcs) }
const adapt = (rep) => ({
  inspections: rep?.totalInspection ?? rep?.totalInspections ?? 0,
  qty: rep?.totalQuantityInspect ?? 0,
  defects: rep?.totalDefects ?? 0,
});

// hasil yang sudah berhasil disimpan per "section|tanggal" agar tidak diminta ulang
const cache = new Map();

async function loadDay(section, date, signal) {
  const k = `${section}|${date}`;
  if (cache.has(k)) return cache.get(k);
  const rep =
    section === "cutting"
      ? await fetchCuttingReport("daily", date, signal)
      : await fetchInspectionDaily(section, date, signal);
  const v = adapt(rep);
  cache.set(k, v);
  return v;
}

const sumOf = (rows) =>
  rows.reduce(
    (a, r) => ({
      inspections: a.inspections + r.inspections,
      qty: a.qty + r.qty,
      defects: a.defects + r.defects,
    }),
    { inspections: 0, qty: 0, defects: 0 },
  );

// mock: { kpi, sections, topDefects } dari superDay(date) — dipakai untuk Final, Active QC, Top Defects
export function useSuperDay(date, mock) {
  const [state, setState] = useState({ data: null, loading: true, error: "", failed: [] });

  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    const prevDate = dayBefore(date);

    const jobs = LIVE_SECTIONS.map((sec) =>
      Promise.allSettled([
        loadDay(sec, date, ctrl.signal),
        loadDay(sec, prevDate, ctrl.signal),
      ]),
    );

    Promise.all(jobs).then((results) => {
      if (ctrl.signal.aborted) return;

      const rows = [];
      const failed = [];
      results.forEach(([cur, prv], i) => {
        const sec = LIVE_SECTIONS[i];
        if (cur.status !== "fulfilled") {
          failed.push(SECTION_NAME[sec]);
          return;
        }
        rows.push({
          key: sec,
          cur: cur.value,
          prev: prv.status === "fulfilled" ? prv.value : null,
        });
      });

      if (rows.length === 0) {
        setState({
          data: null,
          loading: false,
          error: "Failed to load data. Please try again.",
          failed,
        });
        return;
      }

      const cur = sumOf(rows.map((r) => r.cur));
      // delta hanya membandingkan section yang datanya ada di kedua hari
      const both = rows.filter((r) => r.prev);
      const curCmp = sumOf(both.map((r) => r.cur));
      const prev = sumOf(both.map((r) => r.prev));
      const curPass = passOf(cur.qty, cur.defects);
      const prevPass = passOf(prev.qty, prev.defects);
      const curCmpPass = passOf(curCmp.qty, curCmp.defects);

      const sections = rows
        .filter((r) => r.cur.inspections > 0 || r.cur.qty > 0)
        .map((r) => ({
          key: r.key,
          name: SECTION_NAME[r.key],
          pct: Math.round(passOf(r.cur.qty, r.cur.defects)),
          inspections: r.cur.inspections,
          defects: r.cur.defects,
        }));

      // Final: data tiruan, diberi tanda
      const finalRow = mock.sections.find((s) => s.key === "final");
      if (finalRow) sections.push({ ...finalRow, sample: true });

      setState({
        data: {
          kpi: {
            inspections: {
              value: cur.inspections,
              delta: pctChange(curCmp.inspections, prev.inspections),
            },
            passRate: { value: curPass, delta: +(curCmpPass - prevPass).toFixed(1) },
            defects: { value: cur.defects, delta: pctChange(curCmp.defects, prev.defects) },
          },
          sections,
        },
        loading: false,
        error: "",
        failed,
      });
    });

    return () => ctrl.abort();
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}