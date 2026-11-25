"use client";

// A floating window over the page: dimmed backdrop, closes with the X, the Escape key or a click outside,
// and the page behind does not scroll. Drawn into <body> so it sits above the top bar and the frozen page header.

import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-24 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`w-full ${wide ? "max-w-5xl" : "max-w-xl"} rounded-lg bg-surface p-6 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md px-2 py-1 text-xl leading-none text-neutral-500 hover:bg-background hover:text-neutral-800">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
