import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

const VAPID_PUBLIC_KEY = import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushSubscription() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC_KEY) {
      setLoading(false);
      return;
    }
    setSupported(true);
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub);
        setLoading(false);
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported || !VAPID_PUBLIC_KEY) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
      });
      const json = sub.toJSON();
      await api.post("/api/v1/notifications/push/subscribe", {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys?.["p256dh"], auth: json.keys?.["auth"] },
      });
      setSubscribed(true);
    } catch (err) {
      console.error("Push subscribe failed:", err);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.post("/api/v1/notifications/push/unsubscribe", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, subscribed, loading, subscribe, unsubscribe };
}
