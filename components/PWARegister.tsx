"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

const DISMISS_KEY = "pwa-banner-dismissed";
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function isDismissed(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < DISMISS_TTL;
  } catch {
    return false;
  }
}

function saveDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
}

export default function PWARegister() {
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("[SW] Registration failed:", err));
    }

    // Already installed as standalone PWA — don't show banner
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Already dismissed recently — don't show
    if (isDismissed()) return;

    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

    if (ios) {
      const t = setTimeout(() => { setIsIOS(true); setShowBanner(true); }, 3000);
      return () => clearTimeout(t);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setInstallEvent(null);
    }
  };

  const handleDismiss = () => {
    saveDismiss();
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="flex items-start gap-3 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 shadow-2xl">
        <img
          src="/favicon.ico"
          alt="FleetOPS"
          className="w-9 h-9 rounded-lg flex-shrink-0 mt-0.5 invert"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Install FleetOPS</p>
          {isIOS ? (
            <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
              Tap{" "}
              <span className="inline-flex items-center gap-0.5 text-neutral-300">
                <Share size={11} className="inline" /> Share
              </span>{" "}
              then <span className="text-neutral-300">Add to Home Screen</span>
            </p>
          ) : (
            <p className="text-xs text-neutral-400 mt-0.5">
              Add to home screen for quick access
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          <button
            onClick={handleDismiss}
            className="text-neutral-500 hover:text-neutral-300 transition p-0.5"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="flex items-center gap-1.5 bg-white text-black text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-neutral-200 transition"
            >
              <Download size={12} />
              Install
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
