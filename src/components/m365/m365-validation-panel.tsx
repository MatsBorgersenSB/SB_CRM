import type { M365SurfaceValidation, ValidationCheck, ValidationStatus } from "@/lib/m365/validation";

const STATUS_STYLES: Record<ValidationStatus, string> = {
  pass: "border-emerald-200/80 bg-emerald-50/60 text-emerald-800",
  warn: "border-upcycle-orange/30 bg-upcycle-orange/[0.06] text-upcycle-orange",
  fail: "border-red-200/80 bg-red-50/60 text-red-800",
};

const STATUS_LABEL: Record<ValidationStatus, string> = {
  pass: "Pass",
  warn: "Review",
  fail: "Fail",
};

function CheckRow({ check }: { check: ValidationCheck }) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-carbon-blue/6 py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="text-[11px] leading-snug text-carbon-blue/75">{check.label}</p>
        {check.detail ? (
          <p className="mt-0.5 text-[10px] leading-relaxed text-carbon-blue/40">{check.detail}</p>
        ) : null}
      </div>
      <span
        className={`shrink-0 border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${STATUS_STYLES[check.status]}`}
      >
        {STATUS_LABEL[check.status]}
      </span>
    </li>
  );
}

export function M365ValidationPanel({ validation }: { validation: M365SurfaceValidation }) {
  return (
    <aside className="dashboard-card overflow-hidden">
      <div className="border-b border-carbon-blue/8 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
              Validation
            </p>
            <h2 className="mt-1 text-sm font-semibold text-carbon-blue">{validation.surface}</h2>
          </div>
          <span
            className={`border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLES[validation.overall]}`}
          >
            {STATUS_LABEL[validation.overall]}
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-carbon-blue/50">
          Hierarchy · clarity · scanability · actionability — before Outlook and Teams build.
        </p>
      </div>

      <div className="divide-y divide-carbon-blue/8">
        {validation.sections.map((section) => (
          <section key={section.title} className="px-5 py-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
              {section.title}
            </h3>
            <ul className="mt-2">
              {section.checks.map((check) => (
                <CheckRow key={`${section.title}-${check.label}`} check={check} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
