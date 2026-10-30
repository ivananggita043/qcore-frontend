import { apiDownload } from "./client.js";
import { loadSession } from "../auth/session.js";

const prefix = () =>
  loadSession()?.user?.role === "super_admin" ? "/super-admin/excel" : "/admin/excel";

const splitMonth = (m) => m.split("-").map(Number); // "2026-10" -> [2026, 10]

/* ---------- grouping yang didukung backend (hanya weekly & monthly) ---------- */
const G = {
  DATEWISE: "By Date",
  LINEWISE: "By Line",
  BUYERWISE: "By Buyer",
  STYLEWISE: "By Style",
};
const GROUPINGS = {
  sewing: ["DATEWISE", "LINEWISE", "BUYERWISE", "STYLEWISE"],
  washing: ["DATEWISE", "BUYERWISE", "STYLEWISE"],
  finishing: ["DATEWISE", "BUYERWISE", "STYLEWISE"],
  packing: ["DATEWISE", "BUYERWISE", "STYLEWISE"],
};

export const groupingsFor = (section, period) =>
  period === "weekly" || period === "monthly"
    ? (GROUPINGS[section] ?? []).map((key) => ({ key, label: G[key] }))
    : [];

// g = { grouping, buyer, style }
const extra = (section, g) => {
  if (!GROUPINGS[section] || !g?.grouping) return "";
  const q = [`groupingType=${g.grouping}`];
  if (g.grouping === "BUYERWISE" || g.grouping === "STYLEWISE")
    q.push(`buyer=${encodeURIComponent(g.buyer.trim())}`);
  if (g.grouping === "STYLEWISE") q.push(`style=${encodeURIComponent(g.style.trim())}`);
  return `&${q.join("&")}`;
};

// p = { date, week, month, grouping, buyer, style }  (month = "YYYY-MM")
const periods = (section) => ({
  daily: (p) => `/${section}/daily/export?date=${p.date}`,
  weekly: (p) => `/${section}/weekly/export?date=${p.week}${extra(section, p)}`,
  monthly: (p) => {
    const [y, m] = splitMonth(p.month);
    return `/${section}/monthly/export?year=${y}&month=${m}${extra(section, p)}`;
  },
  // yearly: belum ada di backend
});

const EXCEL = {
  cutting: periods("cutting"),
  sewing: periods("sewing"),
  washing: periods("washing"),
  finishing: periods("finishing"),
  packing: periods("packing"),
  // final: belum ada di backend
};

export const canDownload = (section, period) => Boolean(EXCEL[section]?.[period]);

export const downloadReport = (section, period, params, signal) =>
  apiDownload(`${prefix()}${EXCEL[section][period](params)}`, { signal });