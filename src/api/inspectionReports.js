import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./client.js";
import { fetchMyInspections, loadDefectTypes } from "./inspections.js";
import { loadSession } from "../auth/session.js";

const isSuper = () => loadSession()?.user?.role === "super_admin";

// admin: section otomatis dari akun. super admin: path berbeda + parameter section.
export function fetchInspectionDaily(section, date, signal) {
  const base = isSuper() ? "/superadmin/inspection/reports" : "/admin/inspection/reports";
  const q = `date=${date}${isSuper() ? `&section=${section.toUpperCase()}` : ""}`;
  return apiFetch(`${base}/daily?${q}`, { signal });
}

const normName = (s) => String(s ?? "").trim().toUpperCase().replace(/\s+/g, " ");
const catOf = (d) => d.category ?? d.categoryName ?? d.defectCategory ?? "";
const niceCat = (c) =>
  String(c).replace(/^DEFECT_/, "").replace(/_/g, " ").toLowerCase()
    .replace(/^\w/, (x) => x.toUpperCase());

// Gabungkan defect bernama sama (area berbeda), lalu ambil teratas.
// "OTHER" tetap terpisah per kategori.
const topByName = (list, limit) => {
  const m = new Map();
  list.forEach((d) => {
    const name = String(d.defectTypeName ?? "").trim();
    if (!name || !(d.totalDefects > 0)) return;
    const isOther = normName(name) === "OTHER" || normName(name) === "OTHERS";
    const cat = isOther ? catOf(d) : "";
    const key = `${normName(name)}|${cat}`;
    const cur = m.get(key) ?? {
      name: isOther && cat ? `${name} (${niceCat(cat)})` : name,
      count: 0,
    };
    cur.count += d.totalDefects;
    m.set(key, cur);
  });
  return [...m.values()].sort((a, b) => b.count - a.count).slice(0, limit);
};

// laporan backend -> bentuk dashboard admin: { overview, lines, topDefects }
export function adaptInspectionDay(rep) {
  const insp = rep?.totalQuantityInspect ?? 0;
  const def = rep?.totalDefects ?? 0;
  return {
    overview: {
      inspections: rep?.totalInspection ?? 0,
      defect: def,
      passRate: insp ? +(100 - (def / insp) * 100).toFixed(1) : 0,
      total: insp,
    },
    lines: [...(rep?.lineSummaries ?? [])]
      .sort((a, b) => String(a.lineName).localeCompare(String(b.lineName), undefined, { numeric: true }))
      .map((l) => ({
        name: l.lineName,
        pct: l.totalQuantityInspect
          ? Math.round(100 - (l.totalDefects / l.totalQuantityInspect) * 100)
          : 0,
      })),
    topDefects: topByName(rep?.defectSummaries ?? [], 3),
    washingTypes: (rep?.washingTypeSummaries ?? []).map((w) => ({
      name: w.washingType === "BULK" ? "Bulk" : "Repair",
      inspections: w.totalInspections,
      qty: w.totalQuantityInspect,
      defects: w.totalDefects,
      pct: w.totalQuantityInspect
        ? Math.round(100 - (w.totalDefects / w.totalQuantityInspect) * 100)
        : 0,
    })),
  };
}

export function useInspectionDay(section, date, enabled) {
  const [state, setState] = useState({ data: null, loading: enabled, error: "" });

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    fetchInspectionDaily(section, date, ctrl.signal)
      .then((rep) => setState({ data: adaptInspectionDay(rep), loading: false, error: "" }))
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setState({ data: null, loading: false, error: e.message || "Failed to load data." });
      });
    return () => ctrl.abort();
  }, [section, date, enabled]);

  return state;
}

/* ---------- buyer & style: persentase dan top 3 defect ---------- */
const pad2 = (n) => String(n).padStart(2, "0");
const localISO = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const key = (s) => String(s ?? "").trim().toUpperCase();
const nice = (c) => String(c ?? "").replace(/^DEFECT_/, "").replace(/_/g, " ");

const newAgg = () => ({ inspections: 0, qty: 0, defects: 0, d: new Map() });

function addTo(a, x, typesById) {
  a.inspections += 1;
  a.qty += x.inspectQuantity ?? 0;
  a.defects += x.totalDefect ?? 0;
  (x.defects ?? []).forEach((d) => {
    const t = typesById[d.defectTypeId];
    const name = (t?.name ?? "Defect").trim();
    const other = /^OTHERS?$/i.test(name); // OTHER tetap terpisah per kategori
    const k = other ? `${key(name)}|${t?.category ?? ""}` : key(name);
    const label = other && t?.category ? `${name} (${nice(t.category)})` : name;
    const cur = a.d.get(k) ?? { name: label, count: 0 };
    cur.count += d.quantity;
    a.d.set(k, cur);
  });
}

const finish = (name, a, extra = {}) => ({
  name,
  ...extra,
  inspections: a.inspections,
  qty: a.qty,
  defects: a.defects,
  rate: a.qty ? +((a.defects / a.qty) * 100).toFixed(1) : 0,
  delta: 0,
  topDefects: [...a.d.values()].sort((x, y) => y.count - x.count).slice(0, 3),
});

// daftar inspeksi -> [{ name, rate, topDefects, styles: [...] }] untuk satu tanggal
export function buildBuyerStyle(list, typesById, iso) {
  const buyers = new Map();
  list
    .filter((x) => x.createdAt && localISO(new Date(x.createdAt)) === iso)
    .forEach((x) => {
      const bk = key(x.buyerName);
      const b = buyers.get(bk) ?? { name: x.buyerName, agg: newAgg(), styles: new Map() };
      addTo(b.agg, x, typesById);
      const sk = key(x.styleCode);
      const s = b.styles.get(sk) ?? { name: x.styleCode, agg: newAgg() };
      addTo(s.agg, x, typesById);
      b.styles.set(sk, s);
      buyers.set(bk, b);
    });

  return [...buyers.values()].map((b) => ({
    ...finish(b.name, b.agg),
    styles: [...b.styles.values()].map((s) => finish(s.name, s.agg)),
  }));
}

export function useBuyerStyleDay(section, date, enabled) {
  const [raw, setRaw] = useState({ list: null, types: {}, error: "" });

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setRaw({ list: null, types: {}, error: "" });
    Promise.all([
      fetchMyInspections(section, ctrl.signal),
      loadDefectTypes().catch(() => []),
    ])
      .then(([list, types]) =>
        setRaw({
          list,
          types: Object.fromEntries(types.map((t) => [t.id, t])),
          error: "",
        }),
      )
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setRaw({ list: null, types: {}, error: e.message || "Failed to load data." });
      });
    return () => ctrl.abort();
  }, [section, enabled]);

  const data = useMemo(
    () => (raw.list ? buildBuyerStyle(raw.list, raw.types, date) : null),
    [raw, date],
  );
  return { data, loading: enabled && raw.list === null && !raw.error, error: raw.error };
}