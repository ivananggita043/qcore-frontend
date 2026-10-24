import { apiFetch } from "./client.js";
import { useEffect, useState } from "react";
import { loadSession } from "../auth/session.js";

const BASE = "/user/cutting-inspections";

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
  const data = await apiFetch(`${BASE}/search?processCheck=${PROCESS_ENUM[processKey]}`, { signal });
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
  apiFetch(`${BASE}/all`, { signal }).then((d) => (Array.isArray(d) ? d : []));

export const updateCuttingInspection = (id, body) =>
  apiFetch(`${BASE}/${id}`, { method: "PUT", body });

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