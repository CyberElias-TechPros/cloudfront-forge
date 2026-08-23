import { useEffect, useRef } from "react";

const AD_CLIENT = "ca-pub-9117572925263537";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Minimal AdSense display unit. Renders nothing until VITE_ADSENSE_SLOT_ID is
 * set (create one display ad unit in the AdSense dashboard and put its slot ID
 * in that env var). One instance per page, placed below content.
 */
export function AdSlot({ className }: { className?: string }) {
  const slotId = import.meta.env["VITE_ADSENSE_SLOT_ID"] as string | undefined;
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!slotId || pushedRef.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch {}
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
