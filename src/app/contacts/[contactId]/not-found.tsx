import Link from "next/link";

export default function Contact360NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--dashboard-bg)] p-6 text-center">
      <p className="text-lg font-semibold text-carbon-blue">Contact not found</p>
      <p className="max-w-sm text-sm text-carbon-blue/55">
        This contact may have been removed or you may not have access.
      </p>
      <Link
        href="/contacts"
        className="mt-2 border border-upcycle-orange/30 bg-upcycle-orange px-4 py-2 text-sm font-semibold text-white"
      >
        Back to contacts
      </Link>
    </div>
  );
}
