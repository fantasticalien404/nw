"use client";

import { useEffect, useRef, useState } from "react";

const MESSAGE = "Randomized data. Log-in if you are an authorized user or try to guess the right seed to see real data";

/** Warning icon that explains the demo values on hover, focus or click. */
export function DemoNotice() {
  const button = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  // The navbar scrolls horizontally and would clip an absolutely positioned tip, so the tip is `fixed` under the icon.
  function show() {
    const rect = button.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
  }

  // Touch screens have no hover or blur: close on any tap outside.
  useEffect(() => {
    if (!position) return;
    const close = (event: PointerEvent) => {
      if (!button.current?.contains(event.target as Node)) setPosition(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [position]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label="Randomized data"
        aria-describedby={position ? "demo-notice" : undefined}
        onMouseEnter={show}
        onMouseLeave={() => setPosition(null)}
        onFocus={show}
        onBlur={() => setPosition(null)}
        onClick={show}
        onKeyDown={(event) => event.key === "Escape" && setPosition(null)}
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center text-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      </button>
      {position && (
        <span
          id="demo-notice"
          role="tooltip"
          style={{ top: position.top, right: position.right }}
          className="fixed z-50 w-64 border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm"
        >
          {MESSAGE}
        </span>
      )}
    </>
  );
}
