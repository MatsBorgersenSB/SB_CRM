import { Layers } from "lucide-react";
import type { Document360Snapshot } from "@/lib/document-360-data";

export function Document360MaterialsTab({ snapshot }: { snapshot: Document360Snapshot }) {
  const { materials } = snapshot;

  return (
    <section className="dashboard-card">
      <header className="flex items-center gap-2 border-b border-carbon-blue/8 px-5 py-3">
        <Layers className="size-4 text-carbon-blue/40" />
        <h2 className="text-sm font-semibold text-carbon-blue">Linked materials</h2>
      </header>
      {materials.length === 0 ? (
        <p className="px-5 py-8 text-sm text-carbon-blue/45">No material tracks linked.</p>
      ) : (
        <ul className="divide-y divide-carbon-blue/6">
          {materials.map((m) => (
            <li key={m.label} className="px-5 py-4">
              <p className="text-sm font-medium text-carbon-blue">{m.label}</p>
              <p className="mt-0.5 text-[10px] text-carbon-blue/45">{m.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
