import { apiDownload } from "./client.js";
import { loadSession } from "../auth/session.js";

const prefix = () =>
  loadSession()?.user?.role === "super_admin" ? "/super-admin/excel" : "/admin/excel";

// section -> periode -> path (hanya yang sudah ada di backend)
const EXCEL = {
  cutting: {
    weekly: (p) => `/cutting/weekly/export?date=${p.week}`,
    // daily: (p) => `/cutting/daily/export?date=${p.date}`,
    // monthly: (p) => `/cutting/monthly/export?month=${p.month}`,
  },
};

export const excelPath = (section, period, params) => {
  const make = EXCEL[section]?.[period];
  return make ? `${prefix()}${make(params)}` : null;
};

export const downloadExcel = (path, signal) => apiDownload(path, { signal });