const MAPKIT_CORE_SCRIPT = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js";

let loadPromise: Promise<typeof mapkit> | null = null;

export function loadMapKitJs(): Promise<typeof mapkit> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MapKit JS requires a browser environment"));
  }

  if (window.mapkit) {
    return Promise.resolve(window.mapkit);
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${MAPKIT_CORE_SCRIPT}"]`,
      );
      if (existing) {
        existing.addEventListener("load", () => resolve(window.mapkit));
        existing.addEventListener("error", () => reject(new Error("Failed to load MapKit JS")));
        return;
      }

      const script = document.createElement("script");
      script.src = MAPKIT_CORE_SCRIPT;
      script.crossOrigin = "anonymous";
      script.async = true;
      script.onload = () => resolve(window.mapkit);
      script.onerror = () => reject(new Error("Failed to load MapKit JS"));
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}
