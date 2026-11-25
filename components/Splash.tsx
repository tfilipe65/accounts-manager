"use client";

// The welcome screen shown when the app is opened: the same look as the start-up page of the desktop
// window (desktop/index.html), so the two read as one continuous splash. It shows once each time the
// app is opened (remembered for this window with sessionStorage), lasts about a second and a half,
// and can be skipped with a click or a key.

import { useEffect, useState } from "react";

const KEY = "accounts-manager.splash-seen";
const SHOW_MS = 1700;
const FADE_MS = 500;

export default function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
      sessionStorage.setItem(KEY, "1");
    } catch {
      // storage blocked: it just shows each time
    }
    if (seen) {
      setPhase("gone");
      return;
    }
    const fade = setTimeout(() => setPhase("fade"), SHOW_MS);
    const gone = setTimeout(() => setPhase("gone"), SHOW_MS + FADE_MS);
    const skip = () => {
      clearTimeout(fade);
      clearTimeout(gone);
      setPhase("fade");
      setTimeout(() => setPhase("gone"), FADE_MS);
    };
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("pointerdown", skip, { once: true });
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  if (phase === "gone") return null;
  return (
    <div className={`splash print:hidden ${phase === "fade" ? "splash-out" : ""}`} aria-hidden="true">
      <div className="splash-inner">
        <svg className="splash-logo" viewBox="0 0 512 512">
          <rect width="512" height="512" rx="96" fill="#1b4b66" />
          <rect x="96" y="112" width="320" height="288" rx="28" fill="#0f3245" />
          <path className="splash-line" d="M136 176h240" stroke="#d4a017" strokeWidth="28" strokeLinecap="round" fill="none" />
          <path className="splash-line splash-l2" d="M136 256h240" stroke="#d4a017" strokeWidth="28" strokeLinecap="round" fill="none" />
          <path className="splash-line splash-l3" d="M136 336h160" stroke="#d4a017" strokeWidth="28" strokeLinecap="round" fill="none" />
          <circle className="splash-tick" cx="352" cy="336" r="40" fill="#d4a017" />
          <path className="splash-tick" d="M334 336l14 14 26-30" stroke="#0f3245" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <h1 className="splash-title">
          Accounts <b>Manager</b>
        </h1>
        <div className="splash-rule" />
        <div className="splash-tag">Algarve Group</div>
        <div className="splash-bar" />
      </div>
    </div>
  );
}
