import { useCallback, useEffect, useRef, useState } from "react";

/* Efek "genie" untuk form edit (tablet dan desktop saja).
   Form tumbuh dari tombol yang terakhir ditekan dan mengecil kembali ke tombol itu. */

let origin = null; // titik tengah tombol yang terakhir ditekan

if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (e) => {
      const b = e.target?.closest?.("button");
      if (!b) return;
      const r = b.getBoundingClientRect();
      origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    true,
  );
}

const canAnimate = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(min-width: 768px)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const CLOSE_MS = 280; // samakan dengan durasi hs-genie-out di History.css

export function useGenie(onDone) {
  // form berada di tengah layar, jadi jarak ke tombol bisa dihitung tanpa mengukur form
  const [start] = useState(() =>
    canAnimate() && origin
      ? {
          "--gx": `${origin.x - window.innerWidth / 2}px`,
          "--gy": `${origin.y - window.innerHeight / 2}px`,
        }
      : null,
  );
  const [closing, setClosing] = useState(false);
  const timer = useRef(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => () => clearTimeout(timer.current), []);

  const close = useCallback(() => {
    if (!start) return done.current();
    if (timer.current) return;
    setClosing(true);
    timer.current = setTimeout(() => done.current(), CLOSE_MS);
  }, [start]);

  return {
    close,
    style: start ?? undefined,
    overlayCls: start && closing ? " out" : "",
    sheetCls: start ? (closing ? " genie out" : " genie in") : "",
  };
}