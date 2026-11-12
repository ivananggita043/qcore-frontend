import { useCallback, useEffect, useRef, useState } from "react";

/* Daftar riwayat dengan pagination dari server.
   - Mode halaman : hanya satu halaman diunduh dari /paginated (ringan).
   - Mode lengkap : seluruh data diunduh sekali (/all) saat pengguna memakai
     pencarian, filter buyer, tanggal, atau urutan Oldest, karena /paginated
     belum mendukung semuanya. Setelah itu paging dilakukan di browser. */

// bentuk Page Spring: { content, totalElements } atau { content, page: { totalElements } }
const readPage = (p) => ({
  items: Array.isArray(p?.content) ? p.content : [],
  total: p?.page?.totalElements ?? p?.totalElements ?? 0,
});

export function usePagedList({ fetchPage, fetchAll, page, size, resetKey }) {
  const [pg, setPg] = useState({ items: [], total: 0, loading: true, error: "" });
  const [full, setFull] = useState({ list: null, loading: false, error: "" });
  const [tick, setTick] = useState(0);

  const fp = useRef(fetchPage);
  const fa = useRef(fetchAll);
  fp.current = fetchPage;
  fa.current = fetchAll;
  const started = useRef(false);

  // ganti section: buang data lengkap yang lama
  useEffect(() => {
    started.current = false;
    setFull({ list: null, loading: false, error: "" });
  }, [resetKey]);

  const hasFull = Boolean(full.list);

  useEffect(() => {
    if (hasFull) return;
    const ctrl = new AbortController();
    setPg((s) => ({ ...s, loading: true, error: "" }));
    fp.current(page - 1, size, ctrl.signal)
      .then((p) => setPg({ ...readPage(p), loading: false, error: "" }))
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setPg((s) => ({ ...s, loading: false, error: e.message || "Failed to load history." }));
      });
    return () => ctrl.abort();
  }, [page, size, tick, hasFull, resetKey]);

  const loadFull = useCallback(() => {
    if (started.current) return;
    started.current = true;
    setFull({ list: null, loading: true, error: "" });
    fa.current()
      .then((list) => setFull({ list: Array.isArray(list) ? list : [], loading: false, error: "" }))
      .catch((e) => {
        started.current = false; // boleh dicoba lagi
        setFull({ list: null, loading: false, error: e.message || "Failed to load all data." });
      });
  }, []);

  const replace = useCallback((saved) => {
    const swap = (arr) => arr.map((x) => (x.id === saved.id ? saved : x));
    setPg((s) => ({ ...s, items: swap(s.items) }));
    setFull((s) => (s.list ? { ...s, list: swap(s.list) } : s));
  }, []);

  const remove = useCallback((id) => {
    setPg((s) => ({
      ...s,
      items: s.items.filter((x) => x.id !== id),
      total: Math.max(0, s.total - 1),
    }));
    setFull((s) => (s.list ? { ...s, list: s.list.filter((x) => x.id !== id) } : s));
    setTick((t) => t + 1); // tarik ulang halaman agar terisi penuh
  }, []);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
    if (started.current)
      fa.current()
        .then((list) => setFull({ list: Array.isArray(list) ? list : [], loading: false, error: "" }))
        .catch(() => {});
  }, []);

  return {
    items: full.list ?? pg.items,
    total: full.list ? full.list.length : pg.total,
    isFull: hasFull,
    loading: hasFull ? false : pg.loading,
    error: hasFull ? "" : pg.error,
    fullError: full.error,
    loadFull,
    replace,
    remove,
    refresh,
  };
}