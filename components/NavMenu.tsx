"use client";

// The sidebar menu: the groups of the Excel main menu, each one collapsible. Every group starts
// collapsed; the ones you open are remembered in this browser (localStorage). A collapsed group still
// shows the page you are on, so you never lose your place.

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Group = { name: string; links: { href: string; label: string }[] };

const KEY = "accounts-manager.nav-open";
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function write(value: string) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // private window or blocked storage: the menu still works, it just forgets
  }
  listeners.forEach((l) => l());
}

export default function NavMenu({ groups }: { groups: Group[] }) {
  const pathname = usePathname();
  // Server render and first paint: everything collapsed; the groups you opened apply straight after.
  const saved = useSyncExternalStore(subscribe, read, () => "");
  const open = new Set(saved.split("|").filter(Boolean));

  const toggle = (name: string) => {
    const next = new Set(read().split("|").filter(Boolean));
    if (next.has(name)) next.delete(name);
    else next.add(name);
    write(Array.from(next).join("|"));
  };
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  return (
    <nav className="flex flex-1 flex-col gap-2 px-3 pb-4">
      {groups.map((g) => {
        const closed = !open.has(g.name);
        const shown = closed ? g.links.filter((l) => isActive(l.href)) : g.links;
        return (
          <div key={g.name} className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => toggle(g.name)}
              aria-expanded={!closed}
              className="flex items-center justify-between rounded-md px-3 py-1 text-left text-[11px] font-semibold uppercase tracking-wider text-white/45 hover:bg-white/5 hover:text-white/70"
            >
              {g.name}
              <svg width="10" height="10" viewBox="0 0 10 10" className={`transition-transform ${closed ? "-rotate-90" : ""}`} aria-hidden="true">
                <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {shown.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium hover:bg-white/10 hover:text-white ${
                  isActive(l.href) ? "bg-white/15 text-white" : "text-white/80"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
