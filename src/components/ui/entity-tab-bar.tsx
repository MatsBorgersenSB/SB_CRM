"use client";

type EntityTabBarProps = {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
};

export function EntityTabBar({ tabs, active, onChange }: EntityTabBarProps) {
  return (
    <nav className="flex gap-0 border-b border-carbon-blue/10">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              selected
                ? "text-upcycle-orange"
                : "text-carbon-blue/45 hover:text-carbon-blue/70"
            }`}
          >
            {tab.label}
            {selected ? (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-upcycle-orange" />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
