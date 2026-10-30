import { apiDownload } from "./client.js";
import { loadSession } from "../auth/session.js";

const prefix = () =>
  loadSession()?.user?.role === "super_admin" ? "/super-admin/excel" : "/admin/excel";

const splitMonth = (m) => m.split("-").map(Number); // "2026-10" -> [2026, 10]

// path periode yang sama untuk semua section
// p = { date, week, month }  (month = "YYYY-MM")
const periods = (section) => ({
  daily: (p) => `/${section}/daily/export?date=${p.date}`,
  weekly: (p) => `/${section}/weekly/export?date=${p.week}`,
  monthly: (p) => {
    const [y, m] = splitMonth(p.month);
    return `/${section}/monthly/export?year=${y}&month=${m}`;
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