"use client";

import { useEffect } from "react";
import "./soro-blog-embed.css";

const SORO_EMBED_SRC =
  "https://app.trysoro.com/api/embed/7141efe0-3851-4b4f-bed3-c2223af9ac8f";
const SORO_SCRIPT_ID = "soro-blog-embed";
const SORO_MOUNT_ID = "soro-blog";

/**
 * Loads the Soro blog widget after hydration so the mount node matches SSR HTML
 * and client-side navigations re-run the embed script.
 */
export function SoroBlogEmbed() {
  useEffect(() => {
    document.getElementById(SORO_SCRIPT_ID)?.remove();

    const script = document.createElement("script");
    script.id = SORO_SCRIPT_ID;
    script.src = SORO_EMBED_SRC;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
      document.getElementById(SORO_MOUNT_ID)?.replaceChildren();
    };
  }, []);

  return <div id={SORO_MOUNT_ID} />;
}
