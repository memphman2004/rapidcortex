"use client";

import { useSyncExternalStore } from "react";
import {
  getIqVisionNavAlertSnapshot,
  subscribeIqVisionNavAlerts,
} from "@/lib/rapid-vision/iq-vision-nav-alert-store";

const empty = getIqVisionNavAlertSnapshot();

function getServerSnapshot() {
  return empty;
}

/** Subscribe to iQ Vision left-nav pulse state. */
export function useIqVisionNavAlert() {
  return useSyncExternalStore(
    subscribeIqVisionNavAlerts,
    getIqVisionNavAlertSnapshot,
    getServerSnapshot,
  );
}
