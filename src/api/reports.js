import { apiDownload } from "./client.js";
import { loadSession } from "../auth/session.js";

const prefix = () =>
  loadSession()?.user?.role === "super_admin" ? "/super-admin/excel" : "/admin/excel";

// section -> periode -> path. p = { date, week, month }  (month = "YYYY-MM")
const EXCEL = {
  cutting: {
    daily: (p) => `/cutting/daily/export?date=${p.date}`,
    weekly: (p) => `/cutting/weekly/export?date=${p.week}`,
    monthly: (p) => {
      const [y, m] = p.month.split("-").map(Number);
      return `/cutting/monthly/export?year=${y}&month=${m}`;
    },
    // yearly: belum ada di backend
  },
};

export const canDownload = (section, period) => Boolean(EXCEL[section]?.[period]);

export const downloadReport = (section, period, params, signal) =>
  apiDownload(`${prefix()}${EXCEL[section][period](params)}`, { signal });