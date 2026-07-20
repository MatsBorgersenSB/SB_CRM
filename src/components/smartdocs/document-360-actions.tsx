"use client";

import { useCallback, useState } from "react";
import { Check, Copy, Download, ExternalLink, Share2 } from "lucide-react";
import type { Document360Snapshot } from "@/lib/document-360-data";

type Document360ActionsProps = {
  snapshot: Document360Snapshot;
  layout?: "hero" | "card";
};

export function Document360Actions({ snapshot, layout = "card" }: Document360ActionsProps) {
  const [copied, setCopied] = useState(false);
  const documentId = snapshot.header.documentId;
  const fileName = snapshot.header.fileName;

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(documentId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [documentId]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const shareData = {
      title: snapshot.header.displayName,
      text: `${documentId} — ${snapshot.header.displayName}`,
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // fall through
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [documentId, snapshot.header.displayName]);

  const handleOpenFile = useCallback(() => {
    const section = document.getElementById("sharepoint-versions");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const buttonClass =
    layout === "hero"
      ? "inline-flex items-center gap-1.5 border border-carbon-blue/15 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange/30 hover:text-upcycle-orange"
      : "inline-flex items-center gap-1.5 border border-carbon-blue/10 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-carbon-blue/75 hover:border-upcycle-orange/30 hover:text-upcycle-orange";

  const primaryClass =
    "inline-flex items-center gap-1.5 border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white hover:bg-upcycle-orange/90";

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={handleOpenFile} className={primaryClass} title={fileName}>
        <ExternalLink className="size-3" />
        Open file
      </button>
      <a
        href={`data:text/plain;charset=utf-8,${encodeURIComponent(
          `${documentId}\n${snapshot.header.displayName}\n${fileName}`,
        )}`}
        download={`${documentId}.txt`}
        className={buttonClass}
      >
        <Download className="size-3" />
        Download
      </a>
      <button type="button" onClick={() => void handleCopyId()} className={buttonClass}>
        {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
        {copied ? "Copied" : "Copy ID"}
      </button>
      <button type="button" onClick={() => void handleShare()} className={buttonClass}>
        <Share2 className="size-3" />
        Share
      </button>
    </div>
  );
}
