import type { MonthlyConversion } from "@/lib/conversions-data";

function loadTone(load: number): string {
  if (load >= 85) return "bg-upcycle-orange";
  if (load >= 65) return "bg-flame";
  return "bg-carbon-blue/25";
}

export function ConversionGrid({ data }: { data: MonthlyConversion[] }) {
  return (
    <section className="border border-carbon-blue/15 bg-white">
      <header className="flex items-center justify-between border-b border-carbon-blue/10 px-3 py-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
          Facility Conversions
        </h2>
        <div className="flex items-center gap-3 font-mono text-[9px] text-carbon-blue/40">
          <span className="flex items-center gap-1">
            <span className="size-2 bg-upcycle-orange" />
            High
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 bg-flame" />
            Mid
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 bg-carbon-blue/25" />
            Low
          </span>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-px bg-carbon-blue/10 p-px">
        {data.map((month) => (
          <div key={month.label} className="flex min-w-0 flex-col bg-white">
            <div className="grid h-28 grid-rows-3 gap-px bg-carbon-blue/10 p-px">
              {month.facilities.map((facility) => (
                <div
                  key={`${month.label}-${facility.facility}`}
                  className="relative bg-carbon-blue/[0.04]"
                >
                  <div
                    className={`absolute inset-x-0 bottom-0 ${loadTone(facility.load)}`}
                    style={{ height: `${facility.load}%` }}
                  />
                </div>
              ))}
            </div>
            <p className="border-t border-carbon-blue/10 py-1 text-center font-mono text-[9px] text-carbon-blue/45">
              {month.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
