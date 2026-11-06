import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-lg font-semibold text-carbon-blue">We couldn&apos;t find that page</p>
      <p className="max-w-sm text-sm text-carbon-blue/55">
        The link may be old, or the record may have been removed. Your data is safe.
      </p>
      <Link
        href="/"
        className="mt-2 border border-upcycle-orange/30 bg-upcycle-orange px-4 py-2 text-sm font-semibold text-white"
      >
        Go to Today
      </Link>
    </div>
  );
}
