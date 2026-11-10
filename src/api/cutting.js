import { apiFetch } from "./client.js";
import { useEffect, useState } from "react";
import { loadSession } from "../auth/session.js";

const BASE = "/user/cutting-inspections";

// path menurut role. Admin di backend saat ini "/cutting-inspections" (tanpa /admin).
const base = () => {
  const role = loadSession()?.user?.role;
  if (role === "super_admin") return "/super-admin/cutting-inspections";
  if (role === "admin") return "/cutting-inspections";
  return BASE;
};

// key proses di form -> enum backend
export const PROCESS_ENUM = {
  marker: "MARKER",
  fabric: "FABRIC",
  spreading: "SPREADING",
  cutting: "CUTTING",
  fuse: "FUSE",
  bundle: "BUNDLE_AND_NUMBERING",
};

export async function fetchDefectTypes(processKey, signal) {
  const data = await apiFetch(`${base()}/search?processCheck=${PROCESS_ENUM[processKey]}`, { signal });
  return (Array.isArray(data) ? data : []).map((t) => ({ id: t.id, name: t.name }));
}

export const createCuttingInspection = (body) =>
  apiFetch(BASE, { method: "POST", body });

const PROCESS_LABEL = {
  MARKER: "Marker",
  FABRIC: "Fabric",
  SPREADING: "Spreading",
  CUTTING: "Cutting",
  FUSE: "Fuse",
  BUNDLE_AND_NUMBERING: "Bundle & Numbering",
};

const pad2 = (n) => String(n).padStart(2, "0");
const localISO = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// ambil laporan cutting milik user yang login
export function useCuttingInspections(enabled) {
  const [state, setState] = useState({ list: [], loading: enabled, error: "" });

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    apiFetch(`${BASE}/all`, { signal: ctrl.signal })
      .then((data) =>
        setState({ list: Array.isArray(data) ? data : [], loading: false, error: "" })
      )
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setState((s) => ({ ...s, loading: false, error: e.message || "Failed to load data." }));
      });
    return () => ctrl.abort();
  }, [enabled]);

  return state;
}

// bentuk data sama dengan userDay() di mock: { summary, checks }
export function cuttingUserDay(list, iso) {
  const rows = list
    .filter((x) => x.createdAt && localISO(new Date(x.createdAt)) === iso)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  let qty = 0;
  let defect = 0;
  const checks = rows.map((x) => {
    const items = x.items ?? [];
    const q = items.reduce((s, i) => s + (i.quantityInspect || 0), 0);
    const d = items.reduce((s, i) => s + (i.quantityDefect || 0), 0);
    qty += q;
    defect += d;
    const t = new Date(x.createdAt);
    return {
      id: `CUT-${String(x.id).slice(0, 4).toUpperCase()}`,
      time: `${pad2(t.getHours())}.${pad2(t.getMinutes())}`,
      status: d > 0 ? "Defect" : "Pass",
      style: items[0]?.styleCode ?? "-",
      qty: q,
      process: PROCESS_LABEL[x.processCheck] ?? x.processCheck,
      buyer: items[0]
        ? `${items[0].buyerName}${items.length > 1 ? ` +${items.length - 1}` : ""}`
        : "-",
    };
  });

  return {
    summary: {
      inspections: rows.length,
      defect,
      defectPct: qty ? +((defect / qty) * 100).toFixed(1) : 0,
      qty,
    },
    checks,
  };
}

export const fetchMyCuttingInspections = (signal) =>
  apiFetch(`${base()}/all`, { signal }).then((d) => (Array.isArray(d) ? d : []));

export const updateCuttingInspection = (id, body) =>
  apiFetch(`${base()}/${id}`, { method: "PUT", body });

export const patchCuttingComment = (id, comment) =>
  apiFetch(`${base()}/${id}/comment`, { method: "PATCH", body: { comment } });

export const deleteCuttingInspection = (id) =>
  apiFetch(`${base()}/${id}`, { method: "DELETE" });

const reportBase = () =>
  loadSession()?.user?.role === "super_admin" ? "/super-admin/cutting-reports" : "/admin/cutting-reports";

// kind: "daily" | "weekly" (arg = "YYYY-MM-DD") | "monthly" (arg = { year, month })
export function fetchCuttingReport(kind, arg, signal) {
  const q = kind === "monthly" ? `year=${arg.year}&month=${arg.month}` : `date=${arg}`;
  return apiFetch(`${reportBase()}/${kind}?${q}`, { signal });
}

// laporan backend -> bentuk yang dipakai halaman QC Records
export function adaptCuttingReport(r) {
  const insp = r?.totalQuantityInspect ?? 0;
  const defects = r?.totalDefects ?? 0;
  const byType = {};
  (r?.processSummaries ?? []).forEach((ps) =>
    (ps.detailRows ?? []).forEach((row) => {
      byType[row.defectTypeName] = (byType[row.defectTypeName] || 0) + (row.quantityDefect || 0);
    })
  );
  return {
    section: "cutting",
    name: "Cutting",
    inspections: insp,
    defects,
    passRate: insp ? +((1 - defects / insp) * 100).toFixed(1) : 0,
    activeQc: null,
    unit: "pcs",
    topDefects: Object.entries(byType)
      .map(([name, count]) => ({ name, count }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}

// ambil banyak laporan sekaligus; hasil disimpan per id supaya tidak diminta ulang
// requests: [{ id, kind, arg }]
export function useCuttingStats(requests, enabled) {
  const [cache, setCache] = useState({});
  const need = enabled ? requests.filter((r) => !(r.id in cache)) : [];
  const sig = need.map((r) => r.id).join(",");

  useEffect(() => {
    if (!sig) return;
    const ctrl = new AbortController();
    need.forEach((r) =>
      fetchCuttingReport(r.kind, r.arg, ctrl.signal)
        .then((rep) => setCache((c) => ({ ...c, [r.id]: adaptCuttingReport(rep) })))
        .catch((e) => {
          if (e?.name === "AbortError") return;
          setCache((c) => ({ ...c, [r.id]: { error: e.message || "Failed to load Cutting data." } }));
        })
    );
    return () => ctrl.abort();
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  return cache;
}

// laporan harian backend -> bentuk dashboard admin: { overview, lines }
// "lines" untuk cutting = performa per proses
export function cuttingAdminDay(rep) {
  const insp = rep?.totalQuantityInspect ?? 0;
  const def = rep?.totalDefects ?? 0;
  const order = Object.values(PROCESS_ENUM);
  const lines = (rep?.processSummaries ?? [])
    .filter((p) => (p.totalQuantityInspect ?? 0) > 0)
    .sort((a, b) => order.indexOf(a.processCheck) - order.indexOf(b.processCheck))
    .map((p) => ({
      name: PROCESS_LABEL[p.processCheck] ?? p.processCheck,
      pct: Math.round(100 - (p.totalDefects / p.totalQuantityInspect) * 100),
    }));
  const processes = (rep?.processSummaries ?? [])
    .filter((p) => (p.totalQuantityInspect ?? 0) > 0)
    .sort((a, b) => order.indexOf(a.processCheck) - order.indexOf(b.processCheck))
    .map((p) => {
      const byType = {};
      (p.detailRows ?? []).forEach((r) => {
        if (r.defectTypeName && r.quantityDefect > 0)
          byType[r.defectTypeName] = (byType[r.defectTypeName] || 0) + r.quantityDefect;
      });
      return {
        name: PROCESS_LABEL[p.processCheck] ?? p.processCheck,
        inspected: p.totalQuantityInspect,
        defects: p.totalDefects,
        rate: +((p.totalDefects / p.totalQuantityInspect) * 100).toFixed(1),
        top: Object.entries(byType)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3),
      };
    });
  return {
    overview: {
      inspections: rep?.totalInspections ?? 0,
      defect: def,
      passRate: insp ? +(100 - (def / insp) * 100).toFixed(1) : 0,
      total: insp,
    },
    lines,
    processes,
  };
}

export function useCuttingDay(date, enabled) {
  const [state, setState] = useState({ data: null, loading: enabled, error: "" });

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    fetchCuttingReport("daily", date, ctrl.signal)
      .then((rep) => setState({ data: cuttingAdminDay(rep), loading: false, error: "" }))
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setState({ data: null, loading: false, error: e.message || "Failed to load Cutting data." });
      });
    return () => ctrl.abort();
  }, [date, enabled]);

  return state;
}

/* ---------- statistik cutting (dihitung dari seluruh data inspeksi) ---------- */
//const pad2 = (n) => String(n).padStart(2, "0");
const isoOfDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const rateOf = (d, i) => (i ? +((d / i) * 100).toFixed(1) : 0);

// unduh sekali semua inspeksi cutting (admin / super admin)
export function useCuttingStatsData(enabled) {
  const [state, setState] = useState({ list: null, loading: enabled, error: "" });

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setState({ list: null, loading: true, error: "" });
    fetchMyCuttingInspections(ctrl.signal)
      .then((list) => setState({ list, loading: false, error: "" }))
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setState({ list: null, loading: false, error: e.message || "Failed to load Cutting data." });
      });
    return () => ctrl.abort();
  }, [enabled]);

  return state;
}

// bentuk hasil sama dengan fungsi mock di halaman Statistics
export function buildCuttingStats(list, endISO, days) {
  const [y, m, d] = endISO.split("-").map(Number);
  const dates = [];
  for (let k = days - 1; k >= 0; k--) dates.push(isoOfDate(new Date(y, m - 1, d - k)));
  const idx = Object.fromEntries(dates.map((iso, i) => [iso, i]));
  const day = dates.map(() => ({ checks: 0, insp: 0, def: 0 }));
  const proc = new Map();
  const types = new Map();

  list.forEach((x) => {
    if (!x.createdAt) return;
    const i = idx[isoOfDate(new Date(x.createdAt))];
    if (i === undefined) return;
    const name = PROCESS_LABEL[x.processCheck] ?? x.processCheck;
    const p = proc.get(name) ?? { insp: 0, def: 0, checks: 0 };
    day[i].checks += 1;
    p.checks += 1;
    (x.items ?? []).forEach((it) => {
      const q = it.quantityInspect || 0;
      const f = it.quantityDefect || 0;
      day[i].insp += q;
      day[i].def += f;
      p.insp += q;
      p.def += f;
      if (f > 0) {
        const n = (it.defectTypeName || "Defect").trim();
        types.set(n, (types.get(n) ?? 0) + f);
      }
    });
    proc.set(name, p);
  });

  const sum = (k) => day.reduce((a, r) => a + r[k], 0);
  const insp = sum("insp");
  const def = sum("def");
  const typeList = [...types.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const typeTotal = typeList.reduce((a, b) => a + b.count, 0);
  let cum = 0;

  return {
    trend: {
      dates,
      series: [{ section: "cutting", name: "Cutting", values: day.map((r) => rateOf(r.def, r.insp)) }],
      totals: { inspections: sum("checks"), defects: def, rate: rateOf(def, insp) },
    },
    hourly: { applicable: false, hours: [] },
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
      kind: "process",
      rows: [...proc.entries()]
        .map(([name, p]) => ({ name, rate: rateOf(p.def, p.insp), inspections: p.checks }))
        .sort((a, b) => b.rate - a.rate),
    },
    volume: { dates, values: day.map((r) => r.checks) },
  };
}

// top 3 defect untuk tiap proses cutting (dari seluruh data inspeksi)
export function buildCuttingProcessDefects(list, endISO, days) {
  const [y, m, d] = endISO.split("-").map(Number);
  const from = isoOfDate(new Date(y, m - 1, d - (days - 1)));
  const proc = new Map(
    Object.values(PROCESS_LABEL).map((n) => [n, { checks: 0, insp: 0, def: 0, types: new Map() }]),
  );

  list.forEach((x) => {
    if (!x.createdAt) return;
    const iso = isoOfDate(new Date(x.createdAt));
    if (iso < from || iso > endISO) return;
    const p = proc.get(PROCESS_LABEL[x.processCheck] ?? x.processCheck);
    if (!p) return;
    p.checks += 1;
    (x.items ?? []).forEach((it) => {
      const f = it.quantityDefect || 0;
      p.insp += it.quantityInspect || 0;
      p.def += f;
      if (f > 0) {
        const n = (it.defectTypeName || "Defect").trim();
        p.types.set(n, (p.types.get(n) ?? 0) + f);
      }
    });
  });

  return [...proc.entries()]
    .map(([name, p]) => ({
      name,
      inspections: p.checks,
      defects: p.def,
      rate: rateOf(p.def, p.insp),
      top: [...p.types.entries()]
        .map(([n, count]) => ({ name: n, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
    }))
    .sort((a, b) => b.rate - a.rate || b.inspections - a.inspections);
}
