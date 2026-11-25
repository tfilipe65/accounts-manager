"use client";

// The width of a chart's own box, kept up to date as the window changes. The charts draw at exactly this width
// (not at a fixed width that is then stretched), so bars, lines and text keep their real size on a wide screen.

import { useEffect, useRef, useState } from "react";

export function useChartWidth(initial = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(240, Math.round(el.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
