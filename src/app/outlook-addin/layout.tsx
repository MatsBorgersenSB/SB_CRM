import Script from "next/script";
import type { ReactNode } from "react";

export default function OutlookAddinLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Script
        src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"
        strategy="beforeInteractive"
      />
      <div className="h-[100dvh] overflow-hidden bg-white text-carbon-blue">{children}</div>
    </>
  );
}
