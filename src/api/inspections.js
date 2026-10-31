import { useEffect, useState } from "react";
import { apiFetch } from "./client.js";
import { hourLabel } from "../config/sections.js";

const BASE = "/user/inspections";

export const SECTION_ENUM = {
  sewing: "SEWING",
  washing: "WASHING",
  finishing: "FINISHING",
  packing: "PACKING",
};

export const PREFIX = { sewing: "SEW", washing: "WSH", finishing: "FIN", packing: "PCK" };

// label kategori di form -> enum backend
const CATEGORY_ENUM = {
  "BACK TO LINE": "DEFECT_BACK_TO_LINE",
  TRIMMING: "DEFECT_TRIMMING",
  STAIN: "DEFECT_STAIN",
  "FABRIC DEF": "DEFECT_FABRIC",
  OTHERS: "DEFECT_OTHERS",
  WASHING: "DEFECT_WASHING",
  FINISHING: "DEFECT_FINISHING",
};

const norm = (s) => String(s ?? "").trim().toUpperCase().replace(/\s+/g, " ");
const pad2 = (n) => String(n).padStart(2, "0");
const localISO = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/* ---------- daftar defect type dari database (diambil sekali) ---------- */
let defectCache = null;
export const loadDefectTypes = () =>
(defectCache ??= apiFetch(`${BASE}/defects/search`)
  .then((d) => (Array.isArray(d) ? d : []))
  .catch((e) => {
    defectCache = null;
    throw e;
  }));

// { category, area, type, count } dari form -> { defectTypeId, quantity }
async function resolveDefects(section, defects) {
  if (!defects.length) return [];
  const all = await loadDefectTypes();
  const sec = SECTION_ENUM[section];
  const missing = [];
  const sum = new Map();

  defects.forEach((d) => {
    const cat = CATEGORY_ENUM[norm(d.category)];
    const name = norm(d.type);
    const area = norm(d.area);
    const byName = all.filter((t) => norm(t.name) === name);
    const pick = (list) =>
      list.find((t) => t.section === sec) ?? list[0];
    const hit =
      pick(byName.filter((t) => t.category === cat && norm(t.areaName) === area)) ??
      pick(byName.filter((t) => norm(t.areaName) === norm(d.category))) ??
      pick(byName.filter((t) => norm(t.areaName) === area)) ??
      pick(byName.filter((t) => t.category === cat));

    if (!hit) {
      missing.push(d.area ? `${d.area} · ${d.type}` : d.type);
      return;
    }
    sum.set(hit.id, (sum.get(hit.id) ?? 0) + d.count);
  });

  if (missing.length)
    throw new Error(`Defect not found in database: ${missing.join(", ")}`);
  return [...sum].map(([defectTypeId, quantity]) => ({ defectTypeId, quantity }));
}

/* ---------- kirim hasil QC ---------- */
export async function createInspection(section, job) {
  const inspect = Number(job.inspect);
  const transfer = Number(job.transfer) || 0;
  const defects = await resolveDefects(section, job.defects ?? []);
  const totalDefect = defects.reduce((s, d) => s + d.quantity, 0);

  if (!job.lineId) throw new Error("This account has no line assigned.");
  if (totalDefect > inspect)
    throw new Error(`Total defect (${totalDefect}) cannot exceed QTY inspect (${inspect}).`);
  if (transfer > inspect)
    throw new Error("Transfer cannot exceed QTY inspect.");

  return apiFetch(BASE, {
    method: "POST",
    body: {
      buyerName: job.buyer,
      styleCode: job.style,
      colorName: job.color,
      lineId: job.lineId,
      inspectedQuantity: inspect,
      transferQuantity: transfer,
      inspectionTimeSlot: job.hour != null ? hourLabel(job.hour) : undefined,
      defects,
      handfeel: job.handfeel,
      grade: job.grade,
      washingType: job.washingType,
      process: job.process,
      qtyCheckCartonToday: job.cartons,
    },
  });
}

export const fetchMyInspections = (section, signal) =>
  apiFetch(`${BASE}/all?section=${SECTION_ENUM[section]}`, { signal }).then((d) =>
    Array.isArray(d) ? d : []
  );

export const updateInspection = (id, body) =>
  apiFetch(`${BASE}/${id}`, { method: "PUT", body });

/* ---------- daftar milik user yang login ---------- */
export function useInspections(section, enabled) {
  const [state, setState] = useState({ list: [], loading: enabled, error: "" });

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    apiFetch(`${BASE}/all?section=${SECTION_ENUM[section]}`, { signal: ctrl.signal })
      .then((data) =>
        setState({ list: Array.isArray(data) ? data : [], loading: false, error: "" })
      )
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setState((s) => ({ ...s, loading: false, error: e.message || "Failed to load data." }));
      });
    return () => ctrl.abort();
  }, [section, enabled]);

  return state;
}

// "10.00 – 11.00" -> 10
const hourOfSlot = (slot) => {
  const m = /^(\d{1,2})[.:]/.exec(slot ?? "");
  return m ? Number(m[1]) : null;
};

// bentuk sama dengan userDay() di mock: { summary, checks }
export function inspectionUserDay(list, section, iso) {
  const rows = list
    .filter((x) => x.createdAt && localISO(new Date(x.createdAt)) === iso)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  let qty = 0;
  let insp = 0;
  let defect = 0;
  const checks = rows.map((x) => {
    const t = new Date(x.createdAt);
    insp += x.inspectQuantity || 0;
    defect += x.totalDefect || 0;
    qty += ["sewing", "finishing"].includes(section)
      ? x.transferQuantity || 0
      : x.inspectQuantity || 0;
    return {
      id: `${PREFIX[section]}-${String(x.id).slice(0, 4).toUpperCase()}`,
      hour: hourOfSlot(x.inspectionTimeSlot) ?? t.getHours(),
      time: `${pad2(t.getHours())}.${pad2(t.getMinutes())}`,
      status: x.totalDefect > 0 ? "Defect" : "Pass",
      style: x.styleCode,
      buyer: x.buyerName,
      qty: x.inspectQuantity,
      process: x.washingType
        ? x.washingType[0] + x.washingType.slice(1).toLowerCase()
        : x.process === "WASH"
          ? "Wash"
          : x.process === "NON_WASH"
            ? "Non-wash"
            : undefined,
    };
  });

  return {
    summary: {
      inspections: rows.length,
      defect,
      defectPct: insp ? +((defect / insp) * 100).toFixed(1) : 0,
      qty,
    },
    checks,
  };
}