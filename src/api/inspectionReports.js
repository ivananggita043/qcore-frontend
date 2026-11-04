import { useEffect, useState } from "react";
import { apiFetch } from "./client.js";
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