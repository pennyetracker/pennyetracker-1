import { useEffect, useState } from "react";

type LoadState = "idle" | "loading" | "ready" | "error";

let scriptPromise: Promise<void> | null = null;
let loadedKey: string | null = null;

function loadScript(apiKey: string): Promise<void> {
  if (scriptPromise && loadedKey === apiKey) return scriptPromise;
  loadedKey = apiKey;
  scriptPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("SSR"));
    // Capture and detect Google Maps auth/runtime failures (invalid key, billing, etc.)
    (window as any).gm_authFailure = () => {
      scriptPromise = null;
      loadedKey = null;
      reject(new Error("Google Maps auth failure"));
    };
    const timeout = setTimeout(() => {
      scriptPromise = null;
      loadedKey = null;
      reject(new Error("Google Maps load timeout"));
    }, 10_000);
    const done = (ok: boolean, err?: Error) => {
      clearTimeout(timeout);
      if (ok) resolve();
      else {
        scriptPromise = null;
        loadedKey = null;
        reject(err ?? new Error("Failed to load Google Maps"));
      }
    };
    if ((window as any).google?.maps) return done(true);
    const existing = document.getElementById("google-maps-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => done(true), { once: true });
      existing.addEventListener("error", () => done(false), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.id = "google-maps-js";
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=marker`;
    s.onload = () => done(true);
    s.onerror = () => done(false);
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function useGoogleMaps(apiKey: string | null | undefined) {
  const [state, setState] = useState<LoadState>(apiKey ? "loading" : "idle");

  useEffect(() => {
    if (!apiKey) {
      setState("idle");
      return;
    }
    let cancelled = false;
    setState("loading");
    loadScript(apiKey)
      .then(() => !cancelled && setState("ready"))
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return state;
}
