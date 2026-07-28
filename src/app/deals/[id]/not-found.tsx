import Link from "next/link";

export default function Deal360NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--dashboard-bg)] p-6 text-center">
      <p className="text-lg font-semibold text-carbon-blue">Opportunity not found</p>
      <p className="max-w-sm text-sm text-carbon-blue/55">
        This opportunity may have been removed or you may not have access.
      </p>
      <Link
        href="/opportunities"
        className="mt-2 border border-upcycle-orange/30 bg-upcycle-orange px-4 py-2 text-sm font-semibold text-white"
      >
        Back to opportunities
      </Link>
    </div>
  );
}
