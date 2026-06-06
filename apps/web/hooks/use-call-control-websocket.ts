"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isCallControlWebSocketEnabled } from "@/lib/runtime-flags";

export type CallControlWebSocketMessage = {
  type: string;
  data: Record<string, unknown>;
};

const RECONNECT_MS = 5000;

function websocketBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_WEBSOCKET_URL?.trim() ?? "";
  return raw.replace(/\/$/, "");
}

export function useCallControlWebSocket(
  onMessage: (message: CallControlWebSocketMessage) => void,
): { connected: boolean } {
  const enabled = isCallControlWebSocketEnabled();
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  const connect = useCallback(async () => {
    const base = websocketBaseUrl();
    if (!base) return;

    const tokenRes = await fetch("/api/call-control/ws-token", { credentials: "same-origin" });
    if (!tokenRes.ok) return;
    const { token } = (await tokenRes.json()) as { token?: string };
    if (!token) return;

    const url = `${base}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.data)) as CallControlWebSocketMessage;
        if (parsed?.type) onMessageRef.current(parsed);
      } catch {
        /* ignore malformed frames */
      }
    };

    return ws;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const open = async () => {
      if (cancelled) return;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      const next = await connect();
      if (!next || cancelled) return;
      ws = next;
      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        reconnectTimer = setTimeout(() => {
          void open();
        }, RECONNECT_MS);
      };
    };

    void open();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      setConnected(false);
    };
  }, [enabled, connect]);

  return { connected };
}
