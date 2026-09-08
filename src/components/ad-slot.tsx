import { useEffect, useRef } from "react";

const AD_CLIENT = "ca-pub-9117572925263537";
const LOADER_ID = "adsbygoogle-loader";
const LOADER_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Minimal AdSense display unit. Renders nothing until VITE_ADSENSE_SLOT_ID is
 * set (create one display ad unit in the AdSense dashboard and put its slot ID
 * in that env var). One instance per page, placed below content.
 *
 * The adsbygoogle loader script is injected here — and only here — so a
 * deployment without an ad slot never ships Google's ad script to visitors,
 * and the script only ever loads on pages that actually render an ad.
 */
export function AdSlot({ className }: { className?: string }) {
  const slotId = import.meta.env["VITE_ADSENSE_SLOT_ID"] as string | undefined;
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!slotId) return;

    // Inject the loader once, before the first push. Pushes issued before the
    // script has loaded are queued in window.adsbygoogle and processed by the
    // loader when it arrives, so ordering the push right after injection is
    // the supported pattern.
    if (!document.getElementById(LOADER_ID)) {
      const script = document.createElement("script");
      script.id = LOADER_ID;
      script.async = true;
      script.src = LOADER_SRC;
      document.head.appendChild(script);
    }

    if (pushedRef.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch {
      // AdSense script not ready yet — retried on next render
    }
  }, [slotId]);

  if (!slotId) return null;

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
