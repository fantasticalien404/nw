"use client";

import { toggleInSet } from "@/lib/sets";

/** Dropdown of checkboxes. An empty selection means "no filter", so the count is hidden when nothing is checked. */
export function CategoryMenu({
  id,
  label,
  options,
  selected,
  onChange,
  isOpen,
  onToggle,
  listClassName,
}: {
  id: string;
  label: string;
  options: string[];
  selected: ReadonlySet<string>;
  onChange: (selected: Set<string>) => void;
  isOpen: boolean;
  onToggle: () => void;
  listClassName: string;
}) {
  return (
    <div className="relative self-end">
      <button
        type="button"
        className="w-full border border-zinc-300 bg-white px-3 py-2 text-sm font-medium"
        aria-expanded={isOpen}
        aria-controls={isOpen ? id : undefined}
        onClick={onToggle}
      >
        {label}
        {selected.size > 0 ? ` (${selected.size})` : ""}
      </button>
      {isOpen && (
        <div id={id} className="absolute z-10 mt-1 w-80 border border-zinc-300 bg-white p-3 shadow-lg">
          <div className="mb-3 flex justify-between text-xs underline">
            <button type="button" onClick={() => onChange(new Set(options))}>
              All
            </button>
            <button type="button" onClick={() => onChange(new Set())}>
              Clear
            </button>
          </div>
          <div className={listClassName}>
            {options.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.has(option)} onChange={() => onChange(toggleInSet(selected, option))} />
                {option}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
