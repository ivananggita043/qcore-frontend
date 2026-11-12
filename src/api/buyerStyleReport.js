import { useEffect, useState } from "react";
import { apiFetch } from "./client.js";
import { loadSession } from "../auth/session.js";

/* Buyer & Style dari endpoint laporan baru:
   GET /{admin|superadmin}/inspection/reports/styles/date?startDate&endDate
   Satu permintaan untuk tanggal terpilih + satu untuk hari sebelumnya (selisih "points").
   Catatan: laporan ini belum membawa daftar defect per style, jadi topDefects kosong. */

const pad2 = (n) => String(n).padStart(2, "0");
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dayBefore = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return isoOf(new Date(y, m - 1, d - 1));
};

const base = () =>
    loadSession()?.user?.role === "super_admin"
        ? "/superadmin/inspection/reports"
        : "/admin/inspection/reports";

const fetchStyles = (date, signal) =>
    apiFetch(`${base()}/styles/date?startDate=${date}&endDate=${date}`, { signal });

const key = (s) => String(s ?? "").trim().toUpperCase();
const rateOf = (def, qty) => (qty ? +((def / qty) * 100).toFixed(1) : 0);

const rowsOf = (rep) =>
    (rep?.summaries ?? []).map((s) => ({
        buyer: s.buyerName || "-",
        style: s.styleCode || "-",
        inspections: s.totalInspections ?? 0,
        qty: s.totalQuantityInspect ?? 0,
        defects: s.totalDefects ?? 0,
    }));

// laporan per style (hari ini, kemarin) -> [{ name, rate, delta, styles: [...] }]
export function buildBuyerStyleFromReport(cur, prev) {
    const prevStyle = new Map();
    const prevBuyer = new Map();
    rowsOf(prev).forEach((r) => {
        prevStyle.set(`${key(r.buyer)}|${key(r.style)}`, rateOf(r.defects, r.qty));
        const b = prevBuyer.get(key(r.buyer)) ?? { qty: 0, defects: 0 };
        b.qty += r.qty;
        b.defects += r.defects;
        prevBuyer.set(key(r.buyer), b);
    });

    const buyers = new Map();
    rowsOf(cur).forEach((r) => {
        const bk = key(r.buyer);
        const b = buyers.get(bk) ?? { name: r.buyer, inspections: 0, qty: 0, defects: 0, styles: [] };
        b.inspections += r.inspections;
        b.qty += r.qty;
        b.defects += r.defects;
        const rate = rateOf(r.defects, r.qty);
        const was = prevStyle.get(`${bk}|${key(r.style)}`);
        b.styles.push({
            name: r.style,
            inspections: r.inspections,
            qty: r.qty,
            defects: r.defects,
            rate,
            delta: was === undefined ? 0 : +(rate - was).toFixed(1),
            topDefects: [],
        });
        buyers.set(bk, b);
    });

    return [...buyers.values()].map((b) => {
        const rate = rateOf(b.defects, b.qty);
        const p = prevBuyer.get(key(b.name));
        return {
            name: b.name,
            inspections: b.inspections,
            qty: b.qty,
            defects: b.defects,
            rate,
            delta: p ? +(rate - rateOf(p.defects, p.qty)).toFixed(1) : 0,
            topDefects: [],
            styles: b.styles,
        };
    });
}

export function useBuyerStyleReport(date, enabled) {
    const [state, setState] = useState({ data: null, loading: enabled, error: "" });

    useEffect(() => {
        if (!enabled) return;
        const ctrl = new AbortController();
        setState((s) => ({ ...s, loading: true, error: "" }));
        Promise.all([
            fetchStyles(date, ctrl.signal),
            // data kemarin hanya untuk selisih; kalau gagal, selisih dikosongkan
            fetchStyles(dayBefore(date), ctrl.signal).catch((e) => {
                if (e?.name === "AbortError") throw e;
                return null;
            }),
        ])
            .then(([cur, prev]) =>
                setState({ data: buildBuyerStyleFromReport(cur, prev), loading: false, error: "" }),
            )
            .catch((e) => {
                if (e?.name === "AbortError") return;
                setState({ data: null, loading: false, error: e.message || "Failed to load data." });
            });
        return () => ctrl.abort();
    }, [date, enabled]);

    return state;
}