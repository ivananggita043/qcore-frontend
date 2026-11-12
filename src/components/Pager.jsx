import { useEffect } from "react";
import "./Pager.css";

// daftar nomor halaman dengan "…" bila banyak
function pageList(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const s = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => s.add(n));
  if (page >= pages - 2)
    [pages - 1, pages - 2, pages - 3].forEach((n) => s.add(n));
  const arr = [...s].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out = [];
  arr.forEach((n, i) => {
    if (i && n - arr[i - 1] > 1) out.push(`gap${i}`);
    out.push(n);
  });
  return out;
}

export default function Pager({
  total,
  page,
  size = 10,
  onPage,
  onSize,
  sizes = [10],
}) {
  const pages = Math.max(1, Math.ceil(total / size));

  // data berkurang (filter/hapus) -> jangan tertinggal di halaman yang sudah tidak ada
  useEffect(() => {
    if (page > pages) onPage(pages);
  }, [page, pages, onPage]);

  if (total <= sizes[0]) return null;

  const from = Math.min((page - 1) * size + 1, total);
  const to = Math.min(page * size, total);
  const go = (n) => {
    if (n < 1 || n > pages || n === page) return;
    onPage(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <nav className="pg" aria-label="Pagination">
      <p className="pg-info">
        Showing {from}–{to} of {total}
      </p>

      <div className="pg-bar">
        <button
          type="button"
          className="pg-btn"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
        >
          ‹ Prev
        </button>

        <span className="pg-now">
          Page {page} of {pages}
        </span>

        <ol className="pg-nums">
          {pageList(page, pages).map((n) =>
            typeof n === "string" ? (
              <li key={n} className="pg-gap" aria-hidden="true">
                …
              </li>
            ) : (
              <li key={n}>
                <button
                  type="button"
                  className={`pg-num ${n === page ? "on" : ""}`}
                  aria-current={n === page ? "page" : undefined}
                  aria-label={`Page ${n}`}
                  onClick={() => go(n)}
                >
                  {n}
                </button>
              </li>
            ),
          )}
        </ol>

        <button
          type="button"
          className="pg-btn"
          onClick={() => go(page + 1)}
          disabled={page >= pages}
        >
          Next ›
        </button>
      </div>

      {sizes.length > 1 && onSize && (
        <label className="pg-size">
          <span>Per page</span>
          <select value={size} onChange={(e) => onSize(Number(e.target.value))}>
            {sizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
    </nav>
  );
}
